# Hedley Ventures enquiry system

Two Cloudflare Workers sharing one D1 database (`hedley-enquiries`, Western Europe):

| Worker | URL | Purpose |
|---|---|---|
| `hedley-enquiry-intake` | https://hedley-enquiry-intake.hedley-enquiries.workers.dev/api/enquiries | Receives Contact page submissions (Turnstile spam check, validation, rate limits, duplicate protection), stores them, emails a notification via Resend. Cannot read enquiries back. |
| `hedley-enquiries-admin` | https://hedley-enquiries-admin.hedley-enquiries.workers.dev/admin/enquiries | Private dashboard + API + CSV export. Protected by Cloudflare Access (Cloudflare account members only) **and** verifies the Access token itself (`src/auth.js`). Cron every 15 min retries failed emails. |

`https://hedleyventures.com/admin/enquiries/` simply forwards to the dashboard.

## Dashboard sections
- **Overview**: pipeline (active opportunities, estimated fees, proposals, won), follow-ups due in the next 7 days, website last 30 days, latest enquiries.
- **Enquiries**: the table, filters (incl. source and follow-up), detail view with source and an optional estimated fee, CSV export.
- **Website**: visits, page views, enquiries and enquiries per 100 visits (7/30/90 days vs previous period), daily chart, top pages, referring sites, enquiries by source.

## Website analytics and enquiry source
- Every public page loads Cloudflare Web Analytics (cookieless beacon, site tag in `wrangler.admin.toml`) and `/assets/attribution.js`.
- `attribution.js` keeps the visit's landing page, referring host and UTM tags in `sessionStorage` (this tab only); the Contact form sends them with the enquiry and `src/source.js` turns them into a channel.
- The admin Worker's cron copies Web Analytics figures (GraphQL API, `CF_ANALYTICS_TOKEN` = Account Analytics: Read) into `analytics_daily` / `analytics_breakdown` at most hourly; first run backfills 90 days. Only hedleyventures.com hosts are counted (local previews are ignored).
- Tag links you share so the source is reliable, e.g. `https://hedleyventures.com/?utm_source=linkedin&utm_medium=social&utm_campaign=oct-post`.

## Settings
- Plain settings live in `wrangler.intake.toml` / `wrangler.admin.toml` (`[vars]`).
- Secrets are stored in Cloudflare only (Workers → service → Settings → Variables and secrets), never in this repo:
  - intake: `TURNSTILE_SECRET`, `RESEND_API_KEY`, `NOTIFY_TO`
  - admin: `RESEND_API_KEY`, `NOTIFY_TO`, `ADMIN_EMAIL`, `CF_ANALYTICS_TOKEN`
- Turnstile site key (public) is in `dist/contact/index.html` (`data-sitekey`).
- Email is sent from `enquiries@notify.hedleyventures.com` (Resend domain `notify.hedleyventures.com`, DNS records in Squarespace).

## Local testing
Requires Node.js (a portable copy is used, see project notes). From this folder:
```
npm install
npm run db:migrate:local
node test/mock-resend.mjs          # stand-in for Resend, writes to test/outbox
npm run dev:intake                  # http://127.0.0.1:8787
npm run dev:admin                   # http://127.0.0.1:8788/admin/enquiries (local test sign-in)
node test/e2e-local.mjs             # end-to-end checks
npm test                            # sign-in verification unit tests
```
`.dev.vars` (not committed) holds local-only test values, including Turnstile's published test secret.

## Deploying changes
`npx wrangler login` once, then `npm run deploy` (applies new database migrations, then deploys both Workers).
Schema changes go in a new file in `migrations/` — never edit an applied migration.

## Backups and recovery
- D1 Time Travel can restore the database to any minute in the last 7 days (free plan):
  `npx wrangler d1 time-travel restore hedley-enquiries --timestamp=<ISO time> -c wrangler.admin.toml`
- Full export: `npx wrangler d1 export hedley-enquiries --remote --output=backup.sql -c wrangler.admin.toml`
- The dashboard's "Export CSV" gives a spreadsheet copy at any time.

## Data retention
The Privacy Policy says enquiries are kept for up to 24 months after last contact. The dashboard archives but never deletes;
permanent deletion (e.g. on request) is done with `wrangler d1 execute` against `enquiries`, `enquiry_admin` and `notifications`.
