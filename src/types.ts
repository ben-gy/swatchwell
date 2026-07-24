// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

import type { RGB } from './color';

export interface Swatch {
  id: string;
  rgb: RGB;
  hex: string;
  /** Nearest named colour (display). */
  name: string;
  /** CIEDE2000 distance to that named colour. */
  nameDistance: number;
  /** Where it came from — for the event log / provenance. */
  source: 'camera' | 'image' | 'screen' | 'manual';
}

export type InputMode = 'camera' | 'image';

/** Message contract for the extraction worker. */
export interface ExtractRequest {
  type: 'extract';
  id: number;
  width: number;
  height: number;
  count: number;
  buffer: ArrayBuffer; // RGBA pixels (transferred)
}

export interface ExtractProgress {
  type: 'progress';
  id: number;
  ratio: number; // 0..1
}

export interface ExtractResult {
  type: 'result';
  id: number;
  colors: RGB[];
}

export interface ExtractError {
  type: 'error';
  id: number;
  message: string;
}

export type WorkerResponse = ExtractProgress | ExtractResult | ExtractError;
