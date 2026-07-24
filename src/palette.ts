// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * The working palette — an observable list of swatches. Kept device-local:
 * mirrored to localStorage purely so a reload doesn't lose your picks. It is
 * never transmitted anywhere.
 */

import type { RGB } from './color';
import { rgbToHex } from './color';
import { nearestName } from './names';
import type { Swatch } from './types';

const STORAGE_KEY = 'swatchwell.palette.v1';

let swatches: Swatch[] = [];
let listeners: Array<(list: Swatch[]) => void> = [];
let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `s${idCounter}_${swatches.length}`;
}

export function makeSwatch(rgb: RGB, source: Swatch['source']): Swatch {
  const hex = rgbToHex(rgb);
  const match = nearestName(rgb);
  return { id: nextId(), rgb, hex, name: match.name, nameDistance: match.distance, source };
}

export function getSwatches(): Swatch[] {
  return swatches.slice();
}

export function subscribe(fn: (list: Swatch[]) => void): () => void {
  listeners.push(fn);
  fn(getSwatches());
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function emit(): void {
  const snap = getSwatches();
  for (const l of listeners) l(snap);
  persist();
}

export function addColor(rgb: RGB, source: Swatch['source']): Swatch {
  const sw = makeSwatch(rgb, source);
  swatches.push(sw);
  emit();
  return sw;
}

export function addColors(rgbs: RGB[], source: Swatch['source']): void {
  for (const rgb of rgbs) swatches.push(makeSwatch(rgb, source));
  emit();
}

export function removeSwatch(id: string): void {
  swatches = swatches.filter((s) => s.id !== id);
  emit();
}

export function clearPalette(): void {
  swatches = [];
  emit();
}

export function renameSwatch(id: string, name: string): void {
  const s = swatches.find((x) => x.id === id);
  if (s) {
    s.name = name.trim() || s.name;
    emit();
  }
}

/** Move a swatch from one index to another (drag reorder). */
export function moveSwatch(from: number, to: number): void {
  if (from < 0 || from >= swatches.length) return;
  const clampedTo = Math.max(0, Math.min(swatches.length - 1, to));
  const [item] = swatches.splice(from, 1);
  swatches.splice(clampedTo, 0, item);
  emit();
}

function persist(): void {
  try {
    const data = swatches.map((s) => ({ hex: s.hex, name: s.name, source: s.source }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* private mode / quota — palette simply won't survive a reload */
  }
}

/** Restore a persisted palette on boot. Silently ignores malformed data. */
export function restore(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Array<{ hex: string; name?: string; source?: string }>;
    if (!Array.isArray(data)) return;
    for (const item of data) {
      const rgb = hexToRgb(item.hex);
      if (!rgb) continue;
      const sw = makeSwatch(rgb, (item.source as Swatch['source']) ?? 'manual');
      if (item.name) sw.name = item.name;
      swatches.push(sw);
    }
    emit();
  } catch {
    /* ignore */
  }
}

function hexToRgb(hex: string): RGB | null {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
