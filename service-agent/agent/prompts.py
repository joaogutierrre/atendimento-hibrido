from dataclasses import dataclass


@dataclass
class AgentConfig:
    system_prompt: str
    tone: str
    escalate_on_words: list[str]
    off_hours_message: str | None
    working_hours_start: int
    working_hours_end: int


def build_system_prompt(config: AgentConfig) -> str:
    """Build the system prompt for a tenant's agent from its AgentConfig."""
    lines = [
        config.system_prompt,
        f"\nTom de comunicação: {config.tone}.",
    ]
    if config.escalate_on_words:
        words = ", ".join(config.escalate_on_words)
        lines.append(
            f"\nSe o cliente mencionar qualquer uma destas palavras, escalone imediatamente para um humano: {words}."
        )
    if config.off_hours_message:
        lines.append(f"\nFora do horário de atendimento, responda: {config.off_hours_message}")
    return "\n".join(lines)
