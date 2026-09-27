import re
from typing import Any

from pydantic import BaseModel

from app.shared.application.context import ActionContext
from app.shared.application.ports import UnitOfWork
from app.shared.application.results import Result
from app.shared.domain.errors import AppError, bad_request, conflict, found


def expected_version(if_match: str | None, body_version: int | None) -> int:
    if body_version is not None:
        return body_version
    match = re.search("\\d+", if_match or "")
    if not match:
        raise bad_request(
            "VERSION_REQUIRED", "If-Match 헤더 또는 version 값이 필요합니다."
        )
    return int(match.group())


def patch_row(
    connection: UnitOfWork,
    context: ActionContext,
    user: dict,
    table: str,
    resource_id: str,
    festival_id: str,
    body: BaseModel | dict,
    if_match: str | None = None,
    *,
    required_status: str | None = None,
    conflict_message: str | None = None,
) -> dict:
    """축제 범위 안에서 낙관적 잠금으로 한 행을 수정하고 감사 로그를 남긴다.

    body가 Patch 스키마면 version을 빼고 나머지를 변경값으로 쓴다. version이 본문에
    없으면 If-Match 헤더에서 읽는다. 호출부마다 model_dump를 반복하지 않기 위해서다.

    """
    values = (
        body
        if isinstance(body, dict)
        else body.model_dump(exclude_none=True, exclude={"version"})
    )
    if not values:
        raise bad_request("VALIDATION_ERROR", "변경할 값이 없습니다.")
    version = expected_version(if_match, getattr(body, "version", None))

    scope_column = "id" if table == "festivals" else "festival_id"
    before = found(
        connection.common.patch_row_select_rows(
            (resource_id, festival_id),
            scope_column=scope_column,
            table=table,
        )
    )
    row = connection.common.patch_row_select_rows_2(
        (resource_id, festival_id, version),
        values=values,
        required_status=required_status,
        scope_column=scope_column,
        table=table,
    )
    if not row:
        raise conflict(
            "RESOURCE_VERSION_CONFLICT",
            conflict_message
            or "다른 사용자가 먼저 수정했습니다. 최신 값을 다시 조회해 주세요.",
        )
    logged(
        connection,
        context,
        user,
        festival_id,
        "UPDATE",
        table.upper(),
        resource_id,
        before_data=before,
        after_data=row,
    )
    return row


def logged(
    connection: UnitOfWork,
    context: ActionContext,
    user: dict,
    festival_id: str | None,
    action: str,
    resource_type: str,
    resource_id,
    **data,
) -> None:
    """운영자 감사 로그 한 줄.

    라우트는 어느 행을 어떻게 바꿨는지만 넘기면 된다 — 누가(actor_id) 어떤 요청에서
    (request_id) 했는지는 모든 호출부가 같은 자리에서 꺼내던 값이라 여기서 채운다.
    """
    connection.audit.audit(
        festival_id=festival_id,
        actor_id=str(user["id"]),
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        request_id=context.request_id,
        **data,
    )


def created(
    connection: UnitOfWork,
    context: ActionContext,
    user: dict,
    festival_id: str | None,
    resource_type: str,
    row: dict,
    after_data: Any = None,
) -> None:
    """CREATE 감사 로그. after_data를 주면 행 전체 대신 그 값만 남긴다(비밀번호 해시가 섞인 행 등)."""
    logged(
        connection,
        context,
        user,
        festival_id,
        "CREATE",
        resource_type,
        str(row["id"]),
        after_data=row if after_data is None else after_data,
    )


def in_festival(
    connection: UnitOfWork, table: str, resource_id: str, festival_id: str
) -> bool:
    """resource_id가 이 축제에 속하는지. 테이블명은 SQL 상수여야 한다(사용자 입력 금지)."""
    return bool(
        connection.common.in_festival_select_rows(
            (resource_id, festival_id), table=table
        )
    )


def scoped(
    connection: UnitOfWork,
    table: str,
    resource_id: str,
    festival_id: str,
    message: str = "리소스를 찾을 수 없습니다.",
) -> None:
    """축제 범위 밖이면 404. 범위 확인만 하고 행은 쓰지 않는 라우트가 쓴다."""
    if not in_festival(connection, table, resource_id, festival_id):
        raise AppError(404, "RESOURCE_NOT_FOUND", message)


def archive(
    connection: UnitOfWork,
    context: ActionContext,
    user: dict,
    table: str,
    resource_id: str,
    festival_id: str,
    if_match: str | None,
    status: str = "ARCHIVED",
) -> Result:
    patch_row(
        connection,
        context,
        user,
        table,
        resource_id,
        festival_id,
        {"status": status},
        if_match,
    )
    return Result(status_code=204)
