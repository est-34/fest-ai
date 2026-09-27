"운영 내부 문서와 그 문서만 근거로 삼는 검색(AI-04)."

from app.modules.operations.application.ports import UnitOfWork
from app.shared.application.common import created, logged
from app.shared.application.context import ActionContext
from app.shared.application.results import Result
from app.shared.application.schemas import (
    InternalDocumentIn,
    InternalDocumentPatch,
    InternalSearchIn,
)
from app.shared.application.values import JsonValue
from app.shared.domain.domain import is_safe_question, mask_sensitive, search_terms
from app.shared.domain.errors import bad_request, found


def internal_documents(festival_id: str, user: dict, connection: UnitOfWork):
    """검색과 같은 권한 기준(allowed_roles)으로 목록도 본인이 열람 가능한 문서만 돌려준다."""
    rows = connection.admin_documents.internal_documents_select_internal_documents(
        (festival_id, user["role"])
    )
    return Result(rows)


def create_internal_document(
    festival_id: str,
    body: InternalDocumentIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_documents.create_internal_document_insert_internal_documents(
        (
            festival_id,
            body.title,
            body.document_type,
            body.body,
            body.source_url,
            JsonValue(body.allowed_roles),
            user["id"],
        ),
    )
    created(connection, context, user, festival_id, "INTERNAL_DOCUMENT", row)
    return Result(row)


def update_internal_document(
    festival_id: str,
    document_id: str,
    body: InternalDocumentPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    """운영 문서 수정. 등록·조회·검색만 있어서 오타 하나도 고칠 수 없었다."""
    values = body.model_dump(exclude_none=True)
    if not values:
        raise bad_request("VALIDATION_ERROR", "변경할 값이 없습니다.")
    before = found(
        connection.admin_documents.update_internal_document_select_internal_documents(
            (document_id, festival_id)
        )
    )
    row = found(
        connection.admin_documents.update_internal_document_select_internal_documents_2(
            (document_id, festival_id), values=values
        )
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        "UPDATE",
        "INTERNAL_DOCUMENT",
        document_id,
        before_data=before,
        after_data=row,
    )
    return Result(row)


def archive_internal_document(
    festival_id: str,
    document_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
) -> Result:
    """보관 처리. 감사 대상 문서라 실제로 지우지 않고 status만 ARCHIVED로 바꾼다(검색 대상에서 빠진다)."""
    row = found(
        connection.admin_documents.archive_internal_document_update_internal_documents(
            (document_id, festival_id)
        )
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        "ARCHIVE",
        "INTERNAL_DOCUMENT",
        str(row["id"]),
    )
    return Result(status_code=204)


def search_internal_documents(
    festival_id: str,
    body: InternalSearchIn,
    user: dict,
    connection: UnitOfWork,
):
    if not is_safe_question(body.question):
        raise bad_request(
            "UNSAFE_QUERY", "민감정보 또는 시스템 정보 요청은 검색할 수 없습니다."
        )
    patterns = [f"%{term}%" for term in search_terms(body.question)]
    rows = (
        connection.admin_documents.search_internal_documents_select_internal_documents(
            {"festival_id": festival_id, "role": user["role"], "patterns": patterns},
        )
        if patterns
        else []
    )
    excerpts = [mask_sensitive(row["body"][:500]) for row in rows]
    return Result(
        {
            "answer": "\n\n".join(excerpts)
            if excerpts
            else "권한 범위의 운영 문서에서 근거를 찾지 못했습니다.",
            "sources": [
                {
                    "documentId": row["id"],
                    "title": row["title"],
                    "sourceUrl": row["source_url"],
                }
                for row in rows
            ],
        }
    )
