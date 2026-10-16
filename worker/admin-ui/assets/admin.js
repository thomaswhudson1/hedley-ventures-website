// Hedley Ventures enquiries dashboard (client side).
// All data comes from the authenticated /admin/api endpoints; nothing is stored in the browser.
// Submitted text is only ever inserted with textContent, never as HTML.
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = { rows: [], today: '', options: null, sort: { key: 'received_at', dir: 'desc' }, current: null, dirty: false };
  const ACTIVE = '__active';

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
  const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '');
  const fmtDay = (ymd) => (ymd ? dateFmt.format(new Date(ymd + 'T12:00:00Z')) : '');
  const slug = (s) => String(s).replace(/[^A-Za-z]+/g, '-');

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
  function followUpState(r) {
    if (!r.next_follow_up || r.archived_at || isClosed(r)) return null;
    if (r.next_follow_up < state.today) return 'overdue';
    if (r.next_follow_up === state.today) return 'due';
    return null;
  }

  function statusBadges(r) {
    const frag = document.createDocumentFragment();
    frag.append(el('span', { class: `badge badge--${slug(r.status)}`, text: r.status }));
    const due = followUpState(r);
    if (due === 'overdue') frag.append(el('span', { class: 'badge badge--overdue', text: 'Follow-up overdue', title: `Follow-up was due ${fmtDay(r.next_follow_up)}` }));
    if (due === 'due') frag.append(el('span', { class: 'badge badge--due', text: 'Follow-up due today' }));
    if (r.archived_at) frag.append(el('span', { class: 'badge badge--archived', text: 'Archived' }));
    return frag;
  }

  // ---------- Filters, sorting, table ----------
  function fillSelect(select, values) {
    for (const v of values) select.append(el('option', { value: v, text: v }));
  }

  function currentFilters() {
    return {
      q: $('f-q').value.trim(), status: $('f-status').value, service: $('f-service').value,
      amount: $('f-amount').value, timing: $('f-timing').value, view: $('f-view').value, followup: $('f-followup').checked
    };
  }

  function applyFilters(rows, f) {
    const q = f.q.toLowerCase();
    return rows.filter((r) => {
      if (f.view === 'active' && r.archived_at) return false;
      if (f.view === 'archived' && !r.archived_at) return false;
      if (f.status === ACTIVE ? !state.options.activeStatuses.includes(r.status) : f.status && r.status !== f.status) return false;
      if (f.service && r.service !== f.service) return false;
      if (f.amount && r.raise_amount !== f.amount) return false;
      if (f.timing && r.raise_timing !== f.timing) return false;
      if (f.followup && !followUpState(r)) return false;
      if (q && !`${r.company} ${r.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function sortValue(r, key) {
    const o = state.options;
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
    for (const k of ['q', 'status', 'service', 'amount', 'timing']) if (f[k]) params.set(k, f[k]);
    if (f.followup) params.set('followup', '1');
    return '/admin/api/export.csv?' + params.toString();
  }

  function render() {
    const all = state.rows;
    const current = all.filter((r) => !r.archived_at);
    $('stat-total').textContent = all.length;
    $('stat-new').textContent = current.filter((r) => r.status === 'New').length;
    $('stat-active').textContent = current.filter((r) => state.options.activeStatuses.includes(r.status)).length;
    const dueCount = current.filter((r) => followUpState(r)).length;
    $('stat-followup').textContent = dueCount;
    document.querySelector('[data-stat="followup"]').classList.toggle('has-items', dueCount > 0);

    const f = currentFilters();
    const rows = sortRows(applyFilters(all, f));
    $('export-link').href = exportHref(f);
    $('result-count').textContent = `Showing ${rows.length} of ${all.length} enquir${all.length === 1 ? 'y' : 'ies'}`;

    document.querySelectorAll('th').forEach((th) => th.removeAttribute('aria-sort'));
    const sortBtn = document.querySelector(`[data-sort="${state.sort.key}"]`);
    if (sortBtn) sortBtn.parentElement.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');

    const tbody = $('rows');
    tbody.replaceChildren(...rows.map((r) => {
      const tr = el('tr', { 'data-id': r.id, class: followUpState(r) ? 'is-due' : null });
      const link = el('a', { href: `/admin/enquiries/${r.id}`, text: r.company });
      tr.append(
        el('td', { class: 'cell-date', 'data-label': 'Received', text: fmtDate(r.received_at) }),
        el('td', { class: 'cell-company', 'data-label': 'Company' }, link),
        el('td', { 'data-label': 'Contact', text: r.name }),
        el('td', { 'data-label': 'Service', text: r.service }),
        el('td', { 'data-label': 'Fundraising amount', class: r.raise_amount ? null : 'muted', text: r.raise_amount || '—' }),
        el('td', { 'data-label': 'Revenue run-rate', text: r.traction }),
        el('td', { 'data-label': 'Fundraising timing', class: r.raise_timing ? null : 'muted', text: r.raise_timing || '—' }),
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
    $('d-badges').replaceChildren(statusBadges(r), r.priority ? el('span', { class: `badge badge--${r.priority}`, text: `${r.priority} priority` }) : '');

    const emailLink = el('a', { href: `mailto:${r.email}`, text: r.email });
    const rows = [
      ['Contact name', r.name], ['Email address', emailLink], ['Company', r.company], ['How can I help?', r.service],
      ...(r.raise_amount || r.raise_timing || ['Fundraising Advisory', 'Both'].includes(r.service)
        ? [['Fundraising amount', r.raise_amount || 'Not answered'], ['Fundraising timing', r.raise_timing || 'Not answered']] : []),
      ['Monthly revenue run-rate', r.traction], ['Anything else', r.message || '—'],
      ['Date and time received', dateTimeFmt.format(new Date(r.received_at))]
    ];
    $('d-details').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, v)]));

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
    if (push && location.pathname !== '/admin/enquiries') history.pushState({}, '', '/admin/enquiries');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    return true;
  }

  function updateRow(updated) {
    const i = state.rows.findIndex((r) => r.id === updated.id);
    if (i >= 0) state.rows[i] = updated; else state.rows.unshift(updated);
    render();
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
        body: { status: $('d-status').value, priority: $('d-priority').value, last_contacted: $('d-last').value, next_follow_up: $('d-next').value, notes: $('d-notes').value }
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

  // ---------- Wiring ----------
  function resetFilters() {
    $('f-q').value = ''; $('f-status').value = ''; $('f-service').value = ''; $('f-amount').value = ''; $('f-timing').value = '';
    $('f-view').value = 'active'; $('f-followup').checked = false;
  }

  function wire() {
    ['f-q', 'f-status', 'f-service', 'f-amount', 'f-timing', 'f-view', 'f-followup'].forEach((id) => $(id).addEventListener(id === 'f-q' ? 'input' : 'change', render));
    $('clear-filters').addEventListener('click', () => { resetFilters(); render(); });

    document.querySelectorAll('[data-sort]').forEach((btn) => btn.addEventListener('click', () => {
      const key = btn.dataset.sort;
      state.sort = state.sort.key === key ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'received_at' ? 'desc' : 'asc' };
      render();
    }));

    document.querySelectorAll('[data-stat]').forEach((btn) => btn.addEventListener('click', () => {
      resetFilters();
      const stat = btn.dataset.stat;
      if (stat === 'total') $('f-view').value = 'all';
      if (stat === 'new') $('f-status').value = 'New';
      if (stat === 'active') $('f-status').value = ACTIVE;
      if (stat === 'followup') $('f-followup').checked = true;
      render();
    }));

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
      if (m) openEnquiry(m[1], { push: false }); else if (!closeEnquiry({ push: false })) history.pushState({}, '', `/admin/enquiries/${state.current.id}`);
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
      wire();

      const data = await api('/enquiries');
      state.rows = data.enquiries;
      state.today = data.today;
      $('loading').hidden = true;
      render();

      const m = location.pathname.match(/^\/admin\/enquiries\/([0-9a-f-]{36})$/i);
      if (m) openEnquiry(m[1], { push: false });
    } catch (err) {
      $('loading').textContent = 'Enquiries could not be loaded.';
      if (err.message !== 'auth' && err.message !== 'network') showBanner(`Enquiries could not be loaded: ${err.message}`);
    }
  }

  init();
})();
