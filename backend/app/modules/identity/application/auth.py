from datetime import UTC, datetime, timedelta

from app.modules.identity.application.ports import UnitOfWork
from app.shared.application.common import logged
from app.shared.application.context import ActionContext
from app.shared.application.results import Result
from app.shared.application.schemas import (
    LoginIn,
    MerchantInviteAcceptIn,
    MerchantInviteLookupIn,
    PasswordChangeIn,
    TokenIn,
)
from app.shared.application.values import JsonValue
from app.shared.domain.errors import AppError, bad_request, conflict, unauthorized


def issue_refresh_token(connection: UnitOfWork, user_id) -> str:
    token = connection.tokens.random_token("rt")
    connection.auth.issue_refresh_token_insert_refresh_tokens(
        (
            user_id,
            connection.tokens.hash_token(token),
            datetime.now(UTC) + timedelta(days=connection.policy.refresh_token_days),
        ),
    )
    return token


def lock_state(connection: UnitOfWork, email: str) -> dict | None:
    return connection.auth.lock_state_select_login_attempts((email,))


def record_failure(connection: UnitOfWork, email: str) -> None:
    """실패를 세고 한도를 넘으면 잠근다. IP 레이트 리밋만으로는 분산된 자격증명 대입을 못 막는다.

    잠금 창이 지난 행은 먼저 0으로 되돌린다. 안 그러면 failures가 한도 위에 그대로 머물러
    이후 실패 한 번마다 잠금이 새로 걸리는데, 잠긴 동안은 비밀번호 검증 전에 429로 끊기므로
    정상 사용자가 잠금을 풀 방법이 없다 — 공격자가 잠금 시간마다 한 번씩만 틀려도 계정이
    영구히 잠긴다. (같은 UPDATE 안에서는 새 failures 값을 locked_until이 참조할 수 없어
    CASE를 두 번 쓰는 대신 문장을 나눈다.)
    """
    connection.auth.record_failure_update_login_attempts((email,))
    connection.auth.record_failure_update_login_attempts_2(
        {
            "email": email,
            "max_failures": connection.policy.login_max_failures,
            "lock_minutes": connection.policy.login_lock_minutes,
        },
    )
    connection.commit()


def login(body: LoginIn, context: ActionContext, connection: UnitOfWork):
    email = str(body.email).lower()
    locked = lock_state(connection, email)
    if (
        locked
        and locked["locked_until"]
        and (locked["locked_until"] > datetime.now(UTC))
    ):
        raise AppError(
            429,
            "ACCOUNT_LOCKED",
            "로그인 시도가 많아 잠시 잠겼습니다. 잠시 후 다시 시도해 주세요.",
            retryable=True,
        )
    row = connection.auth.login_select_users((email,))
    if (
        not connection.tokens.verify_password(
            body.password,
            row["password_hash"] if row else connection.tokens.DUMMY_PASSWORD_HASH,
        )
        or not row
    ):
        record_failure(connection, email)
        raise unauthorized(message="이메일 또는 비밀번호가 올바르지 않습니다.")
    connection.auth.login_execute_login_attempts((email,))
    refresh = issue_refresh_token(connection, row["id"])
    connection.audit.audit(
        festival_id=None,
        actor_id=str(row["id"]),
        action="LOGIN",
        resource_type="USER",
        resource_id=str(row["id"]),
        request_id=context.request_id,
    )
    return Result(
        {
            "accessToken": connection.tokens.access_token(
                str(row["id"]), str(row["membership_id"])
            ),
            "refreshToken": refresh,
            "tokenType": "Bearer",
            "user": {
                "id": row["id"],
                "email": row["email"],
                "name": row["name"],
                "role": row["role"],
            },
        }
    )


def refresh(body: TokenIn, context: ActionContext, connection: UnitOfWork):
    token_hash = connection.tokens.hash_token(body.refresh_token)
    row = connection.auth.refresh_select_refresh_tokens((token_hash,))
    if not row:
        reused = connection.auth.refresh_select_refresh_tokens_2((token_hash,))
        if reused:
            connection.auth.revoke_refresh_tokens((reused["user_id"],))
            connection.audit.audit(
                festival_id=None,
                actor_id=str(reused["user_id"]),
                action="REFRESH_TOKEN_REUSE",
                resource_type="USER",
                resource_id=str(reused["user_id"]),
                request_id=context.request_id,
            )
            connection.commit()
        raise unauthorized(
            "TOKEN_EXPIRED", "리프레시 토큰이 만료되었거나 폐기되었습니다."
        )
    connection.auth.refresh_update_refresh_tokens_2((row["refresh_id"],))
    return Result(
        {
            "accessToken": connection.tokens.access_token(
                str(row["id"]), str(row["membership_id"])
            ),
            "refreshToken": issue_refresh_token(connection, row["id"]),
            "tokenType": "Bearer",
        }
    )


def logout(body: TokenIn, connection: UnitOfWork) -> Result:
    connection.auth.logout_update_refresh_tokens(
        (connection.tokens.hash_token(body.refresh_token),)
    )
    return Result(status_code=204)


def valid_invitation(connection: UnitOfWork, token: str, *, lock: bool = False) -> dict:
    """유효한 초대만 통과시킨다. 만료·회수·이미 수락된 링크는 모두 같은 오류로 막는다."""
    row = connection.auth.valid_invitation_select_OF(
        (connection.tokens.hash_token(token),), lock=lock
    )
    if not row or row["status"] != "PENDING" or row["expires_at"] <= datetime.now(UTC):
        raise AppError(
            410,
            "INVITATION_INVALID",
            "초대 링크가 만료되었거나 사용할 수 없습니다. 운영자에게 재발급을 요청해 주세요.",
        )
    return row


def lookup_invitation(body: MerchantInviteLookupIn, connection: UnitOfWork):
    """수락 화면이 어떤 업체·이메일의 초대인지 보여주기 위한 조회.

    토큰은 본문으로 받는다 — 쿼리스트링에 실으면 접속 로그·리퍼러에 그대로 남는다.
    """
    row = valid_invitation(connection, body.token)
    return Result(
        {
            "email": row["email"],
            "businessName": row["business_name"],
            "festivalName": row["festival_name"],
            "expiresAt": row["expires_at"],
            "hasAccount": bool(
                connection.auth.lookup_invitation_select_users((row["email"],))
            ),
        }
    )


def accept_invitation(
    body: MerchantInviteAcceptIn, context: ActionContext, connection: UnitOfWork
):
    """초대 수락 = 상인 계정 발급과 업체 연결.

    이미 다른 업체로 계정을 받은 상인은 같은 소속을 재사용하고 축제 범위와 업체 연결만
    늘린다(비밀번호를 다시 받지 않는다). 새 계정일 때만 비밀번호가 필요하다.
    """
    invitation = valid_invitation(connection, body.token, lock=True)
    account = connection.auth.accept_invitation_select_users((invitation["email"],))
    membership = (
        connection.auth.accept_invitation_select_memberships(
            (account["id"], invitation["organization_id"])
        )
        if account
        else None
    )
    if account and (not membership):
        raise conflict(
            "EMAIL_ALREADY_REGISTERED",
            "이미 다른 용도로 등록된 이메일입니다. 운영자에게 다른 이메일로 재발급을 요청해 주세요.",
        )
    if not account:
        if not body.password:
            raise bad_request("PASSWORD_REQUIRED", "새 계정에는 비밀번호가 필요합니다.")
        account = connection.auth.accept_invitation_insert_users_2(
            (
                invitation["email"],
                connection.tokens.hash_password(body.password),
                body.name or invitation["email"].split("@")[0],
            ),
        )
        membership = connection.auth.accept_invitation_insert_memberships_2(
            (
                invitation["organization_id"],
                account["id"],
                JsonValue([str(invitation["festival_id"])]),
            ),
        )
    else:
        scope = sorted(
            {*(membership["festival_scope"] or []), str(invitation["festival_id"])}
        )
        connection.auth.accept_invitation_update_memberships(
            (JsonValue(scope), membership["id"])
        )
    connection.auth.accept_invitation_update_festival_businesses(
        (membership["id"], invitation["festival_business_id"])
    )
    connection.auth.accept_invitation_update_merchant_invitations(
        (membership["id"], invitation["id"])
    )
    connection.audit.audit(
        festival_id=str(invitation["festival_id"]),
        actor_id=str(account["id"]),
        action="ACCEPT_INVITATION",
        resource_type="MERCHANT_ACCOUNT",
        resource_id=str(membership["id"]),
        after_data={
            "businessId": str(invitation["festival_business_id"]),
            "email": invitation["email"],
        },
        request_id=context.request_id,
    )
    return Result(
        {
            "accessToken": connection.tokens.access_token(
                str(account["id"]), str(membership["id"])
            ),
            "refreshToken": issue_refresh_token(connection, account["id"]),
            "tokenType": "Bearer",
            "user": {
                "id": account["id"],
                "email": account["email"],
                "name": account["name"],
                "role": "MERCHANT",
            },
            "businessName": invitation["business_name"],
        }
    )


def me(user: dict):
    return Result(
        {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "organizationId": user["organization_id"],
            "role": user["role"],
            "festivalScope": user["festival_scope"],
        }
    )


def change_password(
    body: PasswordChangeIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    """본인 비밀번호 변경.

    운영자 화면은 초기 비밀번호를 발급하고 "로그인한 뒤 변경하라"고 안내해 왔지만
    정작 변경할 방법이 없었다. 변경하면 이 계정의 리프레시 토큰을 전부 폐기해서
    유출된 예전 비밀번호로 이미 열린 세션이 계속 살아 있지 않게 한다.
    """
    row = connection.auth.change_password_select_users((user["id"],))
    if not row or not connection.tokens.verify_password(
        body.current_password, row["password_hash"]
    ):
        raise unauthorized("INVALID_CREDENTIALS", "현재 비밀번호가 올바르지 않습니다.")
    connection.auth.change_password_update_users(
        (connection.tokens.hash_password(body.new_password), user["id"])
    )
    connection.auth.revoke_refresh_tokens((user["id"],))
    logged(connection, context, user, None, "PASSWORD_CHANGE", "USER", str(user["id"]))
    return Result(
        {
            "accessToken": connection.tokens.access_token(
                str(user["id"]), str(user["membership_id"])
            ),
            "refreshToken": issue_refresh_token(connection, user["id"]),
            "tokenType": "Bearer",
        }
    )
