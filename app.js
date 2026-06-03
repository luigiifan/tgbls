/* ============================================================
   Tigabelas — Kalender Kegiatan
   Vanilla JS · localStorage · Leaflet (OSM) · tanpa build step
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Konstanta ---------- */
  const USERS = { L: '1305', F: '1304' };
  const NAMES = { L: 'Luigi', F: 'Fany' };   // display names
  const KEY_EVENTS = 'tigabelas.events.v1';
  const KEY_THEME = 'tigabelas.theme';
  const KEY_SESSION = 'tigabelas.session';
  const KEY_TAGS = 'tigabelas.tags.v1';
  const KEY_PHOTOS = 'tigabelas.photos.v1';

  // Home point — used to compute distance. Change here if needed.
  const HOME = { name: 'Sidoarjo', lat: -7.4478, lng: 112.7183 };

  // Collapsed height of the stats card grid — change this value to adjust it.
  const STATS_COLLAPSED_HEIGHT = '120px';

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const DEFAULT_TAGS = [
    { id: 'tg-film', name: 'Movie', kuliner: false },
    { id: 'tg-kuliner', name: 'Food', kuliner: true },
    { id: 'tg-jalan', name: 'Outing', kuliner: false },
    { id: 'tg-belanja', name: 'Shopping', kuliner: false },
    { id: 'tg-olahraga', name: 'Sport', kuliner: false },
  ];

  /* ---------- State ---------- */
  let viewYear, viewMonth;       // bulan yang sedang ditampilkan (month 0-indexed)
  let events = [];               // daftar kegiatan
  let tags = [];                 // daftar tag tersedia
  let currentUser = null;        // 'L' | 'F' | null
  let selectedDate = null;       // 'YYYY-MM-DD' untuk day modal
  let loggingIn = false;         // true while the 5s login loader runs
  let statsExpanded = false;     // state expand/collapse statistik
  let upcomingPage = 0;          // halaman aktif daftar kegiatan mendatang

  // State form kegiatan
  let formTags = [];             // id tag terpilih
  let formLocation = null;       // { name, lat, lng } | null
  let formTimeline = [];         // [{ time, title, location }]
  let tlDragFrom = null;         // source index while reordering timeline

  // Leaflet
  let leafletMap = null, leafletMarker = null, mapTempLocation = null;
  let mapTarget = { type: 'event' };   // sasaran lokasi: { type:'event' } | { type:'timeline', index }

  // Receipt 3D view (default: menghadap lurus depan, zoom sedikit kecil)
  const view3d = { rx: 0, ry: 0, scale: 0.85, dragging: false, lx: 0, ly: 0 };

  /* ---------- Element refs ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    themeToggle: $('themeToggle'), iconSun: $('iconSun'), iconMoon: $('iconMoon'),
    loginBtn: $('loginBtn'), userBox: $('userBox'), userLabel: $('userLabel'),
    userAvatar: $('userAvatar'), logoutBtn: $('logoutBtn'),
    monthTitle: $('monthTitle'), todayBtn: $('todayBtn'), countdownText: $('countdownText'),
    prevBtn: $('prevBtn'), nextBtn: $('nextBtn'),
    weekdayRow: $('weekdayRow'), calendarGrid: $('calendarGrid'),
    upcomingList: $('upcomingList'), upcomingCount: $('upcomingCount'), upcomingPager: $('upcomingPager'),
    statsGrid: $('statsGrid'), statsFade: $('statsFade'), statsToggleWrap: $('statsToggleWrap'),
    calendarCard: $('calendarCard'), sidebar: $('sidebar'),
    openReceiptBtn: $('openReceiptBtn'),
    // receipt modal
    receiptModal: $('receiptModal'), receiptStage: $('receiptStage'), receiptArea: $('receiptArea'), receiptFront: $('receiptFront'), receiptBody: $('receiptBody'), downloadReceiptBtn: $('downloadReceiptBtn'),
    // login modal
    loginModal: $('loginModal'), loginForm: $('loginForm'), loginError: $('loginError'),
    loginLoading: $('loginLoading'), loginRing: $('loginRing'), loginRingPct: $('loginRingPct'),
    // day modal
    dayModal: $('dayModal'), dayModalDone: $('dayModalDone'),
    dayModalTitle: $('dayModalTitle'), dayModalList: $('dayModalList'),
    dayModalFooter: $('dayModalFooter'),
    // event modal
    eventModal: $('eventModal'), eventForm: $('eventForm'),
    eventModalTitle: $('eventModalTitle'), eventId: $('eventId'),
    eventTitle: $('eventTitle'), eventDate: $('eventDate'), eventDesc: $('eventDesc'),
    tagPicker: $('tagPicker'), locationBox: $('locationBox'), timelineEditor: $('timelineEditor'),
    manageTagsBtn: $('manageTagsBtn'), addTimelineBtn: $('addTimelineBtn'),
    // tag modal
    tagModal: $('tagModal'), tagManagerList: $('tagManagerList'),
    newTagName: $('newTagName'), addTagBtn: $('addTagBtn'),
    // map modal
    mapModal: $('mapModal'), mapSearch: $('mapSearch'), mapSearchBtn: $('mapSearchBtn'),
    mapSelInfo: $('mapSelInfo'), useLocationBtn: $('useLocationBtn'),
    toastContainer: $('toastContainer'),
  };

  /* ---------- Util tanggal ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  function dateKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function todayKey() { return dateKey(new Date()); }
  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function mondayIndex(jsDay) { return (jsDay + 6) % 7; }

  /* ---------- Util umum ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function haversineKm(a, b) {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  const fmtNum = (n) => (n % 1 === 0 ? n : Number(n.toFixed(1)));
  // Force a 24-hour HH:MM mask (no AM/PM). Clamps hours 0-23, minutes 0-59.
  function maskTime(v) {
    let d = String(v).replace(/\D/g, '').slice(0, 4);
    if (d.length >= 2) d = String(Math.min(23, parseInt(d.slice(0, 2), 10))).padStart(2, '0') + d.slice(2);
    if (d.length >= 4) d = d.slice(0, 2) + String(Math.min(59, parseInt(d.slice(2, 4), 10))).padStart(2, '0');
    return d.length <= 2 ? d : d.slice(0, 2) + ':' + d.slice(2);
  }
  const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

  /* ---------- Helper kegiatan ---------- */
  function timelineTimes(ev) {
    return (ev.timeline || []).map((i) => i.time).filter(Boolean).sort();
  }
  function eventStart(ev) {
    return timelineTimes(ev)[0] || '';
  }
  function eventDurationHours(ev) {
    const t = timelineTimes(ev);
    if (t.length < 2) return 0;
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    return Math.max(0, (toMin(t[t.length - 1]) - toMin(t[0])) / 60);
  }
  // Calendar indicator weight: number of timeline items; counts as 1 if no timeline.
  function eventUnitCount(ev) {
    const n = (ev.timeline || []).length;
    return n > 0 ? n : 1;
  }
  // Finished/past event: past date, or today with last timeline time already passed.
  function isPastEvent(ev) {
    const tKey = todayKey();
    if (ev.date < tKey) return true;
    if (ev.date > tKey) return false;
    const times = timelineTimes(ev);
    if (!times.length) return false;
    const now = new Date();
    const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return times[times.length - 1] < nowHM;
  }
  function sortEvents(a, b) {
    const ta = eventStart(a), tb = eventStart(b);
    if (ta && tb) return ta.localeCompare(tb) || a.title.localeCompare(b.title);
    if (ta) return -1;
    if (tb) return 1;
    return a.title.localeCompare(b.title);
  }
  function eventsForDate(key) {
    return events.filter((e) => e.date === key).sort(sortEvents);
  }
  function kulinerTagIds() {
    return new Set(tags.filter((t) => t.kuliner).map((t) => t.id));
  }
  function locationKey(loc) {
    return `${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}`;
  }

  /* ---------- Storage (localStorage cache + remote sync) ---------- */
  const API_URL = '/api/state';
  let remoteOn = false;     // is the shared DB reachable?
  let dirty = false;        // local changes not yet pushed
  let pushTimer = null;

  function loadEvents() {
    try { events = JSON.parse(localStorage.getItem(KEY_EVENTS)) || []; }
    catch { events = []; }
  }
  function saveEvents() { localStorage.setItem(KEY_EVENTS, JSON.stringify(events)); schedulePush(); }

  function loadTags() {
    try {
      const raw = localStorage.getItem(KEY_TAGS);
      tags = raw ? JSON.parse(raw) : DEFAULT_TAGS.slice();
    } catch { tags = DEFAULT_TAGS.slice(); }
  }
  function saveTags() { localStorage.setItem(KEY_TAGS, JSON.stringify(tags)); schedulePush(); }

  function schedulePush() {
    dirty = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushRemote, 600);
  }
  // Push the shared state to the DB (only signed-in users may write).
  async function pushRemote() {
    if (!currentUser) return;
    try {
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tgbls-code': USERS[currentUser] },
        body: JSON.stringify({ events, tags }),
      });
      if (r.ok) { remoteOn = true; dirty = false; }
    } catch { remoteOn = false; }
  }
  // Pull the shared state from the DB and adopt it (falls back to cache offline).
  async function pullRemote() {
    try {
      const r = await fetch(API_URL, { cache: 'no-store' });
      if (!r.ok) { remoteOn = false; return; }
      const data = await r.json();
      remoteOn = true;
      const remoteEvents = Array.isArray(data.events) ? data.events : [];
      const remoteTags = Array.isArray(data.tags) ? data.tags : [];
      // first run migration: DB empty but we have local data → upload it
      if (remoteEvents.length === 0 && events.length > 0) {
        if (currentUser) pushRemote();
      } else {
        events = remoteEvents;
        localStorage.setItem(KEY_EVENTS, JSON.stringify(events));
      }
      if (remoteTags.length) {
        tags = remoteTags;
        localStorage.setItem(KEY_TAGS, JSON.stringify(tags));
      }
      renderAll();
      if (!el.dayModal.classList.contains('hidden')) renderDay();
    } catch { remoteOn = false; }
  }
  // Refresh from the DB, but not while editing or with unsaved local changes.
  function maybePull() {
    if (dirty) return;
    if (!el.eventModal.classList.contains('hidden')) return;
    pullRemote();
  }

  /* ---------- Tema ---------- */
  function applyTheme(theme) {
    const dark = theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    el.iconSun.classList.toggle('hidden', !dark);
    el.iconMoon.classList.toggle('hidden', dark);
    localStorage.setItem(KEY_THEME, theme);
  }
  function initTheme() {
    let theme = localStorage.getItem(KEY_THEME);
    if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(theme);
  }

  /* ---------- Sesi / Auth ---------- */
  function initSession() {
    const u = localStorage.getItem(KEY_SESSION);
    currentUser = (u === 'L' || u === 'F') ? u : null;
    renderAuth();
  }
  function renderAuth() {
    const loggedIn = !!currentUser;
    const isFany = currentUser === 'F';
    document.documentElement.dataset.user = currentUser || '';
    document.documentElement.classList.toggle('user-fany', isFany);

    if (isFany) {
      // Fany has a fixed pink theme — force light base and hide the toggle
      document.documentElement.classList.remove('dark');
      el.themeToggle.classList.add('hidden');
    } else {
      // Restore the saved theme preference for Luigi / logged-out
      const saved = localStorage.getItem(KEY_THEME);
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = saved ? saved === 'dark' : prefersDark;
      document.documentElement.classList.toggle('dark', isDark);
      el.iconSun.classList.toggle('hidden', !isDark);
      el.iconMoon.classList.toggle('hidden', isDark);
      el.themeToggle.classList.remove('hidden');
    }

    el.loginBtn.classList.toggle('hidden', loggedIn);
    el.userBox.classList.toggle('hidden', !loggedIn);
    el.userBox.classList.toggle('flex', loggedIn);
    if (loggedIn) {
      el.userLabel.textContent = NAMES[currentUser] || currentUser;
      el.userAvatar.textContent = currentUser;
    }
  }
  function login(user) {
    currentUser = user;
    localStorage.setItem(KEY_SESSION, user);
    renderAuth();
  }
  function logout() {
    currentUser = null;
    localStorage.removeItem(KEY_SESSION);
    renderAuth();
    toast('Signed out');
  }

  /* ---------- Render kalender ---------- */
  function renderWeekdays() {
    el.weekdayRow.innerHTML = WEEKDAYS_SHORT.map((d) => `<div class="py-2">${d}</div>`).join('');
  }

  function renderCalendar() {
    el.monthTitle.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const lead = mondayIndex(firstOfMonth.getDay());
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7;
    const tKey = todayKey();

    let html = '';
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - lead + 1;
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;

      if (!inMonth) {
        html += `<div class="aspect-square rounded-xl border border-transparent"></div>`;
        continue;
      }

      const key = dateKey(new Date(viewYear, viewMonth, dayNum));
      const isToday = key === tKey;
      const hasEvent = !!eventForDate(key);

      const numClass = isToday
        ? 'flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white dark:bg-white dark:text-neutral-900'
        : 'flex h-7 w-7 items-center justify-center text-sm font-semibold text-neutral-600 dark:text-neutral-300';

      const ringClass = isToday
        ? 'border-neutral-900 dark:border-white'
        : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700';

      // event indicator — a single dot when the date has an event (lifted up a bit)
      const dot = hasEvent
        ? '<span data-ad class="mb-1.5 h-1.5 w-1.5 rounded-full bg-neutral-900 dark:bg-white sm:mb-2"></span>'
        : '<span class="mb-1.5 h-1.5 w-1.5 sm:mb-2"></span>';

      html += `
        <button type="button" data-day="${key}" ${isToday ? 'data-today' : ''}
          class="group aspect-square flex flex-col items-center justify-between rounded-xl border ${ringClass} bg-white p-1.5 text-center transition hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50 sm:p-2">
          <span ${isToday ? 'data-af' : ''} class="${numClass}">${dayNum}</span>
          ${dot}
        </button>`;
    }

    el.calendarGrid.innerHTML = html;
  }

  function upcomingItemHTML(ev) {
    const d = parseKey(ev.date);
    const past = ev.date < todayKey();
    const times = timelineTimes(ev);
    const range = times.length >= 2 ? `${times[0]} - ${times[times.length - 1]}` : (times[0] || '');
    return `
      <button type="button" data-day="${ev.date}"
        class="flex w-full items-stretch gap-3 rounded-xl border border-neutral-200 p-3 text-left transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50 ${past ? 'opacity-50' : ''}">
        <div class="flex w-11 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-100 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          <span class="text-base font-bold leading-none">${d.getDate()}</span>
          <span class="mt-0.5 text-[10px] font-medium uppercase">${MONTHS[d.getMonth()].slice(0, 3)}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">${escapeHtml(ev.title)}</p>
          <div class="mt-0.5 flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span class="truncate">${WEEKDAYS_LONG[d.getDay()]}</span>
            ${range ? `<span class="flex-shrink-0 tabular-nums">${range}</span>` : ''}
          </div>
        </div>
        <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center self-start rounded-full border border-neutral-300 text-[10px] font-bold text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">${ev.owner}</span>
      </button>`;
  }

  // Samakan tinggi sidebar dengan tinggi card kalender (khusus layar lebar).
  function syncSidebarHeight(isLarge) {
    if (isLarge && el.calendarCard) {
      el.sidebar.style.height = el.calendarCard.offsetHeight + 'px';
    } else {
      el.sidebar.style.height = '';
    }
  }

  function renderUpcoming() {
    const prefix = `${viewYear}-${pad(viewMonth + 1)}-`;
    const list = events
      .filter((e) => e.date.startsWith(prefix))
      .sort((a, b) => (a.date === b.date ? sortEvents(a, b) : a.date.localeCompare(b.date)));

    el.upcomingCount.textContent = String(list.length);

    const isLarge = window.matchMedia('(min-width: 1024px)').matches;
    syncSidebarHeight(isLarge);

    const hidePager = () => { el.upcomingPager.classList.add('hidden'); el.upcomingPager.classList.remove('flex'); el.upcomingPager.innerHTML = ''; };

    if (!list.length) {
      el.upcomingList.innerHTML = `
        <div class="rounded-xl border border-dashed border-neutral-200 p-6 text-center dark:border-neutral-800">
          <p class="text-sm text-neutral-500 dark:text-neutral-400">No events this month.</p>
        </div>`;
      hidePager();
      return;
    }

    // Maks 4 event per halaman; bila card pendek, daftar bisa di-scroll (lihat class lg:overflow-y-auto).
    const PER_PAGE = 4;
    const totalPages = Math.ceil(list.length / PER_PAGE);
    upcomingPage = Math.min(Math.max(upcomingPage, 0), totalPages - 1);
    const start = upcomingPage * PER_PAGE;
    el.upcomingList.innerHTML = list.slice(start, start + PER_PAGE).map(upcomingItemHTML).join('');

    if (totalPages <= 1) { hidePager(); return; }

    el.upcomingPager.classList.remove('hidden');
    el.upcomingPager.classList.add('flex');
    const navBtn = (data, dis, svg) =>
      `<button type="button" ${data} ${dis ? 'disabled' : ''}
        class="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 transition hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-neutral-800 dark:hover:bg-neutral-800">${svg}</button>`;
    el.upcomingPager.innerHTML = `
      ${navBtn('data-up-prev', upcomingPage === 0, '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>')}
      <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">${upcomingPage + 1} / ${totalPages}</span>
      ${navBtn('data-up-next', upcomingPage === totalPages - 1, '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>')}`;
  }

  /* ---------- Statistik tahunan ---------- */
  function photosForYear(year) {
    let all = [];
    try { all = JSON.parse(localStorage.getItem(KEY_PHOTOS)) || []; } catch { all = []; }
    return all.filter((p) => p.eventDate && p.eventDate.startsWith(year + '-')).length;
  }
  function getYearStats(year) {
    const yr = events.filter((e) => e.date.startsWith(year + '-'));
    const kSet = kulinerTagIds();
    const withLoc = yr.filter((e) => e.location);
    return {
      count: yr.length,
      days: new Set(yr.map((e) => e.date)).size,
      hours: yr.reduce((s, e) => s + eventDurationHours(e), 0),
      kuliner: yr.filter((e) => (e.tags || []).some((id) => kSet.has(id))).length,
      places: new Set(withLoc.map((e) => locationKey(e.location))).size,
      distance: withLoc.reduce((s, e) => s + haversineKm(HOME, e.location), 0),
      photos: photosForYear(year),
    };
  }

  function renderStats() {
    const st = getYearStats(String(viewYear));
    // angka + unit sebagai suffix kecil
    const unit = (n, u) => `${n}<span class="ml-0.5 text-sm font-semibold text-neutral-400 dark:text-neutral-500">${u}</span>`;

    const STATS = [
      { label: 'Days', value: st.days,
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />' },
      { label: 'Hours', value: unit(fmtNum(st.hours), 'hrs'),
        icon: '<circle cx="12" cy="12" r="9" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 3" />' },
      { label: 'Photos', value: st.photos,
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />' },
      { label: 'Places', value: st.places,
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4-4-7-7.5-7-10.5a7 7 0 0 1 14 0c0 3-3 6.5-7 10.5z" /><circle cx="12" cy="10" r="2.5" />' },
      { label: 'Food', value: st.kuliner,
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />' },
      { label: 'Distance', value: unit(fmtNum(st.distance), 'km'),
        icon: '<circle cx="5" cy="18" r="3" /><circle cx="19" cy="6" r="3" /><path stroke-linecap="round" d="M19 9V15a2 2 0 0 1-2 2H8m0 0 3-3m-3 3 3 3" />' },
    ];

    el.statsGrid.innerHTML = STATS.map((s) => `
      <div class="flex flex-col gap-1.5 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/50">
        <div class="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500">
          <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">${s.icon}</svg>
          <span class="text-[11px] leading-tight text-neutral-500 dark:text-neutral-400">${s.label}</span>
        </div>
        <p class="text-xl font-bold leading-none">${s.value}</p>
      </div>`).join('');

    // collapsed: show top rows + a peek via the gradient (height = STATS_COLLAPSED_HEIGHT)
    el.statsGrid.style.maxHeight = statsExpanded ? '' : STATS_COLLAPSED_HEIGHT;
    el.statsGrid.classList.toggle('overflow-hidden', !statsExpanded);
    el.statsFade.classList.toggle('hidden', statsExpanded);

    const chevDown = '<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>';
    const chevUp = '<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>';
    el.statsToggleWrap.innerHTML = `
      <button type="button" id="statsToggleBtn"
        class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-white">
        ${statsExpanded ? 'Show less ' + chevUp : 'Show all ' + chevDown}
      </button>`;
  }

  /* ---------- Struk statistik (receipt) ---------- */
  function renderReceipt() {
    const year = viewYear;
    const st = getYearStats(String(year));
    const now = new Date();
    const printed = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const ref = `TGBLS-${year}-${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

    const rows = [
      ['Total Days', st.days],
      ['Total Hours', fmtNum(st.hours) + ' hrs'],
      ['Total Photos', st.photos],
      ['Total Places', st.places],
      ['Total Food', st.kuliner],
      ['Total Distance', fmtNum(st.distance) + ' km'],
    ];
    const line = (l, v) => `
      <div class="flex items-end gap-1">
        <span class="whitespace-nowrap">${l}</span>
        <span class="mb-[3px] flex-1 border-b border-dotted border-neutral-400"></span>
        <span class="whitespace-nowrap font-bold">${v}</span>
      </div>`;

    el.receiptBody.innerHTML = `
      <div class="text-center">
        <p class="text-xl font-bold tracking-[0.25em]">E-RECEIPT</p>
        <p class="text-[11px] tracking-wide">Made by <span class="font-sans font-bold tracking-tight">tigabelas.</span></p>
      </div>
      <div class="my-3 border-t border-dashed border-neutral-400"></div>
      <p class="text-center text-[11px] leading-relaxed">
         ${year} YEAR STATISTICS<br/>Date: ${printed}
      </p>
      <div class="my-3 border-t border-double border-neutral-500"></div>
      <div class="space-y-1.5 text-[13px]">${rows.map((r) => line(r[0], r[1])).join('')}</div>
      <div class="my-3 border-t border-dashed border-neutral-400"></div>
      <div class="text-[13px]">${line('TOTAL EVENTS', st.count)}</div>
      <div class="my-3 border-t border-double border-neutral-500"></div>
      <p class="text-center text-[11px] tracking-[0.2em]">*** THANK YOU ***</p>
      <div class="receipt-barcode mx-auto mt-3 w-3/4"></div>
      <p class="mt-1.5 text-center text-[10px] tracking-[0.25em]">${ref}</p>`;
  }
  function applyReceiptTransform() {
    el.receiptArea.style.transform =
      `rotateX(${view3d.rx}deg) rotateY(${view3d.ry}deg) scale(${view3d.scale})`;
  }
  function resetReceiptView() {
    view3d.rx = 0; view3d.ry = 0; view3d.scale = 0.95;
    applyReceiptTransform();
  }
  function openReceipt() {
    renderReceipt();
    resetReceiptView();
    openModal(el.receiptModal);
  }
  async function downloadReceipt() {
    if (typeof html2canvas !== 'function') { toast('Download module not loaded'); return; }
    const btn = el.downloadReceiptBtn;
    btn.disabled = true;
    const savedTransform = el.receiptArea.style.transform;
    el.receiptArea.style.transform = 'none';   // rata supaya hasil unduh bersih
    try {
      const canvas = await html2canvas(el.receiptFront, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `struk-statistik-tigabelas-${viewYear}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('Receipt downloaded');
    } catch {
      toast('Failed to download receipt');
    } finally {
      el.receiptArea.style.transform = savedTransform;
      btn.disabled = false;
    }
  }

  /* ---------- Countdown ---------- */
  // The nearest event whose date is today or later.
  function nearestEvent() {
    const tKey = todayKey();
    return events
      .filter((e) => e.date >= tKey)
      .sort((a, b) => (a.date === b.date ? sortEvents(a, b) : a.date.localeCompare(b.date)))[0] || null;
  }
  function tickCountdown() {
    const ev = nearestEvent();
    if (!ev) { el.countdownText.textContent = 'No upcoming events'; return; }

    // Event day (hari H): show how many timeline items are available.
    if (ev.date === todayKey()) {
      el.countdownText.textContent = `${eventUnitCount(ev)} Event is Available`;
      return;
    }

    // Future date: live countdown to its start time.
    const [h, m] = (eventStart(ev) || '00:00').split(':').map(Number);
    const d = parseKey(ev.date); d.setHours(h, m, 0, 0);
    const remaining = Math.max(0, d.getTime() - Date.now());
    const s = Math.floor(remaining / 1000);
    const days = Math.floor(s / 86400);
    const hrs = Math.floor((s % 86400) / 3600);
    const min = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    el.countdownText.textContent = days > 0
      ? `${days}:${pad(hrs)}:${pad(min)}:${pad(sec)}`
      : `${pad(hrs)}:${pad(min)}:${pad(sec)}`;
  }
  function renderCountdown() { tickCountdown(); }

  function renderAll() {
    renderCalendar();
    renderStats();
    renderUpcoming();   // setelah kalender & stats agar pengukuran tinggi akurat
    renderCountdown();
  }

  /* ---------- Modal helpers ---------- */
  const MODALS = () => [el.loginModal, el.dayModal, el.eventModal, el.tagModal, el.mapModal, el.receiptModal];
  function anyModalOpen() { return MODALS().some((m) => !m.classList.contains('hidden')); }
  function openModal(m) {
    m.classList.remove('hidden'); m.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(m) {
    m.classList.add('hidden'); m.classList.remove('flex');
    if (!anyModalOpen()) document.body.style.overflow = '';
  }
  function closeModalSmart(m) {
    closeModal(m);
    if (m === el.tagModal) { renderTagPicker(); renderAll(); }
  }
  function closeTopModal() {
    for (const m of [el.receiptModal, el.mapModal, el.tagModal, el.eventModal, el.dayModal, el.loginModal]) {
      if (!m.classList.contains('hidden')) { closeModalSmart(m); break; }
    }
  }

  /* ---------- Login modal ---------- */
  const otpBoxes = () => Array.from(document.querySelectorAll('.otp-box'));
  function clearOtp() { otpBoxes().forEach((b) => { b.value = ''; }); }
  function focusFirstOtp() { const f = otpBoxes()[0]; if (f) f.focus(); }
  function attemptLogin() {
    if (loggingIn) return;
    const code = otpBoxes().map((b) => b.value).join('');
    if (code.length < 4) return;
    // determine the user from the code (1305 → Luigi/L, 1304 → Fany/F)
    const user = Object.keys(USERS).find((k) => USERS[k] === code);
    if (user) {
      startLoginLoading(user);
    } else {
      el.loginError.classList.remove('hidden');
      clearOtp();
      focusFirstOtp();
    }
  }
  // Show a 5-second circular progress, then complete login.
  function startLoginLoading(user) {
    loggingIn = true;
    el.loginForm.classList.add('hidden');
    el.loginLoading.classList.remove('hidden');
    el.loginLoading.classList.add('flex');
    const C = 125.66, dur = 700, t0 = performance.now();
    (function frame(now) {
      // cancelled (modal closed)?
      if (el.loginModal.classList.contains('hidden')) { loggingIn = false; resetLoginView(); return; }
      const p = Math.min(1, (now - t0) / dur);
      el.loginRing.style.strokeDashoffset = String(C * (1 - p));
      el.loginRingPct.textContent = Math.round(p * 100) + '%';
      if (p < 1) { requestAnimationFrame(frame); return; }
      loggingIn = false;
      login(user);
      closeModal(el.loginModal);
      toast(`Signed in as ${NAMES[user] || user}`);
      resetLoginView();
      if (!el.dayModal.classList.contains('hidden')) renderDay();
    })(t0);
  }
  function resetLoginView() {
    el.loginLoading.classList.add('hidden');
    el.loginLoading.classList.remove('flex');
    el.loginForm.classList.remove('hidden');
    el.loginRing.style.strokeDashoffset = '125.66';
    el.loginRingPct.textContent = '0%';
  }
  function openLogin() {
    loggingIn = false;
    resetLoginView();
    clearOtp();
    el.loginError.classList.add('hidden');
    openModal(el.loginModal);
    setTimeout(focusFirstOtp, 50);
  }

  /* ---------- Day modal (one event per date, detail-first) ---------- */
  function eventForDate(key) {
    return events.find((e) => e.date === key) || null;
  }
  function openDay(key) {
    selectedDate = key;
    const d = parseKey(key);
    el.dayModalTitle.textContent = `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    renderDay();
    openModal(el.dayModal);
  }
  function renderDay() {
    const ev = eventForDate(selectedDate);
    el.dayModalDone.classList.toggle('hidden', !(ev && isPastEvent(ev)));
    renderDayBody(ev);
    renderDayFooter(ev);
  }

  function tagNameById(id) {
    const t = tags.find((x) => x.id === id);
    return t ? t.name : null;
  }

  function renderDayBody(ev) {
    if (!ev) {
      el.dayModalList.innerHTML = `
        <div class="rounded-xl border border-dashed border-neutral-200 p-8 text-center dark:border-neutral-800">
          <p class="text-sm text-neutral-500 dark:text-neutral-400">No event on this day.</p>
        </div>`;
      return;
    }
    el.dayModalList.innerHTML = eventDetailHTML(ev);
  }

  // Full detail of one event (shown directly inside the day modal).
  function eventDetailHTML(ev) {
    const tagChips = (ev.tags || []).map((id) => {
      const n = tagNameById(id);
      return n ? `<span class="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">${escapeHtml(n)}</span>` : '';
    }).join('') || '<span class="text-sm text-neutral-400">No tags</span>';

    const times = timelineTimes(ev);
    const range = times.length >= 2 ? `${times[0]} – ${times[times.length - 1]}` : (times[0] || '—');
    const dur = eventDurationHours(ev);
    const durTxt = dur ? `${fmtNum(dur)} hrs` : '—';
    const loc = ev.location
      ? `${escapeHtml(ev.location.name)} · ~${haversineKm(HOME, ev.location).toFixed(1)} km from ${HOME.name}` : '—';

    const tl = (ev.timeline || []).filter((i) => i.title || i.time);
    const timeline = tl.length ? `
      <ol>
        ${tl.map((i, idx) => {
          const last = idx === tl.length - 1;
          const locLine = i.location
            ? `<div class="mt-0.5 flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500"><svg class="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4-4-7-7.5-7-10.5a7 7 0 0 1 14 0c0 3-3 6.5-7 10.5z"/><circle cx="12" cy="10" r="2"/></svg><span class="truncate">${escapeHtml(i.location.name)}</span></div>`
            : '';
          return `
          <li class="flex gap-3">
            <div class="flex flex-col items-center">
              <span class="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500"></span>
              ${last ? '' : '<span class="w-px flex-1 bg-neutral-200 dark:bg-neutral-700"></span>'}
            </div>
            <div class="${last ? '' : 'pb-3'} min-w-0 text-sm">
              <div>${i.time ? `<span class="mr-1.5 font-semibold tabular-nums">${i.time}</span>` : ''}<span class="text-neutral-600 dark:text-neutral-300">${escapeHtml(i.title || '')}</span></div>
              ${locLine}
            </div>
          </li>`;
        }).join('')}
      </ol>` : '<p class="text-sm text-neutral-400">No timeline.</p>';

    const desc = ev.desc
      ? `<p class="whitespace-pre-line text-sm text-neutral-600 dark:text-neutral-300">${escapeHtml(ev.desc)}</p>`
      : '<p class="text-sm text-neutral-400">—</p>';

    const infoRow = (label, val) =>
      `<div class="flex justify-between gap-3 text-sm"><span class="flex-shrink-0 text-neutral-500 dark:text-neutral-400">${label}</span><span class="min-w-0 text-right font-medium">${val}</span></div>`;

    return `
      <div class="space-y-4">
        <div class="flex items-start justify-between gap-2">
          <h4 class="min-w-0 flex-1 break-words text-lg font-bold leading-snug">${escapeHtml(ev.title)}</h4>
          <span class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[10px] font-bold text-neutral-500 dark:border-neutral-700 dark:text-neutral-400" title="Created by ${ev.owner}">${ev.owner}</span>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">${tagChips}</div>
        <div class="space-y-2 rounded-xl border border-neutral-200 p-3.5 dark:border-neutral-800">
          ${infoRow('Time', range)}
          ${infoRow('Duration', durTxt)}
          ${infoRow('Location', loc)}
        </div>
        <div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Timeline</p>
          ${timeline}
        </div>
        <div>
          <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Notes</p>
          ${desc}
        </div>
      </div>`;
  }

  function renderDayFooter(ev) {
    // fill button gets a transparent border so it matches the outline button's box exactly
    const editBtn = `<button type="button" data-edit="${ev ? ev.id : ''}"
        class="tgbls-fill flex flex-1 items-center justify-center gap-2 rounded-xl border border-transparent bg-clip-padding bg-neutral-900 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4v16h16v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </button>`;
    const delBtn = (cls) => `<button type="button" data-delete="${ev ? ev.id : ''}"
        class="${cls} items-center justify-center gap-2 rounded-xl border border-neutral-200 py-2.5 text-sm font-semibold transition hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        Delete
      </button>`;

    let html;
    if (!ev) {
      // empty date → add (logged in) or login hint
      html = currentUser
        ? `<button type="button" id="addEventBtn"
            class="tgbls-fill flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-clip-padding bg-neutral-900 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 5v14M5 12h14" /></svg>
            Add Event
          </button>`
        : '';
    } else if (!currentUser) {
      html = '';
    } else if (isPastEvent(ev)) {
      html = delBtn('flex w-full');               // finished event → delete only
    } else {
      html = delBtn('flex flex-1') + editBtn;      // delete (left) + edit (right)
    }
    el.dayModalFooter.innerHTML = html;
    el.dayModalFooter.classList.toggle('hidden', !html);
  }
  function loginHintBtn() {
    return `<button type="button" id="footerLoginBtn"
        class="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 py-2.5 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path stroke-linecap="round" d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        Sign in to add / edit
      </button>`;
  }

  /* ---------- Event form: pickers ---------- */
  function renderTagPicker() {
    if (!tags.length) {
      el.tagPicker.innerHTML = `<p class="text-xs text-neutral-400">No tags yet. Click "Manage tags".</p>`;
      return;
    }
    el.tagPicker.innerHTML = tags.map((t) => {
      const on = formTags.includes(t.id);
      return `<button type="button" data-tag-toggle="${t.id}" ${on ? 'data-af' : ''}
        class="rounded-full border px-3 py-1 text-xs font-semibold transition ${on
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
          : 'border-neutral-300 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300'}">
        ${escapeHtml(t.name)}</button>`;
    }).join('');
  }

  function renderLocationBox() {
    if (formLocation) {
      const dist = haversineKm(HOME, formLocation).toFixed(1);
      el.locationBox.innerHTML = `
        <div class="flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2.5 dark:border-neutral-700">
          <svg class="h-4 w-4 flex-shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4-4-7-7.5-7-10.5a7 7 0 0 1 14 0c0 3-3 6.5-7 10.5z"/><circle cx="12" cy="10" r="2.5"/></svg>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">${escapeHtml(formLocation.name)}</p>
            <p class="text-xs text-neutral-400">~${dist} km from ${HOME.name}</p>
          </div>
          <button type="button" id="changeLocationBtn" class="flex-shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800">Change</button>
          <button type="button" id="clearLocationBtn" title="Remove location" class="flex-shrink-0 rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>`;
    } else {
      el.locationBox.innerHTML = `
        <button type="button" id="pickLocationBtn"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 py-2.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4-4-7-7.5-7-10.5a7 7 0 0 1 14 0c0 3-3 6.5-7 10.5z"/><circle cx="12" cy="10" r="2.5"/></svg>
          Pick location on map
        </button>`;
    }
  }

  function renderTimelineEditor() {
    if (!formTimeline.length) {
      el.timelineEditor.innerHTML = `<p class="text-xs text-neutral-400">No items yet. Add activity steps with their times.</p>`;
      return;
    }
    el.timelineEditor.innerHTML = formTimeline.map((it, i) => `
      <div class="tl-row rounded-lg border border-neutral-200 p-2 dark:border-neutral-700" data-index="${i}">
        <div class="flex items-center gap-2">
          <button type="button" data-tl-drag draggable="true" title="Drag to reorder"
            class="flex h-8 w-5 flex-shrink-0 cursor-grab items-center justify-center text-neutral-400 transition hover:text-neutral-700 active:cursor-grabbing dark:hover:text-neutral-200">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>
          </button>
          <input type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${escapeHtml(it.time || '')}" data-tl-field="time"
            class="w-[4.5rem] flex-shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-center text-sm tabular-nums outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white" />
          <input type="text" value="${escapeHtml(it.title || '')}" data-tl-field="title" placeholder="Activity" maxlength="80"
            class="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white" />
          <button type="button" data-tl-remove="${i}" title="Remove item"
            class="flex-shrink-0 rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <button type="button" data-tl-loc="${i}"
            class="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-2 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
            <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4-4-7-7.5-7-10.5a7 7 0 0 1 14 0c0 3-3 6.5-7 10.5z"/><circle cx="12" cy="10" r="2.5"/></svg>
            <span class="truncate">${it.location ? escapeHtml(it.location.name) : 'Add location (optional)'}</span>
          </button>
          ${it.location ? `<button type="button" data-tl-loc-clear="${i}" title="Remove location"
            class="flex-shrink-0 rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
          </button>` : ''}
        </div>
      </div>`).join('');
  }
  function addTimelineRow() {
    formTimeline.push({ time: '', title: '', location: null });
    renderTimelineEditor();
    const rows = el.timelineEditor.querySelectorAll('.tl-row');
    const last = rows[rows.length - 1];
    if (last) last.querySelector('[data-tl-field="time"]').focus();
  }
  function removeTimelineRow(i) {
    formTimeline.splice(i, 1);
    renderTimelineEditor();
  }

  /* ---------- Event form modal ---------- */
  function openEventForm(eventId) {
    el.eventForm.reset();
    if (eventId) {
      const ev = events.find((e) => e.id === eventId);
      if (!ev) return;
      el.eventModalTitle.textContent = 'Edit Event';
      el.eventId.value = ev.id;
      el.eventTitle.value = ev.title;
      el.eventDate.value = ev.date;
      el.eventDesc.value = ev.desc || '';
      formTags = (ev.tags || []).slice();
      formLocation = ev.location ? { ...ev.location } : null;
      formTimeline = (ev.timeline || []).map((i) => ({ ...i }));
    } else {
      el.eventModalTitle.textContent = 'Add Event';
      el.eventId.value = '';
      el.eventDate.value = selectedDate || todayKey();
      formTags = [];
      formLocation = null;
      formTimeline = [];
    }
    renderTagPicker();
    renderLocationBox();
    renderTimelineEditor();
    openModal(el.eventModal);
    setTimeout(() => el.eventTitle.focus(), 50);
  }

  function handleEventSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const title = el.eventTitle.value.trim();
    const date = el.eventDate.value;
    if (!title || !date) return;

    const id = el.eventId.value;
    // one event per date
    if (events.some((x) => x.date === date && x.id !== id)) { toast('This date already has an event'); return; }

    const desc = el.eventDesc.value.trim();
    const timeline = formTimeline
      .map((i) => ({ time: maskTime(i.time || ''), title: (i.title || '').trim(), location: i.location || null }))
      .filter((i) => i.title || i.time);
    // Times must be a full 24h HH:MM if provided.
    if (timeline.some((i) => i.time && !isValidTime(i.time))) { toast('Use a full 24h time (HH:MM)'); return; }
    // Timeline may be empty, but if used it needs at least 2 items.
    if (timeline.length === 1) { toast('Timeline needs at least 2 items (or leave empty)'); return; }
    const payload = {
      title, date, desc,
      tags: formTags.slice(),
      location: formLocation,
      timeline,
    };

    if (id) {
      const ev = events.find((x) => x.id === id);
      if (ev) { Object.assign(ev, payload); toast('Event updated'); }
    } else {
      events.push({ id: uid(), owner: currentUser, ...payload });
      toast('Event added');
    }

    saveEvents();
    closeModal(el.eventModal);

    selectedDate = date;
    const d = parseKey(date);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderAll();

    if (!el.dayModal.classList.contains('hidden')) openDay(date);
  }

  function deleteEvent(id) {
    const ev = events.find((x) => x.id === id);
    if (!ev) return;
    if (!window.confirm(`Delete event "${ev.title}"?`)) return;
    events = events.filter((x) => x.id !== id);
    saveEvents();
    renderAll();
    if (!el.dayModal.classList.contains('hidden')) renderDay();
    toast('Event deleted');
  }

  /* ---------- Tag manager ---------- */
  function openTagModal() {
    el.newTagName.value = '';
    renderTagManager();
    openModal(el.tagModal);
  }
  function renderTagManager() {
    el.tagManagerList.innerHTML = tags.length ? tags.map((t, i) => `
      <div class="flex items-center gap-2" data-tag-index="${i}">
        <input type="text" value="${escapeHtml(t.name)}" data-tag-name maxlength="24"
          class="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-white" />
        <button type="button" data-tag-kuliner title="Count as food" ${t.kuliner ? 'data-af' : ''}
          class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border transition ${t.kuliner
            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
            : 'border-neutral-300 text-neutral-400 dark:border-neutral-700 dark:text-neutral-500'}">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" /></svg>
        </button>
        <button type="button" data-tag-del title="Remove tag"
          class="flex-shrink-0 rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>`).join('') : `<p class="text-sm text-neutral-400">No tags yet.</p>`;
  }
  function addTag() {
    const name = el.newTagName.value.trim();
    if (!name) return;
    tags.push({ id: uid(), name, kuliner: false });
    saveTags();
    el.newTagName.value = '';
    renderTagManager();
    el.newTagName.focus();
  }

  /* ---------- Peta (Leaflet) ---------- */
  function fixLeafletIcons() {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }
  function ensureMap() {
    if (leafletMap) return;
    fixLeafletIcons();
    leafletMap = L.map('mapContainer').setView([HOME.lat, HOME.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(leafletMap);
    leafletMap.on('click', (e) => setMapPoint(e.latlng.lat, e.latlng.lng));
  }
  function setMapPoint(lat, lng, name) {
    mapTempLocation = { lat, lng, name: name || null };
    if (!leafletMarker) leafletMarker = L.marker([lat, lng]).addTo(leafletMap);
    else leafletMarker.setLatLng([lat, lng]);
    updateMapInfo();
    if (!name) reverseGeocode(lat, lng);
  }
  function updateMapInfo() {
    if (!mapTempLocation) {
      el.mapSelInfo.textContent = 'Click on the map or search to pick a location.';
      return;
    }
    const dist = haversineKm(HOME, mapTempLocation).toFixed(1);
    el.mapSelInfo.textContent = `${mapTempLocation.name || 'Loading location name…'} · ~${dist} km from ${HOME.name}`;
  }
  async function reverseGeocode(lat, lng) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { Accept: 'application/json' } });
      const j = await r.json();
      if (mapTempLocation && mapTempLocation.lat === lat && mapTempLocation.lng === lng) {
        mapTempLocation.name = j.display_name
          ? j.display_name.split(',').slice(0, 2).join(',').trim()
          : `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        updateMapInfo();
      }
    } catch {
      if (mapTempLocation) { mapTempLocation.name = `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`; updateMapInfo(); }
    }
  }
  async function searchPlace(q) {
    if (!q.trim()) return;
    el.mapSearchBtn.disabled = true;
    el.mapSearchBtn.textContent = '…';
    /* label restored in finally */
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } });
      const j = await r.json();
      if (j && j[0]) {
        const lat = parseFloat(j[0].lat), lng = parseFloat(j[0].lon);
        const name = j[0].display_name ? j[0].display_name.split(',').slice(0, 2).join(',').trim() : q;
        leafletMap.setView([lat, lng], 15);
        setMapPoint(lat, lng, name);
      } else {
        toast('Location not found');
      }
    } catch {
      toast('Search failed');
    } finally {
      el.mapSearchBtn.disabled = false;
      el.mapSearchBtn.textContent = 'Search';
    }
  }
  function openMapModal(target) {
    mapTarget = target || { type: 'event' };
    const existing = mapTarget.type === 'timeline'
      ? (formTimeline[mapTarget.index] && formTimeline[mapTarget.index].location)
      : formLocation;
    mapTempLocation = existing ? { ...existing } : null;
    el.mapSearch.value = '';
    openModal(el.mapModal);
    setTimeout(() => {
      ensureMap();
      leafletMap.invalidateSize();
      if (mapTempLocation) {
        if (!leafletMarker) leafletMarker = L.marker([mapTempLocation.lat, mapTempLocation.lng]).addTo(leafletMap);
        else leafletMarker.setLatLng([mapTempLocation.lat, mapTempLocation.lng]);
        leafletMap.setView([mapTempLocation.lat, mapTempLocation.lng], 14);
      } else {
        if (leafletMarker) { leafletMap.removeLayer(leafletMarker); leafletMarker = null; }
        leafletMap.setView([HOME.lat, HOME.lng], 12);
      }
      updateMapInfo();
    }, 80);
  }
  function applyMapLocation() {
    if (!mapTempLocation) { toast('No location selected'); return; }
    const loc = {
      name: mapTempLocation.name || `Location (${mapTempLocation.lat.toFixed(4)}, ${mapTempLocation.lng.toFixed(4)})`,
      lat: mapTempLocation.lat,
      lng: mapTempLocation.lng,
    };
    if (mapTarget.type === 'timeline' && formTimeline[mapTarget.index]) {
      formTimeline[mapTarget.index].location = loc;
      renderTimelineEditor();
    } else {
      formLocation = loc;
      renderLocationBox();
    }
    closeModal(el.mapModal);
  }

  /* ---------- Toast ---------- */
  function toast(message) {
    const t = document.createElement('div');
    t.className = 'toast pointer-events-auto rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-neutral-900';
    t.dataset.af = '';
    t.textContent = message;
    el.toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.3s, transform 0.3s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(() => t.remove(), 300);
    }, 2200);
  }

  /* ---------- Navigasi bulan ---------- */
  function changeMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    else if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    upcomingPage = 0;
    renderAll();
  }
  function goToday() {
    const now = new Date();
    upcomingPage = 0;
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    renderAll();
  }

  /* ---------- Event listeners ---------- */
  function bindEvents() {
    el.themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      applyTheme(isDark ? 'light' : 'dark');
    });

    el.loginBtn.addEventListener('click', openLogin);
    el.logoutBtn.addEventListener('click', logout);

    el.prevBtn.addEventListener('click', () => changeMonth(-1));
    el.nextBtn.addEventListener('click', () => changeMonth(1));
    el.todayBtn.addEventListener('click', goToday);

    // tombol statis di dalam form / modal
    el.manageTagsBtn.addEventListener('click', openTagModal);
    el.addTimelineBtn.addEventListener('click', addTimelineRow);
    el.addTagBtn.addEventListener('click', addTag);
    el.newTagName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } });
    el.mapSearchBtn.addEventListener('click', () => searchPlace(el.mapSearch.value));
    el.mapSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchPlace(el.mapSearch.value); } });
    el.useLocationBtn.addEventListener('click', applyMapLocation);
    el.openReceiptBtn.addEventListener('click', openReceipt);
    el.downloadReceiptBtn.addEventListener('click', downloadReceipt);

    // timeline reorder (drag the grip handle)
    el.timelineEditor.addEventListener('dragstart', (e) => {
      const h = e.target.closest('[data-tl-drag]');
      if (!h) return;
      const row = h.closest('.tl-row');
      tlDragFrom = Number(row.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(tlDragFrom)); } catch {}
      row.classList.add('opacity-40');
    });
    el.timelineEditor.addEventListener('dragover', (e) => { if (tlDragFrom !== null) e.preventDefault(); });
    el.timelineEditor.addEventListener('drop', (e) => {
      if (tlDragFrom === null) return;
      e.preventDefault();
      const row = e.target.closest('.tl-row');
      const item = formTimeline.splice(tlDragFrom, 1)[0];
      let insertAt;
      if (!row) {
        insertAt = formTimeline.length;
      } else {
        const t = Number(row.dataset.index);
        insertAt = tlDragFrom < t ? t - 1 : t;
      }
      formTimeline.splice(insertAt, 0, item);
      tlDragFrom = null;
      renderTimelineEditor();
    });
    el.timelineEditor.addEventListener('dragend', () => {
      if (tlDragFrom !== null) { tlDragFrom = null; renderTimelineEditor(); }
    });

    // interaksi 3D struk: seret untuk putar, scroll untuk zoom, klik dua kali reset
    el.receiptStage.addEventListener('pointerdown', (e) => {
      view3d.dragging = true; view3d.lx = e.clientX; view3d.ly = e.clientY;
      el.receiptStage.style.cursor = 'grabbing';
      el.receiptStage.setPointerCapture(e.pointerId);
    });
    el.receiptStage.addEventListener('pointermove', (e) => {
      if (!view3d.dragging) return;
      view3d.ry += (e.clientX - view3d.lx) * 0.4;
      view3d.rx -= (e.clientY - view3d.ly) * 0.4;
      view3d.rx = Math.max(-80, Math.min(80, view3d.rx));
      view3d.lx = e.clientX; view3d.ly = e.clientY;
      applyReceiptTransform();
    });
    const endDrag = () => { view3d.dragging = false; el.receiptStage.style.cursor = 'grab'; };
    el.receiptStage.addEventListener('pointerup', endDrag);
    el.receiptStage.addEventListener('pointercancel', endDrag);
    el.receiptStage.addEventListener('pointerleave', endDrag);
    el.receiptStage.addEventListener('wheel', (e) => {
      e.preventDefault();
      view3d.scale *= e.deltaY < 0 ? 1.1 : 0.9;
      view3d.scale = Math.max(0.4, Math.min(3.5, view3d.scale));
      applyReceiptTransform();
    }, { passive: false });
    el.receiptStage.addEventListener('dblclick', resetReceiptView);

    // kotak kode OTP: auto-maju, backspace mundur, auto-submit saat 4 terisi
    const boxes = otpBoxes();
    boxes.forEach((box, idx) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g, '').slice(0, 1);
        el.loginError.classList.add('hidden');
        if (box.value && idx < boxes.length - 1) boxes[idx + 1].focus();
        if (boxes.every((b) => b.value)) attemptLogin();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) { boxes[idx - 1].focus(); }
      });
    });

    // login submit (tombol Masuk)
    el.loginForm.addEventListener('submit', (e) => { e.preventDefault(); attemptLogin(); });

    el.eventForm.addEventListener('submit', handleEventSubmit);

    // klik global (delegation)
    document.addEventListener('click', (e) => {
      const dayBtn = e.target.closest('[data-day]');
      if (dayBtn) { openDay(dayBtn.dataset.day); return; }

      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) { openEventForm(editBtn.dataset.edit); return; }

      const delBtn = e.target.closest('[data-delete]');
      if (delBtn) { deleteEvent(delBtn.dataset.delete); return; }

      // statistik (expand mengubah ruang → hitung ulang paginasi)
      if (e.target.closest('#statsToggleBtn')) { statsExpanded = !statsExpanded; renderStats(); renderUpcoming(); return; }

      // paginasi kegiatan mendatang
      if (e.target.closest('[data-up-prev]')) { if (upcomingPage > 0) { upcomingPage--; renderUpcoming(); } return; }
      if (e.target.closest('[data-up-next]')) { upcomingPage++; renderUpcoming(); return; }

      // day modal footer
      if (e.target.closest('#addEventBtn')) { openEventForm(null); return; }
      if (e.target.closest('#footerLoginBtn')) { closeModal(el.dayModal); openLogin(); return; }

      // tag picker (form)
      const tg = e.target.closest('[data-tag-toggle]');
      if (tg) {
        const id = tg.dataset.tagToggle;
        const idx = formTags.indexOf(id);
        if (idx >= 0) formTags.splice(idx, 1); else formTags.push(id);
        renderTagPicker();
        return;
      }

      // timeline
      const tlDel = e.target.closest('[data-tl-remove]');
      if (tlDel) { removeTimelineRow(Number(tlDel.dataset.tlRemove)); return; }
      const tlLocClear = e.target.closest('[data-tl-loc-clear]');
      if (tlLocClear) { const i = Number(tlLocClear.dataset.tlLocClear); if (formTimeline[i]) { formTimeline[i].location = null; renderTimelineEditor(); } return; }
      const tlLoc = e.target.closest('[data-tl-loc]');
      if (tlLoc) { openMapModal({ type: 'timeline', index: Number(tlLoc.dataset.tlLoc) }); return; }

      // lokasi event
      if (e.target.closest('#pickLocationBtn') || e.target.closest('#changeLocationBtn')) { openMapModal({ type: 'event' }); return; }
      if (e.target.closest('#clearLocationBtn')) { formLocation = null; renderLocationBox(); return; }

      // tag manager
      const tDel = e.target.closest('[data-tag-del]');
      if (tDel) {
        const i = Number(tDel.closest('[data-tag-index]').dataset.tagIndex);
        tags.splice(i, 1); saveTags(); renderTagManager();
        return;
      }
      const tKul = e.target.closest('[data-tag-kuliner]');
      if (tKul) {
        const i = Number(tKul.closest('[data-tag-index]').dataset.tagIndex);
        tags[i].kuliner = !tags[i].kuliner; saveTags(); renderTagManager();
        return;
      }

      // tutup modal
      const closeBtn = e.target.closest('[data-close-modal]');
      if (closeBtn) { const m = closeBtn.closest('.modal-root'); if (m) closeModalSmart(m); return; }
      if (e.target.classList.contains('modal-backdrop')) { closeModalSmart(e.target.parentElement); return; }
    });

    // edit nama tag / field timeline (tanpa re-render agar fokus tidak hilang)
    document.addEventListener('input', (e) => {
      const nameEl = e.target.closest('[data-tag-name]');
      if (nameEl) {
        const i = Number(nameEl.closest('[data-tag-index]').dataset.tagIndex);
        tags[i].name = nameEl.value;
        saveTags();
        return;
      }
      const tlField = e.target.closest('[data-tl-field]');
      if (tlField) {
        const row = tlField.closest('.tl-row');
        const i = Number(row.dataset.index);
        if (tlField.dataset.tlField === 'time') tlField.value = maskTime(tlField.value);  // enforce 24h
        if (formTimeline[i]) formTimeline[i][tlField.dataset.tlField] = tlField.value;
      }
    });

    // ESC menutup modal teratas
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeTopModal();
    });

    // hitung ulang tinggi sidebar & paginasi saat ukuran layar berubah
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderUpcoming, 150);
    });
    // setelah semua aset (Tailwind/font) selesai → ukuran final, hitung ulang
    window.addEventListener('load', () => renderUpcoming());

    // sinkron data bersama: segarkan saat tab difokuskan & berkala
    window.addEventListener('focus', maybePull);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) maybePull(); });
    setInterval(maybePull, 30000);
  }

  /* ---------- Init ---------- */
  function init() {
    initTheme();
    loadEvents();
    loadTags();
    initSession();
    goToday();
    renderWeekdays();
    bindEvents();
    setInterval(tickCountdown, 1000);   // countdown bergerak tiap detik
    // layout final (tinggi kalender) baru pasti setelah render pertama → hitung ulang paginasi
    setTimeout(renderUpcoming, 80);
    pullRemote();                        // ambil data terbaru dari DB (fallback ke cache bila offline)
  }

  document.addEventListener('DOMContentLoaded', init);
})();
