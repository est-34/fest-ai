from typing import Annotated

from fastapi import APIRouter, Query, Request, Response

from app.modules.operations.application import admin_ops as service
from app.shared.adapters.http.deps import (
    Db,
    IfMatch,
    Manager,
    Operator,
    Scope,
    SuperAdmin,
    User,
)
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import (
    AnnouncementDraftIn,
    AnnouncementIn,
    AnnouncementPatch,
    CrowdSnapshotIn,
    GenericExportIn,
    IssueAnalysisPatch,
    KioskCameraPatch,
    MembershipIn,
    MembershipPatch,
    PrivacyRequestPatch,
    PublishAnnouncementIn,
    StaffAssignmentIn,
    SurveyIn,
    SurveyPatch,
    TicketIn,
    TicketPatch,
    TicketTransitionIn,
)

router = APIRouter(tags=["admin-ops"])


@router.get("/admin/festivals/{festival_id}/announcements")
def announcements(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.announcements(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/announcements", status_code=201)
def create_announcement(
    festival_id: str,
    body: AnnouncementIn,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.create_announcement(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/announcements/publish", status_code=201)
def create_and_publish_announcement(
    festival_id: str,
    body: AnnouncementDraftIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_and_publish_announcement(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/announcements/{announcement_id}")
def announcement(
    festival_id: str,
    announcement_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.announcement(
            festival_id=festival_id,
            announcement_id=announcement_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/announcements/{announcement_id}")
def update_announcement(
    festival_id: str,
    announcement_id: str,
    body: AnnouncementPatch,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.update_announcement(
            festival_id=festival_id,
            announcement_id=announcement_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/announcements/{announcement_id}/publish")
def publish_announcement(
    festival_id: str,
    announcement_id: str,
    body: PublishAnnouncementIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.publish_announcement(
            festival_id=festival_id,
            announcement_id=announcement_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/announcements/{announcement_id}/close")
def close_announcement(
    festival_id: str,
    announcement_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.close_announcement(
            festival_id=festival_id,
            announcement_id=announcement_id,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/ops-tickets")
def tickets(
    festival_id: str,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    cursor: str | None = None,
):
    return render(
        service.tickets(
            festival_id=festival_id,
            user=user,
            connection=connection,
            status=status,
            limit=limit,
            cursor=cursor,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/ops-tickets", status_code=201)
def create_ticket(
    festival_id: str,
    body: TicketIn,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.create_ticket(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/ops-tickets/{ticket_id}")
def ticket(
    festival_id: str,
    ticket_id: str,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.ticket(
            festival_id=festival_id,
            ticket_id=ticket_id,
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/ops-tickets/{ticket_id}")
def patch_ticket(
    festival_id: str,
    ticket_id: str,
    body: TicketPatch,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.patch_ticket(
            festival_id=festival_id,
            ticket_id=ticket_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/ops-tickets/{ticket_id}/transitions")
def transition_ticket(
    festival_id: str,
    ticket_id: str,
    body: TicketTransitionIn,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.transition_ticket(
            festival_id=festival_id,
            ticket_id=ticket_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/ops-tickets/{ticket_id}/events")
def ticket_events(
    festival_id: str,
    ticket_id: str,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.ticket_events(
            festival_id=festival_id,
            ticket_id=ticket_id,
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/issue-analysis")
def issue_analysis(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.issue_analysis(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/issue-analysis/{ticket_id}")
def override_issue_analysis(
    festival_id: str,
    ticket_id: str,
    body: IssueAnalysisPatch,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.override_issue_analysis(
            festival_id=festival_id,
            ticket_id=ticket_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/surveys")
def surveys(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.surveys(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/surveys", status_code=201)
def create_survey(
    festival_id: str,
    body: SurveyIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_survey(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/surveys/{survey_id}")
def update_survey(
    festival_id: str,
    survey_id: str,
    body: SurveyPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
):
    return render(
        service.update_survey(
            festival_id=festival_id,
            survey_id=survey_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/surveys/{survey_id}/summary")
def survey_summary(
    festival_id: str,
    survey_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.survey_summary(
            festival_id=festival_id,
            survey_id=survey_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/staff-assignments")
def staff_assignments(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.staff_assignments(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/staff-assignments", status_code=201)
def create_staff_assignment(
    festival_id: str,
    body: StaffAssignmentIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_staff_assignment(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/staff-assignments/{assignment_id}/acknowledge"
)
def acknowledge_assignment(
    festival_id: str,
    assignment_id: str,
    request: Request,
    _: Scope,
    user: User,
    connection: Db,
    response: Response,
):
    return render(
        service.acknowledge_assignment(
            festival_id=festival_id,
            assignment_id=assignment_id,
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/crowd-snapshots")
def crowd_snapshots(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.crowd_snapshots(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/crowd-snapshots", status_code=201)
def create_crowd_snapshot(
    festival_id: str,
    body: CrowdSnapshotIn,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.create_crowd_snapshot(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/organizations/{organization_id}/memberships")
def memberships(
    organization_id: str,
    request: Request,
    user: SuperAdmin,
    connection: Db,
    response: Response,
):
    return render(
        service.memberships(
            organization_id=organization_id,
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/organizations/{organization_id}/memberships", status_code=201)
def create_membership(
    organization_id: str,
    body: MembershipIn,
    request: Request,
    user: SuperAdmin,
    connection: Db,
    response: Response,
):
    return render(
        service.create_membership(
            organization_id=organization_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/organizations/{organization_id}/memberships/{membership_id}")
def patch_membership(
    organization_id: str,
    membership_id: str,
    body: MembershipPatch,
    request: Request,
    user: SuperAdmin,
    connection: Db,
    response: Response,
):
    return render(
        service.patch_membership(
            organization_id=organization_id,
            membership_id=membership_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.delete(
    "/admin/organizations/{organization_id}/memberships/{membership_id}",
    status_code=204,
)
def deactivate_membership(
    organization_id: str,
    membership_id: str,
    request: Request,
    user: SuperAdmin,
    connection: Db,
    response: Response,
) -> Response:
    return render(
        service.deactivate_membership(
            organization_id=organization_id,
            membership_id=membership_id,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/audit-logs")
def audit_logs(
    festival_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    limit: int = Query(20, ge=1, le=100),
    action: str | None = None,
    resource_type: Annotated[str | None, Query(alias="resourceType")] = None,
    cursor: str | None = None,
):
    return render(
        service.audit_logs(
            festival_id=festival_id,
            connection=connection,
            limit=limit,
            action=action,
            resource_type=resource_type,
            cursor=cursor,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/exports", status_code=202)
def create_export(
    festival_id: str,
    body: GenericExportIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_export(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/privacy/policy")
def privacy_policy(
    festival_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.privacy_policy(
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/privacy/requests")
def privacy_requests(
    festival_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    status: str | None = None,
):
    return render(
        service.privacy_requests(
            festival_id=festival_id,
            connection=connection,
            status=status,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/privacy/requests/{privacy_request_id}/handle"
)
def handle_privacy_request(
    festival_id: str,
    privacy_request_id: str,
    body: PrivacyRequestPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.handle_privacy_request(
            festival_id=festival_id,
            privacy_request_id=privacy_request_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/privacy/purge")
def run_privacy_purge(
    festival_id: str,
    request: Request,
    _: Scope,
    user: SuperAdmin,
    connection: Db,
    response: Response,
):
    return render(
        service.run_privacy_purge(
            festival_id=festival_id,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/visitor-identity")
def visitor_identity(
    festival_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.visitor_identity(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/notification-deliveries")
def notification_deliveries(
    festival_id: str,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.notification_deliveries(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/kiosk-camera")
def kiosk_camera(
    festival_id: str,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.kiosk_camera(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/kiosk-camera")
def update_kiosk_camera(
    festival_id: str,
    body: KioskCameraPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.update_kiosk_camera(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/jobs/{job_id}")
def get_job(
    job_id: str, request: Request, user: User, connection: Db, response: Response
):
    return render(
        service.get_job(
            job_id=job_id,
            user=user,
            connection=connection,
        ),
        request,
        response,
    )
