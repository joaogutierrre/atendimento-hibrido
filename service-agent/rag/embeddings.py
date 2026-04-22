"""Embedding generation for KnowledgeChunk records — implemented in SPEC-11."""
from sqlalchemy.ext.asyncio import AsyncSession


async def generate_embedding(text: str) -> list[float]:
    """Generate a 1536-dimension embedding vector for the given text."""
    raise NotImplementedError("Implemented in SPEC-11")


async def process_pending_chunks(db: AsyncSession) -> None:
    """Find KnowledgeChunk rows with null embedding and fill them."""
    raise NotImplementedError("Implemented in SPEC-11")
