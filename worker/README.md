# Hedley Ventures enquiry system

Two Cloudflare Workers sharing one D1 database (`hedley-enquiries`, Western Europe):

| Worker | URL | Purpose |
|---|---|---|
| `hedley-enquiry-intake` | https://hedley-enquiry-intake.hedley-enquiries.workers.dev/api/enquiries | Receives Contact page submissions (Turnstile spam check, validation, rate limits, duplicate protection), stores them, emails a notification via Resend. Cannot read enquiries back. |
| `hedley-enquiries-admin` | https://hedley-enquiries-admin.hedley-enquiries.workers.dev/admin/enquiries | Private dashboard + API + CSV export. Protected by Cloudflare Access (Cloudflare account members only) **and** verifies the Access token itself (`src/auth.js`). Cron every 15 min retries failed emails. |

`https://hedleyventures.com/admin/enquiries/` simply forwards to the dashboard.

## Settings
- Plain settings live in `wrangler.intake.toml` / `wrangler.admin.toml` (`[vars]`).
- Secrets are stored in Cloudflare only (Workers → service → Settings → Variables and secrets), never in this repo:
  - intake: `TURNSTILE_SECRET`, `RESEND_API_KEY`, `NOTIFY_TO`
  - admin: `RESEND_API_KEY`, `NOTIFY_TO`, `ADMIN_EMAIL`
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
