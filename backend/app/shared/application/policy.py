from dataclasses import dataclass

PURGE_EVERY_TICKS = 3600


@dataclass(frozen=True)
class Policy:
    refresh_token_days: int
    visitor_session_hours: int
    login_max_failures: int
    login_lock_minutes: int
    recommendation_event_retention_days: int
    idempotency_retention_days: int
    visitor_session_retention_days: int
