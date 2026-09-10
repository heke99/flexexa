-- Operational traces, not tenant business records or an audit/authorization store.
-- Column protocol matches the OpenTelemetry ClickHouse exporter v0.160.0.
-- DDL is migration-owned; the runtime writer receives INSERT only.
CREATE TABLE flexexa.otel_traces_v1 (
 Timestamp DateTime64(9, 'UTC'),
 TraceId String,
 SpanId String,
 ParentSpanId String,
 TraceState String,
 SpanName LowCardinality(String),
 SpanKind LowCardinality(String),
 ServiceName LowCardinality(String),
 ResourceAttributes Map(LowCardinality(String), String),
 ScopeName String,
 ScopeVersion String,
 SpanAttributes Map(LowCardinality(String), String),
 Duration UInt64,
 StatusCode LowCardinality(String),
 StatusMessage String,
 Events Nested(Timestamp DateTime64(9, 'UTC'), Name LowCardinality(String), Attributes Map(LowCardinality(String), String)),
 Links Nested(TraceId String, SpanId String, TraceState String, Attributes Map(LowCardinality(String), String)),
 Environment LowCardinality(String) MATERIALIZED ResourceAttributes['deployment.environment.name'],
 ReceivedAt DateTime64(9, 'UTC') DEFAULT now64(9),
 CONSTRAINT identity_only CHECK ServiceName='flexexa-identity' AND ScopeName='flexexa.identity',
 CONSTRAINT known_environment CHECK Environment IN ('sandbox','production'),
 CONSTRAINT identifiers CHECK match(TraceId,'^[0-9a-f]{32}$') AND TraceId!='00000000000000000000000000000000'
  AND match(SpanId,'^[0-9a-f]{16}$') AND SpanId!='0000000000000000'
  AND (ParentSpanId='' OR match(ParentSpanId,'^[0-9a-f]{16}$')),
 CONSTRAINT bounded_names CHECK length(SpanName)<=128 AND length(ScopeVersion)<=32,
 CONSTRAINT no_free_text CHECK length(TraceState)=0 AND length(StatusMessage)=0,
 CONSTRAINT no_events CHECK length(`Events.Name`)=0,
 CONSTRAINT no_links CHECK length(`Links.TraceId`)=0,
 CONSTRAINT resource_keys CHECK arrayAll(k -> k IN ('service.name','service.version','deployment.environment.name'),mapKeys(ResourceAttributes)),
 CONSTRAINT span_keys CHECK arrayAll(k -> k IN ('http.request.method','http.route','http.response.status_code','flexexa.request_id','flexexa.correlation_id'),mapKeys(SpanAttributes)),
 CONSTRAINT bounded_attributes CHECK arrayAll(v -> length(v)<=128,mapValues(SpanAttributes)) AND arrayAll(v -> length(v)<=128,mapValues(ResourceAttributes)),
 INDEX trace_lookup TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
 INDEX correlation_lookup SpanAttributes['flexexa.correlation_id'] TYPE bloom_filter(0.001) GRANULARITY 1
) ENGINE=ReplacingMergeTree(ReceivedAt)
PARTITION BY toDate(Timestamp)
ORDER BY (Environment, ServiceName, TraceId, SpanId)
TTL toDateTime(Timestamp)+INTERVAL 72 HOUR DELETE
SETTINGS index_granularity=8192;
