# Dependencies

Running log of every third-party library bizdocs loads, where it's declared,
and why. Keep this file in sync whenever a dependency is added, upgraded,
removed, or its CDN/SRI hash changes — it's the one place to check "what do
we depend on and where does it come from" without grepping every app.

## How dependencies are declared

Each app needs a YAML parser (`js-yaml`) to fetch and parse its own
`config.yml` — so that one dependency can't itself be config-driven and stays
**hardcoded** in every app's `index.html` `<head>`.

Everything else an app needs from a CDN (`jspdf`, `pdf-lib`) is declared in
that app's `config.yml`, under a `dependencies:` block:

```yaml
dependencies:
  pdf-lib:
    url: "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"
    integrity: "sha384-…"
```

`assets/app.js`'s `loadDependency({ url, integrity })` injects the `<script>`
tag at runtime, after `config.yml` has loaded. This means:

- **Updating a version or CDN URL** is a `config.yml` edit — `index.html`
  never needs to change.
- **Swapping remote for local** (e.g. vendoring a copy into `assets/` for an
  offline/air-gapped deploy) is done by pointing `url` at the local path and
  blanking/removing `integrity` (a local file's bytes won't match the CDN's
  SRI hash).
- Pointing `url` at a **different remote host** additionally requires adding
  that host to the `script-src` directive in the app's CSP `<meta>` tag in
  `index.html` — the CSP is intentionally static and can't be config-driven
  without weakening it.

## Current dependencies

| Library    | Version | Used by                                | Declared in                          | Purpose                    |
| ---------- | ------- | --------------------------------------- | ------------------------------------- | --------------------------- |
| js-yaml    | 4.1.0   | all apps                                | hardcoded in each app's `index.html`  | parse `config.yml`          |
| jspdf      | 2.5.1   | invoice                                 | `invoice/config.yml` → `dependencies.jspdf` | PDF generation         |
| pdf-lib    | 1.17.1  | reimburse, timesheet, _template         | that app's `config.yml` → `dependencies.pdf-lib` | PDF generation    |

All three are served from cdnjs.cloudflare.com and pinned with a sha384 SRI
hash + `crossorigin="anonymous"`.

## Other external assets (not config-driven)

| Asset                    | Used by     | Declared in         | Notes |
| ------------------------- | ----------- | -------------------- | ----- |
| Schibsted Grotesk (woff2) | all apps    | `assets/style.css`   | via `fonts.bunny.net`, `local()` fallback first |
| JetBrains Mono (woff2)    | all apps    | `assets/style.css`   | via `fonts.bunny.net`, `local()` fallback first |

These are CSS `@font-face` sources shared across every app, not per-app CDN
libraries, so they aren't wired through `config.yml`'s `dependencies:` block.
`font-src` in each app's CSP `<meta>` allows `fonts.bunny.net` for these.

## Live data sources (not a loaded library)

| Source                              | Used by         | Notes |
| ------------------------------------ | ---------------- | ----- |
| GitHub Contents API (`api.github.com`) | `themeselector/` | Lists `kbenestad/mdcms`'s `themes/` category folders and theme files, fetched at runtime — nothing is vendored. |
| Raw file content (`raw.githubusercontent.com`) | `themeselector/` | Fetches the chosen theme's YAML text (via the Contents API's `download_url`), parsed with the same `js-yaml` every app loads. |

Not a versioned CDN script like the libraries above — no SRI hash applies to
a live API response. `themeselector/index.html`'s CSP `connect-src`
additionally allows both hosts for this reason; no other app's CSP is
affected. See CLAUDE.md's "Theme Selector" section for the full rationale
(including why theme fonts are name-only, not fetched).

## Updating a dependency

1. Bump the version and recompute the sha384 hash for the new file.
2. If it's js-yaml: edit the hardcoded `<script>` tag in every app's
   `index.html` `<head>`.
3. If it's jspdf/pdf-lib: edit the relevant `config.yml`'s `dependencies:`
   block (only the apps that use that library).
4. Update the version/hash in the table above.
