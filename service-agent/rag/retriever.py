import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from rag.embeddings import generate_embedding

logger = logging.getLogger(__name__)

TOP_K = 3
DEFAULT_MIN_SCORE = 0.3  # cosine similarity threshold (1 - cosine_distance)


async def search_knowledge_base(
    db: AsyncSession,
    tenant_id: str,
    query: str,
    top_k: int = TOP_K,
    min_score: float = DEFAULT_MIN_SCORE,
) -> list[dict]:
    """Return top-k KnowledgeChunk records most similar to query.

    Score = 1 - cosine_distance (range 0-1, higher = more similar).
    Only returns chunks with score >= MIN_SCORE.
    """
    query_vector = generate_embedding(query, prefix="query")
    vector_str = "[" + ",".join(str(v) for v in query_vector) + "]"

    result = await db.execute(
        text(
            """
            SELECT id, content, "sourceUrl",
                   1 - (embedding <=> CAST(:vec AS vector)) AS score
            FROM "KnowledgeChunk"
            WHERE "tenantId" = :tenant_id
              AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :top_k
            """
        ),
        {"vec": vector_str, "tenant_id": tenant_id, "top_k": top_k},
    )
    rows = result.mappings().all()

    chunks = [
        {"id": r["id"], "content": r["content"], "sourceUrl": r["sourceUrl"], "score": float(r["score"])}
        for r in rows
        if float(r["score"]) >= min_score
    ]

    logger.debug("search_knowledge_base tenant=%s query=%r → %d results", tenant_id, query[:50], len(chunks))
    return chunks
