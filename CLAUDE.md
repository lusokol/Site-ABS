# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static website for ABS91 (Amicale Badminton Spinolienne), a badminton club in Epinay-sur-Orge (91360, France). The site is entirely vanilla HTML/CSS/JS with no build step, no package manager, and no framework.

## Running Locally

No build is required. Serve with any static file server:

```bash
python -m http.server 8000
# or
npx http-server -p 8000
```

Then open `http://localhost:8000`.

## Architecture

- **8 HTML pages** at the root: `index.html`, `about.html`, `inscription.html`, `horaires.html`, `actualites.html`, `galerie.html`, `contact.html`, `partenaires.html` — plus `404.html`.
- **`css/style.css`** — single stylesheet using CSS custom properties (`:root` variables) for theming. Responsive breakpoints at 480px, 768px, and 1024px. Includes `prefers-reduced-motion` support.
- **`js/main.js`** — single JS file handling: mobile nav (backdrop + scroll lock + `aria-expanded`), scroll-to-top button, smooth scroll, active nav highlighting, Intersection Observer animations (`.observe` → `.fade-in`), toast notifications (replaces `alert()`), real-time form validation with error messages, animated counters (`data-count` on `.stat-number`, using `requestAnimationFrame`), and gallery lightbox (keyboard + Escape support).
- External dependencies loaded via CDN: Google Fonts (Inter + Montserrat), Font Awesome 6.4.0.
- `amicalebadmintonspinolienne.WordPress.2025-11-21.xml` — WordPress export from the old site, kept as reference content.

## Key Conventions

- All content is in French.
- CSS theming is done exclusively through `:root` custom properties — change colors/spacing there, not in individual rules.
- Each HTML page uses `<main>` between header and footer. A `<div class="nav-backdrop">` sits after `</header>` for mobile menu overlay.
- Scroll animations use the `.observe` class; the JS Intersection Observer adds `.fade-in` on visibility. Directional variants: `.observe-left`, `.observe-right`, `.observe-zoom`. Elements are only hidden when JS is active (`.js` class on `<html>`), and siblings reveal in cascade via a `--stagger` CSS variable set by JS. Animations are disabled when `prefers-reduced-motion` is active.
- Stat counters use `data-count="N"` on `.stat-number` elements.
- Header and footer live in `components/header.html` and `components/footer.html`, loaded on each page via `<div data-include="components/...">` (fetched by `js/main.js`) — edit them once there, not per page.
- Decorative elements injected by JS (no HTML needed): scroll progress bar (`.scroll-progress`), floating shapes in `.hero` / `.section-cta` sections (`.float-deco`), 3D tilt on `.card` (mouse only), ripple on `.btn` click.
- The home page has a scrolling `.marquee` strip (duplicated `.marquee-track` content for a seamless loop, `aria-hidden`).
- News filters (`actualites.html`): buttons carry `data-filter` and cards carry `data-category` (`actualites` / `interclubs` / `evenements`); the JS toggles `.is-hidden`. The active button gets `badge-primary` + `aria-pressed`.
- The production domain is `https://abs91.fr` — used in `sitemap.xml`, `robots.txt`, canonical/Open Graph tags (in every page `<head>`) and the JSON-LD block on `index.html`. Keep these in sync when adding/renaming pages.
- `horaires.html` has a visual weekly `.planning` grid (slot colors: `--loisir`, `--jeunes`, `--compet`); `about.html` has a `.timeline` (alternating items, tightened with negative margins on desktop only).
- CTA sections use class `section-cta` with `btn-cta-primary` / `btn-cta-outline` buttons (white-on-dark styling).
- Cards use `card-center` for centered layout, `card-featured` for highlighted cards, `card-dark` for dark gradient cards.
- Toast container (`<div class="toast-container">`) and scroll-to-top button (`<button class="scroll-top">`) are present on every page before `</body>`.
- Form validation uses `.form-error` divs after required inputs — the JS toggles `.visible` class and `.error` on inputs.
- Avoid inline `style` attributes — use CSS utility classes (`.text-center`, `.intro-text`, `.mt-2`, `.mb-4`, `.mx-auto`, `.grid-2`, `.cards-grid-sm`, `.d-flex`, `.align-center`, `.gap-sm`, etc.).

## Mobile Gotchas (hard-won — do not regress)

- Horizontal overflow is contained with `overflow-x: clip` on `html` and `main` — never use `overflow-x: hidden` on `body`/`html`: combined they break `position: sticky` (header + home banner). Off-screen `position: fixed` elements still expand the mobile layout viewport (page zooms out) even with clip, hence:
- The mobile nav panel lives inside `.nav-wrap` (`display: contents` on desktop, fixed full-screen `overflow: hidden` frame on mobile) and slides via `transform`, not `right: -100%`.
- The header's `backdrop-filter` makes it the containing block for fixed descendants — `.nav-wrap` uses explicit `top/left/right/height` instead of `inset: 0` (which would resolve against the header box).
- `.nav-backdrop` must keep `pointer-events: none` when inactive — it covers the whole page invisibly on mobile and would swallow all taps.
- The home banner animation is unchanged on desktop; on mobile (≤768px) it switches to full-screen banner (`100svh - header`), shorter scroll track (`190vh` wrapper) and a smaller logo (`72vw`) rolling along the bottom.
