import asyncio
import json
import logging
import os
import socket

import redis.asyncio as aioredis
from sqlalchemy import text

from db.session import get_session_factory
from rag.embeddings import generate_embedding, process_pending_chunks, store_embedding

logger = logging.getLogger(__name__)

STREAM = "knowledge:chunk-created"
GROUP = "embedding-workers"
CONSUMER_ID = socket.gethostname()
BLOCK_MS = 5000
COUNT = 5


async def _ensure_group(client: aioredis.Redis) -> None:
    try:
        await client.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
        logger.info("Consumer group '%s' created on stream '%s'", GROUP, STREAM)
    except aioredis.ResponseError as exc:
        if "BUSYGROUP" in str(exc):
            logger.debug("Consumer group '%s' already exists", GROUP)
        else:
            raise


async def start_embedding_consumer() -> None:
    redis_url = os.environ["REDIS_URL"]
    client = aioredis.from_url(redis_url, decode_responses=False)
    session_factory = get_session_factory()

    await _ensure_group(client)

    # Backfill any chunks that have no embedding yet
    async with session_factory() as db:
        count = await process_pending_chunks(db)
        if count:
            logger.info("Backfilled %d pending chunk(s) at startup", count)

    logger.info(
        "Embedding consumer started — stream=%s group=%s consumer=%s",
        STREAM, GROUP, CONSUMER_ID,
    )

    while True:
        try:
            results = await client.xreadgroup(
                GROUP,
                CONSUMER_ID,
                streams={STREAM: ">"},
                count=COUNT,
                block=BLOCK_MS,
            )
            if not results:
                continue

            for _stream, entries in results:
                for entry_id, fields in entries:
                    await _handle_entry(client, session_factory, entry_id, fields)

        except aioredis.ConnectionError as exc:
            logger.error("Redis connection lost: %s — retrying", exc)
            await asyncio.sleep(2)
        except Exception as exc:
            logger.error("Unexpected embedding consumer error: %s", exc, exc_info=True)
            await asyncio.sleep(1)


async def _handle_entry(client, session_factory, entry_id: bytes, fields: dict) -> None:
    raw = fields.get(b"data") or fields.get("data")
    if raw is None:
        logger.warning("Stream entry %s missing 'data' field — skipping", entry_id)
        await client.xack(STREAM, GROUP, entry_id)
        return

    payload = json.loads(raw)
    chunk_id = payload.get("chunkId")
    tenant_id = payload.get("tenantId")

    if not chunk_id:
        logger.warning("Entry %s missing chunkId — skipping", entry_id)
        await client.xack(STREAM, GROUP, entry_id)
        return

    try:
        async with session_factory() as db:
            result = await db.execute(
                text('SELECT id, content FROM "KnowledgeChunk" WHERE id = :id'),
                {"id": chunk_id},
            )
            row = result.mappings().first()

        if row is None:
            logger.warning("KnowledgeChunk %s not found — skipping", chunk_id)
            await client.xack(STREAM, GROUP, entry_id)
            return

        vector = await asyncio.get_running_loop().run_in_executor(
            None, lambda c=row["content"]: generate_embedding(c, prefix="passage")
        )
        async with session_factory() as db:
            await store_embedding(db, chunk_id, vector)

        logger.info("Embedded chunk %s (tenant=%s)", chunk_id, tenant_id)
        await client.xack(STREAM, GROUP, entry_id)

    except Exception as exc:
        logger.error("Failed to embed chunk %s: %s", chunk_id, exc, exc_info=True)
        # No XACK — stays pending for retry
