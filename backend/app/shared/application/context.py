from dataclasses import dataclass


@dataclass(frozen=True)
class ActionContext:
    request_id: str
    language: str | None = None
    device_key: str = ""
