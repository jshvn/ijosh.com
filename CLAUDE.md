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
- **`HUGO_VERSION` env var:** pin to the tested **extended** version (currently `0.163.3`). Extended is required for WebP image processing.

## ⚠️ Visual changes — verify, don't guess

This page is meant to look **identical** across refactors. Rendered pixels are locked to golden baselines in `tests/visual/golden/`, captured for **both** `light` and `dark` color schemes × desktop/mobile (`{viewport}-{scheme}.png`).

- **Never report a change to `layouts/` or `assets/css/` as done without running `task visual:check`.** It screenshots the build and fails on any drift. Reasoning about CSS is not verification — render it.
- Matching an external reference (e.g. the live site): use `task visual:vs-live` and the pixel measurements. Do not eyeball-and-guess sizes/colors/spacing.
- After an **intentional** visual change: run `task visual:bless`, then commit the updated golden PNGs.

## Layout structure

- `layouts/_default/baseof.html` — base wrapper; the content panel is one CSS grid (`.bento`) and every partial emits tiles straight into it, so a partial must not wrap its tiles in an extra element.
- `layouts/partials/head.html` — all SEO (meta, OpenGraph/Twitter, JSON-LD Person + ProfilePage), favicon/manifest, the CSS bundle, font + LCP preloads, analytics. **Most edits land here** — keep structured data in sync with `hugo.toml` params.
- Other partials: `intro` (name tile, mark tile, one tile per role, place tile), `bio`, `buttons` (the social tile).

## Architecture invariants (don't regress)

- **No third-party runtime assets.** Fonts are self-hosted (`static/fonts/`, `@font-face` in `assets/css/fonts.css`); social/meta icons are inlined SVG at build time from `assets/icons/` (Font Awesome Free 6.x source). Do **not** reintroduce Google Fonts or a Font Awesome CDN. The one cross-origin exception is `brand.ijosh.com` — self-owned, deployed from `jshvn/brand` — which serves the favicon set and the mark (`intro.html` loads `jshvn-mark-on-light.svg` / `-on-dark.svg` through a `<picture>`), and is named under `img-src` in the CSP; keep it there.
- **CSS** = `assets/css/{fonts,split,style}.css` concatenated → minified → fingerprinted into one `/css/bundle.<hash>.css` in `head.html`. Add styles to `assets/css/style.css`; don't add new `<link>`s. (`split.css` = vendored theme, `style.css` = custom layer + tokens.)
- **Security headers / CSP** live in `static/_headers`. Adding an external origin (script/font/frame) requires updating the CSP or the browser blocks it.
- **Site config drives templates.** Toggle features via `[params]` booleans in `hugo.toml` (`showemail`, `showgithub`, `showtwitter`, `showlocation`, `visual.image`); social URLs, author, description, and share image live there too — change config, not template literals.

## Theming (design tokens + dark mode)

Colors are **CSS custom properties** defined in `assets/css/style.css` `:root`; `split.css` references them via `var()`. To recolor the site, change the tokens — not scattered hexes.

- **Tokens:** `--bg`, `--text` (name, role/place tiles), `--icon` (social icons, place pin), `--text-muted` (UI greys/links), `--text-body` (bio), `--accent` (link hover), `--tile-bg` (every tile's fill, including the mark's).
- **Dark mode** is automatic via `@media (prefers-color-scheme: dark)` overriding the tokens (content panel → neutral charcoal `#17191c`; `theme-color` is scheme-aware in `head.html`). The mark swaps to its on-dark file via `<picture>`. No toggle/JS. Light text/UI colors meet WCAG AA on their backgrounds — keep it that way if you change tokens.
- **Fonts** — Montserrat (400/600, headings + body), Lora (serif, bio), Graduate, PT Serif. Self-hosted; latin + latin-ext subsets.
- **Bento sizing** follows the mark's grid (20-unit cell, 4-unit gap, rx 4): a 64px row unit, 8px gap, 16px radius on wide columns; 72 / 8 / 14 on narrow ones. Tiles: name (full width), mark (2×2), one per role (2×1), place (2×1), bio (full width, no fill), socials (full width).
- The column count comes from a **container query** on `.split-content-vertically-center`, not the viewport: 6 columns from 409px of column width, 4 below. 409px is the narrowest column where a two-column word tile still holds ENGINEER. Viewport breakpoints stay 1200 / 800 / 500px; at 800px the split layout stacks.
- The name is one line, sized to its tile with container units: `clamp(30px, 11.6cqw, 54px)`, untracked. 11.6cqw fits "JOSH VAUGHEN" (8.36em in Montserrat 600) with 3% slack; a longer name needs a smaller factor.
- Entry uses `@starting-style` + an opacity transition (not a keyframe). A global `prefers-reduced-motion` guard neutralizes entry + hover motion.

## Gotchas

- Analytics: Cloudflare Web Analytics is enabled per-zone in the Cloudflare dashboard, which injects the beacon
  into the HTML itself. The templates emit no beacon — that is why `script-src`/`connect-src` in `static/_headers`
  name the `cloudflareinsights.com` origins the injected script needs. Google Analytics fires only when configured
  and not on localhost.
- Images: `assets/images/` (processed via `resources.Get`) vs `static/` (served as-is).
- Favicons: the SVG, Apple touch, mask and manifest icons load from `https://brand.ijosh.com/mark/`. `static/favicon.ico` is the one local copy — browsers probe it on this origin, and Google reads ICO but not SVG — so `task check:favicon` fails when it drifts from brand. Keep `/favicon.ico` first in the `<link>` order.
