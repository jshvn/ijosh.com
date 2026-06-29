# 👨🏻‍💻 ijosh.com

This repository contains the contents of [ijosh.com](https://ijosh.com) — a Hugo-based
jamstack site, migrated from SquareSpace and deployed on Cloudflare Pages.

***

## 🛠 Overview

Pushes to the `master` branch are picked up by Cloudflare and deployed live. Develop on a
branch other than `master`, then merge when ready.

The site is built to be **self-contained at runtime**: fonts and icons are served from this
domain (no Google Fonts / CDN calls on page load), CSS is bundled + minified + fingerprinted,
and security headers ship via `static/_headers`.

## 💻 Development

Requires [Hugo (extended)](https://gohugo.io/) and [go-task](https://taskfile.dev/).

```sh
task serve     # live-reloading dev server (hugo server -D -w)
task build     # production build → public/  (hugo --minify --gc)
task --list    # all tasks
```

> **Cloudflare Pages settings (dashboard):** build command `hugo --minify --gc` (Hugo only
> minifies HTML with that flag; CSS/fonts are minified by the asset pipeline), and pin the
> **`HUGO_VERSION`** env var to the tested extended version (currently `0.163.3`; extended is
> required for WebP image processing).

## 🎨 Assets

- **Fonts** — self-hosted in `static/fonts/` (latin + latin-ext subsets) with `@font-face`
  in `assets/css/fonts.css`. Regenerate from Google Fonts only if the font set changes.
- **Icons** — the social/meta icons are inlined as SVG at build time from `assets/icons/`
  (sourced from Font Awesome Free 6.x). No icon font / CDN is loaded.
- **CSS** — `assets/css/{fonts,split,style}.css` are concatenated, minified, and fingerprinted
  into one `/css/bundle.<hash>.css` in `layouts/partials/head.html`.

## 🧪 Visual regression testing

The page is meant to look identical across refactors, so the rendered pixels are locked to a
golden baseline. First run creates a `.venv-visual/` (Pillow) and uses the machine's Chromium.

```sh
task visual:check     # fail if the build drifts from the golden baseline
task visual:bless     # re-capture the baseline (run after an intended UI change)
task visual:vs-live   # compare the local content panel against the live ijosh.com
```

Golden images live in `tests/visual/golden/` (committed). Diff artifacts land in
`tests/visual/out/` (gitignored). **After any intentional visual change, re-run
`task visual:bless` and commit the updated baseline.**

## 👷🏻‍♂️ Theme

Adapted from the [Hugo Split theme](https://themes.gohugo.io/hugo-split-theme/) and merged
with the color scheme of the older Squarespace site. A license was purchased so the theme
attribution links can be removed.
