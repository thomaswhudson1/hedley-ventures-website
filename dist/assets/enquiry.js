// Contact page enquiry form: conditional fundraising questions, validation, spam check (Cloudflare Turnstile)
// and submission to the Hedley Ventures enquiry service. Nothing is logged to the console or stored in the browser.
(() => {
  const form = document.querySelector('#enquiry-form');
  if (!form) return;

  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const endpoint = isLocal ? form.dataset.endpointLocal : form.dataset.endpoint;
  const siteKey = isLocal ? '1x00000000000000000000AA' : form.dataset.sitekey;   // Turnstile's public test key when previewing locally
  const FUNDRAISING = ['Fundraising Advisory', 'Both'];
  const FALLBACK = 'Please try again, or email thudson@hedleyventures.com directly.';

  const body = form.querySelector('#enquiry-body');
  const done = form.querySelector('#enquiry-done');
  const raiseFields = form.querySelector('#raise-fields');
  const statusEl = form.querySelector('#form-status');
  const submit = form.querySelector('#enquiry-submit');
  const loadedAt = Date.now();
  const submissionKey = crypto.randomUUID ? crypto.randomUUID() : fallbackUuid();
  let widgetId = null;

  function fallbackUuid() {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // ----- Conditional fundraising questions -----
  const selectedService = () => (form.querySelector('input[name="service"]:checked') || {}).value || '';
  const RAISE_FIELDS = ['raiseAmount', 'raiseTiming'];
  const isFundraising = () => FUNDRAISING.includes(selectedService());
  // The fundraising questions are required only while they are shown.
  function updateRaiseFields() {
    const show = isFundraising();
    raiseFields.hidden = !show;
    RAISE_FIELDS.forEach((n) => {
      form.elements[n].required = show;
      if (!show) clearError(n);
    });
  }
  form.querySelectorAll('input[name="service"]').forEach((r) => r.addEventListener('change', () => { updateRaiseFields(); clearError('service'); }));
  updateRaiseFields();

  // ----- Field errors -----
  const MESSAGES = {
    name: 'Please enter your name.',
    email: 'Please enter a valid email address.',
    company: 'Please enter your company name.',
    service: 'Please choose the services required.',
    traction: 'Please choose your current level of traction.',
    raiseAmount: 'Please choose how much you are looking to raise.',
    raiseTiming: 'Please choose when you are looking to raise funding.'
  };

  function setError(name, message) {
    const error = form.querySelector(`#${name}-error`);
    const field = name === 'service' ? form.querySelector('.choice-group') : form.elements[name];
    if (error) { error.textContent = message; error.hidden = false; }
    if (field && field.setAttribute) field.setAttribute('aria-invalid', 'true');
  }
  function clearError(name) {
    const error = form.querySelector(`#${name}-error`);
    const field = name === 'service' ? form.querySelector('.choice-group') : form.elements[name];
    if (error) { error.textContent = ''; error.hidden = true; }
    if (field && field.removeAttribute) field.removeAttribute('aria-invalid');
  }
  ['name', 'email', 'company', 'traction', 'message'].forEach((n) => form.elements[n].addEventListener('input', () => clearError(n)));
  ['traction', ...RAISE_FIELDS].forEach((n) => form.elements[n].addEventListener('change', () => clearError(n)));

  // Show "Please select" in the muted placeholder colour until an option is chosen.
  form.querySelectorAll('select').forEach((select) => {
    const update = () => select.classList.toggle('is-empty', !select.value);
    select.addEventListener('change', update);
    update();
  });

  function validate() {
    const invalid = [];
    for (const name of ['name', 'email', 'company', 'traction']) {
      const input = form.elements[name];
      input.value = name === 'traction' ? input.value : input.value.trim();
      if (!input.value || !input.checkValidity()) { setError(name, MESSAGES[name]); invalid.push(input); } else clearError(name);
    }
    if (!selectedService()) { setError('service', MESSAGES.service); invalid.push(form.querySelector('input[name="service"]')); } else clearError('service');
    if (isFundraising()) {
      for (const name of RAISE_FIELDS) {
        if (!form.elements[name].value) { setError(name, MESSAGES[name]); invalid.push(form.elements[name]); } else clearError(name);
      }
    }
    invalid.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    if (invalid.length) invalid[0].focus();
    return invalid.length === 0;
  }

  function showStatus(message) {
    statusEl.textContent = message;
    statusEl.hidden = !message;
  }

  // ----- Cloudflare Turnstile (invisible unless a visitor needs to tick a box) -----
  let tokenWaiters = [];
  function resolveToken(token) { tokenWaiters.forEach((w) => w(token)); tokenWaiters = []; }
  window.hvTurnstileReady = () => {
    if (!siteKey || !window.turnstile) return;
    widgetId = window.turnstile.render('#turnstile', {
      sitekey: siteKey, theme: 'dark', appearance: 'interaction-only', action: 'enquiry', 'refresh-expired': 'auto',
      callback: resolveToken
    });
  };
  if (siteKey) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=hvTurnstileReady';
    script.async = true;
    script.defer = true;
    document.head.append(script);
  }

  function getToken(timeoutMs = 15000) {
    const current = window.turnstile && widgetId !== null ? window.turnstile.getResponse(widgetId) : '';
    if (current) return Promise.resolve(current);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(''), timeoutMs);
      tokenWaiters.push((token) => { clearTimeout(timer); resolve(token); });
    });
  }
  function resetTurnstile() {
    if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
  }

  // ----- Submission -----
  function setBusy(busy, label) {
    submit.disabled = busy;
    submit.textContent = label || (busy ? 'Sending…' : 'Send enquiry');
    form.setAttribute('aria-busy', String(busy));
  }

  function showDone(ref) {
    const first = form.elements.name.value.trim().split(/\s+/)[0];
    form.querySelector('#enquiry-done-text').textContent = `Thank you${first ? ' ' + first : ''}. We will review your enquiry and be in touch shortly.`;
    const refEl = form.querySelector('#enquiry-ref');
    if (ref) { refEl.textContent = `Reference: ${ref}`; refEl.hidden = false; }
    body.hidden = true;
    done.hidden = false;
    done.focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    showStatus('');
    if (!validate()) return;
    if (!endpoint) { showStatus('Sorry, the enquiry form is temporarily unavailable. Please email thudson@hedleyventures.com directly.'); return; }

    setBusy(true, 'Checking…');
    const token = await getToken();
    if (!token) {
      setBusy(false);
      showStatus('We couldn’t complete a quick security check. ' + FALLBACK);
      resetTurnstile();
      return;
    }

    setBusy(true);
    const fundraising = FUNDRAISING.includes(selectedService());
    const payload = {
      name: form.elements.name.value, email: form.elements.email.value, company: form.elements.company.value,
      service: selectedService(),
      raiseAmount: fundraising ? form.elements.raiseAmount.value : '',
      raiseTiming: fundraising ? form.elements.raiseTiming.value : '',
      traction: form.elements.traction.value, message: form.elements.message.value,
      website: form.elements.website.value, submissionKey, elapsedMs: Date.now() - loadedAt, turnstileToken: token
    };

    let res; let data = {};
    try {
      res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'omit' });
      data = await res.json().catch(() => ({}));
    } catch {
      setBusy(false);
      showStatus('Sorry, your enquiry could not be sent because of a connection problem. ' + FALLBACK);
      resetTurnstile();
      return;
    }

    if (res.ok && data.ok) { showDone(data.ref); return; }

    setBusy(false);
    resetTurnstile();
    if (res.status === 400 && data.errors) {
      const fields = Object.keys(data.errors).filter((k) => k !== 'form');
      fields.forEach((k) => setError(k, data.errors[k]));
      if (fields[0] === 'service') form.querySelector('input[name="service"]').focus();
      else if (fields[0] && form.elements[fields[0]]) form.elements[fields[0]].focus();
      showStatus(data.errors.form || 'Please check the highlighted fields.');
    } else if (res.status === 429) {
      showStatus(data.error || 'Too many enquiries have been sent. Please try again later.');
    } else {
      showStatus('Sorry, your enquiry could not be sent. ' + FALLBACK);
    }
  });
})();
