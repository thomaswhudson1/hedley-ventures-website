const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
if (toggle && navigation) {
  const closeMenu = () => { navigation.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.querySelector('span').textContent = '+'; };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('open', open);
    toggle.querySelector('span').textContent = open ? '−' : '+';
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && navigation.classList.contains('open')) { closeMenu(); toggle.focus(); } });
  window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);
}

const enquiryForm = document.querySelector('#contact-form');
if (enquiryForm) {
  const status = document.querySelector('#form-status');
  const copyButton = document.querySelector('#copy-enquiry');
  let enquiry = '';
  enquiryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!enquiryForm.reportValidity()) return;
    const data = new FormData(enquiryForm);
    const name = String(data.get('name') || '').trim();
    const company = String(data.get('company') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();
    enquiry = `Name: ${name}\nCompany: ${company || 'Not specified'}\nEmail: ${email}\n\n${message}`;
    status.hidden = false;
    status.textContent = 'Your enquiry is ready. Please review and send it in your email app. If it does not open, use “Copy enquiry instead” and email Thomas directly.';
    copyButton.hidden = false;
    window.location.href = 'mailto:thudson@hedleyventures.com?subject=' + encodeURIComponent('Hedley Ventures enquiry' + (company ? ' - ' + company : '')) + '&body=' + encodeURIComponent(enquiry);
  });
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(enquiry);
      status.textContent = 'Enquiry copied. Paste it into an email to thudson@hedleyventures.com and send when you are ready.';
    } catch {
      status.textContent = 'Copy is unavailable in this browser. Your details are still in the form; please email thudson@hedleyventures.com directly.';
    }
  });
}
