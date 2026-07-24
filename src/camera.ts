// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * Camera lifecycle. The stream is the sensor input for real-world colour
 * sampling. Nothing is recorded — frames are drawn to a scratch canvas, sampled,
 * and discarded. Every track is stopped on teardown so the OS camera light goes
 * out.
 */

export interface CameraHandle {
  stream: MediaStream;
  hasTorch: boolean;
}

/** Start the rear camera. Must be called from within a user gesture. */
export async function startCamera(video: HTMLVideoElement): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not expose a camera to web pages.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  await video.play().catch(() => {
    /* autoplay quirks — the frame still renders once metadata is ready */
  });
  const track = stream.getVideoTracks()[0];
  const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
  return { stream, hasTorch: Boolean(caps.torch) };
}

export function stopCamera(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
}

/** True once every track in the stream has fully stopped. */
export function allTracksEnded(stream: MediaStream | null): boolean {
  if (!stream) return true;
  return stream.getTracks().every((t) => t.readyState === 'ended');
}

export async function setTorch(stream: MediaStream, on: boolean): Promise<boolean> {
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

export interface Frame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Draw the current video frame into a scratch canvas and return its pixels.
 * Returns null before the video has real dimensions.
 */
export function grabFrame(video: HTMLVideoElement, scratch: HTMLCanvasElement): Frame | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  return { data: img.data, width: w, height: h };
}
