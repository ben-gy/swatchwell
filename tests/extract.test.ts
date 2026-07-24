// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { sampleRegion, medianCut, dedupePerceptual } from '../src/extract';
import type { RGB } from '../src/color';

/** Build an RGBA buffer of solid colour. */
function solid(w: number, h: number, c: RGB, a = 255): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = c.r; d[i * 4 + 1] = c.g; d[i * 4 + 2] = c.b; d[i * 4 + 3] = a;
  }
  return d;
}

describe('sampleRegion', () => {
  it('averages a solid region to that colour', () => {
    const d = solid(8, 8, { r: 40, g: 80, b: 160 });
    expect(sampleRegion(d, 8, 8, 4, 4, 2)).toEqual({ r: 40, g: 80, b: 160 });
  });
  it('averages a two-tone region', () => {
    // left half black, right half white; sample straddling the seam.
    const w = 10, h = 4;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = x < w / 2 ? 0 : 255;
        const i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
    }
    const out = sampleRegion(d, w, h, 5, 2, 5)!;
    expect(out.r).toBeGreaterThan(100);
    expect(out.r).toBeLessThan(160);
  });
  it('ignores fully transparent pixels and returns null when all transparent', () => {
    const d = solid(4, 4, { r: 10, g: 10, b: 10 }, 0);
    expect(sampleRegion(d, 4, 4, 2, 2, 2)).toBeNull();
  });
  it('clamps the region to bounds', () => {
    const d = solid(4, 4, { r: 200, g: 100, b: 50 });
    expect(sampleRegion(d, 4, 4, 0, 0, 3)).toEqual({ r: 200, g: 100, b: 50 });
  });
});

describe('medianCut', () => {
  it('returns empty for empty input or zero count', () => {
    expect(medianCut(new Uint8ClampedArray(0), 4)).toEqual([]);
    expect(medianCut(solid(2, 2, { r: 1, g: 1, b: 1 }), 0)).toEqual([]);
  });
  it('extracts a single colour from a solid image', () => {
    const out = medianCut(solid(20, 20, { r: 128, g: 64, b: 200 }), 4);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].r).toBeCloseTo(128, -1);
    expect(out[0].b).toBeCloseTo(200, -1);
  });
  it('separates two dominant colours', () => {
    const w = 40, h = 40;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const red = x < w / 2;
        const i = (y * w + x) * 4;
        d[i] = red ? 220 : 20;
        d[i + 1] = 20;
        d[i + 2] = red ? 20 : 220;
        d[i + 3] = 255;
      }
    }
    const out = medianCut(d, 2);
    expect(out.length).toBe(2);
    const hasRed = out.some((c) => c.r > 150 && c.b < 80);
    const hasBlue = out.some((c) => c.b > 150 && c.r < 80);
    expect(hasRed).toBe(true);
    expect(hasBlue).toBe(true);
  });
});

describe('dedupePerceptual', () => {
  it('collapses near-identical colours but keeps distinct ones', () => {
    const list: RGB[] = [
      { r: 100, g: 100, b: 100 },
      { r: 101, g: 100, b: 99 }, // imperceptibly different
      { r: 10, g: 200, b: 40 },
    ];
    const out = dedupePerceptual(list, 5);
    expect(out.length).toBe(2);
  });
  it('keeps everything when nothing is close', () => {
    const list: RGB[] = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
    ];
    expect(dedupePerceptual(list, 5).length).toBe(3);
  });
});
