from app.infrastructure import ai, esg_export, tokens
from app.infrastructure.config import settings
from app.infrastructure.transaction import Transaction
from app.modules.commerce.adapters.postgres.businesses import BusinessesRepository
from app.modules.commerce.adapters.postgres.merchant import MerchantRepository
from app.modules.engagement.adapters.postgres.activities import ActivitiesRepository
from app.modules.engagement.adapters.postgres.bookings import BookingsRepository
from app.modules.engagement.adapters.postgres.context import ContextRepository
from app.modules.engagement.adapters.postgres.rewards import RewardsRepository
from app.modules.engagement.adapters.postgres.visitor import VisitorRepository
from app.modules.esg.adapters.postgres.admin_esg import AdminEsgRepository
from app.modules.esg.adapters.postgres.jobs import JobsRepository
from app.modules.festival.adapters.postgres.admin_content import AdminContentRepository
from app.modules.festival.adapters.postgres.admin_core import AdminCoreRepository
from app.modules.festival.adapters.postgres.public import PublicRepository
from app.modules.identity.adapters.postgres.auth import AuthRepository
from app.modules.operations.adapters.postgres.admin_documents import (
    AdminDocumentsRepository,
)
from app.modules.operations.adapters.postgres.admin_ops import AdminOpsRepository
from app.modules.operations.adapters.postgres.insights import InsightsRepository
from app.modules.privacy.adapters.postgres.privacy import PrivacyRepository
from app.shared.adapters.postgres.audit import AuditRepository
from app.shared.adapters.postgres.common import CommonRepository
from app.shared.adapters.postgres.idempotency import IdempotencyRepository
from app.shared.adapters.postgres.notifications import NotificationsRepository
from app.shared.application.policy import Policy


class UnitOfWork:
    """Request/job-scoped adapters sharing one transaction, including audit and idempotency."""

    def __init__(self, session):
        self.session = session
        transaction = Transaction(session)
        self.ai = ai
        self.tokens = tokens
        self.exports = esg_export
        self.policy = Policy(
            **{name: getattr(settings, name) for name in Policy.__dataclass_fields__}
        )
        self.auth = AuthRepository(transaction)
        self.admin_core = AdminCoreRepository(transaction)
        self.admin_content = AdminContentRepository(transaction)
        self.public = PublicRepository(transaction)
        self.visitor = VisitorRepository(transaction)
        self.bookings = BookingsRepository(transaction)
        self.rewards = RewardsRepository(transaction)
        self.activities = ActivitiesRepository(transaction)
        self.context = ContextRepository(transaction)
        self.businesses = BusinessesRepository(transaction)
        self.merchant = MerchantRepository(transaction)
        self.admin_ops = AdminOpsRepository(transaction)
        self.admin_documents = AdminDocumentsRepository(transaction)
        self.insights = InsightsRepository(transaction)
        self.admin_esg = AdminEsgRepository(transaction)
        self.jobs = JobsRepository(transaction)
        self.privacy = PrivacyRepository(transaction)
        self.common = CommonRepository(transaction)
        self.audit = AuditRepository(transaction)
        self.notifications = NotificationsRepository(transaction)
        self.idempotency = IdempotencyRepository(transaction)

    def commit(self):
        self.session.commit()

    def transaction(self):
        return self.session.transaction()

    def external_io(self):
        return self.session.external_io()
