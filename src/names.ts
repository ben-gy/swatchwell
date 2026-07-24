// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * A curated named-colour dictionary (CSS named colours plus a handful of common
 * descriptive names) and a perceptual nearest-match. Matching is done in Lab
 * space with CIEDE2000, so "closest name" means closest to the human eye, not
 * closest in RGB. Lab coordinates are precomputed once at module load.
 */

import { type RGB, type Lab, parseHex, rgbToLab, ciede2000 } from './color';

interface NamedColor {
  name: string;
  hex: string;
  lab: Lab;
}

// Base list: [display name, hex]. Kept intentionally readable — these are the
// words a person would actually reach for.
const RAW: Array<[string, string]> = [
  ['Black', '#000000'], ['Charcoal', '#36454f'], ['Dim Grey', '#696969'],
  ['Grey', '#808080'], ['Silver', '#c0c0c0'], ['Gainsboro', '#dcdcdc'],
  ['White Smoke', '#f5f5f5'], ['White', '#ffffff'], ['Snow', '#fffafa'],
  ['Ivory', '#fffff0'], ['Beige', '#f5f5dc'], ['Cream', '#fdfbd4'],
  ['Linen', '#faf0e6'], ['Bone', '#e3dac9'],
  ['Red', '#ff0000'], ['Crimson', '#dc143c'], ['Fire Brick', '#b22222'],
  ['Dark Red', '#8b0000'], ['Maroon', '#800000'], ['Brick', '#9c4a2a'],
  ['Tomato', '#ff6347'], ['Coral', '#ff7f50'], ['Salmon', '#fa8072'],
  ['Indian Red', '#cd5c5c'], ['Rose', '#ff007f'], ['Ruby', '#9b111e'],
  ['Orange Red', '#ff4500'], ['Orange', '#ffa500'], ['Dark Orange', '#ff8c00'],
  ['Pumpkin', '#ff7518'], ['Amber', '#ffbf00'], ['Tangerine', '#f28500'],
  ['Peach', '#ffcba4'], ['Apricot', '#fbceb1'], ['Rust', '#b7410e'],
  ['Gold', '#ffd700'], ['Goldenrod', '#daa520'], ['Yellow', '#ffff00'],
  ['Mustard', '#e1ad01'], ['Khaki', '#f0e68c'], ['Lemon', '#fff44f'],
  ['Cream Yellow', '#fdfd96'], ['Wheat', '#f5deb3'], ['Sand', '#c2b280'],
  ['Chartreuse', '#7fff00'], ['Lime', '#bfff00'], ['Yellow Green', '#9acd32'],
  ['Olive', '#808000'], ['Olive Drab', '#6b8e23'], ['Moss', '#8a9a5b'],
  ['Green', '#008000'], ['Forest Green', '#228b22'], ['Lime Green', '#32cd32'],
  ['Sea Green', '#2e8b57'], ['Emerald', '#50c878'], ['Mint', '#98ff98'],
  ['Sage', '#9caf88'], ['Fern', '#4f7942'], ['Dark Green', '#006400'],
  ['Spring Green', '#00ff7f'], ['Jade', '#00a86b'], ['Teal', '#008080'],
  ['Pine', '#01796f'], ['Turquoise', '#40e0d0'], ['Aquamarine', '#7fffd4'],
  ['Cyan', '#00ffff'], ['Aqua', '#00ced1'], ['Sky Blue', '#87ceeb'],
  ['Light Blue', '#add8e6'], ['Powder Blue', '#b0e0e6'], ['Cornflower', '#6495ed'],
  ['Steel Blue', '#4682b4'], ['Cerulean', '#2a52be'], ['Azure', '#007fff'],
  ['Blue', '#0000ff'], ['Royal Blue', '#4169e1'], ['Cobalt', '#0047ab'],
  ['Navy', '#000080'], ['Midnight Blue', '#191970'], ['Denim', '#1560bd'],
  ['Slate Blue', '#6a5acd'], ['Periwinkle', '#ccccff'], ['Indigo', '#4b0082'],
  ['Violet', '#8f00ff'], ['Purple', '#800080'], ['Amethyst', '#9966cc'],
  ['Lavender', '#e6e6fa'], ['Lilac', '#c8a2c8'], ['Mauve', '#e0b0ff'],
  ['Orchid', '#da70d6'], ['Magenta', '#ff00ff'], ['Fuchsia', '#ff00ff'],
  ['Plum', '#8e4585'], ['Wine', '#722f37'], ['Eggplant', '#614051'],
  ['Pink', '#ffc0cb'], ['Hot Pink', '#ff69b4'], ['Deep Pink', '#ff1493'],
  ['Blush', '#de5d83'], ['Rose Pink', '#f6a5c0'], ['Bubblegum', '#ffc1cc'],
  ['Brown', '#8b4513'], ['Chocolate', '#7b3f00'], ['Coffee', '#6f4e37'],
  ['Sienna', '#a0522d'], ['Chestnut', '#954535'], ['Mahogany', '#c04000'],
  ['Tan', '#d2b48c'], ['Camel', '#c19a6b'], ['Taupe', '#483c32'],
  ['Caramel', '#af6e4d'], ['Terracotta', '#e2725b'], ['Clay', '#b66a50'],
  ['Slate', '#708090'], ['Gunmetal', '#2a3439'], ['Pewter', '#8a9597'],
  ['Ash', '#b2beb5'], ['Stone', '#928e85'], ['Fog', '#d7d7d0'],
];

export const NAMED: NamedColor[] = RAW.map(([name, hex]) => {
  const rgb = parseHex(hex) as RGB; // hand-authored, always valid
  return { name, hex, lab: rgbToLab(rgb) };
});

export interface NameMatch {
  name: string;
  hex: string;
  /** CIEDE2000 distance — 0 is exact, < 2 is imperceptible, < 10 is close. */
  distance: number;
}

/** Nearest named colour to an RGB triple, by CIEDE2000 in Lab space. */
export function nearestName(rgb: RGB): NameMatch {
  const lab = rgbToLab(rgb);
  let best = NAMED[0];
  let bestD = Infinity;
  for (const c of NAMED) {
    const d = ciede2000(lab, c.lab);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { name: best.name, hex: best.hex, distance: bestD };
}
