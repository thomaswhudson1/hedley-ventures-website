// Server-side validation of a public enquiry submission. Never trusts the browser.
import { SERVICES, FUNDRAISING_SERVICES, RAISE_AMOUNTS, RAISE_TIMINGS, TRACTION, LIMITS } from './options.js';
import { cleanText } from './util.js';

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateEnquiry(body) {
  const errors = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, errors: { form: 'Invalid submission.' } };

  const name = cleanText(body.name);
  const email = cleanText(body.email).toLowerCase();
  const company = cleanText(body.company);
  const service = cleanText(body.service);
  const traction = cleanText(body.traction);
  const message = cleanText(body.message, { multiline: true });
  let raiseAmount = cleanText(body.raiseAmount);
  let raiseTiming = cleanText(body.raiseTiming);
  const submissionKey = cleanText(body.submissionKey);

  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > LIMITS.name) errors.name = `Please keep your name under ${LIMITS.name} characters.`;

  if (!email) errors.email = 'Please enter your email address.';
  else if (email.length > LIMITS.email || !EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';

  if (!company) errors.company = 'Please enter your company name.';
  else if (company.length > LIMITS.company) errors.company = `Please keep the company name under ${LIMITS.company} characters.`;

  if (!SERVICES.includes(service)) errors.service = 'Please choose how Thomas can help.';
  if (!TRACTION.includes(traction)) errors.traction = 'Please choose your current level of traction.';

  // Fundraising questions are required for fundraising enquiries and ignored otherwise.
  if (FUNDRAISING_SERVICES.includes(service)) {
    if (!RAISE_AMOUNTS.includes(raiseAmount)) errors.raiseAmount = 'Please choose how much you are looking to raise.';
    if (!RAISE_TIMINGS.includes(raiseTiming)) errors.raiseTiming = 'Please choose when you are looking to raise funding.';
  } else {
    raiseAmount = '';
    raiseTiming = '';
  }

  if (message.length > LIMITS.message) errors.message = `Please keep this under ${LIMITS.message} characters.`;
  if (!UUID_RE.test(submissionKey)) errors.form = 'Please refresh the page and try again.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: { name, email, company, service, raiseAmount: raiseAmount || null, raiseTiming: raiseTiming || null, traction, message: message || null, submissionKey: submissionKey.toLowerCase() }
  };
}
