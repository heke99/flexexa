import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { profile } from './capacity-profile.mjs';
import { roamingRoutes } from './capacity-roaming-routes.mjs';
import { capacityTimings } from './capacity-timings.mjs';

const partnerKey = 'capacity-partner';
const privateFixtureCount = 36;

export async function seedMixedRoutes(pool, db, fixtures, { issuer, issueCredential }) {
  const company = fixtures.owners.values().next().value;
  const client = randomUUID();
  await db.transaction('worker', connection => connection.query(`
    INSERT INTO charging_subscription.energy_partner_clients
      (partner_key,principal_id,oauth_client_id,active,company_account_id) VALUES($1,$2,$3,true,$4)
  `, [partnerKey, company.principal, client, company.tenant.id]));

  const product = randomUUID();
  await pool.query(`
    INSERT INTO charging_subscription.products(id,name,kind,amount_minor,currency,terms_version,network_policy)
    VALUES($1,'Capacity preview','recurring',100,'sek','fixture','fixture')
  `, [product]);
  for (const { tenant } of fixtures.owners.values()) {
    tenant.fixtureOrder = randomUUID();
    await pool.query(`
      INSERT INTO charging_subscription.orders(id,account_id,product_id,vehicle_id,quantity,idempotency_key,request_hash)
      VALUES($1,$2,$3,$4,1,'mixed-route-order','fixture')
    `, [tenant.fixtureOrder, tenant.id, product, tenant.vehicleIds[0]]);
  }
  // The fixture's sorted plate suffix independently defines which records have verification.
  await pool.query(`
    UPDATE charging_subscription.vehicles SET verified_at=now(),verification_ref='mixed-probe'
    WHERE right(plate,1) IN ('0','2','4','6','8')
  `);

  const privateCustomers = [];
  for (let number = 0; number < privateFixtureCount; number += 1) {
    const principal = randomUUID(), subject = randomUUID(), account = randomUUID();
    const shared = randomUUID(), unshared = randomUUID();
    await pool.query('INSERT INTO charging_subscription.principals(id) VALUES($1)', [principal]);
    await pool.query('INSERT INTO charging_subscription.identities(issuer,subject,principal_id) VALUES($1,$2,$3)',
      [issuer, subject, principal]);
    await pool.query(`
      INSERT INTO charging_subscription.accounts(id,kind,name,personal_owner)
      VALUES($1,'personal','Mixed-route private control',$2)
    `, [account, principal]);
    await pool.query("INSERT INTO charging_subscription.memberships VALUES($1,$2,'owner')", [account, principal]);
    await pool.query(`
      INSERT INTO charging_subscription.vehicles(id,account_id,country,plate)
      VALUES ($1,$3,'SE','SHARED'),($2,$3,'SE','PRIVATE')
    `, [shared, unshared, account]);
    const tenant = { id: account };
    const ownerToken = issueCredential(subject);
    const delegateToken = issueCredential(subject, { oauthClientId: client });
    privateCustomers.push({ tenant, shared, owner: { get token() { return ownerToken(); }, tenant, role: 'owner' },
      delegation: { get token() { return delegateToken(); }, tenant, role: 'delegated_customer' } });
  }
  return { company, privateCustomers };
}

export async function grantMixedPartnerScope(request, fixtures, expiresInSeconds = 86_400) {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1_000).toISOString();
  for (const { owner, shared } of fixtures.privateCustomers) {
    const result = await request(owner, 'partner-consents', { method: 'POST', key: 'mixed-probe-consent',
      body: JSON.stringify({ partnerKey, vehicleIds: [shared], scopes: ['vehicles:read'], expiresAt }) });
    assert.equal(result.status, 201, JSON.stringify(result.body));
  }
}

function matchesItems(body, ids) {
  return Array.isArray(body?.items) && body.items.length === ids.length
    && body.items.every((item, position) => item?.id === ids[position]);
}

function matchesVehiclePage(body, ids, hasMore) {
  return matchesItems(body, ids) && (hasMore ? typeof body.nextCursor === 'string' : body.nextCursor === null);
}

const routes = {
  vehicles: { route: '/v1/accounts/:account/vehicles?limit=100', weight: 4,
    build: ({ actor }) => ({
      resource: 'vehicles?limit=100',
      valid: body => matchesVehiclePage(body, actor.tenant.vehicleIds.slice(0, 100), true),
    }) },
  deep_vehicle_page: { route: '/v1/accounts/:account/vehicles?limit=100&after=:cursor', weight: 4,
    build: ({ actor }) => {
      const { after, offset } = actor.tenant.fixturePage;
      const { vehicleIds } = actor.tenant;
      return { resource: `vehicles?limit=100&after=${after}`,
        valid: body => matchesVehiclePage(body, vehicleIds.slice(offset, offset + 100), offset + 100 < vehicleIds.length) };
    } },
  vehicle_search: { route: '/v1/accounts/:account/vehicles?limit=100&search=:plate&verification=:state', weight: 3,
    build: ({ actor, index, iteration, cycleLength }) => {
      const position = Math.floor(index / cycleLength) % actor.tenant.vehicleIds.length;
      const plate = actor.tenant.plates[position], id = actor.tenant.vehicleIds[position];
      const verified = Number(plate.at(-1)) % 2 === 0;
      const match = iteration % 4 !== 3;
      const requestedVerification = match ? verified : !verified;
      const filter = new URLSearchParams({ limit: '100', search: plate.toLowerCase(),
        verification: requestedVerification ? 'verified' : 'unverified' });
      return { resource: `vehicles?${filter}`, valid: body => matchesVehiclePage(body, match ? [id] : [], false)
        && (!match || (body.items[0].plate === plate && Boolean(body.items[0].verified_at) === verified)) };
    } },
  products: { route: '/v1/accounts/:account/product-access', weight: 2,
    build: () => ({ resource: 'product-access', valid: body => Array.isArray(body?.items) && body.items.length === 2
      && body.items.every(item => item.enabled === true)
      && new Set(body.items.map(item => item.product_key)).size === 2
      && body.items.every(item => ['external_api', 'energy_optimization'].includes(item.product_key)) }) },
  finance: { route: '/v1/accounts/:account/orders?limit=25', weight: 1,
    build: ({ actor }) => ({ resource: 'orders?limit=25',
      valid: body => matchesItems(body, [actor.tenant.fixtureOrder]) && body.nextCursor === null }) },
  partner: { route: '/v1/partners/:partner/accounts/:privateAccount/vehicles', weight: 2,
    build: ({ fixtures, nextPartner }) => {
      const { delegation, tenant, shared } = nextPartner();
      return { actor: delegation, resource: `/v1/partners/${partnerKey}/accounts/${tenant.id}/vehicles`,
        options: { partnerProof: fixtures.company.token }, valid: body => matchesItems(body, [shared]) };
    } },
  platform_status: { route: '/v1/platform/product-access/status', weight: 1,
    build: () => ({ resource: '/v1/platform/product-access/status', valid: body => body?.superadmin === false }) },
  cross_account: { route: '/v1/accounts/:foreignAccount/vehicles?limit=100', weight: 1,
    denied: [403, 'FORBIDDEN'],
    build: ({ fixtures }) => ({ resource: 'vehicles?limit=100', options: { account: fixtures.control.tenant.id } }) },
  cross_account_cursor: { route: '/v1/accounts/:foreignAccount/vehicles?after=:cursor', weight: 1,
    denied: [400, 'INVALID_CURSOR'],
    build: ({ fixtures, actor, iteration }) => ({ actor: fixtures.cursorActors[iteration % fixtures.cursorActors.length],
      resource: `vehicles?after=${actor.tenant.fixturePage.after}` }) },
  driver_finance: { route: '/v1/accounts/:account/orders?limit=25', weight: 1,
    denied: [403, 'FORBIDDEN'],
    build: ({ fixtures, iteration }) => ({ actor: fixtures.financeDrivers[iteration % fixtures.financeDrivers.length],
      resource: 'orders?limit=25' }) },
  partner_no_proof: { route: '/v1/partners/:partner/accounts/:privateAccount/vehicles', weight: 1,
    denied: [401, 'PARTNER_AUTH_REQUIRED'],
    build: ({ nextPartner }) => {
      const { delegation, tenant } = nextPartner();
      return { actor: delegation, resource: `/v1/partners/${partnerKey}/accounts/${tenant.id}/vehicles` };
    } },
  partner_outside_contract: { route: '/v1/accounts/:privateAccount/vehicles?limit=100', weight: 1,
    denied: [403, 'PARTNER_ROUTE_REQUIRED'],
    build: ({ nextPartner }) => ({ actor: nextPartner().delegation, resource: 'vehicles?limit=100' }) },
  nonadmin: { route: '/v1/platform/product-access/accounts', weight: 1,
    denied: [403, 'PRODUCT_ADMIN_FORBIDDEN'],
    build: () => ({ resource: '/v1/platform/product-access/accounts' }) },
};

export function httpSamplesMeetThresholds(samples) {
  return samples.every(sample => sample.routeSamples?.every(route =>
    route.accessChecksPassed ?? route.withinProposedThresholds) ?? sample.withinProposedThresholds);
}

export async function measureMixedReads(request, fixtures, rate, duration, { bounded = false, signal } = {}) {
  const selectedRoutes = fixtures.roamingCosts ? { ...routes, ...roamingRoutes } : routes;
  const routeCycle = Object.keys(selectedRoutes).flatMap(key => Array(selectedRoutes[key].weight).fill(key));
  const measurements = new Map();
  const pending = new Set();
  let maxInFlight = 0;
  let partnerReads = 0;
  let scheduledRequests = 0;
  const billingActors = fixtures.roamingCosts
    ? [...fixtures.roamingBillers, ...fixtures.loadActors.filter(actor => actor.role === 'billing')] : [];
  const billingFor = iteration => billingActors[iteration % billingActors.length];
  const nextPartner = () => fixtures.privateCustomers[partnerReads++ % fixtures.privateCustomers.length];
  const started = performance.now();
  for (let index = 0; index < rate * duration; index += 1) {
    if (signal?.aborted) break;
    const scheduled = started + index * 1_000 / rate;
    const wait = scheduled - performance.now();
    if (wait > 0) await delay(wait);
    if (signal?.aborted) break;
    const key = routeCycle[index % routeCycle.length];
    const spec = selectedRoutes[key];
    if (!measurements.has(key)) measurements.set(key, { attempts: 0, dropped: 0, statuses: {}, errorCodes: {}, actorRoles: {},
      expectedOutcomes: 0, wrongPayload: 0, unauthorizedSuccess: 0,
      timings: spec.denied ? null : capacityTimings(bounded), bytes: 0,
      matchedAccounts: Object.hasOwn(roamingRoutes, key) ? new Set() : null });
    const sample = measurements.get(key);
    sample.attempts += 1;
    scheduledRequests += 1;
    const actor = fixtures.loadActors[index % fixtures.loadActors.length];
    const testCase = spec.build({ actor, fixtures, index, iteration: sample.attempts - 1, nextPartner, billingFor,
      cycleLength: routeCycle.length });
    const caller = testCase.actor ?? actor;
    sample.actorRoles[caller.role] = (sample.actorRoles[caller.role] ?? 0) + 1;
    if (pending.size >= 400) {
      sample.dropped += 1;
      continue;
    }
    const operation = request(caller, testCase.resource, testCase.options).then(result => {
      const code = String(result.status);
      sample.statuses[code] = (sample.statuses[code] ?? 0) + 1;
      if (result.status >= 400) {
        const error = result.body?.error;
        const label = typeof error === 'string' && /^[A-Z0-9_]{1,80}$/.test(error) ? error : 'INVALID_ERROR_RESPONSE';
        sample.errorCodes[label] = (sample.errorCodes[label] ?? 0) + 1;
      }
      if (spec.denied) {
        if (result.status === spec.denied[0] && result.body?.error === spec.denied[1]) sample.expectedOutcomes += 1;
        if (result.status >= 200 && result.status < 300) sample.unauthorizedSuccess += 1;
      } else if (result.status === 200) {
        sample.timings.add(performance.now() - scheduled);
        sample.bytes += result.bytes;
        if (testCase.valid(result.body)) {
          sample.expectedOutcomes += 1;
          sample.matchedAccounts?.add(caller.tenant.id);
        }
        else sample.wrongPayload += 1;
      }
    }).catch(() => { sample.statuses.error = (sample.statuses.error ?? 0) + 1; })
      .finally(() => pending.delete(operation));
    pending.add(operation);
    maxInFlight = Math.max(maxInFlight, pending.size);
  }
  await Promise.all(pending);
  const routeSamples = [...measurements].map(([key, sample]) => {
    const { route, denied } = selectedRoutes[key];
    const { timings, matchedAccounts, ...counts } = sample;
    const p95Ms = timings?.percentile(0.95);
    const unexpectedErrorRatio = (sample.attempts - sample.expectedOutcomes) / sample.attempts;
    return { key, route: `GET ${route}`, expectedStatus: denied?.[0] ?? 200, ...counts,
      ...(matchedAccounts && !denied ? { matchedAccounts: matchedAccounts.size } : {}),
      unexpectedOutcomes: sample.attempts - sample.expectedOutcomes,
      ...(denied ? { expectedError: denied[1], accessChecksPassed: unexpectedErrorRatio === 0 } : {
        p95Ms, p99Ms: timings.percentile(0.99), unexpectedErrorRatio,
        ...(bounded ? { latencySamples: timings.count, clippedLatencies: timings.clipped } : {}),
        withinProposedThresholds: p95Ms !== null && p95Ms <= profile.thresholds.criticalReadP95Ms
          && unexpectedErrorRatio <= profile.thresholds.criticalReadUnexpectedErrorRatioMax,
      }) };
  });
  return { offeredRequestsPerSecond: rate, scheduledSeconds: duration, requests: scheduledRequests, maxInFlight,
    ...(bounded ? { plannedRequests: rate * duration, latencyMethod: 'bounded_hdr_3_significant_figures' } : {}),
    observedSeconds: Number(((performance.now() - started) / 1_000).toFixed(3)), routeSamples };
}
