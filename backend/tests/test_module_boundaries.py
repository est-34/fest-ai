"""Executable dependency rules and DB-free use cases for the modular monolith."""

import ast
import importlib
import inspect
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from app.modules.engagement.application.bookings import create_booking
from app.shared.application.schemas import BookingIn
from app.shared.domain.errors import AppError, DuplicateKey

ROOT = Path(__file__).resolve().parents[1] / "app"
MODULES = {
    "identity",
    "festival",
    "engagement",
    "commerce",
    "operations",
    "esg",
    "privacy",
}
DEPENDENCIES = {
    "identity": set(),
    "festival": {"privacy"},
    "engagement": {"festival", "privacy"},
    "commerce": {"festival", "engagement"},
    "operations": {"festival", "privacy"},
    "esg": {"privacy"},
    "privacy": set(),
}


def public_exports(module):
    path = ROOT / "modules" / module / "api.py"
    if not path.exists():
        return set()
    for node in ast.parse(path.read_text()).body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "__all__"
            for target in node.targets
        ):
            return set(ast.literal_eval(node.value))
    raise AssertionError(f"{path} must declare __all__")


def is_public_reference(target, module):
    api = f"app.modules.{module}.api"
    return target == api or target in {
        f"{api}.{name}" for name in public_exports(module)
    }


def imports(path, tree):
    package = ".".join(path.relative_to(ROOT.parent).with_suffix("").parts[:-1])
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            name = node.module or ""
            if node.level:
                name = importlib.util.resolve_name("." * node.level + name, package)
            yield name
            yield from (f"{name}.{alias.name}" for alias in node.names)


def test_dependency_direction_and_module_public_apis():
    paths = list(ROOT.rglob("*.py"))
    assert {
        p.name
        for p in (ROOT / "modules").iterdir()
        if p.is_dir() and p.name != "__pycache__"
    } == MODULES
    applications = [
        p for p in paths if "application" in p.parts and p.name != "__init__.py"
    ]
    assert (
        len(applications) >= 20
    )  # A moved/deleted directory must not silently empty the check.
    for path in paths:
        parts = path.relative_to(ROOT).parts
        tree = ast.parse(path.read_text())
        inner = "application" in parts or "domain" in parts or path.name == "domain.py"
        domain = "domain" in parts or path.name == "domain.py"
        module = parts[1] if parts[0] == "modules" else None
        for target in imports(path, tree):
            if inner:
                assert not target.startswith(
                    (
                        "fastapi",
                        "starlette",
                        "psycopg",
                        "httpx",
                        "jwt",
                        "app.infrastructure",
                        "app.bootstrap",
                    )
                ), (path, target)
                assert ".adapters" not in target, (path, target)
            if domain:
                assert ".application" not in target, (path, target)
            if parts[0] == "shared":
                assert not target.startswith("app.modules"), (path, target)
            if module and target.startswith("app.modules."):
                dest = target.split(".")[2]
                if dest != module:
                    assert dest in DEPENDENCIES[module], (path, target)
                    assert is_public_reference(target, dest), (path, target)
            if "http" in parts:
                assert ".adapters.postgres" not in target, (path, target)
        if inner:
            assert not any(
                isinstance(n, ast.Attribute) and n.attr == "execute"
                for n in ast.walk(tree)
            ), path


def test_application_imports_do_not_load_infrastructure():
    source = """
import importlib
import sys
from pathlib import Path
root = Path('app')
for path in sorted(root.rglob('*.py')):
    if ('application' in path.parts or 'domain' in path.parts
            or path.name in ('domain.py', 'api.py')):
        parts = path.with_suffix('').parts
        if parts[-1] == '__init__':
            parts = parts[:-1]
        importlib.import_module('.'.join(parts))
for name in sys.modules:
    assert not name.startswith(('psycopg', 'fastapi', 'starlette', 'httpx', 'jwt',
                                'app.infrastructure', 'app.bootstrap')), name
    assert '.adapters' not in name, name
"""
    subprocess.run(
        [sys.executable, "-c", source], cwd=ROOT.parent, check=True, timeout=15
    )


@pytest.mark.parametrize(
    ("target", "allowed"),
    [
        ("app.modules.festival.api", True),
        ("app.modules.festival.api.published_festival", True),
        ("app.modules.festival.api.UnitOfWork", True),
        ("app.modules.festival.api.private_helper", False),
        ("app.modules.festival.api_internal", False),
        ("app.modules.festival.api.published_festival.internal", False),
        ("app.modules.festival.application.public", False),
        ("app.modules.festival.adapters.postgres.public", False),
    ],
)
def test_public_api_boundary_requires_explicit_exports(target, allowed):
    assert is_public_reference(target, "festival") is allowed


def test_all_repository_ports_match_composed_adapters():
    from app.bootstrap import UnitOfWork

    work = UnitOfWork(object())
    for group in sorted(MODULES | {"shared"}):
        prefix = "app.shared" if group == "shared" else f"app.modules.{group}"
        ports = importlib.import_module(prefix + ".application.ports")
        for attribute, annotation in ports.UnitOfWork.__annotations__.items():
            contract = getattr(ports, annotation, None)
            if contract is None or not getattr(contract, "_is_protocol", False):
                continue
            adapter = getattr(work, attribute)
            for name, method in vars(contract).items():
                if not inspect.isfunction(method) or name.startswith("__"):
                    continue
                expected = list(inspect.signature(method).parameters.values())[1:]
                actual = list(
                    inspect.signature(getattr(adapter, name)).parameters.values()
                )
                assert [(p.name, p.kind, p.default) for p in actual] == [
                    (p.name, p.kind, p.default) for p in expected
                ], (attribute, name)
            if annotation.endswith("Repository"):
                assert adapter.connection.connection is work.session


def booking_work(*, capacity=2, reserved=0, duplicate=False):
    repository = Mock()
    repository.work_select_program_sessions.return_value = {
        "capacity": capacity,
        "title": "공연",
        "starts_at": "2026-10-23T10:00:00Z",
    }
    repository.reserved_seats_select_bookings.return_value = {"count": reserved}
    repository.work_select_bookings.return_value = {"next": 7}
    if duplicate:
        repository.work_insert_bookings_2.side_effect = DuplicateKey()
    else:
        repository.work_insert_bookings_2.side_effect = lambda values: {
            "id": "booking",
            **values,
        }
    idempotency = Mock()
    idempotency.previous.return_value = None
    return SimpleNamespace(bookings=repository, idempotency=idempotency)


@pytest.mark.parametrize(
    ("reserved", "status", "queue"), [(0, "CONFIRMED", None), (2, "WAITING", 7)]
)
def test_booking_policy_runs_against_fake_ports(reserved, status, queue):
    work = booking_work(reserved=reserved)
    create_booking(
        "session",
        BookingIn(partySize=1),
        {"id": "visitor", "festival_id": "festival"},
        work,
        "key",
    )
    values = work.bookings.work_insert_bookings_2.call_args.args[0]
    assert values["status"] == status and values["queue_number"] == queue
    work.idempotency.lock.assert_called_once_with("booking:visitor:session", "key")
    work.idempotency.save.assert_called_once()


def test_duplicate_booking_uses_port_error_without_driver_dependency():
    work = booking_work(duplicate=True)
    with pytest.raises(AppError) as error:
        create_booking(
            "session",
            BookingIn(partySize=1),
            {"id": "visitor", "festival_id": "festival"},
            work,
            "key",
        )
    assert error.value.code == "DUPLICATE_ACTION"
    work.idempotency.save.assert_not_called()


def test_postgres_boundary_serializes_json_and_translates_duplicate_keys():
    from app.infrastructure.transaction import Transaction
    from app.shared.application.values import JsonValue
    from psycopg.errors import UniqueViolation
    from psycopg.types.json import Jsonb

    connection = Mock()
    tx = Transaction(connection)
    tx.execute("statement", {"json": JsonValue({"text": "안내"}), "array": [1, 2]})
    params = connection.execute.call_args.args[1]
    assert isinstance(params["json"], Jsonb)
    assert params["json"].obj == {"text": "안내"}
    assert params["array"] == [1, 2]
    connection.execute.side_effect = UniqueViolation()
    with pytest.raises(DuplicateKey):
        tx.execute("statement")
