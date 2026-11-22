const month = '2026-10';
const previousMonth = '2026-09';

function evidence(accountId, externalReference, energyWh, costMinor, monthIndex) {
  return {
    accountId, channel: 'public', source: 'opaque:capacity-roaming-fixture', externalReference,
    sourceRevisionReference: 'original', expectedRevision: 0, verificationReference: 'capacity-fixture',
    startsAt: Date.UTC(2026, monthIndex, 24, 10), endsAt: Date.UTC(2026, monthIndex, 24, 11),
    energyWh, publicCostExcludingVatMinor: costMinor, currency: 'SEK',
  };
}

export async function seedRoamingCosts(db, owners, { importChargingEvidence, closeRoamingCosts }) {
  for (const [index, { tenant }] of [...owners.values()].entries()) {
    const documents = [
      evidence(tenant.id, `fixture-${index}-a`, 2_000 + index * 37, 125 + index * 7, 9),
      evidence(tenant.id, `fixture-${index}-b`, 5_000 + index * 79, 225 + index * 11, 9),
    ];
    const detail = [];
    for (const source of documents) {
      const result = await importChargingEvidence(db, source);
      detail.push({ source, line: {
        evidenceId: result.evidenceId, revision: 1, startsAt: String(source.startsAt), endsAt: String(source.endsAt),
        energyWh: String(source.energyWh), publicCostExcludingVatMinor: String(source.publicCostExcludingVatMinor),
      } });
    }
    await importChargingEvidence(db, evidence(tenant.id, `fixture-${index}-previous`, 1_000 + index, 39 + index, 8));
    await closeRoamingCosts(db, { accountId: tenant.id, month: previousMonth, closeReference: 'capacity-roaming-previous' });
    await closeRoamingCosts(db, { accountId: tenant.id, month, closeReference: 'capacity-roaming-frozen' });
    detail.sort((a, b) => a.line.evidenceId < b.line.evidenceId ? -1 : 1);
    const first = detail[0];
    await importChargingEvidence(db, {
      ...first.source, sourceRevisionReference: 'later', expectedRevision: 1,
      energyWh: first.source.energyWh + 700, publicCostExcludingVatMinor: first.source.publicCostExcludingVatMinor + 30,
    });
    tenant.roamingCost = {
      period: {
        month, currency: 'SEK', documentCount: String(documents.length),
        publicEnergyWh: String(documents.reduce((sum, row) => sum + row.energyWh, 0)),
        publicCostExcludingVatMinor: String(documents.reduce((sum, row) => sum + row.publicCostExcludingVatMinor, 0)),
      },
      firstDetail: first.line,
    };
  }
  return { companies: owners.size, frozenPeriods: owners.size * 2, frozenDocuments: owners.size * 3,
    laterRevisions: owners.size };
}

function exactFields(actual, expected) {
  return actual && Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function samePeriod(actual, expected) {
  return typeof actual?.closedAt === 'string' && Number.isFinite(Date.parse(actual.closedAt))
    && exactFields(actual, { ...expected, closedAt: actual.closedAt });
}

export const roamingRoutes = {
  roaming_periods: { route: '/v1/accounts/:account/roaming-cost-periods?limit=1', weight: 1,
    build: ({ billingFor, iteration }) => {
      const actor = billingFor(iteration);
      return { actor, resource: 'roaming-cost-periods?limit=1',
        valid: body => Array.isArray(body?.items) && body.items.length === 1 && body.nextCursor === month
          && samePeriod(body.items[0], actor.tenant.roamingCost.period) };
    } },
  roaming_period_detail: { route: '/v1/accounts/:account/roaming-cost-periods/:month?limit=1', weight: 1,
    build: ({ billingFor, iteration }) => {
      const actor = billingFor(iteration);
      const { period, firstDetail } = actor.tenant.roamingCost;
      return { actor, resource: `roaming-cost-periods/${month}?limit=1`,
        valid: body => Array.isArray(body?.items) && body.items.length === 1 && body.nextCursor === firstDetail.evidenceId
          && samePeriod(body.period, period) && exactFields(body.items[0], firstDetail) };
    } },
  driver_roaming_detail: { route: '/v1/accounts/:account/roaming-cost-periods/:month?limit=1', weight: 1,
    denied: [403, 'FORBIDDEN'],
    build: ({ fixtures, iteration }) => ({ actor: fixtures.financeDrivers[iteration % fixtures.financeDrivers.length],
      resource: `roaming-cost-periods/${month}?limit=1` }) },
};
