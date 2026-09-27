def safety_facility_order(column: str = "facility_type") -> str:
    keywords = (
        "MEDICAL",
        "SAFETY",
        "FIRST_AID",
        "FIRSTAID",
        "AED",
        "EMERGENCY",
        "SECURITY",
    )
    # 두 호출부 모두 이 문자열을 파라미터 바인딩이 있는 쿼리에 f-string으로 끼워 넣는다.
    # psycopg는 실행 전에 SQL 전체에서 %-플레이스홀더를 찾는데, ILIKE 패턴의 리터럴 %가
    # %M/%S/%F 같은 잘못된 플레이스홀더로 오인돼 "only '%s','%b','%t' are allowed..."로
    # 죽는다(실제 재현됨: /public/.../facilities 500). %%로 이스케이프해 리터럴 %로 남긴다.
    array = ",".join(f"'%%{keyword}%%'" for keyword in keywords)
    return f"CASE WHEN {column} ILIKE ANY(ARRAY[{array}]) THEN 0 ELSE 1 END"


def keyset(column: str = "created_at", alias: str = "") -> str:
    """`(정렬 컬럼, id)` 키셋 조건. cursor_params가 채우는 이름 파라미터를 참조한다.

    f-string으로 SQL에 그대로 들어가므로 컬럼·별칭은 상수여야 한다(사용자 입력 금지).
    """
    prefix = f"{alias}." if alias else ""
    return (
        f"(%(after_at)s::timestamptz IS NULL OR ({prefix}{column},{prefix}id) < "
        f"(%(after_at)s::timestamptz,%(after_id)s::uuid))"
    )
