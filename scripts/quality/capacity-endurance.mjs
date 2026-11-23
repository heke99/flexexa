import assert from 'node:assert/strict';
import { statfs } from 'node:fs/promises';
import { profile } from './capacity-profile.mjs';

const mebibyte = 1_048_576;
const minimumFreeMiB = 512;

export function projectEnduranceStorage(sample, availableBytes) {
  const telemetry = sample.telemetry?.samples?.[0];
  const history = sample.telemetry?.reconciliation?.history;
  const relationBytes = sample.endurance?.telemetryRelationBytes;
  assert.ok(sample.scope === 'local_loopback_native_postgres' && sample.phase === 'endurance'
    && sample.endurance?.scheduleCompleted && telemetry?.allObservationsCommitted && history?.available,
  'Supply a completed native endurance report with reconciled PostgreSQL telemetry history');
  assert.ok(Number.isSafeInteger(history.observations) && Number.isSafeInteger(telemetry.committed)
    && telemetry.committed > 0 && history.observations >= telemetry.committed
    && Number.isSafeInteger(relationBytes) && relationBytes > 0,
  'Endurance report must include committed observations and telemetry table/index bytes');
  assert.ok(Number.isSafeInteger(availableBytes) && availableBytes >= 0, 'Invalid available filesystem size');
  const { enduranceSeconds, normal } = profile.load;
  const projectedRows = enduranceSeconds * normal.telemetryEventsPerSecond + history.observations - telemetry.committed;
  const bytesPerRow = relationBytes / history.observations;
  const projectedRelationMiB = Math.ceil(bytesPerRow * projectedRows / mebibyte);
  const availableMiB = Math.floor(availableBytes / mebibyte);
  const minimumRequiredMiB = projectedRelationMiB + minimumFreeMiB;
  return { sampleRevision: sample.revision, sampleRows: history.observations, sampleRelationBytes: relationBytes,
    projectedRows, projectedRelationMiB, guardReserveMiB: minimumFreeMiB, minimumRequiredMiB, availableMiB,
    shortfallMiB: Math.max(0, minimumRequiredMiB - availableMiB),
    fitsRelationAndGuard: availableMiB >= minimumRequiredMiB,
    estimateScope: 'telemetry_table_and_indexes_plus_guard_excludes_wal_temp_and_other_relations' };
}

export async function enduranceStorageGuard(path) {
  const controller = new AbortController();
  let minimumObservedMiB = Infinity;
  let probeInProgress = false;
  async function probe() {
    if (probeInProgress || controller.signal.aborted) return;
    probeInProgress = true;
    try {
      const data = await statfs(path);
      const freeMiB = Math.floor(data.bsize * data.bavail / mebibyte);
      minimumObservedMiB = Math.min(minimumObservedMiB, freeMiB);
      if (freeMiB < minimumFreeMiB) controller.abort('SCRATCH_SPACE_LOW');
    } catch {
      controller.abort('SCRATCH_SPACE_UNAVAILABLE');
    } finally {
      probeInProgress = false;
    }
  }
  await probe();
  const interval = setInterval(probe, 15_000);
  interval.unref();
  const interrupt = () => controller.abort('INTERRUPTED');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  return {
    signal: controller.signal,
    stop() {
      clearInterval(interval);
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      return { minimumFreeMiB, minimumObservedMiB: Number.isFinite(minimumObservedMiB) ? minimumObservedMiB : null,
        stopReason: controller.signal.reason ?? null };
    },
  };
}
