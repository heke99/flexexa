-- Isolated raw-telemetry foundation. Retention v1: 30 days from event time.
-- No aggregate table/retention is activated by this migration.
CREATE TABLE flexexa.telemetry_v1
(
    tenant_id UUID,
    organization_id Nullable(UUID),
    site_id UUID,
    asset_id UUID,
    provider_id UUID,
    event_time DateTime64(3, 'UTC'),
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3, 'UTC'),
    metric LowCardinality(String),
    value_float Nullable(Float64),
    value_string Nullable(String),
    value_bool Nullable(Bool),
    unit LowCardinality(String),
    source LowCardinality(String),
    quality LowCardinality(String),
    sequence_number UInt64,
    correlation_id UUID,
    tags Map(String, String),
    CONSTRAINT nonzero_ids CHECK tenant_id != toUUID('00000000-0000-0000-0000-000000000000')
        AND site_id != toUUID('00000000-0000-0000-0000-000000000000')
        AND asset_id != toUUID('00000000-0000-0000-0000-000000000000')
        AND provider_id != toUUID('00000000-0000-0000-0000-000000000000'),
    CONSTRAINT one_value CHECK isNotNull(value_float) + isNotNull(value_string) + isNotNull(value_bool) = 1,
    CONSTRAINT finite_value CHECK isNull(value_float) OR isFinite(value_float),
    CONSTRAINT attribution CHECK notEmpty(metric) AND notEmpty(unit) AND notEmpty(source) AND notEmpty(quality)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_time)
ORDER BY (tenant_id, asset_id, metric, event_time, sequence_number)
TTL toDateTime(event_time) + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192;
