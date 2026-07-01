# Codebase review — security, consistency, correctness

Date: 2026-07-01 · Scope: full repository (all apps, shared `assets/`, `_template/`, root page, configs, docs).
No code was changed; this is the findings report. Suggested fixes accompany each item.

Threat-model note: these apps have no backend — the browser user, the deployed
`config.yml`, and the CDN are the only inputs. "Config-controlled" findings are
second-party (the deployer can already edit the JS), but they matter for
deployments where a semi-trusted admin edits `config.yml` without being able to
edit code, and they are one `include`-style mistake away from becoming
first-party. Findings are ordered by severity within each section.

---

## 1 · Security

### S1 — `markdown()` allows attribute injection and `javascript:` links (HIGH for config-editors)
`assets/app.js:53` renders `[text](url)` as `<a href="$2" …>`. The escape pass
above it handles only `& < >` — **not `"`** — and the URL scheme is not checked.

- `[x](https://e.com" onclick="alert(document.cookie))` → injected attribute → script execution.
- `[x](javascript:…)` → a live `javascript:` link (partially blunted by `rel="noopener"` + `target="_blank"`, but still undesirable).

This HTML lands in the About modal (`kbAbout`) of every app, sourced from each
config's `about.content`. **Fix:** escape `"` in the initial escape pass and
allow-list schemes (`https?:`, `mailto:`) before emitting the anchor; fall back
to plain text otherwise.

### S2 — Unescaped exception text interpolated into `innerHTML` (MEDIUM)
Boot `catch` blocks inject `e.message` raw:

- `reimburse/index.html:1461`
- `timesheet/index.html:1612`
- `contactmanager/index.html:793` and `:830`
- `_template/index.html:226`
- root `index.html:136`

`jsyaml` parse errors embed a snippet of the fetched file in the message, so a
corrupted/hostile `config.yml` (or an HTML page served for it) can smuggle
markup into the error box. The invoice app already does this correctly
(`h(err.message)` at `invoice/index.html:277`). **Fix:** escape the message (or
set it via `textContent`) in all six places — and since the template is the
canonical starter, fixing `_template` prevents the pattern from propagating.

### S3 — Config strings widely interpolated into `innerHTML` without escaping (MEDIUM)
The apps are careful with *user-typed data* (`h()` in invoice, `el()`/text nodes
elsewhere) but not with *config-sourced strings*:

- invoice: every `${t("…")}` in the `buildForm()` template literal (`invoice/index.html:384-644`), option builders, `relabel()` innerHTML rebuilds;
- reimburse: validation notes `'<strong>'+T('val-fix')+'</strong><br>' + errs.join('<br>')` (`:560`, `:1388`, `:1430`), success note (`:565`), entry modal `T('msg-entry')` (`:1457-1459`);
- timesheet: `renderValBox()` (`:870`, `:880`, `:889`);
- contactmanager viewer: `mark.innerHTML = KB_FOOTER_MARK_SVG + (CFG['footer-mark'] || …)` (`:773`).

Any `ui:` string in `config.yml` is an HTML injection point. **Fix:** route
these through `h()` / text nodes; where HTML in config is intentional (About
content), that is what `markdown()` is for — keep it as the single sanctioned path.

### S4 — CDN scripts have no Subresource Integrity, and two different CDNs are used (MEDIUM)
- invoice: `cdnjs` with `crossorigin="anonymous"` but **no `integrity`** (`invoice/index.html:114-118`);
- all other apps + template + root: `unpkg` with neither attribute.

A CDN compromise is arbitrary code execution in apps that handle bank account
numbers, personal data, and signatures. All versions are already pinned, so SRI
hashes are cheap to add. **Fix (pick one):** add `integrity` + `crossorigin` to
every CDN tag and standardise on one CDN; or vendor `js-yaml`/`pdf-lib`/`jspdf`
into `assets/vendor/` (also fixes the "sandboxed environments can't reach the
CDN" verification pain noted in CLAUDE.md, and makes the apps work fully offline).

### S5 — Lower-severity notes
- No Content-Security-Policy meta tag anywhere; a modest CSP (`default-src 'self'` + the one CDN + `data:`/`blob:`) would cap the blast radius of S1–S3.
- `invoice/index.html:1315` `_hexRgb()` assumes 6-digit hex; a 3-digit or named `accent-colour` yields `NaN` colours in the PDF. `parseHex()` in reimburse/timesheet has the same assumption (timesheet's `hexToRgb` at `:1263` guards length; the others don't).
- `initFontScale()` (`assets/app.js:282`) applies the persisted value without clamping to `KB_SCALE_MIN/MAX` — same-origin only, cosmetic.
- Good practice observed and worth keeping: `jsonForScript()` `<`-escaping and `escAttr()` in the contactmanager exporter; `tel:` href sanitisation (`:545`); `rel="noopener"` on external links; js-yaml v4 (safe load by default).

---

## 2 · Correctness bugs

### B1 — Logo shown in the UI comes from a different folder than the logo embedded in PDFs
Reimburse and timesheet load the header logo from the **shared** assets
(`../assets/logo.png`, `reimburse:446`, `timesheet:694`) but `loadLogo()` for
the PDF fetches the **app-local** `assets/logo.{png,jpg}` (`reimburse:1370`,
`timesheet:1207`). With `logo: yes`, a deployer who drops the logo in the shared
folder sees it on screen but gets a logo-less PDF (and vice versa). **Fix:**
use one location (suggest shared `../assets/`, matching the header) in both.

### B2 — Pre-paint theme script runs *after* the blocking CDN scripts (reimburse, timesheet)
`reimburse/index.html:15-20` and `timesheet/index.html:14-19` place the
`kb-theme` snippet *below* `pdf-lib` + `js-yaml` + `app.js`. Those block
parsing on the network, so dark-mode users get exactly the flash the snippet
exists to prevent — and it contradicts the boot order documented in CLAUDE.md
and used by invoice/contactmanager/_template. **Fix:** move the snippet to the
top of `<head>`; ideally also `defer` the library scripts.

### B3 — The "shared" localisation schema has forked: `name:` vs `display:`
`timesheet/config.yml` declares languages as `- code: en / display: "English"`
while invoice, reimburse, contactmanager and `_template` use `name:` (which is
also what `buildLangTable()`'s callers and invoice's `defLang.name` expect).
Timesheet's toolbar reads `l.display` (`timesheet:659`), so configs are not
portable between apps despite CLAUDE.md's "the apps share the same
`localisation:` config shape". **Fix:** standardise on `name:` (timesheet can
read `l.name || l.display` during migration).

### B4 — Reimburse dead code / unwired handlers
- `onSave()` (`reimburse:1422`) — a Save handler with validation + "saved" feedback — is never referenced; the actual Save button (`:549-550`) calls `saveState()` silently with no user feedback.
- `buildFxTip()` (`:342`) is never called, and contains hardcoded English.

**Fix:** wire the Save button to `onSave()` (or delete it), delete `buildFxTip()`.

### B5 — `makeCDD()` leaks a document-level listener per dropdown per render
`reimburse/index.html:362` adds `document.addEventListener('click', …)` for
every custom dropdown and never removes it; `render()` rebuilds all dropdowns
on each language switch. Listeners accumulate for the page's lifetime. **Fix:**
one delegated document listener, or remove the listener when the panel is
detached (e.g. via `AbortController`).

### B6 — Contactmanager: import silently discards the working list; edits are memory-only
`pickFileToImport()` (`contactmanager:378-399`) replaces `contacts` wholesale
with no confirmation, and the editor keeps contacts only in memory — a reload
or accidental navigation loses all unexported edits. The other apps autosave to
localStorage. **Fix:** confirm before replacing on import; persist the working
list under a `contactmanager-*` key.

### B7 — Minor
- invoice `loadCfg()` error text says "Serve the `app/` folder … `npx serve .`" (`invoice:278`) — stale; the repo's documented flow is `python3 -m http.server` from the repo root.
- timesheet `onNewTimesheet()` clears state with `localStorage.setItem('ts-state','')` (`:1173`) instead of `removeItem` — works, but inconsistent with reimburse.
- Number formatting differs by app: invoice pins `en-US` grouping (`fmt()`), reimburse passes `locale: undefined` (browser locale). The same amount renders differently across the suite.
- reimburse `init()` treats an empty saved `items` array as "has state", rendering a form with zero items.

---

## 3 · Consistency (measured against CLAUDE.md's own conventions)

### C1 — `contactmanager/` is undocumented
The root `config.yml` navigation and the code reference it, but CLAUDE.md's app
table, the repository-layout diagram, README and DESIGN.md all describe **three**
apps. Anyone following the docs will miss it (this review nearly did). **Fix:**
add it to the CLAUDE.md table/layout and README.

### C2 — Hardcoded user-facing strings (violates "user-facing strings go through localisation")
- invoice: card titles `Tax`, `Rate & type`, `Amount`, `Summary` (`invoice:593-607`) — every sibling label on the same cards *is* localised; also missing from `relabel()`, so they stay English after a language switch. The `<h1>` doc-titles (`invoice`, `reimburse`, `timesheet`) are hardcoded too.
- reimburse: `From` / `Until` period meta and `en-GB` month names (`:465-471`); the FX "per" label (`:674`); footer `About` link (`:91`).
- timesheet: `Clear`, `Upload image` signature buttons (`:584`, `:592`), `Remove row`/`Add row` titles, footer `About` (`:100`), and hardcoded `vi` month/day tables (`:144-171`) — adding any other language silently falls back to English dates.

### C3 — Two modal/dialog styles coexist
invoice uses native `confirm()` (`resetLines`, `invoice:1617`) and `alert()`
(`buildPDF`, `:1274`); reimburse/timesheet use the shared `kbConfirm`/`kbAlert`
for confirmations but still `alert()` for PDF errors (`reimburse:1400`,
`timesheet:1570`). **Fix:** use the `kb*` modals everywhere.

### C4 — invoice hand-assembles chrome the shared layer already provides
Its toolbar is static HTML with duplicated theme/about SVGs and inline
`onclick=` (`invoice:72-92`) instead of `makeThemeButton()` / `makeAboutButton()`
/ `makeSizeControl()`; it is also the only app whose main script is a classic
(non-IIFE) script — acknowledged in CLAUDE.md, but it is where most one-off
drift in this list lives. Worth converging toward the template pattern when
next touched.

### C5 — localStorage key naming drift
Shared keys are fine (`kb-theme`, `kb-font-scale`), but per-app keys mix
conventions: timesheet uses both `ts-*` (`ts-state`, `ts-signature`) and
`timesheet-*` (`timesheet-lang`, `timesheet-employee`, `timesheet-type`);
invoice uses `inv_data_v1`/`inv_lines_v1` snake_case. Cosmetic, but the
CLAUDE.md list of keys no longer tells the whole story.

### C6 — PDF filename sanitisation differs
invoice strips to `[a-zA-Z0-9_-]` (`invoice:1495`); reimburse/timesheet only
replace whitespace (`reimburse:1338`, `timesheet:1546`), so names containing
`/ \ :` produce awkward or rejected download names on some platforms. **Fix:**
move invoice's `safeName()` into `app.js` and use it in all three.

### C7 — Root `index.html` duplicates chrome and config loading
It rebuilds header/footer/toolbar and rolls its own `fetch('config.yml')`
because `loadYamlConfig()` hard-requires a `localisation:` block. **Fix:** give
`loadYamlConfig()` an option (`{ requireLocalisation: false }`) so the root page
can share it.

---

## 4 · Suggested priority order

1. **S1 + S2** — small, mechanical patches in `app.js` and six catch blocks; eliminates the only realistic injection paths.
2. **S4** — add SRI (or vendor the libraries); one-line-per-tag change, big trust win.
3. **B1 + B2** — user-visible bugs (missing PDF logo, dark-mode flash), trivial fixes.
4. **B3 + C1** — schema and doc drift; cheap now, expensive after more configs exist.
5. **S3 + C2** — sweep config strings through `h()` and add the missing `ui:` keys; fold the fix into `_template` first so new apps inherit it.
6. Remaining B/C items opportunistically when each app is next touched.
