# CLAUDE.md

Personal one-page site for **ijosh.com** — a Hugo static site deployed on Cloudflare Pages.

## Stack & deploy

- **Hugo** static site generator. Config is `config.toml` (no theme dir — layouts and assets are vendored directly into the repo).
- **Cloudflare Pages** auto-deploys on push to `master`. There is no manual deploy step. Develop on any branch other than `master`; only merge/push to `master` when ready to go live.
- Single page: `content/_index.md` (front matter + intro copy) rendered by `layouts/index.html`.

## Commands (Taskfile)

- `task serve` — `hugo server -D -w` (drafts + watch). Aliases: `serve`, `serv`.
- `task clean` — remove `public/`, `resources/`, `.hugo_build*`.
- `task` — list tasks.

## Layout structure

- `layouts/_default/baseof.html` — base wrapper; partials compose the page.
- `layouts/partials/head.html` — all SEO: meta tags, OpenGraph/Twitter cards, JSON-LD (Person + ProfilePage schema), favicon, analytics. **This is where most edits land** — keep the structured data in sync with `config.toml` params.
- Other partials: `intro`, `bio`, `buttons` (social links), `links`, `footer`, `video`.

## Conventions

- **CSS is plain CSS in `static/css/`** (`split.css` = vendored theme, `style.css` = custom overrides). There is no SCSS source in the repo — edit the compiled CSS directly. `style.css` only loads when `params.custom.css.enable = true`.
- **Site config drives the templates.** Toggle features via `[params]` booleans in `config.toml` (`showemail`, `showgithub`, `showtwitter`, `showlocation`, `showemojis`, `visual.image`). Social URLs, author, description, share image all live there too — change config, not template literals.
- Images live in `assets/images/` (processed via Hugo's `resources.Get`, e.g. profile + favicon) and `static/` (served as-is).
- Theme is a purchased adaptation of [hugo-split-theme](https://themes.gohugo.io/hugo-split-theme/); attribution links may be removed per license.

## Design tokens

Baked into the compiled `static/css/split.css` (no SCSS source to read), kept here for intent — they match the prior SquareSpace design:

- **Fonts** — loaded via `@import` at the top of `split.css`: Montserrat (400/600, headings + body), Lora (serif, bio content), plus Graduate and PT Serif. Font Awesome 6.5.2 via cdnjs CDN (also an `@import` there).
- **Colors** — text/link `#848d96`, link-hover `#CA486d`, dark background `#061C30` (also the `theme-color` meta), name accent `#47bec7`.
- **Breakpoints** — 1200 / 800 / 500px. At 800px the split-screen layout stacks vertically.
- **Icon classes** — `fab` for brands (Instagram/LinkedIn/GitHub/X), `far`/`fa-solid` for the rest (e.g. `far fa-envelope`, `fa-solid fa-location-dot`).

## Gotchas

- JSON-LD in `head.html` has a couple of placeholder values (`alumniOf` "University (update if needed)", `worksFor` "Machine Learning") — fix if touching schema.
- Analytics: Cloudflare beacon is hardcoded in `head.html`; Google Analytics only fires when configured and not on localhost.
