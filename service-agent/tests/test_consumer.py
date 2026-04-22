"""SPEC-14 — Critério 5: modo HUMAN → agent ignora mensagens da conversa.

Requires: pytest, pytest-asyncio
  pip install pytest pytest-asyncio

Run: pytest tests/test_consumer.py -v
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_entry(mode: str, **extra) -> tuple[bytes, dict]:
    data = {
        "mode": mode,
        "conversationId": "conv-test",
        "tenantId": "tenant-test",
        "messageId": "msg-1",
        "customerRef": "42",
        "content": "olá",
        "timestamp": "2026-01-01T00:00:00Z",
        "channelType": "TELEGRAM",
        **extra,
    }
    return b"1234-0", {b"data": json.dumps(data).encode()}


def _redis_client() -> MagicMock:
    client = MagicMock()
    client.xack = AsyncMock()
    client.publish = AsyncMock()
    return client


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_human_mode_ignores_and_acks():
    """Conversation in HUMAN mode: entry is acked, run_agent is never called."""
    from consumer.redis_consumer import _process_entry

    entry_id, fields = _make_entry("HUMAN")
    client = _redis_client()

    with patch("consumer.redis_consumer.run_agent") as mock_run:
        await _process_entry(client, entry_id, fields)

    mock_run.assert_not_called()
    client.xack.assert_called_once()


@pytest.mark.asyncio
async def test_ai_mode_calls_run_agent():
    """Conversation in AI mode: run_agent is invoked with correct IncomingMessage."""
    from consumer.redis_consumer import _process_entry

    entry_id, fields = _make_entry("AI", content="qual o horário?")
    client = _redis_client()

    with patch("consumer.redis_consumer.run_agent", new_callable=AsyncMock) as mock_run:
        await _process_entry(client, entry_id, fields)

    mock_run.assert_called_once()
    msg = mock_run.call_args[0][0]
    assert msg.conversation_id == "conv-test"
    assert msg.tenant_id == "tenant-test"
    assert msg.content == "qual o horário?"


@pytest.mark.asyncio
async def test_ai_mode_acks_after_success():
    """Entry is XACK'd after successful run_agent call."""
    from consumer.redis_consumer import _process_entry

    entry_id, fields = _make_entry("AI")
    client = _redis_client()

    with patch("consumer.redis_consumer.run_agent", new_callable=AsyncMock):
        await _process_entry(client, entry_id, fields)

    client.xack.assert_called_once()


@pytest.mark.asyncio
async def test_run_agent_error_does_not_ack():
    """If run_agent raises, entry is NOT acked (stays pending for retry)."""
    from consumer.redis_consumer import _process_entry

    entry_id, fields = _make_entry("AI")
    client = _redis_client()

    with patch(
        "consumer.redis_consumer.run_agent",
        new_callable=AsyncMock,
        side_effect=RuntimeError("LLM timeout"),
    ):
        await _process_entry(client, entry_id, fields)

    client.xack.assert_not_called()


@pytest.mark.asyncio
async def test_missing_data_field_skips_silently():
    """Entry with no 'data' field is acked and ignored (no crash)."""
    from consumer.redis_consumer import _process_entry

    client = _redis_client()
    await _process_entry(client, b"9999-0", {})

    client.xack.assert_called_once()
