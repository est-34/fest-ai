from fastapi import APIRouter, Request, Response

from app.modules.identity.application import auth as service
from app.shared.adapters.http.deps import Db, User
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import (
    LoginIn,
    MerchantInviteAcceptIn,
    MerchantInviteLookupIn,
    PasswordChangeIn,
    TokenIn,
)

router = APIRouter(tags=["auth"])


@router.post("/auth/login")
def login(body: LoginIn, request: Request, connection: Db, response: Response):
    return render(
        service.login(
            body=body, context=action_context(request), connection=connection
        ),
        request,
        response,
    )


@router.post("/auth/refresh")
def refresh(body: TokenIn, request: Request, connection: Db, response: Response):
    return render(
        service.refresh(
            body=body, context=action_context(request), connection=connection
        ),
        request,
        response,
    )


@router.post("/auth/logout", status_code=204)
def logout(
    body: TokenIn, connection: Db, request: Request, response: Response
) -> Response:
    return render(service.logout(body=body, connection=connection), request, response)


@router.post("/auth/merchant-invitations/lookup")
def lookup_invitation(
    body: MerchantInviteLookupIn, request: Request, connection: Db, response: Response
):
    return render(
        service.lookup_invitation(body=body, connection=connection),
        request,
        response,
    )


@router.post("/auth/merchant-invitations/accept")
def accept_invitation(
    body: MerchantInviteAcceptIn, request: Request, connection: Db, response: Response
):
    return render(
        service.accept_invitation(
            body=body, context=action_context(request), connection=connection
        ),
        request,
        response,
    )


@router.get("/me")
def me(request: Request, user: User, response: Response):
    return render(service.me(user=user), request, response)


@router.post("/me/password")
def change_password(
    body: PasswordChangeIn,
    request: Request,
    user: User,
    connection: Db,
    response: Response,
):
    return render(
        service.change_password(
            body=body, context=action_context(request), user=user, connection=connection
        ),
        request,
        response,
    )
