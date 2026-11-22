import { createHistogram } from 'node:perf_hooks';

const largestDelayMicroseconds = 24 * 60 * 60 * 1_000_000;

export function percentile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  const value = ordered[Math.ceil(fraction * ordered.length) - 1];
  return value === undefined ? null : Math.round(value * 10) / 10;
}

export function capacityTimings(bounded = false) {
  if (!bounded) {
    const samples = [];
    return {
      add(milliseconds) { samples.push(milliseconds); },
      get count() { return samples.length; },
      percentile(fraction) { return percentile(samples, fraction); },
    };
  }
  const histogram = createHistogram({ lowest: 1, highest: largestDelayMicroseconds, figures: 3 });
  let clipped = 0;
  return {
    add(milliseconds) {
      const microseconds = Math.max(1, Math.round(milliseconds * 1_000));
      if (microseconds > largestDelayMicroseconds) clipped += 1;
      histogram.record(Math.min(microseconds, largestDelayMicroseconds));
    },
    get count() { return histogram.count; },
    get clipped() { return clipped; },
    percentile(fraction) {
      return histogram.count === 0 ? null : Math.round(histogram.percentile(fraction * 100) / 100) / 10;
    },
  };
}
