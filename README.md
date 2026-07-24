# swatchwell

**Pick colours from your camera or any image, build a palette, and export it — nothing leaves your device.**

Live: https://swatchwell.benrichardson.dev

---

## what it is

Swatchwell turns three things into an eyedropper: your **camera** (point it at a
wall, a fabric, a book cover, a sunset), any **image** you drop in, and — on
desktop — your whole **screen** via the browser's EyeDropper API. Every colour you
pick lands in a working palette that names itself and that you can take away as a
real file: a hex, a block of CSS custom properties, a Tailwind snippet, JSON, a PNG
swatch sheet, an SVG, an Adobe `.ase`, or a GIMP `.gpl`.

It's for the designer who needs the *exact* colour for a build, and for the person
standing in a paint aisle trying to name the colour of their living-room wall —
both on a phone, both wanting the answer now, neither wanting to upload a private
photo to a stranger's server or make an account.

Everything runs in the browser. There is no backend. The camera stream is sampled
frame-by-frame and never recorded; a dropped image is decoded and quantised in a
Web Worker and never uploaded.

## how it works

- **Camera** → `getUserMedia` streams the rear camera into a `<video>`. On tap, the
  current frame is drawn to a scratch canvas and the pixels under the centre
  reticle are **averaged** (denoising sensor grain) into one stable colour.
- **Image** → `createImageBitmap` decodes the file to a canvas; the pixel buffer is
  transferred to a **Web Worker** that runs a first-party **median-cut** quantiser
  to pull out the N dominant colours. Clicking the image eyedrops an exact pixel.
- **Screen** → the **EyeDropper API** (desktop Chromium) samples any pixel on the
  screen with the user's permission.
- **Naming** → each colour is converted sRGB → linear → XYZ → **CIE Lab**, then
  matched to the nearest entry in a curated named-colour dictionary using
  **CIEDE2000**, the current standard for perceptual colour difference.
- **Export** → pure serialisers build every text format; the `.ase` writer emits
  the Adobe binary format byte-for-byte with a `DataView`; the PNG swatch sheet is
  rendered on a canvas.

## browser APIs used

- **getUserMedia** — the rear-camera stream (the sensor input)
- **MediaStreamTrack torch constraint** — optional flashlight for dark surfaces
- **Canvas 2D / OffscreenCanvas + getImageData** — sampling and the PNG sheet
- **createImageBitmap** — off-main-thread image decode
- **EyeDropper API** — screen-pixel sampling (desktop, feature-detected)
- **Web Workers + Transferable ArrayBuffer** — median-cut extraction, zero-copy
- **Clipboard API (ClipboardItem)** — copy hex / copy the PNG sheet
- **Web Share API (level 2, files)** — share the swatch sheet on mobile
- **File System Access API** — "Save as…" the export file
- **localStorage** — preferences + last palette (device-only)
- **Service Worker (vite-plugin-pwa)** — offline app shell

## security / privacy model

**Protected**
- The camera stream — sampled per frame, never recorded; every track is stopped on
  teardown, when the tab is hidden, and on page unload, so the OS camera light goes
  out.
- Any image you open — decoded and quantised in the tab; the pixels never leave the
  device.
- Your palette — held in the tab, optionally mirrored to this browser's local
  storage on this device only.

**Not protected**
- The initial page load is served by GitHub Pages, whose CDN sees your IP and that
  you loaded the page — as with any website.
- A screenshot you feed the screen eyedropper is your own responsibility.

**Trust model**
- The static site bundle (hash-pinned by the GitHub Pages deploy) and the TLS chain
  between you and GitHub Pages.
- A Cloudflare Web Analytics beacon records anonymous page views — no cookies, no
  fingerprinting, no cross-site tracking; your camera, images and palette are never
  sent to it.
- Feedback you choose to send goes to feedback.benrichardson.dev, only when you open
  the form and press Send.

## stack

- Vite 6 + vanilla TypeScript
- First-party colour science and median-cut quantiser — no runtime colour library
- Vitest for unit tests (colour conversions, CIEDE2000 against the Sharma reference
  pairs, median cut, exporters, nearest-name)
- GitHub Pages for hosting, deployed via GitHub Actions

No runtime dependencies. No cookies, no fingerprinting, no third-party fonts.
Anonymous, cookie-less page-view counts via Cloudflare Web Analytics — no personal
data, no cross-site tracking.

> **Note on device testing.** The build pipeline verifies the image and screen
> paths and drives the camera derivation with synthetic pixel samples through a
> test hook. No real-device camera check was possible in the pipeline — the live
> camera path is exercised with synthetic frames, not a physical sensor.

## local development

```bash
npm install
npm run dev      # vite dev server on :5173
npm test         # run vitest suite
npm run build    # produce dist/ for deploy
npm run preview  # serve dist/ locally
```

## deploying

A push to `main` triggers `.github/workflows/deploy.yml`, which runs tests, builds,
and deploys `dist/` to GitHub Pages. The custom domain is set via `public/CNAME` —
point a `CNAME` DNS record for `swatchwell.benrichardson.dev` at `ben-gy.github.io`.

## license

[GNU Affero General Public License v3.0 or later](./LICENSE), with an attribution
requirement added under section 7(b) — see [ADDITIONAL-TERMS.md](./ADDITIONAL-TERMS.md).

In short: you may run, modify, redistribute and even sell this, but if you distribute it —
or run a modified version where other people can reach it — you have to publish your source
under the same licence and keep the attribution. A separate commercial licence without those
obligations is available on request: <hi@ben.gy>.

Third-party components keep their own licences — see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
