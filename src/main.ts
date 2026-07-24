// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * Bootstrap + wiring. Owns no colour maths — it connects the input surfaces
 * (camera, image, screen eyedropper) to the palette, the extraction worker, and
 * the export/modal UI.
 */

import './styles/main.css';
import {
  buildShell, renderPalette, openModal, closeModal, isOverlayOpen, toast,
  openSwatchDetail, openExportMenu, howItWorksBody, privacyBody, aboutBody, onModalClose,
} from './ui';
import { initGlossary } from './glossary';
import { mountEventDrawer, emit } from './eventlog';
import * as palette from './palette';
import { startCamera, stopCamera, setTorch, grabFrame, allTracksEnded, type CameraHandle } from './camera';
import { sampleRegion } from './extract';
import { parseHex, type RGB } from './color';
import type { ExtractRequest, WorkerResponse } from './types';

const root = document.getElementById('app');
if (!root) throw new Error('missing #app');
const refs = buildShell(root);

initGlossary();

// ── Extraction worker ────────────────────────────────────────────────────────

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
let reqId = 0;
let pendingExtract: ((colors: RGB[]) => void) | null = null;

worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
  const msg = ev.data;
  if (msg.type === 'progress') {
    refs.progressBar.style.width = `${Math.round(msg.ratio * 100)}%`;
  } else if (msg.type === 'result') {
    refs.progress.hidden = true;
    refs.progressBar.style.width = '0%';
    pendingExtract?.(msg.colors);
    pendingExtract = null;
  } else if (msg.type === 'error') {
    refs.progress.hidden = true;
    emit('image', 'err', `Extraction failed: ${msg.message}`);
    toast('Could not extract colours from that image', 'err');
    pendingExtract = null;
  }
};

function extract(data: Uint8ClampedArray, width: number, height: number, count: number): Promise<RGB[]> {
  return new Promise((resolve) => {
    pendingExtract = resolve;
    refs.progress.hidden = false;
    refs.progressBar.style.width = '5%';
    const copy = data.slice();
    const req: ExtractRequest = {
      type: 'extract', id: ++reqId, width, height, count, buffer: copy.buffer,
    };
    worker.postMessage(req, [copy.buffer]);
  });
}

// ── Palette wiring ───────────────────────────────────────────────────────────

palette.subscribe((list) => {
  renderPalette(refs, list, {
    onSelect: (s) => openSwatchDetail(s, (id) => { palette.removeSwatch(id); emit('color', 'info', `Removed ${s.hex}`); }),
    onReorder: (from, to) => palette.moveSwatch(from, to),
  });
});
palette.restore();

function addColor(rgb: RGB, source: 'camera' | 'image' | 'screen' | 'manual'): void {
  const s = palette.addColor(rgb, source);
  emit('color', 'ok', `Added ${s.hex} · ${s.name} (${source})`);
}

// ── Mode tabs ────────────────────────────────────────────────────────────────

let mode: 'camera' | 'image' = 'camera';
refs.modeTabs.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const next = tab.dataset.mode as 'camera' | 'image';
    if (next === mode) return;
    mode = next;
    refs.modeTabs.querySelectorAll('.mode-tab').forEach((t) => t.classList.toggle('active', t === tab));
    refs.cameraPanel.hidden = mode !== 'camera';
    refs.imagePanel.hidden = mode !== 'image';
    if (mode !== 'camera') teardownCamera('switched to image');
  });
});

// ── Camera ───────────────────────────────────────────────────────────────────

const scratch = document.createElement('canvas');
let cam: CameraHandle | null = null;
let torchOn = false;

async function startCam(): Promise<void> {
  refs.cameraStatus.textContent = 'requesting camera…';
  try {
    cam = await startCamera(refs.video);
    refs.reticle.hidden = false;
    refs.captureBtn.disabled = false;
    const overlay = document.getElementById('cam-overlay');
    if (overlay) overlay.hidden = true;
    refs.torchBtn.hidden = !cam.hasTorch;
    refs.cameraStatus.textContent = 'live · tap “Add colour” to sample the centre';
    emit('camera', 'ok', 'Camera started — frames sampled locally, never recorded');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit('camera', 'err', `Camera unavailable: ${message}`);
    refs.cameraStatus.textContent = 'No camera — drop an image instead';
    toast('Camera unavailable — switch to Image to drop a photo', 'err');
    // Denied permission lands somewhere useful: the image path.
    switchToImage();
  }
}

function captureFromCamera(): void {
  if (!cam) return;
  const frame = grabFrame(refs.video, scratch);
  if (!frame) {
    toast('Camera still warming up — try again', 'err');
    return;
  }
  const cx = frame.width / 2;
  const cy = frame.height / 2;
  const radius = Math.max(4, Math.round(Math.min(frame.width, frame.height) * 0.02));
  const rgb = sampleRegion(frame.data, frame.width, frame.height, cx, cy, radius);
  if (!rgb) {
    toast('Could not read that pixel', 'err');
    return;
  }
  addColor(rgb, 'camera');
  pulseReticle();
}

function pulseReticle(): void {
  refs.reticle.classList.remove('pulse');
  void refs.reticle.offsetWidth;
  refs.reticle.classList.add('pulse');
}

function teardownCamera(reason: string): void {
  if (!cam) return;
  stopCamera(cam.stream);
  const ended = allTracksEnded(cam.stream);
  refs.video.srcObject = null;
  cam = null;
  torchOn = false;
  refs.reticle.hidden = true;
  refs.captureBtn.disabled = true;
  refs.torchBtn.hidden = true;
  const overlay = document.getElementById('cam-overlay');
  if (overlay) overlay.hidden = false;
  refs.cameraStatus.textContent = '';
  emit('camera', 'info', `Camera stopped (${reason}) · tracks ended: ${ended}`);
}

function switchToImage(): void {
  mode = 'image';
  refs.modeTabs.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.mode === 'image'),
  );
  refs.cameraPanel.hidden = true;
  refs.imagePanel.hidden = false;
}

refs.startCameraBtn.addEventListener('click', startCam);
refs.captureBtn.addEventListener('click', captureFromCamera);
refs.torchBtn.addEventListener('click', async () => {
  if (!cam) return;
  torchOn = !torchOn;
  const ok = await setTorch(cam.stream, torchOn);
  refs.torchBtn.classList.toggle('active', torchOn && ok);
  if (!ok) toast('Torch not controllable on this device', 'err');
});

// Privacy: release the camera whenever the tab is hidden or unloaded.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) teardownCamera('tab hidden');
});
window.addEventListener('pagehide', () => teardownCamera('page hidden'));

// ── Image mode ───────────────────────────────────────────────────────────────

let currentImage: { data: Uint8ClampedArray; width: number; height: number } | null = null;

async function loadImageFile(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) {
    toast('That is not an image file', 'err');
    return;
  }
  emit('image', 'info', `Opening ${file.name} (${Math.round(file.size / 1024)} KB) — never uploaded`);
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    refs.imageCanvas.width = w;
    refs.imageCanvas.height = h;
    const ctx = refs.imageCanvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const img = ctx.getImageData(0, 0, w, h);
    currentImage = { data: img.data, width: w, height: h };
    refs.imageStage.hidden = false;
    (document.getElementById('dropzone-empty') as HTMLElement).hidden = true;
    refs.extractRow.hidden = false;
    refs.dropzone.classList.add('has-image');
    await runExtract();
  } catch (err) {
    emit('image', 'err', `Could not decode image: ${err instanceof Error ? err.message : String(err)}`);
    toast('Could not open that image', 'err');
  }
}

async function runExtract(): Promise<void> {
  if (!currentImage) return;
  const count = Number(refs.countSlider.value);
  emit('image', 'info', `Extracting ${count} colours (median cut, in a worker)`);
  const colors = await extract(currentImage.data, currentImage.width, currentImage.height, count);
  // Replace any previously auto-extracted image colours: simplest is to clear and re-add.
  palette.clearPalette();
  palette.addColors(colors, 'image');
  emit('image', 'ok', `Palette of ${colors.length} colours ready`);
}

refs.dropzone.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('#image-stage')) return; // clicks on the image = eyedrop
  refs.fileInput.click();
});
refs.dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    refs.fileInput.click();
  }
});
refs.fileInput.addEventListener('change', () => {
  const file = refs.fileInput.files?.[0];
  if (file) void loadImageFile(file);
  refs.fileInput.value = '';
});
refs.dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  refs.dropzone.classList.add('drag');
});
refs.dropzone.addEventListener('dragleave', () => refs.dropzone.classList.remove('drag'));
refs.dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  refs.dropzone.classList.remove('drag');
  const file = e.dataTransfer?.files?.[0];
  if (file) void loadImageFile(file);
});

// Click the image to eyedrop an exact pixel.
refs.imageCanvas.addEventListener('click', (e) => {
  if (!currentImage) return;
  const rect = refs.imageCanvas.getBoundingClientRect();
  const x = Math.round(((e.clientX - rect.left) / rect.width) * currentImage.width);
  const y = Math.round(((e.clientY - rect.top) / rect.height) * currentImage.height);
  const rgb = sampleRegion(currentImage.data, currentImage.width, currentImage.height, x, y, 3);
  if (rgb) addColor(rgb, 'image');
});

let sliderTimer = 0;
refs.countSlider.addEventListener('input', () => {
  refs.countLabel.textContent = refs.countSlider.value;
  window.clearTimeout(sliderTimer);
  sliderTimer = window.setTimeout(() => void runExtract(), 250);
});

// Paste an image anywhere.
document.addEventListener('paste', (e) => {
  const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
  if (!item) return;
  const file = item.getAsFile();
  if (file) {
    if (mode !== 'image') switchToImage();
    void loadImageFile(file);
  }
});

// ── Screen eyedropper ────────────────────────────────────────────────────────

const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
if (EyeDropperCtor) {
  refs.eyedropperBtn.hidden = false;
  refs.eyedropperBtn.addEventListener('click', async () => {
    try {
      const result = await new EyeDropperCtor().open();
      const rgb = parseHex(result.sRGBHex);
      if (rgb) addColor(rgb, 'screen');
    } catch {
      /* user cancelled — no-op */
    }
  });
}

// ── Palette actions ──────────────────────────────────────────────────────────

refs.clearBtn.addEventListener('click', () => {
  palette.clearPalette();
  emit('color', 'info', 'Palette cleared');
});
refs.exportBtn.addEventListener('click', () => {
  const list = palette.getSwatches();
  if (list.length) openExportMenu(list);
});

// ── Modals + drawer ──────────────────────────────────────────────────────────

const modalBodies: Record<string, () => HTMLElement | string> = {
  how: howItWorksBody,
  privacy: privacyBody,
  about: aboutBody,
};
const modalTitles: Record<string, string> = {
  how: 'How it works',
  privacy: 'Privacy & threat model',
  about: 'About Swatchwell',
};
document.querySelectorAll<HTMLElement>('[data-modal]').forEach((el) => {
  el.addEventListener('click', () => {
    const key = el.dataset.modal!;
    const build = modalBodies[key];
    if (build) openModal(modalTitles[key], build());
  });
});

let drawerDispose: (() => void) | null = null;
function openDrawer(): void {
  refs.drawer.hidden = false;
  refs.drawerToggle.setAttribute('aria-expanded', 'true');
  if (!drawerDispose) drawerDispose = mountEventDrawer(refs.drawer, closeDrawer);
}
function closeDrawer(): void {
  refs.drawer.hidden = true;
  refs.drawerToggle.setAttribute('aria-expanded', 'false');
}
refs.drawerToggle.addEventListener('click', () => {
  if (refs.drawer.hidden) openDrawer();
  else closeDrawer();
});

// ── Keyboard ─────────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isOverlayOpen()) {
      closeModal();
      closeDrawer();
    }
  }
});
onModalClose(() => { /* reserved: focus restoration hook */ });

// ── Test hook (used by the automated dry-run — the harness can't wave a camera) ──

interface TestHook {
  addHex: (hex: string) => boolean;
  pickFromData: (data: number[], w: number, h: number, cx: number, cy: number) => boolean;
  extractFromData: (data: number[], w: number, h: number, count: number) => Promise<number>;
  count: () => number;
}
(window as unknown as { __swatchwell: TestHook }).__swatchwell = {
  addHex(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return false;
    addColor(rgb, 'manual');
    return true;
  },
  pickFromData(data, w, h, cx, cy) {
    const rgb = sampleRegion(new Uint8ClampedArray(data), w, h, cx, cy, 3);
    if (!rgb) return false;
    addColor(rgb, 'camera');
    return true;
  },
  async extractFromData(data, w, h, count) {
    const colors = await extract(new Uint8ClampedArray(data), w, h, count);
    palette.addColors(colors, 'image');
    return colors.length;
  },
  count: () => palette.getSwatches().length,
};

emit('system', 'ok', 'Swatchwell ready — zero backend, nothing uploaded');
