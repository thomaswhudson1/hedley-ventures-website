// Admin authentication.
// The admin Worker sits behind Cloudflare Access: nobody reaches it without signing in (emailed one-time code).
// As a second, independent lock, every request is also verified here: Access attaches a signed token (JWT) and we
// check its signature against Cloudflare's published keys, its audience, issuer, expiry and the signed-in email.
// If anything is missing or misconfigured, access is refused ("fail closed").
import { splitList } from './util.js';

const certCache = new Map();   // teamDomain -> { keys, fetchedAt }
const CERT_TTL_MS = 60 * 60 * 1000;

function b64urlToBytes(input) {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function decodePart(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

async function getKeys(teamDomain, fetchImpl, forceRefresh = false) {
  const cached = certCache.get(teamDomain);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CERT_TTL_MS) return cached.keys;
  const res = await fetchImpl(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Could not fetch Access certificates (${res.status}).`);
  const { keys = [] } = await res.json();
  certCache.set(teamDomain, { keys, fetchedAt: Date.now() });
  return keys;
}

// Returns the verified email address, or null.
export async function verifyAccessJwt(token, { teamDomain, aud, allowedEmails, fetchImpl = fetch, now = Date.now() }) {
  if (!token || !teamDomain || !aud || !allowedEmails.length) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try { header = decodePart(parts[0]); payload = decodePart(parts[1]); } catch { return null; }
  if (header.alg !== 'RS256' || !header.kid) return null;

  let keys = await getKeys(teamDomain, fetchImpl);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) { keys = await getKeys(teamDomain, fetchImpl, true); jwk = keys.find((k) => k.kid === header.kid); }   // keys rotate
  if (!jwk) return null;

  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) return null;

  const nowSec = Math.floor(now / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;
  if (typeof payload.exp !== 'number' || payload.exp < nowSec - 30) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > nowSec + 30) return null;

  const email = String(payload.email || '').toLowerCase();
  if (!email || !allowedEmails.map((e) => e.toLowerCase()).includes(email)) return null;
  return email;
}

function readCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

// Returns { email, dev } for an authorised admin request, otherwise null.
export async function authenticate(request, env) {
  const url = new URL(request.url);
  // Local development only: never active on a deployed Worker (requires a localhost URL AND a .dev.vars setting).
  if (env.DEV_ADMIN_EMAIL && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return { email: env.DEV_ADMIN_EMAIL, dev: true };

  const token = request.headers.get('Cf-Access-Jwt-Assertion') || readCookie(request, 'CF_Authorization');
  try {
    const email = await verifyAccessJwt(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD, allowedEmails: splitList(env.ADMIN_EMAIL) });
    return email ? { email, dev: false } : null;
  } catch (err) {
    console.error('Access verification error:', err && err.message);
    return null;
  }
}
