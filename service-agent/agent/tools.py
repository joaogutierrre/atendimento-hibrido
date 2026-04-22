"""LangChain tools for the ReAct agent — created per-request via make_tools()."""
import json
import logging

import redis.asyncio as aioredis
from langchain_core.tools import tool

from agent.memory import get_conversation_history
from db.session import get_session_factory
from rag.retriever import search_knowledge_base as _search_kb

logger = logging.getLogger(__name__)

AGENT_RESPOND = "agent:respond"
AGENT_ESCALATE = "agent:escalate"


def make_tools(conversation_id: str, tenant_id: str, redis_client: aioredis.Redis) -> list:
    """Create tool instances bound to the current conversation context."""

    @tool
    async def send_message(content: str) -> str:
        """Send a reply to the customer. Always call this to deliver your answer."""
        payload = json.dumps({
            "conversationId": conversation_id,
            "tenantId": tenant_id,
            "content": content,
        })
        await redis_client.publish(AGENT_RESPOND, payload)
        logger.info("send_message conv=%s published %d chars", conversation_id, len(content))
        return "Message sent successfully"

    @tool
    async def escalate_to_human(reason: str) -> str:
        """Escalate the conversation to a human agent when you cannot help."""
        payload = json.dumps({
            "conversationId": conversation_id,
            "tenantId": tenant_id,
            "reason": reason,
        })
        await redis_client.publish(AGENT_ESCALATE, payload)
        logger.info("escalate_to_human conv=%s reason=%r", conversation_id, reason)
        return f"Escalated to human: {reason}"

    @tool
    async def search_knowledge_base(query: str) -> str:
        """Search the tenant knowledge base for information relevant to the query."""
        session_factory = get_session_factory()
        async with session_factory() as db:
            results = await _search_kb(db, tenant_id, query)
        if not results:
            return json.dumps({"found": False, "chunks": []})
        return json.dumps({"found": True, "chunks": results}, ensure_ascii=False)

    @tool
    async def get_conversation_history() -> str:
        """Retrieve recent conversation messages for context."""
        session_factory = get_session_factory()
        async with session_factory() as db:
            history = await get_conversation_history(db, conversation_id)
        return json.dumps(history, ensure_ascii=False, default=str)

    return [send_message, escalate_to_human, search_knowledge_base, get_conversation_history]
