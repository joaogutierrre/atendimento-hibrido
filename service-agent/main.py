import asyncio
import logging
import os
import sys

import redis.asyncio as aioredis
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

from consumer.redis_consumer import start_consumer

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
PORT = int(os.getenv("PORT", "8000"))

app = FastAPI(title="service-agent", version="0.1.0")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


async def check_postgres() -> None:
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


async def check_redis() -> None:
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


async def startup() -> None:
    await check_postgres()
    await check_redis()
    await start_consumer()


if __name__ == "__main__":
    asyncio.run(startup())

    config = uvicorn.Config(app, host="0.0.0.0", port=PORT, log_level="info")
    server = uvicorn.Server(config)
    asyncio.run(server.serve())
