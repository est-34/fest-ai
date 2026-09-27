import re

# facility_type은 자유 텍스트 컬럼이라 고정된 값 집합이 없다. 안전 관련 키워드가 이름에
# 있으면 이름순보다 먼저 노출한다 — 공개(public.py)·운영자(admin_core.py) 목록 둘 다 이 순서를 쓴다.
# f-string으로 그대로 SQL에 넣는 상수라 컬럼 참조(column)에 사용자 입력이 들어가면 안 된다.


# 방문객 셀프 취소 마감. 화면(방문객·운영자)이 "시작 30분 전까지"라고 고지해 왔는데 서버에는
# 검사가 없어서 시작 직전은 물론 시작 뒤에도 취소가 됐다. 고지한 규칙을 여기서 강제한다.


# 자격증명·개인식별정보·시스템 내부 정보 요청을 막는다. 공백과 구분자를 제거한 문자열에
# 대고 보므로 "p a s s w o r d", "시스템-프롬프트" 같은 단순 우회는 걸린다.
UNSAFE_TERMS = (
    "비밀번호",
    "패스워드",
    "password",
    "passwd",
    "credential",
    "자격증명",
    "apikey",
    "api키",
    "accesstoken",
    "액세스토큰",
    "refreshtoken",
    "리프레시토큰",
    "secretkey",
    "시크릿키",
    "privatekey",
    "개인키",
    "jwt",
    "환경변수",
    "envvar",
    "주민등록번호",
    "주민번호",
    "여권번호",
    "운전면허번호",
    "socialsecurity",
    "ssn",
    "카드번호",
    "계좌번호",
    "cardnumber",
    "creditcard",
    "시스템프롬프트",
    "systemprompt",
    "developermessage",
    "이전지시무시",
    "ignorepreviousinstructions",
    "ignoreallprevious",
    "disregardprevious",
)

# 개인정보로 취급하는 패턴. mask_sensitive와 위험 질문 판정이 같은 규칙을 쓴다.
SENSITIVE_PATTERNS = (
    (re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"), "[이메일 마스킹]"),
    # 주민등록번호: 생년월일 6자리 + 성별코드(1-4,5-8) + 6자리
    (re.compile(r"(?<!\d)\d{6}[-\s]?[1-8]\d{6}(?!\d)"), "[주민등록번호 마스킹]"),
    # 카드번호: 13~16자리(4자리 묶음 구분자 허용)
    (re.compile(r"(?<!\d)(?:\d[ -]?){12,15}\d(?!\d)"), "[카드번호 마스킹]"),
    # 휴대폰
    (re.compile(r"(?<!\d)01[016789][- ]?\d{3,4}[- ]?\d{4}(?!\d)"), "[연락처 마스킹]"),
    # 유선전화: 02 또는 03x~06x 지역번호
    (
        re.compile(r"(?<!\d)(?:02|0[3-6]\d)[- ]?\d{3,4}[- ]?\d{4}(?!\d)"),
        "[연락처 마스킹]",
    ),
)


def is_safe_question(message: str) -> bool:
    """차단 대상이면 False.

    예전 구현은 키워드 6개를 원문에 그대로 대조해서 대소문자·띄어쓰기만 바꿔도 통과했다.
    지금은 영문 소문자화 + 공백/구분자 제거 후 비교하고, 개인정보 패턴이 질문 본문에
    직접 들어 있는 경우도 막는다.
    """
    normalized = re.sub(r"[\s\-_.·]+", "", message.lower())
    if any(term in normalized for term in UNSAFE_TERMS):
        return False
    return not any(pattern.search(message) for pattern, _ in SENSITIVE_PATTERNS)


# 한국어 조사. 검색이 토큰 통째로 ILIKE라 "화장실이"가 본문의 "화장실은"과 안 맞았다.
# 긴 것부터 떼어낸다("에서는"을 "는"보다 먼저 봐야 한다).
JOSA = (
    "에서는",
    "에게는",
    "으로는",
    "이라는",
    "에서",
    "에게",
    "한테",
    "으로",
    "이나",
    "까지",
    "부터",
    "보다",
    "라도",
    "이라",
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "에",
    "와",
    "과",
    "도",
    "만",
    "의",
    "로",
)

# 방문객이 실제로 쓰는 구어체를 승인 콘텐츠의 표현으로 잇는다. 범용 형태소 분석기보다
# 축제 안내에서 자주 실패한 표현만 명시하는 편이 결과와 운영 범위를 예측하기 쉽다.
QUERY_ALIASES = {
    "밥": ("먹거리", "음식"),
    "먹어": ("먹거리", "음식"),
    "먹을": ("먹거리", "음식"),
    "차 가져": ("주차", "자가용"),
    "자동차": ("주차", "자가용"),
    "몇 시": ("운영 시간",),
    "몇시": ("운영 시간",),
    "언제 열": ("운영 시간",),
    "돈 내": ("입장료", "무료"),
    "무료야": ("입장료", "무료"),
    "행사": ("프로그램", "체험"),
    "애완": ("반려동물",),
    "멍멍이": ("반려동물", "강아지"),
    "비 오": ("우천", "비"),
    "비오": ("우천", "비"),
    "더워": ("폭염", "그늘막", "식수대"),
    "다쳤": ("응급", "의료"),
}


def without_josa(term: str) -> str:
    """조사를 뗀 어간. 뗄 게 없거나 남는 글자가 1자면 원본 그대로."""
    for josa in JOSA:
        if term.endswith(josa) and len(term) - len(josa) >= 2:
            return term[: -len(josa)]
    return term


def search_terms(text: str) -> list[str]:
    terms = [term for term in re.split(r"[^\w가-힣]+", text.lower()) if len(term) >= 2][
        :8
    ]
    # 어간을 원본과 함께 넘긴다(OR 검색이라 원본이 맞던 문서는 계속 맞는다).
    variants = [variant for term in terms for variant in (term, without_josa(term))]
    lowered = text.lower()
    variants.extend(
        alias
        for phrase, aliases in QUERY_ALIASES.items()
        if phrase in lowered
        for alias in aliases
    )
    return list(dict.fromkeys(variants))


def supported_language(
    requested: str | None, supported: list[str], default: str
) -> str:
    language = (requested or default).lower().split("-")[0]
    return language if language in supported else default


def classify_issue(text: str, priority: str = "NORMAL") -> dict:
    lowered = text.lower()
    topics = {
        "SAFETY": ("사고", "위험", "다침", "미끄", "화재", "응급"),
        "CROWD": ("혼잡", "대기", "줄", "붐비"),
        "FACILITY": ("화장실", "시설", "수유", "주차", "그늘"),
        "GUIDANCE": ("안내", "표지", "길", "위치"),
    }
    topic = next(
        (
            name
            for name, terms in topics.items()
            if any(term in lowered for term in terms)
        ),
        "OTHER",
    )
    negative = any(
        term in lowered for term in ("불편", "부족", "고장", "사고", "위험", "불만")
    )
    urgent = priority == "EMERGENCY" or topic == "SAFETY"
    return {
        "topic": topic,
        "sentiment": "NEGATIVE" if negative else "NEUTRAL",
        "urgent": urgent,
    }


def mask_sensitive(text: str) -> str:
    """운영 문서 발췌에서 개인정보를 가린다.

    순서가 중요하다 — 주민등록번호(13자리)를 카드번호 규칙보다 먼저 잡아야
    "[카드번호 마스킹]"으로 잘못 표시되지 않는다. SENSITIVE_PATTERNS가 그 순서다.
    """
    for pattern, replacement in SENSITIVE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


# BUSY/FULL 비율은 "지금 얼마나 찼는가"만 본다. 짧은 시간에 급격히 찬 것(비정상 급증)은
# 놓친다 — 절대 비율이 임계값 밑이어도 짧은 시간에 여러 단계 뛰면 그 자체로 위험 신호다.


# 신호 종류별 (임계값 초과 점수, 이하 점수). schedule_change는 발생 자체가 신호라 같은 값을 준다.
