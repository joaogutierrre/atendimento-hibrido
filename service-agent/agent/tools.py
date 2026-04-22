"""LangChain-compatible tools for the ReAct agent (implemented in SPEC-12)."""
from langchain_core.tools import tool


@tool
async def send_message(conversation_id: str, content: str) -> str:
    """Send a message to the customer via the correct channel.

    Publishes agent:respond to Redis so service-gateway delivers it.
    """
    raise NotImplementedError("Implemented in SPEC-12")


@tool
async def escalate_to_human(conversation_id: str, reason: str) -> str:
    """Escalate the conversation to a human agent.

    Publishes agent:escalate to Redis so service-gateway switches mode to HUMAN.
    """
    raise NotImplementedError("Implemented in SPEC-12")


@tool
async def search_knowledge_base(tenant_id: str, query: str) -> str:
    """Search the tenant's knowledge base using semantic similarity (RAG).

    Returns the top-3 most relevant chunks.
    """
    raise NotImplementedError("Implemented in SPEC-11")


@tool
async def get_conversation_history_tool(conversation_id: str) -> str:
    """Retrieve the last N messages of a conversation for context."""
    raise NotImplementedError("Implemented in SPEC-12")


AGENT_TOOLS = [
    send_message,
    escalate_to_human,
    search_knowledge_base,
    get_conversation_history_tool,
]
