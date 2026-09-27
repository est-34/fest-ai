-- QR에는 인증 토큰 대신 활동 연결 전용 난수 코드를 노출한다.
ALTER TABLE visitor_sessions ADD COLUMN activity_code text NOT NULL
    DEFAULT ('VIS-' || upper(encode(gen_random_bytes(12), 'hex')));
ALTER TABLE visitor_sessions ADD CONSTRAINT visitor_activity_code_unique UNIQUE(activity_code);

CREATE TABLE plogging_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id uuid NOT NULL REFERENCES festivals(id),
    visitor_session_id uuid NOT NULL REFERENCES visitor_sessions(id),
    submission_code text NOT NULL UNIQUE,
    bag_count integer NOT NULL CHECK (bag_count BETWEEN 1 AND 20),
    location text NOT NULL,
    points integer NOT NULL CHECK (points = bag_count * 30),
    operator_id uuid NOT NULL REFERENCES users(id),
    verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plogging_festival_idx ON plogging_submissions(festival_id, verified_at DESC);
CREATE INDEX plogging_visitor_idx ON plogging_submissions(visitor_session_id);

CREATE TABLE container_rentals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    festival_id uuid NOT NULL REFERENCES festivals(id),
    visitor_session_id uuid NOT NULL REFERENCES visitor_sessions(id),
    rental_code text NOT NULL UNIQUE,
    container_type text NOT NULL CHECK (container_type IN ('CUP','BOWL','TUMBLER')),
    quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
    station text NOT NULL,
    operator_id uuid NOT NULL REFERENCES users(id),
    returned_by uuid REFERENCES users(id),
    rented_at timestamptz NOT NULL DEFAULT now(),
    returned_at timestamptz,
    CHECK ((returned_at IS NULL) = (returned_by IS NULL))
);
CREATE INDEX rentals_festival_idx ON container_rentals(festival_id, rented_at DESC);
CREATE INDEX rentals_visitor_idx ON container_rentals(visitor_session_id);

ALTER TABLE point_ledger ADD COLUMN plogging_submission_id uuid UNIQUE REFERENCES plogging_submissions(id);
ALTER TABLE point_ledger ADD COLUMN container_rental_id uuid UNIQUE REFERENCES container_rentals(id);
ALTER TABLE point_ledger ADD CONSTRAINT point_activity_source CHECK (
    num_nonnulls(reward_event_id, plogging_submission_id, container_rental_id) <= 1
);

-- 모든 API 프로세스가 같은 분 단위 카운터를 원자적으로 증가시킨다.
CREATE TABLE request_limits (
    client_key text NOT NULL,
    route_key text NOT NULL,
    window_id bigint NOT NULL,
    hits integer NOT NULL DEFAULT 1,
    PRIMARY KEY(client_key,route_key,window_id)
);
CREATE INDEX request_limits_window_idx ON request_limits(window_id);
