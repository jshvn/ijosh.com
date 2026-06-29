# CLAUDE.md

Personal one-page site for **ijosh.com** — a Hugo static site deployed on Cloudflare Pages.

## Stack & deploy

- **Hugo (extended)** static site generator. Config is `hugo.toml` (no theme dir — layouts and assets are vendored directly into the repo).
- **Cloudflare Pages** auto-deploys on push to `master`. There is no manual deploy step. Develop on any branch other than `master`; only merge/push to `master` when ready to go live.
- Single page: `content/_index.md` (front matter + intro copy) rendered by `layouts/index.html`.

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

- `layouts/_default/baseof.html` — base wrapper; partials compose the page.
- `layouts/partials/head.html` — all SEO (meta, OpenGraph/Twitter, JSON-LD Person + ProfilePage), favicon/manifest, the CSS bundle, font + LCP preloads, analytics. **Most edits land here** — keep structured data in sync with `hugo.toml` params.
- Other partials: `intro`, `bio`, `buttons` (social links), `footer`.

## Architecture invariants (don't regress)

- **No third-party runtime assets.** Fonts are self-hosted (`static/fonts/`, `@font-face` in `assets/css/fonts.css`); social/meta icons are inlined SVG at build time from `assets/icons/` (Font Awesome Free 6.x source). Do **not** reintroduce Google Fonts or a Font Awesome CDN.
- **CSS** = `assets/css/{fonts,split,style}.css` concatenated → minified → fingerprinted into one `/css/bundle.<hash>.css` in `head.html`. Add styles to `assets/css/style.css`; don't add new `<link>`s. (`split.css` = vendored theme, `style.css` = custom layer + tokens.)
- **Security headers / CSP** live in `static/_headers`. Adding an external origin (script/font/frame) requires updating the CSP or the browser blocks it.
- **Site config drives templates.** Toggle features via `[params]` booleans in `hugo.toml` (`showemail`, `showgithub`, `showtwitter`, `showlocation`, `showemojis`, `visual.image`); social URLs, author, description, share image, and the Cloudflare beacon token live there too — change config, not template literals.

## Theming (design tokens + dark mode)

Colors are **CSS custom properties** defined in `assets/css/style.css` `:root`; `split.css` references them via `var()`. To recolor the site, change the tokens — not scattered hexes.

- **Tokens:** `--bg`, `--text` (name/tagline/pills), `--icon` (social icons), `--text-muted` (UI greys/links), `--text-body` (bio), `--accent` (link hover), `--pill-bg`.
- **Dark mode** is automatic via `@media (prefers-color-scheme: dark)` overriding the tokens (content panel → brand navy `#061C30`). No toggle/JS. Light text/UI colors meet WCAG AA on their backgrounds — keep it that way if you change tokens.
- **Fonts** — Montserrat (400/600, headings + body), Lora (serif, bio), Graduate, PT Serif. Self-hosted; latin + latin-ext subsets.
- The name uses fluid `clamp(2.25rem, 5vw + 1rem, 3.375rem)` (caps at the prior 54px). Breakpoints: 1200 / 800 / 500px; at 800px the split layout stacks.
- Entry uses `@starting-style` + an opacity transition (not a keyframe). A global `prefers-reduced-motion` guard neutralizes entry + hover motion.

## Gotchas

- `.button--rect` uses `font-family: "PT Sans"`, which is intentionally **not loaded** — it falls back to the browser default, matching the live site. Don't "fix" it to a loaded font without re-blessing the baseline.
- Analytics: Cloudflare beacon fires only when `params.cloudflareBeaconToken` is set; Google Analytics only when configured and not on localhost.
- Images: `assets/images/` (processed via `resources.Get`) vs `static/` (served as-is).
