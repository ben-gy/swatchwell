// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * Pixel-level derivations, kept pure so they can be unit-tested exhaustively and
 * driven with synthetic samples in the browser pass (the automation can't wave a
 * camera at a wall). Two jobs:
 *   1. sampleRegion — the camera reticle: average the colour under a small box.
 *   2. medianCut    — extract N dominant colours from an image (the palette).
 */

import { type RGB, rgbToLab, ciede2000 } from './color';

/**
 * Average the opaque pixels in a square region of an RGBA buffer, centred on
 * (cx, cy) with the given radius (in pixels). Averaging denoises sensor grain so
 * a single tap yields a stable colour. Returns null if the region has no opaque
 * pixels (fully transparent / out of bounds).
 */
export function sampleRegion(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius = 4,
): RGB | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a === 0) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  if (n === 0) return null;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

interface Box {
  pixels: number[]; // indices of packed rgb entries
}

/**
 * Median-cut colour quantisation. Returns up to `count` dominant colours from an
 * RGBA buffer, most-populous first. Transparent pixels are ignored. The buffer is
 * strided so very large images stay fast without changing the result materially.
 */
export function medianCut(
  data: Uint8ClampedArray,
  count: number,
  maxSamples = 60000,
): RGB[] {
  if (count < 1) return [];
  const total = Math.floor(data.length / 4);
  if (total === 0) return [];

  // Collect opaque pixels as packed [r,g,b] triples, strided to a cap.
  const stride = Math.max(1, Math.floor(total / maxSamples));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let p = 0; p < total; p += stride) {
    const i = p * 4;
    if (data[i + 3] < 8) continue; // skip (near-)transparent
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  }
  const nPix = rs.length;
  if (nPix === 0) return [];

  const allIdx = Array.from({ length: nPix }, (_, i) => i);
  let boxes: Box[] = [{ pixels: allIdx }];

  const rangeOf = (idx: number[]): { chan: 0 | 1 | 2; span: number } => {
    let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
    for (const i of idx) {
      const rv = rs[i], gv = gs[i], bv = bs[i];
      if (rv < rmin) rmin = rv;
      if (rv > rmax) rmax = rv;
      if (gv < gmin) gmin = gv;
      if (gv > gmax) gmax = gv;
      if (bv < bmin) bmin = bv;
      if (bv > bmax) bmax = bv;
    }
    const dr = rmax - rmin, dg = gmax - gmin, db = bmax - bmin;
    if (dr >= dg && dr >= db) return { chan: 0, span: dr };
    if (dg >= db) return { chan: 1, span: dg };
    return { chan: 2, span: db };
  };

  const chanArr = (c: 0 | 1 | 2) => (c === 0 ? rs : c === 1 ? gs : bs);

  while (boxes.length < count) {
    // Pick the box with the greatest colour span to split.
    let target = -1;
    let bestSpan = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].pixels.length < 2) continue;
      const { span } = rangeOf(boxes[i].pixels);
      if (span > bestSpan) {
        bestSpan = span;
        target = i;
      }
    }
    if (target < 0 || bestSpan <= 0) break; // nothing left to split

    const box = boxes[target];
    const { chan } = rangeOf(box.pixels);
    const arr = chanArr(chan);
    const sorted = box.pixels.slice().sort((a, c) => arr[a] - arr[c]);
    const mid = sorted.length >> 1;
    boxes.splice(target, 1, { pixels: sorted.slice(0, mid) }, { pixels: sorted.slice(mid) });
  }

  const result = boxes
    .filter((box) => box.pixels.length > 0)
    .map((box) => {
      let r = 0, g = 0, b = 0;
      for (const i of box.pixels) {
        r += rs[i];
        g += gs[i];
        b += bs[i];
      }
      const n = box.pixels.length;
      return { rgb: { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }, n };
    });

  result.sort((a, b) => b.n - a.n);
  return result.map((x) => x.rgb);
}

/**
 * Drop perceptual near-duplicates from a colour list, keeping the first of each
 * cluster. `threshold` is a CIEDE2000 distance (~5 collapses barely-distinct
 * colours; higher is more aggressive).
 */
export function dedupePerceptual(colors: RGB[], threshold = 5): RGB[] {
  const kept: { rgb: RGB; lab: ReturnType<typeof rgbToLab> }[] = [];
  for (const c of colors) {
    const lab = rgbToLab(c);
    if (kept.some((k) => ciede2000(lab, k.lab) < threshold)) continue;
    kept.push({ rgb: c, lab });
  }
  return kept.map((k) => k.rgb);
}
