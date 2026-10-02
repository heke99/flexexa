# Phase 0 — real identity process shutdown regression

Scope: V1 §§71–73, 77, 83 and the process-shutdown portion of FXP-01-T3.
Prerequisite: identity readiness/drain PR #53. This package adds operational regression
coverage; it does not issue credentials, deploy infrastructure or complete Phase 0.

The test forks the unchanged production `src/main.ts` using the current Node executable,
opens real HTTP, waits for admission readiness, sends a canonical provisioning request
and waits until that request actually reaches its RPC boundary. An OS SIGTERM then
withdraws admission while the request is pending. Releasing the controlled RPC returns
the canonical completion to the original HTTP caller and the process exits with code 0.

A second process deliberately leaves that admitted dependency unresolved, including
ignoring its upstream AbortSignal. The unchanged 15-second shutdown deadline must
terminate the process with code 1 and reject the outstanding HTTP call. This fault
injection verifies a stuck dependency bound, not real Supabase behavior. Child cleanup
kills unfinished processes; the fixture uses only fixed test credentials, no inherited
deployment secrets, and checks captured output for credential and tenant leakage.

The test-only preload intercepts upstream fetch in the child. It is not imported by
production source or included in the identity Dockerfile's explicit source allowlist.
No Auth/SQL authority, dependency, timeout setting, signal handler or image configuration
is changed. Actual Auth, hardened container and image scan CI remain mandatory.
Hosted ECS stop timing, load balancer wiring and interrupted-side-effect reconciliation
still need their own deployment evidence.

Skill routing: activated repo index/impact/affected verification, differential code and
security review, invariant test strategy and upstream full-story verification. Story:
production entrypoint → real HTTP admission → controlled canonical RPC → real SIGTERM
→ response or bounded failure → process exit. Database, IAM/cloud and browser mutations
are outside this test package. Full application checks are required by HIGH impact;
do not upgrade the FXP operations case from these scoped process results.
