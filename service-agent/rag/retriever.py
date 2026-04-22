"""Semantic retrieval from the pgvector knowledge base — implemented in SPEC-11."""
from sqlalchemy.ext.asyncio import AsyncSession


async def search_knowledge_base(
    db: AsyncSession,
    tenant_id: str,
    query: str,
    top_k: int = 3,
) -> list[dict]:
    """Return the top-k most semantically similar KnowledgeChunk records.

    Uses pgvector <-> (L2 distance) operator.
    """
    raise NotImplementedError("Implemented in SPEC-11")
