# 👨🏻‍💻 ijosh.com

This repository contains the contents of [ijosh.com](https://ijosh.com) — a Hugo-based
jamstack site deployed on Cloudflare Pages.

***

## 🛠 Overview

Pushes to the `master` branch are picked up by Cloudflare and deployed live. Develop on a
branch other than `master`, then merge when ready.

The site is built to be **self-contained at runtime**: fonts and social icons are served
from this domain (no Google Fonts / CDN calls on page load), favicons, the mark and the photo
from [brand.ijosh.com](https://brand.ijosh.com) (also ours, from `jshvn/brand`), CSS is bundled +
minified + fingerprinted, and security headers ship via `static/_headers`.

## 💻 Development

Requires [Hugo (extended)](https://gohugo.io/) and [go-task](https://taskfile.dev/).

```sh
task serve     # live-reloading dev server (hugo server -D -w)
task build     # production build → public/  (hugo --gc; hugo.toml minifies)
task --list    # all tasks
```

> **Cloudflare Pages settings** live in [`jshvn/terraform`](https://github.com/jshvn/terraform)
> (`account/pages.tf`): the build command, and **`HUGO_VERSION`** pinned to the tested
> extended version.

## 🎨 Assets

- **Tokens and fonts** — `assets/css/tokens.css` and `static/fonts/` are copies of the ones
  brand.ijosh.com serves (colors, type roles, `@font-face`). Change them in `jshvn/brand` and
  copy them over; `task check:brand` fails when a copy drifts.
- **Icons** — the social/meta icons are inlined as SVG at build time from `assets/icons/`
  (sourced from Font Awesome Free 6.x). No icon font / CDN is loaded.
- **CSS** — `assets/css/{tokens,style}.css` are concatenated, minified, and fingerprinted
  into one `/css/bundle.<hash>.css` in `layouts/_partials/head.html`.
- **Field** — the grid background is `static/images/field-{light,dark}.svg`, written by
  `task field` from `scripts/field.mjs`; `task check:field` fails if they drift.
  `assets/js/lattice.js`, the page's one script, rounds the card's height to the grid when
  the words are taller than the screen; everywhere else CSS does it.

## 🧪 Visual regression testing

The page is meant to look identical across refactors, so the rendered pixels are locked to a
golden baseline. First run creates a `.venv-visual/` (Pillow) and uses the machine's Chromium.

```sh
task visual:check     # fail if the build drifts from the golden baseline
task visual:bless     # re-capture the baseline (run after an intended UI change)
task visual:vs-live   # compare the local page against the live ijosh.com
```

Golden images live in `tests/visual/golden/` (committed). Diff artifacts land in
`tests/visual/out/` (gitignored). **After any intentional visual change, re-run
`task visual:bless` and commit the updated baseline.**

## 👷🏻‍♂️ Design

One card on the `jshvn/brand` grid field: the photo on the left with the place pinned to it,
then the name, the roles as chips, the bio, and a footer with the social links and the mark. On
narrow screens the card stacks, photo on top. Colors, type and the mark follow
[brand.ijosh.com](https://brand.ijosh.com).
