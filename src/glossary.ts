// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * Click-to-define glossary. Any element with `data-term` becomes a dotted link;
 * clicking it shows a small tooltip with the definition. Escape or an outside
 * click dismisses it.
 */

export const GLOSSARY: Record<string, string> = {
  hex: 'A colour written as #rrggbb — two hexadecimal digits each for red, green and blue (0–255). The lingua franca of CSS and design tools.',
  hsl: 'Hue, Saturation, Lightness — a way of describing a colour that maps more naturally to how people think about it than raw red/green/blue.',
  srgb: 'The standard colour space of the web and most screens. Swatchwell treats every pixel as sRGB when converting to perceptual space.',
  lab: 'CIE L*a*b* — a colour space built so that equal numeric steps look like equal perceptual steps. We convert to Lab to judge how similar two colours really look.',
  ciede2000:
    'The current international standard for measuring the perceptual difference between two colours. Swatchwell uses it to find the nearest named colour to a pick.',
  'median-cut':
    'A classic algorithm for reducing an image to a small palette: repeatedly split the cloud of pixel colours along its widest axis, then average each resulting box.',
  ase: 'Adobe Swatch Exchange — the palette file format Photoshop, Illustrator and InDesign import. Swatchwell writes it byte-for-byte in your browser.',
  gpl: 'GIMP Palette — a plain-text palette format read by GIMP, Inkscape and Krita.',
  eyedropper:
    'A browser API (desktop Chrome/Edge) that lets a web page sample the colour of any pixel on your screen, with your permission, without a screenshot.',
  reticle: 'The small target in the centre of the camera view. Swatchwell averages the pixels under it so one tap gives a stable colour instead of a noisy single pixel.',
};

let tip: HTMLElement | null = null;

function ensureTip(): HTMLElement {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'glossary-tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  return tip;
}

export function initGlossary(): void {
  document.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    const link = target.closest('[data-term]') as HTMLElement | null;
    if (link) {
      ev.preventDefault();
      const term = (link.dataset.term ?? '').toLowerCase();
      const def = GLOSSARY[term];
      if (!def) return;
      const t = ensureTip();
      t.textContent = def;
      t.hidden = false;
      const rect = link.getBoundingClientRect();
      const top = rect.bottom + window.scrollY + 6;
      t.style.top = `${top}px`;
      const left = Math.min(rect.left + window.scrollX, window.innerWidth - 320);
      t.style.left = `${Math.max(8, left)}px`;
      return;
    }
    if (tip && !tip.hidden && !target.closest('.glossary-tip')) {
      tip.hidden = true;
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && tip && !tip.hidden) tip.hidden = true;
  });
}
