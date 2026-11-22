import { statfs } from 'node:fs/promises';

const mebibyte = 1_048_576;
const minimumFreeMiB = 512;

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
