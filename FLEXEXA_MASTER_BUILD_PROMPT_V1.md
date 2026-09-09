# FLEXEXA — MASTER BUILD PROMPT V1

Status: LOCKED V1 BASELINE
Domain: flexexa.com
Repository: flexexa
Primary market: Sweden
Primary cloud region: AWS eu-north-1 Stockholm

This document is the authoritative build specification for Flexexa. It consolidates the complete product, market, infrastructure, connectivity, optimization, flexibility, BSP, settlement, tenancy, canonical-data, RPC, RBAC, security, observability and deployment requirements.

The implementation must not remove a requirement merely to make the MVP faster. Later phases may be disabled by feature flags, but the canonical data model and boundaries must be prepared from the beginning.

---

# 0. PRODUCT MISSION

Build Flexexa as a multi-tenant, white-label, API-first Energy Operating System, DERMS, VPP, smart-energy orchestration and flexibility-settlement platform.

Flexexa shall support:
- electricity retailers
- charger OEMs
- vehicle OEMs
- battery OEMs
- energy service companies
- fleet operators
- aggregators
- BSP partners
- HEMS providers
- later DSO/local flexibility actors
- future direct BSP market access

Flexexa shall initially operate through external BSP partners.

Flexexa shall NOT become BRP.

Flexexa must nevertheless be fully BRP-aware and model retailer, BRP, BSP, DSO, aggregator, TSO, market area and temporal actor relationships correctly.

The architecture shall support later replacement of ExternalBspAdapter with FlexexaDirectBspAdapter without redesigning:
- assets
- connectivity
- telemetry
- optimizer
- forecasting
- flexibility
- pools
- dispatch
- measurement
- baseline
- verification
- settlement
- revenue allocation

Scale target:
- 1,000,000+ connected assets
- hundreds of thousands of concurrent chargers
- multiple countries
- multiple BSPs
- multiple BRPs
- multiple retailers
- multiple DSOs
- multiple flexibility markets
- V1G initially
- V2H/V2G and ISO 15118-20 later

---

# 1. NON-NEGOTIABLE ARCHITECTURE

Flexexa must be:
1. API-first.
2. White-label-first.
3. Multi-tenant from migration 1.
4. Canonical-data-first.
5. Provider-agnostic.
6. OEM-agnostic.
7. BSP-agnostic.
8. BRP-aware but not BRP.
9. Country-pack based.
10. Event-driven for asynchronous work.
11. Audit-grade for control and market events.
12. Settlement-grade for money flows.
13. Idempotent for commands, imports and external writes.
14. Deterministic for rules that control energy, markets or money.
15. Open-source-first where mature components exist.
16. Upstream-friendly; avoid deep forks.
17. Designed so frontend is never source of truth.
18. Designed so physical electrical safety always wins.
19. Designed so customer mobility guarantee wins over optimization revenue.
20. Designed so the same physical flexibility cannot be sold twice.

---

# 2. FLEXEXA KERNEL — CENTRAL LAYER

Create a central Flexexa Kernel used by every domain.

Kernel responsibilities:
- canonical domain registry
- tenant context
- identity context
- RBAC / authorization
- policy and rules engine
- state machine registry
- units and money conventions
- time and interval conventions
- data provenance
- idempotency
- audit contracts
- canonical error taxonomy
- correlation and causation IDs
- configuration/version registry
- feature flags
- approval/four-eyes framework
- readiness/re-evaluation framework

Repository structure:

~~~text
packages/kernel/
  canonical/
  tenancy/
  authz/
  rules/
  state-machines/
  units/
  money/
  time/
  provenance/
  idempotency/
  audit/
  errors/
  config/

services/policy-service/
services/authorization-service/
~~~

General service flow:

~~~text
External input
→ Adapter validation
→ Canonical normalization
→ Tenant ownership validation
→ Authentication
→ Authorization/RBAC
→ Central policy/rule evaluation
→ Domain invariant/state transition
→ Transactional write/RPC
→ Outbox event
→ Async consumers
→ Audit/provenance
~~~

Business rules shall not be duplicated inside optimizer, flex-service, dispatch-service, settlement-service or frontend.

Exception:
- hard physical-safety invariants
- protocol invariants
- local charger/Edge limits

These must stay in deterministic code/Edge and may never depend on a remote dynamic rule.

---

# 3. CANONICAL MODEL FROM FIRST COMMIT

There shall be one canonical internal representation for each core concept:

- CanonicalCustomer
- CanonicalSite
- CanonicalMeteringPoint
- CanonicalAsset
- CanonicalAssetState
- CanonicalCapability
- CanonicalMarketActor
- CanonicalPriceInterval
- CanonicalGridTariff
- CanonicalRetailerTariff
- CanonicalFlexProduct
- CanonicalFlexAvailability
- CanonicalReservation
- CanonicalCommitment
- CanonicalActivation
- CanonicalDispatch
- CanonicalMeasurement
- CanonicalBaseline
- CanonicalSettlement
- CanonicalLedgerTransaction
- CanonicalConsent
- CanonicalDecision
- CanonicalEvent

Provider payloads shall never become internal domain models.

~~~text
Tesla   ─┐
Enode   ─┼→ provider adapter → CanonicalAssetState
OCPP    ─┤
OEM API ─┘
~~~

The same pattern applies to:
- BSP
- settlement
- tariffs
- prices
- weather
- meters
- DSO/local flex

Canonical schemas live in:
- packages/domain
- packages/api-contracts
- packages/events
- packages/kernel/canonical

Use:
- OpenAPI for HTTP contracts
- JSON Schema for canonical payloads
- AsyncAPI for events
- Zod or equivalent OSS runtime validation in TypeScript
- Pydantic/JSON-Schema-compatible models in Python

No service may create a private duplicate of a canonical enum or DTO.

---

# 4. CANONICAL UNITS, MONEY AND TIME

Lock:
- IDs: UUID; prefer server/application generated UUIDv7, UUIDv4 fallback
- database timestamps: timestamptz UTC
- local schedules: always with IANA timezone
- intervals: half-open [starts_at, ends_at)
- power: kW
- energy: kWh
- current: A
- voltage: V
- SOC: percent 0–100
- currency: ISO 4217
- country: ISO 3166-1 alpha-2
- money: numeric/decimal or minor units; never float
- business power/energy used for settlement: numeric/decimal
- telemetry analytics may use float where precision is documented
- enum values: lowercase_snake_case
- external identifiers: separate from Flexexa IDs

JSON may hold raw provider payloads and extension metadata, but must not replace normalized core columns.

---

# 5. TENANT OWNERSHIP — ABSOLUTE RULE

Every tenant-owned business row must contain:

~~~sql
tenant_id uuid NOT NULL REFERENCES tenants(id)
~~~

This includes at minimum:
- customers
- sites
- tenant metering points
- assets
- asset connections
- provider accounts
- charging preferences
- charging plans
- optimization runs
- flex portfolios
- flex reservations
- flex commitments
- flex dispatches
- tenant settlement objects
- customer rewards
- consents
- API clients
- webhook endpoints
- audit events
- rule bindings
- configuration bindings
- feature flags

A tenant-owned row may never exist without tenant_id.

Platform-global catalog tables are explicit exceptions, e.g.:
- permissions
- countries
- canonical market areas
- provider definitions
- generic market product templates

---

# 6. CUSTOMER → TENANT AND ALL RELATIONS MUST BE DATABASE-SAFE

customers.tenant_id is mandatory.

The database must prove:

~~~text
site.tenant_id == customer.tenant_id
asset.tenant_id == site.tenant_id
asset.tenant_id == customer.tenant_id
portfolio membership tenant == asset tenant unless explicit platform aggregation path is used
~~~

Do not rely only on frontend or API validation.

Use composite tenant-safe foreign keys.

Example:

~~~sql
ALTER TABLE customers
  ADD CONSTRAINT customers_tenant_id_id_key
  UNIQUE (tenant_id, id);

ALTER TABLE sites
  ADD CONSTRAINT sites_tenant_id_id_key
  UNIQUE (tenant_id, id),
  ADD CONSTRAINT sites_customer_same_tenant_fk
  FOREIGN KEY (tenant_id, customer_id)
  REFERENCES customers (tenant_id, id);
~~~

Apply the same pattern to all tenant-owned relations.

It must be impossible through normal tenant writes to create:
- Tenant A customer → Tenant B site
- Tenant A site → Tenant B asset
- Tenant A asset → Tenant B tenant portfolio
- Tenant A provider account → Tenant B asset connection

tenant_id must be immutable to ordinary users after row creation.

---

# 7. ORGANIZATION VS TENANT

Organization and tenant are separate:

~~~text
Organization
  ├─ Tenant A
  └─ Tenant B
~~~

For tenant-owned rows, tenant_id is the tenancy source of truth.

Do not duplicate organization_id everywhere if it is only derivable through tenant.

If both tenant_id and organization_id are stored for performance/reporting, enforce:

~~~text
tenant.organization_id == row.organization_id
~~~

No service may trust two unsynchronized ownership fields.

---

# 8. CROSS-TENANT AGGREGATION

Never implement cross-tenant flex by removing tenant_id or bypassing RLS ad hoc.

Build a separately privileged:

~~~text
platform-aggregation-service
~~~

It shall have its own service identity and explicit grants.

Cross-tenant aggregation is allowed only when:
- tenant agreement is valid
- customer consent is valid
- retailer agreement is valid where required
- BSP/BRP/DSO combination is eligible
- market product allows the aggregation
- explicit aggregation scope exists

Every cross-tenant operation must:
- list participating tenant IDs
- create immutable audit
- retain contribution attribution per tenant/customer/asset

---

# 9. CENTRAL POLICY & RULES ENGINE

Build a versioned central rule layer that all relevant systems call.

Rule categories:
- electrical/control policy
- command priority
- mobility guarantee
- customer override
- consent eligibility
- asset eligibility
- market eligibility
- prequalification
- portfolio segmentation
- cross-tenant rules
- cross-retailer rules
- cross-BSP rules
- cross-BRP rules
- cross-DSO rules
- safe-capacity haircut
- overbooking limits
- dispatch selection
- redispatch
- provider selection/fallback
- tariff calculation
- tax policy
- optimizer constraints
- market bidding
- settlement matching
- revenue allocation
- penalty allocation
- BRP impact/compensation
- GDPR/retention
- data quality/staleness
- notification
- incident handling

No LLM may evaluate rules that control physical energy, market commitments, financial settlement or permissions.

---

# 10. RULE TABLES — FIELD FOR FIELD

rule_definitions:
- id
- rule_key
- domain
- name
- description
- scope_type
- rule_type
- input_schema_json
- output_schema_json
- default_effect
- overridable_by_tenant
- criticality
- execution_mode
- status
- created_at
- updated_at

rule_versions:
- id
- rule_definition_id
- version
- expression_language
- expression_json
- configuration_json
- checksum
- status
- valid_from
- valid_until
- created_by
- approved_by
- approved_at
- created_at

Allowed rule statuses:
- draft
- testing
- approved
- published
- deprecated
- retired

Published rule versions are immutable. Any change creates a new version.

policy_sets:
- id
- policy_key
- domain
- name
- description
- criticality
- status
- created_at
- updated_at

policy_set_versions:
- id
- policy_set_id
- version
- status
- checksum
- valid_from
- valid_until
- created_by
- approved_by
- approved_at
- created_at

policy_set_rule_versions:
- id
- policy_set_version_id
- rule_version_id
- priority
- required
- configuration_json

rule_bindings:
- id
- tenant_id
- rule_definition_id
- rule_version_id
- scope_type
- scope_id
- priority
- override_mode
- valid_from
- valid_until
- status
- created_by
- created_at
- updated_at

Rule scopes:
- platform
- country
- market_area
- market_provider
- market_product
- market_actor
- tenant
- site
- asset_type
- asset
- customer
- portfolio

Tenant override is only allowed when overridable_by_tenant=true.

---

# 11. RULE PRECEDENCE

Rules resolve in this authority order:

1. physical-safety invariant
2. mandatory regulatory/country rule
3. market/TSO/DSO product rule
4. contractual BSP/BRP/retailer rule
5. platform mandatory policy
6. tenant policy
7. site/asset policy
8. customer preference
9. optimizer preference

A hard safety/regulatory deny can never be overridden by a lower layer.

For numeric constraints the safest effective limit normally wins.

Example:

~~~text
platform max = 11 kW
tenant max = 9 kW
customer max = 7 kW
effective max = 7 kW
~~~

Conflict-resolution strategy must be defined in the rule definition and covered by tests.

---

# 12. RULE EVALUATION CONTRACT

Canonical DecisionRequest must include:
- tenant_id
- policy_key
- effective_at
- authenticated actor type/id
- subject type/id
- resource type/id
- canonical facts/context
- correlation_id

Canonical DecisionResponse must include:
- evaluation_id
- decision: allow / deny / limit / select / calculated
- allowed boolean where relevant
- constraints_json
- computed_json
- reason_codes
- applied_rule_versions
- policy_set_version_id
- evaluated_at
- expires_at

rule_evaluations:
- id
- tenant_id
- policy_set_version_id
- subject_type
- subject_id
- resource_type
- resource_id
- effective_at
- input_hash
- input_snapshot_reference
- decision
- result_json
- reason_codes_json
- applied_rule_versions_json
- correlation_id
- latency_ms
- evaluated_at

High-volume evaluation details may be archived in ClickHouse/S3, but business-critical decisions retain a durable evaluation reference.

---

# 13. POLICY SNAPSHOTS FOR CONTROL/EDGE

Control plane and Edge must not perform a remote database lookup for every real-time command.

Policy Service publishes versioned signed snapshots:

~~~text
policy.snapshot.published
~~~

Snapshot fields:
- tenant_id
- scope
- policy_set_version_id
- rules_checksum
- valid_from
- valid_until
- compiled_constraints
- signature

Control Service caches snapshots in Valkey/in-memory.

Edge stores only locally required policy.

If central services are unavailable:
- use latest still-valid snapshot
- if expired, use safer fallback
- physical local safety always applies

---

# 14. RULE TESTING AND TENANT READINESS

rule_test_cases:
- id
- rule_version_id
- name
- input_json
- expected_json
- status
- created_at

Critical publish flow:

~~~text
draft
→ automated rule tests
→ shadow evaluation
→ approval
→ publish
→ affected tenant readiness re-evaluation
~~~

tenant_policy_readiness:
- id
- tenant_id
- policy_set_version_id
- status
- blocking_reasons_json
- warning_reasons_json
- evaluated_at
- evaluator_version
- created_at
- updated_at

Statuses:
- pending
- ready
- ready_with_warnings
- blocked
- superseded

When a new relevant policy is published, create a new readiness result for each affected tenant. Never reuse readiness from an older policy version.

---

# 15. RBAC DATA MODEL

permissions:
- id
- permission_key
- domain
- action
- description
- scope_type
- risk_level
- requires_mfa
- requires_step_up
- status
- created_at
- updated_at

roles:
- id
- tenant_id
- role_key
- name
- description
- scope_type
- is_system_role
- status
- created_at
- updated_at

role_permissions:
- id
- role_id
- permission_id
- effect
- condition_json
- valid_from
- valid_until
- created_at

memberships:
- id
- tenant_id
- user_id
- status
- valid_from
- valid_until
- invited_by
- created_at
- updated_at

Unique active membership:
- tenant_id + user_id

membership_roles:
- id
- membership_id
- role_id
- valid_from
- valid_until
- created_by
- created_at

The database must verify membership and role belong to the same tenant.

membership_permission_overrides:
- id
- membership_id
- permission_id
- effect
- condition_json
- reason
- valid_from
- valid_until
- created_by
- approved_by
- created_at

Use direct overrides sparingly and audit every override.

service_identities:
- id
- service_key
- name
- service_type
- status
- created_at
- updated_at

service_identity_tenant_grants:
- id
- service_identity_id
- tenant_id
- permission_id
- scope_json
- valid_from
- valid_until
- created_at

api_clients:
- id
- tenant_id
- name
- client_type
- client_id
- secret_hash
- status
- expires_at
- last_used_at
- created_by
- created_at
- updated_at

api_client_permissions:
- id
- api_client_id
- permission_id
- condition_json
- valid_from
- valid_until

---

# 16. DEFAULT RBAC ROLES

superadmin:
- platform break-glass/highest role
- full platform/cross-tenant access
- rule governance
- incident/audit
- MFA + step-up required
- not for daily operation

platform_admin:
- organizations
- tenants
- integrations
- platform configuration
- market actors
- provider health
- broad platform management
- no automatic break-glass secret/security ownership

tenant_admin:
- own tenant only
- members/users
- tenant roles
- customers
- sites
- assets
- integrations
- tariffs
- allowed feature flags/settings
- no implicit cross-tenant access

operator:
- operational dashboard
- asset read
- command history
- allowed device commands
- optimization
- incidents
- operational flex visibility
- no settlement approval by default

market_operator:
- portfolios
- availability
- bids
- commitments
- dispatch
- M&V
- high-risk market actions may require approval/step-up

finance:
- settlement
- reconciliation
- revenue allocation
- rewards
- ledger read
- no device control

settlement_approver:
- approve reconciliations/adjustments within configured limits
- cannot self-approve own adjustment when four-eyes is required

support:
- customer/site/asset read
- provider/integration health
- support-safe actions
- minimized PII
- no market commitment
- no ledger posting
- no rule publish

developer:
- API clients
- webhooks
- sandbox
- developer portal
- allowed integration config
- no production asset control by default

security_admin:
- security configuration
- access reviews
- break-glass management
- security/audit events
- separate from finance/market where possible

viewer:
- read-only within assigned tenant/domain

---

# 17. PERMISSION CATALOG

Minimum permission keys:

- tenants.read
- tenants.manage
- users.read
- users.invite
- users.manage
- roles.read
- roles.manage
- customers.read
- customers.write
- customers.export
- sites.read
- sites.write
- assets.read
- assets.write
- assets.control
- assets.emergency_control
- integrations.read
- integrations.manage
- prices.read
- tariffs.read
- tariffs.manage
- optimizer.read
- optimizer.run
- flex.read
- flex.manage
- flex.reserve
- flex.submit_bid
- flex.accept_commitment
- flex.dispatch
- flex.override_dispatch
- prequalification.read
- prequalification.manage
- settlement.read
- settlement.import
- settlement.reconcile
- settlement.approve
- ledger.read
- ledger.post
- ledger.adjust
- rewards.read
- rewards.manage
- rules.read
- rules.draft
- rules.bind
- rules.approve
- rules.publish
- api_clients.read
- api_clients.manage
- webhooks.read
- webhooks.manage
- audit.read
- audit.export
- incidents.read
- incidents.manage
- security.manage

Explicit deny wins over allow at the same or lower authorization scope.

---

# 18. AUTHORIZATION RPC/HELPERS

Create at minimum:

~~~sql
flexexa_is_tenant_member(p_tenant_id uuid) returns boolean
flexexa_has_role(p_tenant_id uuid, p_role_key text) returns boolean
flexexa_has_permission(p_tenant_id uuid, p_permission_key text) returns boolean
flexexa_effective_permissions(p_tenant_id uuid) returns setof text
flexexa_assert_permission(p_tenant_id uuid, p_permission_key text) returns void
flexexa_is_platform_admin() returns boolean
flexexa_is_superadmin() returns boolean
~~~

Resource-aware authorization:

~~~sql
flexexa_authorize(
  p_tenant_id uuid,
  p_permission_key text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_context jsonb default '{}'::jsonb
) returns jsonb
~~~

Return a canonical authorization decision with reason codes.

Security-definer functions must:
- set a fixed search_path
- avoid dynamic SQL unless safely parameterized
- never trust caller-provided user IDs
- use auth.uid()/validated service identity
- be tested against recursive RLS
- use least privilege

---

# 19. RLS

All exposed tenant tables have RLS.

Read access conceptually requires:
- row tenant_id
- active membership
- required permission

Writes additionally require:
- tenant ownership
- permission
- immutable ownership validation
- valid domain state transition

Client users may not modify tenant_id on an existing business row.

RLS is necessary but not sufficient for critical state changes. Critical writes go through transactional RPC/application service.

Supabase service_role is never exposed to frontend.

Normal services shall use distinct service identities and explicit scopes wherever possible instead of universal cross-tenant access.

---

# 20. RPC PRINCIPLE

Use RPC/stored procedures for business-critical atomic operations involving multiple rows/invariants.

Do not turn every simple read into RPC.

Every write RPC must:
1. identify authenticated actor
2. validate tenant
3. authorize permission
4. validate canonical input
5. acquire needed row/advisory locks
6. validate state transition
7. evaluate central policy/rules where applicable
8. execute atomically
9. write audit and transactional outbox event
10. return canonical response

---

# 21. REQUIRED RPCS

Identity/tenant:
- flexexa_create_membership
- flexexa_assign_role
- flexexa_revoke_role
- flexexa_set_permission_override

Customer/site/asset:
- flexexa_create_customer
- flexexa_create_site
- flexexa_create_metering_point
- flexexa_create_asset
- flexexa_link_asset_connection
- flexexa_move_asset_between_sites

Consent/preferences:
- flexexa_grant_consent
- flexexa_revoke_consent
- flexexa_set_charging_preferences

Commands:
- flexexa_request_asset_command
- flexexa_cancel_asset_command

Market actor relationships:
- flexexa_set_site_actor_relationship
- flexexa_close_site_actor_relationship

Flex reservations:
- flexexa_create_flex_reservation
- flexexa_release_flex_reservation

Commitments:
- flexexa_create_flex_commitment
- flexexa_accept_flex_commitment
- flexexa_cancel_flex_commitment

Dispatch:
- flexexa_record_dispatch
- flexexa_allocate_dispatch
- flexexa_acknowledge_dispatch
- flexexa_complete_dispatch

Measurement/verification:
- flexexa_record_delivery_measurement
- flexexa_finalize_delivery_verification

Settlement:
- flexexa_import_settlement_statement
- flexexa_reconcile_settlement
- flexexa_approve_settlement

Ledger:
- flexexa_post_ledger_transaction
- flexexa_post_ledger_adjustment

Rules:
- flexexa_create_rule_version
- flexexa_publish_rule_version
- flexexa_create_policy_set_version
- flexexa_publish_policy_set_version
- flexexa_bind_rule
- flexexa_evaluate_tenant_policy_readiness

All externally triggerable writes must support idempotency_key and correlation_id where relevant.

---

# 22. IDEMPOTENCY

idempotency_records:
- id
- tenant_id
- actor_type
- actor_id
- operation_key
- idempotency_key
- request_hash
- response_reference
- status
- created_at
- expires_at

Unique:
- tenant_id
- actor_type
- actor_id
- operation_key
- idempotency_key

Same key with a different request hash must fail with IDEMPOTENCY_CONFLICT.

---

# 23. STATE MACHINE REGISTRY

Centralize allowed transitions for:
- provider connection
- asset command
- charging plan
- flex reservation
- commitment
- dispatch
- prequalification
- settlement
- reconciliation
- reward
- consent
- incident
- rule version
- policy version

Example command lifecycle:

~~~text
requested
→ validated
→ queued
→ sent
→ acknowledged
→ executing
→ measurement_confirmed
→ completed

or failed / expired / cancelled
~~~

Invalid transitions fail server-side.

---

# 24. APPROVAL / FOUR-EYES

approval_requests:
- id
- tenant_id
- request_type
- resource_type
- resource_id
- requested_by
- required_approvals
- status
- expires_at
- created_at
- completed_at

approval_decisions:
- id
- approval_request_id
- decided_by
- decision
- reason
- created_at

Use where configured for:
- critical rule publication
- large market commitments
- settlement adjustments over threshold
- break-glass
- destructive tenant operations

The requester may not self-approve when policy requires four-eyes.

break_glass_sessions:
- id
- user_id
- reason
- scope_json
- approved_by
- starts_at
- expires_at
- status
- created_at

Break-glass requires:
- explicit reason
- short expiry
- MFA/step-up
- immutable audit
- alert
- post-use review

---

# 25. CANONICAL ERROR TAXONOMY

At minimum:
- TENANT_MISMATCH
- PERMISSION_DENIED
- POLICY_DENIED
- INVALID_STATE_TRANSITION
- CONSENT_REQUIRED
- ASSET_OFFLINE
- STALE_TELEMETRY
- CAPABILITY_UNSUPPORTED
- MOBILITY_GUARANTEE_BLOCK
- FLEX_ALREADY_RESERVED
- MARKET_INELIGIBLE
- PREQUALIFICATION_REQUIRED
- BSP_ROUTE_UNAVAILABLE
- SETTLEMENT_MISMATCH
- LEDGER_UNBALANCED
- PROVIDER_RATE_LIMITED
- IDEMPOTENCY_CONFLICT

Provider-specific errors are normalized before they reach external canonical APIs.

---

# 26. CONFIGURATION REGISTRY

Feature flags are not business rules.

Feature flags answer whether a feature is enabled.

Rules answer whether an action is allowed and how it is constrained/calculated.

configuration_definitions:
- id
- config_key
- domain
- schema_json
- scope_type
- sensitive
- status

configuration_versions:
- id
- configuration_definition_id
- version
- value_json
- checksum
- valid_from
- valid_until
- status
- created_by
- approved_by
- created_at

configuration_bindings:
- id
- tenant_id
- configuration_version_id
- scope_type
- scope_id
- priority
- valid_from
- valid_until

Examples:
- provider timeout
- retry count
- stale telemetry threshold
- reserve margin
- webhook retry policy
- forecast refresh interval

Secrets stay in AWS Secrets Manager.

---

# 27. READ MODELS

Create tenant-safe canonical read models/views as useful:
- v_effective_site_market_actors
- v_effective_asset_capabilities
- v_asset_market_eligibility
- v_asset_current_provider
- v_portfolio_remaining_capacity
- v_customer_effective_consents
- v_tenant_effective_permissions
- v_effective_rule_bindings

Do not force every service to rebuild the same complex joins.

---

# 28. CORE CLOUD STACK

Primary region:
- AWS eu-north-1 Stockholm

Use AWS for critical backend/control infrastructure.

ECS + Fargate services:
- api-gateway
- identity-service
- tenant-service
- asset-service
- connector-service
- control-service
- price-service
- tariff-service
- true-cost-service
- optimizer
- forecasting-service
- flexibility-service
- pool-service
- market-service
- bsp-gateway
- dispatch-service
- measurement-service
- baseline-service
- verification-service
- settlement-service
- revenue-service
- ledger-service
- prequalification-service
- compliance-service
- policy-service
- webhook-service
- notification-service
- worker-service
- simulator-service
- CitrineOS

Do not split simple CRUD unnecessarily; bounded contexts may share deployment early if the domain boundary remains explicit.

Use:
- ECR for images
- VPC
- private app/data subnets
- Secrets Manager
- KMS
- S3
- WAF
- IAM least privilege

Container images:
- versioned
- scanned
- SBOM generated
- signed where practical
- no mutable latest reference in production

---

# 29. DATA PLANE

PostgreSQL/Supabase:
- transactional source of truth
- Auth
- RLS
- business data
- tenant/RBAC
- settlement and ledger
- smaller business documents where appropriate

ClickHouse:
- high-volume telemetry
- power
- SOC history
- meter values
- voltage/current
- state history
- optimization analytics
- flex response
- command latency
- energy flow

S3:
- raw events
- market payloads
- settlement files
- immutable audit exports
- tariff imports
- telemetry archive
- replay datasets
- firmware
- compliance artifacts
- large exports/backups

Valkey:
- device shadow hot cache
- connection presence
- distributed locks
- rate limits
- idempotency hot cache
- command locks
- short-lived state
- provider limits
- cached policy snapshots
- cached schedules

Valkey is never system of record.

---

# 30. CLICKHOUSE TELEMETRY SCHEMA

Minimum fields:
- tenant_id
- organization_id where required
- site_id
- asset_id
- provider_id
- event_time
- ingested_at
- metric
- value_float
- value_string
- value_bool
- unit
- source
- quality
- sequence_number
- correlation_id
- tags

Use pseudonymous asset IDs where possible.

Create materialized views later for:
- power
- SOC
- meter energy
- voltage
- current
- charger status
- flex response

---

# 31. MESSAGE BUS / EVENTS

Use RabbitMQ, initially Amazon MQ for RabbitMQ.

Canonical event envelope:
- event_id
- event_type
- event_version
- occurred_at
- received_at
- tenant_id
- organization_id where needed
- correlation_id
- causation_id
- source
- payload

Minimum events:
- asset.connected
- asset.disconnected
- asset.state.updated
- telemetry.received
- vehicle.connected
- vehicle.disconnected
- price.updated
- tariff.updated
- optimization.requested
- optimization.started
- optimization.completed
- optimization.failed
- plan.created
- plan.activated
- plan.invalidated
- command.requested
- command.sent
- command.acknowledged
- command.completed
- command.failed
- command.expired
- flex.availability.updated
- flex.reservation.created
- flex.reservation.released
- flex.commitment.created
- flex.commitment.accepted
- flex.dispatch.received
- flex.dispatch.acknowledged
- flex.delivery.completed
- settlement.statement.received
- settlement.reconciled
- settlement.completed
- reward.created
- incident.created
- provider.health.changed
- rule.version.published
- policy.version.published
- policy.binding.changed
- configuration.version.published
- policy.snapshot.published

All consumers must be idempotent.

Use:
- transactional outbox
- inbox/deduplication
- retries
- dead-letter queues
- event versioning

---

# 32. ORGANIZATIONS / TENANTS / WHITE-LABEL — FIELD FOR FIELD

organizations:
- id
- name
- slug
- organization_number
- vat_number
- organization_type
- country_code
- timezone
- currency
- status
- created_at
- updated_at

organization_type:
- platform
- retailer
- charger_oem
- vehicle_oem
- aggregator
- bsp
- brp
- dso
- tso
- energy_service_provider
- fleet
- partner

tenants:
- id
- organization_id
- brand_id
- name
- slug
- country_code
- default_market_area_id
- status
- created_at
- updated_at

brands:
- id
- organization_id
- name
- slug
- logo_light_url
- logo_dark_url
- primary_color
- secondary_color
- accent_color
- font_family
- favicon_url
- support_name
- support_email
- support_phone
- default_locale
- default_currency
- default_timezone
- terms_url
- privacy_url
- created_at
- updated_at

brand_domains:
- id
- brand_id
- hostname
- type
- verification_status
- verification_token
- is_primary
- created_at
- verified_at

feature_flags:
- id
- tenant_id
- feature_key
- enabled
- configuration_json
- valid_from
- valid_until

Feature examples:
- smart_charging
- true_cost
- flex_rewards
- solar
- battery
- v2g
- vehicle_integration
- native_app

---

# 33. CUSTOMERS / SITES / METERING POINTS

customers:
- id
- tenant_id
- external_customer_id
- customer_type
- first_name
- last_name
- company_name
- organization_number
- email
- phone
- locale
- timezone
- status
- created_at
- updated_at

sites:
- id
- tenant_id
- customer_id
- name
- address_line_1
- address_line_2
- postal_code
- city
- country_code
- latitude
- longitude
- timezone
- market_area_id
- main_fuse_amps
- phase_count
- max_import_kw
- max_export_kw
- status
- created_at
- updated_at

metering_points:
- id
- tenant_id
- site_id
- external_metering_point_id
- metering_point_type
- grid_area_code
- market_area_id
- measurement_resolution_minutes
- import_enabled
- export_enabled
- status
- valid_from
- valid_until

---

# 34. MARKET ACTORS AND TEMPORAL SITE RELATIONSHIPS

market_actors are separate from SaaS organizations.

market_actors:
- id
- name
- actor_type
- organization_number
- eic_code
- gln
- ediel_id
- country_code
- external_identifiers_json
- status
- valid_from
- valid_until
- created_at
- updated_at

actor_type:
- retailer
- brp
- bsp
- aggregator
- dso
- tso
- market_operator
- oem

market_actor_relationships:
- id
- from_actor_id
- to_actor_id
- relationship_type
- market_area_id
- product_id
- contract_reference
- configuration_json
- valid_from
- valid_until
- status
- created_at
- updated_at

site_actor_relationships:
- id
- tenant_id
- site_id
- metering_point_id
- market_actor_id
- role
- contract_reference
- valid_from
- valid_until
- source
- verified_at
- created_at

role:
- retailer
- brp
- bsp
- aggregator
- dso

The system must answer historically which retailer, BRP, BSP, DSO and aggregator relationship applied at an exact timestamp.

Temporal validity must never be simplified away.

---

# 35. ASSETS

assets:
- id
- tenant_id
- site_id
- customer_id
- asset_type
- manufacturer
- model
- serial_number
- external_id
- rated_power_kw
- status
- commissioned_at
- decommissioned_at
- created_at
- updated_at

asset_type:
- ev
- evse
- battery
- solar_inverter
- meter
- heat_pump
- hems
- hvac
- industrial_load
- generator
- other_der
- other_flexible_load

Flexexa must not be designed only around EVs. EV is the first resource type.

asset_capabilities:
- id
- tenant_id
- asset_id
- capability
- min_value
- max_value
- unit
- metadata_json
- source
- verified_at

Capability examples:
- read_soc
- start_charge
- stop_charge
- set_power_limit
- set_current_limit
- schedule_charge
- read_power
- read_energy
- battery_charge
- battery_discharge
- export_to_grid
- solar_read
- v1g
- v2g
- v2h

Operational capability fields must support:
- max_import_kw
- max_export_kw
- current_power_kw
- min_soc
- max_soc
- current_soc
- battery_capacity_kwh
- charge_efficiency
- discharge_efficiency
- response_latency_ms
- ramp_rate_kw_s
- availability_from
- availability_until
- required_departure_time
- required_departure_soc
- supports_fcr_n
- supports_fcr_d_up
- supports_fcr_d_down
- supports_afrr_up
- supports_afrr_down
- supports_mfrr_up
- supports_mfrr_down

Capabilities are dynamic. Never assume every device model has identical capabilities.

---

# 36. FLEXEXA CONNECT

Build a canonical connectivity layer so Flexexa can gradually become its own Enode-like platform.

Provider interfaces:
- VehicleProvider
- ChargerProvider
- BatteryProvider
- SolarProvider
- MeterProvider
- HVACProvider

Every provider shall implement:
- authenticate()
- refreshAuthentication()
- discoverAssets()
- getAsset()
- getState()
- getCapabilities()
- executeCommand()
- subscribeWebhooks()
- handleWebhook()
- normalizeState()
- healthCheck()

integration_providers:
- id
- key
- name
- provider_type
- status
- supports_oauth
- supports_webhook
- supports_polling
- rate_limit_config_json
- capabilities_json
- created_at
- updated_at

Providers initially/roadmap:
- ocpp
- enode
- tesla
- volvo
- bmw
- mercedes
- vw
- polestar
- kia
- hyundai
- solaredge
- sunspec
- eltariff
- elprisetjustnu
- nordpool
- smhi
- bsp_partner
- dso_market

provider_accounts:
- id
- tenant_id
- provider_id
- external_account_id
- credential_reference
- connection_status
- token_expires_at
- last_success_at
- last_error_at
- created_at
- updated_at

Secrets are not stored here.

asset_connections:
- id
- tenant_id
- asset_id
- provider_account_id
- external_asset_id
- connection_type
- status
- priority
- capabilities_json
- last_sync_at
- last_seen_at
- valid_from
- valid_until

An asset may have multiple providers. Priority + health determines active provider.

Other services never call Enode/Tesla/OCPP directly. They call Flexexa canonical asset APIs.

---

# 37. CANONICAL DEVICE STATES

Canonical EV state:
- soc_percent
- charge_limit_percent
- plugged_in
- charging_state
- estimated_range_km
- battery_capacity_kwh
- charge_power_kw
- location
- updated_at

Canonical EVSE:
- online
- connector_status
- transaction_active
- current_a
- power_kw
- energy_kwh
- max_power_kw
- max_current_a
- phase_count
- updated_at

Canonical battery:
- soc_percent
- charge_power_kw
- discharge_power_kw
- capacity_kwh
- available_charge_kw
- available_discharge_kw
- operating_mode

Canonical solar:
- generation_kw
- energy_today_kwh
- export_kw

Canonical meter:
- import_power_kw
- export_power_kw
- import_energy_kwh
- export_energy_kwh
- phase_1_current_a
- phase_2_current_a
- phase_3_current_a
- voltage_l1
- voltage_l2
- voltage_l3
- timestamp
- quality

Meter sources:
- HAN/P1
- Modbus
- charger/load balancer
- later DSO cloud
- retailer meter data
- authorized third-party access

---

# 38. OCPP / CITRINEOS / EDGE

Support:
- OCPP 1.6J
- OCPP 2.0.1
- design for OCPP 2.1

Use CitrineOS as separate bounded-context CSMS.

CitrineOS owns:
- OCPP WebSockets
- schemas
- protocol messages
- charger connectivity
- transactions
- meter messages
- OCPP commands

Flexexa owns:
- customers
- assets
- tariffs
- optimizer
- policies
- flex
- dispatch
- settlement
- rewards

Use EVerest for future Flexexa Edge:
- local schedule execution
- offline plan
- local load balancing
- fuse limits
- charge-current control
- pause/resume
- local failsafe
- command validation
- device health
- cached policy
- cached charging schedule
- ISO 15118/IEC 61851/V2G evolution

Cloud may never override:
- cable rating
- charger rating
- fuse rating
- phase constraints
- local safety
- vehicle constraints

No LLM in real-time electrical control.

---

# 39. DEVICE SHADOW AND COMMANDS

asset_shadows:
- tenant_id
- asset_id
- reported_state_json
- desired_state_json
- reported_at
- desired_at
- state_version
- last_command_id
- updated_at

Always separate desired from verified reported state.

asset_commands:
- id
- tenant_id
- asset_id
- command_type
- requested_payload_json
- reason
- requested_by_type
- requested_by_id
- correlation_id
- idempotency_key
- requested_at
- expires_at
- status
- provider_id
- sent_at
- acknowledged_at
- completed_at
- failed_at
- failure_code
- failure_message

Reasons:
- customer_manual
- price_optimization
- grid_tariff
- load_balancing
- flex_activation
- emergency
- system_recovery

Default command priority:
1. electrical safety
2. emergency/local protection
3. explicit customer override
4. mobility guarantee
5. committed flexibility
6. site constraints
7. tariff optimization
8. spot optimization

Priority policy is versioned/configurable through central Rules Layer.

---

# 40. PRICES

V1 source:
- elprisetjustnu

Fetch SE1/SE2/SE3/SE4 and supported 15-minute intervals.

PriceProvider interface.

Implement:
- ElprisetJustNuProvider
- later NordPoolPriceProvider

price_sources:
- id
- provider
- market_area_id
- priority
- currency
- unit
- resolution_minutes
- status
- valid_from
- valid_until

electricity_prices:
- id
- source_id
- market_area_id
- starts_at
- ends_at
- resolution_minutes
- price
- currency
- unit
- quality
- published_at
- ingested_at

Unique:
- source_id + market_area_id + starts_at

Price provenance:
- provider
- retrieved_at
- published_at
- quality
- is_final
- fallback_used
- original_payload_hash

Optimizer may not silently use stale/missing prices.

Later:
- Nord Pool primary when correct commercial license exists
- Elprisetjustnu fallback/comparison/development
- ENTSO-E/other sources only according to licensing/technical suitability

---

# 41. MARKET AREAS

market_areas:
- id
- country_code
- code
- name
- timezone
- currency
- valid_from
- valid_until

Initial:
- SE1
- SE2
- SE3
- SE4

Design for other countries through Country Packs.

---

# 42. GRID / RETAILER TARIFFS / TAX

Initial tariff providers:
- RISE Eltariff
- Sourceful where appropriate
- manual versioned tariff
- direct DSO APIs

GridTariffProvider interface.

grid_tariffs:
- id
- dso_actor_id
- external_tariff_id
- name
- product_code
- customer_segment
- fuse_min
- fuse_max
- valid_from
- valid_until
- timezone
- source
- source_version
- status
- created_at
- updated_at

grid_tariff_components:
- id
- grid_tariff_id
- component_type
- price
- currency
- unit
- vat_included
- valid_from
- valid_until
- start_time
- end_time
- weekdays_json
- months_json
- calculation_method
- aggregation_period_minutes
- peak_count
- metadata_json

component_type:
- fixed
- energy
- power
- peak
- time_of_use
- seasonal
- reactive
- other

site_tariff_assignments:
- id
- tenant_id
- site_id
- grid_tariff_id
- valid_from
- valid_until
- source
- verified_at

Create equivalent:
- retailer_tariffs
- retailer_tariff_components
- site_retailer_tariff_assignments

Support:
- markup
- fixed monthly fee
- dynamic price
- customer discount
- EV bonus
- charging incentive

tax_rules:
- id
- country_code
- region
- tax_type
- value
- unit
- valid_from
- valid_until
- conditions_json

Tariff/tax rules are versioned data/rules, not hardcoded optimizer logic.

---

# 43. TRUE COST

true-cost-service input:
- site
- interval
- energy_kwh
- power_kw
- spot
- retailer tariff
- grid tariff
- tax
- solar
- current monthly peak state

Calculate:
- energy_market_cost
- retailer_cost
- grid_energy_cost
- grid_power_cost_increment
- tax_cost
- vat
- estimated_total_cost
- marginal_cost

Total optimization considers:
spot
+ retailer markup
+ energy tax
+ VAT
+ grid transfer
+ time tariff
+ power/peak fee
+ estimated peak impact
+ other tariff components
- solar value
- flex value

---

# 44. CUSTOMER CHARGING PREFERENCES

charging_preferences:
- id
- tenant_id
- customer_id
- site_id
- asset_id
- enabled
- departure_time_local
- target_soc_percent
- minimum_soc_percent
- minimum_energy_kwh
- priority_mode
- allow_flex
- allow_remote_pause
- minimum_emergency_soc
- max_charge_power_kw
- valid_from
- valid_until
- updated_at

priority_mode:
- lowest_total_cost
- balanced
- fastest
- solar_first
- flex_first
- manual

---

# 45. OPTIMIZER

Separate Python service.

Use open-source mathematical optimization:
- HiGHS
- OR-Tools where suitable

Use LP/MILP.

No LLM creates charging plans.

Objective:
minimize
- energy cost
- retailer cost
- grid tariff
- incremental peak cost
- battery degradation
- customer inconvenience

minus:
- solar value
- expected flex value

Constraints:
- target SOC before departure
- minimum SOC
- charger power
- vehicle power
- site fuse
- phases
- battery constraints
- existing flex commitments
- local safety
- asset availability/capability

optimization_runs:
- id
- tenant_id
- site_id
- reason
- requested_at
- started_at
- completed_at
- input_snapshot_json
- optimizer_version
- policy_version
- status
- objective_value
- failure_code

charging_plans:
- id
- tenant_id
- optimization_run_id
- site_id
- asset_id
- valid_from
- valid_until
- status
- required_energy_kwh
- target_soc_percent
- departure_at
- estimated_cost
- baseline_cost
- estimated_savings
- created_at
- activated_at

charging_plan_intervals:
- id
- tenant_id
- charging_plan_id
- starts_at
- ends_at
- target_power_kw
- max_current_a
- mode
- expected_energy_kwh
- expected_cost
- flex_reserved_kw

Reoptimize on:
- plug/unplug
- material SOC change
- departure change
- price update
- tariff update
- household load change
- flex commitment
- flex dispatch
- solar forecast change
- command failure
- provider failure
- asset disconnect
- customer/emergency override

---

# 46. WEATHER / FORECASTING / SOLAR / BATTERY

Weather source:
- SMHI Open Data

Use for:
- solar forecast
- load forecast
- heat-pump forecast

V1 forecasting inputs:
- historical usage
- weekday
- time
- temperature
- weather
- historical charging
- SOC
- departure behavior
- spot price
- historical flexibility

Forecast:
- household_load
- solar_generation
- plug_in_probability
- departure_probability
- ev_energy_requirement
- available_flexibility

Capacity confidence:
- P50
- P80
- P90
- P95

Market Engine may use P95-safe capacity.

Start simple; build datasets for later ML without redesign.

Solar/battery adapters:
- Enode initially
- direct OEM later
- SunSpec
- Modbus TCP
- EEBUS later

---

# 47. FLEXIBILITY ENGINE

Continuously calculate:
- available_up_kw
- available_down_kw
- safe_up_kw
- safe_down_kw
- confidence_score
- available_duration
- energy_headroom

The result must respect:
- SOC
- departure requirement
- charge limits
- customer preferences
- market commitments
- device health
- provider health
- telemetry freshness
- safety rules

Physical flexibility must be traceable:

~~~text
physical asset
→ site
→ metering point
→ market area
→ DSO
→ retailer
→ BRP
→ BSP
→ portfolio
→ product
→ commitment
→ dispatch
→ measurement
→ settlement
~~~

---

# 48. FLEX MARKETS AND PRODUCTS

flex_market_providers:
- id
- name
- provider_type
- country_code
- api_type
- status
- configuration_json
- valid_from
- valid_until

provider_type:
- bsp
- tso
- dso
- flex_marketplace
- bilateral
- internal

flex_products:
- id
- provider_id
- external_product_id
- name
- product_type
- direction
- minimum_power_kw
- minimum_duration_seconds
- response_time_seconds
- delivery_resolution_seconds
- availability_payment_supported
- activation_payment_supported
- location_constraint_type
- prequalification_required
- rules_json
- valid_from
- valid_until

Products:
- fcr_n
- fcr_d_up
- fcr_d_down
- afrr_up
- afrr_down
- mfrr_up
- mfrr_down
- local_capacity
- local_activation
- ffr where relevant
- congestion
- bilateral
- internal_portfolio
- future_market

Market products are data/configuration, not hardcoded code branches.

---

# 49. PREQUALIFICATION / ELIGIBILITY

flex_prequalifications:
- id
- tenant_id
- asset_id
- portfolio_id
- product_id
- qualification_status
- approved_up_kw
- approved_down_kw
- direction
- measurement_method
- baseline_method
- test_results_json
- document_reference
- valid_from
- valid_until
- verified_at
- created_at
- updated_at

System must distinguish:
- technically_available
- market_eligible
- commercially_available

Eligibility checks:
- online
- controllable
- customer consent
- correct BSP
- correct BRP
- correct DSO
- correct market area
- geography
- retailer/partner agreement
- no conflicting commitment
- SOC/departure slack
- measurement quality
- prequalification
- response capability
- provider/device health

Save eligibility result and version.

---

# 50. PORTFOLIOS / POOL ENGINE

flex_portfolios:
- id
- tenant_id
- name
- market_provider_id
- flex_product_id
- market_area_id
- bsp_actor_id
- brp_actor_id
- currency
- status
- valid_from
- valid_until

flex_portfolio_memberships:
- id
- tenant_id
- portfolio_id
- asset_id
- site_id
- valid_from
- valid_until
- max_up_kw
- max_down_kw
- prequalified
- eligibility_status
- eligibility_reason
- created_at

Pool formation:
assets
→ eligibility
→ availability
→ risk
→ geography
→ BRP/BSP
→ market
→ pool

Always use reserve/safety margin.

Example:
- nominal 2.4 MW
- safe 1.8 MW
- bid 1.5 MW
- reserve 0.3 MW

Do not bid 100% of naive available capacity.

---

# 51. AVAILABILITY AND RESERVATION LEDGER

flex_availability_snapshots:
- id
- tenant_id
- asset_id
- portfolio_id
- timestamp
- available_up_kw
- available_down_kw
- available_energy_up_kwh
- available_energy_down_kwh
- earliest_start
- latest_end
- confidence
- reason_json
- calculation_version

flex_reservations:
- id
- tenant_id
- asset_id
- portfolio_id
- commitment_id
- starts_at
- ends_at
- reserved_up_kw
- reserved_down_kw
- priority
- status
- created_at

Before reservation:

~~~text
physical availability
- overlapping existing reservations
= remaining capacity
~~~

Reservation must be atomic under concurrency using row/advisory locks.

It must be impossible to double-sell the same physical capacity.

---

# 52. FLEX OPPORTUNITIES / MARKET OPTIMIZER

flex_opportunities:
- id
- provider_id
- product_id
- market_area_id
- starts_at
- ends_at
- direction
- requested_power_kw
- capacity_price
- activation_price
- currency
- location_constraint_json
- source_payload_reference
- status

Market Optimizer compares risk-adjusted value across:
- smart/spot charging
- FCR
- aFRR
- mFRR
- local DSO flex
- internal portfolio optimization
- bilateral flexibility

Later allow stacking only when rules permit and commitment ledger proves no double counting.

---

# 53. COMMITMENTS / DISPATCH

flex_commitments:
- id
- tenant_id
- portfolio_id
- external_bid_id
- external_commitment_id
- product_id
- starts_at
- ends_at
- direction
- committed_power_kw
- capacity_price
- status
- submitted_at
- accepted_at
- rejected_at
- source
- policy_set_version_id
- eligibility_evaluation_id

flex_dispatches:
- id
- tenant_id
- commitment_id
- external_dispatch_id
- requested_at
- starts_at
- ends_at
- direction
- requested_power_kw
- status
- received_at
- acknowledged_at
- completed_at

flex_dispatch_allocations:
- id
- tenant_id
- dispatch_id
- asset_id
- target_delta_kw
- baseline_power_kw
- target_power_kw
- command_id
- status
- started_at
- completed_at

BSP sends pool activation; BSP does not choose devices.

Dispatch Engine selects assets based on:
- SOC
- mobility
- charger limits
- connectivity
- latency
- device health
- provider health
- prior activation
- fairness
- battery degradation
- reserve capacity

Dispatch may select different assets from those used during forecasting.

---

# 54. AUTOMATIC REDISPATCH / CONTROL REDUNDANCY

Activation must not depend on one control path.

Support:
- command timeout
- device ACK
- execution state
- measurement confirmation
- fallback control
- automatic reserve redispatch

Example:
- activation 500 kW
- command 520 kW
- failures 40 kW
- redispatch +40 kW
- actual 503 kW

Control plane is separate from Next.js/web frontend.

Internal endpoint concept:
- control.flexexa.internal

---

# 55. BSP PROVIDER ABSTRACTION

Create BspProvider interface with the union of capabilities needed across partners:

- getProducts()
- getPortfolioRequirements()
- registerResource()
- updateResource()
- submitAvailability()
- withdrawAvailability()
- submitCapacity()
- updateCapacity()
- submitBid()
- updateBid()
- cancelBid()
- receiveActivation()
- receiveDispatch()
- acknowledgeActivation()
- acknowledgeDispatch()
- sendTelemetry()
- submitDeliveredEnergy()
- getMarketResult()
- getMarketResults()
- getSettlement()
- getSettlementStatements()
- reportIncident()

Adapters:
- PartnerAAdapter
- PartnerBAdapter
- PartnerCAdapter
- MockBspAdapter
- FlexexaDirectBspAdapter

Market Engine must never depend on a specific partner.

---

# 56. BSP TRANSPORTS / PARTNER API

Support adapters for:
- REST/JSON
- webhooks
- WebSocket
- MQTT
- AMQP
- SFTP
- CSV
- Excel
- XML
- CIM XML
- EDIFACT
- legacy file/email where required
- ECP later

Preferred modern integration:
- REST
- webhooks
- OAuth2 client_credentials
- mTLS
- signed payloads
- timestamps
- nonce
- replay protection
- idempotency
- rate limiting
- schema validation

Canonical BSP endpoints include:
- POST /bsp/v1/availability
- POST /bsp/v1/commitments
- POST /v1/activations
- POST /bsp/v1/deliveries

BSP should normally see:
- pool
- market
- capacity
- availability
- delivery
- measurement identifiers
- settlement identifiers

BSP should not automatically receive:
- customer names
- VIN
- GPS
- unnecessary personal data
- unnecessary raw device telemetry

Flexexa keeps customer and device control.

---

# 57. BSP SANDBOX

Build MockBspAdapter early.

Simulate:
- accepted bid
- rejected bid
- partial acceptance
- activation
- partial activation
- duplicate activation
- timeout
- network loss
- malformed message
- delayed market result
- settlement
- penalty
- correction

Flexexa must be able to build/test the whole BSP flow before a commercial BSP contract exists.

---

# 58. FUTURE DIRECT BSP READINESS

Domain interface must support later:

~~~text
Market Engine
→ Flexexa BSP Gateway
   → CIM encoder/decoder
   → ECP client
   → Nordic MMS adapter
   → EDIFACT adapter where required
   → Market ACK engine
→ TSO/market infrastructure
~~~

Do not activate full direct market integration before:
- correct BSP role
- agreements
- prequalification
- technical certification
- certificates/security
- market requirements

Flexexa still does not become BRP.

---

# 59. BRP IMPACT & COMPENSATION

Create dedicated BRP-aware domain.

brp_impact_calculations:
- id
- tenant_id
- dispatch_id
- asset_id
- site_id
- metering_point_id
- brp_actor_id
- retailer_actor_id
- baseline_energy_kwh
- actual_energy_kwh
- flex_delta_kwh
- imbalance_adjustment_kwh
- compensation_amount
- currency
- calculation_method
- calculation_version
- status
- created_at

Rules are versioned.

System must support flexibility across multiple BRP portfolios only when market rules allow it and attribution remains correct.

---

# 60. CROSS-RETAILER / CROSS-BSP / CROSS-DSO

Cross-retailer:
- allowed only after consent, agreements, BRP/BSP/DSO/market checks
- settlement returns to actual asset/site/customer/retailer contribution

Cross-BSP:
- assets from different BSPs are not automatically mixed in one market portfolio
- flex_portfolios.bsp_actor_id is explicit
- future exceptions are explicit configuration, never hidden code special cases

Cross-DSO:
- local products segment by correct geographic/network area
- use metering point, DSO, grid area and location constraints

---

# 61. MEASUREMENT, BASELINE AND VERIFICATION

flex_delivery_measurements:
- id
- tenant_id
- dispatch_id
- asset_id
- interval_start
- interval_end
- baseline_kw
- actual_kw
- delivered_up_kw
- delivered_down_kw
- energy_delta_kwh
- measurement_source
- quality
- method_version

Per-asset delivery accounting must support:
- requested_power
- delivered_power
- duration
- availability
- response_time
- quality
- baseline
- actual_consumption
- counterfactual_consumption
- delivered_flexibility
- revenue
- penalty
- customer_share
- flexexa_share
- bsp_share
- retailer_share

Baseline method is versioned.

Store policy/rule/optimizer/baseline versions used for important market events.

---

# 62. SETTLEMENT SOURCES AND ADAPTER

SettlementProviderAdapter supports:
- BSP
- DSO
- local flex market
- marketplace
- future direct TSO
- bilateral partner

Transports:
- REST
- webhook
- CSV
- Excel
- JSON
- SFTP
- XML
- EDIFACT
- market-specific files

settlement_statements:
- id
- tenant_id where ownership applies
- provider_id
- external_statement_id
- period_start
- period_end
- currency
- gross_amount
- status
- received_at
- source_file_reference
- source_hash
- created_at

Unique:
- provider_id + external_statement_id

settlement_statement_lines:
- id
- statement_id
- external_line_id
- commitment_id
- dispatch_id
- portfolio_id
- product_id
- market_area_id
- payment_type
- quantity
- quantity_unit
- unit_price
- amount
- currency
- starts_at
- ends_at
- metadata_json

payment_type:
- capacity
- availability
- activation
- energy
- bonus
- penalty
- adjustment
- fee

---

# 63. REVENUE ALLOCATION

Settlement must be per contributing asset/site, not merely per tenant.

Flow:

~~~text
external settlement
→ portfolio
→ dispatch
→ verified physical contribution
→ asset
→ site
→ customer / retailer / OEM / BSP / Flexexa
~~~

Settlement engine must support:
- BSP fee
- Flexexa fee
- BRP compensation
- DSO/network adjustments
- penalties
- retailer share
- OEM/asset-owner share
- customer reward

revenue_share_agreements:
- id
- tenant_id
- counterparty_actor_id
- scope_type
- scope_id
- calculation_type
- customer_share
- retailer_share
- oem_share
- bsp_share
- flexexa_share
- configuration_json
- valid_from
- valid_until
- version
- status

calculation_type:
- percentage
- fixed_per_kw
- fixed_per_kwh
- fixed_per_asset
- tiered
- custom

---

# 64. DOUBLE-ENTRY LEDGER

ledger_accounts:
- id
- owner_type
- owner_id
- account_type
- currency
- status

ledger_transactions:
- id
- transaction_type
- reference_type
- reference_id
- occurred_at
- description
- status

ledger_entries:
- id
- transaction_id
- account_id
- direction
- amount
- currency
- metadata_json

Every transaction must satisfy:
- debits = credits

Never use Stripe as the flex/energy settlement ledger.

Stripe may later be used for SaaS billing only.

customer_reward_entries:
- id
- tenant_id
- customer_id
- site_id
- asset_id
- settlement_line_id
- reward_type
- amount
- currency
- period_start
- period_end
- status
- ledger_transaction_id
- created_at

Separate:
- smart charging savings
- grid tariff savings
- solar savings
- flex rewards

Modeled savings are not market revenue.

---

# 65. SETTLEMENT RECONCILIATION

Compare:
- expected_market_revenue
- actual_market_statement
- difference

Statuses:
- unmatched
- matched
- partially_matched
- disputed
- adjusted
- closed

Detect:
- missing dispatch
- wrong quantity
- price difference
- missing assets
- BSP fee mismatch
- DSO mismatch
- duplicate statement
- currency mismatch

Historical reprocessing must explicitly record that a new calculation version was used. Never silently apply today's rule version to old events.

---

# 66. CONSENT

consents:
- id
- tenant_id
- customer_id
- site_id
- asset_id
- consent_type
- status
- policy_version
- granted_at
- revoked_at
- source
- evidence_json

Separate consent for:
- smart charging
- remote control
- flex participation
- data sharing
- vehicle API
- location where relevant
- market participation

Manual customer Charge Now:
- audit override
- release affected flex capacity
- reoptimize
- respect physical safety
- update market availability

---

# 67. EXTERNAL API

Base:
- https://api.flexexa.com/v1

Minimum endpoints:
- /v1/customers
- /v1/sites
- /v1/metering-points
- /v1/assets
- /v1/assets/{id}
- /v1/assets/{id}/state
- /v1/assets/{id}/capabilities
- /v1/assets/{id}/commands
- /v1/prices
- /v1/tariffs
- /v1/true-cost
- /v1/charging/preferences
- /v1/charging/plans
- /v1/optimization/runs
- /v1/flex/portfolios
- /v1/flex/availability
- /v1/flex/commitments
- /v1/flex/dispatches
- /v1/settlements
- /v1/rewards
- /v1/savings

API requirements:
- stable IDs
- OpenAPI
- versioned API
- pagination
- cursor pagination for large sets
- filtering
- request IDs
- idempotency
- rate limits

Breaking changes go to /v2.

---

# 68. API AUTH / WEBHOOKS / SDK

B2B auth:
- OAuth2 client credentials

Sensitive partner integration:
- mTLS

Pilot:
- scoped API keys

API keys:
- shown only at creation
- hash stored
- scopes
- expiry
- rotation
- revocation
- rate limits

Webhook events include:
- asset.connected
- asset.disconnected
- asset.state.updated
- charging.started
- charging.stopped
- charging.plan.updated
- optimization.completed
- flex.available
- flex.commitment.created
- flex.dispatch.received
- flex.dispatch.completed
- settlement.completed
- reward.created

Webhook envelope:
- event_id
- event_type
- event_version
- created_at
- tenant_id
- data

Use:
- HMAC signing
- timestamp
- retry
- exponential backoff
- dead-letter
- replay protection

TypeScript SDK:
- @flexexa/sdk

Functions:
- getVehicle()
- getChargingPlan()
- setDepartureTime()
- setTargetSoc()
- enableSmartCharging()
- chargeNow()
- getSavings()
- getFlexRewards()

Later:
- Swift
- Kotlin
- brandable UI SDK components

---

# 69. FRONTEND / PORTALS

Use Next.js App Router on Vercel for:
- marketing
- partner portal
- superadmin
- developer portal
- customer web/PWA

Do not build native consumer app first.

Later use React Native + Expo as reference/white-label app.

Partner dashboard:
- connected assets
- online chargers
- active charging
- optimized energy
- customer savings
- available flexibility
- committed flexibility
- delivered flexibility
- flex revenue
- customer rewards
- provider health

Partner customer management:
- customers
- sites
- assets
- integrations
- tariffs
- preferences
- consent
- commands
- errors
- eligibility

Flex dashboard:
- physical availability
- predicted availability
- safe availability
- reserved capacity
- commitments
- dispatches
- delivery performance
- market revenue
- penalties
- settlement
- reconciliation
- customer allocation

Superadmin:
- organizations
- tenants
- brands
- countries
- integrations
- providers
- provider health
- customers/assets/sites
- tariffs
- market actors
- BSP/BRP/DSO
- portfolios
- flex products
- prequalification
- settlement
- ledger
- rules/policies
- feature flags
- API clients
- webhooks
- audit
- incidents

Customer PWA:
- Smart Charging ON/OFF
- vehicle status
- target SOC
- ready-by time
- estimated charging cost
- estimated savings
- flex rewards
- Charge Now

Customer should not need to understand FCR, BSP, BRP or tariff-engine internals.

---

# 70. AUDIT / PROVENANCE

audit_events:
- id
- tenant_id
- actor_type
- actor_id
- action
- resource_type
- resource_id
- occurred_at
- ip
- user_agent
- correlation_id
- metadata_json

Export immutable audit to S3.

Critical market/control actions additionally store:
- who
- what
- when
- source
- payload_hash
- policy/rule decision
- result

Canonical provenance fields where relevant:
- source_type
- source_provider_id
- source_external_id
- source_timestamp
- ingested_at
- quality
- schema_version
- raw_payload_reference
- raw_payload_hash

The platform must distinguish:
- provider-reported fact
- Flexexa-derived fact
- customer preference
- market-confirmed fact

---

# 71. SECURITY

Requirements:
- TLS everywhere
- mTLS where appropriate
- OAuth2/OIDC
- strict RLS
- tenant isolation
- least-privilege IAM
- Secrets Manager
- KMS
- WAF
- rate limiting
- request/schema validation
- dependency scanning
- vulnerability scanning
- container scanning
- SBOM
- signed containers where practical
- certificate rotation
- signed commands where Edge supports it
- signed firmware
- secure boot later
- TPM/secure element where hardware supports it
- nonce/timestamp/replay protection
- idempotency
- step-up auth for high risk
- break-glass audit

Secrets never stored as plaintext in Postgres.

DB stores only:
- credential_reference
- secret_arn
- provider
- version
- status

---

# 72. OBSERVABILITY / PROVIDER HEALTH / SLA

Use:
- OpenTelemetry
- Prometheus-compatible metrics
- Grafana
- CloudWatch
- Sentry or equivalent app error monitoring

Metrics:
- connected_assets
- ocpp_connections
- command_latency
- command_success_rate
- telemetry_lag
- optimization_latency
- charging_deadline_success
- flex_available_mw
- flex_reserved_mw
- flex_delivered_mw
- flex_delivery_error
- settlement_unmatched_amount
- provider_error_rate
- mobility_sla_success_rate

Provider health per integration:
- availability
- latency
- rate_limit_remaining
- authentication_errors
- webhook_lag
- polling_lag
- command_success_rate
- last_success
- last_error

Automatic fallback provider may be used where safe.

Primary customer SLA:
- requested charging target reached before requested departure

Flex may never systematically degrade this SLA.

---

# 73. FAILURE / OFFLINE / DR

Every provider:
- timeout
- retry
- exponential backoff
- circuit breaker
- rate limiter
- dead-letter
- health state
- manual recovery
- fallback policy

If cloud disappears:
- execute last valid local plan
- if deadline guarantee becomes unsafe, fall back to mobility-safe charging

Initial DR:
- eu-north-1 primary
- PITR
- S3 versioning
- reproducible IaC
- backup policy
- restore tests

Later:
- secondary EU region
- warm standby
- cross-region recovery

---

# 74. DATA SOURCE REGISTRY / LICENSING

data_sources:
- id
- name
- source_type
- provider
- license_type
- commercial_use_status
- redistribution_status
- priority
- status
- documentation_reference
- last_reviewed_at

The platform must know whether data may be:
- used internally
- displayed
- stored
- redistributed
- commercially reused

Initial sources:
Prices:
- Elprisetjustnu V1
- Nord Pool later primary when licensed
- ENTSO-E/other backup/cross-check only when licensing allows

Tariffs:
- RISE Eltariff
- Sourceful
- direct DSO
- manual versioned tariffs

Weather:
- SMHI

Devices:
- OCPP direct
- Enode
- OEM APIs
- SunSpec
- HAN/P1
- EEBUS later

Market/flex:
- BSP partner
- DSO
- local flex
- Svenska kraftnät public/data services for analytics
- direct market interfaces later

---

# 75. OPEN-SOURCE-FIRST STACK

Prefer mature open-source components:

- CitrineOS for OCPP CSMS
- EVerest for Edge/embedded charger stack
- HiGHS and/or OR-Tools for optimization
- RabbitMQ for message broker
- Valkey for distributed cache/locks
- PostgreSQL as transactional DB
- ClickHouse for telemetry analytics
- OpenTelemetry
- Prometheus-compatible metrics
- Grafana
- OpenTofu for IaC first choice
- SunSpec/Modbus standards where relevant
- OpenAPI
- AsyncAPI
- JSON Schema
- Zod/Pydantic-style validation

Use thin adapters.

Do not create a deep fork unless necessary.

Document:
- upstream project/version
- license
- local changes
- update strategy
- NOTICE/attribution requirements

---

# 76. MONOREPO

Use pnpm + Turborepo.

~~~text
flexexa/
  apps/
    marketing/
    partner-portal/
    admin/
    developer-portal/
    consumer-web/

  services/
    api-gateway/
    identity-service/
    tenant-service/
    asset-service/
    connector-service/
    control-service/
    price-service/
    tariff-service/
    true-cost-service/
    optimizer/
    forecasting-service/
    flexibility-service/
    pool-service/
    market-service/
    bsp-gateway/
    dispatch-service/
    measurement-service/
    baseline-service/
    verification-service/
    settlement-service/
    revenue-service/
    ledger-service/
    prequalification-service/
    compliance-service/
    policy-service/
    webhook-service/
    notification-service/
    simulator-service/

  integrations/
    ocpp/
    citrineos/
    enode/
    tesla/
    elprisetjustnu/
    nordpool/
    entsoe/
    eltariff/
    sourceful/
    smhi/
    sunspec/
    bsp/
    svk/
    local-flex/

  packages/
    kernel/
    domain/
    database/
    auth/
    events/
    api-contracts/
    sdk/
    ui-sdk/
    observability/
    security/
    config/

  country-packs/
    se/

  supabase/
    migrations/
    tests/

  infra/
    opentofu/
    terraform-compatible/
    docker/
    monitoring/

  simulators/
  docs/
~~~

Separate future repository:
- flexexa-edge

---

# 77. INFRASTRUCTURE AS CODE / DOCKER / CI

Primary IaC:
- OpenTofu
- retain Terraform-compatible module/provider structure where practical

Provision:
- VPC
- ECS/Fargate
- ECR
- load balancers
- S3
- KMS
- Secrets Manager
- RabbitMQ
- Valkey
- IAM
- monitoring
- DNS

Backend services have Dockerfiles.

Local Docker Compose:
- CitrineOS
- RabbitMQ
- Valkey
- simulators
- support services
- Supabase local stack where useful

Production containers run in AWS; developer laptop is not required.

GitHub:
- protected main
- PRs
- required CI
- CODEOWNERS
- dependency scanning
- required reviews where appropriate

Every PR:
- lint
- typecheck
- unit tests
- integration tests
- migration validation
- clean migration replay
- RLS tests
- tenant isolation tests
- RPC tests
- API contract tests
- OpenAPI compatibility
- security/dependency scan
- Docker build
- Next.js build
- Python tests

Deploy frontend:
GitHub → Vercel Preview → E2E → production

Deploy backend:
GitHub Actions → build → scan → ECR → ECS test → integration tests → production

Use GitHub OIDC to AWS. Avoid permanent AWS credentials in GitHub.

---

# 78. REQUIRED TENANCY/RBAC TESTS

CI must verify:
1. Tenant A cannot read Tenant B customer.
2. Tenant A cannot read Tenant B asset.
3. Tenant A cannot create a site using Tenant B customer_id.
4. Tenant A cannot create an asset using Tenant B site_id.
5. Tenant A cannot add Tenant B asset to a normal tenant portfolio.
6. Tenant admin cannot grant itself a platform role.
7. Viewer cannot send commands.
8. Finance cannot send device commands by default.
9. Operator cannot approve settlement by default.
10. Developer cannot control a production asset without explicit permission.
11. Revoked membership loses access according to defined cache invalidation SLA.
12. Cross-tenant aggregation only succeeds via authorized platform aggregation service and produces audit.

---

# 79. REQUIRED RPC / CONCURRENCY TESTS

CI must verify:
- identical idempotency key cannot create duplicate commands
- two concurrent reservations cannot oversubscribe capacity
- duplicate settlement external ID cannot double-post ledger
- invalid state transition is denied
- tenant mismatch is denied even with manipulated tenant_id input
- unbalanced ledger transaction cannot commit
- published rule version cannot be edited
- commitment stores policy/eligibility version used at acceptance
- duplicate activation/dispatch is deduplicated
- stale telemetry blocks or derates market availability according to policy

---

# 80. REPLAY / RAW DATA / SIMULATION

Save raw payloads in S3 where legally/technically appropriate for:
- settlement
- market dispatch
- tariff import
- provider webhook
- critical OCPP/control event

Store payload hash.

Replay must support:
- prices
- tariffs
- weather
- site load
- vehicle behavior
- market events

Versions:
- optimizer_version
- policy_set_version_id
- rule_evaluation_id
- baseline_method_version
- eligibility_calculation_version
- settlement_calculation_version

Simulator scale:
- 10 assets
- 100
- 10,000
- 100,000
- 1,000,000

Scenarios:
- plug/unplug
- SOC
- charging speed
- network failure
- price change
- provider outage
- flex event
- incomplete delivery
- stale telemetry
- override
- duplicate dispatch

Build flex shadow mode before real money:
- physical available
- safe bid
- simulated dispatch
- predicted delivery

Build shadow settlement:
- market revenue
- BSP fee
- BRP impact
- retailer/OEM/customer/Flexexa shares

---

# 81. COUNTRY PACKS

All national logic belongs in country packs.

country-packs/se contains:
- price areas
- currency
- timezone
- tax logic
- price source configuration
- tariff sources
- TSO configuration
- market actor identifier conventions
- flex product configuration
- meter rules
- locale

Later:
- no
- dk
- fi
- de
- nl
- other EU

---

# 82. PRIVACY / GDPR

Minimize:
- PII
- location history
- vehicle history

Separate identity from high-volume telemetry where practical.

Build:
- consent log
- retention policy
- export
- deletion workflow
- anonymization
- tenant data export
- data processing controls

Do not delete ledger/audit/market records when legal retention requires keeping them.

Retention is configurable by data category.

---

# 83. PHASED BUILD ORDER

Phase 0 — Foundation:
- monorepo
- CI
- Docker
- OpenTofu
- AWS foundation
- Supabase/Postgres
- ClickHouse
- RabbitMQ
- Valkey
- organizations/tenants
- canonical schemas
- composite tenant FKs
- RLS
- RBAC
- rules/policy kernel
- event contracts
- API conventions
- audit
- observability
- provider architecture
- country-pack structure

Phase 1 — Real Smart Charging MVP:
- white-label
- customers/sites/assets
- market actors/site actor relationships
- OCPP/CitrineOS
- Enode
- Elprisetjustnu
- basic tariff
- charging preferences
- true cost
- optimizer
- control/device shadow
- PWA
- partner portal
- external API
- webhooks

Demo:
customer plugs in → Flexexa detects asset → fetches price/tariff → computes cheapest safe plan → sends plan → device executes → customer ready before deadline.

Phase 2 — Full Swedish True Cost:
- RISE Eltariff
- Sourceful/direct DSO adapters
- retailer tariff
- tax
- peak state
- HAN/P1
- load balancing
- total-cost optimization

Phase 3 — Connect Expansion:
- Tesla direct
- Easee
- Zaptec
- Volvo
- BMW
- Mercedes
- VW Group
- SolarEdge
- SMA
- battery OEMs
- prioritize by demand, reliability, support burden and cost per connected device
- do not remove Enode all at once

Phase 4 — Flex Shadow Mode:
- market actors
- BSP/BRP/DSO
- products
- portfolios
- eligibility
- prequalification
- forecasting
- reservations
- MockBspAdapter
- dispatch simulator
- M&V/baseline
- settlement simulator
- ledger
- BRP impact
- no real bids

Phase 5 — BSP Pilot:
- first real BSP
- real availability
- commitments
- activation/dispatch
- M&V
- settlement import
- reconciliation
- revenue allocation
- customer rewards
- Flexexa keeps device control and customer/asset ownership

Phase 6 — Multi-BSP:
- Pool A → BSP A
- Pool B → BSP B
- Pool C → BSP A
- later optimizer can select BSP based on access, fees, reliability, products and settlement quality

Phase 7 — Local Flex:
- first DSO/local flex provider
- location constraints
- capacity payment
- activation
- overlapping-product protection
- settlement

Phase 8 — Solar/Battery/HEMS:
- SunSpec
- battery/solar adapters
- SMHI forecast
- battery optimizer
- household optimizer
- HVAC/heat pump

Phase 9 — Edge/OEM:
- Flexexa Edge based on EVerest
- OEM SDK
- factory integration path

Phase 10 — Nord Pool Production Data:
- acquire correct commercial rights
- NordPoolPriceProvider primary
- Elprisetjustnu fallback

Phase 11 — Nordic Expansion:
- NO
- DK
- FI
- later DE/NL/EU

Phase 12 — Direct BSP Readiness:
- FlexexaDirectBspAdapter
- CIM
- ECP
- Nordic MMS/direct-market adapter
- ACK/security/certificate handling
- enable only when market role/requirements are fulfilled

Phase 13 — V2G:
- OCPP 2.1
- ISO 15118-20
- bidirectional charging
- degradation model
- export tariffs
- V2H
- V2G optimization/flex

---

# 84. DEFINITION OF DONE

Flexexa is not production-ready until:
- tenant isolation passes
- composite tenant relations are enforced
- RLS passes
- RBAC passes
- clean migration replay is green
- critical RPCs are tested
- command idempotency works
- device shadow is verified
- provider failure/failover tested
- tariff versioning works
- optimizer mobility guarantee tested
- audit is complete
- ClickHouse telemetry pipeline tested
- flex capacity cannot be oversubscribed
- commitment stores rule/eligibility versions
- settlement ledger balances
- settlement reconciliation works
- per-asset contribution settlement works
- BRP/BSP/retailer/DSO attribution works
- white-label works
- external API is documented
- rate limits exist
- webhooks are signed
- DR restore tested
- load tests run
- OCPP interoperability tested
- BSP simulator tested
- stale telemetry tested
- duplicate activation tested
- control fallback tested
- critical rule publishing has tests/approval/readiness
- cross-tenant aggregation can only occur through privileged audited path

---

# 85. RULES THAT MAY NEVER BE BROKEN

1. Every tenant-owned row has tenant_id.
2. Tenant relationships are database-enforced, not just application-enforced.
3. Customer/site/asset/portfolio relations can never silently cross tenant.
4. Canonical models are shared from the beginning.
5. Provider-specific models stop at adapter boundaries.
6. Dynamic business rules live in the central Rules/Policy Layer.
7. Physical safety remains deterministic/local and outranks dynamic rules.
8. RBAC is permission-based, not only role-name checks.
9. Critical writes use transactional RPC/application-service boundaries.
10. No service gets blanket cross-tenant access without explicit need.
11. No Enode lock-in.
12. No OEM lock-in.
13. No Nord Pool lock-in.
14. No BSP lock-in.
15. Flexexa does not become BRP.
16. Flexexa remains fully BRP-aware.
17. No raw massive telemetry workload in business Postgres.
18. No double-booked flexibility.
19. No settlement without provenance.
20. No market revenue mixed with modeled savings.
21. No cloud command may override physical safety.
22. Flex may not break mobility guarantee.
23. External input is untrusted until validated.
24. Commands are idempotent and auditable.
25. Financial flows use double-entry ledger.
26. Market products are configuration/data where possible.
27. Temporal actor relationships may not be simplified away.
28. Cross-BSP aggregation is never implicit.
29. Cross-DSO flex respects geography/network constraints.
30. Baselines are versioned.
31. Optimizers are versioned.
32. Eligibility calculations are versioned.
33. Settlement calculations are versioned.
34. Open-source licensing is registered/reviewed.
35. Infrastructure is reproducible.
36. Critical data has provenance.
37. Critical market events can be replayed.
38. Control plane functions independently of frontend.
39. Customer mobility outranks revenue optimization.
40. Historical events use historical policy/rule versions.
41. Feature flags and business rules remain separate concepts.
42. Published rules are immutable.
43. New relevant policy versions trigger new tenant readiness.
44. Every critical rule has automated test cases.
45. Ledger transactions cannot commit unless debits equal credits.

---

# 86. FINAL SYSTEM QUESTIONS

Flexexa must be able to answer in real time:

- How many assets do we control?
- Which are online?
- What physical flexibility exists?
- What safe flexibility exists?
- What predicted flexibility exists at P50/P80/P90/P95?
- What capacity can safely be bid?
- Where is the flexibility geographically?
- Which DSO/network area applies?
- Which market area?
- Which retailer?
- Which BRP?
- Which BSP?
- Which aggregator relationship?
- Which relationship/contract was valid at this exact timestamp?
- Which tenant/customer owns each contributing asset?
- What does the customer need before departure?
- Which capacity is already reserved?
- Which capacity remains?
- Which market has best risk-adjusted value?
- Which BSP route should be used?
- What is the customer's true energy cost?
- How much was saved through smart charging?
- How much through grid tariffs?
- How much was earned through flexibility?
- What did BSP/DSO/market pay?
- Which fees and penalties applied?
- What should retailer receive?
- What should OEM receive?
- What should BSP receive?
- What should Flexexa receive?
- What should each customer receive?
- What BRP impact occurred?
- What power was requested?
- What was delivered?
- Which baseline was used?
- Which measurement source was used?
- Which rule/policy versions made the decision?
- Why did optimizer select this plan?
- Why were these assets selected?
- Can every command be reproduced?
- Can every market event be replayed?
- Can every SEK/EUR be reconciled?
- Can every settlement line be traced to physical delivery?

If the platform cannot answer these correctly, the architecture is not complete.

---

# 87. BUILD AGENT INSTRUCTION

Any coding agent implementing this V1 must always:

1. Build canonical schemas and migrations before UI shortcuts.
2. Add tenant-safe composite foreign keys whenever tenant-owned entities reference each other.
3. Add RLS/RBAC tests when each table is created.
4. Put critical writes behind RPC/application transactions.
5. Call the central Rules/Policy Layer instead of duplicating rules.
6. Version-bind decisions affecting market/control/settlement.
7. Use outbox/idempotency for external side effects.
8. Create audit/provenance for market, control, access and money events.
9. Run clean migration replay.
10. Run tenant-isolation tests.
11. Run RPC concurrency/idempotency tests.
12. Never mark a phase complete until its Definition of Done is green.

Document: FLEXEXA_MASTER_BUILD_PROMPT_V1.md
Version: V1
Status: Locked baseline; future changes are versioned, reviewed and auditable.
