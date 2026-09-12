import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const { summarizeFrames } = createRequire(import.meta.url)('../../../scripts/profile-summary.cjs');

describe('performance summaries', () => {
  it('attributes the next RAF interval to rendered work and excludes unavailable GPU times', () => {
    const result = summarizeFrames([
      { rendered: 0, frameMs: 16, gpuMs: 0 },
      { rendered: 1, frameMs: 20, gpuMs: 'unsupported' },
      { rendered: 1, frameMs: 50, gpuMs: 12 },
      { rendered: 1, frameMs: 30, gpuMs: 'pending' },
      { rendered: 0, frameMs: 80, gpuMs: 0 },
    ]);
    expect(result.cached).toBe(2);
    expect(result.frameMs).toEqual({ samples: 3, median: 50, p95: 80, max: 80 });
    expect(result.gpuMs).toEqual({ samples: 1, median: 12, p95: 12, max: 12 });
    expect(result.gpuStatuses).toEqual({ unsupported: 1, pending: 1 });
    expect(result.over33msRatio).toBeCloseTo(2/3);
  });
  it('does not substitute idle cadence for an unfinished rendered interval', () => {
    const result = summarizeFrames([
      { rendered: 0, frameMs: 600 },
      { rendered: 1, frameMs: 16.7, renderSubmitMs: 4 },
    ]);
    expect(result.rendered).toBe(1);
    expect(result.frameMs).toEqual({ samples: 0, median: null, p95: null, max: null });
    expect(result.over33msRatio).toBeNull();
    expect(result.renderSubmitMs.samples).toBe(1);
  });
  it('does not report zero milliseconds for an empty measurement', () => {
    expect(summarizeFrames([]).gpuMs).toEqual({ samples: 0, median: null, p95: null, max: null });
    expect(summarizeFrames([]).over33msRatio).toBeNull();
  });
});
