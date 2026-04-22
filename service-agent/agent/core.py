"""ReAct agent core — implemented in SPEC-12.

Stub with the expected public interface so SPEC-10 can import it safely.
"""
from dataclasses import dataclass


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
    """Process an incoming message with the ReAct agent.

    Full implementation in SPEC-12.
    """
    raise NotImplementedError("ReAct agent implemented in SPEC-12")
