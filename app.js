/* ============================================================
   Tigabelas — Kalender Kegiatan
   Vanilla JS · localStorage · tanpa build step
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Konstanta ---------- */
  const KEY_EVENTS = 'tigabelas.events.v1';
  const KEY_MOVIES = 'tigabelas.movies.v1';
  const KEY_THEME = 'tigabelas.theme';

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


  /* ---------- State ---------- */
  let viewYear, viewMonth;       // bulan yang sedang ditampilkan (month 0-indexed)
  let events = [];               // daftar kegiatan
  let currentTheme = 'dark';     // 'dark' | 'pink'
  let selectedDate = null;       // 'YYYY-MM-DD' untuk day modal
  let upcomingPage = 0;          // halaman aktif daftar kegiatan mendatang
  let currentView = 'calendar';  // 'calendar' | 'movies'

  let movies = [];
  let moviesPage = 0;
  function getMoviesPerPage() {
    if (window.matchMedia('(min-width: 1280px)').matches) return 18;
    if (window.matchMedia('(min-width: 1024px)').matches) return 15;
    if (window.matchMedia('(min-width: 640px)').matches) return 12;
    return 6;
  }

  // State form kegiatan
  let formPhoto = null;          // photo data URL (max 1 photo)
  let detailUploadTargetId = null; // target event ID when uploading photo from detail view

  /* ---------- Element refs ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    themeToggleBtn: $('themeToggleBtn'),
    themeToggleIcon: $('themeToggleIcon'),
    navTabsContainer: $('navTabsContainer'),
    navActiveIndicator: $('navActiveIndicator'),
    monthTitle: $('monthTitle'), todayBtn: $('todayBtn'), countdownText: $('countdownText'),
    prevBtn: $('prevBtn'), nextBtn: $('nextBtn'),
    weekdayRow: $('weekdayRow'), calendarGrid: $('calendarGrid'),
    upcomingList: $('upcomingList'), upcomingCount: $('upcomingCount'), upcomingPager: $('upcomingPager'),
    statsDaysProgress: $('statsDaysProgress'), statsGrid: $('statsGrid'),
    calendarCard: $('calendarCard'), moviesCard: $('moviesCard'), foodCard: $('foodCard'),
    moviesGrid: $('moviesGrid'), moviesProgressSubtitle: $('moviesProgressSubtitle'),
    moviesPager: $('moviesPager'),
    sidebar: $('sidebar'),
    openReceiptBtn: $('openReceiptBtn'),
    // movie controls & modal
    moviesHeaderTitleBlock: $('moviesHeaderTitleBlock'),
    moviesHeaderSearchBlock: $('moviesHeaderSearchBlock'),
    watchedMovieSearchInput: $('watchedMovieSearchInput'),
    clearWatchedSearchBtn: $('clearWatchedSearchBtn'),
    movieSearchIconSvg: $('movieSearchIconSvg'),
    movieSearchCloseSvg: $('movieSearchCloseSvg'),
    openAddMovieBtn: $('openAddMovieBtn'),
    openMovieSearchBtn: $('openMovieSearchBtn'),
    addMovieModal: $('addMovieModal'),
    addMovieForm: $('addMovieForm'),
    movieSearchBlock: $('movieSearchBlock'),
    movieSearchInput: $('movieSearchInput'),
    movieSearchBtn: $('movieSearchBtn'),
    movieSearchResults: $('movieSearchResults'),
    selectedMovieCard: $('selectedMovieCard'),
    selectedMoviePoster: $('selectedMoviePoster'),
    selectedMovieTitle: $('selectedMovieTitle'),
    selectedMovieYear: $('selectedMovieYear'),
    clearSelectedMovieBtn: $('clearSelectedMovieBtn'),
    movieDateInput: $('movieDateInput'),
    movieSelectedTitle: $('movieSelectedTitle'),
    // movie detail & rate modal
    movieDetailModal: $('movieDetailModal'),
    detailMovieId: $('detailMovieId'),
    detailMoviePoster: $('detailMoviePoster'),
    detailMovieTitle: $('detailMovieTitle'),
    detailMovieTitleWrap: $('detailMovieTitleWrap'),
    detailMovieMeta: $('detailMovieMeta'),
    detailRatingInput: $('detailRatingInput'),
    editMovieRatingBtn: $('editMovieRatingBtn'),
    ratingViewMode: $('ratingViewMode'),
    ratingEditMode: $('ratingEditMode'),
    movieRatingSlider: $('movieRatingSlider'),
    ratingSliderBubble: $('ratingSliderBubble'),
    closeRatingEditBtn: $('closeRatingEditBtn'),
    movieTicketInput: $('movieTicketInput'),
    movieTicketBox: $('movieTicketBox'),
    movieTicketEmptyState: $('movieTicketEmptyState'),
    movieTicketPreview: $('movieTicketPreview'),
    movieTicketOverlay: $('movieTicketOverlay'),
    movieTicketZoomOverlay: $('movieTicketZoomOverlay'),
    saveMovieRatingBtn: $('saveMovieRatingBtn'),
    deleteMovieBtn: $('deleteMovieBtn'),
    // image lightbox
    imageLightboxModal: $('imageLightboxModal'),
    lightboxImage: $('lightboxImage'),
    // day modal
    dayModal: $('dayModal'),
    dayModalTitle: $('dayModalTitle'), dayModalList: $('dayModalList'),
    dayModalFooter: $('dayModalFooter'), detailPhotoInput: $('detailPhotoInput'),
    // event modal
    eventModal: $('eventModal'), eventForm: $('eventForm'),
    eventModalTitle: $('eventModalTitle'), eventId: $('eventId'),
    eventTitle: $('eventTitle'), eventDate: $('eventDate'), eventDesc: $('eventDesc'),
    eventPhotoSection: $('eventPhotoSection'),
    eventPhotoInput: $('eventPhotoInput'), uploadPhotoBtn: $('uploadPhotoBtn'),
    photoPreviewContainer: $('photoPreviewContainer'), eventPhotoPreview: $('eventPhotoPreview'),
    photoCropViewport: $('photoCropViewport'), photoZoomControls: $('photoZoomControls'),
    photoZoomSlider: $('photoZoomSlider'), photoResetBtn: $('photoResetBtn'),
    removePhotoBtn: $('removePhotoBtn'),
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

  /* ---------- Util umum ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function compressImage(file, maxDim = 1200, quality = 0.6) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  // Finished/past event: past date
  function isPastEvent(ev) {
    return ev.date < todayKey();
  }
  function sortEvents(a, b) {
    return (a.title || '').localeCompare(b.title || '');
  }
  function eventsForDate(key) {
    return events.filter((e) => e.date === key).sort(sortEvents);
  }


  /* ---------- Storage (localStorage cache + remote sync) ---------- */
  const API_URL = '/api/state';
  let remoteOn = false;     // is the shared DB reachable?
  let dirty = false;        // local changes not yet pushed
  let pushTimer = null;

  function deduplicateMovies(list) {
    const seen = new Set();
    const result = [];
    for (const m of list) {
      if (!m || !m.title) continue;
      const key = m.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        result.push(m);
      }
    }
    return result;
  }

  const SAMPLE_MOVIES_LIST = [
    { title: 'Inception', year: '2010', rating: '9.0', date: '2026-07-10' },
    { title: 'Interstellar', year: '2014', rating: '9.5', date: '2026-07-14' },
    { title: 'Spider-Man: Across the Spider-Verse', year: '2023', rating: '9.0', date: '2026-07-18' },
    { title: 'Oppenheimer', year: '2023', rating: '8.5', date: '2026-07-22' },
    { title: 'The Dark Knight', year: '2008', rating: '10.0', date: '2026-07-25' },
    { title: 'Dune: Part Two', year: '2024', rating: '9.0', date: '2026-07-28' },
    { title: 'Everything Everywhere All at Once', year: '2022', rating: '8.5', date: '2026-08-01' },
    { title: 'Spirited Away', year: '2001', rating: '9.5', date: '2026-08-03' },
    { title: 'La La Land', year: '2016', rating: '8.0', date: '2026-08-05' },
    { title: 'Parasite', year: '2019', rating: '9.0', date: '2026-08-07' },
    { title: 'Guardians of the Galaxy Vol. 3', year: '2023', rating: '8.5', date: '2026-08-09' },
    { title: 'Whiplash', year: '2014', rating: '9.0', date: '2026-08-11' },
    { title: 'Coco', year: '2017', rating: '8.5', date: '2026-08-12' },
    { title: 'Your Name.', year: '2016', rating: '9.0', date: '2026-08-14' },
    { title: 'Avatar: The Way of Water', year: '2022', rating: '7.5', date: '2026-08-15' },
    { title: 'The Batman', year: '2022', rating: '8.0', date: '2026-08-16' },
    { title: 'Inside Out 2', year: '2024', rating: '8.5', date: '2026-08-17' },
    { title: 'Top Gun: Maverick', year: '2022', rating: '8.5', date: '2026-08-18' },
    { title: 'Suzume', year: '2022', rating: '8.0', date: '2026-08-19' },
    { title: 'Spider-Man: Into the Spider-Verse', year: '2018', rating: '9.5', date: '2026-08-20' },
  ];

  function ensureSampleMovies() {
    const existingTitles = new Set(movies.map((m) => (m.title || '').trim().toLowerCase()));
    let added = false;
    SAMPLE_MOVIES_LIST.forEach((item, idx) => {
      const lower = item.title.toLowerCase();
      if (!existingTitles.has(lower)) {
        movies.push({
          id: `sample_mov_${idx + 1}_${Date.now().toString(36)}`,
          title: item.title,
          year: item.year,
          poster: '',
          ticket: '',
          rating: item.rating,
          date: item.date,
        });
        existingTitles.add(lower);
        added = true;
      }
    });
    if (added) {
      movies = deduplicateMovies(movies);
      saveMovies();
    }
  }

  function loadEvents() {
    try { events = JSON.parse(localStorage.getItem(KEY_EVENTS)) || []; }
    catch { events = []; }
    try {
      const cached = JSON.parse(localStorage.getItem(KEY_MOVIES));
      if (Array.isArray(cached)) {
        movies = deduplicateMovies(cached.filter((m) => m && m.id && !LEGACY_DUMMY_IDS.has(m.id)));
      } else {
        movies = [];
      }
    } catch {
      movies = [];
    }
    ensureSampleMovies();
  }
  function saveEvents() {
    try {
      localStorage.setItem(KEY_EVENTS, JSON.stringify(events));
    } catch (err) {
      console.warn('LocalStorage write warning:', err);
    }
    schedulePush();
  }
  function saveMovies() {
    try {
      localStorage.setItem(KEY_MOVIES, JSON.stringify(movies));
    } catch (err) {
      console.warn('LocalStorage movies write warning:', err);
    }
    schedulePush();
  }

  function schedulePush() {
    dirty = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushRemote, 600);
  }
  // Push the shared state to the DB (anyone can write now).
  async function pushRemote() {
    try {
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, tags: [], movies }),
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
      if (remoteEvents.length === 0 && events.length > 0) {
        pushRemote();
      } else {
        events = remoteEvents;
        try { localStorage.setItem(KEY_EVENTS, JSON.stringify(events)); } catch {}
      }

      if (Array.isArray(data.movies)) {
        const cleanRemote = data.movies.filter((m) => m && m.id);
        if (cleanRemote.length > 0) {
          movies = deduplicateMovies(cleanRemote);
          try { localStorage.setItem(KEY_MOVIES, JSON.stringify(movies)); } catch {}
        } else {
          ensureSampleMovies();
          if (movies.length > 0) pushRemote();
        }
      } else {
        ensureSampleMovies();
        if (movies.length > 0) pushRemote();
      }

      renderAll();
      if (!el.dayModal.classList.contains('hidden')) renderDay();
    } catch { remoteOn = false; }
  }
  // Refresh from the DB, but not while editing or with unsaved local changes.
  function maybePull() {
    if (dirty) return;
    if (!el.eventModal.classList.contains('hidden')) return;
    if (el.addMovieModal && !el.addMovieModal.classList.contains('hidden')) return;
    pullRemote();
  }

  /* ---------- Tema (Theme) ---------- */
  function initTheme() {
    const t = localStorage.getItem(KEY_THEME);
    currentTheme = (t === 'pink' || t === 'dark') ? t : 'dark';
    applyTheme();
  }
  function applyTheme() {
    const isPink = currentTheme === 'pink';
    document.documentElement.classList.toggle('user-fany', isPink);
    document.documentElement.classList.toggle('dark', !isPink);
    
    // Update button elements
    if (isPink) {
      el.themeToggleIcon.innerHTML = `<svg class="h-5 w-5 text-pink-500 fill-pink-500" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
    } else {
      el.themeToggleIcon.innerHTML = `<svg class="h-5 w-5 text-neutral-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c.132 0 .263 0 .393.007a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 3z"/></svg>`;
    }
  }
  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'pink' : 'dark';
    localStorage.setItem(KEY_THEME, currentTheme);
    applyTheme();
    if (!el.dayModal.classList.contains('hidden')) renderDay();
  }

  /* ---------- Render kalender ---------- */
  function renderWeekdays() {
    el.weekdayRow.innerHTML = WEEKDAYS_SHORT.map((d) => `<div class="py-2">${d}</div>`).join('');
  }

  function renderCalendar() {
    el.monthTitle.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
    
    const now = new Date();
    const isCurrentMonthView = viewYear === now.getFullYear() && viewMonth === now.getMonth();
    
    if (el.todayBtn) {
      el.todayBtn.textContent = String(now.getDate());
      if (isCurrentMonthView) {
        el.todayBtn.disabled = true;
        el.todayBtn.className = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-bold text-neutral-500 cursor-default pointer-events-none dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400';
      } else {
        el.todayBtn.disabled = false;
        el.todayBtn.className = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-transparent text-xs font-bold text-neutral-800 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-800 cursor-pointer';
      }
    }

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const lead = firstOfMonth.getDay();
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
          class="group aspect-square flex flex-col items-center justify-between rounded-xl border ${ringClass} bg-white p-1.5 text-center transition-all duration-200 ${isToday ? '' : 'hover:rounded-full'} hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/50 sm:p-2">
          <span ${isToday ? 'data-af' : ''} class="${numClass}">${dayNum}</span>
          ${dot}
        </button>`;
    }

    el.calendarGrid.innerHTML = html;
  }

  function upcomingItemHTML(ev) {
    const d = parseKey(ev.date);
    const past = isPastEvent(ev);
    const innerOpacityCls = past ? 'opacity-40 transition-opacity group-hover:opacity-80' : '';
    const badgeCls = past
      ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
      : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
    const titleCls = past
      ? 'text-neutral-500 dark:text-neutral-400 font-medium'
      : 'text-neutral-900 dark:text-white font-semibold';

    return `
      <button type="button" data-day="${ev.date}"
        class="group flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/50">
        <div class="flex w-11 flex-shrink-0 flex-col items-center justify-center rounded-lg py-1 ${badgeCls} ${innerOpacityCls}">
          <span class="text-base font-bold leading-none">${d.getDate()}</span>
          <span class="mt-0.5 text-[10px] font-medium uppercase">${MONTHS[d.getMonth()].slice(0, 3)}</span>
        </div>
        <div class="min-w-0 flex-1 ${innerOpacityCls}">
          <p class="truncate text-sm ${titleCls}">${escapeHtml(ev.title)}</p>
          <div class="mt-0.5 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span class="truncate">${WEEKDAYS_LONG[d.getDay()]}</span>
          </div>
        </div>
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
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

    const upcomingActiveCount = list.filter((e) => !isPastEvent(e)).length;
    el.upcomingCount.textContent = String(upcomingActiveCount);

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

    // Maks 4 event per halaman
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
  function getYearStats(year) {
    const yr = events.filter((e) => e.date.startsWith(year + '-'));
    return {
      count: yr.length,
      days: new Set(yr.map((e) => e.date)).size,
      kuliner: '—',
      movies: String(movies.length),
    };
  }

  function isLeapYear(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function getYearProgress(year) {
    const y = Number(year);
    const totalDays = isLeapYear(y) ? 366 : 365;
    const now = new Date();
    const currentYr = now.getFullYear();

    if (y < currentYr) return { passed: totalDays, total: totalDays, pct: 100 };
    if (y > currentYr) return { passed: 0, total: totalDays, pct: 0 };

    const startOfYear = new Date(y, 0, 1);
    const diffMs = now.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diffMs / 86400000) + 1;
    const passed = Math.min(totalDays, Math.max(0, dayOfYear));
    const pct = Math.min(100, Math.max(0, (passed / totalDays) * 100));
    return { passed, total: totalDays, pct };
  }

  function renderStats() {
    const st = getYearStats(String(viewYear));
    const yrProgress = getYearProgress(viewYear);
    const pctFormatted = yrProgress.pct >= 1 ? yrProgress.pct.toFixed(1) : yrProgress.pct.toFixed(2);
    const actualPct = Math.max(yrProgress.pct, yrProgress.passed > 0 ? 1 : 0);
    const basePct = Math.min(90, actualPct);
    const greenPct = actualPct > 90 ? actualPct - 90 : 0;

    if (el.statsDaysProgress) {
      el.statsDaysProgress.innerHTML = `
        <button type="button" data-category-page="calendar"
          class="group relative w-full cursor-pointer rounded-xl bg-neutral-50 p-4 text-left transition dark:bg-neutral-800/50 hover:bg-neutral-100/90 dark:hover:bg-neutral-800">
          <!-- Pop up tooltip on hover (below progress bar) -->
          <div class="pointer-events-none absolute -bottom-11 left-1/2 -translate-x-1/2 z-20 flex scale-95 items-center gap-1.5 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 dark:bg-neutral-100 dark:text-neutral-900">
            <span>${st.count} Total Events</span>
            <div class="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-neutral-900 dark:bg-neutral-100"></div>
          </div>

          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500">
              <svg class="h-4 w-4 flex-shrink-0 transition group-hover:text-neutral-900 dark:group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
              </svg>
              <span class="text-[11px] font-medium leading-tight text-neutral-500 transition group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-white">Days</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-neutral-900 dark:text-white">${pctFormatted}%</span>
              <svg class="h-3.5 w-3.5 text-neutral-400 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
          <div class="relative h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/70 dark:bg-neutral-700/60">
            <!-- 0% to 90% theme segment -->
            <div class="tgbls-fill absolute inset-y-0 left-0 bg-neutral-900 transition-all duration-500 dark:bg-white" data-af style="width: ${basePct}%"></div>
            <!-- >90% green segment -->
            ${greenPct > 0 ? `<div class="absolute inset-y-0 bg-emerald-500 transition-all duration-500" style="left: 90%; width: ${greenPct}%"></div>` : ''}
            <div class="pointer-events-none absolute inset-0 z-10">
              <span class="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-white dark:bg-neutral-900" style="left: 10%"></span>
              <span class="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-white dark:bg-neutral-900" style="left: 50%"></span>
              <span class="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-white dark:bg-neutral-900" style="left: 90%"></span>
            </div>
          </div>
          <div class="relative mt-2 h-3.5 text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
            <span class="absolute -translate-x-1/2" style="left: 10%">10%</span>
            <span class="absolute -translate-x-1/2" style="left: 50%">50%</span>
            <span class="absolute -translate-x-1/2" style="left: 90%">90%</span>
          </div>
        </button>`;
    }

    const STATS = [
      { id: 'movies', label: 'Movies', value: st.movies, target: 15,
        icon: '<rect x="2.5" y="4.5" width="19" height="15" rx="2" /><path stroke-linecap="round" d="M7 4.5v15M17 4.5v15M2.5 9.5H7M2.5 14.5H7M17 9.5h4.5M17 14.5h4.5" />' },
      { id: 'food', label: 'Food', value: st.kuliner, target: 25,
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />' },
    ];

    el.statsGrid.innerHTML = STATS.map((s) => `
      <button type="button" data-category-page="${s.id}"
        class="group flex flex-col gap-1.5 rounded-xl bg-neutral-50 p-3 text-left transition hover:bg-neutral-100/90 dark:bg-neutral-800/50 dark:hover:bg-neutral-800">
        <div class="flex items-center justify-between text-neutral-400 dark:text-neutral-500">
          <div class="flex items-center gap-1.5">
            <svg class="h-4 w-4 flex-shrink-0 transition group-hover:text-neutral-900 dark:group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">${s.icon}</svg>
            <span class="text-[11px] leading-tight text-neutral-500 transition group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-white">${s.label}</span>
          </div>
          <svg class="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
        </div>
        <p class="text-xl font-bold leading-none">${s.value}<span class="text-xs font-semibold text-neutral-400 dark:text-neutral-500">/${s.target}</span></p>
      </button>`).join('');
  }

  /* ---------- Movies View ---------- */
  let isWatchedSearchActive = false;
  let watchedMovieQuery = '';

  function toggleWatchedMovieSearch(forceOpen) {
    isWatchedSearchActive = (typeof forceOpen === 'boolean') ? forceOpen : !isWatchedSearchActive;

    if (el.moviesHeaderSearchBlock) {
      el.moviesHeaderSearchBlock.classList.toggle('hidden', !isWatchedSearchActive);
      el.moviesHeaderSearchBlock.classList.toggle('flex', isWatchedSearchActive);
    }
    if (el.openAddMovieBtn) {
      el.openAddMovieBtn.classList.toggle('hidden', isWatchedSearchActive);
    }
    if (el.moviesPager) {
      el.moviesPager.classList.toggle('hidden', isWatchedSearchActive);
    }
    if (el.movieSearchIconSvg) el.movieSearchIconSvg.classList.toggle('hidden', isWatchedSearchActive);
    if (el.movieSearchCloseSvg) el.movieSearchCloseSvg.classList.toggle('hidden', !isWatchedSearchActive);

    if (isWatchedSearchActive) {
      if (el.watchedMovieSearchInput) {
        el.watchedMovieSearchInput.focus();
      }
    } else {
      watchedMovieQuery = '';
      if (el.watchedMovieSearchInput) el.watchedMovieSearchInput.value = '';
      if (el.clearWatchedSearchBtn) el.clearWatchedSearchBtn.classList.add('hidden');
      moviesPage = 0;
      renderMoviesGrid();
    }
  }

  function formatShortMovieDate(dateStr) {
    if (!dateStr) return '';
    if (/^\d{4}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d} ${months[m]} ${y}`;
      }
    }
    return dateStr;
  }

  function splitTitleFor2Lines(title) {
    if (!title) return { line1: '', line2Full: '', line2Short: '', isTwoLines: false };
    const t = title.trim();
    if (t.length <= 15) {
      return { line1: t, line2Full: '', line2Short: '', isTwoLines: false };
    }

    let breakIdx = 15;
    const spaceIdx = t.lastIndexOf(' ', 16);
    if (spaceIdx >= 6) {
      breakIdx = spaceIdx;
    }

    const line1 = t.slice(0, breakIdx).trim();
    const line2Full = t.slice(breakIdx).trim();
    const isLong = line2Full.length > 15;
    const line2Short = isLong ? `${line2Full.slice(0, 12).trimEnd()}...` : line2Full;

    return { line1, line2Full, line2Short, isTwoLines: true };
  }

  function renderMoviesGrid() {
    if (!el.moviesGrid) return;

    const filtered = watchedMovieQuery
      ? movies.filter((m) => {
          const q = watchedMovieQuery.toLowerCase();
          const title = (m.title || '').toLowerCase();
          const year = String(m.year || '');
          return title.includes(q) || year.includes(q);
        })
      : movies;

    const perPage = getMoviesPerPage();
    const totalPages = Math.ceil(filtered.length / perPage) || 1;
    moviesPage = Math.max(0, Math.min(moviesPage, totalPages - 1));

    if (el.moviesProgressSubtitle) {
      if (watchedMovieQuery) {
        el.moviesProgressSubtitle.textContent = `${filtered.length} found`;
      } else {
        el.moviesProgressSubtitle.textContent = totalPages > 1 ? `${moviesPage + 1} of ${totalPages}` : `${moviesPage + 1}`;
      }
    }

    const pageMovies = filtered.slice(moviesPage * perPage, (moviesPage + 1) * perPage);

    if (!pageMovies.length) {
      el.moviesGrid.innerHTML = `
        <div class="col-span-full rounded-2xl border border-dashed border-neutral-200 p-8 text-center dark:border-neutral-800">
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            ${watchedMovieQuery ? `No watched movie found matching "${escapeHtml(watchedMovieQuery)}".` : 'No movies added yet.'}
          </p>
        </div>`;
    } else {
      el.moviesGrid.innerHTML = pageMovies.map((m) => {
        const formattedDate = formatShortMovieDate(m.date);
        const hasTicket = Boolean(m.ticket);

        const visualBox = hasTicket ? `
          <div data-movie-cover class="group relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md dark:border-neutral-800">
            <img src="${m.ticket}" alt="${escapeHtml(m.title)}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            <div class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10"></div>
          </div>` : `
          <div data-movie-cover class="group relative aspect-square w-full overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-neutral-100/90 flex flex-col items-center justify-center text-neutral-400 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-neutral-400 group-hover:bg-neutral-200/60 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-500 dark:group-hover:border-neutral-600 dark:group-hover:bg-neutral-800 shadow-sm">
            <svg class="h-6 w-6 stroke-current transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10"></div>
          </div>`;

        const split = splitTitleFor2Lines(m.title);
        const titleHtml = split.isTwoLines ? `
          <div class="movie-card-title text-center text-xs font-semibold text-neutral-800 dark:text-neutral-200" title="${escapeHtml(m.title)}">
            <div class="movie-title-line1">${escapeHtml(split.line1)}</div>
            <div class="movie-title-line2">
              <span class="movie-line2-span" data-short="${escapeHtml(split.line2Short)}" data-full="${escapeHtml(split.line2Full)}">${escapeHtml(split.line2Short)}</span>
            </div>
          </div>` : `
          <div class="movie-card-title text-center text-xs font-semibold text-neutral-800 dark:text-neutral-200" title="${escapeHtml(m.title)}">
            <div class="movie-title-line1">${escapeHtml(split.line1)}</div>
          </div>`;

        return `
          <div data-open-movie-id="${m.id}"
            class="group flex flex-col cursor-pointer select-none transition-all duration-300">
            ${visualBox}
            <div class="mt-1.5 flex flex-col items-center min-w-0 px-0.5 text-center">
              ${titleHtml}
              ${formattedDate ? `<span class="mt-0.5 w-full text-center text-[10px] font-medium text-neutral-400 dark:text-neutral-500 truncate">${escapeHtml(formattedDate)}</span>` : ''}
            </div>
          </div>`;
      }).join('');
    }

    // Pager (Top Right Header)
    if (el.moviesPager) {
      if (isWatchedSearchActive || totalPages <= 1) {
        el.moviesPager.classList.add('hidden');
        el.moviesPager.classList.remove('flex');
        el.moviesPager.innerHTML = '';
      } else {
        el.moviesPager.classList.remove('hidden');
        el.moviesPager.classList.add('flex');
        const navBtn = (data, dis, svg, title) =>
          `<button type="button" ${data} ${dis ? 'disabled' : ''} title="${title}"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 transition hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-neutral-800 dark:hover:bg-neutral-800">${svg}</button>`;
        el.moviesPager.innerHTML = `
          ${navBtn('data-movie-prev', moviesPage === 0, '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>', 'Previous page')}
          ${navBtn('data-movie-next', moviesPage === totalPages - 1, '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>', 'Next page')}`;
      }
    }
  }

  /* ---------- Add Movie Logic & Search ---------- */
  let searchDebounceTimer = null;
  let selectedMovieData = null;

  function openAddMovie() {
    if (!el.addMovieModal) return;
    el.addMovieForm.reset();
    selectedMovieData = null;
    if (el.movieSearchBlock) el.movieSearchBlock.classList.remove('hidden');
    if (el.selectedMovieCard) {
      el.selectedMovieCard.classList.add('hidden');
      el.selectedMovieCard.classList.remove('flex');
    }
    if (el.movieDateInput) el.movieDateInput.value = todayKey();
    openModal(el.addMovieModal);
    setTimeout(() => {
      if (el.movieSearchInput) el.movieSearchInput.focus();
    }, 60);
  }

  async function searchMovies(query) {
    const q = (query || '').trim();
    if (!q || !el.movieSearchResults) return;

    el.movieSearchResults.classList.remove('hidden');
    el.movieSearchResults.innerHTML = `
      <div class="flex items-center justify-center gap-2 py-4 text-xs text-neutral-500 dark:text-neutral-400">
        <svg class="h-4 w-4 animate-spin text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>
        <span>Searching movies...</span>
      </div>`;

    const results = [];
    const slug = q.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // 1. First attempt: IMDb instant suggestion API (handles typos like 'goodzilla' -> 'Godzilla')
    try {
      const imdbUrl = 'https://v3.sg.media-imdb.com/suggestion/x/' + encodeURIComponent(slug) + '.json';
      const res = await fetch(imdbUrl);
      if (res.ok) {
        const data = await res.json();
        const items = (data.d || []).filter((item) => item.l && (item.i || item.y));
        items.forEach((m) => {
          results.push({
            name: m.l,
            year: m.y ? String(m.y) : '',
            poster: m.i ? m.i.imageUrl : ''
          });
        });
      }
    } catch (err) {
      console.warn('IMDb suggestion error, falling back:', err);
    }

    // 2. Second attempt / fallback: Cinemeta API if IMDb had no items
    if (results.length === 0) {
      try {
        const cmUrl = 'https://v3-cinemeta.strem.io/catalog/movie/top/search=' + encodeURIComponent(q) + '.json';
        const res = await fetch(cmUrl);
        if (res.ok) {
          const data = await res.json();
          (data.metas || []).filter((m) => m && m.name).forEach((m) => {
            results.push({
              name: m.name,
              year: m.year || (m.releaseInfo ? String(m.releaseInfo).slice(0, 4) : ''),
              poster: m.poster || (m.imdb_id ? `https://images.metahub.space/poster/small/${m.imdb_id}/img` : '')
            });
          });
        }
      } catch (err) {
        console.warn('Cinemeta error:', err);
      }
    }

    if (!results.length) {
      el.movieSearchResults.innerHTML = `
        <div class="py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
          No movie found for "${escapeHtml(q)}".
        </div>`;
      return;
    }

    el.movieSearchResults.innerHTML = results.slice(0, 8).map((m) => {
      const safeData = JSON.stringify({ title: m.name, year: m.year, poster: m.poster }).replace(/"/g, '&quot;');
      return `
        <button type="button" data-select-movie="${safeData}"
          class="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <div class="h-12 w-8 flex-shrink-0 overflow-hidden rounded bg-neutral-800">
            ${m.poster ? `<img src="${m.poster}" alt="" class="h-full w-full object-cover" loading="lazy" onerror="this.style.display='none'" />` : ''}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-bold text-neutral-900 dark:text-white">${escapeHtml(m.name)}</p>
            <p class="text-[11px] text-neutral-500 dark:text-neutral-400">${escapeHtml(m.year || '—')}</p>
          </div>
        </button>`;
    }).join('');
  }

  function selectMovie(data) {
    selectedMovieData = data;
    if (el.movieSearchBlock) el.movieSearchBlock.classList.add('hidden');
    if (el.selectedMovieCard) {
      el.selectedMovieCard.classList.remove('hidden');
      el.selectedMovieCard.classList.add('flex');
      if (el.selectedMoviePoster) el.selectedMoviePoster.src = data.poster || '';
      if (el.selectedMovieTitle) el.selectedMovieTitle.textContent = data.title || '—';
      if (el.selectedMovieYear) el.selectedMovieYear.textContent = data.year || '—';
    }
    if (el.movieSelectedTitle) el.movieSelectedTitle.value = data.title || '';
    if (el.movieSearchInput) el.movieSearchInput.value = data.title || '';
    if (el.movieSearchResults) el.movieSearchResults.classList.add('hidden');
  }

  function clearSelectedMovie() {
    selectedMovieData = null;
    if (el.selectedMovieCard) {
      el.selectedMovieCard.classList.add('hidden');
      el.selectedMovieCard.classList.remove('flex');
    }
    if (el.movieSearchBlock) el.movieSearchBlock.classList.remove('hidden');
    if (el.movieSelectedTitle) el.movieSelectedTitle.value = '';
    if (el.movieSearchInput) {
      el.movieSearchInput.value = '';
      el.movieSearchInput.focus();
    }
  }

  function handleAddMovieSubmit(e) {
    e.preventDefault();
    const title = (el.movieSelectedTitle?.value || el.movieSearchInput?.value || '').trim();
    if (!title) {
      toast('Please enter or select a movie title');
      return;
    }

    const poster = (selectedMovieData && selectedMovieData.poster) ? selectedMovieData.poster : '';
    if (!poster) {
      toast('Please select a movie from search');
      return;
    }

    const date = (el.movieDateInput && el.movieDateInput.value) ? el.movieDateInput.value : todayKey();
    const year = date ? date.slice(0, 4) : (selectedMovieData?.year || new Date().getFullYear().toString());

    const newMovie = {
      id: uid(),
      title,
      poster,
      date,
      year,
      rating: ''
    };

    movies.unshift(newMovie);
    moviesPage = 0;
    saveMovies();
    renderMoviesGrid();
    renderStats();
    closeModal(el.addMovieModal);

    // Open detail & rate window immediately in input mode
    setTimeout(() => {
      openMovieDetail(newMovie.id, true);
    }, 120);
  }

  /* ---------- Movie Detail & Rate Modal ---------- */
  let activeDetailMovieId = null;
  let activeTicketPhoto = null;
  let isMovieDetailEditing = false;

  function renderTicketPreview(photoUrl) {
    if (photoUrl) {
      if (el.movieTicketPreview) {
        el.movieTicketPreview.src = photoUrl;
        el.movieTicketPreview.classList.remove('hidden');
      }
      if (el.movieTicketEmptyState) el.movieTicketEmptyState.classList.add('hidden');
      if (el.movieTicketOverlay) {
        el.movieTicketOverlay.classList.toggle('hidden', !isMovieDetailEditing);
      }
      if (el.movieTicketZoomOverlay) {
        el.movieTicketZoomOverlay.classList.toggle('hidden', isMovieDetailEditing);
      }
    } else {
      if (el.movieTicketPreview) {
        el.movieTicketPreview.src = '';
        el.movieTicketPreview.classList.add('hidden');
      }
      if (el.movieTicketEmptyState) el.movieTicketEmptyState.classList.remove('hidden');
      if (el.movieTicketOverlay) el.movieTicketOverlay.classList.add('hidden');
      if (el.movieTicketZoomOverlay) el.movieTicketZoomOverlay.classList.add('hidden');
    }
  }

  function updateRatingSliderBubble() {
    if (!el.movieRatingSlider || !el.ratingSliderBubble) return;
    const val = parseFloat(el.movieRatingSlider.value) || 0;
    const min = parseFloat(el.movieRatingSlider.min) || 0;
    const max = parseFloat(el.movieRatingSlider.max) || 10;
    const pct = (val - min) / (max - min);

    const thumbOffset = (0.5 - pct) * 14;
    el.ratingSliderBubble.style.left = `calc(${pct * 100}% + ${thumbOffset}px)`;

    const span = el.ratingSliderBubble.querySelector('span');
    if (span) {
      span.textContent = val.toFixed(1);
    }

    if (el.detailRatingInput) {
      el.detailRatingInput.value = val > 0 ? val.toFixed(1) : '';
    }
  }

  function setRatingEditMode(isEditing) {
    isMovieDetailEditing = isEditing;
    if (el.ratingViewMode) el.ratingViewMode.classList.toggle('hidden', isEditing);
    if (el.ratingEditMode) {
      el.ratingEditMode.classList.toggle('hidden', !isEditing);
      el.ratingEditMode.classList.toggle('flex', isEditing);
      if (isEditing) {
        setTimeout(updateRatingSliderBubble, 20);
      }
    }
    if (el.saveMovieRatingBtn) el.saveMovieRatingBtn.classList.toggle('hidden', !isEditing);
    renderTicketPreview(activeTicketPhoto);
  }

  function formatMovieDate(dateStr) {
    if (!dateStr) return '';
    if (/^\d{4}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[dt.getDay()]}, ${d} ${months[m]} ${y}`;
      }
    }
    return dateStr;
  }

  function applyMarqueeIfOverflow(elTitle, container) {
    if (!elTitle || !container) return;
    elTitle.classList.remove('running-text-active');
    container.classList.remove('running-text-wrap');
    elTitle.style.removeProperty('--marquee-distance');

    setTimeout(() => {
      if (elTitle.scrollWidth > container.clientWidth + 2) {
        const diff = elTitle.scrollWidth - container.clientWidth + 8;
        elTitle.style.setProperty('--marquee-distance', `-${diff}px`);
        container.classList.add('running-text-wrap');
        elTitle.classList.add('running-text-active');
      }
    }, 60);
  }

  function openMovieDetail(id, isNew = false) {
    const movie = movies.find((m) => m.id === id);
    if (!movie || !el.movieDetailModal) return;

    activeDetailMovieId = id;
    if (el.detailMovieId) el.detailMovieId.value = id;
    if (el.detailMoviePoster) el.detailMoviePoster.src = movie.poster || '';
    if (el.detailMovieTitle) {
      el.detailMovieTitle.textContent = movie.title || '—';
      applyMarqueeIfOverflow(el.detailMovieTitle, el.detailMovieTitleWrap);
    }
    if (el.detailMovieMeta) {
      const parts = [];
      if (movie.date) parts.push(`Watched on ${formatMovieDate(movie.date)}`);
      else if (movie.year) parts.push(`Released in ${movie.year}`);
      el.detailMovieMeta.textContent = parts.join(' • ') || 'Watched Movie';
    }

    const initialRate = (movie.rating && parseFloat(movie.rating) > 0) ? parseFloat(movie.rating) : 0;
    if (el.movieRatingSlider) el.movieRatingSlider.value = initialRate;
    if (el.detailRatingInput) el.detailRatingInput.value = movie.rating || '';

    if (isNew) {
      setRatingEditMode(true);
    } else {
      setRatingEditMode(!movie.rating);
    }

    activeTicketPhoto = movie.ticket || null;
    renderTicketPreview(activeTicketPhoto);

    openModal(el.movieDetailModal);
  }

  function handleSaveMovieRating() {
    if (!activeDetailMovieId) return;
    const movie = movies.find((m) => m.id === activeDetailMovieId);
    if (!movie) return;

    const num = el.movieRatingSlider ? parseFloat(el.movieRatingSlider.value) : (parseFloat(el.detailRatingInput?.value) || 0);
    if (num > 0) {
      movie.rating = Math.min(10, Math.max(0, num)).toFixed(1);
    } else {
      movie.rating = '';
    }

    movie.ticket = activeTicketPhoto || '';

    saveMovies();
    renderMoviesGrid();
    renderStats();

    // Return to preview/view mode instead of closing the modal
    if (el.detailRatingInput) {
      el.detailRatingInput.value = movie.rating || '';
    }
    setRatingEditMode(false);
  }

  function handleDeleteMovie() {
    if (!activeDetailMovieId) return;
    const movie = movies.find((m) => m.id === activeDetailMovieId);
    if (!movie) return;

    if (!window.confirm(`Delete movie "${movie.title}" from list?`)) return;

    movies = movies.filter((m) => m.id !== activeDetailMovieId);
    saveMovies();
    renderMoviesGrid();
    renderStats();
    closeModal(el.movieDetailModal);
  }

  function updateNavIndicator(view) {
    if (!el.navTabsContainer || !el.navActiveIndicator) return;
    const activeBtn = el.navTabsContainer.querySelector(`[data-nav-view="${view}"]`);
    if (!activeBtn) return;

    el.navActiveIndicator.style.left = `${activeBtn.offsetLeft}px`;
    el.navActiveIndicator.style.top = `${activeBtn.offsetTop}px`;
    el.navActiveIndicator.style.width = `${activeBtn.offsetWidth}px`;
    el.navActiveIndicator.style.height = `${activeBtn.offsetHeight}px`;

    document.querySelectorAll('[data-nav-view]').forEach((btn) => {
      const isTarget = btn.dataset.navView === view;
      btn.classList.toggle('text-neutral-900', isTarget);
      btn.classList.toggle('dark:text-white', isTarget);
      btn.classList.toggle('text-neutral-500', !isTarget);
      btn.classList.toggle('dark:text-neutral-400', !isTarget);
    });
  }

  function switchView(view) {
    currentView = view;
    const cards = [
      { id: 'calendar', el: el.calendarCard },
      { id: 'movies', el: el.moviesCard },
      { id: 'food', el: el.foodCard }
    ];

    cards.forEach((c) => {
      if (c.el) {
        const isTarget = c.id === view;
        c.el.classList.toggle('hidden', !isTarget);
        if (isTarget) {
          c.el.classList.remove('animate-view');
          void c.el.offsetWidth; // trigger reflow for smooth re-animation
          c.el.classList.add('animate-view');
        }
      }
    });

    updateNavIndicator(view);

    if (view === 'movies') {
      renderMoviesGrid();
    } else if (view === 'calendar') {
      renderCalendar();
    }
  }

  function openCategoryPage(cat) {
    if (cat === 'calendar') {
      switchView('calendar');
      return;
    }
    if (cat === 'movies') {
      switchView('movies');
      return;
    }
    if (cat === 'food') {
      switchView('food');
      return;
    }
  }

  /* ---------- Countdown ---------- */
  // The nearest event in the future (after today)
  function nearestEvent() {
    const tKey = todayKey();
    return events
      .filter((e) => e.date > tKey)
      .sort((a, b) => (a.date === b.date ? sortEvents(a, b) : a.date.localeCompare(b.date)))[0] || null;
  }
  function tickCountdown() {
    const ev = nearestEvent();
    if (!ev) { el.countdownText.textContent = 'No upcoming events'; return; }

    // Future date: live countdown to midnight
    const d = parseKey(ev.date); d.setHours(0, 0, 0, 0);
    const remaining = Math.max(0, d.getTime() - Date.now());
    const s = Math.floor(remaining / 1000);
    const days = Math.floor(s / 86400);
    const hrs = Math.floor((s % 86400) / 3600);
    const min = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    el.countdownText.textContent = days > 0
      ? `${days}d ${pad(hrs)}:${pad(min)}:${pad(sec)}`
      : `${pad(hrs)}:${pad(min)}:${pad(sec)}`;
  }
  function renderCountdown() { tickCountdown(); }

  function renderAll() {
    renderCalendar();
    renderStats();
    renderUpcoming();   // setelah kalender & stats agar pengukuran tinggi akurat
    renderCountdown();
    if (currentView === 'movies') renderMoviesGrid();
  }

  /* ---------- Modal helpers ---------- */
  const MODALS = () => [el.imageLightboxModal, el.movieDetailModal, el.addMovieModal, el.eventModal, el.dayModal];
  function anyModalOpen() { return MODALS().some((m) => m && !m.classList.contains('hidden')); }
  function openModal(m) {
    if (!m) return;
    m.classList.remove('hidden'); m.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(m) {
    if (!m) return;
    m.classList.add('hidden'); m.classList.remove('flex');
    if (!anyModalOpen()) document.body.style.overflow = '';
  }
  function closeModalSmart(m) {
    closeModal(m);
  }
  function closeTopModal() {
    for (const m of MODALS()) {
      if (m && !m.classList.contains('hidden')) { closeModalSmart(m); break; }
    }
  }

  /* ---------- Day modal (one event per date, detail-first) ---------- */
  function eventForDate(key) {
    return events.find((e) => e.date === key) || null;
  }
  function openDay(key) {
    const ev = eventForDate(key);
    if (!ev) {
      selectedDate = key;
      openEventForm(null);
      return;
    }
    selectedDate = key;
    const d = parseKey(key);
    el.dayModalTitle.textContent = `${WEEKDAYS_LONG[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
    renderDay();
    openModal(el.dayModal);
  }
  function renderDay() {
    const ev = eventForDate(selectedDate);
    renderDayBody(ev);
    renderDayFooter(ev);
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
    let captionText = '';
    if (ev.desc && ev.desc.trim()) {
      const raw = ev.desc.replace(/^@(luigi|fany|l|u|f):\s*/i, '').trim();
      captionText = raw.slice(0, 50);
    }

    let photoHtml = '';
    if (detailCroppingEvId === ev.id && detailCropImageObj) {
      photoHtml = `
        <div class="flex flex-col items-center gap-2.5">
          <div id="detailCropViewport"
            class="relative aspect-square w-full max-w-[190px] sm:max-w-[210px] cursor-grab select-none overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-900 touch-none active:cursor-grabbing dark:border-neutral-700 shadow-inner">
            <img id="detailCropPreview" src="${detailCropImageObj.src}" alt="Photo preview"
              class="pointer-events-none absolute left-1/2 top-1/2 max-h-none max-w-none select-none" />
            <div class="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10 dark:ring-white/10"></div>
            <div class="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
              Drag to reposition
            </div>
          </div>

          <!-- Zoom slider -->
          <div class="flex w-full max-w-[190px] sm:max-w-[210px] items-center gap-2">
            <svg class="h-3.5 w-3.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
            <input type="range" id="detailZoomSlider" min="1" max="3" step="0.01" value="${detailCropZoom}"
              class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-neutral-900 dark:bg-neutral-800 dark:accent-white" />
            <svg class="h-3.5 w-3.5 flex-shrink-0 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </div>

          <!-- Action buttons -->
          <div class="flex w-full max-w-[190px] sm:max-w-[210px] gap-2 pt-0.5">
            <button type="button" id="detailCancelCropBtn"
              class="flex-1 rounded-xl border border-neutral-200 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800">
              Cancel
            </button>
            <button type="button" id="detailSaveCropBtn"
              class="tgbls-fill flex-1 rounded-xl border border-transparent bg-clip-padding bg-neutral-900 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
              Save Photo
            </button>
          </div>
        </div>`;
    } else if (ev.photo) {
      photoHtml = `
        <div class="flex justify-center">
          <div class="flip-card-container aspect-square w-full max-w-[190px] sm:max-w-[210px] cursor-pointer select-none" data-flip-photo title="Click to flip & read caption">
            <div class="flip-card-inner">
              <!-- Front Face: Photo -->
              <div class="flip-card-front overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <img src="${ev.photo}" alt="Event Photo" class="h-full w-full object-cover" />
                <div class="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10 dark:ring-white/10"></div>
                ${captionText ? `
                  <div class="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-neutral-950/65 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-md shadow-sm">
                    <svg class="h-3 w-3 fill-none stroke-current" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                    <span>Read</span>
                  </div>` : ''}
              </div>

              <!-- Back Face: Caption -->
              <div class="flip-card-back flex h-full w-full flex-col justify-between rounded-2xl border border-neutral-200 bg-neutral-50 text-left dark:border-neutral-800 dark:bg-neutral-800/95 shadow-sm">
                <!-- Top Header: Line starts directly at icon with matching left/right spacing -->
                <div class="w-full px-4 pt-3.5">
                  <div class="flex items-center justify-start border-b border-neutral-200/80 pb-2 dark:border-neutral-700/80">
                    <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                      <span>Caption</span>
                    </div>
                  </div>
                </div>

                <!-- Middle Content: Left-aligned in reading area -->
                <div class="flex flex-1 w-full items-center justify-start px-4 py-2 text-left">
                  <p class="w-full m-0 text-left text-xs sm:text-sm font-normal leading-relaxed text-neutral-700 dark:text-neutral-200 break-words">${captionText ? `"${escapeHtml(captionText)}"` : `<span class="italic text-neutral-400">No caption for this memory.</span>`}</p>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    } else {
      photoHtml = `
        <div class="flex justify-center">
          <button type="button" data-detail-upload="${ev.id}"
            class="group flex aspect-square w-full max-w-[190px] sm:max-w-[210px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 p-4 text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 transition dark:bg-neutral-800 dark:text-neutral-300">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span class="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Upload Photo</span>
          </button>
        </div>`;
      if (captionText) {
        photoHtml += `
          <div class="mt-3 px-2 text-center">
            <span class="inline-block max-w-full text-sm font-normal text-neutral-500 dark:text-neutral-400 break-words">"${escapeHtml(captionText)}"</span>
          </div>`;
      }
    }

    return `
      <div class="space-y-3.5">
        <div class="text-center">
          <span class="mb-1.5 inline-block rounded-md border border-neutral-300 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">EVENT</span>
          <h4 class="break-words text-center text-lg font-bold leading-snug">${escapeHtml(ev.title)}</h4>
        </div>
        ${photoHtml}
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
      // empty date → add is always available
      html = `<button type="button" id="addEventBtn"
          class="tgbls-fill flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-clip-padding bg-neutral-900 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 5v14M5 12h14" /></svg>
          Add Event
        </button>`;
    } else {
      // edit + delete are always available
      html = delBtn('flex flex-1') + editBtn;
    }
    el.dayModalFooter.innerHTML = html;
    el.dayModalFooter.classList.toggle('hidden', !html);
  }

  /* ---------- Photo 1:1 Cropper State (Event Modal & Day Modal) ---------- */
  let cropImageObj = null;
  let cropZoom = 1;
  let cropX = 0;
  let cropY = 0;
  let isDraggingCrop = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialCropX = 0;
  let initialCropY = 0;

  // Detail inline cropper state
  let detailCroppingEvId = null;
  let detailCropImageObj = null;
  let detailCropZoom = 1;
  let detailCropX = 0;
  let detailCropY = 0;
  let isDraggingDetailCrop = false;
  let detailDragStartX = 0;
  let detailDragStartY = 0;
  let initialDetailCropX = 0;
  let initialDetailCropY = 0;

  function updateDetailCropperTransform() {
    const viewport = $('detailCropViewport');
    const preview = $('detailCropPreview');
    if (!detailCropImageObj || !viewport || !preview) return;

    const V = viewport.clientWidth || 190;
    const imgW = detailCropImageObj.naturalWidth || 1;
    const imgH = detailCropImageObj.naturalHeight || 1;

    let baseW, baseH;
    if (imgW >= imgH) {
      baseH = V;
      baseW = V * (imgW / imgH);
    } else {
      baseW = V;
      baseH = V * (imgH / imgW);
    }

    const currentW = baseW * detailCropZoom;
    const currentH = baseH * detailCropZoom;
    const maxPanX = Math.max(0, (currentW - V) / 2);
    const maxPanY = Math.max(0, (currentH - V) / 2);

    detailCropX = Math.max(-maxPanX, Math.min(maxPanX, detailCropX));
    detailCropY = Math.max(-maxPanY, Math.min(maxPanY, detailCropY));

    preview.style.width = `${currentW}px`;
    preview.style.height = `${currentH}px`;
    preview.style.transform = `translate(calc(-50% + ${detailCropX}px), calc(-50% + ${detailCropY}px))`;
  }

  function exportDetailCroppedSquarePhoto(targetSize = 800, quality = 0.6) {
    const viewport = $('detailCropViewport');
    if (!detailCropImageObj || !viewport) return null;

    const V = viewport.clientWidth || 190;
    const imgW = detailCropImageObj.naturalWidth || 1;
    const imgH = detailCropImageObj.naturalHeight || 1;

    let baseW, baseH;
    if (imgW >= imgH) {
      baseH = V;
      baseW = V * (imgW / imgH);
    } else {
      baseW = V;
      baseH = V * (imgH / imgW);
    }

    const currentW = baseW * detailCropZoom;
    const currentH = baseH * detailCropZoom;

    const scaleX = imgW / currentW;
    const scaleY = imgH / currentH;

    const srcW = V * scaleX;
    const srcH = V * scaleY;
    const srcX = Math.max(0, Math.min(imgW - srcW, (currentW / 2 - detailCropX - V / 2) * scaleX));
    const srcY = Math.max(0, Math.min(imgH - srcH, (currentH / 2 - detailCropY - V / 2) * scaleY));

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(detailCropImageObj, srcX, srcY, srcW, srcH, 0, 0, targetSize, targetSize);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function loadPhotoForCropping(src) {
    if (!src) {
      cropImageObj = null;
      formPhoto = null;
      renderPhotoForm();
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cropImageObj = img;
      formPhoto = src;
      cropZoom = 1;
      cropX = 0;
      cropY = 0;
      if (el.photoZoomSlider) el.photoZoomSlider.value = '1';
      if (el.eventPhotoPreview) {
        el.eventPhotoPreview.src = src;
      }
      renderPhotoForm();
      setTimeout(updateCropperTransform, 30);
    };
    img.onerror = () => {
      cropImageObj = null;
      formPhoto = null;
      renderPhotoForm();
    };
    img.src = src;
  }

  function getCropperMetrics() {
    if (!cropImageObj || !el.photoCropViewport) return null;
    const V = el.photoCropViewport.clientWidth || 260;
    const imgW = cropImageObj.naturalWidth || 1;
    const imgH = cropImageObj.naturalHeight || 1;

    let baseW, baseH;
    if (imgW >= imgH) {
      baseH = V;
      baseW = V * (imgW / imgH);
    } else {
      baseW = V;
      baseH = V * (imgH / imgW);
    }

    const currentW = baseW * cropZoom;
    const currentH = baseH * cropZoom;
    const maxPanX = Math.max(0, (currentW - V) / 2);
    const maxPanY = Math.max(0, (currentH - V) / 2);

    return { V, imgW, imgH, baseW, baseH, currentW, currentH, maxPanX, maxPanY };
  }

  function updateCropperTransform() {
    const m = getCropperMetrics();
    if (!m || !el.eventPhotoPreview) return;

    cropX = Math.max(-m.maxPanX, Math.min(m.maxPanX, cropX));
    cropY = Math.max(-m.maxPanY, Math.min(m.maxPanY, cropY));

    el.eventPhotoPreview.style.width = `${m.currentW}px`;
    el.eventPhotoPreview.style.height = `${m.currentH}px`;
    el.eventPhotoPreview.style.transform = `translate(calc(-50% + ${cropX}px), calc(-50% + ${cropY}px))`;

    if (el.photoResetBtn) {
      const isModified = cropZoom > 1 || Math.abs(cropX) > 1 || Math.abs(cropY) > 1;
      el.photoResetBtn.classList.toggle('hidden', !isModified);
    }
  }

  function exportCroppedSquarePhoto(targetSize = 800, quality = 0.6) {
    if (!cropImageObj) return formPhoto;
    const m = getCropperMetrics();
    if (!m) return formPhoto;

    const scaleX = m.imgW / m.currentW;
    const scaleY = m.imgH / m.currentH;

    const srcW = m.V * scaleX;
    const srcH = m.V * scaleY;
    const srcX = Math.max(0, Math.min(m.imgW - srcW, (m.currentW / 2 - cropX - m.V / 2) * scaleX));
    const srcY = Math.max(0, Math.min(m.imgH - srcH, (m.currentH / 2 - cropY - m.V / 2) * scaleY));

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      cropImageObj,
      srcX, srcY, srcW, srcH,
      0, 0, targetSize, targetSize
    );

    return canvas.toDataURL('image/jpeg', quality);
  }

  function renderPhotoForm() {
    if (formPhoto) {
      if (el.photoPreviewContainer) {
        el.photoPreviewContainer.classList.remove('hidden');
        el.photoPreviewContainer.classList.add('flex');
      }
      if (el.uploadPhotoBtn) el.uploadPhotoBtn.classList.add('hidden');
    } else {
      cropImageObj = null;
      if (el.eventPhotoPreview) el.eventPhotoPreview.src = '';
      if (el.photoPreviewContainer) {
        el.photoPreviewContainer.classList.add('hidden');
        el.photoPreviewContainer.classList.remove('flex');
      }
      if (el.uploadPhotoBtn) el.uploadPhotoBtn.classList.remove('hidden');
      if (el.eventPhotoInput) el.eventPhotoInput.value = '';
      if (el.photoResetBtn) el.photoResetBtn.classList.add('hidden');
    }
  }

  /* ---------- Event form modal ---------- */
  function openEventForm(eventId) {
    el.eventForm.reset();
    if (eventId) {
      const ev = events.find((e) => e.id === eventId);
      if (!ev) return;
      el.eventModalTitle.textContent = 'Edit Event';
      if (el.eventPhotoSection) el.eventPhotoSection.classList.remove('hidden');
      el.eventId.value = ev.id;
      el.eventTitle.value = ev.title;
      el.eventDate.value = ev.date;
      el.eventDesc.value = ev.desc || '';
      if (ev.photo) {
        loadPhotoForCropping(ev.photo);
      } else {
        formPhoto = null;
        cropImageObj = null;
        renderPhotoForm();
      }
    } else {
      el.eventModalTitle.textContent = 'Add Event';
      if (el.eventPhotoSection) el.eventPhotoSection.classList.add('hidden');
      el.eventId.value = '';
      el.eventDate.value = selectedDate || todayKey();
      formPhoto = null;
      cropImageObj = null;
      renderPhotoForm();
    }

    const charCountEl = $('eventDescCharCount');
    if (charCountEl) {
      charCountEl.textContent = `${(el.eventDesc.value || '').length}/50`;
    }

    openModal(el.eventModal);
    setTimeout(() => {
      el.eventTitle.focus();
      updateCropperTransform();
    }, 50);
  }

  function handleEventSubmit(e) {
    e.preventDefault();

    try {
      const title = el.eventTitle.value.trim();
      const date = el.eventDate.value;
      if (!title || !date) return;

      const id = el.eventId.value;
      // one event per date
      if (events.some((x) => x.date === date && x.id !== id)) {
        toast('This date already has an event');
        return;
      }

      const desc = el.eventDesc.value.trim().slice(0, 50);
      const finalPhoto = cropImageObj ? exportCroppedSquarePhoto() : formPhoto;
      const payload = {
        title, date, desc,
        photo: finalPhoto || null,
      };

      if (id) {
        const ev = events.find((x) => x.id === id);
        if (ev) { Object.assign(ev, payload); }
      } else {
        events.push({ id: uid(), ...payload });
      }

      saveEvents();
      closeModal(el.eventModal);

      selectedDate = date;
      const d = parseKey(date);
      viewYear = d.getFullYear();
      viewMonth = d.getMonth();
      renderAll();

      openDay(date);
    } catch (err) {
      console.error('Error saving event:', err);
      toast('Failed to save event');
    }
  }

  function deleteEvent(id) {
    const ev = events.find((x) => x.id === id);
    if (!ev) return;
    if (!window.confirm(`Delete event "${ev.title}"?`)) return;
    events = events.filter((x) => x.id !== id);
    saveEvents();
    renderAll();
    if (!el.dayModal.classList.contains('hidden')) {
      closeModal(el.dayModal);
    }
  }





  /* ---------- Toast ---------- */
  function toast(message) {
    if (!el.toastContainer) {
      el.toastContainer = $('toastContainer');
      if (!el.toastContainer) {
        el.toastContainer = document.createElement('div');
        el.toastContainer.id = 'toastContainer';
        el.toastContainer.className = 'pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2';
        document.body.appendChild(el.toastContainer);
      }
    }
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
    if (el.themeToggleBtn) el.themeToggleBtn.addEventListener('click', toggleTheme);

    if (el.prevBtn) el.prevBtn.addEventListener('click', () => changeMonth(-1));
    if (el.nextBtn) el.nextBtn.addEventListener('click', () => changeMonth(1));
    if (el.todayBtn) el.todayBtn.addEventListener('click', goToday);

    if (el.eventForm) el.eventForm.addEventListener('submit', handleEventSubmit);

    // Movie controls & modal listeners
    if (el.openAddMovieBtn) el.openAddMovieBtn.addEventListener('click', openAddMovie);
    if (el.openMovieSearchBtn) el.openMovieSearchBtn.addEventListener('click', () => toggleWatchedMovieSearch());
    if (el.watchedMovieSearchInput) {
      el.watchedMovieSearchInput.addEventListener('input', (e) => {
        watchedMovieQuery = (e.target.value || '').trim().toLowerCase();
        if (el.clearWatchedSearchBtn) el.clearWatchedSearchBtn.classList.toggle('hidden', !watchedMovieQuery);
        moviesPage = 0;
        renderMoviesGrid();
      });
      el.watchedMovieSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          toggleWatchedMovieSearch(false);
        }
      });
    }
    if (el.clearWatchedSearchBtn) {
      el.clearWatchedSearchBtn.addEventListener('click', () => {
        watchedMovieQuery = '';
        if (el.watchedMovieSearchInput) {
          el.watchedMovieSearchInput.value = '';
          el.watchedMovieSearchInput.focus();
        }
        el.clearWatchedSearchBtn.classList.add('hidden');
        moviesPage = 0;
        renderMoviesGrid();
      });
    }

    if (el.addMovieForm) el.addMovieForm.addEventListener('submit', handleAddMovieSubmit);
    if (el.clearSelectedMovieBtn) el.clearSelectedMovieBtn.addEventListener('click', clearSelectedMovie);

    // Select movie from search results
    if (el.movieSearchResults) {
      el.movieSearchResults.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-select-movie]');
        if (!btn) return;
        try {
          const data = JSON.parse(btn.dataset.selectMovie);
          selectMovie(data);
        } catch (err) {
          console.error('Error selecting movie:', err);
        }
      });
    }

    // Movie grid card clicks and hover title marquee
    if (el.moviesGrid) {
      el.moviesGrid.addEventListener('click', (e) => {
        const card = e.target.closest('[data-open-movie-id]');
        if (card && card.dataset.openMovieId) {
          openMovieDetail(card.dataset.openMovieId);
        }
      });

      el.moviesGrid.addEventListener('mouseenter', (e) => {
        const card = e.target.closest('[data-open-movie-id]');
        if (!card) return;
        const line2 = card.querySelector('.movie-title-line2');
        const span = line2 ? line2.querySelector('.movie-line2-span') : null;
        if (line2 && span && span.dataset.full) {
          span.textContent = span.dataset.full;
          const diff = span.scrollWidth - line2.clientWidth;
          if (diff > 2) {
            span.style.setProperty('--scroll-dist', `-${diff}px`);
            span.classList.add('animate-marquee');
          }
        }
      }, true);

      el.moviesGrid.addEventListener('mouseleave', (e) => {
        const card = e.target.closest('[data-open-movie-id]');
        if (!card) return;
        const span = card.querySelector('.movie-line2-span');
        if (span) {
          span.classList.remove('animate-marquee');
          span.style.removeProperty('--scroll-dist');
          if (span.dataset.short) {
            span.textContent = span.dataset.short;
          }
        }
      }, true);
    }

    // Movie Detail Modal rating listeners
    if (el.editMovieRatingBtn) {
      el.editMovieRatingBtn.addEventListener('click', () => {
        const movie = movies.find((m) => m.id === activeDetailMovieId);
        const currentRate = (movie && movie.rating && parseFloat(movie.rating) > 0) ? parseFloat(movie.rating) : 0;
        if (el.movieRatingSlider) el.movieRatingSlider.value = currentRate;
        setRatingEditMode(true);
      });
    }
    if (el.closeRatingEditBtn) {
      el.closeRatingEditBtn.addEventListener('click', () => {
        const movie = movies.find((m) => m.id === activeDetailMovieId);
        if (movie) {
          const savedRate = (movie.rating && parseFloat(movie.rating) > 0) ? parseFloat(movie.rating) : 0;
          if (el.movieRatingSlider) el.movieRatingSlider.value = savedRate;
          if (el.detailRatingInput) el.detailRatingInput.value = movie.rating || '';
        }
        setRatingEditMode(false);
      });
    }
    if (el.movieRatingSlider) {
      el.movieRatingSlider.addEventListener('input', updateRatingSliderBubble);
    }

    // Movie Ticket Photo handlers
    if (el.movieTicketBox) {
      el.movieTicketBox.addEventListener('click', () => {
        if (isMovieDetailEditing || !activeTicketPhoto) {
          if (el.movieTicketInput) el.movieTicketInput.click();
        } else {
          if (el.lightboxImage) el.lightboxImage.src = activeTicketPhoto;
          if (el.imageLightboxModal) openModal(el.imageLightboxModal);
        }
      });
    }
    if (el.movieTicketInput) {
      el.movieTicketInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          toast('Please select an image file for the ticket');
          return;
        }
        try {
          const compressed = await compressImage(file, 800, 0.5);
          activeTicketPhoto = compressed;
          renderTicketPreview(activeTicketPhoto);
          if (el.saveMovieRatingBtn) el.saveMovieRatingBtn.classList.remove('hidden');
        } catch (err) {
          console.error('Error processing ticket photo:', err);
          toast('Failed to process ticket photo');
        }
      });
    }
    if (el.saveMovieRatingBtn) el.saveMovieRatingBtn.addEventListener('click', handleSaveMovieRating);
    if (el.deleteMovieBtn) el.deleteMovieBtn.addEventListener('click', handleDeleteMovie);
    if (el.movieSearchBtn) el.movieSearchBtn.addEventListener('click', () => searchMovies(el.movieSearchInput ? el.movieSearchInput.value : ''));
    if (el.movieSearchInput) {
      el.movieSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        const val = e.target.value;
        if (!val.trim()) {
          if (el.movieSearchResults) el.movieSearchResults.classList.add('hidden');
          return;
        }
        searchDebounceTimer = setTimeout(() => searchMovies(val), 350);
      });
      el.movieSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(searchDebounceTimer);
          searchMovies(e.target.value);
        }
      });
    }

    if (el.eventDesc) {
      el.eventDesc.addEventListener('input', () => {
        const count = (el.eventDesc.value || '').length;
        const counter = $('eventDescCharCount');
        if (counter) counter.textContent = `${count}/50`;
      });
    }

    if (el.uploadPhotoBtn) el.uploadPhotoBtn.addEventListener('click', () => el.eventPhotoInput.click());
    if (el.eventPhotoInput) el.eventPhotoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast('Please select an image file');
        return;
      }
      try {
        const compressed = await compressImage(file, 1600, 0.9);
        loadPhotoForCropping(compressed);
      } catch {
        toast('Failed to process image');
      }
    });
    if (el.removePhotoBtn) el.removePhotoBtn.addEventListener('click', () => {
      formPhoto = null;
      cropImageObj = null;
      renderPhotoForm();
    });

    // Photo Cropper drag & zoom listeners
    if (el.photoCropViewport) {
      el.photoCropViewport.addEventListener('pointerdown', (e) => {
        if (!cropImageObj || e.target.closest('#removePhotoBtn')) return;
        isDraggingCrop = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialCropX = cropX;
        initialCropY = cropY;
        try { el.photoCropViewport.setPointerCapture(e.pointerId); } catch {}
      });

      el.photoCropViewport.addEventListener('pointermove', (e) => {
        if (!isDraggingCrop) return;
        cropX = initialCropX + (e.clientX - dragStartX);
        cropY = initialCropY + (e.clientY - dragStartY);
        updateCropperTransform();
      });

      const stopDrag = (e) => {
        if (isDraggingCrop) {
          isDraggingCrop = false;
          try { el.photoCropViewport.releasePointerCapture(e.pointerId); } catch {}
        }
      };
      el.photoCropViewport.addEventListener('pointerup', stopDrag);
      el.photoCropViewport.addEventListener('pointercancel', stopDrag);

      // Mouse wheel zoom
      el.photoCropViewport.addEventListener('wheel', (e) => {
        if (!cropImageObj) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        cropZoom = Math.max(1, Math.min(3, cropZoom + delta));
        if (el.photoZoomSlider) el.photoZoomSlider.value = String(cropZoom);
        updateCropperTransform();
      }, { passive: false });
    }

    if (el.photoZoomSlider) {
      el.photoZoomSlider.addEventListener('input', () => {
        cropZoom = parseFloat(el.photoZoomSlider.value) || 1;
        updateCropperTransform();
      });
    }

    if (el.photoResetBtn) {
      el.photoResetBtn.addEventListener('click', () => {
        cropZoom = 1;
        cropX = 0;
        cropY = 0;
        if (el.photoZoomSlider) el.photoZoomSlider.value = '1';
        updateCropperTransform();
      });
    }

    if (el.detailPhotoInput) {
      el.detailPhotoInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          toast('Please select an image file');
          return;
        }
        try {
          const compressed = await compressImage(file, 1600, 0.9);
          if (detailUploadTargetId) {
            const ev = events.find((x) => x.id === detailUploadTargetId);
            if (ev) {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                detailCroppingEvId = ev.id;
                detailCropImageObj = img;
                detailCropZoom = 1;
                detailCropX = 0;
                detailCropY = 0;
                renderDayBody(ev);
                setTimeout(updateDetailCropperTransform, 30);
              };
              img.src = compressed;
            }
          }
        } catch {
          toast('Failed to process image');
        }
      });
    }

    // Detail inline cropper drag and zoom listeners
    document.addEventListener('pointerdown', (e) => {
      const viewport = e.target.closest('#detailCropViewport');
      if (viewport && detailCropImageObj) {
        isDraggingDetailCrop = true;
        detailDragStartX = e.clientX;
        detailDragStartY = e.clientY;
        initialDetailCropX = detailCropX;
        initialDetailCropY = detailCropY;
        try { viewport.setPointerCapture(e.pointerId); } catch {}
      }
    });

    document.addEventListener('pointermove', (e) => {
      if (!isDraggingDetailCrop) return;
      detailCropX = initialDetailCropX + (e.clientX - detailDragStartX);
      detailCropY = initialDetailCropY + (e.clientY - detailDragStartY);
      updateDetailCropperTransform();
    });

    const stopDetailDrag = (e) => {
      if (isDraggingDetailCrop) {
        isDraggingDetailCrop = false;
        const viewport = $('detailCropViewport');
        if (viewport) {
          try { viewport.releasePointerCapture(e.pointerId); } catch {}
        }
      }
    };
    document.addEventListener('pointerup', stopDetailDrag);
    document.addEventListener('pointercancel', stopDetailDrag);

    document.addEventListener('wheel', (e) => {
      if (!detailCropImageObj) return;
      const viewport = e.target.closest('#detailCropViewport');
      if (viewport) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        detailCropZoom = Math.max(1, Math.min(3, detailCropZoom + delta));
        const slider = $('detailZoomSlider');
        if (slider) slider.value = String(detailCropZoom);
        updateDetailCropperTransform();
      }
    }, { passive: false });

    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'detailZoomSlider') {
        detailCropZoom = parseFloat(e.target.value) || 1;
        updateDetailCropperTransform();
      }
    });

    // klik global (delegation)
    document.addEventListener('click', (e) => {
      const moviePrev = e.target.closest('[data-movie-prev]');
      if (moviePrev) {
        if (moviesPage > 0) {
          moviesPage--;
          renderMoviesGrid();
        }
        return;
      }
      const movieNext = e.target.closest('[data-movie-next]');
      if (movieNext) {
        const perPage = getMoviesPerPage();
        const totalPages = Math.ceil(movies.length / perPage);
        if (moviesPage < totalPages - 1) {
          moviesPage++;
          renderMoviesGrid();
        }
        return;
      }

      const navViewBtn = e.target.closest('[data-nav-view]');
      if (navViewBtn) {
        switchView(navViewBtn.dataset.navView);
        return;
      }

      const flipContainer = e.target.closest('[data-flip-photo]');
      if (flipContainer) {
        flipContainer.classList.toggle('is-flipped');
        return;
      }

      const detailCancelBtn = e.target.closest('#detailCancelCropBtn');
      if (detailCancelBtn) {
        detailCroppingEvId = null;
        detailCropImageObj = null;
        const ev = eventForDate(selectedDate);
        if (ev) renderDayBody(ev);
        return;
      }

      const detailSaveBtn = e.target.closest('#detailSaveCropBtn');
      if (detailSaveBtn) {
        const ev = eventForDate(selectedDate);
        if (ev && detailCropImageObj) {
          const cropped = exportDetailCroppedSquarePhoto();
          if (cropped) {
            ev.photo = cropped;
            saveEvents();
            detailCroppingEvId = null;
            detailCropImageObj = null;
            renderDay();
          }
        }
        return;
      }

      const detailUpBtn = e.target.closest('[data-detail-upload]');
      if (detailUpBtn) {
        detailUploadTargetId = detailUpBtn.dataset.detailUpload;
        if (el.detailPhotoInput) {
          el.detailPhotoInput.value = '';
          el.detailPhotoInput.click();
        }
        return;
      }

      const dayBtn = e.target.closest('[data-day]');
      if (dayBtn) { openDay(dayBtn.dataset.day); return; }

      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) { openEventForm(editBtn.dataset.edit); return; }

      const delBtn = e.target.closest('[data-delete]');
      if (delBtn) { deleteEvent(delBtn.dataset.delete); return; }



      // paginasi kegiatan mendatang
      if (e.target.closest('[data-up-prev]')) { if (upcomingPage > 0) { upcomingPage--; renderUpcoming(); } return; }
      if (e.target.closest('[data-up-next]')) { upcomingPage++; renderUpcoming(); return; }

      // kategori khusus (Movies / Food)
      const catBtn = e.target.closest('[data-category-page]');
      if (catBtn) { openCategoryPage(catBtn.dataset.categoryPage); return; }

      // day modal footer
      if (e.target.closest('#addEventBtn')) { openEventForm(null); return; }

      // tutup modal
      const closeBtn = e.target.closest('[data-close-modal]');
      if (closeBtn) { const m = closeBtn.closest('.modal-root'); if (m) closeModalSmart(m); return; }
      if (e.target.classList.contains('modal-backdrop')) { closeModalSmart(e.target.parentElement); return; }
    });

    // ESC menutup modal teratas
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeTopModal();
    });

    // hitung ulang tinggi sidebar & paginasi saat ukuran layar berubah
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderUpcoming();
        updateNavIndicator(currentView || 'calendar');
      }, 150);
    });
    // setelah semua aset (Tailwind/font) selesai → ukuran final, hitung ulang
    window.addEventListener('load', () => {
      renderUpcoming();
      updateNavIndicator(currentView || 'calendar');
    });

    // sinkron data bersama: segarkan saat tab difokuskan & berkala
    window.addEventListener('focus', maybePull);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) maybePull(); });
    setInterval(maybePull, 30000);
  }

  /* ---------- Init ---------- */
  function init() {
    loadEvents();
    initTheme();
    goToday();
    renderWeekdays();
    bindEvents();
    setInterval(tickCountdown, 1000);   // countdown bergerak tiap detik
    setTimeout(renderUpcoming, 80);
    setTimeout(() => updateNavIndicator(currentView || 'calendar'), 40);
    pullRemote();                        // ambil data terbaru dari DB (fallback ke cache bila offline)
  }

  document.addEventListener('DOMContentLoaded', init);
})();


