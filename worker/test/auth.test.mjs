// Unit tests for the admin sign-in check. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessJwt, authenticate } from '../src/auth.js';

const TEAM = 'hedley-test.cloudflareaccess.com';
const AUD = 'test-audience-tag';
const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

async function makeKey(kid) {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { kid, privateKey: pair.privateKey, jwk: { ...jwk, kid } };
}

async function sign(key, payload, header = {}) {
  const h = enc({ alg: 'RS256', kid: key.kid, typ: 'JWT', ...header });
  const p = enc(payload);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${Buffer.from(sig).toString('base64url')}`;
}

const good = await makeKey('key-1');
const other = await makeKey('key-2');
const fetchImpl = async (url) => {
  assert.equal(url, `https://${TEAM}/cdn-cgi/access/certs`);
  return new Response(JSON.stringify({ keys: [good.jwk] }), { status: 200 });
};
const now = Date.now();
const base = { aud: [AUD], iss: `https://${TEAM}`, email: 'thudson@hedleyventures.com', exp: Math.floor(now / 1000) + 3600, iat: Math.floor(now / 1000) };
const opts = { teamDomain: TEAM, aud: AUD, allowedEmails: ['thudson@hedleyventures.com'], fetchImpl, now };

test('accepts a valid token for the admin email', async () => {
  assert.equal(await verifyAccessJwt(await sign(good, base), opts), 'thudson@hedleyventures.com');
});
test('email match is case-insensitive', async () => {
  assert.equal(await verifyAccessJwt(await sign(good, { ...base, email: 'THudson@HedleyVentures.com' }), opts), 'thudson@hedleyventures.com');
});
test('rejects a different email address', async () => {
  assert.equal(await verifyAccessJwt(await sign(good, { ...base, email: 'someone@example.com' }), opts), null);
});
test('rejects the wrong audience', async () => {
  assert.equal(await verifyAccessJwt(await sign(good, { ...base, aud: ['another-app'] }), opts), null);
});
test('rejects the wrong issuer', async () => {
  assert.equal(await verifyAccessJwt(await sign(good, { ...base, iss: 'https://evil.cloudflareaccess.com' }), opts), null);
});
test('rejects an expired token', async () => {
  assert.equal(await verifyAccessJwt(await sign(good, { ...base, exp: Math.floor(now / 1000) - 120 }), opts), null);
});
test('rejects a token signed by an unknown key', async () => {
  assert.equal(await verifyAccessJwt(await sign(other, base, { kid: 'key-1' }), opts), null);
});
test('rejects a tampered payload', async () => {
  const [h, , s] = (await sign(good, base)).split('.');
  assert.equal(await verifyAccessJwt(`${h}.${enc({ ...base, email: 'thudson@hedleyventures.com', admin: true })}.${s}`, opts), null);
});
test('rejects alg "none" and garbage', async () => {
  assert.equal(await verifyAccessJwt(`${enc({ alg: 'none', kid: 'key-1' })}.${enc(base)}.`, opts), null);
  assert.equal(await verifyAccessJwt('not-a-token', opts), null);
  assert.equal(await verifyAccessJwt('', opts), null);
});
test('fails closed when not configured', async () => {
  const token = await sign(good, base);
  assert.equal(await verifyAccessJwt(token, { ...opts, aud: '' }), null);
  assert.equal(await verifyAccessJwt(token, { ...opts, teamDomain: '' }), null);
  assert.equal(await verifyAccessJwt(token, { ...opts, allowedEmails: [] }), null);
});
test('local test mode never applies on a real hostname', async () => {
  const env = { DEV_ADMIN_EMAIL: 'thudson@hedleyventures.com', ADMIN_EMAIL: 'thudson@hedleyventures.com' };
  assert.equal(await authenticate(new Request('https://hedley-enquiries-admin.example.workers.dev/admin/enquiries'), env), null);
  assert.deepEqual(await authenticate(new Request('http://localhost:8788/admin/enquiries'), env), { email: 'thudson@hedleyventures.com', dev: true });
});
test('no token means no access', async () => {
  const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAIL: 'thudson@hedleyventures.com' };
  assert.equal(await authenticate(new Request('https://hedley-enquiries-admin.example.workers.dev/admin/api/enquiries'), env), null);
});
