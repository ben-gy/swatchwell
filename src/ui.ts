// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * DOM: builds the app shell, owns the modal + toast systems, and renders the
 * palette. Heavy logic (camera, worker, colour maths) lives elsewhere — this
 * module wires the surfaces the user touches.
 */

import { icon } from './icons';
import { rgbToHsl, formatHsl, formatRgb } from './color';
import type { Swatch } from './types';
import {
  toHexList, toCSS, toSCSS, toTailwind, toJSON, toSVG, toGPL, toASE,
} from './export';
import {
  copyText, copyImage, downloadText, saveBlob, renderSwatchSheetPNG,
  canShareFiles, shareFile,
} from './deliver';

export interface Refs {
  hero: HTMLElement;
  modeTabs: HTMLElement;
  cameraPanel: HTMLElement;
  video: HTMLVideoElement;
  reticle: HTMLElement;
  startCameraBtn: HTMLButtonElement;
  captureBtn: HTMLButtonElement;
  torchBtn: HTMLButtonElement;
  cameraStatus: HTMLElement;
  imagePanel: HTMLElement;
  dropzone: HTMLElement;
  fileInput: HTMLInputElement;
  sampleBtn: HTMLButtonElement;
  imageCanvas: HTMLCanvasElement;
  imageStage: HTMLElement;
  extractRow: HTMLElement;
  countSlider: HTMLInputElement;
  countLabel: HTMLElement;
  progress: HTMLElement;
  progressBar: HTMLElement;
  eyedropperBtn: HTMLButtonElement;
  paletteGrid: HTMLElement;
  paletteEmpty: HTMLElement;
  paletteCount: HTMLElement;
  clearBtn: HTMLButtonElement;
  exportBtn: HTMLButtonElement;
  drawer: HTMLElement;
  drawerToggle: HTMLButtonElement;
}

const SHELL = `
<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Swatchwell home">
      <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="11.5" cy="12" r="4.5" fill="#e5484d"/>
        <circle cx="20.5" cy="12" r="4.5" fill="#3b82f6"/>
        <circle cx="16" cy="20" r="4.5" fill="#f5b301"/>
      </svg>
      <span class="brand-name">Swatch<span class="brand-accent">well</span></span>
    </a>
    <nav class="topbar-nav">
      <button type="button" class="nav-link" data-modal="how">How it works</button>
      <button type="button" class="nav-link" data-modal="privacy">Privacy</button>
      <button type="button" class="nav-link" data-modal="about">About</button>
      <button type="button" class="nav-link icon-only" id="drawer-toggle" aria-label="Open event log" title="Event log">${icon('list')}</button>
    </nav>
  </header>

  <main class="main-content">
    <button type="button" class="trust-banner" id="hero" data-modal="privacy">
      <span class="trust-dot"></span>
      Runs entirely in your browser. Your camera, images and palette never leave your device.
    </button>

    <h1 class="lede">Pick a colour from anything.</h1>
    <p class="sub">Point your camera at the real world, drop in an image, or use the screen eyedropper. Build a palette and take it with you — <span class="mono">hex</span>, CSS, JSON, PNG, SVG, <span data-term="ase" class="glossary-link">.ase</span> or <span data-term="gpl" class="glossary-link">.gpl</span>.</p>

    <div class="workbench">
      <section class="input-col">
        <div class="mode-tabs" id="mode-tabs" role="tablist">
          <button type="button" class="mode-tab active" data-mode="camera" role="tab">${icon('camera')}<span>Camera</span></button>
          <button type="button" class="mode-tab" data-mode="image" role="tab">${icon('image')}<span>Image</span></button>
        </div>

        <div class="panel camera-panel" id="camera-panel">
          <div class="video-stage">
            <video id="cam-video" playsinline muted></video>
            <div class="reticle" id="reticle" hidden>
              <div class="reticle-ring"></div>
            </div>
            <div class="cam-overlay" id="cam-overlay">
              <button type="button" class="big-btn" id="start-camera">${icon('camera', 20)} Start camera</button>
              <p class="cam-hint">Colour is sampled locally and never recorded.</p>
            </div>
          </div>
          <div class="cam-controls">
            <button type="button" class="btn primary" id="capture-btn" disabled>${icon('plus')} Add colour</button>
            <button type="button" class="btn ghost" id="torch-btn" hidden>${icon('flash')} Torch</button>
            <span class="cam-status" id="cam-status"></span>
          </div>
        </div>

        <div class="panel image-panel" id="image-panel" hidden>
          <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Choose an image">
            <div class="image-stage" id="image-stage" hidden>
              <canvas id="image-canvas"></canvas>
            </div>
            <div class="dropzone-empty" id="dropzone-empty">
              ${icon('image', 30)}
              <p class="dz-title">Drop an image, tap to pick, or paste</p>
              <p class="dz-sub">A palette is extracted automatically. Click the image to eyedrop an exact spot.</p>
              <button type="button" class="sample-link" id="sample-btn">${icon('image', 14)} Try a sample image</button>
            </div>
            <input type="file" id="file-input" accept="image/*" hidden />
          </div>
          <div class="extract-row" id="extract-row" hidden>
            <label class="count-field">
              <span>Colours: <strong id="count-label">6</strong></span>
              <input type="range" id="count-slider" min="2" max="16" value="6" />
            </label>
            <div class="progress" id="progress" hidden><div class="progress-bar" id="progress-bar"></div></div>
          </div>
        </div>

        <button type="button" class="btn ghost eyedropper-btn" id="eyedropper-btn" hidden>
          ${icon('pipette')} Eyedrop from screen
        </button>
      </section>

      <section class="palette-col">
        <div class="palette-head">
          <h2>Palette <span class="palette-count" id="palette-count">0</span></h2>
          <div class="palette-actions">
            <button type="button" class="btn ghost" id="clear-btn" disabled>${icon('trash')} Clear</button>
            <button type="button" class="btn primary" id="export-btn" disabled>${icon('download')} Export</button>
          </div>
        </div>
        <div class="palette-grid" id="palette-grid"></div>
        <div class="palette-empty" id="palette-empty">
          <p>No colours yet. Add some from the camera, an image, or the screen eyedropper — they'll collect here.</p>
        </div>
      </section>
    </div>
  </main>

  <footer class="site-footer">
    <div class="footer-inner">
      Built by <a href="https://benrichardson.dev/" target="_blank" rel="noopener">benrichardson.dev</a>
      · <a href="https://lab.benrichardson.dev" target="_blank" rel="noopener">more tools &amp; sites</a>
    </div>
  </footer>

  <aside id="event-drawer" hidden></aside>
  <div id="modal-host" hidden></div>
  <div id="toast-area" aria-live="polite"></div>
</div>
`;

export function buildShell(root: HTMLElement): Refs {
  root.innerHTML = SHELL;
  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector(sel) as T;
  return {
    hero: $('#hero'),
    modeTabs: $('#mode-tabs'),
    cameraPanel: $('#camera-panel'),
    video: $('#cam-video'),
    reticle: $('#reticle'),
    startCameraBtn: $('#start-camera'),
    captureBtn: $('#capture-btn'),
    torchBtn: $('#torch-btn'),
    cameraStatus: $('#cam-status'),
    imagePanel: $('#image-panel'),
    dropzone: $('#dropzone'),
    fileInput: $('#file-input'),
    sampleBtn: $('#sample-btn'),
    imageCanvas: $('#image-canvas'),
    imageStage: $('#image-stage'),
    extractRow: $('#extract-row'),
    countSlider: $('#count-slider'),
    countLabel: $('#count-label'),
    progress: $('#progress'),
    progressBar: $('#progress-bar'),
    eyedropperBtn: $('#eyedropper-btn'),
    paletteGrid: $('#palette-grid'),
    paletteEmpty: $('#palette-empty'),
    paletteCount: $('#palette-count'),
    clearBtn: $('#clear-btn'),
    exportBtn: $('#export-btn'),
    drawer: $('#event-drawer'),
    drawerToggle: $('#drawer-toggle'),
  };
}

// ── Modal system ─────────────────────────────────────────────────────────────

let modalHost: HTMLElement | null = null;
let onCloseHooks: Array<() => void> = [];

function host(): HTMLElement {
  if (!modalHost) modalHost = document.getElementById('modal-host');
  return modalHost as HTMLElement;
}

export function isOverlayOpen(): boolean {
  const h = host();
  const d = document.getElementById('event-drawer');
  return (h && !h.hidden) || (d ? !d.hidden : false);
}

export function openModal(title: string, body: HTMLElement | string): void {
  const h = host();
  h.innerHTML = '';
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const head = document.createElement('div');
  head.className = 'modal-header';
  const h2 = document.createElement('h2');
  h2.className = 'modal-title';
  h2.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'modal-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = icon('x');
  close.addEventListener('click', closeModal);
  head.appendChild(h2);
  head.appendChild(close);

  const content = document.createElement('div');
  content.className = 'modal-body';
  if (typeof body === 'string') content.innerHTML = body;
  else content.appendChild(body);

  modal.appendChild(head);
  modal.appendChild(content);
  backdrop.appendChild(modal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  h.appendChild(backdrop);
  h.hidden = false;
}

export function closeModal(): void {
  const h = host();
  h.hidden = true;
  h.innerHTML = '';
  for (const fn of onCloseHooks) fn();
  onCloseHooks = [];
}

export function onModalClose(fn: () => void): void {
  onCloseHooks.push(fn);
}

// ── Toast ────────────────────────────────────────────────────────────────────

export function toast(msg: string, kind: 'ok' | 'err' = 'ok'): void {
  const area = document.getElementById('toast-area');
  if (!area) return;
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = `${icon(kind === 'ok' ? 'check' : 'info')}<span>${escapeHtml(msg)}</span>`;
  area.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

// ── Palette rendering ────────────────────────────────────────────────────────

export interface PaletteHandlers {
  onSelect: (s: Swatch) => void;
  onReorder: (from: number, to: number) => void;
}

export function renderPalette(refs: Refs, swatches: Swatch[], handlers: PaletteHandlers): void {
  refs.paletteCount.textContent = String(swatches.length);
  refs.clearBtn.disabled = swatches.length === 0;
  refs.exportBtn.disabled = swatches.length === 0;
  refs.paletteEmpty.hidden = swatches.length > 0;
  refs.paletteGrid.hidden = swatches.length === 0;

  refs.paletteGrid.innerHTML = '';
  swatches.forEach((s, index) => {
    const tile = document.createElement('div');
    tile.className = 'swatch';
    tile.draggable = true;
    tile.dataset.index = String(index);
    tile.style.setProperty('--sw', s.hex);
    tile.innerHTML = `
      <button type="button" class="swatch-chip" style="background:${s.hex}" aria-label="Colour ${s.hex}, ${escapeHtml(s.name)}"></button>
      <div class="swatch-meta">
        <span class="swatch-hex mono">${s.hex.toUpperCase()}</span>
        <span class="swatch-name">${escapeHtml(s.name)}</span>
      </div>`;
    tile.querySelector('.swatch-chip')!.addEventListener('click', () => handlers.onSelect(s));

    tile.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', String(index));
      tile.classList.add('dragging');
    });
    tile.addEventListener('dragend', () => tile.classList.remove('dragging'));
    tile.addEventListener('dragover', (e) => e.preventDefault());
    tile.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer?.getData('text/plain'));
      const to = index;
      if (!Number.isNaN(from) && from !== to) handlers.onReorder(from, to);
    });

    refs.paletteGrid.appendChild(tile);
  });
}

// ── Swatch detail modal ──────────────────────────────────────────────────────

export function openSwatchDetail(s: Swatch, onDelete: (id: string) => void): void {
  const hsl = rgbToHsl(s.rgb);
  const body = document.createElement('div');
  body.className = 'detail';
  const rows: Array<[string, string]> = [
    ['HEX', s.hex.toUpperCase()],
    ['RGB', formatRgb(s.rgb)],
    ['HSL', formatHsl(hsl)],
  ];
  body.innerHTML = `
    <div class="detail-swatch" style="background:${s.hex}"></div>
    <div class="detail-name">
      <strong>${escapeHtml(s.name)}</strong>
      <span class="detail-dist">nearest named colour · ΔE ${s.nameDistance.toFixed(1)}</span>
    </div>
    <div class="detail-rows">
      ${rows
        .map(
          ([k, v]) =>
            `<button type="button" class="detail-row" data-copy="${escapeHtml(v)}"><span class="dk">${k}</span><span class="dv mono">${escapeHtml(v)}</span>${icon('copy', 15)}</button>`,
        )
        .join('')}
    </div>
    <button type="button" class="btn danger detail-delete">${icon('trash')} Remove from palette</button>
  `;
  body.querySelectorAll<HTMLButtonElement>('.detail-row').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await copyText(btn.dataset.copy ?? '');
      toast(ok ? `Copied ${btn.dataset.copy}` : 'Copy failed', ok ? 'ok' : 'err');
    });
  });
  body.querySelector('.detail-delete')!.addEventListener('click', () => {
    onDelete(s.id);
    closeModal();
  });
  openModal('Colour', body);
}

// ── Export menu ──────────────────────────────────────────────────────────────

export function openExportMenu(swatches: Swatch[]): void {
  const body = document.createElement('div');
  body.className = 'export-menu';

  const textFormats: Array<{ label: string; ext: string; mime: string; build: () => string }> = [
    { label: 'CSS variables', ext: 'css', mime: 'text/css', build: () => toCSS(swatches) },
    { label: 'SCSS', ext: 'scss', mime: 'text/x-scss', build: () => toSCSS(swatches) },
    { label: 'Tailwind config', ext: 'js', mime: 'text/javascript', build: () => toTailwind(swatches) },
    { label: 'JSON', ext: 'json', mime: 'application/json', build: () => toJSON(swatches) },
    { label: 'Hex list', ext: 'txt', mime: 'text/plain', build: () => toHexList(swatches) },
    { label: 'SVG swatches', ext: 'svg', mime: 'image/svg+xml', build: () => toSVG(swatches) },
    { label: 'GIMP palette (.gpl)', ext: 'gpl', mime: 'text/plain', build: () => toGPL(swatches) },
  ];

  const section = (heading: string) => {
    const h = document.createElement('div');
    h.className = 'export-heading';
    h.textContent = heading;
    body.appendChild(h);
  };

  section('Download');
  for (const f of textFormats) {
    body.appendChild(
      exportRow(f.label, `.${f.ext}`, [
        {
          label: 'Copy',
          icon: 'copy',
          run: async () => {
            const ok = await copyText(f.build());
            toast(ok ? `${f.label} copied` : 'Copy failed', ok ? 'ok' : 'err');
          },
        },
        {
          label: 'Download',
          icon: 'download',
          run: async () => {
            try {
              const res = await downloadText(f.build(), `swatchwell.${f.ext}`, f.mime);
              toast(res === 'saved' ? 'Saved' : `${f.label} downloaded`);
            } catch (e) {
              if (!(e instanceof DOMException && e.name === 'AbortError')) toast('Download failed', 'err');
            }
          },
        },
      ]),
    );
  }

  // Binary + image formats
  body.appendChild(
    exportRow('Adobe Swatch Exchange', '.ase', [
      {
        label: 'Download',
        icon: 'download',
        run: async () => {
          try {
            const bytes = toASE(swatches);
            const res = await saveBlob(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }), 'swatchwell.ase');
            toast(res === 'saved' ? 'Saved' : 'ASE downloaded');
          } catch (e) {
            if (!(e instanceof DOMException && e.name === 'AbortError')) toast('Download failed', 'err');
          }
        },
      },
    ]),
  );

  const pngActions: ExportAction[] = [
    {
      label: 'Copy',
      icon: 'copy',
      run: async () => {
        const blob = await renderSwatchSheetPNG(swatches);
        const ok = await copyImage(blob);
        toast(ok ? 'PNG copied' : 'Clipboard image not supported here', ok ? 'ok' : 'err');
      },
    },
    {
      label: 'Download',
      icon: 'download',
      run: async () => {
        try {
          const blob = await renderSwatchSheetPNG(swatches);
          const res = await saveBlob(blob, 'swatchwell.png');
          toast(res === 'saved' ? 'Saved' : 'PNG downloaded');
        } catch (e) {
          if (!(e instanceof DOMException && e.name === 'AbortError')) toast('Download failed', 'err');
        }
      },
    },
  ];
  const pngFile = () => renderSwatchSheetPNG(swatches).then((b) => new File([b], 'swatchwell.png', { type: 'image/png' }));
  // Probe share support with a tiny dummy; canShareFiles needs a File, so gate at click time.
  pngActions.push({
    label: 'Share',
    icon: 'share',
    run: async () => {
      const file = await pngFile();
      if (!canShareFiles([file])) {
        toast('Sharing files is not supported here', 'err');
        return;
      }
      await shareFile(file, 'Swatchwell palette');
    },
  });
  body.appendChild(exportRow('PNG swatch sheet', '.png', pngActions));

  openModal('Export palette', body);
}

interface ExportAction {
  label: string;
  icon: string;
  run: () => void | Promise<void>;
}

function exportRow(label: string, ext: string, actions: ExportAction[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'export-row';
  const info = document.createElement('div');
  info.className = 'export-info';
  info.innerHTML = `<span class="export-label">${escapeHtml(label)}</span><span class="export-ext mono">${escapeHtml(ext)}</span>`;
  row.appendChild(info);
  const btns = document.createElement('div');
  btns.className = 'export-btns';
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn tiny';
    b.innerHTML = `${icon(a.icon, 14)} ${a.label}`;
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await a.run();
      } finally {
        b.disabled = false;
      }
    });
    btns.appendChild(b);
  }
  row.appendChild(btns);
  return row;
}

// ── Static modal content ─────────────────────────────────────────────────────

export function howItWorksBody(): string {
  const step = (n: string, title: string, text: string) =>
    `<li><span class="step-num">${n}</span><div><h3>${title}</h3><p>${text}</p></div></li>`;
  return `<div class="steps-wrap"><ol class="steps">
    ${step('01', 'Point, drop, or eyedrop', 'Aim your camera at a real-world colour, drop in an image, or use the desktop <span data-term="eyedropper" class="glossary-link">EyeDropper</span> to sample any pixel on screen.')}
    ${step('02', 'Sampled on device', 'The camera <span data-term="reticle" class="glossary-link">reticle</span> averages the pixels under it to denoise sensor grain. Dropped images are quantised with <span data-term="median-cut" class="glossary-link">median cut</span> in a Web Worker. Nothing is uploaded.')}
    ${step('03', 'Named perceptually', 'Each colour is converted to <span data-term="lab" class="glossary-link">Lab</span> space and matched to the nearest named colour using <span data-term="ciede2000" class="glossary-link">CIEDE2000</span> — the way the eye judges similarity, not raw RGB.')}
    ${step('04', 'Leave with a file', 'Copy a <span data-term="hex" class="glossary-link">hex</span>, or export the whole palette as CSS, SCSS, Tailwind, JSON, PNG, SVG, <span data-term="ase" class="glossary-link">.ase</span> or <span data-term="gpl" class="glossary-link">.gpl</span>.')}
  </ol></div>`;
}

export function privacyBody(): string {
  return `<div class="security-grid">
    <div class="security-card good">
      <h3>What's protected</h3>
      <ul>
        <li>The camera stream — sampled frame by frame and <strong>never recorded</strong>. Every track is stopped when you stop the camera or leave the tab.</li>
        <li>Any image you open — decoded and quantised in this tab; the pixels never leave the device.</li>
        <li>Your palette — held in this tab, and (optionally) in this browser's local storage on this device only.</li>
      </ul>
    </div>
    <div class="security-card bad">
      <h3>What isn't</h3>
      <ul>
        <li>The initial page load is served by GitHub Pages, whose CDN sees your IP address and that you loaded the page — the same as visiting any website.</li>
        <li>A screenshot you feed the screen eyedropper is your own responsibility.</li>
      </ul>
    </div>
    <div class="security-card">
      <h3>Trust surface</h3>
      <ul>
        <li>The static site bundle, hash-pinned by the GitHub Pages deploy, and the TLS chain between you and GitHub Pages.</li>
        <li>A Cloudflare Web Analytics beacon records anonymous page views — no cookies, no fingerprinting, no cross-site tracking; your camera, images and palette are never sent to it.</li>
        <li>Feedback you choose to send is sent to feedback.benrichardson.dev. Nothing is sent unless you open the feedback form and press Send; your images and palette never are.</li>
      </ul>
    </div>
  </div>`;
}

export function aboutBody(): string {
  return `<div class="about">
    <p><strong>Swatchwell</strong> turns your camera, an image, or your screen into an eyedropper — and gives you the palette as a real file. It runs entirely in your browser with no backend and no account.</p>
    <p>It's part of a small workshop of privacy-first browser tools. See the rest at <a href="https://lab.benrichardson.dev" target="_blank" rel="noopener">lab.benrichardson.dev</a>, and more from the author at <a href="https://benrichardson.dev" target="_blank" rel="noopener">benrichardson.dev</a>.</p>
    <p class="about-src">Source: <a href="https://github.com/ben-gy/swatchwell" target="_blank" rel="noopener">github.com/ben-gy/swatchwell</a></p>
  </div>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
