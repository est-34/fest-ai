from typing import Annotated

import jwt
from fastapi import Depends, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.infrastructure import security_queries as model
from app.infrastructure.config import settings
from app.infrastructure.db import DatabaseSession, database
from app.infrastructure.tokens import hash_token
from app.shared.domain.errors import forbidden, unauthorized

bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    connection: Annotated[DatabaseSession, Depends(database)],
) -> dict:
    if not credentials:
        raise unauthorized()
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer="festival-dx",
        )
    except jwt.ExpiredSignatureError as error:
        raise unauthorized("TOKEN_EXPIRED", "운영자 토큰이 만료되었습니다.") from error
    except jwt.PyJWTError as error:
        raise unauthorized(message="유효하지 않은 운영자 토큰입니다.") from error
    if payload.get("type") != "access":
        raise unauthorized()
    user = model.current_user_users(
        connection.session, (payload.get("sub"), payload.get("membershipId"))
    )
    if not user:
        raise unauthorized()
    return user


def roles(*allowed: str):

    def check(user: Annotated[dict, Depends(current_user)]) -> dict:
        if user["role"] not in allowed:
            raise forbidden()
        return user

    return check


def festival_access(
    festival_id: Annotated[str, Path()],
    user: Annotated[dict, Depends(current_user)],
    connection: Annotated[DatabaseSession, Depends(database)],
) -> dict:
    festival = model.festival_access_festivals(connection.session, (festival_id,))
    scope = user.get("festival_scope") or []
    if (
        not festival
        or str(festival["organization_id"]) != str(user["organization_id"])
        or (not (user["role"] == "SUPER_ADMIN" or "*" in scope or festival_id in scope))
    ):
        raise forbidden("FESTIVAL_SCOPE_DENIED", "축제 접근 범위가 아닙니다.")
    return festival


def current_visitor(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    connection: Annotated[DatabaseSession, Depends(database)],
) -> dict:
    if not credentials or not credentials.credentials.startswith("vs_"):
        raise unauthorized()
    visitor = model.current_visitor_visitor_sessions(
        connection.session, (hash_token(credentials.credentials),)
    )
    if not visitor:
        raise unauthorized(
            "TOKEN_EXPIRED", "방문 세션이 만료되었거나 유효하지 않습니다."
        )
    return visitor
