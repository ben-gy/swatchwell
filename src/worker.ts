// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * Dedicated worker: median-cut extraction off the main thread. Pixels arrive as
 * a transferred ArrayBuffer so nothing is copied. The image never leaves the
 * device — this worker is same-origin and has no network access.
 */

import { medianCut, dedupePerceptual } from './extract';
import type { ExtractRequest, WorkerResponse } from './types';

self.onmessage = (ev: MessageEvent<ExtractRequest>) => {
  const msg = ev.data;
  if (!msg || msg.type !== 'extract') return;
  const { id, buffer, count } = msg;
  try {
    const data = new Uint8ClampedArray(buffer);
    post({ type: 'progress', id, ratio: 0.2 });
    // Over-extract, then perceptually de-dupe down toward the requested count so
    // near-identical boxes don't waste slots.
    const raw = medianCut(data, Math.min(count + 6, 48));
    post({ type: 'progress', id, ratio: 0.8 });
    const deduped = dedupePerceptual(raw, 4).slice(0, count);
    post({ type: 'result', id, colors: deduped });
  } catch (err) {
    post({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
};

function post(msg: WorkerResponse): void {
  (self as unknown as Worker).postMessage(msg);
}
