import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from consumer.embedding_consumer import start_embedding_consumer
from consumer.redis_consumer import start_consumer
from rag.embeddings import _get_model

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
PORT = int(os.getenv("PORT", "8000"))


async def _check_postgres() -> None:
    if not DATABASE_URL:
        logger.error("DATABASE_URL is not set")
        sys.exit(1)
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("PostgreSQL connection OK")
    except Exception as exc:
        logger.error("PostgreSQL connection FAILED: %s", exc)
        sys.exit(1)
    finally:
        await engine.dispose()


async def _check_redis() -> None:
    if not REDIS_URL:
        logger.error("REDIS_URL is not set")
        sys.exit(1)
    client = aioredis.from_url(REDIS_URL, socket_connect_timeout=5)
    try:
        await client.ping()
        logger.info("Redis connection OK")
    except Exception as exc:
        logger.error("Redis connection FAILED: %s", exc)
        sys.exit(1)
    finally:
        await client.aclose()


_bg_tasks: set = set()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await _check_postgres()
    await _check_redis()
    # Pre-load embedding model before tasks start so model.encode() in threads
    # doesn't race with the event loop startup.
    _get_model()
    # Keep strong references to tasks — asyncio only holds weak refs and GC
    # can collect un-referenced tasks mid-execution.
    for coro in (start_consumer(), start_embedding_consumer()):
        task = asyncio.create_task(coro)
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)
    yield


app = FastAPI(title="service-agent", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
