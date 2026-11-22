const month = '2026-10';
const previousMonth = '2026-09';
const vehiclesPerCompany = 24;
const totalsPageSize = 12;

function evidence(accountId, externalReference, energyWh, costMinor, monthIndex) {
  return {
    accountId, channel: 'public', source: 'opaque:capacity-roaming-fixture', externalReference,
    sourceRevisionReference: 'original', expectedRevision: 0, verificationReference: 'capacity-fixture',
    startsAt: Date.UTC(2026, monthIndex, 24, 10), endsAt: Date.UTC(2026, monthIndex, 24, 11),
    energyWh, publicCostExcludingVatMinor: costMinor, currency: 'SEK',
  };
}

function totals(sources) {
  return {
    documentCount: String(sources.length),
    publicEnergyWh: String(sources.reduce((sum, source) => sum + source.energyWh, 0)),
    publicCostExcludingVatMinor: String(sources.reduce((sum, source) => sum + source.publicCostExcludingVatMinor, 0)),
  };
}

export async function seedRoamingCosts(db, owners, { importChargingEvidence, reviewChargingAttribution, closeRoamingCosts }) {
  let frozenDocuments = 0, verifiedVehicles = 0, verifiedDocuments = 0;
  for (const [index, { tenant }] of [...owners.values()].entries()) {
    // seedMixedRoutes verifies vehicles with even-numbered plates.
    const vehicleIds = tenant.vehicleIds.filter((_, position) => Number(tenant.plates[position].at(-1)) % 2 === 0)
      .slice(0, vehiclesPerCompany).sort();
    const groups = vehicleIds.map((vehicleId, position) => ({ vehicleId, sources: [
      evidence(tenant.id, `fixture-${index}-${position}-a`, 2_000 + index * 37 + position * 19, 125 + index * 7 + position, 9),
      evidence(tenant.id, `fixture-${index}-${position}-b`, 5_000 + index * 79 + position * 31, 225 + index * 11, 9),
    ] }));
    const credit = evidence(tenant.id, `fixture-${index}-credit`, 1_000 + index, -39 - index, 9);
    const detail = [];
    const review = (record, vehicleId, method, expectedReview = 0) => reviewChargingAttribution(db, {
      accountId: tenant.id, evidenceId: record.line.evidenceId, revision: record.line.revision,
      reviewReference: `capacity-review-${expectedReview + 1}`, proofReference: 'capacity-fixture-proof',
      vehicleId, method, expectedReview,
    });
    const importDocument = async source => {
      const result = await importChargingEvidence(db, source);
      const record = { source, line: {
        evidenceId: result.evidenceId, revision: 1, startsAt: String(source.startsAt), endsAt: String(source.endsAt),
        energyWh: String(source.energyWh), publicCostExcludingVatMinor: String(source.publicCostExcludingVatMinor),
      } };
      detail.push(record);
      return record;
    };
    for (const { vehicleId, sources } of groups) {
      for (const source of sources) await review(await importDocument(source), vehicleId, 'verified_meter_session');
    }
    const reassigned = detail[0];
    await review(await importDocument(credit), vehicleIds[0], 'token_assignment');
    await importChargingEvidence(db, evidence(tenant.id, `fixture-${index}-previous`, 1_000 + index, 39 + index, 8));
    await closeRoamingCosts(db, { accountId: tenant.id, month: previousMonth, closeReference: 'capacity-roaming-previous' });
    await closeRoamingCosts(db, { accountId: tenant.id, month, closeReference: 'capacity-roaming-frozen' });
    await review(reassigned, vehicleIds[1], 'verified_meter_session', 1);
    detail.sort((a, b) => a.line.evidenceId < b.line.evidenceId ? -1 : 1);
    const first = detail[0];
    await importChargingEvidence(db, {
      ...first.source, sourceRevisionReference: 'later', expectedRevision: 1,
      energyWh: first.source.energyWh + 700, publicCostExcludingVatMinor: first.source.publicCostExcludingVatMinor + 30,
    });
    tenant.roamingCost = {
      period: { month, currency: 'SEK', ...totals(detail.map(({ source }) => source)) },
      firstDetail: first.line,
      vehicleTotals: groups.map(({ vehicleId, sources }) => ({ vehicleId, ...totals(sources) })),
      unassigned: { vehicleId: null, ...totals([credit]) },
    };
    frozenDocuments += detail.length + 1;
    verifiedDocuments += detail.length - 1;
    verifiedVehicles += vehicleIds.length;
  }
  return { companies: owners.size, frozenPeriods: owners.size * 2, frozenDocuments,
    verifiedVehicles, verifiedDocuments, unassignedDocuments: owners.size,
    laterRevisions: owners.size, laterReviews: owners.size };
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
  roaming_vehicle_totals: { route: '/v1/accounts/:account/roaming-cost-periods/:month/vehicle-totals?limit=12[&cursor=:vehicle]', weight: 1,
    build: ({ billingFor, fixtures, iteration }) => {
      const actor = billingFor(iteration);
      const { period, vehicleTotals, unassigned } = actor.tenant.roamingCost;
      const offset = Math.floor(iteration / fixtures.roamingBillers.length) % 2 * totalsPageSize;
      const items = vehicleTotals.slice(offset, offset + totalsPageSize);
      const cursor = offset === 0 ? '' : `&cursor=${vehicleTotals[offset - 1].vehicleId}`;
      const nextCursor = offset + items.length < vehicleTotals.length ? items.at(-1).vehicleId : null;
      return { actor, resource: `roaming-cost-periods/${month}/vehicle-totals?limit=${totalsPageSize}${cursor}`,
        valid: body => samePeriod(body?.period, period) && exactFields(body?.unassigned, unassigned)
          && Array.isArray(body?.items) && body.items.length === items.length && body.nextCursor === nextCursor
          && body.items.every((item, position) => exactFields(item, items[position])) };
    } },
  driver_roaming_vehicle_totals: { route: '/v1/accounts/:account/roaming-cost-periods/:month/vehicle-totals', weight: 1,
    denied: [403, 'FORBIDDEN'],
    build: ({ fixtures, iteration }) => ({ actor: fixtures.financeDrivers[iteration % fixtures.financeDrivers.length],
      resource: `roaming-cost-periods/${month}/vehicle-totals` }) },
  cross_account_roaming_vehicle_totals: { route: '/v1/accounts/:foreignAccount/roaming-cost-periods/:month/vehicle-totals', weight: 1,
    denied: [403, 'FORBIDDEN'],
    build: ({ billingFor, fixtures, iteration }) => {
      const actor = billingFor(iteration);
      const foreign = fixtures.roamingBillers.find(biller => biller.tenant.id !== actor.tenant.id) ?? fixtures.control;
      return { actor, options: { account: foreign.tenant.id }, resource: `roaming-cost-periods/${month}/vehicle-totals` };
    } },
  driver_roaming_detail: { route: '/v1/accounts/:account/roaming-cost-periods/:month?limit=1', weight: 1,
    denied: [403, 'FORBIDDEN'],
    build: ({ fixtures, iteration }) => ({ actor: fixtures.financeDrivers[iteration % fixtures.financeDrivers.length],
      resource: `roaming-cost-periods/${month}?limit=1` }) },
};
