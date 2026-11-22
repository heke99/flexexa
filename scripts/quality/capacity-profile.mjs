import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export const profile = JSON.parse(await readFile(
  new URL('../../docs/progress/capacity-profile.v1.json', import.meta.url),
  'utf8',
));

const productAccess = [['optimization', 'subscription'], ['optimization'], ['subscription']];
const deviceStates = ['charging', 'waiting', 'stale', 'disconnected'];
const millisecondsPerDay = 86_400_000;

function fixtureScenario(name) {
  if (!Object.hasOwn(profile.scenarios, name)) {
    throw new Error(`Unknown capacity scenario: ${name}`);
  }
  return profile.scenarios[name];
}

function fleetTenant(index) {
  return `fleet-${index + 1}`;
}

export function* principalRows(name) {
  const { fleetTenants } = fixtureScenario(name);
  const tenantIds = [
    ...Array.from({ length: fleetTenants }, (_, index) => fleetTenant(index)),
    ...Array.from({ length: profile.fixture.controlTenants }, (_, index) => `control-${index + 1}`),
  ];
  for (const [index, tenantId] of tenantIds.entries()) {
    const products = index < fleetTenants
      ? productAccess[index % productAccess.length]
      : productAccess[1 + (index - fleetTenants) % (productAccess.length - 1)];
    for (const [client, roles] of Object.entries(profile.fixture.clientRoles)) {
      if (client === 'superadmin') continue;
      for (const role of roles) {
        yield { principalId: `${tenantId}-${client}-${role}`, tenantId, client, role, products };
      }
    }
  }
  yield {
    principalId: 'platform-superadmin',
    tenantId: null,
    client: 'superadmin',
    role: 'superadmin',
    products: [],
  };
}

export function* vehicleRows(name) {
  const { cohorts, fleetTenants } = fixtureScenario(name);
  let sequence = 0;
  for (let cohort = 0; cohort < cohorts; cohort += 1) {
    const tenantIndex = cohort % fleetTenants;
    const tenantId = fleetTenant(tenantIndex);
    for (const [site, siteSize] of profile.fixture.siteSizesPerCohort.entries()) {
      const siteId = `${tenantId}-site-${cohort + 1}-${site + 1}`;
      for (let vehicle = 0; vehicle < siteSize; vehicle += 1) {
        const index = sequence++;
        yield {
          vehicleId: `vehicle-${index + 1}`,
          tenantId,
          siteId,
          providerId: `sim-${index % profile.fixture.providerCount + 1}`,
          productAccess: productAccess[tenantIndex % productAccess.length],
          customerType: index % 5 === 0 ? 'private_delegated' : 'company',
          registered: true,
          activated: true,
          deviceState: deviceStates[index % deviceStates.length],
        };
      }
    }
  }
}

export function* sessionRows(vehicles) {
  const { startDate, days, sessionsPerVehiclePerDay } = profile.fixture.history;
  const start = Date.parse(startDate);
  for (const vehicle of vehicles) {
    for (let day = 0; day < days; day += 1) {
      for (let slot = 0; slot < sessionsPerVehiclePerDay; slot += 1) {
        const startedAt = new Date(start + day * millisecondsPerDay
          + slot * millisecondsPerDay / sessionsPerVehiclePerDay).toISOString();
        const energyWh = 4_000 + (day % 10) * 500 + slot * 1_000;
        const lateCdr = slot === 1 && day % 31 === 0;
        const creditMinor = lateCdr && day % 2 === 0 ? 100 : 0;
        yield {
          sessionId: `${vehicle.vehicleId}-${day}-${slot}`,
          vehicleId: vehicle.vehicleId,
          tenantId: vehicle.tenantId,
          siteId: vehicle.siteId,
          providerId: vehicle.providerId,
          startedAt,
          billingPeriod: startedAt.slice(0, 7),
          receivedAt: lateCdr
            ? new Date(Date.parse(startedAt) + 35 * millisecondsPerDay).toISOString()
            : startedAt,
          energyWh,
          currency: 'SEK',
          costMinor: energyWh / 5,
          creditMinor,
        };
      }
    }
  }
}

function summarizeScenario(name) {
  const vehicles = [...vehicleRows(name)];
  const { days, sessionsPerVehiclePerDay } = profile.fixture.history;
  return {
    scenario: name,
    vehicles: vehicles.length,
    fleetTenants: new Set(vehicles.map(vehicle => vehicle.tenantId)).size,
    sites: new Set(vehicles.map(vehicle => vehicle.siteId)).size,
    activeChargingSessions: vehicles.filter(vehicle => vehicle.deviceState === 'charging').length,
    generatedPrincipals: [...principalRows(name)].length,
    expectedHistoryRows: vehicles.length * days * sessionsPerVehiclePerDay,
  };
}

const datasets = {
  principals: principalRows,
  vehicles: vehicleRows,
  sessions: scenario => sessionRows(vehicleRows(scenario)),
};

async function main(args) {
  if (args.length === 1 && args[0] === '--check') {
    const fixtures = Object.keys(profile.scenarios).map(summarizeScenario);
    for (const scenario of ['distributed', 'concentrated']) {
      const fixture = fixtures.find(result => result.scenario === scenario);
      if (fixture.vehicles < profile.vehicleCapacityMinimum
        || fixture.fleetTenants !== profile.scenarios[scenario].fleetTenants
        || fixture.activeChargingSessions !== profile.load.concurrentChargingSessions
        || fixture.expectedHistoryRows !== profile.fixture.history.targetSessionRows) {
        throw new Error(`Capacity fixture diverges from the profile: ${scenario}`);
      }
    }
    process.stdout.write(`${JSON.stringify({ scope: 'fixture_only', fixtures }, null, 2)}\n`);
    return;
  }

  const [scenario, dataset] = args;
  if (args.length !== 2 || !Object.hasOwn(datasets, dataset)) {
    throw new Error('Usage: capacity-profile.mjs --check | <distributed|concentrated|quick> <vehicles|principals|sessions>');
  }
  await pipeline(Readable.from(jsonLineChunks(datasets[dataset](scenario)), { objectMode: false }), process.stdout);
}

function* jsonLineChunks(rows) {
  let chunk = '';
  for (const row of rows) {
    chunk += `${JSON.stringify(row)}\n`;
    if (chunk.length >= 64 * 1024) {
      yield chunk;
      chunk = '';
    }
  }
  if (chunk) yield chunk;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    if (error.code !== 'EPIPE') {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
