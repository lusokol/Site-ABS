# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Website for ABS91 (Amicale Badminton Spinolienne), a badminton club in Épinay-sur-Orge (91360, France). Two layers: a static public site (vanilla HTML/CSS/JS, no build step) and a Node.js backend powering an authenticated member/admin dashboard.

All content is in French.

## Running

**Static site** — no build required:
```bash
python -m http.server 8000
```

**Backend** (port 3002):
```bash
cd server && npm install
cp .env.example .env   # fill in secrets
npm run seed            # create initial admin user
npm run dev             # nodemon for dev
npm start               # production
```

**Production** — systemd service `abs91` running as www-data with `/usr/local/bin/node20`:
```bash
systemctl restart abs91
journalctl -u abs91 -f
```

Nginx proxies `/abs/api/` → `http://127.0.0.1:3002/api/` (rewrite strip). Currently deployed at `https://tcg-demo.fr/abs/`, production domain is `https://abs91.fr`.

## Architecture

### Public Site

- **9 HTML pages** at root: `index.html`, `about.html`, `inscription.html`, `horaires.html`, `actualites.html`, `galerie.html`, `contact.html`, `partenaires.html`, `mentions-legales.html` — plus `404.html`.
- **`css/style.css`** — single stylesheet, CSS custom properties in `:root` for theming. Breakpoints: 480px, 768px, 1024px. Has `prefers-reduced-motion` support. Dark mode via `html.dark` class (~100 override rules at end of file).
- **`js/main.js`** — mobile nav, scroll-to-top, Intersection Observer animations, toast notifications, form validation (contact form POSTs to `/api/contact`), animated counters, gallery lightbox, theme toggle, page loader.
- **`components/header.html` / `footer.html`** — loaded via `<div data-include="...">` by main.js. Edit once, reflected on all pages. Header includes a `.theme-toggle` button (moon/sun icons).
- CDN deps: Google Fonts (Inter + Montserrat), Font Awesome 6.4.0.
- **Images**: WebP versions alongside originals in `media/` (e.g. `gymnasemil.webp`). Use WebP in CSS/HTML, keep originals for OG meta fallback.

### Backend (`server/`)

Node.js + Express on port 3002. SQLite via better-sqlite3 (WAL mode, foreign keys).

```
server/
├── index.js              # Express entry — json() then all route mounts
├── db/
│   ├── schema.sql        # users, slots, bookings tables
│   ├── connection.js     # better-sqlite3 singleton
│   └── seed.js           # initial admin account
├── routes/
│   ├── auth.js           # login, invite (magic link), set-password, /me, refresh
│   ├── slots.js          # CRUD for lesson slots (admin/prof)
│   ├── bookings.js       # book/cancel with transaction-based capacity check
│   ├── payments.js       # HelloAsso webhook + mark-paid for cash
│   ├── members.js        # member list, edit, activate/deactivate, reinvite
│   ├── admin.js          # dashboard summary (stats, revenue, per-member cash)
│   └── contact.js        # public contact form → email to club
├── middleware/
│   ├── auth.js           # JWT authenticate + role authorize
│   ├── validate.js       # isEmail, isDate, isTime, sanitize helpers
│   └── rate-limit.js     # in-memory rate limiter factory
└── lib/
    ├── token.js          # signToken / verifyToken (JWT, 24h)
    ├── email.js          # nodemailer Gmail SMTP (magic link, booking confirm, contact)
    └── helloasso.js      # OAuth2 token + checkout intent creation
```

**Auth flow**: Admin invites member by email → UUID magic link (48h expiry) → member sets password + name → bcrypt hash (cost 12) → JWT issued. Login returns JWT stored in localStorage.

**Booking flow**: `bookSlot` is a SQLite transaction that checks capacity, past dates, duplicates, and handles re-booking after cancellation (UPDATE instead of INSERT due to UNIQUE(slot_id, user_id) constraint). Cancellation within 24h is blocked for non-admins; paid cancellations return a credit notice.

**HelloAsso**: OAuth2 client_credentials flow with cached access token. `createCheckoutIntent()` creates a checkout on HelloAsso and returns a `redirectUrl` for the payer. HelloAsso sends a POST notification to `/api/payments/webhook` when payment completes (configure the URL in HelloAsso dashboard > Paramètres > Notifications). Env vars: `HELLOASSO_CLIENT_ID`, `HELLOASSO_CLIENT_SECRET`, `HELLOASSO_ORG_SLUG`.

### Dashboard (`app/`)

Standalone HTML pages (no header/footer from public site). Auth via `app/js/auth.js` which provides `SITE_BASE`, `API_BASE`, `apiFetch()`, `requireAuth()`, `refreshUser()`, `showToast()`. Styles in `app/css/dashboard.css` (imports `style.css`).

```
app/
├── login.html            # email/password form
├── set-password.html     # magic link landing (name + password)
├── js/auth.js            # client auth module + sidebar toggle/backdrop
├── css/dashboard.css     # sidebar, stats grid, tables→cards on mobile, modals
├── admin/                # requireAuth(['admin']) or ['admin','prof']
│   ├── index.html        # stats dashboard
│   ├── slots.html        # CRUD slots with modal form
│   ├── bookings.html     # all bookings with filters
│   ├── members.html      # invite/edit/deactivate members
│   └── payments.html     # cash tracking with mark-paid
└── member/               # requireAuth() — any role
    ├── index.html        # upcoming bookings
    ├── bookings.html     # calendar view (monthly grid, colored slot blocks)
    └── history.html      # past bookings table
```

**Dynamic sidebar**: member pages use `buildSidebar(user)` to show admin or member nav based on `user.role`. Admin pages have static admin sidebars.

**Subdirectory deployment**: `SITE_BASE` is detected from `window.location.pathname` (looks for `/abs/` segment). All API calls and redirects use `SITE_BASE + '/api/...'` or `SITE_BASE + '/app/...'`. HTML uses relative paths (`./`, `../`).

**Mobile dashboard**: tables convert to card layout via CSS (`data-label` attributes on `<td>` → `::before` pseudo-elements). Sidebar slides in as overlay with backdrop.

## Key Conventions

- CSS theming via `:root` custom properties — change colors/spacing there, not in individual rules.
- Avoid inline `style` attributes — use CSS utility classes (`.text-center`, `.mt-2`, `.mb-4`, `.mx-auto`, `.grid-2`, `.d-flex`, `.text-primary`, `.text-cyan`, `.text-teal`, `.text-accent`, `.text-muted`, `.text-lg`, `.fw-600`, `.link-highlight`, `.gap-sm`, `.gap-md`, etc.).
- Scroll animations: `.observe` class → JS adds `.fade-in`. Variants: `.observe-left`, `.observe-right`, `.observe-zoom`. Disabled when `prefers-reduced-motion` is active.
- Toast container + scroll-to-top button present on every public page before `</body>`.
- Empty states in dashboard use `.empty-state` with `display: flex` (not `block`) when shown by JS.
- The production domain `https://abs91.fr` is used in `sitemap.xml`, `robots.txt`, canonical/OG tags, and JSON-LD. Keep in sync when adding pages.
- Contact form in `js/main.js` POSTs to `/api/contact` (rate-limited, 5/15min).
- **Dark mode**: class-based (`html.dark`), not `@media (prefers-color-scheme)`. A top-level IIFE in `main.js` applies the class immediately (before paint) from `localStorage('theme')`, falling back to system preference. The `.theme-toggle` button in the header toggles the class and persists to localStorage. All dark overrides in `style.css` are prefixed `html.dark` — when adding new component styles, add a corresponding `html.dark .component` rule at the end of the dark mode block.
- **Page loader**: `index.html` only. A `.page-loader` div with logo + animated bar, dismissed after hero images preload (4s fallback). Respects `prefers-reduced-motion`.
- **FAQ accordion**: uses native `<details class="faq-item">/<summary class="faq-question">` with a `.faq-chevron` icon. See `contact.html` for the pattern.
- **Mentions légales TOC**: `mentions-legales.html` has a `<nav aria-label="Sommaire">` card with anchor links to each section `h2[id]`.

## Mobile Gotchas (hard-won — do not regress)

- Horizontal overflow: `overflow-x: clip` on `html` and `main` — never `overflow-x: hidden` on `body`/`html` (breaks `position: sticky`).
- Mobile nav lives inside `.nav-wrap` (`display: contents` on desktop, fixed frame on mobile) sliding via `transform`, not `right: -100%`.
- Header's `backdrop-filter` makes it containing block for fixed descendants — `.nav-wrap` uses explicit `top/left/right/height` instead of `inset: 0`.
- `.nav-backdrop` must keep `pointer-events: none` when inactive.
- Home banner: on mobile (≤768px) switches to `100svh - header`, `190vh` wrapper, `72vw` logo.
- Dashboard sidebar: uses `transform` slide + JS-injected `.sidebar-backdrop` (in `auth.js`). Toggle handler is centralized in `auth.js` — do not add per-page handlers.

## Deployment Notes

- Node 20 binary at `/usr/local/bin/node20` (system node is v18, incompatible with better-sqlite3 compiled for v20).
- SQLite DB at `server/data/abs91.db` — gitignored. Schema applied on first connection by `connection.js`.
- `.env` is gitignored. Contains JWT_SECRET, SMTP credentials (Gmail app password), HelloAsso API keys.
- Nginx configs: `/etc/nginx/sites-available/abs91.fr` (production) and `/etc/nginx/sites-available/tcg-demo.fr` (staging).
