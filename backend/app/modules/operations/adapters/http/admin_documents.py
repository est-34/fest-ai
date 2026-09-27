from fastapi import APIRouter, Request, Response

from app.modules.operations.application import admin_documents as service
from app.shared.adapters.http.deps import Db, Manager, Scope, User
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import (
    InternalDocumentIn,
    InternalDocumentPatch,
    InternalSearchIn,
)

router = APIRouter(tags=["admin-documents"])


@router.get("/admin/festivals/{festival_id}/internal-documents")
def internal_documents(
    festival_id: str,
    request: Request,
    _: Scope,
    user: User,
    connection: Db,
    response: Response,
):
    return render(
        service.internal_documents(
            festival_id=festival_id,
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/internal-documents", status_code=201)
def create_internal_document(
    festival_id: str,
    body: InternalDocumentIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_internal_document(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/internal-documents/{document_id}")
def update_internal_document(
    festival_id: str,
    document_id: str,
    body: InternalDocumentPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.update_internal_document(
            festival_id=festival_id,
            document_id=document_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.delete(
    "/admin/festivals/{festival_id}/internal-documents/{document_id}", status_code=204
)
def archive_internal_document(
    festival_id: str,
    document_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
) -> Response:
    return render(
        service.archive_internal_document(
            festival_id=festival_id,
            document_id=document_id,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/ai/operations/search")
def search_internal_documents(
    festival_id: str,
    body: InternalSearchIn,
    request: Request,
    _: Scope,
    user: User,
    connection: Db,
    response: Response,
):
    return render(
        service.search_internal_documents(
            festival_id=festival_id,
            body=body,
            user=user,
            connection=connection,
        ),
        request,
        response,
    )
