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

Each app's `buildHeader()` runs this resolution chain at render time:

```
../assets/logo.png  →  ../assets/logo.jpg  →  KB_BRAND_SVG (fallback)
```

The root `index.html` (the navigation page) uses the same chain without the
`../` prefix, since it sits at the same level as `assets/`:

```
assets/logo.png  →  assets/logo.jpg  →  KB_BRAND_SVG
```

## Sizing

Set `logo-maxwidth` (in cm) in each app's `config.yml` to control how wide the
logo appears in the generated PDF. The on-screen header is capped at 52 px tall
by `.kb-brand .logo img { object-fit: contain; }` in `ui.css`.

```yaml
logo-maxwidth: 4   # cm — invoice default
```

## Adding a new app

New apps scaffolded from `_template/` already use `../assets/logo.png`. No
extra wiring needed — just set `logo: yes` in the new app's `config.yml`.
