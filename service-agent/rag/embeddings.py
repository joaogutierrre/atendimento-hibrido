import logging
from functools import lru_cache

from sentence_transformers import SentenceTransformer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# asymmetric model: passages prefixed with "passage: ", queries with "query: "
EMBEDDING_MODEL = "intfloat/multilingual-e5-small"


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    logger.info("Loading embedding model %s", EMBEDDING_MODEL)
    return SentenceTransformer(EMBEDDING_MODEL)


def generate_embedding(text_input: str, prefix: str = "passage") -> list[float]:
    """Generate a 384-dim embedding. Use prefix='query' for search queries."""
    model = _get_model()
    vector = model.encode(f"{prefix}: {text_input}", normalize_embeddings=True)
    return vector.tolist()


async def store_embedding(db: AsyncSession, chunk_id: str, vector: list[float]) -> None:
    vector_str = "[" + ",".join(str(v) for v in vector) + "]"
    await db.execute(
        text('UPDATE "KnowledgeChunk" SET "embedding" = :vec WHERE "id" = :id'),
        {"vec": vector_str, "id": chunk_id},
    )
    await db.commit()


async def process_pending_chunks(db: AsyncSession) -> int:
    import asyncio
    result = await db.execute(
        text('SELECT id, content FROM "KnowledgeChunk" WHERE "embedding" IS NULL')
    )
    rows = result.mappings().all()
    if not rows:
        return 0

    logger.info("Processing %d pending KnowledgeChunk(s)...", len(rows))
    loop = asyncio.get_running_loop()
    for row in rows:
        # run_in_executor so encode doesn't block the event loop
        vector = await loop.run_in_executor(
            None, lambda c=row["content"]: generate_embedding(c, prefix="passage")
        )
        await store_embedding(db, row["id"], vector)
        logger.debug("Embedded chunk %s", row["id"])

    return len(rows)
