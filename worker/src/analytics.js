// Website analytics: copies daily figures from Cloudflare Web Analytics (GraphQL Analytics API, read-only token)
// into D1, so the dashboard is fast and keeps history beyond Cloudflare's retention window.
import { classifyChannel } from './source.js';
import { nowIso } from './util.js';

const GQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const REFRESH_MINUTES = 60;
const BACKFILL_DAYS = 90;
const CHUNK_DAYS = 30;

const QUERY = `query HedleyWebAnalytics($account: string!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      totals: rumPageloadEventsAdaptiveGroups(limit: 1000, filter: $filter) { count sum { visits } dimensions { date } }
      paths: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter) { count sum { visits } dimensions { date requestPath } }
      refs: rumPageloadEventsAdaptiveGroups(limit: 5000, filter: $filter) { count sum { visits } dimensions { date refererHost } }
    }
  }
}`;

const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const startOfUtcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function analyticsConfigured(env) {
  return Boolean(env.CF_ANALYTICS_TOKEN && env.CF_ACCOUNT_ID && env.CF_WA_SITE_TAG);
}

async function getConfig(env, key) {
  return env.DB.prepare('SELECT value FROM app_config WHERE key = ?1').bind(key).first('value');
}
async function setConfig(env, key, value) {
  await env.DB.prepare('INSERT INTO app_config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
}

async function fetchRange(env, from, to) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        account: env.CF_ACCOUNT_ID,
        // Only the live site (not local previews), and no known bots
        filter: { AND: [{ datetime_geq: from.toISOString(), datetime_lt: to.toISOString() }, { siteTag: env.CF_WA_SITE_TAG }, { bot: 0 }, { requestHost_in: ['hedleyventures.com', 'www.hedleyventures.com'] }] }
      }
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body.errors && body.errors.length)) {
    const msg = (body.errors && body.errors.map((e) => e.message).join('; ')) || `HTTP ${res.status}`;
    throw new Error(`Cloudflare analytics: ${msg}`.slice(0, 400));
  }
  const account = body.data && body.data.viewer && body.data.viewer.accounts && body.data.viewer.accounts[0];
  if (!account) throw new Error('Cloudflare analytics: account not found (check CF_ACCOUNT_ID and token permissions).');
  return account;
}

// Re-reads [from, to) from Cloudflare and replaces the stored rows for those days.
async function syncRange(env, from, to) {
  const data = await fetchRange(env, from, to);
  const days = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(ymd(d));
  const fetchedAt = nowIso();
  const stmts = [];
  for (const day of days) {
    stmts.push(env.DB.prepare('DELETE FROM analytics_daily WHERE date = ?1').bind(day));
    stmts.push(env.DB.prepare('DELETE FROM analytics_breakdown WHERE date = ?1').bind(day));
  }
  const totals = new Map(data.totals.map((r) => [r.dimensions.date, r]));
  for (const day of days) {
    const r = totals.get(day);
    stmts.push(env.DB.prepare('INSERT INTO analytics_daily (date, visits, pageviews, fetched_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(day, r ? r.sum.visits : 0, r ? r.count : 0, fetchedAt));
  }
  const add = (kind, rows, keyOf) => {
    const merged = new Map();
    for (const r of rows) {
      const k = `${r.dimensions.date}\u0000${String(keyOf(r) || '').slice(0, 300)}`;
      const m = merged.get(k) || { visits: 0, pageviews: 0 };
      m.visits += r.sum.visits; m.pageviews += r.count;
      merged.set(k, m);
    }
    for (const [k, m] of merged) {
      const [day, key] = k.split('\u0000');
      stmts.push(env.DB.prepare('INSERT INTO analytics_breakdown (date, kind, key, visits, pageviews) VALUES (?1, ?2, ?3, ?4, ?5)').bind(day, kind, key, m.visits, m.pageviews));
    }
  };
  add('path', data.paths, (r) => r.dimensions.requestPath);
  add('referrer', data.refs, (r) => (r.dimensions.refererHost || '').toLowerCase().replace(/^www\./, ''));
  for (let i = 0; i < stmts.length; i += 400) await env.DB.batch(stmts.slice(i, i + 400));
  return days.length;
}

// Refreshes recent days (or backfills 90 days the first time). Records success/failure for the dashboard.
export async function syncAnalytics(env, { force = false } = {}) {
  if (!analyticsConfigured(env)) return { status: 'not-configured' };
  const last = await getConfig(env, 'analytics_last_sync');
  if (!force && last && Date.now() - Date.parse(last) < REFRESH_MINUTES * 60000) return { status: 'fresh' };
  const end = addDays(startOfUtcDay(new Date()), 1);                    // up to the end of today (UTC)
  const span = last ? 3 : BACKFILL_DAYS;
  try {
    for (let from = addDays(end, -span); from < end; from = addDays(from, CHUNK_DAYS)) {
      const to = addDays(from, CHUNK_DAYS) < end ? addDays(from, CHUNK_DAYS) : end;
      await syncRange(env, from, to);
    }
    await setConfig(env, 'analytics_last_sync', nowIso());
    await setConfig(env, 'analytics_last_error', '');
    return { status: 'synced', days: span };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err).slice(0, 400);
    await setConfig(env, 'analytics_last_error', `${nowIso()} ${msg}`);
    console.error('Analytics sync failed:', msg);
    return { status: 'failed', error: msg };
  }
}

const TEST_FILTER = "ref NOT LIKE 'HV-TEST%'";

async function sumDaily(env, from, to) {
  return env.DB.prepare('SELECT COALESCE(SUM(visits),0) AS visits, COALESCE(SUM(pageviews),0) AS pageviews FROM analytics_daily WHERE date >= ?1 AND date <= ?2').bind(from, to).first();
}
async function countEnquiries(env, from, to) {
  return env.DB.prepare(`SELECT COUNT(*) AS n FROM enquiries WHERE substr(received_at,1,10) >= ?1 AND substr(received_at,1,10) <= ?2 AND ${TEST_FILTER}`).bind(from, to).first('n');
}

// Summary for the dashboard: the last `days` days (including today, UTC) against the previous `days` days.
export async function analyticsReport(env, days) {
  const today = startOfUtcDay(new Date());
  const curFrom = ymd(addDays(today, -(days - 1))); const curTo = ymd(today);
  const prevFrom = ymd(addDays(today, -(2 * days - 1))); const prevTo = ymd(addDays(today, -days));

  const [cur, prev, enqCur, enqPrev] = await Promise.all([sumDaily(env, curFrom, curTo), sumDaily(env, prevFrom, prevTo), countEnquiries(env, curFrom, curTo), countEnquiries(env, prevFrom, prevTo)]);
  const { results: dailyRows } = await env.DB.prepare('SELECT date, visits, pageviews FROM analytics_daily WHERE date >= ?1 AND date <= ?2').bind(curFrom, curTo).all();
  const byDay = new Map(dailyRows.map((r) => [r.date, r]));
  const series = [];
  for (let d = new Date(curFrom + 'T00:00:00Z'); ymd(d) <= curTo; d = addDays(d, 1)) {
    const r = byDay.get(ymd(d));
    series.push({ date: ymd(d), visits: r ? r.visits : 0, pageviews: r ? r.pageviews : 0 });
  }
  const top = (kind, limit) => env.DB.prepare(`SELECT key, SUM(visits) AS visits, SUM(pageviews) AS pageviews FROM analytics_breakdown
      WHERE kind = ?1 AND date >= ?2 AND date <= ?3 GROUP BY key ORDER BY pageviews DESC, visits DESC LIMIT ?4`).bind(kind, curFrom, curTo, limit).all();
  const [{ results: pages }, { results: refs }] = await Promise.all([top('path', 12), top('referrer', 100)]);

  const channels = new Map();
  for (const r of refs) {
    const ch = classifyChannel({ referrer: r.key });
    channels.set(ch, (channels.get(ch) || 0) + r.visits);
  }
  const { results: enqByChannel } = await env.DB.prepare(`SELECT COALESCE(source_channel, 'Not recorded') AS channel, COUNT(*) AS n FROM enquiries
      WHERE substr(received_at,1,10) >= ?1 AND substr(received_at,1,10) <= ?2 AND ${TEST_FILTER} GROUP BY 1 ORDER BY n DESC`).bind(curFrom, curTo).all();

  const per100 = (e, v) => (v > 0 ? Math.round((e / v) * 1000) / 10 : null);
  return {
    configured: analyticsConfigured(env),
    lastSync: await getConfig(env, 'analytics_last_sync'),
    lastError: (await getConfig(env, 'analytics_last_error')) || '',
    days, range: { from: curFrom, to: curTo }, previous: { from: prevFrom, to: prevTo },
    current: { visits: cur.visits, pageviews: cur.pageviews, enquiries: enqCur, per100: per100(enqCur, cur.visits) },
    prior: { visits: prev.visits, pageviews: prev.pageviews, enquiries: enqPrev, per100: per100(enqPrev, prev.visits) },
    series,
    pages,
    referrers: refs.slice(0, 12).map((r) => ({ ...r, channel: classifyChannel({ referrer: r.key }) })),
    channels: [...channels].map(([channel, visits]) => ({ channel, visits })).sort((a, b) => b.visits - a.visits),
    enquiriesByChannel: enqByChannel
  };
}
