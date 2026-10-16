// End-to-end checks against the LOCAL Workers (npm run dev:intake / dev:admin) and mock Resend.
// Run with: node test/e2e-local.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const INTAKE = 'http://127.0.0.1:8787/api/enquiries';
const ADMIN = 'http://127.0.0.1:8788';
const ORIGIN = 'http://localhost:8080';
const outbox = join(dirname(fileURLToPath(import.meta.url)), 'outbox');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ipCounter = 0;
const RUN = crypto.randomUUID().slice(0, 4);
const NET = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const results = [];

async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); }
}

function submit(fields = {}, { ip = `${NET}.${++ipCounter}`, origin = ORIGIN, key = crypto.randomUUID() } = {}) {
  const body = {
    name: 'Jane Founder', email: `jane+${RUN}@example.com`, company: `Test Co ${crypto.randomUUID().slice(0, 6)}`,
    service: 'Fundraising Advisory', raiseAmount: '£2m–£5m', raiseTiming: 'Within the next 3 months',
    traction: '£50k–£150k per month', message: 'We are raising a Series A.', website: '', submissionKey: key, elapsedMs: 15000,
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX', ...fields
  };
  return fetch(INTAKE, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': ip }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, data: await r.json(), headers: r.headers, body }));
}
const adminGet = (path) => fetch(ADMIN + path).then(async (r) => ({ status: r.status, data: r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text(), headers: r.headers }));
const adminWrite = (path, method, body, headers = { 'X-Requested-With': 'hv-admin' }) =>
  fetch(ADMIN + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, data: await r.json() }));
const outboxFiles = () => (existsSync(outbox) ? readdirSync(outbox).filter((f) => f.endsWith('.json')) : []);
const findRow = async (ref) => (await adminGet('/admin/api/enquiries')).data.enquiries.find((e) => e.ref === ref);

let main;
await check('CORS preflight allowed for the website origin', async () => {
  const r = await fetch(INTAKE, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
});
await check('Other websites are refused', async () => {
  const r = await submit({}, { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});
await check('Valid fundraising enquiry is stored (201 + reference)', async () => {
  const before = outboxFiles().length;
  main = await submit({ company: `Northwind Analytics ${RUN}`, name: 'Ada Lovelace', email: 'Ada@Example.com', message: 'Line one\nLine two <b>bold?</b>' });
  assert.equal(main.status, 201, JSON.stringify(main.data));
  assert.match(main.data.ref, /^HV-\d{6}-[A-Z2-9]{4}$/);
  await sleep(1500);
  const files = outboxFiles();
  assert.equal(files.length, before + 1, 'one notification email');
  const mail = JSON.parse(readFileSync(join(outbox, files.sort().at(-1)), 'utf8'));
  assert.equal(mail.subject, `New Hedley Ventures Enquiry | Northwind Analytics ${RUN}`);
  assert.deepEqual(mail.to, ['thudson@hedleyventures.com']);
  assert.equal(mail.reply_to, 'ada@example.com');
  assert.ok(mail.text.includes('Fundraising amount: £2m–£5m') && mail.text.includes('Fundraising timing: Within the next 3 months'));
  assert.ok(mail.text.includes('Monthly revenue run-rate: £50k–£150k per month'));
  assert.ok(mail.text.includes('/admin/enquiries/'), 'dashboard link');
  assert.ok(mail.html.includes('&lt;b&gt;bold?&lt;/b&gt;'), 'HTML escaped in email');
});
await check('Double submission (same form) returns the same reference, stored once', async () => {
  const again = await submit(main.body, { key: main.body.submissionKey });
  assert.equal(again.status, 200);
  assert.equal(again.data.ref, main.data.ref);
  assert.equal(again.data.duplicate, true);
});
await check('Identical enquiry re-sent from a reloaded page is not stored twice', async () => {
  const again = await submit({ ...main.body, submissionKey: crypto.randomUUID() });
  assert.equal(again.data.ref, main.data.ref);
  const all = (await adminGet('/admin/api/enquiries')).data.enquiries.filter((e) => e.company === `Northwind Analytics ${RUN}`);
  assert.equal(all.length, 1);
});
await check('Missing required fields are rejected with field messages', async () => {
  const r = await submit({ name: ' ', email: 'not-an-email', company: '', service: 'Hacking', traction: '' });
  assert.equal(r.status, 400);
  for (const f of ['name', 'email', 'company', 'service', 'traction']) assert.ok(r.data.errors[f], f);
});
await check('Invalid fundraising option rejected', async () => {
  const r = await submit({ raiseAmount: '£1bn' });
  assert.equal(r.status, 400);
  assert.ok(r.data.errors.raiseAmount);
});
await check('Fundraising answers are discarded for non-fundraising services', async () => {
  const r = await submit({ service: 'Fractional CFO Support', company: 'CFO Only Ltd' });
  assert.equal(r.status, 201);
  const row = await findRow(r.data.ref);
  assert.equal(row.raise_amount, null);
  assert.equal(row.raise_timing, null);
});
await check('Fundraising amount and timing are required for Fundraising Advisory and Both', async () => {
  for (const service of ['Fundraising Advisory', 'Both']) {
    const r = await submit({ service, raiseAmount: '', raiseTiming: '', company: `Missing Raise ${service}` });
    assert.equal(r.status, 400, service);
    assert.ok(r.data.errors.raiseAmount && r.data.errors.raiseTiming, service);
    const partial = await submit({ service, raiseAmount: 'Not yet decided', raiseTiming: '', company: `Partial Raise ${service}` });
    assert.equal(partial.status, 400);
    assert.ok(!partial.data.errors.raiseAmount && partial.data.errors.raiseTiming);
  }
});
await check('Fundraising questions not required for CFO Support / Something else; message optional', async () => {
  for (const service of ['Fractional CFO Support', 'Something else']) {
    const r = await submit({ service, raiseAmount: '', raiseTiming: '', message: '', company: `No Raise ${service}` });
    assert.equal(r.status, 201, service);
  }
});
await check('"Not yet decided" and "In 6+ months / Just exploring" are accepted', async () => {
  const r = await submit({ service: 'Both', raiseAmount: 'Not yet decided', raiseTiming: 'In 6+ months / Just exploring', company: 'Undecided Ltd' });
  assert.equal(r.status, 201);
});
await check('Missing security-check token is refused and nothing stored', async () => {
  const r = await submit({ turnstileToken: '', company: 'No Token Ltd' });
  assert.equal(r.status, 403);
  assert.equal((await adminGet('/admin/api/enquiries')).data.enquiries.some((e) => e.company === 'No Token Ltd'), false);
});
await check('Spam trap: hidden field filled -> silently ignored', async () => {
  const r = await submit({ website: 'http://spam.example', company: 'Spam Bot Ltd' });
  assert.equal(r.status, 200);
  assert.equal(r.data.ref, null);
  assert.equal((await adminGet('/admin/api/enquiries')).data.enquiries.some((e) => e.company === 'Spam Bot Ltd'), false);
});
await check('Spam trap: form filled implausibly fast -> silently ignored', async () => {
  const r = await submit({ elapsedMs: 300, company: 'Fast Bot Ltd' });
  assert.equal(r.data.ref, null);
  assert.equal((await adminGet('/admin/api/enquiries')).data.enquiries.some((e) => e.company === 'Fast Bot Ltd'), false);
});
await check('Oversized submission refused', async () => {
  const r = await submit({ message: 'x'.repeat(20000) });
  assert.equal(r.status, 413);
});
await check('Rate limit: 6th enquiry within an hour from one connection is refused', async () => {
  const ip = `198.51.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await submit({ company: `Rate ${i}` }, { ip })).status);
  assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
});

// ---- Email failure and retry ----
let failed;
await check('Email outage: enquiry still stored and reported as successful', async () => {
  writeFileSync(join(outbox, 'FAIL'), '');
  failed = await submit({ company: 'Outage Test Ltd' });
  assert.equal(failed.status, 201);
  await sleep(1500);
  const row = await findRow(failed.data.ref);
  assert.equal(row.notification_status, 'failed');
  assert.match(row.notification_error, /503/);
});
await check('Failed email can be retried safely from the dashboard', async () => {
  rmSync(join(outbox, 'FAIL'));
  const row = await findRow(failed.data.ref);
  const before = outboxFiles().length;
  const r = await adminWrite(`/admin/api/enquiries/${row.id}/notify`, 'POST', {});
  assert.equal(r.data.outcome.status, 'sent');
  const again = await adminWrite(`/admin/api/enquiries/${row.id}/notify`, 'POST', {});
  assert.equal(again.data.outcome.status, 'skipped', 'never re-sends a sent email');
  assert.equal(outboxFiles().length, before + 1);
});

// ---- Admin API ----
let id;
await check('Dashboard lists enquiries newest first with admin defaults', async () => {
  const r = await adminGet('/admin/api/enquiries');
  assert.equal(r.status, 200);
  const list = r.data.enquiries;
  assert.ok(list.length >= 5);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].received_at >= list[i].received_at);
  const row = list.find((e) => e.ref === main.data.ref);
  id = row.id;
  assert.equal(row.status, 'New');
  assert.equal(row.priority, 'Medium');
  assert.equal(row.fingerprint, undefined, 'internal fields not exposed');
  assert.equal(row.submission_key, undefined);
});
await check('Admin pages send security headers and noindex', async () => {
  const r = await adminGet('/admin/enquiries');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const deep = await adminGet(`/admin/enquiries/${id}`);
  assert.equal(deep.status, 200);
  assert.ok(String(deep.data).includes('<title>Enquiries | Hedley Ventures</title>'));
});
await check('Update without the dashboard header is blocked (CSRF)', async () => {
  const r = await adminWrite(`/admin/api/enquiries/${id}`, 'PATCH', { status: 'Won' }, {});
  assert.equal(r.status, 403);
  const r2 = await adminWrite(`/admin/api/enquiries/${id}`, 'PATCH', { status: 'Won' }, { 'X-Requested-With': 'hv-admin', Origin: 'https://evil.example' });
  assert.equal(r2.status, 403);
});
await check('Status, priority, notes and dates save and persist', async () => {
  const r = await adminWrite(`/admin/api/enquiries/${id}`, 'PATCH', { status: 'Meeting arranged', priority: 'High', notes: 'Call booked.\nSend deck.', last_contacted: '2026-10-15', next_follow_up: '2026-10-01' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const fresh = (await adminGet(`/admin/api/enquiries/${id}`)).data.enquiry;
  assert.equal(fresh.status, 'Meeting arranged');
  assert.equal(fresh.priority, 'High');
  assert.equal(fresh.notes, 'Call booked.\nSend deck.');
  assert.equal(fresh.last_contacted, '2026-10-15');
  assert.equal(fresh.next_follow_up, '2026-10-01');
  assert.equal(fresh.company, `Northwind Analytics ${RUN}`, 'original submission untouched');
});
await check('Invalid values are rejected', async () => {
  for (const body of [{ status: 'Hot lead' }, { priority: 'Urgent' }, { next_follow_up: '2026-02-30' }, { archived: 'yes' }]) {
    const r = await adminWrite(`/admin/api/enquiries/${id}`, 'PATCH', body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
});
await check('Archive and restore (never deleted)', async () => {
  let r = await adminWrite(`/admin/api/enquiries/${id}`, 'PATCH', { archived: true });
  assert.ok(r.data.enquiry.archived_at);
  r = await adminWrite(`/admin/api/enquiries/${id}`, 'PATCH', { archived: false });
  assert.equal(r.data.enquiry.archived_at, null);
});
await check('CSV export: filters, headers and formula-injection guard', async () => {
  await submit({ company: '=HYPERLINK("http://evil.example","Click")', name: '+Danger' });
  const r = await fetch(`${ADMIN}/admin/api/export.csv?view=all`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /attachment; filename="hedley-enquiries-\d{4}-\d{2}-\d{2}\.csv"/);
  const bytes = new Uint8Array(await r.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 marker so Excel shows £ correctly');
  const csv = new TextDecoder().decode(bytes);
  assert.ok(csv.startsWith('Reference,Date received (UTC),Company'));
  assert.ok(csv.includes(`"'=HYPERLINK(""http://evil.example"",""Click"")"`), 'formula neutralised');
  assert.ok(csv.includes("'+Danger"));
  const filtered = await (await fetch(`${ADMIN}/admin/api/export.csv?view=all&status=Meeting+arranged&q=${RUN}`)).text();
  assert.equal(filtered.trim().split('\r\n').length, 2, 'header + 1 row');
  const due = await (await fetch(`${ADMIN}/admin/api/export.csv?view=active&followup=1`)).text();
  assert.ok(due.includes(`Northwind Analytics ${RUN}`));
});
await check('Unknown routes return 404', async () => {
  assert.equal((await adminGet('/admin/api/nothing')).status, 404);
  assert.equal((await fetch('http://127.0.0.1:8787/admin/api/enquiries')).status, 404, 'intake has no admin routes');
});

for (const [s, n, e] of results) console.log(`${s}  ${n}${e ? '  -> ' + e : ''}`);
const failedCount = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failedCount}/${results.length} passed`);
process.exit(failedCount ? 1 : 0);
