// Private admin Worker: the enquiries dashboard, its API, CSV export and scheduled email retries.
// Every request (pages, scripts, data) must pass authenticate() first.
import { authenticate } from './auth.js';
import { sendNotification, retryPendingNotifications } from './email.js';
import { SERVICES, RAISE_AMOUNTS, RAISE_TIMINGS, TRACTION, STATUSES, ACTIVE_STATUSES, CLOSED_STATUSES, PRIORITIES, LIMITS } from './options.js';
import { cleanText, isIsoDate, json, londonToday, nowIso } from './util.js';

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cache-Control': 'no-store'
};

function withSecurity(response) {
  const res = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  return res;
}

const LIST_SQL = `SELECT e.id, e.ref, e.received_at, e.name, e.email, e.company, e.service, e.raise_amount, e.raise_timing, e.traction, e.message,
         a.status, a.priority, a.notes, a.last_contacted, a.next_follow_up, a.archived_at, a.updated_at,
         n.status AS notification_status, n.attempts AS notification_attempts, n.last_error AS notification_error, n.sent_at AS notification_sent_at
  FROM enquiries e JOIN enquiry_admin a ON a.enquiry_id = e.id LEFT JOIN notifications n ON n.enquiry_id = e.id`;

async function listEnquiries(env) {
  const { results } = await env.DB.prepare(`${LIST_SQL} ORDER BY e.received_at DESC LIMIT 5000`).all();
  return results;
}

async function getEnquiry(env, id) {
  return env.DB.prepare(`${LIST_SQL} WHERE e.id = ?1`).bind(id).first();
}

function validateUpdate(body) {
  const sets = [];
  const values = [];
  const errors = {};
  if (!body || typeof body !== 'object') return { errors: { form: 'Invalid update.' } };
  if ('status' in body) { if (STATUSES.includes(body.status)) { sets.push('status'); values.push(body.status); } else errors.status = 'Invalid status.'; }
  if ('priority' in body) { if (PRIORITIES.includes(body.priority)) { sets.push('priority'); values.push(body.priority); } else errors.priority = 'Invalid priority.'; }
  if ('notes' in body) {
    const notes = cleanText(String(body.notes ?? ''), { multiline: true });
    if (notes.length > LIMITS.notes) errors.notes = `Notes are limited to ${LIMITS.notes} characters.`; else { sets.push('notes'); values.push(notes); }
  }
  for (const field of ['last_contacted', 'next_follow_up']) {
    if (field in body) {
      const v = body[field] == null ? '' : String(body[field]);
      if (v === '' || isIsoDate(v)) { sets.push(field); values.push(v || null); } else errors[field] = 'Invalid date.';
    }
  }
  if ('archived' in body) {
    if (typeof body.archived !== 'boolean') errors.archived = 'Invalid value.';
    else { sets.push('archived_at'); values.push(body.archived ? nowIso() : null); }
  }
  return { sets, values, errors };
}

const CSV_COLUMNS = [
  ['Reference', 'ref'], ['Date received (UTC)', 'received_at'], ['Company', 'company'], ['Contact name', 'name'], ['Email', 'email'],
  ['Services required', 'service'], ['Fundraising amount', 'raise_amount'], ['Fundraising timing', 'raise_timing'], ['Monthly revenue run-rate', 'traction'],
  ['Additional information', 'message'], ['Status', 'status'], ['Priority', 'priority'], ['Last contacted', 'last_contacted'],
  ['Next follow-up', 'next_follow_up'], ['Internal notes', 'notes'], ['Archived', 'archived_at'], ['Email notification', 'notification_status']
];

function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // stop spreadsheet formula injection
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Same filters as the dashboard, so "Export CSV" downloads exactly what is on screen.
export function filterRows(rows, params, today = londonToday()) {
  const view = params.get('view') || 'active';
  const q = (params.get('q') || '').trim().toLowerCase();
  let out = rows.filter((r) => (view === 'all' ? true : view === 'archived' ? !!r.archived_at : !r.archived_at));
  const status = params.get('status');
  if (status === '__active') out = out.filter((r) => ACTIVE_STATUSES.includes(r.status));
  else if (status) out = out.filter((r) => r.status === status);
  for (const [key, field] of [['service', 'service'], ['amount', 'raise_amount'], ['timing', 'raise_timing']]) {
    const v = params.get(key);
    if (v) out = out.filter((r) => r[field] === v);
  }
  if (params.get('followup') === '1') out = out.filter((r) => r.next_follow_up && r.next_follow_up <= today && !r.archived_at && !CLOSED_STATUSES.includes(r.status));
  if (q) out = out.filter((r) => `${r.company} ${r.name}`.toLowerCase().includes(q));
  return out;
}

function toCsv(rows) {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(',')];
  for (const r of rows) lines.push(CSV_COLUMNS.map(([, k]) => csvCell(k === 'archived_at' ? (r.archived_at ? 'Yes' : 'No') : r[k])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// Mutating requests must come from the dashboard itself (CSRF protection on top of Access's cookie settings).
function isSameOriginWrite(request, url) {
  const origin = request.headers.get('Origin');
  const site = request.headers.get('Sec-Fetch-Site');
  if (origin && origin !== url.origin) return false;
  if (site && site !== 'same-origin') return false;
  if (request.headers.get('X-Requested-With') !== 'hv-admin') return false;
  return (request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json');
}

async function handleApi(request, env, url, user) {
  const path = url.pathname.replace(/^\/admin\/api/, '');
  const method = request.method;

  if (path === '/session' && method === 'GET') {
    return json({
      email: user.email, dev: user.dev, logoutUrl: '/cdn-cgi/access/logout', today: londonToday(),
      options: { services: SERVICES, raiseAmounts: RAISE_AMOUNTS, raiseTimings: RAISE_TIMINGS, traction: TRACTION, statuses: STATUSES, activeStatuses: ACTIVE_STATUSES, closedStatuses: CLOSED_STATUSES, priorities: PRIORITIES }
    });
  }

  if (path === '/enquiries' && method === 'GET') return json({ today: londonToday(), enquiries: await listEnquiries(env) });

  if (path === '/export.csv' && method === 'GET') {
    const rows = filterRows(await listEnquiries(env), url.searchParams);
    return new Response(toCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="hedley-enquiries-${londonToday()}.csv"`, 'Cache-Control': 'no-store' } });
  }

  const match = path.match(/^\/enquiries\/([0-9a-f-]{36})(\/notify)?$/i);
  if (match) {
    const id = match[1].toLowerCase();
    if (method === 'GET' && !match[2]) {
      const row = await getEnquiry(env, id);
      return row ? json({ enquiry: row, today: londonToday() }) : json({ error: 'Not found.' }, 404);
    }
    if (!isSameOriginWrite(request, url)) return json({ error: 'Request blocked.' }, 403);
    if (method === 'PATCH' && !match[2]) {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid update.' }, 400); }
      const { sets, values, errors } = validateUpdate(body);
      if (Object.keys(errors).length) return json({ errors }, 400);
      if (!sets.length) return json({ error: 'Nothing to update.' }, 400);
      const assignments = sets.map((col, i) => `${col} = ?${i + 1}`).join(', ');
      const result = await env.DB.prepare(`UPDATE enquiry_admin SET ${assignments}, updated_at = ?${sets.length + 1} WHERE enquiry_id = ?${sets.length + 2}`)
        .bind(...values, nowIso(), id).run();
      if (!result.meta.changes) return json({ error: 'Not found.' }, 404);
      return json({ enquiry: await getEnquiry(env, id) });
    }
    if (method === 'POST' && match[2]) {
      const outcome = await sendNotification(env, id);
      return json({ outcome, enquiry: await getEnquiry(env, id) });
    }
  }
  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/robots.txt') return withSecurity(new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } }));

    const user = await authenticate(request, env);
    if (!user) {
      const res = url.pathname.startsWith('/admin/api/')
        ? json({ error: 'Not signed in.' }, 401)
        : new Response('<!doctype html><meta charset="utf-8"><title>Access denied</title><p style="font-family:sans-serif;padding:2rem">Access denied. Please sign in again.</p>', { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      return withSecurity(res);
    }

    try {
      if (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/') return withSecurity(Response.redirect(`${url.origin}/admin/enquiries`, 302));
      if (url.pathname.startsWith('/admin/api/')) return withSecurity(await handleApi(request, env, url, user));
      if (request.method !== 'GET') return withSecurity(json({ error: 'Method not allowed.' }, 405));
      if (/^\/admin\/enquiries(\/[0-9a-f-]{36})?\/?$/i.test(url.pathname)) return withSecurity(await env.ASSETS.fetch(new Request(`${url.origin}/index.html`)));
      if (url.pathname.startsWith('/admin/assets/')) {
        const asset = await env.ASSETS.fetch(new Request(`${url.origin}${url.pathname.replace(/^\/admin/, '')}`));
        return withSecurity(asset);
      }
      return withSecurity(json({ error: 'Not found.' }, 404));
    } catch (err) {
      console.error('Admin error:', err && err.message);
      return withSecurity(json({ error: 'Something went wrong.' }, 500));
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await retryPendingNotifications(env);
      const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare('DELETE FROM submission_attempts WHERE created_at < ?1').bind(cutoff).run();
    })());
  }
};
