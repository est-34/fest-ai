import base64
import uuid
from datetime import datetime

from app.shared.domain.errors import bad_request


def encode_cursor(row: dict, column: str = "created_at") -> str:
    """`<정렬 시각 ISO>|<id>`를 base64url로 감싼다.

    ISO 타임스탬프의 `+00:00`을 그대로 내려주면 쿼리스트링에서 `+`가 공백으로 디코드돼
    다음 페이지 요청이 400으로 떨어진다. 커서는 클라이언트에게 불투명한 값이므로
    인코딩 규칙을 클라이언트가 알 필요가 없게 만든다.
    """
    return (
        base64.urlsafe_b64encode(f"{row[column].isoformat()}|{row['id']}".encode())
        .decode()
        .rstrip("=")
    )


def decode_cursor(cursor: str | None) -> tuple[str, str] | None:
    """encode_cursor의 역함수. 형식이 깨지면 조용히 첫 페이지로 돌아가지 않고 400."""
    if not cursor:
        return None
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        sort_value, _, resource_id = raw.partition("|")
        return datetime.fromisoformat(sort_value).isoformat(), str(
            uuid.UUID(resource_id)
        )
    except (ValueError, UnicodeDecodeError) as error:
        raise bad_request("INVALID_CURSOR", "커서 값을 확인해 주세요.") from error


def cursor_params(cursor: str | None, limit: int) -> dict:
    """keyset()이 참조하는 파라미터. limit는 한 건 더 읽어 paged()가 다음 페이지를 판단하게 한다."""
    after = decode_cursor(cursor)
    return {
        "after_at": after[0] if after else None,
        "after_id": after[1] if after else None,
        "limit": limit + 1,
    }


def paged(
    rows: list[dict], limit: int, column: str = "created_at"
) -> tuple[list[dict], dict]:
    """`limit+1`건을 읽어 온 목록을 (행, page) 로 자른다.

    목록 API가 전량 반환이라 축제가 커질수록 응답이 무한정 늘어났다. 감사 로그에만 있던
    키셋 페이지네이션을 같은 규칙으로 다른 목록에도 쓰기 위해 한 곳에 둔다.
    """
    has_next = len(rows) > limit
    rows = rows[:limit]
    return rows, {
        "nextCursor": encode_cursor(rows[-1], column) if has_next and rows else None,
        "hasNext": has_next,
        "limit": limit,
    }
