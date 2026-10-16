// New-enquiry email notifications via Resend (https://resend.com).
// A notification is only attempted after the enquiry is safely stored. Each attempt first "claims" the
// notification row, so two attempts can never run at the same time and a sent email is never re-sent.
import { escapeHtml, formatLondon, nowIso, splitList } from './util.js';

const STALE_MS = 10 * 60 * 1000;   // an attempt still marked "sending" after 10 minutes is treated as failed
export const MAX_AUTO_ATTEMPTS = 6;

export function dashboardLink(env, id) {
  return `${String(env.ADMIN_BASE_URL || '').replace(/\/+$/, '')}/admin/enquiries/${encodeURIComponent(id)}`;
}

export function buildNotification(enquiry, link) {
  const rows = [
    ['Contact name', enquiry.name],
    ['Email address', enquiry.email],
    ['Company', enquiry.company],
    ['Service required', enquiry.service],
    ...(enquiry.raise_amount ? [['Fundraising amount', enquiry.raise_amount]] : []),
    ...(enquiry.raise_timing ? [['Fundraising timing', enquiry.raise_timing]] : []),
    ['Monthly revenue run-rate', enquiry.traction],
    ['Additional information', enquiry.message || '—'],
    ['Date received', formatLondon(enquiry.received_at)],
    ['Reference', enquiry.ref]
  ];
  // Header injection guard: subjects can never contain line breaks.
  const subject = `New Hedley Ventures Enquiry | ${enquiry.company}`.replace(/[\r\n]+/g, ' ').slice(0, 200);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nView in dashboard: ${link}\n`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f2efe9;font-family:Arial,Helvetica,sans-serif;color:#132c36">
<table role="presentation" width="100%" style="max-width:620px;margin:0 auto;background:#ffffff;border-collapse:collapse">
<tr><td style="padding:22px 28px;background:#001e2a;color:#f2efe9;font-family:Georgia,serif;font-size:20px">New enquiry: ${escapeHtml(enquiry.company)}</td></tr>
<tr><td style="padding:20px 28px 8px"><table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;line-height:1.5">
${rows.map(([k, v]) => `<tr><td style="padding:8px 14px 8px 0;vertical-align:top;color:#786334;font-weight:bold;white-space:nowrap;border-bottom:1px solid #eee">${escapeHtml(k)}</td><td style="padding:8px 0;vertical-align:top;border-bottom:1px solid #eee;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`).join('\n')}
</table></td></tr>
<tr><td style="padding:18px 28px 28px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;background:#001e2a;color:#ffffff;text-decoration:none;font-size:14px">Open in dashboard</a>
<p style="margin:16px 0 0;font-size:12px;color:#53636a">Reply to this email to respond directly to ${escapeHtml(enquiry.name)}.</p></td></tr>
</table></body></html>`;
  return { subject, text, html };
}

async function sendViaResend(env, { to, replyTo, subject, text, html }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !to.length) throw new Error('Email is not configured (RESEND_API_KEY, EMAIL_FROM or NOTIFY_TO missing).');
  const res = await fetch(env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, reply_to: replyTo, subject, text, html })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${String(body.message || body.name || 'request failed').slice(0, 300)}`);
  return body.id || null;
}

// Attempts to send the notification for one enquiry. Returns { status: 'sent' | 'failed' | 'skipped', error? }.
export async function sendNotification(env, enquiryId) {
  const now = nowIso();
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  const claim = await env.DB.prepare(
    `UPDATE notifications SET status = 'sending', attempts = attempts + 1, last_attempt_at = ?1
     WHERE enquiry_id = ?2 AND (status IN ('pending', 'failed') OR (status = 'sending' AND last_attempt_at < ?3))`
  ).bind(now, enquiryId, staleBefore).run();
  if (!claim.meta.changes) return { status: 'skipped' };

  try {
    const enquiry = await env.DB.prepare('SELECT * FROM enquiries WHERE id = ?1').bind(enquiryId).first();
    if (!enquiry) throw new Error('Enquiry not found.');
    const message = buildNotification(enquiry, dashboardLink(env, enquiryId));
    const providerId = await sendViaResend(env, { to: splitList(env.NOTIFY_TO), replyTo: enquiry.email, ...message });
    await env.DB.prepare(`UPDATE notifications SET status = 'sent', sent_at = ?1, provider_id = ?2, last_error = NULL WHERE enquiry_id = ?3`)
      .bind(nowIso(), providerId, enquiryId).run();
    return { status: 'sent' };
  } catch (err) {
    const error = String(err && err.message ? err.message : err).slice(0, 500);
    await env.DB.prepare(`UPDATE notifications SET status = 'failed', last_error = ?1 WHERE enquiry_id = ?2`).bind(error, enquiryId).run();
    console.error('Notification failed for an enquiry:', error);   // no enquiry details in logs
    return { status: 'failed', error };
  }
}

// Scheduled retry of failed or interrupted notifications (runs from the admin Worker's cron trigger).
export async function retryPendingNotifications(env) {
  const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT enquiry_id FROM notifications
     WHERE attempts < ?1 AND (status = 'failed' OR (status IN ('pending', 'sending') AND COALESCE(last_attempt_at, '') < ?2))
     LIMIT 20`
  ).bind(MAX_AUTO_ATTEMPTS, staleBefore).all();
  for (const row of results) await sendNotification(env, row.enquiry_id);
  return results.length;
}
