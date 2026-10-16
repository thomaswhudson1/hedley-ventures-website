// Small shared helpers for both Workers.

export const nowIso = () => new Date().toISOString();

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
  });
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Short, readable reference such as HV-261016-7Q4K (no easily confused characters).
export function makeRef(date = new Date()) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  const ymd = date.toISOString().slice(2, 10).replace(/-/g, '');
  return `HV-${ymd}-${suffix}`;
}

// Normalise free text: trim, collapse unusual whitespace and remove control characters (keeps line breaks if allowed).
export function cleanText(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  let text = value.replace(/\r\n?/g, '\n').normalize('NFC');
  text = multiline
    ? text.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{4,}/g, '\n\n\n')
    : text.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
  return text.trim();
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Today's date in London, as YYYY-MM-DD (used for "follow-up due").
export function londonToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function formatLondon(iso) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function splitList(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}
