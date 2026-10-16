// Turns the visit details sent with an enquiry (or a referring site from Web Analytics) into a simple channel.

export const CHANNELS = ['LinkedIn', 'Google search', 'Google Ads', 'Other search', 'Other social', 'Email', 'Campaign', 'Referral', 'Direct / unknown'];

const SEARCH = /(^|\.)(bing|duckduckgo|yahoo|ecosia|brave|yandex|baidu|startpage|qwant)\./;
const SOCIAL = /(^|\.)(facebook|instagram|twitter|x|t|threads|reddit|youtube|tiktok|whatsapp)\.(com|co|net)$|^(lm\.)?facebook\.com$|^t\.co$/;
const MAIL = /(mail|outlook|proton)\./;

export function classifyChannel({ referrer = '', utmSource = '', utmMedium = '' } = {}) {
  const src = String(utmSource || referrer).toLowerCase();
  const medium = String(utmMedium).toLowerCase();
  if (!src) return 'Direct / unknown';
  if (/linkedin|lnkd\.in/.test(src)) return 'LinkedIn';
  if (/(^|\.)google\./.test(src) || src === 'google') return /cpc|ppc|paid/.test(medium) ? 'Google Ads' : 'Google search';
  if (SEARCH.test(src) || /^(bing|duckduckgo|yahoo|ecosia)$/.test(src)) return 'Other search';
  if (SOCIAL.test(src) || /^(facebook|instagram|twitter|x)$/.test(src)) return 'Other social';
  if (medium === 'email' || MAIL.test(src)) return 'Email';
  if (utmSource) return 'Campaign';
  return 'Referral';
}

const HOST_RE = /^[a-z0-9.-]{1,100}$/i;
const clean = (v, max = 100) => String(typeof v === 'string' ? v : '').replace(/[\u0000-\u001F\u007F<>"]/g, '').trim().slice(0, max);

// Validates the untrusted "source" object from the form. Never rejects an enquiry: bad values are dropped.
export function readSource(raw) {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  let referrer = typeof s.referrer === 'string' ? s.referrer.trim().toLowerCase() : '';
  if (!HOST_RE.test(referrer) || /(^|\.)hedleyventures\.com$/.test(referrer)) referrer = '';   // host names only
  let landing = clean(s.landing, 200);
  if (!landing.startsWith('/')) landing = '';
  const utmSource = clean(s.utmSource);
  const utmMedium = clean(s.utmMedium);
  const utmCampaign = clean(s.utmCampaign);
  return {
    channel: classifyChannel({ referrer, utmSource, utmMedium }),
    referrer: referrer || null,
    landing: landing || null,
    utmSource: utmSource || null,
    utmMedium: utmMedium || null,
    utmCampaign: utmCampaign || null
  };
}
