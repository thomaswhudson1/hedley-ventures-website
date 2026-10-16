// Hedley Ventures private dashboard (client side): Overview, Enquiries and Website views.
// All data comes from the authenticated /admin/api endpoints; nothing is stored in the browser.
// Submitted text is only ever inserted with textContent, never as HTML.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = { rows: [], today: '', options: null, sort: { key: 'received_at', dir: 'desc' }, current: null, dirty: false, view: null, days: 30, loaded: false };
  const ACTIVE = '__active';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ---------- API ----------
  async function api(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch('/admin/api' + path, {
        method,
        credentials: 'same-origin',
        redirect: 'manual',
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'hv-admin' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      showBanner('Could not reach the server. Check your connection and try again.');
      throw new Error('network');
    }
    if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 302) {
      showBanner('Your sign-in has expired. Reload the page to sign in again.', true);
      throw new Error('auth');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      const err = new Error((data && (data.error || Object.values(data.errors || {})[0])) || 'Something went wrong.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function showBanner(message, withReload = false) {
    const banner = $('banner');
    banner.textContent = message;
    if (withReload) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--small';
      button.textContent = 'Reload';
      button.addEventListener('click', () => location.reload());
      banner.append(button);
    }
    banner.hidden = false;
  }

  // ---------- Formatting ----------
  const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' });
  const shortDateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat('en-GB');
  const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '');
  const fmtDay = (ymd) => (ymd ? dateFmt.format(new Date(ymd + 'T12:00:00Z')) : '');
  const fmtFee = (v) => (v == null || v === '' ? '' : gbp.format(v));
  const slug = (s) => String(s).replace(/[^A-Za-z]+/g, '-');
  const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v; else if (k === 'text') node.textContent = v; else node.setAttribute(k, v === true ? '' : v);
    }
    for (const child of children) if (child != null) node.append(child);
    return node;
  }

  const isClosed = (r) => state.options.closedStatuses.includes(r.status);
  const isActive = (r) => state.options.activeStatuses.includes(r.status);
  // 'overdue' | 'due' (today) | 'soon' (within 7 days) | null
  function followUpState(r) {
    if (!r.next_follow_up || r.archived_at || isClosed(r)) return null;
    if (r.next_follow_up < state.today) return 'overdue';
    if (r.next_follow_up === state.today) return 'due';
    if (r.next_follow_up <= addDays(state.today, 7)) return 'soon';
    return null;
  }

  function statusBadges(r) {
    const frag = document.createDocumentFragment();
    frag.append(el('span', { class: `badge badge--${slug(r.status)}`, text: r.status }));
    const due = followUpState(r);
    if (due === 'overdue') frag.append(el('span', { class: 'badge badge--overdue', text: 'Follow-up overdue', title: `Follow-up was due ${fmtDay(r.next_follow_up)}` }));
    if (due === 'due') frag.append(el('span', { class: 'badge badge--due', text: 'Follow-up due today' }));
    if (due === 'soon') frag.append(el('span', { class: 'badge badge--soon', text: `Follow-up ${shortDateFmt.format(new Date(r.next_follow_up + 'T12:00:00Z'))}` }));
    if (r.archived_at) frag.append(el('span', { class: 'badge badge--archived', text: 'Archived' }));
    return frag;
  }

  // ---------- Views ----------
  function viewFromPath(path) {
    if (/^\/admin\/website\/?$/.test(path)) return 'website';
    if (/^\/admin\/enquiries/.test(path)) return 'enquiries';
    return 'overview';
  }

  function showView(view) {
    state.view = view;
    for (const v of ['overview', 'enquiries', 'website']) $(`view-${v}`).hidden = v !== view;
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', t.dataset.view === view ? 'page' : 'false'));
    document.title = `${view === 'overview' ? 'Overview' : view === 'enquiries' ? 'Enquiries' : 'Website'} | Hedley Ventures`;
    if (view === 'website') loadWebsite();
    if (view === 'overview') { renderOverview(); loadOverviewWeb(); }
    if (view === 'enquiries') { applyQueryFilters(); render(); }
  }

  function navigate(href, { push = true } = {}) {
    const url = new URL(href, location.origin);
    if (push) history.pushState({}, '', url.pathname + url.search);
    const m = url.pathname.match(/^\/admin\/enquiries\/([0-9a-f-]{36})$/i);
    showView(viewFromPath(url.pathname));
    if (m) openEnquiry(m[1], { push: false });
    window.scrollTo(0, 0);
  }

  // Filters can be set from links such as /admin/enquiries?status=Proposal+sent&followup=7
  function applyQueryFilters() {
    const p = new URLSearchParams(location.search);
    if (![...p.keys()].length) return;
    resetFilters();
    const map = { status: 'f-status', service: 'f-service', amount: 'f-amount', timing: 'f-timing', source: 'f-source', followup: 'f-followup', view: 'f-view', q: 'f-q' };
    for (const [k, id] of Object.entries(map)) if (p.has(k)) $(id).value = p.get(k);
    history.replaceState({}, '', location.pathname);
  }

  // ---------- Enquiries: filters, sorting, table ----------
  function fillSelect(select, values) {
    for (const v of values) select.append(el('option', { value: v, text: v }));
  }

  function currentFilters() {
    return {
      q: $('f-q').value.trim(), status: $('f-status').value, service: $('f-service').value, amount: $('f-amount').value,
      timing: $('f-timing').value, source: $('f-source').value, followup: $('f-followup').value, view: $('f-view').value
    };
  }

  function applyFilters(rows, f) {
    const q = f.q.toLowerCase();
    return rows.filter((r) => {
      if (f.view === 'active' && r.archived_at) return false;
      if (f.view === 'archived' && !r.archived_at) return false;
      if (f.status === ACTIVE ? !isActive(r) : f.status && r.status !== f.status) return false;
      if (f.service && r.service !== f.service) return false;
      if (f.amount && r.raise_amount !== f.amount) return false;
      if (f.timing && r.raise_timing !== f.timing) return false;
      if (f.source && (r.source_channel || 'Not recorded') !== f.source) return false;
      const fu = followUpState(r);
      if (f.followup === '1' && !(fu === 'overdue' || fu === 'due')) return false;
      if (f.followup === '7' && !fu) return false;
      if (q && !`${r.company} ${r.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function sortValue(r, key) {
    const o = state.options;
    if (key === 'estimated_fee') return r.estimated_fee == null ? -1 : r.estimated_fee;
    const ordinal = { raise_amount: o.raiseAmounts, raise_timing: o.raiseTimings, traction: o.traction, status: o.statuses, service: o.services }[key];
    if (ordinal) { const i = ordinal.indexOf(r[key]); return i < 0 ? 999 : i; }
    return String(r[key] || '').toLowerCase();
  }

  function sortRows(rows) {
    const { key, dir } = state.sort;
    const mult = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = sortValue(a, key); const vb = sortValue(b, key);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return a.received_at < b.received_at ? 1 : -1;
    });
  }

  function exportHref(f) {
    const params = new URLSearchParams({ view: f.view });
    for (const k of ['q', 'status', 'service', 'amount', 'timing', 'source', 'followup']) if (f[k]) params.set(k, f[k]);
    return '/admin/api/export.csv?' + params.toString();
  }

  function render() {
    if (!state.loaded) return;
    const all = state.rows;
    const current = all.filter((r) => !r.archived_at);
    $('stat-total').textContent = all.length;
    $('stat-new').textContent = current.filter((r) => r.status === 'New').length;
    $('stat-active').textContent = current.filter(isActive).length;
    const dueCount = current.filter((r) => ['overdue', 'due'].includes(followUpState(r))).length;
    $('stat-followup').textContent = dueCount;
    document.querySelector('[data-stat="followup"]').classList.toggle('has-items', dueCount > 0);

    const f = currentFilters();
    const rows = sortRows(applyFilters(all, f));
    $('export-link').href = exportHref(f);
    $('result-count').textContent = `Showing ${rows.length} of ${all.length} enquir${all.length === 1 ? 'y' : 'ies'}`;

    document.querySelectorAll('#table th').forEach((th) => th.removeAttribute('aria-sort'));
    const sortBtn = document.querySelector(`[data-sort="${state.sort.key}"]`);
    if (sortBtn) sortBtn.parentElement.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');

    $('rows').replaceChildren(...rows.map((r) => {
      const fu = followUpState(r);
      const tr = el('tr', { 'data-id': r.id, class: fu === 'overdue' || fu === 'due' ? 'is-due' : null });
      const company = el('td', { class: 'cell-company', 'data-label': 'Company' },
        el('a', { href: `/admin/enquiries/${r.id}`, text: r.company }),
        el('span', { class: 'cell-source', text: r.source_channel || 'Source not recorded' }));
      tr.append(
        el('td', { class: 'cell-date', 'data-label': 'Received', text: fmtDate(r.received_at) }),
        company,
        el('td', { 'data-label': 'Contact', text: r.name }),
        el('td', { 'data-label': 'Service', text: r.service }),
        el('td', { 'data-label': 'Fundraising amount', class: r.raise_amount ? null : 'muted', text: r.raise_amount || '—' }),
        el('td', { 'data-label': 'Revenue run-rate', text: r.traction }),
        el('td', { 'data-label': 'Fundraising timing', class: r.raise_timing ? null : 'muted', text: r.raise_timing || '—' }),
        el('td', { 'data-label': 'Est. fee', class: r.estimated_fee == null ? 'muted cell-fee' : 'cell-fee', text: r.estimated_fee == null ? '—' : fmtFee(r.estimated_fee) }),
        el('td', { class: 'cell-status', 'data-label': 'Status' }, el('div', { class: 'status-cell' }, statusBadges(r)))
      );
      return tr;
    }));
    $('empty').hidden = rows.length > 0;
  }

  // ---------- Individual enquiry ----------
  function fillDrawer(r) {
    state.current = r;
    $('d-ref').textContent = r.ref;
    $('d-company').textContent = r.company;
    $('d-received').textContent = 'Received ' + dateTimeFmt.format(new Date(r.received_at));
    $('d-badges').replaceChildren(statusBadges(r), r.priority ? el('span', { class: `badge badge--${r.priority}`, text: `${r.priority} priority` }) : '',
      r.estimated_fee != null ? el('span', { class: 'badge badge--fee', text: `Est. fee ${fmtFee(r.estimated_fee)}` }) : '');

    const emailLink = el('a', { href: `mailto:${r.email}`, text: r.email });
    const rows = [
      ['Contact name', r.name], ['Email address', emailLink], ['Company', r.company], ['Services required', r.service],
      ...(r.raise_amount || r.raise_timing || ['Fundraising Advisory', 'Both'].includes(r.service)
        ? [['Fundraising amount', r.raise_amount || 'Not answered'], ['Fundraising timing', r.raise_timing || 'Not answered']] : []),
      ['Monthly revenue run-rate', r.traction], ['Anything else', r.message || '—'],
      ['Date and time received', dateTimeFmt.format(new Date(r.received_at))]
    ];
    $('d-details').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, v)]));

    const campaign = [r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(' / ');
    const sourceRows = r.source_channel
      ? [['Channel', r.source_channel], ['Referring website', r.referrer_host || 'None (direct, app or private browsing)'], ['First page visited', r.landing_page || '—'], ...(campaign ? [['Campaign tags', campaign]] : [])]
      : [['Channel', 'Not recorded (received before source tracking began)']];
    $('d-source').replaceChildren(...sourceRows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));

    const notify = $('d-notify');
    notify.className = 'notify';
    if (r.notification_status === 'sent') notify.replaceChildren(`Email notification sent ${r.notification_sent_at ? dateTimeFmt.format(new Date(r.notification_sent_at)) : ''}.`);
    else {
      const retry = el('button', { type: 'button', class: 'btn btn--small', text: 'Retry email notification' });
      retry.addEventListener('click', () => retryNotification(retry));
      const msg = r.notification_status === 'failed'
        ? `Email notification failed after ${r.notification_attempts} attempt${r.notification_attempts === 1 ? '' : 's'}${r.notification_error ? ': ' + r.notification_error : ''}. It is retried automatically every 15 minutes.`
        : 'Email notification is being sent.';
      if (r.notification_status === 'failed') notify.classList.add('notify--failed');
      notify.replaceChildren(el('span', { text: msg }), retry);
    }

    $('d-status').replaceChildren();
    $('d-priority').replaceChildren();
    fillSelect($('d-status'), state.options.statuses);
    fillSelect($('d-priority'), state.options.priorities);
    $('d-status').value = r.status;
    $('d-priority').value = r.priority;
    $('d-last').value = r.last_contacted || '';
    $('d-next').value = r.next_follow_up || '';
    $('d-fee').value = r.estimated_fee == null ? '' : num.format(r.estimated_fee);
    $('d-notes').value = r.notes || '';
    $('d-archive').textContent = r.archived_at ? 'Restore from archive' : 'Archive';
    $('d-save-status').textContent = '';
    state.dirty = false;
  }

  let lastFocus = null;
  async function openEnquiry(id, { push = true } = {}) {
    let row = state.rows.find((r) => r.id === id);
    if (!row) {
      try { row = (await api(`/enquiries/${id}`)).enquiry; } catch { showBanner('That enquiry could not be found.'); return; }
    }
    lastFocus = document.activeElement;
    fillDrawer(row);
    $('drawer').hidden = false;
    document.body.style.overflow = 'hidden';
    document.querySelector('.drawer__panel').focus();
    if (push && location.pathname !== `/admin/enquiries/${id}`) history.pushState({ id }, '', `/admin/enquiries/${id}`);
  }

  function closeEnquiry({ push = true } = {}) {
    if ($('drawer').hidden) return true;
    if (state.dirty && !confirm('You have unsaved changes. Close without saving?')) return false;
    $('drawer').hidden = true;
    document.body.style.overflow = '';
    state.current = null;
    state.dirty = false;
    if (push && /^\/admin\/enquiries\/[0-9a-f-]{36}$/i.test(location.pathname)) history.pushState({}, '', state.view === 'overview' ? '/admin/overview' : '/admin/enquiries');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    return true;
  }

  function updateRow(updated) {
    const i = state.rows.findIndex((r) => r.id === updated.id);
    if (i >= 0) state.rows[i] = updated; else state.rows.unshift(updated);
    render();
    if (state.view === 'overview') renderOverview();
    if (state.current && state.current.id === updated.id) fillDrawer(updated);
  }

  async function save(event) {
    event.preventDefault();
    const r = state.current;
    if (!r) return;
    const button = $('d-save');
    const status = $('d-save-status');
    button.disabled = true;
    status.className = 'save-status';
    status.textContent = 'Saving…';
    try {
      const { enquiry } = await api(`/enquiries/${r.id}`, {
        method: 'PATCH',
        body: { status: $('d-status').value, priority: $('d-priority').value, last_contacted: $('d-last').value, next_follow_up: $('d-next').value, estimated_fee: $('d-fee').value, notes: $('d-notes').value }
      });
      updateRow(enquiry);
      $('d-save-status').textContent = 'Saved';
    } catch (err) {
      status.className = 'save-status is-error';
      status.textContent = err.message === 'auth' || err.message === 'network' ? 'Not saved.' : `Not saved: ${err.message}`;
    } finally {
      button.disabled = false;
    }
  }

  async function toggleArchive() {
    const r = state.current;
    if (!r) return;
    if (state.dirty && !confirm('You have unsaved changes. Archive/restore without saving them?')) return;
    try {
      const { enquiry } = await api(`/enquiries/${r.id}`, { method: 'PATCH', body: { archived: !r.archived_at } });
      updateRow(enquiry);
      $('d-save-status').textContent = enquiry.archived_at ? 'Archived. It no longer appears under current enquiries.' : 'Restored to current enquiries.';
    } catch (err) {
      $('d-save-status').className = 'save-status is-error';
      $('d-save-status').textContent = `Not changed: ${err.message}`;
    }
  }

  async function retryNotification(button) {
    const r = state.current;
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      const { enquiry } = await api(`/enquiries/${r.id}/notify`, { method: 'POST', body: {} });
      updateRow(enquiry);
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Retry email notification';
    }
  }

  // ---------- Overview ----------
  function renderOverview() {
    if (!state.loaded) return;
    const current = state.rows.filter((r) => !r.archived_at);
    const active = current.filter(isActive);
    const withFee = active.filter((r) => r.estimated_fee != null);
    const proposals = current.filter((r) => r.status === 'Proposal sent');
    const won = state.rows.filter((r) => r.status === 'Won');
    const sumFees = (rows) => rows.reduce((s, r) => s + (r.estimated_fee || 0), 0);

    $('ov-active').textContent = active.length;
    $('ov-pipeline').textContent = gbp.format(sumFees(active));
    $('ov-pipeline-sub').textContent = active.length ? `${withFee.length} of ${active.length} with a fee entered` : 'Active opportunities with a fee entered';
    $('ov-proposals').textContent = proposals.length;
    $('ov-proposals-sub').textContent = proposals.some((r) => r.estimated_fee != null) ? `${gbp.format(sumFees(proposals))} estimated` : 'Awaiting decision';
    $('ov-won').textContent = won.length;
    $('ov-won-sub').textContent = won.some((r) => r.estimated_fee != null) ? `${gbp.format(sumFees(won))} estimated fees` : 'All time';

    const upcoming = current.filter((r) => followUpState(r)).sort((a, b) => (a.next_follow_up < b.next_follow_up ? -1 : 1));
    const label = (r) => { const s = followUpState(r); return s === 'overdue' ? 'Overdue' : s === 'due' ? 'Today' : shortDateFmt.format(new Date(r.next_follow_up + 'T12:00:00Z')); };
    $('ov-followups').replaceChildren(...(upcoming.length
      ? upcoming.slice(0, 8).map((r) => el('li', {}, el('a', { href: `/admin/enquiries/${r.id}`, class: 'list__item', 'data-open': r.id },
          el('span', { class: `list__when list__when--${followUpState(r)}`, text: label(r) }),
          el('span', { class: 'list__main', text: r.company }),
          el('span', { class: 'list__meta', text: r.status }))))
      : [el('li', { class: 'list__empty', text: 'No follow-ups due in the next 7 days.' })]));

    const recent = current.slice(0, 5);
    $('ov-recent').replaceChildren(...(recent.length
      ? recent.map((r) => el('li', {}, el('a', { href: `/admin/enquiries/${r.id}`, class: 'list__item', 'data-open': r.id },
          el('span', { class: 'list__when', text: fmtDate(r.received_at) }),
          el('span', { class: 'list__main', text: r.company }),
          el('span', { class: 'list__meta', text: `${r.service} · ${r.source_channel || 'Source not recorded'}` }))))
      : [el('li', { class: 'list__empty', text: 'No enquiries yet.' })]));
  }

  function change(cur, prev) {
    if (cur == null || prev == null) return null;
    if (prev === 0) return cur === 0 ? { text: 'No change', cls: 'flat' } : { text: 'New', cls: 'up' };
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { text: `${pct > 0 ? '+' : ''}${pct}% vs previous`, cls: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
  }

  function statCard(label, value, delta, sub) {
    return el('div', { class: 'stat stat--static' },
      el('span', { class: 'stat__label', text: label }),
      el('span', { class: 'stat__value', text: value }),
      delta ? el('span', { class: `stat__delta stat__delta--${delta.cls}`, text: delta.text }) : null,
      sub ? el('span', { class: 'stat__sub', text: sub }) : null);
  }

  async function loadOverviewWeb() {
    const box = $('ov-web');
    try {
      const a = await api('/analytics?days=30');
      if (!a.configured) { box.replaceChildren(el('p', { class: 'muted', text: 'Website analytics is not connected yet.' })); return; }
      const per = (v) => (v == null ? '—' : String(v));
      box.replaceChildren(
        statCard('Visits', num.format(a.current.visits), change(a.current.visits, a.prior.visits)),
        statCard('Page views', num.format(a.current.pageviews), change(a.current.pageviews, a.prior.pageviews)),
        statCard('Enquiries', num.format(a.current.enquiries), change(a.current.enquiries, a.prior.enquiries)),
        statCard('Enquiries per 100 visits', per(a.current.per100), null));
    } catch (err) {
      box.replaceChildren(el('p', { class: 'muted', text: 'Website figures could not be loaded.' }));
    }
  }

  // ---------- Website ----------
  function miniTable(id, headers, rows, empty) {
    const table = $(id);
    const head = el('thead', {}, el('tr', {}, ...headers.map((h, i) => el('th', { class: i ? 'num' : null, text: h }))));
    const body = el('tbody', {}, ...(rows.length ? rows.map((cells) => el('tr', {}, ...cells.map((c, i) => el('td', { class: i ? 'num' : null, text: c }))))
      : [el('tr', {}, el('td', { colspan: String(headers.length), class: 'muted', text: empty }))]));
    table.replaceChildren(head, body);
  }

  let lastSeries = null;
  function drawChart(series) {
    lastSeries = series;
    const box = $('web-chart');
    // Drawn at the chart's real width so labels stay readable on phones.
    const w = Math.max(280, Math.round(box.clientWidth || 760)); const h = w < 500 ? 150 : 190; const pad = { l: 34, r: 8, t: 10, b: 26 };
    const max = Math.max(1, ...series.map((d) => d.visits));
    const step = (w - pad.l - pad.r) / series.length;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('class', 'chart__svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Visits per day: ${series.map((d) => `${d.date} ${d.visits}`).join(', ')}`);
    const mk = (tag, attrs) => { const n = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; };
    for (const frac of [0, 0.5, 1]) {
      const y = pad.t + (h - pad.t - pad.b) * (1 - frac);
      svg.append(mk('line', { x1: pad.l, x2: w - pad.r, y1: y, y2: y, class: 'chart__grid' }));
      const t = mk('text', { x: pad.l - 6, y: y + 4, class: 'chart__axis', 'text-anchor': 'end' }); t.textContent = Math.round(max * frac); svg.append(t);
    }
    series.forEach((d, i) => {
      const bh = ((h - pad.t - pad.b) * d.visits) / max;
      const x = pad.l + i * step + step * 0.15;
      const bar = mk('rect', { x, y: h - pad.b - bh, width: Math.max(1, step * 0.7), height: Math.max(0, bh), rx: 1.5, class: 'chart__bar' });
      const title = document.createElementNS(SVG_NS, 'title'); title.textContent = `${shortDateFmt.format(new Date(d.date + 'T12:00:00Z'))}: ${d.visits} visits, ${d.pageviews} page views`;
      bar.append(title); svg.append(bar);
      const labels = Math.max(3, Math.floor((w - pad.l) / 70));   // about one date label per 70px
      const every = Math.max(1, Math.ceil(series.length / labels));
      if (i % every === 0 || i === series.length - 1) {
        const t = mk('text', { x: x + step * 0.35, y: h - 8, class: 'chart__axis', 'text-anchor': 'middle' }); t.textContent = shortDateFmt.format(new Date(d.date + 'T12:00:00Z')); svg.append(t);
      }
    });
    box.replaceChildren(svg);
  }

  async function loadWebsite() {
    document.querySelectorAll('[data-days]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.days) === state.days)));
    const status = $('web-status');
    status.textContent = 'Loading…';
    let a;
    try { a = await api(`/analytics?days=${state.days}`); } catch (err) { status.textContent = 'Website figures could not be loaded.'; return; }

    const parts = [];
    if (!a.configured) parts.push('Website analytics is not connected yet.');
    else {
      parts.push(a.lastSync ? `Updated ${dateTimeFmt.format(new Date(a.lastSync))}.` : 'Not updated yet.');
      if (a.lastError) parts.push(`Last update problem: ${a.lastError}`);
      if (!a.current.visits && !a.prior.visits) parts.push('No visits recorded yet. Figures appear within about an hour of the analytics snippet going live on the website.');
    }
    const refresh = el('button', { type: 'button', class: 'btn btn--link btn--inline', text: 'Refresh now' });
    refresh.addEventListener('click', async () => {
      refresh.disabled = true; refresh.textContent = 'Refreshing…';
      try { await api('/analytics/refresh', { method: 'POST', body: {} }); } catch { /* shown via status */ }
      loadWebsite();
    });
    status.replaceChildren(parts.join(' ') + ' ', a.configured ? refresh : '');

    const range = `${fmtDay(a.range.from)} – ${fmtDay(a.range.to)}`;
    $('web-cards').replaceChildren(
      statCard('Visits', num.format(a.current.visits), change(a.current.visits, a.prior.visits), range),
      statCard('Page views', num.format(a.current.pageviews), change(a.current.pageviews, a.prior.pageviews), null),
      statCard('Enquiries', num.format(a.current.enquiries), change(a.current.enquiries, a.prior.enquiries), null),
      statCard('Enquiries per 100 visits', a.current.per100 == null ? '—' : String(a.current.per100), a.prior.per100 == null ? null : change(a.current.per100, a.prior.per100), null));
    drawChart(a.series);
    miniTable('web-pages', ['Page', 'Page views', 'Visits'], a.pages.map((p) => [p.key || '/', num.format(p.pageviews), num.format(p.visits)]), 'No page views in this period.');
    miniTable('web-channels', ['Channel', 'Visits'], a.channels.map((c) => [c.channel, num.format(c.visits)]), 'No visits in this period.');
    miniTable('web-refs', ['Website', 'Visits'], a.referrers.filter((r) => r.key).map((r) => [r.key, num.format(r.visits)]), 'No referring websites in this period.');
    miniTable('web-enq', ['Source', 'Enquiries'], a.enquiriesByChannel.map((c) => [c.channel, num.format(c.n)]), 'No enquiries in this period.');
  }

  // ---------- Wiring ----------
  function resetFilters() {
    for (const id of ['f-q', 'f-status', 'f-service', 'f-amount', 'f-timing', 'f-source', 'f-followup']) $(id).value = '';
    $('f-view').value = 'active';
  }

  function wire() {
    ['f-q', 'f-status', 'f-service', 'f-amount', 'f-timing', 'f-source', 'f-followup', 'f-view'].forEach((id) => $(id).addEventListener(id === 'f-q' ? 'input' : 'change', render));
    $('clear-filters').addEventListener('click', () => { resetFilters(); render(); });

    document.querySelectorAll('[data-sort]').forEach((btn) => btn.addEventListener('click', () => {
      const key = btn.dataset.sort;
      state.sort = state.sort.key === key ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'received_at' || key === 'estimated_fee' ? 'desc' : 'asc' };
      render();
    }));

    document.querySelectorAll('[data-stat]').forEach((btn) => btn.addEventListener('click', () => {
      resetFilters();
      const stat = btn.dataset.stat;
      if (stat === 'total') $('f-view').value = 'all';
      if (stat === 'new') $('f-status').value = 'New';
      if (stat === 'active') $('f-status').value = ACTIVE;
      if (stat === 'followup') $('f-followup').value = '1';
      render();
    }));

    document.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { state.days = Number(b.dataset.days); loadWebsite(); }));
    let resizeTimer;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (state.view === 'website' && lastSeries) drawChart(lastSeries); }, 150); });

    // In-dashboard links (tabs, overview cards and lists) switch views without reloading.
    document.addEventListener('click', (event) => {
      const a = event.target.closest('a[href^="/admin/"]');
      if (!a || event.metaKey || event.ctrlKey || event.shiftKey || a.closest('#rows')) return;
      if (a.id === 'export-link' || a.getAttribute('href').startsWith('/admin/api/')) return;
      event.preventDefault();
      if (a.dataset.open) { openEnquiry(a.dataset.open); return; }
      if (!closeEnquiry({ push: false })) return;
      navigate(a.getAttribute('href'));
    });

    $('rows').addEventListener('click', (event) => {
      const tr = event.target.closest('tr[data-id]');
      if (!tr) return;
      event.preventDefault();
      openEnquiry(tr.dataset.id);
    });

    $('drawer').addEventListener('click', (event) => { if (event.target.closest('[data-close]')) closeEnquiry(); });
    $('d-form').addEventListener('submit', save);
    $('d-form').addEventListener('input', () => { state.dirty = true; $('d-save-status').textContent = ''; });
    $('d-archive').addEventListener('click', toggleArchive);

    document.addEventListener('keydown', (event) => {
      if ($('drawer').hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeEnquiry(); return; }
      if (event.key === 'Tab') {   // keep keyboard focus inside the open enquiry
        const focusable = [...document.querySelectorAll('.drawer__panel button, .drawer__panel a[href], .drawer__panel input, .drawer__panel select, .drawer__panel textarea')].filter((n) => !n.disabled && n.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === document.querySelector('.drawer__panel'))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });

    window.addEventListener('popstate', () => {
      const m = location.pathname.match(/^\/admin\/enquiries\/([0-9a-f-]{36})$/i);
      if (m) { if (state.view !== 'enquiries' && state.view !== 'overview') showView('enquiries'); openEnquiry(m[1], { push: false }); return; }
      if (!closeEnquiry({ push: false })) { history.pushState({}, '', `/admin/enquiries/${state.current.id}`); return; }
      showView(viewFromPath(location.pathname));
    });
    window.addEventListener('beforeunload', (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
  }

  async function init() {
    try {
      const session = await api('/session');
      state.options = session.options;
      state.today = session.today;
      $('user-email').textContent = session.email + (session.dev ? ' (local test mode)' : '');
      $('logout-link').href = session.logoutUrl;
      fillSelect($('f-status'), session.options.statuses);
      $('f-status').insertBefore(el('option', { value: ACTIVE, text: 'Active opportunities' }), $('f-status').options[1]);
      fillSelect($('f-service'), session.options.services);
      fillSelect($('f-amount'), session.options.raiseAmounts);
      fillSelect($('f-timing'), session.options.raiseTimings);
      fillSelect($('f-source'), session.options.channels);
      wire();

      const data = await api('/enquiries');
      state.rows = data.enquiries;
      state.today = data.today;
      state.loaded = true;
      $('loading').hidden = true;

      const m = location.pathname.match(/^\/admin\/enquiries\/([0-9a-f-]{36})$/i);
      showView(viewFromPath(location.pathname));
      if (m) openEnquiry(m[1], { push: false });
    } catch (err) {
      $('loading').textContent = 'Enquiries could not be loaded.';
      showView(viewFromPath(location.pathname));
      if (err.message !== 'auth' && err.message !== 'network') showBanner(`The dashboard could not be loaded: ${err.message}`);
    }
  }

  init();
})();
