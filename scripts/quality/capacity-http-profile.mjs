import { AsyncLocalStorage } from 'node:async_hooks';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const sampleLimit = 4_096;

function queryType(sql) {
  if (sql.includes('energy_vehicle_shadows')) return 'shadow-write';
  if (sql.includes('rate_limits')) return 'rate-limit';
  if (sql.includes('pg_advisory_xact_lock')) return 'advisory-lock';
  if (sql.includes('app_sessions')) return 'session';
  if (sql.includes('auth_cutoffs')) return 'session-cutoff';
  if (sql.includes('identities')) return 'identity';
  if (sql.includes('memberships')) return 'membership';
  if (sql.includes('charging_subscription.vehicles')) {
    if (sql.includes('regexp_replace')) return 'vehicle-search-query';
    if (sql.includes('(plate,id)>')) return 'vehicle-cursor-query';
    return 'vehicle-query';
  }
  if (sql.includes('set_config') || sql.startsWith('SET LOCAL')) return 'transaction-context';
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return 'transaction-control';
  return 'other';
}

function summarize({ calls, totalMs, values }) {
  values.sort((left, right) => left - right);
  return {
    calls,
    totalMs: Number(totalMs.toFixed(1)),
    sampled: values.length,
    p95Ms: Number(values[Math.ceil(values.length * 0.95) - 1].toFixed(2)),
  };
}

export function capacityHttpProbe(pool) {
  const scope = new AsyncLocalStorage();
  const eventLoop = monitorEventLoopDelay({ resolution: 10 });
  let measurements;
  let initialUtilization;

  function capture(group, name, elapsed) {
    if (measurements) {
      const key = `${group}:${name}`;
      if (!measurements.has(key)) measurements.set(key, { calls: 0, totalMs: 0, values: [] });
      const sample = measurements.get(key);
      sample.calls += 1;
      sample.totalMs += elapsed;
      if (sample.values.length < sampleLimit) {
        sample.values.push(elapsed);
      } else {
        // Keep a bounded uniform sample even when the peak runs for ten minutes.
        const slot = Math.floor(Math.random() * sample.calls);
        if (slot < sampleLimit) sample.values[slot] = elapsed;
      }
    }
  }

  async function timed(group, name, run) {
    const started = performance.now();
    try {
      return await run();
    } finally {
      capture(group, name, performance.now() - started);
    }
  }

  return {
    async explain(db, authentication, owner) {
      const claims = await authentication.verify(owner.token);
      return db.actor(claims, owner.tenant.id, async ({ c }) => {
        const result = await c.query(`
          EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
          SELECT id,country,plate,verified_at FROM charging_subscription.vehicles
          WHERE account_id=$1 ORDER BY plate,id LIMIT 101
        `, [owner.tenant.id]);
        return result.rows[0]['QUERY PLAN'][0];
      });
    },
    wrap(service, db, partnerEnergy) {
      const rate = service.rate.bind(service);
      const page = service.page.bind(service);
      const transaction = db.transaction.bind(db);
      service.rate = (...args) => scope.run('rate', () => timed('rate', 'service', () => rate(...args)));
      service.page = (...args) => {
        const resource = args[2];
        const options = args[3];
        let group = resource === 'vehicles' ? 'vehicle-page' : `${resource}-page`;
        if (resource === 'vehicles' && options?.after) group = 'vehicle-cursor-page';
        if (resource === 'vehicles' && (options?.search || options?.verification)) group = 'vehicle-search-page';
        return scope.run(group, () => timed(group, 'service', () => page(...args)));
      };
      if (partnerEnergy) {
        const vehicles = partnerEnergy.vehicles.bind(partnerEnergy);
        partnerEnergy.vehicles = (...args) =>
          scope.run('partner-vehicles', () => timed('partner-vehicles', 'service', () => vehicles(...args)));
      }
      db.transaction = (role, work) => scope.run(scope.getStore() ?? role, () => transaction(role, work));
    },
    pool: {
      async connect() {
        const group = scope.getStore() ?? 'unscoped';
        const client = await timed(group, 'pool-wait', () => pool.connect());
        return {
          query(sql, args) { return timed(group, queryType(sql), () => client.query(sql, args)); },
          release() { return client.release(); },
        };
      },
    },
    start() {
      measurements = new Map();
      eventLoop.enable();
      eventLoop.reset();
      initialUtilization = performance.eventLoopUtilization();
    },
    stop() {
      eventLoop.disable();
      const output = {
        eventLoopUtilization: Number(performance.eventLoopUtilization(initialUtilization).utilization.toFixed(3)),
        eventLoopP95Ms: Number((eventLoop.percentile(95) / 1_000_000).toFixed(1)),
        stages: Object.fromEntries([...measurements].sort().map(([name, values]) => [name, summarize(values)])),
      };
      measurements = null;
      return output;
    },
  };
}
