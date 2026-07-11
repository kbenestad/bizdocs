# CLAUDE.md

Guidance for working in this repository. For the design system and
architecture rationale, see [DESIGN.md](DESIGN.md).

## What this is

**bizdocs** is a suite of small web apps that help individuals and small
organisations produce common business documents as PDFs. It's meant to be
downloaded and deployed together: an office admin sets the organisation's
name/logo/tagline/accent colour once in the root `config.yml`, and every app
in the suite picks it up automatically (see "Org-wide branding" below).
There are currently four apps:

| App               | Purpose                                                   | PDF engine |
| ----------------- | --------------------------------------------------------- | ---------- |
| `invoice/`        | Freelance/consulting invoices (taxes, FX, payment)        | jsPDF      |
| `reimburse/`      | Expense reimbursement with attached receipts              | pdf-lib    |
| `timesheet/`      | Timesheets by employee type, work codes, signatures       | pdf-lib    |
| `contactmanager/` | Contact directory editor + exported contact-book viewers  | — (CSV/VCF export) |

Each app is **one `index.html`** (all HTML/CSS/JS inline) plus a `config.yml`
and an `assets/` folder of favicons/PWA icons. There is **no build step and no
backend** — the apps run straight from static files in the browser.

## Repository layout

```
assets/            ← SHARED across all apps (referenced as ../assets/…)
  style.css          design tokens / colour scheme + reset + page shell
  ui.css             reusable kb-* UI components
  app.js             shared runtime (DOM helpers, theme, modals, i18n, …)
_template/         CANONICAL STARTER — copy this to create a new app
invoice/        index.html · config.yml · assets/ (favicons)
reimburse/      index.html · config.yml · assets/ (favicons)
timesheet/      index.html · config.yml · assets/ (favicons)
contactmanager/ index.html · config.yml · assets/ (favicons)
index.html · config.yml   ← landing page + org-wide branding (see "Org-wide branding" below; no localisation block)
docs/           notes & review reports, dependencies.md
README.md · LICENSE (Apache-2.0)
```

Each app links the shared files in its `<head>`:

```html
<link rel="stylesheet" href="../assets/style.css">
<link rel="stylesheet" href="../assets/ui.css">
...
<script src="../assets/app.js"></script>   <!-- before the app's own inline <script> -->
```

## How an app boots

1. A tiny inline pre-paint script in `<head>` reads `localStorage['kb-theme']`
   and sets `data-theme` before first paint (avoids a flash).
2. `js-yaml` loads from cdnjs — hardcoded in every app's `<head>`, because it's
   needed to fetch and parse `config.yml` itself, so it can't be config-driven.
   Its `<script>` is version-pinned **and carries an `integrity` (SRI) hash +
   `crossorigin`** — when bumping the version, recompute the sha384 hash. Each
   page also ships a Content-Security-Policy `<meta>` allowing scripts only
   from `'self'` and cdnjs.
3. `../assets/app.js` loads and defines the shared globals.
4. The app's inline `<script>` runs: `loadYamlConfig()` fetches, parses **and
   validates** `config.yml` (see below); `applySharedBranding(cfg)` then fills
   in `organization`/`logo`/`logo-maxwidth`/`tagline`/`accent-colour` from the
   root `config.yml` wherever this app's own config left them blank (see "Org-
   wide branding" below); an adapter normalises the `localisation:` block; and
   the UI is built from config. State persists to `localStorage`.
5. Any other CDN library the app needs (`jspdf` for invoice, `pdf-lib` for the
   rest) is declared in that app's `config.yml` under a `dependencies:` block
   (`{ url, integrity }` per key) and loaded via `loadDependency()` (in
   `app.js`) right after `config.yml` parses. Bumping a version/hash, or
   swapping a remote CDN for a local vendored copy, is a `config.yml` edit —
   `index.html` never needs to change. See [dependencies.md](docs/dependencies.md)
   for the current versions/hashes and the full rationale.

`loadYamlConfig()` (in `app.js`) validates the parsed config and throws if it
isn't an object with a `localisation:` block. This catches the common deploy
failure where a static host returns an **HTML page** (a 404 / SPA fallback, or a
stale cache) with a 200 for `config.yml`: `jsyaml.load()` would parse that to a
plain string, and without the guard the app would render its chrome with every
label as a raw key and an empty language dropdown — and no error. Each app's boot
already wraps the call in a `try/catch` that renders the thrown message.

## Org-wide branding

The root `config.yml` (next to the landing page's `index.html`) is org-wide
config, not just landing-page config: `organization`, `logo`, `logo-maxwidth`,
`tagline` and `accent-colour` set there cascade down to every app via
`applySharedBranding()` (`app.js`). This is the point — a small business
deploys the whole suite together and sets its name/logo/colour **once**,
instead of editing five `config.yml` files.

- An app's own `config.yml` still declares these same keys (blank by default)
  so it can **override** a shared value for that app alone — e.g. `timesheet`
  overrides `logo-maxwidth` because its layout has more horizontal room.
  Leave a key blank to inherit; give it a value to override.
- `contactmanager` is the one app that currently sets its own real values for
  all of these — it's branded for a specific deployment (see the note at the
  top of `contactmanager/config.yml`), not the generic suite.
- Fetching the root config is tolerant of failure (falls back to `{}`), so an
  app copied out and deployed standalone, without the rest of the suite,
  still works — it just falls back to its own (blank → kBenestad default)
  values instead of inheriting.
- `_template/config.yml` ships with these keys blank — new apps inherit suite
  branding automatically unless you give one a value.

## Running / previewing locally

The apps `fetch('config.yml')`, so they must be served over HTTP — opening
`index.html` via `file://` will fail.

```bash
python3 -m http.server 8000
# then open http://localhost:8000/invoice/  (or /reimburse/ , /timesheet/)
```

## Deployment

The live site is published with GitHub Pages from a dedicated `pages` branch,
kept separate from `main`:

- `main` is the development branch — everything in this file assumes you're
  working there.
- `pages` is an orphan branch (no shared history with `main`) that holds
  **only** the deployed apps: `index.html`, `config.yml`, `assets/`, and every
  app folder. `CLAUDE.md`, `DESIGN.md`, `README.md`, `LICENSE`, `docs/`,
  `_template/`, and `.github/` are deliberately excluded, so none of the
  project's internal docs or the new-app scaffold are reachable from the
  published URL.
- GitHub Pages is configured (Settings > Pages) as "Deploy from a branch" →
  `pages` → `/` (root).
- `.github/workflows/pages-sync.yml` keeps `pages` in sync automatically: on
  every push to `main`, it copies `index.html`, `config.yml`, and every
  top-level directory **except** `_template/`, `docs/`, and `.github/` onto
  `pages`, then commits and pushes if anything changed. A new app added per
  "Adding a new app" below is picked up automatically the next time it's
  pushed — nothing to update in the workflow itself. The trigger uses
  `paths-ignore` (not an explicit allowlist) for the same reason: any path
  not in the exclude list can start a new app and will still trigger a sync.
- Never push directly to `pages` — it's a generated artifact of `main` and
  will be overwritten by the next sync.

## Verifying a change

There are no automated tests. Verify visually by rendering the app. A headless
Chromium is available in this environment:

```bash
CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
"$CHROME" --headless=new --no-sandbox --disable-gpu \
  --virtual-time-budget=8000 --window-size=1200,1600 \
  --screenshot=out.png "http://localhost:8000/invoice/index.html"
```

`--virtual-time-budget` lets the JS-built UI settle before the screenshot.

**Caveat:** in sandboxed environments the browser often cannot reach the CDNs,
so `js-yaml` fails to load and the app shows a config error. To verify a full
render, vendor `js-yaml` locally for the test only — download it, drop a copy
next to the app, point a throwaway copy of `index.html` at the local file, and
screenshot that. Delete the throwaway files afterwards; never commit them.
(`jspdf`/`pdf-lib` are only needed when generating a PDF, not for initial
render.) Things worth screenshotting after a change: the full form, dark mode,
the About modal, and a non-English language.

## Conventions when editing

- **Reuse the shared layer.** Styling and cross-cutting logic live in
  `assets/`. Don't reintroduce per-app copies of design tokens, `kb-*`
  components, DOM helpers, theme/modal/i18n/format code. If three apps would
  need the same thing, put it in `assets/` and reference it.
- **Same classes/IDs for the same element** across apps, so one change in
  `ui.css` propagates everywhere. App-specific layout (column grids, receipt
  rows, the timesheet grid, the signature pad) stays in that app's inline
  `<style>`.
- **Don't hardcode org branding in a new app.** `organization`/`logo`/
  `logo-maxwidth`/`tagline`/`accent-colour` should stay blank in an app's
  `config.yml` so they inherit from the root `config.yml` — see "Org-wide
  branding" above. Only set one if that app genuinely needs to differ from
  the rest of the suite.
- **Scope gotcha.** `reimburse` and `timesheet` wrap their main script in an
  IIFE (`(async function(){ … })()`), so their top-level functions are *not*
  globals. `invoice`'s main script is a plain classic script, so its top-level
  declarations *are* globals (and must not collide with names defined in
  `app.js`). Globals from `app.js` are visible inside the IIFEs.
- **localStorage keys.** Theme = `kb-theme`, font scale = `kb-font-scale`
  (shared). Per-app data uses app-specific keys — the full set currently in
  use (do not rename without a migration path, users have live data):
  invoice `inv_data_v1` / `inv_lines_v1` / `inv_generated_v1`; reimburse
  `reimb-state` / `reimb-staff` / `reimb-lang` (+ IndexedDB `reimb-db` for
  receipts); timesheet `ts-state` / `ts-signature` / `timesheet-lang` /
  `timesheet-employee` / `timesheet-type`; contactmanager
  `contactmanager-lang` / `contactmanager-contacts`; template `template-lang`.
- **Escape everything you interpolate into HTML.** Any dynamic value — config
  strings, user input, error messages — that goes into an `innerHTML` /
  template-literal build must pass through `kbEsc()` (app.js; invoice aliases
  it as `h()`), or be added via `el()`/text nodes. `kbConfirm`/`kbAlert` treat
  `message` as plain text; rich config content belongs in `kbAbout` (markdown).
- **Language declarations use `name:`.** `localisation.languages` entries are
  `{ code, name, direction? }` in every app — don't reintroduce per-app
  variants like `display:`.
- **Toolbar layout.** Every app's `kb-toolbar` is, in order: the nav dropdown
  (`makeNavMenu(NAV)`, far left) · spacer · text-size control · theme button ·
  About button · the language select (`makeLangSelect()`, far right).
  `makeLangSelect()` returns `null` for 0-or-1-language apps — append it
  conditionally so single-language apps (e.g. `contactmanager`) show no
  selector at all. `NAV` comes from `loadNavItems('../config.yml')` at boot,
  which reads the **root** `config.yml`'s `apps:`/`links:` lists; an entry
  there can set `hide-from-navselector: yes` (or `true`) to stay out of every
  app's dropdown while still appearing on the landing page.
- **User-facing strings go through localisation**, never hardcoded literals —
  add a key to every language block in that app's `config.yml` `ui:` section
  and look it up via the app's `t()`/`T()`/`S()`. Use `{placeholder}` tokens
  for interpolation.
- **The container is ephemeral.** Only committed, pushed work survives. Commit
  and push when a change is complete.
- **Keep [dependencies.md](docs/dependencies.md) current.** It's the running
  doc of every third-party library bizdocs loads (name, version, where it's
  declared, why). Whenever you add, upgrade, remove, or re-point a dependency
  — including bumping an SRI hash — update `docs/dependencies.md` in the same
  change.
- **Declare CDN dependencies in `config.yml`, not `index.html`.** Except for
  `js-yaml` (hardcoded per app — it's needed to fetch/parse `config.yml`
  itself), every CDN library an app uses (`jspdf`, `pdf-lib`) is declared
  under that app's `config.yml` `dependencies:` block and loaded at runtime via
  `loadDependency()` (app.js). This lets a version/URL/hash change, or a
  remote→local swap, happen entirely in `config.yml`. See "How an app boots"
  above and `docs/dependencies.md`.

## Adding a new app

**Copy `_template/`.** It is the canonical shell — the standard `<head>` (with
the pre-paint theme script and correct script order), a JS-built toolbar /
header / footer assembled from the shared helpers, an example card, the boot
sequence, and a pdf-lib download stub — already wired to `../assets/`. Then:

1. Rename the folder; update the `<title>`, the doc-title `<h1>`, and the
   `template-lang` localStorage key.
2. Replace `buildExampleCard()` with your form (built from `kb-*` components),
   and `onDownload()` with your real PDF (use **pdf-lib**).
3. Fill in `config.yml` — keep the header keys and add your `ui:` strings to
   *every* language block, plus any data lists you need.
4. Drop a real favicon / PWA icon set into the new app's `assets/`.

Building from the template rather than hand-assembling the chrome is what keeps
a new app visually identical to the others. See DESIGN.md for the design system.
Nothing to do for deployment — the new folder is picked up automatically by
the `pages` sync workflow the next time it's pushed to `main`. See
"Deployment" above.

## Out of scope / known notes

- Two PDF engines coexist (jsPDF in invoice, pdf-lib elsewhere). This is
  intentional for now — the UX is identical. New apps should standardise on
  pdf-lib; see DESIGN.md for the rationale and convergence plan.
