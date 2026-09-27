import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg.errors import DataError, ForeignKeyViolation, UniqueViolation
from starlette.concurrency import run_in_threadpool

from app.infrastructure.config import settings
from app.infrastructure.coordination import alan_pool, limited
from app.infrastructure.db import one, pool
from app.infrastructure.jobs import start_worker
from app.modules.commerce.adapters.http import businesses, merchant
from app.modules.engagement.adapters.http import activities, bookings, rewards, visitor
from app.modules.esg.adapters.http import admin_esg
from app.modules.festival.adapters.http import admin_content, admin_core, public
from app.modules.identity.adapters.http import auth
from app.modules.operations.adapters.http import admin_documents, admin_ops, insights
from app.shared.adapters.http.http import client_ip
from app.shared.adapters.http.views import meta
from app.shared.domain.errors import AppError, DuplicateKey


@asynccontextmanager
async def lifespan(_: FastAPI):
    pool.open(wait=True)
    inline_worker = start_worker() if settings.run_inline_worker else None
    yield
    if inline_worker:
        stopped, worker = inline_worker
        stopped.set()
        worker.join()
    alan_pool.close()
    pool.close()


app = FastAPI(
    title="지역축제 DX API",
    version="1.1.0",
    description="AI·ESG 기반 지역축제 DX 플랫폼 1·2단계 백엔드",
    lifespan=lifespan,
)


def rate_limit(path: str, method: str) -> int | None:
    if "/visitor/ai/" in path:
        return 20
    if path.endswith("/visitor/complaints"):
        return 10
    if path.endswith("/auth/login"):
        return 10
    if "/admin/" in path and method != "GET":
        return 60
    if "/public/" in path:
        return 120
    return None


def error_response(request: Request, error: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        content={
            "error": {
                "code": error.code,
                "message": error.message,
                "details": error.details,
                "retryable": error.retryable,
            },
            "meta": meta(request),
        },
    )


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = (
        request.headers.get("X-Request-Id") or f"req_{uuid.uuid4()}"
    )
    limit = rate_limit(request.url.path, request.method)
    if limit:
        route_key = "/".join(request.url.path.split("/")[:6])
        if await run_in_threadpool(limited, client_ip(request), route_key, limit):
            return error_response(
                request,
                AppError(
                    429, "RATE_LIMITED", "호출 한도를 초과했습니다.", retryable=True
                ),
            )
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    return response


@app.exception_handler(AppError)
async def app_error(request: Request, error: AppError):
    return error_response(request, error)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    details = [
        {
            "field": ".".join(str(part) for part in issue["loc"] if part != "body"),
            "reason": issue["msg"],
        }
        for issue in error.errors()
    ]
    return error_response(
        request, AppError(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요.", details)
    )


@app.exception_handler(DuplicateKey)
@app.exception_handler(UniqueViolation)
async def duplicate_error(request: Request, _: UniqueViolation):
    return error_response(
        request, AppError(409, "DUPLICATE_ACTION", "이미 존재하는 값입니다.")
    )


@app.exception_handler(ForeignKeyViolation)
async def reference_error(request: Request, _: ForeignKeyViolation):
    return error_response(
        request, AppError(422, "REFERENCE_CONSTRAINT", "연결된 리소스를 확인해 주세요.")
    )


@app.exception_handler(DataError)
async def data_error(request: Request, _: DataError):
    """빈 문자열 UUID처럼 형식이 어긋난 입력은 서버 오류가 아니라 잘못된 요청이다."""
    return error_response(
        request, AppError(400, "VALIDATION_ERROR", "요청 값의 형식을 확인해 주세요.")
    )


@app.get("/health/live", tags=["health"])
def live(request: Request):
    return {"data": {"status": "UP"}, "meta": meta(request)}


@app.get("/health/ready", tags=["health"])
def ready(request: Request):
    with pool.connection() as connection:
        one(connection, "SELECT 1")
    return {"data": {"status": "UP"}, "meta": meta(request)}


for route in (
    activities,
    auth,
    public,
    visitor,
    bookings,
    businesses,
    rewards,
    admin_core,
    admin_content,
    admin_ops,
    admin_documents,
    admin_esg,
    merchant,
    insights,
):
    app.include_router(route.router, prefix="/api/v1")
