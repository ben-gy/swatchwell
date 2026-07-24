// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  parseHex, rgbToHex, rgbToHsl, hslToRgb, rgbToLab, ciede2000, readableTextOn,
  type Lab,
} from '../src/color';

describe('hex', () => {
  it('round-trips a colour', () => {
    expect(rgbToHex({ r: 47, g: 107, b: 255 })).toBe('#2f6bff');
    expect(parseHex('#2f6bff')).toEqual({ r: 47, g: 107, b: 255 });
  });
  it('parses shorthand, no-hash, uppercase and alpha forms', () => {
    expect(parseHex('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
    expect(parseHex('FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#11223344')).toEqual({ r: 0x11, g: 0x22, b: 0x33 });
    expect(parseHex('#1234')).toEqual({ r: 0x11, g: 0x22, b: 0x33 });
  });
  it('rejects malformed input', () => {
    expect(parseHex('')).toBeNull();
    expect(parseHex('#gggggg')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('not a colour')).toBeNull();
    expect(parseHex('#2f6bf')).toBeNull();
  });
  it('clamps out-of-range channels when formatting', () => {
    expect(rgbToHex({ r: 300, g: -20, b: 128 })).toBe('#ff0080');
  });
});

describe('hsl', () => {
  it('converts pure red', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
  });
  it('round-trips greys and colours approximately', () => {
    for (const rgb of [{ r: 128, g: 128, b: 128 }, { r: 12, g: 200, b: 90 }, { r: 250, g: 40, b: 180 }]) {
      const back = hslToRgb(rgbToHsl(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(3);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(3);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(3);
    }
  });
  it('handles white and black', () => {
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 });
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
  });
});

describe('lab + ciede2000', () => {
  it('is zero for identical colours', () => {
    const lab = rgbToLab({ r: 90, g: 140, b: 210 });
    expect(ciede2000(lab, lab)).toBeCloseTo(0, 6);
  });
  // Sharma, Wu & Dalal (2005) reference pairs.
  const cases: Array<[Lab, Lab, number]> = [
    [{ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 }, 2.0425],
    [{ L: 50, a: 3.1571, b: -77.2803 }, { L: 50, a: 0, b: -82.7485 }, 2.8615],
    [{ L: 50, a: 2.8361, b: -74.02 }, { L: 50, a: 0, b: -82.7485 }, 3.4412],
    [{ L: 50, a: -1.3802, b: -84.2814 }, { L: 50, a: 0, b: -82.7485 }, 1.0],
    [{ L: 50, a: 2.5, b: 0 }, { L: 50, a: 0, b: -2.5 }, 4.3065],
  ];
  for (const [l1, l2, expected] of cases) {
    it(`matches reference ΔE ≈ ${expected}`, () => {
      expect(ciede2000(l1, l2)).toBeCloseTo(expected, 3);
    });
  }
  it('is symmetric', () => {
    const a = rgbToLab({ r: 10, g: 20, b: 30 });
    const b = rgbToLab({ r: 200, g: 30, b: 40 });
    expect(ciede2000(a, b)).toBeCloseTo(ciede2000(b, a), 6);
  });
});

describe('readableTextOn', () => {
  it('picks dark text on light backgrounds and light on dark', () => {
    expect(readableTextOn({ r: 255, g: 255, b: 255 })).toBe('#111318');
    expect(readableTextOn({ r: 0, g: 0, b: 0 })).toBe('#ffffff');
    expect(readableTextOn({ r: 20, g: 20, b: 120 })).toBe('#ffffff');
  });
});
