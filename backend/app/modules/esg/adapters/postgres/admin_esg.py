from app.infrastructure.db import all_rows, one
from app.infrastructure.sql import keyset


class AdminEsgRepository:
    def __init__(self, connection):
        self.connection = connection

    def esg_dashboard_select_esg_metric_versions(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """WITH latest AS (
            SELECT DISTINCT ON (metric_id) * FROM esg_metric_versions ORDER BY metric_id,version_no DESC
          ) SELECT m.id,m.name,m.category,v.id AS metric_version_id,v.version_no,v.formula,v.unit,v.target,
            coalesce(sum(em.value) FILTER(WHERE em.status='APPROVED'),0) AS approved_value,
            count(em.*) FILTER(WHERE em.status IN('DRAFT','IN_REVIEW','REJECTED'))::int AS unapproved_count,
            count(em.*) FILTER(WHERE em.status='APPROVED')::int AS approved_count,
            CASE WHEN v.target IS NULL OR v.target=0 THEN NULL
              ELSE round(coalesce(sum(em.value) FILTER(WHERE em.status='APPROVED'),0)/v.target*100,2) END AS achievement_rate,
            max(em.measured_at) FILTER(WHERE em.status='APPROVED') AS latest_measurement_at
          FROM esg_metrics m LEFT JOIN latest v ON v.metric_id=m.id
          LEFT JOIN esg_metric_versions mv ON mv.metric_id=m.id
          LEFT JOIN esg_measurements em ON em.metric_version_id=mv.id
          WHERE m.festival_id=%(festival_id)s AND m.status='ACTIVE' AND (%(category)s::text IS NULL OR m.category=%(category)s)
          GROUP BY m.id,v.id,v.version_no,v.formula,v.unit,v.target ORDER BY m.category,m.name""",
            params,
        )

    def metrics_select_esg_metrics(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT m.*,coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.version_no DESC)
            FILTER(WHERE v.id IS NOT NULL),'[]') versions FROM esg_metrics m LEFT JOIN esg_metric_versions v ON v.metric_id=m.id
            WHERE m.festival_id=%s GROUP BY m.id ORDER BY m.created_at""",
            params,
        )

    def create_metric_insert_esg_metrics(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO esg_metrics(festival_id,name,category,created_by) VALUES(%s,%s,%s,%s) RETURNING *",
            params,
        )

    def metric_select_esg_metrics(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM esg_metrics WHERE id=%s AND festival_id=%s",
            params,
        )

    def metric_select_esg_metric_versions(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT * FROM esg_metric_versions WHERE metric_id=%s ORDER BY version_no DESC",
            params,
        )

    def create_metric_version_insert_esg_metric_versions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO esg_metric_versions(metric_id,version_no,formula,unit,target,source_requirements,evidence_required,created_by)
            SELECT %(metric_id)s,coalesce(max(version_no),0)+1,%(formula)s,%(unit)s,%(target)s,%(jsonb_source_requirements)s,%(evidence_required)s,%(created_by)s FROM esg_metric_versions WHERE metric_id=%(metric_id)s RETURNING *""",
            params,
        )

    def measurements_select_esg_evidence(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            f"""SELECT em.*,m.name AS metric_name,m.category,v.version_no,v.unit,
            (SELECT count(*) FROM esg_evidence e WHERE e.measurement_id=em.id)::int AS evidence_count
            FROM esg_measurements em JOIN esg_metric_versions v ON v.id=em.metric_version_id JOIN esg_metrics m ON m.id=v.metric_id
            WHERE em.festival_id=%(festival_id)s AND (%(status)s::text IS NULL OR em.status=%(status)s)
            AND {keyset("measured_at", "em")}
            ORDER BY em.measured_at DESC,em.id DESC LIMIT %(limit)s""",
            params,
        )

    def work_select_esg_metric_versions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT 1 FROM esg_metric_versions v JOIN esg_metrics m ON m.id=v.metric_id
                WHERE v.id=%s AND m.festival_id=%s""",
            params,
        )

    def work_insert_esg_measurements(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO esg_measurements(festival_id,metric_version_id,value,source_type,source_ref,dedupe_key,
                    measured_at,supersedes_id,created_by) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def measurement_select_esg_measurements(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT em.*,to_jsonb(v) metric_version FROM esg_measurements em JOIN esg_metric_versions v ON v.id=em.metric_version_id
            WHERE em.id=%s AND em.festival_id=%s""",
            params,
        )

    def measurement_select_esg_evidence(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT * FROM esg_evidence WHERE measurement_id=%s ORDER BY created_at",
            params,
        )

    def measurement_select_esg_reviews(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT * FROM esg_reviews WHERE measurement_id=%s ORDER BY created_at",
            params,
        )

    def patch_measurement_select_esg_measurements(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM esg_measurements WHERE id=%s AND festival_id=%s",
            params,
        )

    def patch_measurement_update_esg_measurements_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE esg_measurements SET value=coalesce(%s,value),source_type=coalesce(%s,source_type),
            source_ref=coalesce(%s,source_ref),measured_at=coalesce(%s,measured_at),updated_at=now()
            WHERE id=%s AND festival_id=%s AND status IN('DRAFT','REJECTED') RETURNING *""",
            params,
        )

    def add_evidence_select_esg_measurements(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT 1 FROM esg_measurements WHERE id=%s AND festival_id=%s AND status NOT IN('APPROVED','SUPERSEDED')",
            params,
        )

    def add_evidence_insert_esg_evidence(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO esg_evidence(measurement_id,file_id,file_hash,evidence_type,issued_at) VALUES(%s,%s,%s,%s,%s) RETURNING *",
            params,
        )

    def review_measurement_select_esg_evidence(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT em.*,v.formula,v.unit,v.source_requirements,v.evidence_required,
            (SELECT count(*) FROM esg_evidence e WHERE e.measurement_id=em.id)::int evidence_count
            FROM esg_measurements em JOIN esg_metric_versions v ON v.id=em.metric_version_id WHERE em.id=%s AND em.festival_id=%s""",
            params,
        )

    def review_measurement_insert_esg_reviews(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO esg_reviews(measurement_id,reviewer_id,decision,comment) VALUES(%s,%s,%s,%s)",
            params,
        )

    def review_measurement_update_esg_measurements(self, params=()):
        connection = self.connection
        return one(
            connection,
            "UPDATE esg_measurements SET status=%s,updated_at=now() WHERE id=%s RETURNING *",
            params,
        )

    def supersede_measurement(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE esg_measurements SET status='SUPERSEDED',updated_at=now() WHERE id=%s AND status='APPROVED'",
            params,
        )

    def reports_select_esg_reports(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT * FROM esg_reports WHERE festival_id=%s ORDER BY created_at DESC",
            params,
        )

    def work_insert_esg_reports(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO esg_reports(festival_id,title,period_from,period_to,compare_with_festival_id,format,created_by)
                VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def work_insert_jobs(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO jobs(festival_id,job_type,resource_type,resource_id) VALUES(%s,'GENERATE_ESG_REPORT','ESG_REPORT',%s) RETURNING *",
            params,
        )

    def report_select_esg_reports(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM esg_reports WHERE id=%s AND festival_id=%s",
            params,
        )

    def patch_report_update_esg_reports(self, params=()):
        connection = self.connection
        return one(
            connection,
            "UPDATE esg_reports SET edit_metadata=%s,updated_at=now() WHERE id=%s AND festival_id=%s AND status='DRAFT' RETURNING *",
            params,
        )

    def approve_report_select_esg_reports(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT created_by,status FROM esg_reports WHERE id=%s AND festival_id=%s",
            params,
        )

    def approve_report_update_esg_reports_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            "UPDATE esg_reports SET status='APPROVED',updated_at=now() WHERE id=%s AND festival_id=%s AND status='DRAFT' RETURNING *",
            params,
        )

    def export_report_select_esg_reports(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT 1 FROM esg_reports WHERE id=%s AND festival_id=%s AND status='APPROVED'",
            params,
        )

    def export_report_insert_jobs(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO jobs(festival_id,job_type,resource_type,resource_id,status,result)
            VALUES(%s,'EXPORT_ESG_REPORT','ESG_REPORT',%s,'PENDING',%s) RETURNING *""",
            params,
        )
