// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * Output delivery — everything that hands the user their artefact: download,
 * copy, share, and rendering a PNG swatch sheet on a canvas. All local; the only
 * "destination" is the user's own disk, clipboard or OS share sheet.
 */

import type { Swatch } from './types';
import { readableTextOn } from './color';

/** Trigger a browser download of a blob, preferring the File System Access API. */
export async function saveBlob(blob: Blob, filename: string): Promise<'saved' | 'downloaded'> {
  const picker = (window as unknown as {
    showSaveFilePicker?: (opts: unknown) => Promise<{
      createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  }).showSaveFilePicker;
  if (picker) {
    try {
      const ext = filename.slice(filename.lastIndexOf('.'));
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: 'Palette file', accept: { [blob.type || 'application/octet-stream']: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // fall through to anchor download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): Promise<'saved' | 'downloaded'> {
  return saveBlob(new Blob([text], { type: mime }), filename);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    const Item = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (!Item || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new Item({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

export function canShareFiles(files: File[]): boolean {
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  return typeof navigator.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files });
}

export async function shareFile(file: File, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch {
    return false;
  }
}

/** Render a PNG swatch sheet to a Blob. Columns wrap at 6. */
export async function renderSwatchSheetPNG(swatches: Swatch[], scale = 2): Promise<Blob> {
  const cellW = 220;
  const swatchH = 150;
  const labelH = 78;
  const cellH = swatchH + labelH;
  const cols = Math.min(swatches.length, 5) || 1;
  const rows = Math.ceil(swatches.length / cols);
  const pad = 28;
  const width = cols * cellW + pad * 2;
  const height = rows * cellH + pad * 2 + 44;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  ctx.fillStyle = '#fbfbfa';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#111318';
  ctx.font = '600 20px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('Swatchwell palette', pad, pad - 6);
  ctx.fillStyle = '#6b7280';
  ctx.font = '13px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.fillText('swatchwell.benrichardson.dev', width - pad - 210, pad - 2);

  swatches.forEach((s, i) => {
    const cx = pad + (i % cols) * cellW;
    const cy = pad + 44 + Math.floor(i / cols) * cellH;
    const w = cellW - 16;

    ctx.fillStyle = s.hex;
    roundRect(ctx, cx, cy, w, swatchH, 10);
    ctx.fill();

    // hex overlaid on the swatch
    ctx.fillStyle = readableTextOn(s.rgb);
    ctx.font = '600 16px "SF Mono", "Fira Code", Consolas, monospace';
    ctx.fillText(s.hex.toUpperCase(), cx + 12, cy + swatchH - 26);

    // label block
    ctx.fillStyle = '#111318';
    ctx.font = '600 15px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
    ctx.fillText(s.name, cx + 2, cy + swatchH + 12);
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px "SF Mono", "Fira Code", Consolas, monospace';
    ctx.fillText(`rgb(${s.rgb.r}, ${s.rgb.g}, ${s.rgb.b})`, cx + 2, cy + swatchH + 36);
  });

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
