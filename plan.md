# Tool Plan: Swatchwell

## Overview
- **Name:** Swatchwell
- **Repo name:** swatchwell
- **Tagline:** Pick colours from your camera or any image, build a palette, and export it — nothing leaves your device.

## Problem It Solves
You're standing in front of a wall, a fabric swatch, a book cover, a sunset, and you
want the *exact* colour — the hex, the RGB, the nearest named/paint colour — so you can
use it in a design, a CSS file, a decorating plan. Or you have a screenshot / photo / brand
image and need its palette as CSS variables or a Tailwind config. The usual answer is an
online "upload your image to get colours" site — which means uploading a private photo to a
stranger's server, or installing a phone app that wants an account and tracks you.
Swatchwell does it all in the browser: point your camera, drop an image, or use the screen
eyedropper, and leave with a palette you can copy or download in a dozen formats.

## Why This Must Be Client-Side
- **Privacy:** the camera stream and any image you open are processed frame-by-frame in the
  tab and discarded. Nothing is uploaded — the most honest version of "your data never leaves
  the device" is a live-sensor tool that literally never records unless you ask it to.
- **Real-time interactivity:** live camera eyedropping with an averaged reticle needs
  per-frame canvas sampling — a round trip to a server would make it unusable.
- **No-account friction / offline:** works on a plane, in a basement paint aisle with no
  signal, with no sign-up.

## Browser APIs / Libraries Used
| API / Library | What it does for us | Fallback if unsupported |
|---------------|----------------------|-------------------------|
| getUserMedia (rear camera) | Live real-world colour sampling — the sensor input | Image upload + EyeDropper are first-class fallbacks |
| MediaStreamTrack torch constraint | Optional flashlight to light dark surfaces | Silently omitted where unsupported |
| Canvas 2D / OffscreenCanvas + getImageData | Sample averaged colour under the reticle; draw swatch PNG | N/A — hard requirement |
| createImageBitmap | Decode dropped images off the main thread | Fallback to `<img>` decode |
| EyeDropper API | Pick any pixel on the screen (desktop) | Feature-detected; button hidden if absent |
| Web Workers | Median-cut palette extraction on a Transferable pixel buffer | Main-thread fallback for tiny images |
| Transferable ArrayBuffer | Zero-copy pixel handoff to the worker | Structured clone |
| First-party colour science (sRGB↔linear↔XYZ↔Lab, CIEDE2000) | Nearest named-colour matching, perceptual dedupe | N/A — pure TS, no library |
| First-party median-cut quantiser | Extract N dominant colours from an image | N/A — pure TS |
| Clipboard API (ClipboardItem) | Copy hex / copy PNG swatch sheet | Fallback to `execCommand` |
| Web Share API (level 2, files) | Share the swatch sheet / palette file on mobile | Download link |
| File System Access API (showSaveFilePicker) | "Save as…" the export file | Anchor download |
| localStorage | Preferences + last palette (device-only convenience) | In-memory only |
| Service Worker (vite-plugin-pwa) | Offline app shell | Works online without it |

## Workflow (input → process → output)
1. User picks colours: **live camera** (tap the frame under a reticle), **drop/pick an image**
   (auto-extract a palette + click-to-eyedrop), or the **screen EyeDropper** (desktop).
2. Each sample is converted to hex/RGB/HSL, matched to its nearest named colour (CIEDE2000 in
   Lab space), perceptually de-duplicated, and added to the working palette.
3. User leaves with an **artefact**: copy a single hex, copy the whole palette as CSS custom
   properties / JSON / SCSS / Tailwind / hex list, or download a **PNG swatch sheet**, an
   **SVG**, an **.ase** (Adobe Swatch Exchange) or a **.gpl** (GIMP/Inkscape) palette file.

## Non-Goals
- No cloud sync, no accounts, ever.
- No colour-blindness simulation or contrast grid v1 (separate tool territory).
- No paint-brand fan-deck matching v1 (needs a licensed dataset) — we match to CSS named
  colours + a curated common set, and say so honestly.
- No WebXR / AR overlay v1.

## Target Audience
A designer or developer who needs an exact colour for a build, and a DIY decorator standing
in a shop trying to name the colour of a wall — both on a phone, both wanting the answer now
without uploading a photo or making an account.

## Style Direction
**Tone:** calm, precise, premium — the chrome gets out of the way so the colours read true.
**Colour palette:** near-neutral light canvas (warm whites, hairline greys) with a single ink
accent; the swatches themselves supply all the colour. A neutral surround is also the correct
choice for judging colour.
**UI density:** spacious.
**Dark/light theme:** light default (reassuring, consumer + designer friendly), with a system
dark variant.
**Reference tools for feel:** Coolors' cleanliness, macOS Digital Colour Meter's precision.

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite. No React — a single working palette + modal chrome does
  not need component-tree orchestration.
- **Key libraries:** none at runtime beyond dev tooling; all colour maths and quantisation are
  first-party (great for unit testing and for the "nothing leaves the device" story — no
  third-party colour service).
- **Worker strategy:** one dedicated worker for median-cut extraction (Transferable pixels in,
  palette out). Camera sampling stays on the main thread (cheap, per-tap).
- **Storage:** localStorage for preferences + the current palette (device-only convenience).

## Privacy & Trust Model
**Protected**
- The camera stream — sampled per frame and never recorded; `track.stop()` on teardown.
- Any image you open — decoded and quantised in-tab, never uploaded.
- Your palette — kept in this tab (and optionally localStorage on this device only).

**Not protected**
- The initial page load is served by GitHub Pages (their CDN sees your IP + that you loaded the
  page — standard for any website).
- A screenshot you feed the EyeDropper is your own responsibility.

**Trust surface**
- The static site bundle (hash-pinned via the GitHub Pages deploy).
- The TLS chain between you and GitHub Pages.
- A Cloudflare Web Analytics beacon records anonymous page views — no cookies, no fingerprinting,
  no cross-site tracking; your camera, images and palette are never sent to it.
- Feedback you choose to send goes to feedback.benrichardson.dev, only when you open the form
  and press Send.

## UX Required Surfaces
- Three input surfaces: camera viewfinder with reticle, image drop zone (drag/tap/paste),
  EyeDropper button.
- Determinate progress on image extraction (pixels scanned).
- Event log drawer (Dropwell pattern) with in-drawer × + Escape.
- How-It-Works modal (illustrated steps).
- Privacy modal (Protected / Not protected / Trust surface).
- About modal with benrichardson.dev + lab.benrichardson.dev + source link.
- Output delivery: copy hex, copy palette (CSS/JSON/SCSS/Tailwind/list), download PNG/SVG/ASE/GPL,
  Web Share, File System Access save.
- Keyboard: Escape closes modals/drawer, Enter confirms, Cmd/Ctrl+V pastes an image.
- Sticky footer with the lab.benrichardson.dev backlink.
