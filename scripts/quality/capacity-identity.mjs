import { randomUUID } from 'node:crypto';

export function capacityIdentity({ issuer, clock = Date.now, lifetimeSeconds = 3_600, renew = false }) {
  const tokens = new Map();
  let sessions = 0;
  let renewals = 0;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const nowSeconds = () => Math.floor(clock() / 1_000);
  const renewalLead = Math.min(60, Math.max(1, Math.floor(lifetimeSeconds / 10)));
  return {
    credential(subject, { oauthClientId } = {}) {
      const authenticatedAt = nowSeconds();
      const sessionId = randomUUID();
      sessions += 1;
      const user = { id: subject, email: `${subject}@capacity.invalid`,
        email_confirmed_at: new Date(clock()).toISOString() };
      function sign(issuedAt) {
        const expires = issuedAt + lifetimeSeconds;
        const token = `${encode({ alg: 'HS256' })}.${encode({
          iss: issuer, sub: subject, session_id: sessionId, aud: 'authenticated', role: 'authenticated',
          aal: 'aal1', iat: issuedAt, exp: expires, amr: [{ method: 'password', timestamp: authenticatedAt }],
          ...(oauthClientId ? { client_id: oauthClientId } : {}),
        })}.${randomUUID()}`;
        const entry = { token, expires, user };
        tokens.set(token, entry);
        return entry;
      }
      let current = sign(authenticatedAt);
      let prior;
      return () => {
        const now = nowSeconds();
        if (renew && now >= current.expires - renewalLead) {
          if (prior) tokens.delete(prior.token);
          prior = current;
          current = sign(now);
          renewals += 1;
        }
        return current.token;
      };
    },
    user(token) {
      const entry = tokens.get(token);
      return entry && nowSeconds() < entry.expires ? entry.user : null;
    },
    stats() { return { sessions, renewals, registeredTestTokens: tokens.size }; },
  };
}
