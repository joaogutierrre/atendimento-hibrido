"""Redis consumer for messaging:incoming — implemented in SPEC-10."""
import logging

logger = logging.getLogger(__name__)


async def start_consumer() -> None:
    """Start the Redis consumer group loop for the messaging:incoming channel.

    Full implementation in SPEC-10 (consumer groups, routing, error handling).
    """
    logger.info("Redis consumer not implemented (SPEC-10) — skipping startup")
