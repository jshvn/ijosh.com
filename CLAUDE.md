# CLAUDE.md

Personal one-page site for **ijosh.com** — a Hugo static site deployed on Cloudflare Pages.

## Stack & deploy

- **Hugo (extended)** static site generator. Config is `hugo.toml` (no theme dir — layouts and assets are vendored directly into the repo).
- **Cloudflare Pages** auto-deploys on push to `master`. There is no manual deploy step. Develop on any branch other than `master`; only merge/push to `master` when ready to go live.
- Single page: `content/_index.md` (front matter: `title`, `roles`, `location`; body = bio copy) rendered by `layouts/index.html`.

## Commands (Taskfile)

- `task serve` — `hugo server -D -w` (drafts + watch).
- `task build` — production build, `hugo --minify --gc`.
- `task visual:check` / `visual:bless` / `visual:vs-live` — see below.
- `task clean` — remove `public/`, `resources/`, `.hugo_build*`.

### Cloudflare Pages settings (one-time, in the dashboard — not in repo)

- **Build command:** `hugo --minify --gc` (Hugo only minifies HTML with `--minify`; CSS/fonts are minified by the asset pipeline regardless).
- **`HUGO_VERSION` env var:** pin to the tested **extended** version (currently `0.163.3`).

## ⚠️ Visual changes — verify, don't guess

This page is meant to look **identical** across refactors. Rendered pixels are locked to golden baselines in `tests/visual/golden/`, captured for **both** `light` and `dark` color schemes × desktop/mobile (`{viewport}-{scheme}.png`).

- **Never report a change to `layouts/` or `assets/css/` as done without running `task visual:check`.** It screenshots the build and fails on any drift. Reasoning about CSS is not verification — render it.
- Matching an external reference (e.g. the live site): use `task visual:vs-live` and the pixel measurements. Do not eyeball-and-guess sizes/colors/spacing.
- After an **intentional** visual change: run `task visual:bless`, then commit the updated golden PNGs.

## Layout structure

- `layouts/_default/baseof.html` — base wrapper: `.field` (the grid background) holds `.hole` (a square in the page color) holding `.card`. Every page fills the card through the `main` block.
- `layouts/index.html` — the card's contents: the `photo` partial, then `.body` with `intro`, `bio` and `buttons`.
- `layouts/partials/head.html` — all SEO (meta, OpenGraph/Twitter, JSON-LD Person + ProfilePage), favicon/manifest, the CSS bundle, font + LCP preloads, analytics. **Most edits land here** — keep structured data in sync with `hugo.toml` params.
- Other partials: `photo` (the photo and the place chip), `intro` (roles list and name), `bio`, `buttons` (the footer: social links and the mark).

## Architecture invariants (don't regress)

- **No third-party runtime assets.** Fonts are self-hosted (`static/fonts/`, `@font-face` in `assets/css/tokens.css`); social/meta icons are inlined SVG at build time from `assets/icons/` (Font Awesome Free 6.x source). Do **not** reintroduce Google Fonts or a Font Awesome CDN. The one cross-origin exception is `brand.ijosh.com` — self-owned, deployed from `jshvn/brand` — which serves the favicon set, the photo, and the mark (`buttons.html` loads `jshvn-mark-on-light.svg` / `-on-dark.svg` through a `<picture>`), and is named under `img-src` in the CSP; keep it there.
- **CSS** = `assets/css/{tokens,style}.css` concatenated → minified → fingerprinted into one `/css/bundle.<hash>.css` in `head.html`. Add styles to `assets/css/style.css`; don't add new `<link>`s. `tokens.css` is a copy of `https://brand.ijosh.com/tokens.css` — never edit it here.
- **Security headers / CSP** live in `static/_headers`. Adding an external origin (script/font/frame) requires updating the CSP or the browser blocks it.
- **Site config drives templates.** Toggle features via `[params]` booleans in `hugo.toml` (`showemail`, `showgithub`, `showtwitter`, `showlocation`, `visual.image`); social URLs, author, description, the photo, and the share image live there too — change config, not template literals.

## Theming (design tokens + dark mode)

Colors and type come from `assets/css/tokens.css`, the brand's own file: `--bg`, `--text`, `--text-body`, `--text-muted`, `--icon`, `--accent`, `--pill-bg`, `--mark`, `--mark-muted`, and the `--font-*` roles. To change one, change it in `jshvn/brand`, copy the file over, and `task check:brand` confirms the copy.

- **Dark mode** is automatic via `prefers-color-scheme`, from the dark block in `tokens.css`; `style.css` swaps only the field image (`--field`). `theme-color` is scheme-aware in `head.html`; the mark swaps to its on-dark file via `<picture>`. No toggle.
- **Fonts** — Montserrat 600 (the name), Graduate 400 (roles, place), PT Serif 400 (bio). `font-synthesis: none`, so nothing is faked bold or italic.
- **The field** is `static/images/field-{light,dark}.svg`, a 24 × 24 cell tile from `scripts/field.mjs` using the brand banners' position hash. `task field` rewrites it; `task check:field` fails on drift.
- **The lattice** is the mark's grid: 20px cells on a 24px pitch below 1100px, doubled to 40 / 48 above. The field is positioned at the card's top-left corner, and the card's size is a cell plus whole pitches, so its edges land between cells. CSS rounds the width; `assets/js/lattice.js`, the page's one script, rounds the height into `--card-h`, which the wide layout also uses to centre the lattice. Wide: 1000 × 568, photo pane 400px. Narrow: as wide as the screen allows in whole pitches (up to 596px), with the same margin above and below.
- `.hole` is a square in the page color behind the rounded card, so the card's corners show the page, not part of a cell.
- The name is sized `min(56px, 19cqw)` against the text column: one line on the wide card and from about 480px of column, two lines on a phone. Roles sit on one line and stack under 400px of column.
- Entry uses `@starting-style` + an opacity transition (not a keyframe). A global `prefers-reduced-motion` guard neutralizes entry + hover motion.

## Gotchas

- Analytics: Cloudflare Web Analytics is enabled per-zone in the Cloudflare dashboard, which injects the beacon
  into the HTML itself. The templates emit no beacon — that is why `script-src`/`connect-src` in `static/_headers`
  name the `cloudflareinsights.com` origins the injected script needs. Google Analytics fires only when configured
  and not on localhost.
- Images: the photo, the share image, the mark and the favicons all load from brand.ijosh.com (`visual.image.file` and `shareImage` in `hugo.toml`). `static/` is served as-is: the field tiles and `favicon.ico`.
- Favicons: the SVG, Apple touch, mask and manifest icons load from `https://brand.ijosh.com/mark/`. `static/favicon.ico` is the one local copy — browsers probe it on this origin, and Google reads ICO but not SVG — so `task check:brand` fails when it drifts from brand (the same task covers `tokens.css` and the fonts). Keep `/favicon.ico` first in the `<link>` order.
