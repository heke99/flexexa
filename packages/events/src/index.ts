export interface CanonicalEventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  tenantId: string | null;
  correlationId: string;
  causationId: string | null;
  source: string;
  payload: TPayload;
}
