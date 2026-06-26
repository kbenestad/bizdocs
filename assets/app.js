/* =============================================================================
 * bizdocs — Shared app runtime   (assets/app.js)
 * -----------------------------------------------------------------------------
 * Cross-cutting JavaScript shared by every app (invoice, reimburse, timesheet…)
 * via, just before each app's own inline <script>:
 *     <script src="../assets/app.js"></script>
 *
 * Classic (non-module) script: the names below become globals visible to the
 * app script that loads after it. Each app deletes its own copy of these and
 * calls into here instead, so behaviour stays identical across apps and is
 * fixed in one place.
 *
 * Provides: DOM helpers ($, $$, el, uid) · markdown() · brand/icon SVGs ·
 * theme (currentTheme/toggleTheme/makeThemeButton) · modals (kbModal/kbConfirm/
 * kbAlert/kbAbout).
 * ========================================================================== */
"use strict";

/* ── DOM helpers ───────────────────────────────────────────────────────────── */
const $  = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Create an element. attrs: className, style(object), on<Event> handlers, or
 *  plain attributes. children: string | Node | array of them. */
const el = (tag, attrs, children) => {
  const e = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null && v !== false) e.setAttribute(k, v);
  });
  if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
};

/* ── Minimal markdown → HTML (for About boxes) ─────────────────────────────── */
/* Supports #/##/### headings, **bold**, *italic*, [text](url), - bullet lists,
 * and blank-line-separated paragraphs. Escapes HTML first. */
function markdown(md) {
  if (!md) return '';
  let html = md
    .replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/((?:^- .+\n?)+)/gm, m => '<ul>' + m.replace(/^- (.+)$/gm, '<li>$1</li>') + '</ul>');
  html = html.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
             .map(b => /^<[hul]/.test(b) ? b : `<p>${b.replace(/\n/g, '<br>')}</p>`).join('\n');
  return html;
}

/* ── Brand & icon SVGs ─────────────────────────────────────────────────────── */
const KB_BRAND_SVG = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true" style="width:100%;height:100%;display:block"><rect x="3" y="14" width="29" height="29" rx="8" fill="var(--accent)"/><rect x="16" y="3" width="29" height="29" rx="8" fill="none" stroke="var(--accent)" stroke-width="4"/></svg>`;
const KB_FOOTER_MARK_SVG = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1" y="5" width="11" height="11" rx="3" fill="var(--accent)"/><rect x="6" y="1" width="11" height="11" rx="3" fill="none" stroke="var(--accent)" stroke-width="1.5"/></svg>`;

const KB_ICON = {
  moon:  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  sun:   `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  about: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  warn:  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>`,
  info:  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--info)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
};

/* ── Theme (light/dark) ────────────────────────────────────────────────────── */
/* The pre-paint inline snippet in each app reads this same key before first
 * paint; here we read/write it on toggle. */
const KB_THEME_KEY = 'kb-theme';

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

/** Repaint every theme button's icon to match the active theme. */
function updateThemeIcon() {
  const icon = currentTheme() === 'dark' ? KB_ICON.sun : KB_ICON.moon;
  $$('.kb-theme-btn').forEach(b => { b.innerHTML = icon; });
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(KB_THEME_KEY, next); } catch (e) {}
  updateThemeIcon();
}

/** A ready-wired theme toggle icon button. */
function makeThemeButton() {
  const btn = el('button', { type: 'button', className: 'kb-iconbtn kb-theme-btn',
    title: 'Toggle light/dark', 'aria-label': 'Toggle dark mode', onClick: toggleTheme });
  btn.innerHTML = currentTheme() === 'dark' ? KB_ICON.sun : KB_ICON.moon;
  return btn;
}

/** A ready-wired "About" icon button. */
function makeAboutButton(onClick) {
  const btn = el('button', { type: 'button', className: 'kb-iconbtn', 'aria-label': 'About', onClick });
  btn.innerHTML = KB_ICON.about;
  return btn;
}

/* ── Modals ────────────────────────────────────────────────────────────────── */
/* Generic dialog. Returns a Promise resolving to the clicked button's `value`
 * (or `dismissValue` when closed via backdrop / Escape).
 *
 * opts = {
 *   title?, icon?,                         // header (omitted entirely if no title)
 *   bodyHTML? | bodyNode?,                 // body content
 *   buttons: [{ label, value, variant?, autofocus? }],
 *   dismissable = true, dismissValue = undefined
 * } */
function kbModal(opts) {
  return new Promise(resolve => {
    const overlay = el('div', { className: 'kb-overlay' });
    const modal = el('div', { className: 'kb-modal' });

    if (opts.title != null) {
      const hdr = el('div', { className: 'kb-modal__hdr' });
      if (opts.icon) { const w = el('span'); w.innerHTML = opts.icon; hdr.appendChild(w.firstElementChild || w); }
      hdr.appendChild(el('span', null, opts.title));
      modal.appendChild(hdr);
    }

    const body = opts.bodyNode || el('div', { className: 'kb-modal__body' });
    if (opts.bodyHTML != null) body.innerHTML = opts.bodyHTML;
    modal.appendChild(body);

    const footer = el('div', { className: 'kb-modal__footer' });
    let focusEl = null;
    (opts.buttons || []).forEach(b => {
      const btn = el('button', { className: 'kb-btn ' + (b.variant || 'kb-btn--primary') }, b.label);
      btn.addEventListener('click', () => { cleanup(); resolve(b.value); });
      if (b.autofocus) focusEl = btn;
      footer.appendChild(btn);
    });
    modal.appendChild(footer);
    overlay.appendChild(modal);

    const dismissable = opts.dismissable !== false;
    function cleanup() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape' && dismissable) { cleanup(); resolve(opts.dismissValue); } }
    overlay.addEventListener('click', e => {
      if (e.target === overlay && dismissable) { cleanup(); resolve(opts.dismissValue); }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    (focusEl || footer.querySelector('button') || modal).focus();
  });
}

/** Confirm dialog → resolves true (confirm) / false (cancel or dismiss). */
function kbConfirm({ title, message, confirmLabel, cancelLabel, icon } = {}) {
  return kbModal({
    title, icon: title != null ? (icon || KB_ICON.warn) : undefined,
    bodyHTML: message, dismissValue: false,
    buttons: [
      { label: cancelLabel || 'Cancel', value: false, variant: 'kb-btn--ghost', autofocus: true },
      { label: confirmLabel || 'OK', value: true, variant: 'kb-btn--primary' },
    ],
  });
}

/** Alert / notice dialog → resolves once dismissed. */
function kbAlert({ title, message, okLabel, icon } = {}) {
  return kbModal({
    title, icon: title != null ? (icon || KB_ICON.info) : undefined,
    bodyHTML: message,
    buttons: [{ label: okLabel || 'OK', value: true, variant: 'kb-btn--primary', autofocus: true }],
  });
}

/** About dialog (renders markdown content). */
function kbAbout({ title, contentMD, closeLabel } = {}) {
  return kbModal({
    title: title || 'About',
    bodyHTML: markdown(contentMD || ''),
    buttons: [{ label: closeLabel || 'Close', value: true, variant: 'kb-btn--primary', autofocus: true }],
  });
}
