import asyncio
import json
import logging
import os
import socket

import redis.asyncio as aioredis

from agent.core import IncomingMessage, run_agent

logger = logging.getLogger(__name__)

STREAM = "messaging:incoming"
GROUP = "agent-consumers"
CONSUMER_ID = socket.gethostname()
BLOCK_MS = 5000
COUNT = 10

AGENT_RESPOND = "agent:respond"
AGENT_ESCALATE = "agent:escalate"


async def _ensure_group(client: aioredis.Redis) -> None:
    try:
        await client.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
        logger.info("Consumer group '%s' created on stream '%s'", GROUP, STREAM)
    except aioredis.ResponseError as exc:
        if "BUSYGROUP" in str(exc):
            logger.debug("Consumer group '%s' already exists — skipping create", GROUP)
        else:
            raise


async def _process_entry(client: aioredis.Redis, entry_id: bytes, fields: dict) -> None:
    raw = fields.get(b"data") or fields.get("data")
    if raw is None:
        logger.warning("Stream entry %s has no 'data' field — skipping", entry_id)
        await client.xack(STREAM, GROUP, entry_id)
        return

    payload = json.loads(raw)
    mode = payload.get("mode", "AI")
    conversation_id = payload.get("conversationId", "?")
    tenant_id = payload.get("tenantId", "?")

    if mode == "HUMAN":
        logger.info("conv=%s mode=HUMAN — ignoring (entry %s)", conversation_id, entry_id)
        await client.xack(STREAM, GROUP, entry_id)
        return

    logger.info("conv=%s mode=AI — processing (entry %s)", conversation_id, entry_id)

    message = IncomingMessage(
        tenant_id=tenant_id,
        channel_type=payload.get("channelType", ""),
        conversation_id=conversation_id,
        message_id=payload.get("messageId", ""),
        customer_ref=payload.get("customerRef", ""),
        content=payload.get("content", ""),
        timestamp=payload.get("timestamp", ""),
        mode=mode,
    )

    try:
        await run_agent(message)
    except Exception as exc:
        # Unhandled error: do NOT xack — message stays pending for retry
        logger.error("Error processing entry %s: %s", entry_id, exc, exc_info=True)
        return

    await client.xack(STREAM, GROUP, entry_id)


async def start_consumer() -> None:
    redis_url = os.environ["REDIS_URL"]
    client = aioredis.from_url(redis_url, decode_responses=False)

    await _ensure_group(client)
    logger.info(
        "Redis consumer started — stream=%s group=%s consumer=%s",
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
                    await _process_entry(client, entry_id, fields)

        except aioredis.ConnectionError as exc:
            logger.error("Redis connection lost: %s — retrying", exc)
            await asyncio.sleep(2)
        except Exception as exc:
            logger.error("Unexpected consumer error: %s", exc, exc_info=True)
            await asyncio.sleep(1)
