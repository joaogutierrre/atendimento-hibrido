"""ReAct agent core using LangGraph + Ollama (local LLM)."""
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import redis.asyncio as aioredis
from langchain_core.messages import SystemMessage
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent

from agent.prompts import AgentConfig, build_system_prompt, load_agent_config
from agent.tools import AGENT_RESPOND, make_tools
from db.session import get_session_factory

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma:4b")
TENANT_TIMEZONE = os.getenv("TENANT_TIMEZONE", "America/Sao_Paulo")


def _tenant_now_hour() -> int:
    try:
        tz = ZoneInfo(TENANT_TIMEZONE)
    except ZoneInfoNotFoundError:
        logger.warning("Unknown TENANT_TIMEZONE=%r, falling back to UTC", TENANT_TIMEZONE)
        tz = ZoneInfo("UTC")
    return datetime.now(tz).hour

_redis_client: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            os.environ["REDIS_URL"], decode_responses=True
        )
    return _redis_client


def _default_config() -> AgentConfig:
    return AgentConfig(
        system_prompt=(
            "Você é um assistente de atendimento ao cliente. "
            "Seja útil, conciso e profissional."
        ),
        tone="professional",
        escalate_on_words=[],
        off_hours_message=None,
        working_hours_start=0,
        working_hours_end=24,
    )


@dataclass
class IncomingMessage:
    tenant_id: str
    channel_type: str
    conversation_id: str
    message_id: str
    customer_ref: str
    content: str
    timestamp: str


async def run_agent(message: IncomingMessage) -> None:
    redis = _get_redis()
    session_factory = get_session_factory()

    async with session_factory() as db:
        config = await load_agent_config(db, message.tenant_id)

    if config is None:
        logger.warning("No AgentConfig for tenant %s — using defaults", message.tenant_id)
        config = _default_config()

    # Off-hours check in tenant timezone — never bypasses the LLM. The flag is passed
    # to the prompt so the agent keeps answering FAQ but defers human-only requests.
    now_hour = _tenant_now_hour()
    is_off_hours = not (
        config.working_hours_start <= now_hour < config.working_hours_end
    )

    # Trigger-word fast path — escalate during business hours, defer otherwise.
    content_lower = message.content.lower()
    for word in config.escalate_on_words:
        if word.lower() in content_lower:
            channel = "agent:defer" if is_off_hours else "agent:escalate"
            await redis.publish(
                channel,
                json.dumps({
                    "conversationId": message.conversation_id,
                    "tenantId": message.tenant_id,
                    "reason": f"Palavra-gatilho detectada: '{word}'",
                }),
            )
            if is_off_hours and config.off_hours_message:
                await redis.publish(
                    AGENT_RESPOND,
                    json.dumps({
                        "conversationId": message.conversation_id,
                        "tenantId": message.tenant_id,
                        "content": config.off_hours_message,
                    }),
                )
            logger.info(
                "Trigger-word '%s' → %s conv=%s",
                word,
                "deferring" if is_off_hours else "escalating",
                message.conversation_id,
            )
            return

    system_prompt = build_system_prompt(config, is_off_hours=is_off_hours)
    tools = make_tools(message.conversation_id, message.tenant_id, redis)

    llm = ChatOllama(model=OLLAMA_MODEL, base_url=OLLAMA_BASE_URL, temperature=0)
    agent = create_react_agent(
        llm,
        tools,
        state_modifier=SystemMessage(content=system_prompt),
    )

    from langchain_core.messages import HumanMessage

    logger.info(
        "Running agent for conv=%s tenant=%s model=%s",
        message.conversation_id,
        message.tenant_id,
        OLLAMA_MODEL,
    )

    result = await agent.ainvoke(
        {"messages": [HumanMessage(content=message.content)]}
    )

    # Fallback: if the model returned text without calling send_message, publish it
    messages = result.get("messages", [])
    tool_names_called = {
        tc["name"]
        for msg in messages
        if hasattr(msg, "tool_calls")
        for tc in (msg.tool_calls or [])
    }

    if "send_message" not in tool_names_called and "escalate_to_human" not in tool_names_called:
        for msg in reversed(messages):
            if hasattr(msg, "content") and msg.content and not hasattr(msg, "tool_call_id"):
                await redis.publish(
                    AGENT_RESPOND,
                    json.dumps({
                        "conversationId": message.conversation_id,
                        "tenantId": message.tenant_id,
                        "content": msg.content,
                    }),
                )
                logger.warning(
                    "Fallback publish used for conv=%s (model didn't call send_message)",
                    message.conversation_id,
                )
                break
