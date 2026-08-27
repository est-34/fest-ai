from app.infrastructure.db import all_rows, one

REPORT_METRICS_SQL = """SELECT m.id AS "metricId",m.name,m.category,v.id AS "metricVersionId",v.version_no AS "versionNo",
          v.formula,v.unit,v.target,sum(em.value)::float8 AS value,count(em.id)::int AS "measurementCount",
          coalesce(sum((SELECT count(*) FROM esg_evidence e WHERE e.measurement_id=em.id)),0)::int AS "evidenceCount",
          max(em.measured_at) AS "lastMeasuredAt"
   FROM esg_measurements em JOIN esg_metric_versions v ON v.id=em.metric_version_id
   JOIN esg_metrics m ON m.id=v.metric_id
   WHERE em.festival_id=%s AND em.status='APPROVED' AND em.measured_at BETWEEN %s AND %s
   GROUP BY m.id,m.name,m.category,v.id,v.version_no,v.formula,v.unit,v.target ORDER BY m.category,m.name"""


class JobsRepository:
    def __init__(self, connection):
        self.connection = connection

    def report_metrics(self, params=()):
        connection = self.connection
        return all_rows(connection, REPORT_METRICS_SQL, params)

    def report_by_id(self, params=()):
        connection = self.connection
        return one(connection, "SELECT * FROM esg_reports WHERE id=%s", params)

    def _generate_esg_report_esg_reports_2(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE esg_reports SET status='DRAFT',snapshot=%s,updated_at=now() WHERE id=%s",
            params,
        )

    def _export_esg_report_esg_reports_2(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE esg_reports SET status='EXPORTED',updated_at=now() WHERE id=%s",
            params,
        )

    def fail_job_jobs(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE jobs SET status=%s,attempts=%s,error=%s,updated_at=now() WHERE id=%s",
            params,
        )

    def fail_job_esg_reports(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE esg_reports SET status='FAILED',updated_at=now() WHERE id=%s",
            params,
        )

    def process_one_job_jobs(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT * FROM jobs WHERE status='PENDING' AND attempts<%s
                ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1""",
            params,
        )

    def process_one_job_jobs_2(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE jobs SET status='RUNNING',updated_at=now() WHERE id=%s", params
        )

    def process_one_job_jobs_3(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE jobs SET status='COMPLETED',result=%s,updated_at=now() WHERE id=%s",
            params,
        )

    def purge_expired_idempotency_records(self, params=()):
        connection = self.connection
        return connection.execute(
            "DELETE FROM idempotency_records WHERE created_at<now()-make_interval(days => %s)",
            params,
        )

    def purge_expired_refresh_tokens(self, params=()):
        connection = self.connection
        return connection.execute(
            "DELETE FROM refresh_tokens WHERE expires_at<now()-interval '30 days' OR revoked_at<now()-interval '30 days'",
            params,
        )
