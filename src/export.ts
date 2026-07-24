// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * Palette serialisers. Everything a user leaves with — the artefact — is built
 * here from a plain list of swatches. Text formats are pure string builders;
 * ASE is a pure byte builder. All are unit-tested.
 */

import type { Swatch } from './types';
import { rgbToHsl, formatHsl, formatRgb } from './color';

/** A CSS-safe, unique-ish slug for a colour, e.g. "Sky Blue" → "sky-blue". */
function slug(name: string, index: number): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || `color-${index + 1}`;
}

/** Disambiguate duplicate slugs by suffixing -2, -3, … */
function uniqueSlugs(swatches: Swatch[]): string[] {
  const seen = new Map<string, number>();
  return swatches.map((s, i) => {
    const base = slug(s.name, i);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

export function toHexList(swatches: Swatch[]): string {
  return swatches.map((s) => s.hex).join('\n');
}

export function toCSS(swatches: Swatch[]): string {
  const slugs = uniqueSlugs(swatches);
  const lines = swatches.map(
    (s, i) => `  --${slugs[i]}: ${s.hex}; /* ${s.name} */`,
  );
  return `:root {\n${lines.join('\n')}\n}`;
}

export function toSCSS(swatches: Swatch[]): string {
  const slugs = uniqueSlugs(swatches);
  return swatches
    .map((s, i) => `$${slugs[i]}: ${s.hex}; // ${s.name}`)
    .join('\n');
}

export function toTailwind(swatches: Swatch[]): string {
  const slugs = uniqueSlugs(swatches);
  const entries = swatches.map((s, i) => `        '${slugs[i]}': '${s.hex}',`);
  return `// tailwind.config.js — theme.extend.colors\ncolors: {\n${entries.join('\n')}\n}`;
}

export function toJSON(swatches: Swatch[]): string {
  return JSON.stringify(
    swatches.map((s) => {
      const hsl = rgbToHsl(s.rgb);
      return {
        hex: s.hex,
        rgb: formatRgb(s.rgb),
        hsl: formatHsl(hsl),
        name: s.name,
      };
    }),
    null,
    2,
  );
}

export function toSVG(swatches: Swatch[]): string {
  const sw = 120;
  const sh = 150;
  const cols = Math.min(swatches.length, 6) || 1;
  const rows = Math.ceil(swatches.length / cols);
  const width = cols * sw;
  const height = rows * sh;
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cells = swatches
    .map((s, i) => {
      const cx = (i % cols) * sw;
      const cy = Math.floor(i / cols) * sh;
      const textFill =
        0.2126 * s.rgb.r + 0.7152 * s.rgb.g + 0.0722 * s.rgb.b > 150
          ? '#111318'
          : '#ffffff';
      return `  <g transform="translate(${cx},${cy})">
    <rect width="${sw}" height="${sw}" fill="${s.hex}"/>
    <rect y="${sw}" width="${sw}" height="${sh - sw}" fill="#ffffff"/>
    <text x="8" y="${sw - 12}" font-family="monospace" font-size="13" fill="${textFill}">${s.hex}</text>
    <text x="8" y="${sw + 22}" font-family="sans-serif" font-size="12" fill="#111318">${esc(s.name)}</text>
  </g>`;
    })
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${cells}\n</svg>`;
}

/** GIMP / Inkscape / Krita palette (.gpl). */
export function toGPL(swatches: Swatch[], paletteName = 'Swatchwell'): string {
  const header = `GIMP Palette\nName: ${paletteName}\nColumns: ${Math.min(swatches.length, 8) || 1}\n#`;
  const rows = swatches.map((s) => {
    const r = String(s.rgb.r).padStart(3, ' ');
    const g = String(s.rgb.g).padStart(3, ' ');
    const b = String(s.rgb.b).padStart(3, ' ');
    return `${r} ${g} ${b}\t${s.name}`;
  });
  return [header, ...rows].join('\n') + '\n';
}

/** Adobe Swatch Exchange (.ase) — binary. Returns the file bytes. */
export function toASE(swatches: Swatch[]): Uint8Array {
  // Pre-compute each colour block's bytes.
  const blocks: Uint8Array[] = swatches.map((s) => {
    const name = s.name;
    const nameLen = name.length + 1; // include null terminator (UTF-16 units)
    const bodyLen = 2 + nameLen * 2 + 4 + 12 + 2;
    const buf = new ArrayBuffer(6 + bodyLen); // 2 (type) + 4 (len) + body
    const dv = new DataView(buf);
    let o = 0;
    dv.setUint16(o, 0x0001); // block type: colour entry
    o += 2;
    dv.setUint32(o, bodyLen); // block length
    o += 4;
    dv.setUint16(o, nameLen); // name length in UTF-16 units (incl null)
    o += 2;
    for (let i = 0; i < name.length; i++) {
      dv.setUint16(o, name.charCodeAt(i));
      o += 2;
    }
    dv.setUint16(o, 0); // null terminator
    o += 2;
    // colour model "RGB " (trailing space)
    for (const ch of 'RGB ') {
      dv.setUint8(o, ch.charCodeAt(0));
      o += 1;
    }
    dv.setFloat32(o, s.rgb.r / 255);
    o += 4;
    dv.setFloat32(o, s.rgb.g / 255);
    o += 4;
    dv.setFloat32(o, s.rgb.b / 255);
    o += 4;
    dv.setUint16(o, 0x0002); // colour type: normal
    o += 2;
    return new Uint8Array(buf);
  });

  const bodySize = blocks.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(12 + bodySize);
  const head = new DataView(out.buffer);
  out.set([0x41, 0x53, 0x45, 0x46], 0); // "ASEF"
  head.setUint16(4, 1); // major version
  head.setUint16(6, 0); // minor version
  head.setUint32(8, swatches.length); // block count
  let off = 12;
  for (const b of blocks) {
    out.set(b, off);
    off += b.length;
  }
  return out;
}
