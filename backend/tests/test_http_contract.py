from fastapi.testclient import TestClient

from app.main import app, error_response
from app.shared.domain.errors import AppError
from starlette.requests import Request


def test_routing_errors_keep_envelope_status_and_allow():
    client = TestClient(app)  # No lifespan: routing checks need no database.
    missing = client.get('/api/v1/not-a-resource')
    assert missing.status_code == 404
    assert missing.json()['error']['code'] == 'RESOURCE_NOT_FOUND'
    assert missing.json()['meta']
    assert missing.headers['cache-control'] == 'no-store'
    wrong_method = client.post('/health/live')
    assert wrong_method.status_code == 405
    assert 'GET' in wrong_method.headers['allow']
    assert wrong_method.json()['error']['code'] == 'METHOD_NOT_ALLOWED'


def test_unauthorized_response_advertises_bearer_authentication():
    request = Request({'type': 'http', 'headers': [], 'state': {'request_id': 'test'}})
    response = error_response(request, AppError(401, 'UNAUTHENTICATED', 'Login required'))
    assert response.status_code == 401
    assert response.headers['www-authenticate'] == 'Bearer'
    assert response.headers['cache-control'] == 'no-store'
