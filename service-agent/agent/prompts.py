from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class AgentConfig:
    system_prompt: str
    tone: str
    escalate_on_words: list[str]
    off_hours_message: str | None
    working_hours_start: int
    working_hours_end: int


async def load_agent_config(db: AsyncSession, tenant_id: str) -> AgentConfig | None:
    result = await db.execute(
        text(
            'SELECT "systemPrompt", tone, "escalateOnWords", "offHoursMessage", '
            '"workingHoursStart", "workingHoursEnd" '
            'FROM "AgentConfig" WHERE "tenantId" = :tid'
        ),
        {"tid": tenant_id},
    )
    row = result.mappings().first()
    if row is None:
        return None
    return AgentConfig(
        system_prompt=row["systemPrompt"],
        tone=row["tone"],
        escalate_on_words=list(row["escalateOnWords"]) if row["escalateOnWords"] else [],
        off_hours_message=row["offHoursMessage"],
        working_hours_start=row["workingHoursStart"],
        working_hours_end=row["workingHoursEnd"],
    )


def build_system_prompt(config: AgentConfig) -> str:
    lines = [
        config.system_prompt,
        f"\nTom de comunicação: {config.tone}.",
    ]
    if config.escalate_on_words:
        words = ", ".join(config.escalate_on_words)
        lines.append(
            f"\nSe o cliente mencionar qualquer uma destas palavras, "
            f"use imediatamente a ferramenta escalate_to_human: {words}."
        )
    lines.append(
        "\nSempre use a ferramenta send_message para entregar sua resposta ao cliente. "
        "Se não encontrar a informação na base de conhecimento, use escalate_to_human "
        "com motivo 'Informação não encontrada na base de conhecimento'."
    )
    if config.off_hours_message:
        lines.append(
            f"\nFora do horário de atendimento, responda: {config.off_hours_message}"
        )
    return "\n".join(lines)
