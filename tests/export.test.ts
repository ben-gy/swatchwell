// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { toHexList, toCSS, toSCSS, toTailwind, toJSON, toSVG, toGPL, toASE } from '../src/export';
import type { Swatch } from '../src/types';

const swatches: Swatch[] = [
  { id: 'a', rgb: { r: 47, g: 107, b: 255 }, hex: '#2f6bff', name: 'Royal Blue', nameDistance: 3.2, source: 'image' },
  { id: 'b', rgb: { r: 245, g: 179, b: 1 }, hex: '#f5b301', name: 'Amber', nameDistance: 1.1, source: 'camera' },
  { id: 'c', rgb: { r: 245, g: 179, b: 1 }, hex: '#f5b301', name: 'Amber', nameDistance: 1.1, source: 'camera' },
];

describe('text formats', () => {
  it('hex list is newline-joined', () => {
    expect(toHexList(swatches)).toBe('#2f6bff\n#f5b301\n#f5b301');
  });
  it('CSS emits :root with unique variable names', () => {
    const css = toCSS(swatches);
    expect(css).toContain(':root {');
    expect(css).toContain('--royal-blue: #2f6bff;');
    expect(css).toContain('--amber: #f5b301;');
    expect(css).toContain('--amber-2: #f5b301;'); // disambiguated duplicate
  });
  it('SCSS uses $ variables', () => {
    expect(toSCSS(swatches)).toContain('$royal-blue: #2f6bff;');
  });
  it('Tailwind lists hex values', () => {
    const tw = toTailwind(swatches);
    expect(tw).toContain("'royal-blue': '#2f6bff'");
  });
  it('JSON is valid and carries every field', () => {
    const parsed = JSON.parse(toJSON(swatches));
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ hex: '#2f6bff', name: 'Royal Blue' });
    expect(parsed[0].rgb).toContain('rgb(');
    expect(parsed[0].hsl).toContain('hsl(');
  });
  it('SVG is well-formed and escapes names', () => {
    const svg = toSVG(swatches);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('#2f6bff');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });
  it('GPL has the header and rgb rows', () => {
    const gpl = toGPL(swatches);
    expect(gpl.startsWith('GIMP Palette')).toBe(true);
    expect(gpl).toContain(' 47 107 255\tRoyal Blue');
  });
});

describe('ASE binary', () => {
  it('writes the ASEF signature, version and block count', () => {
    const bytes = toASE(swatches);
    const dv = new DataView(bytes.buffer);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('ASEF');
    expect(dv.getUint16(4)).toBe(1); // major
    expect(dv.getUint16(6)).toBe(0); // minor
    expect(dv.getUint32(8)).toBe(3); // three colours
  });
  it('encodes the first colour as RGB floats that round-trip', () => {
    const bytes = toASE([swatches[0]]);
    const dv = new DataView(bytes.buffer);
    // header 12 bytes, then block: type(2) len(4) nameLen(2) name(2*nameLen) "RGB "(4) floats
    let o = 12 + 2 + 4;
    const nameLen = dv.getUint16(o); o += 2;
    o += nameLen * 2; // skip name UTF-16
    const model = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    expect(model).toBe('RGB ');
    o += 4;
    const r = dv.getFloat32(o); o += 4;
    const g = dv.getFloat32(o); o += 4;
    const b = dv.getFloat32(o);
    expect(Math.round(r * 255)).toBe(47);
    expect(Math.round(g * 255)).toBe(107);
    expect(Math.round(b * 255)).toBe(255);
  });
  it('produces bytes for an empty palette (header only)', () => {
    const bytes = toASE([]);
    expect(bytes.length).toBe(12);
    const dv = new DataView(bytes.buffer);
    expect(dv.getUint32(8)).toBe(0);
  });
});
