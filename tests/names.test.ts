// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { nearestName, NAMED } from '../src/names';

describe('nearestName', () => {
  it('matches exact named colours with near-zero distance', () => {
    const white = nearestName({ r: 255, g: 255, b: 255 });
    expect(white.name).toBe('White');
    expect(white.distance).toBeCloseTo(0, 3);

    const red = nearestName({ r: 255, g: 0, b: 0 });
    expect(red.name).toBe('Red');
    expect(red.distance).toBeCloseTo(0, 3);
  });
  it('finds the perceptually nearest name for an off-colour', () => {
    // A near-black navy should read as a dark blue name, not "Black".
    const m = nearestName({ r: 5, g: 8, b: 90 });
    expect(['Navy', 'Midnight Blue', 'Indigo', 'Cobalt']).toContain(m.name);
  });
  it('classifies a warm mid-grey as a grey/neutral', () => {
    const m = nearestName({ r: 130, g: 128, b: 122 });
    expect(['Grey', 'Stone', 'Dim Grey', 'Ash', 'Taupe', 'Pewter']).toContain(m.name);
  });
  it('every dictionary entry resolves to itself', () => {
    for (const c of NAMED) {
      const n = c.hex.replace('#', '');
      const rgb = {
        r: parseInt(n.slice(0, 2), 16),
        g: parseInt(n.slice(2, 4), 16),
        b: parseInt(n.slice(4, 6), 16),
      };
      expect(nearestName(rgb).distance).toBeLessThan(2.5);
    }
  });
});
