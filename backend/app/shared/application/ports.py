from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any, Protocol

from app.shared.application.policy import Policy


class AI(Protocol):
    RISK_INSTRUCTION: str
    ESG_INSTRUCTION: str

    def briefing(self, instruction: str, context: list[str]) -> str | None: ...
    def grounded_answer(self, question: str, sources: list[dict]) -> str | None: ...
    def answer_with_festival_context(
        self, question: str, festival_context: dict
    ) -> str | None: ...


class Tokens(Protocol):
    DUMMY_PASSWORD_HASH: str

    def hash_token(self, token: str) -> str: ...
    def random_token(self, prefix: str) -> str: ...
    def hash_password(self, password: str) -> str: ...
    def verify_password(self, password: str, encoded: str) -> bool: ...
    def access_token(self, user_id: str, membership_id: str) -> str: ...


class Exports(Protocol):
    def build_table_artifact(self, rows, columns, export_format, stem) -> dict: ...
    def build_report_artifact(self, report: dict, export_format: str) -> dict: ...


class CommonRepository(Protocol):
    def patch_row_select_rows(
        self, params: Any = (), *, scope_column: Any, table: Any
    ) -> Any: ...
    def patch_row_select_rows_2(
        self,
        params: Any = (),
        *,
        values: Any,
        required_status: Any,
        scope_column: Any,
        table: Any,
    ) -> Any: ...
    def in_festival_select_rows(self, params: Any = (), *, table: Any) -> Any: ...
    def active_area(self, params: Any) -> Any: ...


class AuditRepository(Protocol):
    def audit(
        self,
        *,
        festival_id: str | None,
        actor_id: str | None,
        action: str,
        resource_type: str,
        resource_id: str | None,
        request_id: str,
        before_data: Any = None,
        after_data: Any = None,
    ) -> None: ...


class NotificationsRepository(Protocol):
    def deliveries(
        self, festival_id: Any, resource_type: str, resource_ids: list, session_id: Any
    ) -> None: ...


class IdempotencyRepository(Protocol):
    def lock(self, scope: Any, key: Any) -> Any: ...
    def previous(self, scope: Any, key: Any) -> Any: ...
    def save(
        self, scope: Any, key: Any, request_hash: Any, status: Any, response: Any
    ) -> Any: ...


class UnitOfWork(Protocol):
    common: CommonRepository
    audit: AuditRepository
    notifications: NotificationsRepository
    idempotency: IdempotencyRepository
    ai: AI
    tokens: Tokens
    exports: Exports
    policy: Policy

    def commit(self) -> None: ...
    def transaction(self) -> AbstractContextManager: ...
    def external_io(self) -> AbstractContextManager: ...
