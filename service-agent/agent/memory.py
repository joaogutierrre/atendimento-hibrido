from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def get_conversation_history(
    db: AsyncSession,
    conversation_id: str,
    limit: int = 20,
) -> list[dict]:
    """Return the last `limit` messages for a conversation, oldest-first."""
    result = await db.execute(
        text(
            """
            SELECT id, sender, content, "createdAt"
            FROM "Message"
            WHERE "conversationId" = :conv_id
            ORDER BY "createdAt" DESC
            LIMIT :limit
            """
        ),
        {"conv_id": conversation_id, "limit": limit},
    )
    rows = result.mappings().all()
    return list(reversed([dict(r) for r in rows]))
