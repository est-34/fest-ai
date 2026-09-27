from fastapi import APIRouter, Request, Response

from app.modules.engagement.application import visitor as service
from app.shared.adapters.http.deps import Db, Visitor
from app.shared.adapters.http.views import render
from app.shared.application.schemas import (
    ComplaintIn,
    ConsentPatch,
    ConversationIn,
    CoursePlanIn,
    KioskAssistEventIn,
    MessageIn,
    PrivacyRequestIn,
    ReportMessageIn,
    SurveyResponseIn,
    VisitorAreaIn,
    VisitorPreferencesPatch,
)

router = APIRouter(tags=["visitor"])


@router.delete("/visitor-sessions/current", status_code=204)
def end_session(
    visitor: Visitor, connection: Db, request: Request, response: Response
) -> Response:
    return render(
        service.end_session(visitor=visitor, connection=connection), request, response
    )


@router.get("/visitor-sessions/current/area")
def current_area(
    request: Request, visitor: Visitor, connection: Db, response: Response
):
    return render(
        service.current_area(visitor=visitor, connection=connection),
        request,
        response,
    )


@router.put("/visitor-sessions/current/area")
def set_area(
    body: VisitorAreaIn,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.set_area(
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/visitor-sessions/current")
def update_preferences(
    body: VisitorPreferencesPatch,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.update_preferences(
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/visitor/announcements")
def visitor_announcements(
    request: Request, visitor: Visitor, connection: Db, response: Response
):
    return render(
        service.visitor_announcements(visitor=visitor, connection=connection),
        request,
        response,
    )


@router.post("/visitor/kiosk-assist-events", status_code=204)
def kiosk_assist_event(
    body: KioskAssistEventIn,
    visitor: Visitor,
    connection: Db,
    request: Request,
    response: Response,
) -> Response:
    return render(
        service.kiosk_assist_event(body=body, visitor=visitor, connection=connection),
        request,
        response,
    )


@router.get("/visitor/privacy")
def privacy_notice(
    request: Request, visitor: Visitor, connection: Db, response: Response
):
    return render(
        service.privacy_notice(visitor=visitor, connection=connection),
        request,
        response,
    )


@router.patch("/visitor/privacy/consents")
def update_consents(
    body: ConsentPatch,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.update_consents(
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/visitor/privacy/requests")
def my_privacy_requests(
    request: Request, visitor: Visitor, connection: Db, response: Response
):
    return render(
        service.my_privacy_requests(visitor=visitor, connection=connection),
        request,
        response,
    )


@router.post("/visitor/privacy/requests", status_code=201)
def create_privacy_request(
    body: PrivacyRequestIn,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.create_privacy_request(
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/visitor/surveys/{survey_id}/responses", status_code=201)
def submit_survey(
    survey_id: str,
    body: SurveyResponseIn,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.submit_survey(
            survey_id=survey_id,
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/visitor/complaints", status_code=201)
def submit_complaint(
    body: ComplaintIn,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.submit_complaint(
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/visitor/course-plans", status_code=201)
def create_course_plan(
    body: CoursePlanIn,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.create_course_plan(
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/visitor/ai/conversations", status_code=201)
def start_conversation(
    body: ConversationIn,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.start_conversation(
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/visitor/ai/conversations/{conversation_id}/messages")
def send_message(
    conversation_id: str,
    body: MessageIn,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.send_message(
            conversation_id=conversation_id,
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/visitor/ai/conversations/{conversation_id}/messages")
def message_history(
    conversation_id: str,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.message_history(
            conversation_id=conversation_id,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/visitor/ai/messages/{message_id}/reports", status_code=201)
def report_message(
    message_id: str,
    body: ReportMessageIn,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.report_message(
            message_id=message_id,
            body=body,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )
