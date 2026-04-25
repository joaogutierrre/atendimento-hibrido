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
    min_embedding_score: float = 0.3


async def load_agent_config(db: AsyncSession, tenant_id: str) -> AgentConfig | None:
    result = await db.execute(
        text(
            'SELECT "systemPrompt", tone, "escalateOnWords", "offHoursMessage", '
            '"workingHoursStart", "workingHoursEnd", "minEmbeddingScore" '
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
        min_embedding_score=float(row["minEmbeddingScore"]),
    )


def build_system_prompt(config: AgentConfig, is_off_hours: bool = False) -> str:
    lines = [
        config.system_prompt,
        f"\nTom de comunicação: {config.tone}.",
    ]
    lines.append(
        "\nSempre use a ferramenta send_message para entregar sua resposta ao cliente. "
        "Continue atendendo dúvidas, FAQ e perguntas gerais usando a base de conhecimento — "
        "você está disponível para o cliente em qualquer horário."
    )

    if is_off_hours:
        off_hours_note = (
            f' Diga ao cliente: "{config.off_hours_message}"'
            if config.off_hours_message
            else ""
        )
        lines.append(
            "\nATENÇÃO: estamos FORA do horário de atendimento humano. O time só retornará "
            "no próximo horário comercial. Mesmo assim, você (IA) continua disponível para "
            "responder dúvidas. Se a solicitação exigir intervenção humana (cancelamento, "
            "reagendamento, reclamação formal, ou qualquer ação que você não consiga concluir), "
            "use a ferramenta defer_to_human (NÃO use escalate_to_human) para registrar a "
            "pendência, e na mesma resposta avise o cliente que será retornada em horário "
            "comercial." + off_hours_note + " Pergunte se há mais alguma dúvida que você "
            "possa esclarecer enquanto isso."
        )
        if config.escalate_on_words:
            words = ", ".join(config.escalate_on_words)
            lines.append(
                f"\nSe o cliente mencionar qualquer uma destas palavras: {words} — "
                "use defer_to_human (não escalate_to_human) por estarmos fora de hora."
            )
        lines.append(
            "\nSe não encontrar a informação na base de conhecimento, use defer_to_human "
            "com motivo 'Informação não encontrada na base de conhecimento'."
        )
    else:
        if config.escalate_on_words:
            words = ", ".join(config.escalate_on_words)
            lines.append(
                f"\nSe o cliente mencionar qualquer uma destas palavras, "
                f"use imediatamente a ferramenta escalate_to_human: {words}."
            )
        lines.append(
            "\nSe não encontrar a informação na base de conhecimento, use escalate_to_human "
            "com motivo 'Informação não encontrada na base de conhecimento'."
        )

    return "\n".join(lines)
