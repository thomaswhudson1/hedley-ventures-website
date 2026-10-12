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

// Home: credentials counters and founder testimonial carousel
const statValues = document.querySelectorAll('.stat__value[data-count]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (statValues.length && 'IntersectionObserver' in window && !reduceMotion) {
  const render = (el, n) => { el.textContent = (el.dataset.prefix || '') + n + (el.dataset.suffix || ''); };
  statValues.forEach((el) => render(el, 0));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const el = entry.target; const target = Number(el.dataset.count); const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / 1500, 1);
        render(el, Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.4 });
  statValues.forEach((el) => observer.observe(el));
}

const carousel = document.querySelector('.proof-carousel');
if (carousel) {
  const slides = [...carousel.querySelectorAll('.proof-slide')];
  const dots = [...carousel.querySelectorAll('.proof-carousel__dots button')];
  let current = 0;
  const show = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.hidden = !active;
      slide.classList.toggle('is-active', active);
      if (active) { slide.classList.remove('is-entering'); void slide.offsetWidth; slide.classList.add('is-entering'); }
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
  };
  carousel.querySelectorAll('[data-dir]').forEach((btn) => btn.addEventListener('click', () => show(current + Number(btn.dataset.dir))));
  dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));
  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
}
// Transactions: cards are built from /assets/data/transactions.js.
// <div data-transactions="featured"> shows featured deals (up to data-limit); data-transactions="all" shows every deal.
const makeLogo = (logo, alt, className) => {
  const img = document.createElement('img');
  img.className = className;
  img.src = logo.src;
  img.alt = alt;
  img.width = logo.width;
  img.height = logo.height;
  img.loading = 'lazy';
  img.style.setProperty('--logo-h', `${logo.displayHeight}px`);
  return img;
};

const renderTransactionCard = (deal, index) => {
  const card = document.createElement('article');
  card.className = 'deal-card reveal';
  card.style.setProperty('--reveal-delay', `${100 + index * 90}ms`);

  const logoWrap = document.createElement('div');
  logoWrap.className = 'deal-card__logo';
  logoWrap.appendChild(makeLogo(deal.companyLogo, deal.company, 'deal-card__company-logo'));
  card.appendChild(logoWrap);

  const amount = document.createElement('p');
  amount.className = 'deal-card__amount';
  amount.textContent = deal.amount;
  card.appendChild(amount);

  const type = document.createElement('p');
  type.className = 'deal-card__type';
  type.textContent = deal.description || deal.type;
  card.appendChild(type);

  const meta = [deal.sector, deal.year].filter(Boolean).join(' · ');
  if (meta) {
    const metaEl = document.createElement('p');
    metaEl.className = 'deal-card__meta';
    metaEl.textContent = meta;
    card.appendChild(metaEl);
  }

  const foot = document.createElement('div');
  foot.className = 'deal-card__foot';
  const label = document.createElement('span');
  label.className = 'deal-card__label';
  label.textContent = deal.counterpartyLabel;
  foot.appendChild(label);
  const cpWrap = document.createElement('div');
  cpWrap.className = 'deal-card__counterparty';
  cpWrap.appendChild(makeLogo(deal.counterpartyLogo, deal.counterparty, 'deal-card__counterparty-logo'));
  foot.appendChild(cpWrap);
  card.appendChild(foot);

  if (deal.link) {
    const link = document.createElement('a');
    link.className = 'deal-card__link';
    link.href = deal.link;
    link.innerHTML = `<span class="sr-only">${deal.company}: ${deal.amount} ${deal.type}</span>`;
    card.appendChild(link);
    card.classList.add('deal-card--linked');
  }
  return card;
};

document.querySelectorAll('[data-transactions]').forEach((container) => {
  const deals = Array.isArray(window.HEDLEY_TRANSACTIONS) ? window.HEDLEY_TRANSACTIONS : [];
  const mode = container.getAttribute('data-transactions');
  const limit = Number(container.getAttribute('data-limit')) || Infinity;
  const list = (mode === 'featured' ? deals.filter((d) => d.featured) : deals).slice(0, limit);
  if (!list.length) return;
  container.replaceChildren(...list.map(renderTransactionCard));
  container.classList.add('is-rendered');
});

// Testimonials: built from /assets/data/testimonials.js.
// Unapproved drafts appear only in the local preview (marked "Draft"), never on the live site.
const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const pickTestimonials = (category, homepageOnly) => (Array.isArray(window.HEDLEY_TESTIMONIALS) ? window.HEDLEY_TESTIMONIALS : [])
  .filter((t) => t.category === category && (!homepageOnly || t.homepage) && (t.approved || isLocalPreview))
  .sort((a, b) => a.order - b.order);

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const testimonialPerson = (t, prefix) => {
  const person = el('div', `${prefix}__person`);
  if (t.headshot) {
    const img = el('img', `${prefix}__photo`);
    img.src = t.headshot; img.alt = ''; img.width = 120; img.height = 120; img.loading = 'lazy';
    person.appendChild(img);
  } else {
    const initials = el('span', `${prefix}__photo ${prefix}__photo--placeholder`, t.name.split(' ').map((w) => w[0]).join('').slice(0, 2));
    initials.setAttribute('aria-hidden', 'true');
    person.appendChild(initials);
  }
  const who = el('div', `${prefix}__who`);
  who.appendChild(el('strong', `${prefix}__name`, t.name));
  who.appendChild(el('span', `${prefix}__role`, [t.title, t.organisation].filter(Boolean).join(', ')));
  person.appendChild(who);
  return person;
};

const testimonialLogo = (t, prefix) => {
  if (!t.logo) return null;
  const img = el('img', `${prefix}__logo${t.logo.blend ? ` ${prefix}__logo--blend` : ''}${t.logo.mono ? ` ${prefix}__logo--mono` : ''}`);
  img.src = t.logo.src; img.alt = t.organisation; img.width = t.logo.width; img.height = t.logo.height; img.loading = 'lazy';
  img.style.setProperty('--logo-h', `${t.logo.displayHeight}px`);
  return img;
};

const draftBadge = (t, prefix) => (t.approved ? null : el('span', `${prefix}__draft`, 'Draft – awaiting approval (preview only)'));

// Options: data-scope="all" ignores the homepage flag; data-featured="true|false" filters on `featured`;
// data-card-class adds a layout variant to each card.
document.querySelectorAll('[data-testimonials]').forEach((container) => {
  const scopeAll = container.getAttribute('data-scope') === 'all';
  const featured = container.getAttribute('data-featured');
  const list = pickTestimonials(container.getAttribute('data-testimonials'), !scopeAll)
    .filter((t) => featured === null || String(Boolean(t.featured)) === featured)
    .slice(0, Number(container.getAttribute('data-limit')) || Infinity);
  if (!list.length) return;
  const start = Number(container.getAttribute('data-start-delay')) || 0;
  const variant = container.getAttribute('data-card-class');
  container.replaceChildren(...list.map((t, i) => {
    const card = el('figure', `quote-card reveal${variant ? ` ${variant}` : ''}`);
    card.style.setProperty('--reveal-delay', `${start + i * 100}ms`);
    const badge = draftBadge(t, 'quote-card'); if (badge) card.appendChild(badge);
    const mark = el('span', 'quote-card__mark', '“'); mark.setAttribute('aria-hidden', 'true');
    card.appendChild(mark);
    card.appendChild(el('blockquote', 'quote-card__text', t.quote));
    const foot = el('figcaption', 'quote-card__foot');
    foot.appendChild(testimonialPerson(t, 'quote-card'));
    const logo = testimonialLogo(t, 'quote-card'); if (logo) foot.appendChild(logo);
    card.appendChild(foot);
    return card;
  }));
});

document.querySelectorAll('[data-testimonial-carousel]').forEach((container) => {
  const list = pickTestimonials(container.getAttribute('data-testimonial-carousel'), true);
  if (!list.length) return;
  const slidesWrap = el('div', 'eco-carousel__slides');
  slidesWrap.setAttribute('aria-live', 'polite');
  const slides = list.map((t, i) => {
    const slide = el('figure', 'eco-slide');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${list.length}`);
    if (i) slide.hidden = true;
    const badge = draftBadge(t, 'eco-slide'); if (badge) slide.appendChild(badge);
    const mark = el('span', 'eco-slide__mark', '“'); mark.setAttribute('aria-hidden', 'true');
    slide.appendChild(mark);
    slide.appendChild(el('blockquote', 'eco-slide__text', t.quote));
    const foot = el('figcaption', 'eco-slide__foot');
    foot.appendChild(testimonialPerson(t, 'eco-slide'));
    const logo = testimonialLogo(t, 'eco-slide');
    if (logo) foot.appendChild(logo); else foot.appendChild(el('span', 'eco-slide__org', t.organisation));
    slide.appendChild(foot);
    slidesWrap.appendChild(slide);
    return slide;
  });
  container.appendChild(slidesWrap);
  if (slides.length < 2) return;

  const controls = el('div', 'eco-carousel__controls');
  const dots = el('div', 'eco-carousel__dots');
  let current = 0;
  const show = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((s, i) => {
      s.hidden = i !== current;
      if (i === current) { s.classList.remove('is-entering'); void s.offsetWidth; s.classList.add('is-entering'); }
    });
    [...dots.children].forEach((d, i) => d.setAttribute('aria-current', String(i === current)));
  };
  const arrow = (dir, label, path) => {
    const b = el('button', 'eco-carousel__arrow');
    b.type = 'button'; b.setAttribute('aria-label', label);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
    b.addEventListener('click', () => show(current + dir));
    return b;
  };
  slides.forEach((_, i) => {
    const d = el('button');
    d.type = 'button'; d.setAttribute('aria-label', `Show endorsement ${i + 1}`); d.setAttribute('aria-current', String(i === 0));
    d.addEventListener('click', () => show(i));
    dots.appendChild(d);
  });
  controls.append(arrow(-1, 'Previous endorsement', 'M15 4l-8 8 8 8'), dots, arrow(1, 'Next endorsement', 'M9 4l8 8-8 8'));
  container.appendChild(controls);
  container.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
});

// Expand/collapse: <button data-expand aria-controls="id" data-label-open="…" data-label-closed="…">
document.querySelectorAll('[data-expand]').forEach((button) => {
  const region = document.getElementById(button.getAttribute('aria-controls'));
  if (!region) return;
  const label = button.querySelector('[data-expand-label]') || button;
  button.hidden = false;
  region.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    region.hidden = !open;
    label.textContent = button.getAttribute(open ? 'data-label-open' : 'data-label-closed');
    if (open) { region.classList.remove('is-opening'); void region.offsetWidth; region.classList.add('is-opening'); }
  });
});

// Scroll reveal: content is visible by default; JS only adds the hidden start state when it can animate
const revealItems = document.querySelectorAll('.reveal');
if (revealItems.length && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('reveal-ready');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealItems.forEach((el) => revealObserver.observe(el));
}