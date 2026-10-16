// Public enquiry intake Worker. Its only job: accept a submission from the Contact page, check it is genuine,
// store it, and trigger the email notification. It has no way to read enquiries back out.
import { validateEnquiry } from './validate.js';
import { sendNotification } from './email.js';
import { json, makeRef, nowIso, sha256Hex, splitList } from './util.js';

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMITS = [{ windowMs: 60 * 60 * 1000, max: 5 }, { windowMs: 24 * 60 * 60 * 1000, max: 12 }];
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;
const MIN_FILL_MS = 2000;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!splitList(env.ALLOWED_ORIGINS).includes(origin)) return null;
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}

async function ipHash(env, request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await env.DB.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES ('ip_salt', ?1)`).bind(crypto.randomUUID() + crypto.randomUUID()).run();
  const salt = await env.DB.prepare(`SELECT value FROM app_config WHERE key = 'ip_salt'`).first('value');
  return sha256Hex(`${salt}:${ip}`);
}

async function overRateLimit(env, hash) {
  for (const { windowMs, max } of RATE_LIMITS) {
    const since = new Date(Date.now() - windowMs).toISOString();
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM submission_attempts WHERE ip_hash = ?1 AND created_at > ?2').bind(hash, since).first('n');
    if (count >= max) return true;
  }
  return false;
}

async function verifyTurnstile(env, token, request) {
  if (!env.TURNSTILE_SECRET) throw new Error('TURNSTILE_SECRET is not configured.');
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const outcome = await res.json().catch(() => ({}));
  return outcome.success === true;
}

async function handleSubmit(request, env, ctx, cors) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return json({ ok: false, error: 'Unsupported request.' }, 415, cors);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: 'Submission is too large.' }, 413, cors);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, error: 'Invalid submission.' }, 400, cors); }

  const hash = await ipHash(env, request);
  if (await overRateLimit(env, hash)) return json({ ok: false, error: 'Too many enquiries have been sent from this connection. Please try again later or email directly.' }, 429, cors);
  await env.DB.prepare('INSERT INTO submission_attempts (ip_hash, created_at) VALUES (?1, ?2)').bind(hash, nowIso()).run();

  // Bots: hidden "website" field filled in, or form completed implausibly fast. Pretend success, store nothing.
  if ((typeof body.website === 'string' && body.website.trim()) || (Number(body.elapsedMs) > 0 && Number(body.elapsedMs) < MIN_FILL_MS)) {
    return json({ ok: true, ref: null }, 200, cors);
  }

  const result = validateEnquiry(body);
  if (!result.ok) return json({ ok: false, errors: result.errors }, 400, cors);
  const data = result.data;

  // Same form submitted twice (double click, network retry): return the original result.
  const existing = await env.DB.prepare('SELECT ref FROM enquiries WHERE submission_key = ?1').bind(data.submissionKey).first();
  if (existing) return json({ ok: true, ref: existing.ref, duplicate: true }, 200, cors);

  if (!(await verifyTurnstile(env, body.turnstileToken, request))) {
    return json({ ok: false, error: 'We could not verify your submission. Please try again.', retryVerification: true }, 403, cors);
  }

  // Identical enquiry re-sent shortly afterwards (e.g. from a reloaded page): don't store or notify twice.
  const fingerprint = await sha256Hex([data.email, data.company.toLowerCase(), data.message || ''].join('\u0000'));
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const recent = await env.DB.prepare('SELECT ref FROM enquiries WHERE fingerprint = ?1 AND received_at > ?2').bind(fingerprint, since).first();
  if (recent) return json({ ok: true, ref: recent.ref, duplicate: true }, 200, cors);

  const id = crypto.randomUUID();
  const ref = makeRef();
  const receivedAt = nowIso();
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO enquiries (id, ref, received_at, name, email, company, service, raise_amount, raise_timing, traction, message, submission_key, fingerprint)
                      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`)
        .bind(id, ref, receivedAt, data.name, data.email, data.company, data.service, data.raiseAmount, data.raiseTiming, data.traction, data.message, data.submissionKey, fingerprint),
      env.DB.prepare(`INSERT INTO enquiry_admin (enquiry_id, updated_at) VALUES (?1, ?2)`).bind(id, receivedAt),
      env.DB.prepare(`INSERT INTO notifications (enquiry_id) VALUES (?1)`).bind(id)
    ]);
  } catch (err) {
    // A simultaneous duplicate (same submission key) loses the race on the UNIQUE index: report the stored one.
    const again = await env.DB.prepare('SELECT ref FROM enquiries WHERE submission_key = ?1').bind(data.submissionKey).first();
    if (again) return json({ ok: true, ref: again.ref, duplicate: true }, 200, cors);
    throw err;
  }

  // The enquiry is stored. Email runs after the response; a failure is recorded and retried, never reported to the visitor.
  ctx.waitUntil(sendNotification(env, id));
  return json({ ok: true, ref }, 201, cors);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    if (url.pathname !== '/api/enquiries') return json({ ok: false, error: 'Not found.' }, 404);

    const cors = corsHeaders(request, env);
    if (!cors) return json({ ok: false, error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405, cors);

    try {
      return await handleSubmit(request, env, ctx, cors);
    } catch (err) {
      console.error('Enquiry intake error:', err && err.message);
      return json({ ok: false, error: 'Sorry, something went wrong on our side. Please try again or email directly.' }, 500, cors);
    }
  }
};
