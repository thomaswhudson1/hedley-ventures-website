// Enquiry source: remembers how this visit arrived (landing page, referring site, campaign tags) for the
// lifetime of this browser tab only, so an enquiry can be attributed to LinkedIn, Google, a campaign, etc.
// No cookies, no identifiers, nothing sent anywhere unless the visitor submits the enquiry form.
(() => {
  const KEY = 'hv_visit_source';
  try {
    const params = new URLSearchParams(location.search);
    const clip = (v) => String(v || '').slice(0, 100);
    let referrer = '';
    try {
      const ref = new URL(document.referrer);
      if (ref.hostname && ref.hostname !== location.hostname) referrer = ref.hostname;
    } catch { /* no referrer */ }
    const tagged = ['utm_source', 'utm_medium', 'utm_campaign'].some((k) => params.get(k));
    // Keep the first record for this tab, unless the visitor has just arrived again from another site or a tagged link.
    if (sessionStorage.getItem(KEY) && !tagged && !referrer) return;
    sessionStorage.setItem(KEY, JSON.stringify({
      landing: clip(location.pathname),
      referrer: clip(referrer),
      utmSource: clip(params.get('utm_source')),
      utmMedium: clip(params.get('utm_medium')),
      utmCampaign: clip(params.get('utm_campaign'))
    }));
  } catch { /* storage unavailable: the enquiry is simply recorded without a source */ }
})();
