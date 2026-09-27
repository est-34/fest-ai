"""조회 조립과 CSV 변환의 기능 보존 검사. DB를 사용하지 않는다."""

import base64
import csv
from datetime import UTC, datetime
from io import StringIO

import pytest
from app.infrastructure.esg_export import build_table_artifact
from app.modules.engagement.adapters.postgres import visitor
from app.modules.festival.adapters.postgres import public
from app.modules.operations.application.admin_documents import update_internal_document
from app.shared.application.schemas import InternalDocumentPatch
from app.shared.domain.errors import AppError
from psycopg.types.json import Jsonb


class Capture:
    def execute(self, sql, params=()):
        self.sql, self.params = sql, params
        return self

    def fetchall(self):
        return []


def test_public_program_filters_keep_publication_and_timezone_constraints():
    connection = Capture()
    public.PublicRepository(connection).programs_select_programs(
        "festival",
        "en",
        "ko",
        201,
        category="performance",
        area_id="area",
        status="OPEN",
        selected_date="2026-10-21",
    )
    assert connection.params == [
        "festival",
        "en",
        "ko",
        "performance",
        "area",
        "OPEN",
        "2026-10-21",
        201,
    ]
    for clause in (
        "p.status='PUBLISHED'",
        "ci.lifecycle_status='PUBLISHED'",
        "cv.language IN (%s,%s)",
        "AT TIME ZONE f.timezone",
    ):
        assert clause in connection.sql


def test_course_filters_bind_preferences_and_keep_closed_programs_out():
    connection = Capture()
    now = datetime(2026, 10, 21, tzinfo=UTC)
    visitor.VisitorRepository(connection).create_course_plan_select_program_sessions(
        "festival",
        now,
        ["excluded"],
        interests=["experience"],
        area_id="area",
        accessibility={"wheelchair": True},
    )
    assert connection.params[:5] == [
        "festival",
        now,
        ["excluded"],
        ["experience"],
        "area",
    ]
    assert isinstance(connection.params[-1], Jsonb)
    assert connection.params[-1].obj == {"wheelchair": True}
    for clause in (
        "ps.status='OPEN'",
        "p.status='PUBLISHED'",
        "NOT (p.id=ANY(%s::uuid[]))",
        "p.accessibility @> %s",
    ):
        assert clause in connection.sql


def test_empty_document_patch_fails_before_resource_lookup():
    class NoDatabase:
        def execute(self, *_):
            pytest.fail("empty patch must fail before querying the document")

    with pytest.raises(AppError) as error:
        update_internal_document(
            "festival", "missing", InternalDocumentPatch(), None, {}, NoDatabase()
        )
    assert error.value.code == "VALIDATION_ERROR"


def test_csv_keeps_bom_column_order_nulls_and_quoting():
    artifact = build_table_artifact(
        [{"b": True, "a": None, "extra": 1}, {"a": "가,나\n다", "b": 0}, {"a": "누락"}],
        ("a", "b"),
        "CSV",
        "records",
    )
    content = base64.b64decode(artifact["contentBase64"])
    assert content.startswith(b"\xef\xbb\xbf")
    assert list(csv.reader(StringIO(content.decode("utf-8-sig")))) == [
        ["a", "b"],
        ["", "True"],
        ["가,나\n다", "0"],
        ["누락", ""],
    ]
