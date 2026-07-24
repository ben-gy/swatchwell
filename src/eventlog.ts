// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson <hi@ben.gy>
// Additional terms under AGPL section 7 apply — see ADDITIONAL-TERMS.md.

/**
 * Event log — a live, categorised trail the rest of the app emits into. It is
 * the trust surface made visible: you can watch exactly what the tool does, and
 * see that nothing is a network call. Adapted from the Dropwell pattern.
 */

export type EventCategory = 'system' | 'camera' | 'image' | 'color' | 'export';
export type EventLevel = 'info' | 'ok' | 'warn' | 'err';

export interface LogEvent {
  ts: number;
  cat: EventCategory;
  level: EventLevel;
  msg: string;
}

const ALL_CATS: EventCategory[] = ['system', 'camera', 'image', 'color', 'export'];
const MAX_EVENTS = 500;

let events: LogEvent[] = [];
let listeners: Array<(e: LogEvent) => void> = [];
const activeCats = new Set<EventCategory>(ALL_CATS);
let listEl: HTMLElement | null = null;
let countEl: HTMLElement | null = null;
let autoScroll = true;

export function emit(cat: EventCategory, level: EventLevel, msg: string): void {
  const e: LogEvent = { ts: Date.now(), cat, level, msg };
  events.push(e);
  if (events.length > MAX_EVENTS) {
    events.shift();
    if (listEl) {
      const first = listEl.querySelector('.event');
      if (first) first.remove();
    }
  }
  for (const l of listeners) l(e);
}

export function clearLog(): void {
  events = [];
  if (listEl) listEl.innerHTML = '';
  if (countEl) countEl.textContent = '0';
}

export function mountEventDrawer(container: HTMLElement, onClose: () => void): () => void {
  container.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'drawer-head';
  const title = document.createElement('div');
  title.className = 'drawer-title';
  title.textContent = 'event log';
  const controls = document.createElement('div');
  controls.className = 'drawer-controls';
  const count = document.createElement('span');
  count.className = 'count';
  count.innerHTML = '<strong id="ev-count">0</strong>&nbsp;events';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'drawer-close';
  closeBtn.setAttribute('aria-label', 'Close event log');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', onClose);
  controls.appendChild(count);
  controls.appendChild(closeBtn);
  head.appendChild(title);
  head.appendChild(controls);
  container.appendChild(head);

  const filters = document.createElement('div');
  filters.className = 'drawer-filters';
  for (const c of ALL_CATS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-pill on';
    btn.dataset.cat = c;
    btn.textContent = c;
    btn.addEventListener('click', () => {
      if (activeCats.has(c)) {
        activeCats.delete(c);
        btn.classList.remove('on');
      } else {
        activeCats.add(c);
        btn.classList.add('on');
      }
      reflow();
    });
    filters.appendChild(btn);
  }
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'filter-pill clear';
  clearBtn.textContent = 'clear';
  clearBtn.addEventListener('click', () => clearLog());
  filters.appendChild(clearBtn);
  container.appendChild(filters);

  const list = document.createElement('div');
  list.className = 'drawer-list';
  container.appendChild(list);

  listEl = list;
  countEl = container.querySelector('#ev-count') as HTMLElement;

  list.addEventListener('scroll', () => {
    const nearBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 32;
    autoScroll = nearBottom;
  });

  reflow();

  const onEvent = (e: LogEvent) => {
    bumpCount();
    if (!activeCats.has(e.cat)) return;
    appendEvent(e);
  };
  listeners.push(onEvent);

  return () => {
    listeners = listeners.filter((l) => l !== onEvent);
    listEl = null;
    countEl = null;
  };
}

function bumpCount(): void {
  if (countEl) countEl.textContent = String(events.length);
}

function reflow(): void {
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const e of events) {
    if (!activeCats.has(e.cat)) continue;
    appendEvent(e, false);
  }
  listEl.scrollTop = listEl.scrollHeight;
  bumpCount();
}

function appendEvent(e: LogEvent, scroll = true): void {
  if (!listEl) return;
  const row = document.createElement('div');
  row.className = 'event';
  row.dataset.cat = e.cat;
  row.dataset.level = e.level;

  const ts = document.createElement('span');
  ts.className = 'ts';
  ts.textContent = formatTs(e.ts);
  const cat = document.createElement('span');
  cat.className = 'cat';
  cat.textContent = e.cat;
  const msg = document.createElement('span');
  msg.className = 'msg';
  msg.textContent = e.msg;
  row.appendChild(ts);
  row.appendChild(cat);
  row.appendChild(msg);

  listEl.appendChild(row);
  if (scroll && autoScroll) listEl.scrollTop = listEl.scrollHeight;
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
