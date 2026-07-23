# Logo

## Where the file lives

One logo file, shared by every app:

```
assets/logo.png   ← canonical (preferred)
assets/logo.jpg   ← fallback if .png is absent
```

The root `assets/` folder is the shared layer that every app already references
for `style.css`, `ui.css`, and `app.js`. The logo lives there too.

## How to set a logo

1. Drop `logo.png` (or `logo.jpg`) into `assets/`.
2. In **every** app's `config.yml` (and in the root `config.yml`), set:

   ```yaml
   logo: yes
   ```

   Setting it in each app's config lets you show the logo in some apps and not
   others. Set it to `yes` everywhere to show it across the board.

3. That's it — no code changes, no restarts.

## How apps load the logo

Every app's `buildHeader()` delegates the brand block (logo/mark + org name) to
a single shared helper, **`kbBuildBrand()` in `app.js`**, so the header renders
identically across the whole suite — and any new app scaffolded from
`_template/` inherits the same behaviour with no extra wiring. `kbBuildBrand()`
picks one of three cases, in priority order:

1. **No `organization` set** → the generic bizdocs mark (`KB_BRAND_SVG`) plus a
   placeholder label — an unconfigured deploy never shows a broken image.
2. **`organization` set *and* `logo: yes`** → the real logo image, resolved at
   render time down this chain:

   ```
   ../assets/logo.png  →  ../assets/logo.jpg  →  KB_BRAND_SVG (fallback)
   ```

   The header also gains a white-card backdrop so a logo with white/transparent
   edges reads against the tinted page.
3. **`organization` set, no logo** → the app's own brand icon (invoice,
   timesheet and reimburse each pass one; the other apps use the generic mark)
   plus the org name and tagline.

The root `index.html` (the navigation page) calls the same helper with an empty
path prefix instead of `../`, since it sits at the same level as `assets/`:

```
assets/logo.png  →  assets/logo.jpg  →  KB_BRAND_SVG
```

An app that wants its own brand icon for case 3 passes `appIcon:` (an SVG-markup
string) to `kbBuildBrand()`; see `invoice`/`timesheet`/`reimburse`.

## Sizing

Set `logo-maxwidth` (in cm) in each app's `config.yml` to control how wide the
logo appears. It applies **both** in the generated PDF **and** on-screen: when a
logo image shows, `kbBuildBrand()` renders it at its natural aspect ratio,
capped at 52 px tall (inline `max-height`) and at `logo-maxwidth` cm wide
(inline `max-width`). The image is appended directly to `.kb-brand`, so it is
not confined to the fixed 46 px `.logo` box that holds the fallback marks.

```yaml
logo-maxwidth: 4   # cm — invoice default
```

## Adding a new app

New apps scaffolded from `_template/` already call the shared `kbBuildBrand()`
helper, so they load and render the logo exactly like every other app. No extra
wiring needed — just set `logo: yes` (and an `organization`) in the new app's
`config.yml`.
