---
name: aws-messaging-and-streaming
description: "Amazon MQ/RabbitMQ and AWS messaging semantics."
priority: critical
upstream_skill: skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-messaging-and-streaming
---

# aws-messaging-and-streaming — Flexexa repository skill

## Purpose
Amazon MQ/RabbitMQ and AWS messaging semantics.

Load upstream guidance from `skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-messaging-and-streaming` when available, then apply this Flexexa overlay.

## Mandatory rules
- Flexexa core async event bus is RabbitMQ via Amazon MQ in AWS.
- Do not silently replace RabbitMQ with SQS/EventBridge/Vercel Queues.
- All domain events use versioned canonical envelopes, idempotency, retries and DLQ policies.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
