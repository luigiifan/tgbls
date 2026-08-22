/* ============================================================
   Tigabelas — Kalender Kegiatan
   Vanilla JS · localStorage · tanpa build step
   ============================================================ */
(function () {
  'use strict';

  const KEY_EVENTS = 'tigabelas.events.v1';
  const KEY_MOVIES = 'tigabelas.movies.v1';
  const KEY_THEME = 'tigabelas.theme';
  const KEY_AUTH_USER = 'tigabelas.currentUser';
  const KEY_USERS = 'tigabelas.users.v1';

  async function safeJson(response) {
    if (!response) return null;
    try {
      const text = await response.text();
      if (!text || !text.trim()) return null;
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  const DEFAULT_USERS = [
    {
      id: 'usr_lgiifn',
      username: 'lgiifn',
      pass: '13052004',
      name: 'Luigi Ifan',
      sex: 'Him',
      theme: 'dark',
      role: 'admin',
      permissions: { canManageEvents: true, canManageMovies: true, canManageUsers: true },
    },
    {
      id: 'usr_ysfany',
      username: 'ysfany',
      pass: '13042003',
      name: 'Yousyta Fany',
      sex: 'Her',
      theme: 'pink',
      role: 'admin',
      permissions: { canManageEvents: true, canManageMovies: true, canManageUsers: true },
    },
  ];

  function getLocalUsers() {
    try {
      const raw = localStorage.getItem(KEY_USERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    try { localStorage.setItem(KEY_USERS, JSON.stringify(DEFAULT_USERS)); } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_USERS));
  }

  function setLocalUsers(list) {
    try {
      localStorage.setItem(KEY_USERS, JSON.stringify(list));
    } catch (e) {}
  }

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
  let currentUser = null;        // { username, name, sex } | null
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
    profileBtn: $('profileBtn'),
    profileDropdown: $('profileDropdown'),
    profileBackdrop: $('profileBackdrop'),
    profileOwnerName: $('profileOwnerName'),
    profileOwnerRole: $('profileOwnerRole'),
    openLoginModalBtn: $('openLoginModalBtn'),
    logoutBtn: $('logoutBtn'),
    loginModal: $('loginModal'),
    loginForm: $('loginForm'),
    loginUsername: $('loginUsername'),
    loginPassword: $('loginPassword'),
    loginErrorMsg: $('loginErrorMsg'),
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
    openBookmarksBtn: $('openBookmarksBtn'),
    bookmarksModal: $('bookmarksModal'),
    bookmarksCountBadge: $('bookmarksCountBadge'),
    bookmarksList: $('bookmarksList'),
    // user settings & management
    openSettingsModalBtn: $('openSettingsModalBtn'),
    settingsModal: $('settingsModal'),
    usersCountBadge: $('usersCountBadge'),
    usersListContainer: $('usersListContainer'),
    openAddUserBtn: $('openAddUserBtn'),
    userFormModal: $('userFormModal'),
    userFormModalTitle: $('userFormModalTitle'),
    userForm: $('userForm'),
    userFormId: $('userFormId'),
    userFormUsername: $('userFormUsername'),
    userFormPassword: $('userFormPassword'),
    userFormPassReqStar: $('userFormPassReqStar'),
    userFormPassHint: $('userFormPassHint'),
    userFormName: $('userFormName'),
    userFormSex: $('userFormSex'),
    userFormTheme: $('userFormTheme'),
    permEvents: $('permEvents'),
    permMovies: $('permMovies'),
    permUsers: $('permUsers'),
    userFormErrorMsg: $('userFormErrorMsg'),
    saveUserBtn: $('saveUserBtn'),
    deleteUserFromFormBtn: $('deleteUserFromFormBtn'),
    // movie controls & modal
    moviesHeaderSearchBlock: $('moviesHeaderSearchBlock'),
    moviesSelectControls: $('moviesSelectControls'),
    toggleMovieSelectBtn: $('toggleMovieSelectBtn'),
    selectAllMoviesBtn: $('selectAllMoviesBtn'),
    deleteSelectedMoviesBtn: $('deleteSelectedMoviesBtn'),
    cancelMovieSelectBtn: $('cancelMovieSelectBtn'),
    watchedMovieSearchInput: $('watchedMovieSearchInput'),
    clearWatchedSearchBtn: $('clearWatchedSearchBtn'),
    movieSearchIconSvg: $('movieSearchIconSvg'),
    movieSearchCloseSvg: $('movieSearchCloseSvg'),
    moviesDesktopControls: $('moviesDesktopControls'),
    openAddMovieBtn: $('openAddMovieBtn'),
    openMovieSearchBtn: $('openMovieSearchBtn'),
    movieMobileActionsWrap: $('movieMobileActionsWrap'),
    movieMobileActionsBtn: $('movieMobileActionsBtn'),
    movieMobileSearchCloseBtn: $('movieMobileSearchCloseBtn'),
    movieMobileActionsMenu: $('movieMobileActionsMenu'),
    mobileAddMovieBtn: $('mobileAddMovieBtn'),
    mobileSearchMovieBtn: $('mobileSearchMovieBtn'),
    mobileSelectMovieBtn: $('mobileSelectMovieBtn'),
    addMovieModal: $('addMovieModal'),
    addMovieForm: $('addMovieForm'),
    movieSearchBlock: $('movieSearchBlock'),
    movieSearchInput: $('movieSearchInput'),
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
    movieShowTicketMobileBtn: $('movieShowTicketMobileBtn'),
    movieShowTicketMobileText: $('movieShowTicketMobileText'),
    saveMovieRatingBtn: $('saveMovieRatingBtn'),
    deleteMovieBtn: $('deleteMovieBtn'),
    // image lightbox
    imageLightboxModal: $('imageLightboxModal'),
    lightboxImage: $('lightboxImage'),
    // day modal
    dayModal: $('dayModal'),
    dayModalTitle: $('dayModalTitle'), dayModalList: $('dayModalList'),
    dayModalFooter: $('dayModalFooter'), detailPhotoInput: $('detailPhotoInput'),
    dayAddDropdownBtn: $('dayAddDropdownBtn'),
    dayAddDropdownMenu: $('dayAddDropdownMenu'),
    dayAddMovieOptionBtn: $('dayAddMovieOptionBtn'),
    dayAddFoodOptionBtn: $('dayAddFoodOptionBtn'),
    // event modal
    eventModal: $('eventModal'), eventForm: $('eventForm'),
    eventModalTitle: $('eventModalTitle'), eventId: $('eventId'),
    eventTitle: $('eventTitle'), eventDate: $('eventDate'), eventDesc: $('eventDesc'),
    eventPhotoSection: $('eventPhotoSection'),
    photoUploadActions: $('photoUploadActions'),
    eventPhotoInput: $('eventPhotoInput'), uploadPhotoBtn: $('uploadPhotoBtn'),
    linkPhotoBtn: $('linkPhotoBtn'),
    photoPreviewContainer: $('photoPreviewContainer'), eventPhotoPreview: $('eventPhotoPreview'),
    eventPhotoDisplayWrap: $('eventPhotoDisplayWrap'), eventPhotoDisplayImg: $('eventPhotoDisplayImg'),
    photoCropEditWrap: $('photoCropEditWrap'),
    photoCropViewport: $('photoCropViewport'), photoZoomControls: $('photoZoomControls'),
    photoZoomSlider: $('photoZoomSlider'), photoResetBtn: $('photoResetBtn'),
    removePhotoBtn: $('removePhotoBtn'),
    // linked photo modal
    linkedPhotoModal: $('linkedPhotoModal'),
    linkedPhotoTabs: $('linkedPhotoTabs'),
    linkedPhotoGrid: $('linkedPhotoGrid'),
    // in-container photo sync overlays
    eventPhotoSyncOverlay1: $('eventPhotoSyncOverlay1'),
    eventPhotoSyncOverlay2: $('eventPhotoSyncOverlay2'),
    movieTicketSyncOverlay: $('movieTicketSyncOverlay'),
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

  const DEFAULT_MOVIES_LIST = [];
  const DEFAULT_DUMMY_MOVIE_IDS = new Set([
    'mov_1_spider_verse_2', 'mov_2_oppenheimer', 'mov_3_interstellar', 'mov_4_dune_2',
    'mov_5_dark_knight', 'mov_6_inception', 'mov_7_eeao', 'mov_8_spirited_away',
    'mov_9_la_la_land', 'mov_10_parasite', 'mov_11_gotg_3', 'mov_12_whiplash',
    'mov_13_coco', 'mov_14_your_name', 'mov_15_avatar_2', 'mov_16_the_batman',
    'mov_17_inside_out_2', 'mov_18_top_gun_2', 'mov_19_suzume', 'mov_20_spider_verse_1'
  ]);

  function loadEvents() {
    try { events = JSON.parse(localStorage.getItem(KEY_EVENTS)) || []; }
    catch { events = []; }
    try {
      const cached = JSON.parse(localStorage.getItem(KEY_MOVIES));
      if (Array.isArray(cached) && cached.length > 0) {
        movies = deduplicateMovies(cached.filter((m) => m && m.id && !DEFAULT_DUMMY_MOVIE_IDS.has(m.id)));
      } else {
        movies = [];
      }
      saveMoviesLocally();
    } catch {
      movies = [];
      saveMoviesLocally();
    }
  }
  function saveEventsLocally() {
    try {
      localStorage.setItem(KEY_EVENTS, JSON.stringify(events));
    } catch (err) {
      console.warn('LocalStorage write warning:', err);
    }
  }
  function saveMoviesLocally() {
    try {
      localStorage.setItem(KEY_MOVIES, JSON.stringify(movies));
    } catch (err) {
      console.warn('LocalStorage movies write warning:', err);
    }
  }

  function saveEvents() {
    saveEventsLocally();
    schedulePush();
  }
  function saveMovies() {
    saveMoviesLocally();
    schedulePush();
  }

  // In-Photo Sync Loading Indicators & State
  let isSyncingActive = false;

  function setEventPhotoSyncLoading(loading) {
    isSyncingActive = Boolean(loading);
    if (el.eventPhotoSyncOverlay1) {
      el.eventPhotoSyncOverlay1.classList.toggle('hidden', !loading);
      el.eventPhotoSyncOverlay1.classList.toggle('flex', Boolean(loading));
    }
    if (el.eventPhotoSyncOverlay2) {
      el.eventPhotoSyncOverlay2.classList.toggle('hidden', !loading);
      el.eventPhotoSyncOverlay2.classList.toggle('flex', Boolean(loading));
    }
    const saveBtn = el.eventModal ? el.eventModal.querySelector('button[type="submit"]') : null;
    if (saveBtn) {
      saveBtn.disabled = Boolean(loading);
      saveBtn.classList.toggle('opacity-50', Boolean(loading));
    }
  }

  function setMovieTicketSyncLoading(loading) {
    isSyncingActive = Boolean(loading);
    if (el.movieTicketSyncOverlay) {
      el.movieTicketSyncOverlay.classList.toggle('hidden', !loading);
      el.movieTicketSyncOverlay.classList.toggle('flex', Boolean(loading));
    }
    if (el.saveMovieRatingBtn) {
      el.saveMovieRatingBtn.disabled = Boolean(loading);
      el.saveMovieRatingBtn.classList.toggle('opacity-50', Boolean(loading));
      el.saveMovieRatingBtn.textContent = loading ? 'Saving...' : 'Save';
    }
    if (el.movieShowTicketMobileBtn) {
      el.movieShowTicketMobileBtn.disabled = Boolean(loading);
    }
  }

  function setDetailCropSyncLoading(loading) {
    isSyncingActive = Boolean(loading);
    const overlay = $('detailCropSyncOverlay');
    if (overlay) {
      overlay.classList.toggle('hidden', !loading);
      overlay.classList.toggle('flex', Boolean(loading));
    }
    const saveBtn = $('detailSaveCropBtn');
    if (saveBtn) {
      saveBtn.disabled = Boolean(loading);
      saveBtn.classList.toggle('opacity-50', Boolean(loading));
      saveBtn.textContent = loading ? 'Saving...' : 'Save Photo';
    }
    const cancelBtn = $('detailCancelCropBtn');
    if (cancelBtn) {
      cancelBtn.disabled = Boolean(loading);
    }
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
      if (r.ok) {
        remoteOn = true;
        dirty = false;
        return true;
      }
      remoteOn = false;
      return false;
    } catch (err) {
      remoteOn = false;
      return false;
    }
  }
  // Pull the shared state from the DB and adopt it (falls back to cache offline).
  async function pullRemote() {
    try {
      const r = await fetch(API_URL, { cache: 'no-store' });
      if (!r.ok) { remoteOn = false; return; }
      const data = await safeJson(r);
      if (!data) { remoteOn = false; return; }
      remoteOn = true;
      const remoteEvents = Array.isArray(data.events) ? data.events : [];
      if (remoteEvents.length === 0 && events.length > 0) {
        pushRemote();
      } else {
        events = remoteEvents;
        try { localStorage.setItem(KEY_EVENTS, JSON.stringify(events)); } catch {}
      }

      if (Array.isArray(data.movies)) {
        const cleanRemote = data.movies.filter((m) => m && m.id && !DEFAULT_DUMMY_MOVIE_IDS.has(m.id));
        const hadDummies = cleanRemote.length !== data.movies.length;
        movies = deduplicateMovies(cleanRemote);
        try { localStorage.setItem(KEY_MOVIES, JSON.stringify(movies)); } catch {}
        if (hadDummies) {
          pushRemote();
        }
      } else {
        movies = [];
        try { localStorage.setItem(KEY_MOVIES, JSON.stringify(movies)); } catch {}
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
    if (currentUser && currentUser.username) {
      const userTheme = localStorage.getItem(`tigabelas.theme.${currentUser.username}`);
      if (userTheme === 'pink' || userTheme === 'dark') {
        currentTheme = userTheme;
      } else {
        const matched = DEFAULT_USERS.find((u) => u.username === currentUser.username);
        currentTheme = (matched && matched.theme) ? matched.theme : 'dark';
      }
    } else {
      const t = localStorage.getItem(KEY_THEME);
      currentTheme = (t === 'pink' || t === 'dark') ? t : 'dark';
    }
    applyTheme();
  }
  function applyTheme() {
    const isPink = currentTheme === 'pink';
    document.documentElement.classList.toggle('user-fany', isPink);
    document.documentElement.classList.toggle('dark', !isPink);
    
    // Update theme toggle icon, label, and switch inside the profile dropdown
    if (el.themeToggleIcon) {
      if (isPink) {
        el.themeToggleIcon.innerHTML = `<svg class="h-4 w-4 text-pink-500 fill-pink-500" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
      } else {
        el.themeToggleIcon.innerHTML = `<svg class="h-4 w-4 text-neutral-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c.132 0 .263 0 .393.007a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 3z"/></svg>`;
      }
    }
    const themeLabel = $('themeLabelText');
    if (themeLabel) {
      themeLabel.textContent = isPink ? 'Light Mode' : 'Dark Mode';
    }
    const switchTrack = $('themeSwitchTrack');
    const switchThumb = $('themeSwitchThumb');
    if (switchTrack && switchThumb) {
      if (!isPink) {
        // Dark mode is active
        switchTrack.className = 'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-neutral-900 dark:bg-white';
        switchThumb.className = 'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-neutral-900 shadow-sm ring-0 transition duration-200 ease-in-out translate-x-4';
      } else {
        // Light mode is active
        switchTrack.className = 'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-neutral-300 dark:bg-neutral-700';
        switchThumb.className = 'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out translate-x-0';
      }
    }
  }
  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'pink' : 'dark';
    localStorage.setItem(KEY_THEME, currentTheme);
    if (currentUser && currentUser.username) {
      localStorage.setItem(`tigabelas.theme.${currentUser.username}`, currentTheme);
    }
    applyTheme();
    if (!el.dayModal.classList.contains('hidden')) renderDay();
  }

  /* ---------- Authentication ---------- */
  function initAuth() {
    const saved = localStorage.getItem(KEY_AUTH_USER);
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        if (currentUser && !currentUser.permissions) {
          const isLg = currentUser.username && (currentUser.username.toLowerCase() === 'lgiifn' || currentUser.username.toLowerCase() === 'ysfany');
          currentUser.permissions = {
            canManageEvents: true,
            canManageMovies: true,
            canManageUsers: isLg || currentUser.role === 'admin',
          };
          currentUser.role = currentUser.role || (isLg ? 'admin' : 'editor');
        }
      } catch (e) {
        currentUser = null;
      }
    }
    renderAuthState();
  }

  function renderAuthState() {
    const headerInfo = $('profileHeaderInfo');
    const ownerName = $('profileOwnerName');
    const ownerRole = $('profileOwnerRole');
    const loginBtn = $('openLoginModalBtn');
    const logoutBtn = $('logoutBtn');
    const settingsBtn = $('openSettingsModalBtn');

    // Blur protected containers in guest mode (not logged in)
    document.documentElement.classList.toggle('is-guest', !currentUser);

    if (currentUser) {
      if (headerInfo) headerInfo.classList.remove('hidden');
      if (ownerName) ownerName.textContent = currentUser.name;
      if (ownerRole) ownerRole.textContent = currentUser.sex;
      if (loginBtn) loginBtn.classList.add('hidden');
      if (logoutBtn) {
        logoutBtn.classList.remove('hidden');
        logoutBtn.classList.add('flex');
      }

      // Show settings button only if user has canManageUsers permission
      const canManageUsers = currentUser.permissions && currentUser.permissions.canManageUsers;
      if (settingsBtn) {
        settingsBtn.classList.toggle('hidden', !canManageUsers);
        settingsBtn.classList.toggle('flex', !!canManageUsers);
      }
    } else {
      if (headerInfo) headerInfo.classList.add('hidden');
      if (loginBtn) {
        loginBtn.classList.remove('hidden');
        loginBtn.classList.add('flex');
      }
      if (logoutBtn) {
        logoutBtn.classList.add('hidden');
        logoutBtn.classList.remove('flex');
      }
      if (settingsBtn) {
        settingsBtn.classList.add('hidden');
        settingsBtn.classList.remove('flex');
      }
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = (el.loginUsername ? el.loginUsername.value : '').trim().toLowerCase();
    const password = (el.loginPassword ? el.loginPassword.value : '').trim();

    if (!username || !password) return;

    const submitBtn = el.loginForm ? el.loginForm.querySelector('button[type="submit"]') : null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';
    }

    try {
      let matchedUser = null;
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', username, password }),
        });
        const data = await safeJson(res);
        if (res.ok && data && data.ok && data.user) {
          matchedUser = data.user;
        }
      } catch (err) {
        console.warn('API login error, trying local fallback:', err);
      }

      // Local fallback for offline / development
      if (!matchedUser) {
        const localList = getLocalUsers();
        const fallback = localList.find(
          (u) => u.username.toLowerCase() === username && String(u.pass) === password
        );
        if (fallback) {
          matchedUser = {
            id: fallback.id,
            username: fallback.username,
            name: fallback.name,
            sex: fallback.sex,
            theme: fallback.theme,
            role: fallback.role || 'admin',
            permissions: fallback.permissions || {
              canManageEvents: true,
              canManageMovies: true,
              canManageUsers: fallback.role === 'admin',
            },
          };
        }
      }

      if (matchedUser) {
        currentUser = {
          id: matchedUser.id,
          username: matchedUser.username,
          name: matchedUser.name,
          sex: matchedUser.sex,
          theme: matchedUser.theme || 'dark',
          role: matchedUser.role || 'editor',
          permissions: matchedUser.permissions || {
            canManageEvents: true,
            canManageMovies: true,
            canManageUsers: matchedUser.role === 'admin',
          },
        };
        localStorage.setItem(KEY_AUTH_USER, JSON.stringify(currentUser));

        // Load user's saved theme preference or default
        const savedUserTheme = localStorage.getItem(`tigabelas.theme.${matchedUser.username}`);
        currentTheme = (savedUserTheme === 'pink' || savedUserTheme === 'dark') ? savedUserTheme : (matchedUser.theme || 'dark');
        localStorage.setItem(KEY_THEME, currentTheme);
        applyTheme();

        renderAuthState();
        if (el.loginErrorMsg) el.loginErrorMsg.classList.add('hidden');
        if (el.loginForm) el.loginForm.reset();
        closeModal(el.loginModal);
        if (el.profileDropdown) el.profileDropdown.classList.add('hidden');
      } else {
        if (el.loginErrorMsg) {
          el.loginErrorMsg.textContent = 'Invalid username or password.';
          el.loginErrorMsg.classList.remove('hidden');
        }
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
      }
    }
  }

  function handleLogout() {
    currentUser = null;
    localStorage.removeItem(KEY_AUTH_USER);
    renderAuthState();
    if (el.profileDropdown) el.profileDropdown.classList.add('hidden');
    if (el.profileBackdrop) el.profileBackdrop.classList.add('hidden');
    document.documentElement.classList.remove('is-profile-open');
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
      const ev = eventForDate(key);
      const hasEvent = !!ev;
      const hasPhoto = hasEvent && !!ev.photo;

      const numClass = isToday
        ? 'flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white dark:bg-white dark:text-neutral-900'
        : 'flex h-7 w-7 items-center justify-center text-sm font-semibold text-neutral-600 dark:text-neutral-300';

      const ringClass = isToday
        ? 'border-neutral-900 dark:border-white'
        : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700';

      // event indicator — yellow if event has NO photo, white/theme if photo exists
      let dot = '<span class="mb-1.5 h-1.5 w-1.5 sm:mb-2"></span>';
      if (hasEvent) {
        if (hasPhoto) {
          dot = '<span data-ad class="mb-1.5 h-1.5 w-1.5 rounded-full bg-neutral-900 dark:bg-white sm:mb-2"></span>';
        } else {
          dot = '<span class="mb-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 sm:mb-2 shadow-xs"></span>';
        }
      }

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

  // Samakan tinggi sidebar dengan tinggi card kalender (khusus layar lebar & tampilan kalender).
  function syncSidebarHeight(isLarge) {
    if (!el.sidebar) return;
    if (isLarge && currentView === 'calendar' && el.calendarCard && el.calendarCard.offsetHeight > 0) {
      el.sidebar.style.minHeight = el.calendarCard.offsetHeight + 'px';
      el.sidebar.style.height = '';
    } else {
      el.sidebar.style.minHeight = '';
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
        class="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 transition hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:border-neutral-800 dark:hover:bg-neutral-800">${svg}</button>`;
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

    // Segment widths: <=10% Yellow, 10-90% White/Theme, >90% Green
    const yellowPct = Math.min(10, actualPct);
    const whitePct = actualPct > 10 ? Math.min(80, actualPct - 10) : 0;
    const greenPct = actualPct > 90 ? Math.min(10, actualPct - 90) : 0;

    if (el.statsDaysProgress) {
      el.statsDaysProgress.innerHTML = `
        <div class="group relative w-full rounded-xl bg-neutral-50 p-4 text-left dark:bg-neutral-800/50">
          <!-- Pop up tooltip on hover (below progress bar) -->
          <div class="pointer-events-none absolute -bottom-11 left-1/2 -translate-x-1/2 z-20 flex scale-95 items-center gap-1.5 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 dark:bg-neutral-100 dark:text-neutral-900">
            <span>${st.count} Total Events</span>
            <div class="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-neutral-900 dark:bg-neutral-100"></div>
          </div>

          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500">
              <svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              <span class="text-[11px] font-medium leading-tight text-neutral-500 dark:text-neutral-400">Days</span>
            </div>
            <div class="flex items-center">
              <span class="text-xs font-bold text-neutral-900 dark:text-white">${pctFormatted}%</span>
            </div>
          </div>
          <div class="relative h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/70 dark:bg-neutral-700/60">
            <!-- 0% to 10% yellow segment -->
            ${yellowPct > 0 ? `<div class="absolute inset-y-0 left-0 bg-amber-400 transition-all duration-500" style="width: ${yellowPct}%"></div>` : ''}
            <!-- 10% to 90% white / theme segment -->
            ${whitePct > 0 ? `<div class="tgbls-fill absolute inset-y-0 bg-neutral-900 transition-all duration-500 dark:bg-white" data-af style="left: 10%; width: ${whitePct}%"></div>` : ''}
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
        </div>`;
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
  let isMovieSelectMode = false;
  const selectedMovieIds = new Set();

  function toggleWatchedMovieSearch(forceOpen) {
    if (isMovieSelectMode) {
      setMovieSelectMode(false);
    }
    isWatchedSearchActive = (typeof forceOpen === 'boolean') ? forceOpen : !isWatchedSearchActive;

    if (el.moviesHeaderSearchBlock) {
      el.moviesHeaderSearchBlock.classList.toggle('hidden', !isWatchedSearchActive);
      el.moviesHeaderSearchBlock.classList.toggle('flex', isWatchedSearchActive);
    }
    if (el.openAddMovieBtn) {
      el.openAddMovieBtn.classList.toggle('hidden', isWatchedSearchActive);
    }
    if (el.toggleMovieSelectBtn) {
      el.toggleMovieSelectBtn.classList.toggle('hidden', isWatchedSearchActive || movies.length === 0);
    }
    if (el.moviesDesktopControls) {
      // Desktop controls wrapper stays visible so openMovieSearchBtn (acting as back button) remains accessible
      el.moviesDesktopControls.classList.remove('hidden');
      el.moviesDesktopControls.classList.add('sm:flex');
    }
    if (el.openMovieSearchBtn) {
      el.openMovieSearchBtn.classList.remove('hidden');
    }
    if (el.movieMobileActionsBtn) {
      el.movieMobileActionsBtn.classList.toggle('hidden', isWatchedSearchActive);
    }
    if (el.movieMobileSearchCloseBtn) {
      el.movieMobileSearchCloseBtn.classList.toggle('hidden', !isWatchedSearchActive);
      el.movieMobileSearchCloseBtn.classList.toggle('inline-flex', isWatchedSearchActive);
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

  function setMovieSelectMode(active) {
    if (active && isWatchedSearchActive) {
      toggleWatchedMovieSearch(false);
    }
    isMovieSelectMode = active;
    if (!active) {
      selectedMovieIds.clear();
    }
    updateMovieSelectControls();
    renderMoviesGrid();
  }

  function updateMovieSelectControls() {
    if (el.moviesDesktopControls) {
      el.moviesDesktopControls.classList.toggle('hidden', isMovieSelectMode);
      el.moviesDesktopControls.classList.toggle('sm:flex', !isMovieSelectMode);
    }
    if (el.openAddMovieBtn) {
      el.openAddMovieBtn.classList.toggle('hidden', isMovieSelectMode || isWatchedSearchActive);
    }
    if (el.toggleMovieSelectBtn) {
      el.toggleMovieSelectBtn.classList.toggle('hidden', isMovieSelectMode || isWatchedSearchActive || movies.length === 0);
    }
    if (el.openMovieSearchBtn) {
      el.openMovieSearchBtn.classList.toggle('hidden', isMovieSelectMode);
    }
    if (el.movieMobileActionsWrap) {
      el.movieMobileActionsWrap.classList.toggle('hidden', isMovieSelectMode);
    }
    if (el.moviesPager) {
      el.moviesPager.classList.toggle('hidden', isWatchedSearchActive);
    }
    if (el.moviesSelectControls) {
      el.moviesSelectControls.classList.toggle('hidden', !isMovieSelectMode);
      el.moviesSelectControls.classList.toggle('flex', isMovieSelectMode);
    }
    if (el.deleteSelectedMoviesBtn) {
      el.deleteSelectedMoviesBtn.disabled = selectedMovieIds.size === 0;
    }
  }

  function toggleMovieSelection(id) {
    if (selectedMovieIds.has(id)) {
      selectedMovieIds.delete(id);
    } else {
      selectedMovieIds.add(id);
    }
    if (el.deleteSelectedMoviesBtn) {
      el.deleteSelectedMoviesBtn.disabled = selectedMovieIds.size === 0;
    }
    if (el.moviesProgressSubtitle && isMovieSelectMode) {
      el.moviesProgressSubtitle.textContent = `${selectedMovieIds.size} selected`;
    }
    renderMoviesGrid();
  }

  function toggleSelectAllMovies() {
    const filtered = watchedMovieQuery
      ? movies.filter((m) => {
          const q = watchedMovieQuery.toLowerCase();
          const title = (m.title || '').toLowerCase();
          const year = String(m.year || '');
          return title.includes(q) || year.includes(q);
        })
      : movies;

    const allSelected = filtered.length > 0 && filtered.every((m) => selectedMovieIds.has(m.id));
    if (allSelected) {
      filtered.forEach((m) => selectedMovieIds.delete(m.id));
    } else {
      filtered.forEach((m) => selectedMovieIds.add(m.id));
    }

    if (el.deleteSelectedMoviesBtn) {
      el.deleteSelectedMoviesBtn.disabled = selectedMovieIds.size === 0;
    }
    if (el.moviesProgressSubtitle && isMovieSelectMode) {
      el.moviesProgressSubtitle.textContent = `${selectedMovieIds.size} selected`;
    }
    renderMoviesGrid();
  }

  function handleDeleteSelectedMovies() {
    if (!currentUser) {
      toast('Please log in first.');
      return;
    }
    if (currentUser.permissions && !currentUser.permissions.canManageMovies) {
      toast('You do not have permission to delete movies.');
      return;
    }
    if (selectedMovieIds.size === 0) return;
    const count = selectedMovieIds.size;
    const msg = count === 1 ? 'Delete 1 selected movie?' : `Delete ${count} selected movies?`;
    if (!window.confirm(msg)) return;

    movies = movies.filter((m) => !selectedMovieIds.has(m.id));
    selectedMovieIds.clear();
    isMovieSelectMode = false;
    saveMovies();
    updateMovieSelectControls();
    renderMoviesGrid();
    renderStats();
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

    updateMovieSelectControls();

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
      if (isMovieSelectMode) {
        el.moviesProgressSubtitle.textContent = `${selectedMovieIds.size} selected`;
      } else if (watchedMovieQuery) {
        el.moviesProgressSubtitle.textContent = `${filtered.length} found`;
      } else if (filtered.length === 0) {
        el.moviesProgressSubtitle.textContent = '0 movies';
      } else {
        el.moviesProgressSubtitle.textContent = `${moviesPage + 1} of ${totalPages}`;
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
        const isSelected = isMovieSelectMode && selectedMovieIds.has(m.id);

        const selectionBadge = isMovieSelectMode ? `
          <div class="pointer-events-none absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200 ${
            isSelected
              ? 'bg-red-500 text-white shadow-sm ring-2 ring-white dark:ring-neutral-900 scale-100'
              : 'bg-black/50 text-transparent border border-white/70 backdrop-blur-xs scale-90'
          }">
            <svg class="h-3 w-3 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>` : '';

        const placeholderIcon = (!hasTicket && !isSelected) ? `
            <svg class="h-6 w-6 stroke-current transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>` : '';

        const visualBox = hasTicket ? `
          <div data-movie-cover class="group relative aspect-square w-full overflow-hidden rounded-xl border ${
            isSelected
              ? 'border-red-500 ring-2 ring-red-500 shadow-md'
              : 'border-neutral-200 bg-neutral-900 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md dark:border-neutral-800'
          }">
            <img src="${m.ticket}" alt="${escapeHtml(m.title)}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            <div class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10"></div>
            ${selectionBadge}
          </div>` : `
          <div data-movie-cover class="group relative aspect-square w-full overflow-hidden rounded-xl border flex flex-col items-center justify-center transition-all duration-300 ${
            isSelected
              ? 'border-red-500 ring-2 ring-red-500 shadow-md bg-red-50 dark:bg-red-950/30'
              : 'border-dashed border-neutral-300 bg-neutral-100/90 text-neutral-400 group-hover:-translate-y-1 group-hover:border-neutral-400 group-hover:bg-neutral-200/60 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-500 dark:group-hover:border-neutral-600 dark:group-hover:bg-neutral-800 shadow-sm'
          }">
            ${placeholderIcon}
            <div class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/10"></div>
            ${selectionBadge}
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
            class="group flex flex-col cursor-pointer select-none transition-all duration-300 ${isMovieSelectMode && !isSelected ? 'opacity-70 hover:opacity-100' : ''}">
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
      if (isWatchedSearchActive) {
        el.moviesPager.classList.add('hidden');
        el.moviesPager.classList.remove('flex');
        el.moviesPager.innerHTML = '';
      } else {
        el.moviesPager.classList.remove('hidden');
        el.moviesPager.classList.add('flex');
        const navBtn = (data, dis, svg, title) =>
          `<button type="button" ${data} ${dis ? 'disabled' : ''} title="${title}"
            class="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 transition hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:border-neutral-800 dark:hover:bg-neutral-800">${svg}</button>`;
        el.moviesPager.innerHTML = `
          <div class="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-0.5" aria-hidden="true"></div>
          ${navBtn('data-movie-prev', moviesPage === 0, '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>', 'Previous page')}
          ${navBtn('data-movie-next', moviesPage >= totalPages - 1, '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>', 'Next page')}`;
      }
    }
  }

  /* ---------- Add Movie Logic & Search ---------- */
  let searchDebounceTimer = null;
  let selectedMovieData = null;

  function openAddMovie(defaultDate) {
    if (!currentUser) {
      toast('Please log in first.');
      if (el.loginForm) el.loginForm.reset();
      openModal(el.loginModal);
      return;
    }
    if (currentUser.permissions && !currentUser.permissions.canManageMovies) {
      toast('You do not have permission to add movies.');
      return;
    }
    if (!el.addMovieModal) return;
    el.addMovieForm.reset();
    selectedMovieData = null;
    if (el.movieSearchBlock) el.movieSearchBlock.classList.remove('hidden');
    if (el.selectedMovieCard) {
      el.selectedMovieCard.classList.add('hidden');
      el.selectedMovieCard.classList.remove('flex');
    }
    if (el.movieDateInput) el.movieDateInput.value = defaultDate || todayKey();
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
        const data = await safeJson(res);
        if (data && Array.isArray(data.d)) {
          const items = data.d.filter((item) => item.l && (item.i || item.y));
          items.forEach((m) => {
            results.push({
              name: m.l,
              year: m.y ? String(m.y) : '',
              poster: m.i ? m.i.imageUrl : ''
            });
          });
        }
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
          const data = await safeJson(res);
          if (data && Array.isArray(data.metas)) {
            data.metas.filter((m) => m && m.name).forEach((m) => {
              results.push({
                name: m.name,
                year: m.year || (m.releaseInfo ? String(m.releaseInfo).slice(0, 4) : ''),
                poster: m.poster || (m.imdb_id ? `https://images.metahub.space/poster/small/${m.imdb_id}/img` : '')
              });
            });
          }
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
      if (el.movieShowTicketMobileBtn) {
        el.movieShowTicketMobileBtn.disabled = false;
      }
      if (el.movieShowTicketMobileText) {
        el.movieShowTicketMobileText.textContent = isMovieDetailEditing ? 'Change Ticket' : 'Show Ticket';
      }
    } else {
      if (el.movieTicketPreview) {
        el.movieTicketPreview.src = '';
        el.movieTicketPreview.classList.add('hidden');
      }
      if (el.movieTicketEmptyState) el.movieTicketEmptyState.classList.remove('hidden');
      if (el.movieTicketOverlay) el.movieTicketOverlay.classList.add('hidden');
      if (el.movieTicketZoomOverlay) el.movieTicketZoomOverlay.classList.add('hidden');
      if (el.movieShowTicketMobileBtn) {
        el.movieShowTicketMobileBtn.disabled = !isMovieDetailEditing;
      }
      if (el.movieShowTicketMobileText) {
        el.movieShowTicketMobileText.textContent = isMovieDetailEditing ? 'Upload Ticket' : 'No Ticket';
      }
    }
  }

  function formatRatingDisplay(val) {
    if (val === null || val === undefined || val === '') return '';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num) || num <= 0) return '';
    return num % 1 === 0 ? String(Math.round(num)) : num.toFixed(1);
  }

  function setDetailRatingDisplay(val) {
    if (!el.detailRatingInput) return;
    const formatted = formatRatingDisplay(val) || '—';
    el.detailRatingInput.textContent = formatted;
    if ('value' in el.detailRatingInput) {
      el.detailRatingInput.value = formatted;
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
    const formatted = formatRatingDisplay(val) || '0';
    if (span) {
      span.textContent = formatted;
    }

    setDetailRatingDisplay(val);
  }

  function setRatingEditMode(isEditing) {
    isMovieDetailEditing = isEditing;
    const canManage = currentUser && (!currentUser.permissions || currentUser.permissions.canManageMovies);

    if (el.ratingViewMode) el.ratingViewMode.classList.toggle('hidden', isEditing);
    if (el.ratingEditMode) {
      el.ratingEditMode.classList.toggle('hidden', !isEditing);
      el.ratingEditMode.classList.toggle('flex', isEditing);
      if (isEditing) {
        setTimeout(updateRatingSliderBubble, 20);
      }
    }
    if (el.editMovieRatingBtn) {
      el.editMovieRatingBtn.classList.toggle('hidden', isEditing || !canManage);
    }
    if (el.saveMovieRatingBtn) {
      el.saveMovieRatingBtn.classList.toggle('hidden', !isEditing || !canManage);
    }
    if (el.deleteMovieBtn) {
      el.deleteMovieBtn.classList.toggle('hidden', !canManage);
    }
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
    setDetailRatingDisplay(movie.rating);

    setRatingEditMode(Boolean(isNew));

    activeTicketPhoto = movie.ticket || null;
    renderTicketPreview(activeTicketPhoto);

    openModal(el.movieDetailModal);
  }

  async function handleSaveMovieRating() {
    if (!activeDetailMovieId || isSyncingActive) return;
    const movie = movies.find((m) => m.id === activeDetailMovieId);
    if (!movie) return;

    try {
      const num = el.movieRatingSlider ? parseFloat(el.movieRatingSlider.value) : (parseFloat(el.detailRatingInput?.value) || 0);
      if (num > 0) {
        const clamped = Math.min(10, Math.max(0, num));
        movie.rating = formatRatingDisplay(clamped);
      } else {
        movie.rating = '';
      }

      movie.ticket = activeTicketPhoto || '';

      setMovieTicketSyncLoading(true);
      saveMoviesLocally();

      const ok = await pushRemote();
      setMovieTicketSyncLoading(false);

      renderMoviesGrid();
      renderStats();

      // Return to preview/view mode instead of closing the modal
      setDetailRatingDisplay(movie.rating);
      setRatingEditMode(false);
    } catch (err) {
      console.error('Error saving movie rating:', err);
      setMovieTicketSyncLoading(false);
      toast('Failed to save movie rating');
    }
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
    if (view !== 'movies' && isMovieSelectMode) {
      setMovieSelectMode(false);
    }
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
    const isLarge = window.matchMedia('(min-width: 1024px)').matches;
    syncSidebarHeight(isLarge);
    renderUpcoming();
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
  function isDateUpcoming(dateStr) {
    if (!dateStr) return false;
    const d = parseKey(dateStr);
    d.setHours(0, 0, 0, 0);
    return d.getTime() > Date.now();
  }

  function getRemainingTime(dateStr) {
    if (!dateStr) return { days: 0, hrs: 0, min: 0, sec: 0, total: 0 };
    const d = parseKey(dateStr);
    d.setHours(0, 0, 0, 0);
    const remaining = Math.max(0, d.getTime() - Date.now());
    const s = Math.floor(remaining / 1000);
    const days = Math.floor(s / 86400);
    const hrs = Math.floor((s % 86400) / 3600);
    const min = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return { days, hrs, min, sec, total: remaining };
  }

  function getEventCountdownProgress(evDate) {
    if (!evDate) return 0;
    const target = parseKey(evDate);
    target.setHours(0, 0, 0, 0);
    const targetTime = target.getTime();
    const now = Date.now();
    const remaining = targetTime - now;

    if (remaining <= 0) return 100;

    const ONE_HOUR_MS = 60 * 60 * 1000; // 3,600,000 ms (1 hour)
    if (remaining > ONE_HOUR_MS) {
      return 0; // Starts moving only when <= 1 hour left
    }

    const elapsed = ONE_HOUR_MS - remaining;
    return Math.max(0, Math.min(100, (elapsed / ONE_HOUR_MS) * 100));
  }

  function formatCountdownString(dateStr) {
    const rem = getRemainingTime(dateStr);
    if (rem.total <= 0) return '00:00:00:00';
    return `${pad(rem.days)}:${pad(rem.hrs)}:${pad(rem.min)}:${pad(rem.sec)}`;
  }

  function tickCountdown() {
    const ev = nearestEvent();
    if (!ev) {
      if (el.countdownText) el.countdownText.textContent = 'No upcoming events';
    } else {
      if (el.countdownText) el.countdownText.textContent = formatCountdownString(ev.date);
    }

    // Update any live modal countdowns & perimeter progress bars
    let needsDayRerender = false;
    document.querySelectorAll('[data-live-countdown]').forEach((cdEl) => {
      const dateKey = cdEl.dataset.liveCountdown;
      if (!dateKey) return;
      const rem = getRemainingTime(dateKey);
      if (rem.total <= 0) {
        cdEl.textContent = '00:00:00:00';
        if (selectedDate === dateKey && el.dayModal && !el.dayModal.classList.contains('hidden')) {
          needsDayRerender = true;
        }
        if (el.eventModal && !el.eventModal.classList.contains('hidden')) {
          const formDate = el.eventDate ? el.eventDate.value : selectedDate;
          if (formDate === dateKey) renderPhotoForm();
        }
      } else {
        cdEl.textContent = formatCountdownString(dateKey);
      }
    });

    document.querySelectorAll('[data-perimeter-progress]').forEach((progEl) => {
      const dateKey = progEl.dataset.perimeterProgress;
      if (!dateKey) return;
      const pct = getEventCountdownProgress(dateKey);
      progEl.setAttribute('stroke-dashoffset', String((100 - pct).toFixed(2)));
      const svgEl = progEl.closest('svg');
      if (svgEl) {
        svgEl.classList.toggle('hidden', pct <= 0);
      }
    });

    if (needsDayRerender) {
      renderDay();
    }
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
  const MODALS = () => [
    el.userFormModal,
    el.settingsModal,
    el.bookmarksModal,
    el.imageLightboxModal,
    el.movieDetailModal,
    el.addMovieModal,
    el.eventModal,
    el.dayModal,
    el.linkedPhotoModal,
    el.loginModal,
  ];
  function anyModalOpen() { return MODALS().some((m) => m && !m.classList.contains('hidden')); }
  function openModal(m) {
    if (!m) return;
    m.classList.remove('hidden'); m.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(m) {
    if (!m || isSyncingActive) return;
    m.classList.add('hidden'); m.classList.remove('flex');
    if (!anyModalOpen()) document.body.style.overflow = '';
  }
  function closeModalSmart(m) {
    closeModal(m);
  }
  function closeTopModal() {
    if (isSyncingActive) return;
    for (const m of MODALS()) {
      if (m && !m.classList.contains('hidden')) { closeModalSmart(m); break; }
    }
  }

  /* ---------- Bookmarks Modal ---------- */
  function renderBookmarksList() {
    if (!el.bookmarksList) return;
    const bookmarkedEvents = events.filter((e) => e && e.bookmarked);
    if (el.bookmarksCountBadge) el.bookmarksCountBadge.textContent = String(bookmarkedEvents.length);

    if (!bookmarkedEvents.length) {
      el.bookmarksList.innerHTML = `
        <div class="py-12 text-center text-xs text-neutral-400">
          <div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </div>
          <p class="font-medium text-neutral-600 dark:text-neutral-300">No bookmarked events yet</p>
          <p class="mt-1 text-[11px]">Click the bookmark ribbon in any event to save it here.</p>
        </div>`;
      return;
    }

    el.bookmarksList.innerHTML = bookmarkedEvents.map((ev) => {
      const d = parseKey(ev.date);
      const dayName = WEEKDAYS_LONG[d.getDay()].slice(0, 3);
      const monthName = MONTHS[d.getMonth()].slice(0, 3);
      const dateDisplay = `${dayName}, ${d.getDate()} ${monthName} ${d.getFullYear()}`;

      let caption = '';
      if (ev.desc && ev.desc.trim()) {
        caption = ev.desc.replace(/^@(luigi|fany|l|u|f):\s*/i, '').trim().slice(0, 45);
      }

      return `
        <div class="group flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/60">
          <button type="button" data-open-bookmark-date="${ev.date}" class="flex flex-1 items-center gap-3 min-w-0 text-left">
            <div class="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-100 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              <span class="text-sm font-bold leading-none">${d.getDate()}</span>
              <span class="text-[9px] font-medium uppercase">${monthName}</span>
            </div>
            ${ev.photo ? `<img src="${ev.photo}" alt="Thumb" class="h-10 w-10 flex-shrink-0 rounded-lg object-cover bg-neutral-900 shadow-xs" />` : ''}
            <div class="min-w-0 flex-1">
              <h4 class="truncate text-xs sm:text-sm font-bold text-neutral-900 dark:text-white">${escapeHtml(ev.title)}</h4>
              <p class="truncate text-[11px] text-neutral-500 dark:text-neutral-400">${caption ? `"${escapeHtml(caption)}"` : dateDisplay}</p>
            </div>
          </button>
          <button type="button" data-unbookmark-date="${ev.date}" title="Remove bookmark"
            class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-500 active:scale-95 dark:text-neutral-500 dark:hover:bg-red-950/40 dark:hover:text-red-400">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>`;
    }).join('');
  }

  function openBookmarksModal() {
    renderBookmarksList();
    openModal(el.bookmarksModal);
  }

  /* ---------- User Settings & Management ---------- */
  let cachedUsers = [];

  async function fetchUsersList() {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await safeJson(res);
        if (data && data.ok && Array.isArray(data.users)) {
          cachedUsers = data.users;
          setLocalUsers(cachedUsers);
          return cachedUsers;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch users from API:', e);
    }
    // Local fallback
    const local = getLocalUsers();
    cachedUsers = local.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      sex: u.sex,
      theme: u.theme,
      role: u.role || 'admin',
      permissions: u.permissions || {
        canManageEvents: true,
        canManageMovies: true,
        canManageUsers: u.role === 'admin',
      },
      createdAt: u.createdAt || Date.now(),
    }));
    return cachedUsers;
  }

  async function openSettingsModal() {
    if (el.profileDropdown) el.profileDropdown.classList.add('hidden');
    if (el.profileBackdrop) el.profileBackdrop.classList.add('hidden');
    document.documentElement.classList.remove('is-profile-open');
    openModal(el.settingsModal);
    renderUsersListLoading();
    await fetchUsersList();
    renderUsersList();
  }

  function renderUsersListLoading() {
    if (!el.usersListContainer) return;
    el.usersListContainer.innerHTML = `
      <div class="flex items-center justify-center py-8 text-xs text-neutral-400">
        <svg class="h-4 w-4 animate-spin text-neutral-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Loading users...</span>
      </div>`;
  }

  function renderUsersList() {
    if (!el.usersListContainer) return;
    if (el.usersCountBadge) el.usersCountBadge.textContent = String(cachedUsers.length);

    if (!cachedUsers.length) {
      el.usersListContainer.innerHTML = `
        <div class="py-8 text-center text-xs text-neutral-400">No users found.</div>`;
      return;
    }

    el.usersListContainer.innerHTML = cachedUsers.map((u) => {
      const isCurrent = currentUser && (currentUser.id === u.id || currentUser.username.toLowerCase() === u.username.toLowerCase());
      const displayName = u.name || u.username;

      return `
        <button type="button" data-edit-user-id="${u.id}" title="Click to edit user"
          class="group flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-2.5 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800/40 dark:hover:border-neutral-700 dark:hover:bg-neutral-800">
          <div class="min-w-0 flex-1 flex items-center gap-1.5 truncate">
            <span class="truncate text-xs font-bold text-neutral-900 dark:text-white">${escapeHtml(displayName)}</span>
            <span class="flex-shrink-0 text-xs font-medium text-neutral-400 dark:text-neutral-500">(@${escapeHtml(u.username)})</span>
          </div>
          ${isCurrent ? `
          <svg class="h-4 w-4 flex-shrink-0 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" title="Active Account">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>` : ''}
        </button>`;
    }).join('');
  }

  function openAddUserModal() {
    if (!el.userForm) return;
    el.userForm.reset();
    if (el.userFormId) el.userFormId.value = '';
    if (el.userFormModalTitle) el.userFormModalTitle.textContent = 'Add User';
    if (el.userFormPassReqStar) el.userFormPassReqStar.classList.remove('hidden');
    if (el.userFormPassHint) el.userFormPassHint.classList.add('hidden');
    if (el.userFormPassword) el.userFormPassword.required = true;
    if (el.userFormErrorMsg) el.userFormErrorMsg.classList.add('hidden');
    if (el.permEvents) el.permEvents.checked = true;
    if (el.permMovies) el.permMovies.checked = true;
    if (el.permUsers) el.permUsers.checked = false;
    if (el.deleteUserFromFormBtn) el.deleteUserFromFormBtn.classList.add('hidden');
    openModal(el.userFormModal);
  }

  function openEditUserModal(userId) {
    const u = cachedUsers.find((user) => user.id === userId);
    if (!u || !el.userForm) return;
    el.userForm.reset();
    if (el.userFormId) el.userFormId.value = u.id;
    if (el.userFormModalTitle) el.userFormModalTitle.textContent = 'Edit User';
    if (el.userFormUsername) el.userFormUsername.value = u.username;
    if (el.userFormPassword) el.userFormPassword.required = false;
    if (el.userFormPassReqStar) el.userFormPassReqStar.classList.add('hidden');
    if (el.userFormPassHint) el.userFormPassHint.classList.remove('hidden');
    if (el.userFormName) el.userFormName.value = u.name || '';
    if (el.userFormSex) el.userFormSex.value = u.sex === 'Her' ? 'Her' : 'Him';
    if (el.userFormTheme) el.userFormTheme.value = u.theme || 'dark';
    const perms = u.permissions || {};
    if (el.permEvents) el.permEvents.checked = Boolean(perms.canManageEvents);
    if (el.permMovies) el.permMovies.checked = Boolean(perms.canManageMovies);
    if (el.permUsers) el.permUsers.checked = Boolean(perms.canManageUsers);
    if (el.userFormErrorMsg) el.userFormErrorMsg.classList.add('hidden');

    const isCurrent = currentUser && (currentUser.id === u.id || currentUser.username.toLowerCase() === u.username.toLowerCase());
    if (el.deleteUserFromFormBtn) {
      if (!isCurrent && cachedUsers.length > 1) {
        el.deleteUserFromFormBtn.classList.remove('hidden');
      } else {
        el.deleteUserFromFormBtn.classList.add('hidden');
      }
    }
    openModal(el.userFormModal);
  }

  async function handleUserFormSubmit(e) {
    e.preventDefault();
    const id = el.userFormId ? el.userFormId.value : '';
    const username = (el.userFormUsername ? el.userFormUsername.value : '').trim().toLowerCase();
    const pass = (el.userFormPassword ? el.userFormPassword.value : '').trim();
    const name = (el.userFormName ? el.userFormName.value : '').trim() || username;
    const sex = el.userFormSex ? el.userFormSex.value : 'Him';
    const theme = el.userFormTheme ? el.userFormTheme.value : 'dark';
    const permissions = {
      canManageEvents: el.permEvents ? el.permEvents.checked : true,
      canManageMovies: el.permMovies ? el.permMovies.checked : true,
      canManageUsers: el.permUsers ? el.permUsers.checked : false,
    };

    if (!username) return;
    if (!id && !pass) {
      if (el.userFormErrorMsg) {
        el.userFormErrorMsg.textContent = 'Password is required for new user.';
        el.userFormErrorMsg.classList.remove('hidden');
      }
      return;
    }

    const userPayload = { id, username, pass, name, sex, theme, permissions };
    if (el.saveUserBtn) {
      el.saveUserBtn.disabled = true;
      el.saveUserBtn.textContent = 'Saving...';
    }

    try {
      let savedViaApi = false;
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', user: userPayload }),
        });
        const data = await safeJson(res);
        if (res.ok && data && data.ok) {
          savedViaApi = true;
          if (Array.isArray(data.users)) {
            cachedUsers = data.users;
            setLocalUsers(cachedUsers);
          }
        }
      } catch (err) {
        console.warn('API save user error, using local fallback:', err);
      }

      if (!savedViaApi) {
        // Local save fallback
        const local = getLocalUsers();
        const existingIdx = local.findIndex((u) => u.id === id || u.username.toLowerCase() === username);
        if (id && existingIdx !== -1) {
          const existing = local[existingIdx];
          local[existingIdx] = {
            ...existing,
            username,
            name,
            sex,
            theme,
            pass: pass || existing.pass,
            permissions,
          };
        } else {
          if (existingIdx !== -1) {
            throw new Error('Username already taken.');
          }
          local.push({
            id: 'usr_' + Math.random().toString(36).substring(2, 9),
            username,
            pass,
            name,
            sex,
            theme,
            permissions,
            createdAt: Date.now(),
          });
        }
        setLocalUsers(local);
        cachedUsers = local.map((u) => ({ ...u, pass: undefined }));
      }

      // If updating current user's profile
      if (currentUser && (currentUser.id === id || currentUser.username.toLowerCase() === username)) {
        currentUser.name = name;
        currentUser.sex = sex;
        currentUser.theme = theme;
        currentUser.permissions = permissions;
        localStorage.setItem(KEY_AUTH_USER, JSON.stringify(currentUser));
        renderAuthState();
      }

      closeModal(el.userFormModal);
      renderUsersList();
    } catch (err) {
      if (el.userFormErrorMsg) {
        el.userFormErrorMsg.textContent = String(err.message || err);
        el.userFormErrorMsg.classList.remove('hidden');
      }
    } finally {
      if (el.saveUserBtn) {
        el.saveUserBtn.disabled = false;
        el.saveUserBtn.textContent = 'Save User';
      }
    }
  }

  async function handleDeleteUser(userId) {
    const u = cachedUsers.find((user) => user.id === userId);
    if (!u) return false;

    if (currentUser && (currentUser.id === userId || currentUser.username.toLowerCase() === u.username.toLowerCase())) {
      toast('You cannot delete your own active account');
      return false;
    }

    if (cachedUsers.length <= 1) {
      toast('Cannot delete the last user');
      return false;
    }

    if (!window.confirm(`Delete user "${u.name || u.username}"?`)) return false;

    try {
      let deletedViaApi = false;
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: userId }),
        });
        const data = await safeJson(res);
        if (res.ok && data && data.ok) {
          deletedViaApi = true;
          if (Array.isArray(data.users)) {
            cachedUsers = data.users;
            setLocalUsers(cachedUsers);
          }
        }
      } catch (err) {
        console.warn('API delete user error, using local fallback:', err);
      }

      if (!deletedViaApi) {
        const local = getLocalUsers().filter((user) => user.id !== userId);
        setLocalUsers(local);
        cachedUsers = local.map((user) => ({ ...user, pass: undefined }));
      }

      renderUsersList();
      return true;
    } catch (err) {
      toast('Error deleting user: ' + err.message);
      return false;
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
  function updateDayBookmarkBtn(ev) {
    const btn = $('bookmarkDayBtn');
    if (!btn) return;
    const isBookmarked = !!(ev && ev.bookmarked);
    btn.dataset.bookmarked = String(isBookmarked);
    const svg = btn.querySelector('svg');
    if (isBookmarked) {
      if (svg) svg.setAttribute('fill', 'currentColor');
      btn.classList.add('text-neutral-900', 'dark:text-white');
      btn.classList.remove('text-neutral-400', 'dark:text-neutral-500');
    } else {
      if (svg) svg.setAttribute('fill', 'none');
      btn.classList.remove('text-neutral-900', 'dark:text-white');
      btn.classList.add('text-neutral-600', 'dark:text-neutral-300');
    }
  }
  function renderDay() {
    const ev = eventForDate(selectedDate);
    renderDayBody(ev);
    renderDayFooter(ev);
    updateDayBookmarkBtn(ev);
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
            <!-- In-Photo Sync Loading Overlay -->
            <div id="detailCropSyncOverlay" class="hidden absolute inset-0 z-20 items-center justify-center rounded-2xl bg-neutral-950/60 backdrop-blur-xs animate-fade-in pointer-events-auto">
              <svg class="h-8 w-8 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
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
                  <div class="pointer-events-none absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-xs shadow-sm">
                    <svg class="h-3 w-3 fill-none stroke-current" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
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
    } else if (isDateUpcoming(ev.date)) {
      const progPct = getEventCountdownProgress(ev.date);
      photoHtml = `
        <div class="flex justify-center">
          <div class="flex aspect-square w-full max-w-[190px] sm:max-w-[210px] flex-col items-center justify-center gap-2.5 sm:gap-3 rounded-2xl border border-dashed border-neutral-300 p-4 text-center dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 shadow-xs">
            <!-- Circular Icon with Progress Ring -->
            <div class="relative flex h-13 w-13 sm:h-15 sm:w-15 items-center justify-center">
              <!-- SVG Progress Ring (shown only in final 1 hour) -->
              <svg class="pointer-events-none absolute inset-0 h-full w-full -rotate-90 transform ${progPct > 0 ? '' : 'hidden'}" viewBox="0 0 44 44">
                <!-- Track -->
                <circle cx="22" cy="22" r="19" fill="none"
                  class="stroke-neutral-200/90 dark:stroke-neutral-700/70" stroke-width="2.5" />
                <!-- Progress -->
                <circle cx="22" cy="22" r="19" fill="none"
                  pathLength="100"
                  stroke-dasharray="100"
                  stroke-dashoffset="${(100 - progPct).toFixed(1)}"
                  class="tgbls-stroke stroke-neutral-900 transition-[stroke-dashoffset] duration-700 dark:stroke-white"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  data-perimeter-progress="${ev.date}" />
              </svg>

              <!-- Inner Circle Icon Container -->
              <div class="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 shadow-xs">
                <svg class="h-5 w-5 sm:h-5.5 sm:w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div class="w-full px-0.5">
              <p class="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Event will start in</p>
              <p class="mt-1.5 font-space text-xl sm:text-[22px] font-extrabold tracking-tighter text-neutral-900 dark:text-white tabular-nums whitespace-nowrap leading-none" data-live-countdown="${ev.date}">
                ${formatCountdownString(ev.date)}
              </p>
            </div>
          </div>
        </div>`;
      if (captionText) {
        photoHtml += `
          <div class="mt-3 px-2 text-center">
            <span class="inline-block max-w-full text-sm font-normal text-neutral-500 dark:text-neutral-400 break-words">"${escapeHtml(captionText)}"</span>
          </div>`;
      }
    } else {
      photoHtml = `
        <div class="flex justify-center">
          <button type="button" data-detail-upload="${ev.id}"
            class="group flex aspect-square w-full max-w-[190px] sm:max-w-[210px] flex-col items-center justify-center gap-2.5 sm:gap-3 rounded-2xl border border-dashed border-neutral-300 p-4 text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <div class="flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 shadow-xs">
              <svg class="h-6 w-6 sm:h-6.5 sm:w-6.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
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
    const canManage = currentUser && currentUser.permissions && currentUser.permissions.canManageEvents;

    if (!currentUser) {
      el.dayModalFooter.innerHTML = `
        <div class="flex w-full items-center justify-between gap-2">
          <p class="text-[11px] text-neutral-400">Log in to add or edit notes.</p>
          <button type="button" data-close-modal class="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold transition hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800">
            Close
          </button>
        </div>`;
    } else if (!ev) {
      el.dayModalFooter.innerHTML = `
        <div class="flex w-full items-center justify-end gap-2">
          <button type="button" data-close-modal class="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold transition hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800">
            Close
          </button>
          ${canManage ? `
          <button type="button" id="addEventBtn"
            class="tgbls-fill rounded-xl border border-transparent bg-clip-padding bg-neutral-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
            Add Event
          </button>` : ''}
        </div>`;
    } else {
      el.dayModalFooter.innerHTML = `
        <div class="flex w-full items-center justify-between gap-2">
          ${canManage ? `
          <button type="button" data-delete="${ev.id}"
            class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/40">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>` : '<div></div>'}
          <div class="flex gap-2">
            <button type="button" data-close-modal class="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold transition hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800">
              Close
            </button>
            ${canManage ? `
            <button type="button" data-edit="${ev.id}"
              class="tgbls-fill rounded-xl border border-transparent bg-clip-padding bg-neutral-900 px-5 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
              Edit
            </button>` : ''}
          </div>
        </div>`;
    }
    el.dayModalFooter.classList.remove('hidden');
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

  let isFormPhotoEditing = false;

  function loadPhotoForCropping(src, startInEditMode = true) {
    if (!src) {
      cropImageObj = null;
      formPhoto = null;
      isFormPhotoEditing = false;
      renderPhotoForm();
      return;
    }
    isFormPhotoEditing = startInEditMode;
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
      if (el.eventPhotoDisplayImg) {
        el.eventPhotoDisplayImg.src = src;
      }
      renderPhotoForm();
      if (isFormPhotoEditing) {
        setTimeout(updateCropperTransform, 30);
      }
    };
    img.onerror = () => {
      cropImageObj = null;
      formPhoto = null;
      isFormPhotoEditing = false;
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
      el.photoResetBtn.classList.toggle('hidden', !isModified || !isFormPhotoEditing);
    }
  }

  function exportCroppedSquarePhoto(targetSize = 800, quality = 0.6) {
    if (!isFormPhotoEditing || !cropImageObj) return formPhoto;
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
    const isEdit = Boolean(el.eventId && el.eventId.value);
    const dateVal = el.eventDate ? el.eventDate.value : selectedDate;
    const isUpcoming = isDateUpcoming(dateVal);

    if (el.eventPhotoSection) {
      el.eventPhotoSection.classList.toggle('hidden', !isEdit || isUpcoming);
    }

    if (formPhoto) {
      if (el.photoPreviewContainer) {
        el.photoPreviewContainer.classList.remove('hidden');
        el.photoPreviewContainer.classList.add('flex');
      }
      if (el.photoUploadActions) el.photoUploadActions.classList.add('hidden');

      if (isFormPhotoEditing) {
        if (el.eventPhotoDisplayWrap) el.eventPhotoDisplayWrap.classList.add('hidden');
        if (el.photoCropEditWrap) {
          el.photoCropEditWrap.classList.remove('hidden');
          el.photoCropEditWrap.classList.add('flex');
        }
        updateCropperTransform();
      } else {
        if (el.eventPhotoDisplayWrap) el.eventPhotoDisplayWrap.classList.remove('hidden');
        if (el.eventPhotoDisplayImg) el.eventPhotoDisplayImg.src = formPhoto;
        if (el.photoCropEditWrap) {
          el.photoCropEditWrap.classList.add('hidden');
          el.photoCropEditWrap.classList.remove('flex');
        }
        if (el.photoResetBtn) el.photoResetBtn.classList.add('hidden');
      }
    } else {
      cropImageObj = null;
      isFormPhotoEditing = false;
      if (el.eventPhotoPreview) el.eventPhotoPreview.src = '';
      if (el.eventPhotoDisplayImg) el.eventPhotoDisplayImg.src = '';
      if (el.photoPreviewContainer) {
        el.photoPreviewContainer.classList.add('hidden');
        el.photoPreviewContainer.classList.remove('flex');
      }
      if (el.eventPhotoInput) el.eventPhotoInput.value = '';
      if (el.photoResetBtn) el.photoResetBtn.classList.add('hidden');
      if (el.photoUploadActions) el.photoUploadActions.classList.remove('hidden');
    }
  }

  /* ---------- Linked Photo Library Modal ---------- */
  let currentLinkedPhotoTab = 'all';

  function openLinkedPhotoModal() {
    if (!el.linkedPhotoModal) return;
    currentLinkedPhotoTab = 'all';
    updateLinkedPhotoTabs();
    renderLinkedPhotoGrid();
    openModal(el.linkedPhotoModal);
  }

  function updateLinkedPhotoTabs() {
    if (!el.linkedPhotoTabs) return;
    el.linkedPhotoTabs.querySelectorAll('[data-linked-tab]').forEach((btn) => {
      const isTarget = btn.dataset.linkedTab === currentLinkedPhotoTab;
      btn.className = isTarget
        ? 'rounded-full bg-neutral-900 px-3.5 py-1 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900 transition-colors'
        : 'rounded-full px-3.5 py-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors';
    });
  }

  function getLinkedPhotosList() {
    const items = [];

    // From Movies: user-uploaded ticket photos (excluding posters)
    movies.forEach((m) => {
      if (m.ticket) {
        items.push({
          id: `movie-ticket-${m.id}`,
          type: 'movies',
          typeLabel: 'Ticket',
          title: m.title,
          date: m.date,
          src: m.ticket
        });
      }
    });

    return items;
  }

  function renderLinkedPhotoGrid() {
    if (!el.linkedPhotoGrid) return;
    const allItems = getLinkedPhotosList();
    const filtered = currentLinkedPhotoTab === 'all'
      ? allItems
      : allItems.filter((it) => it.type === currentLinkedPhotoTab);

    if (!filtered.length) {
      el.linkedPhotoGrid.innerHTML = `
        <div class="col-span-full py-12 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p class="text-sm font-semibold text-neutral-700 dark:text-neutral-300">No photos available</p>
          <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            ${currentLinkedPhotoTab === 'food' ? 'No food photos added yet.' : currentLinkedPhotoTab === 'movies' ? 'No movie photos or posters available.' : 'No photos found in your movies or food collection.'}
          </p>
        </div>`;
      return;
    }

    el.linkedPhotoGrid.innerHTML = filtered.map((item) => `
      <div data-select-linked-src="${encodeURIComponent(item.src)}"
        class="group flex flex-col cursor-pointer select-none rounded-xl border border-neutral-200 bg-neutral-50 p-1.5 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-800/40 dark:hover:border-neutral-600">
        <div class="relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-900 shadow-xs">
          <img src="${item.src}" alt="${escapeHtml(item.title)}" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
          <span class="absolute top-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs">
            ${escapeHtml(item.typeLabel)}
          </span>
        </div>
        <div class="mt-1 px-0.5 text-center min-w-0">
          <h5 class="truncate text-[11px] font-bold text-neutral-800 dark:text-neutral-200">${escapeHtml(item.title)}</h5>
          ${item.date ? `<p class="truncate text-[9px] text-neutral-400 dark:text-neutral-500">${escapeHtml(item.date)}</p>` : ''}
        </div>
      </div>`).join('');
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
      if (ev.photo) {
        loadPhotoForCropping(ev.photo, false);
      } else {
        formPhoto = null;
        cropImageObj = null;
        isFormPhotoEditing = false;
        renderPhotoForm();
      }
    } else {
      el.eventModalTitle.textContent = 'Add Event';
      el.eventId.value = '';
      el.eventDate.value = selectedDate || todayKey();
      formPhoto = null;
      cropImageObj = null;
      isFormPhotoEditing = false;
      renderPhotoForm();
    }

    const titleCountEl = $('eventTitleCharCount');
    if (titleCountEl) {
      titleCountEl.textContent = `${(el.eventTitle.value || '').length}/50`;
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

  async function handleEventSubmit(e) {
    e.preventDefault();
    if (isSyncingActive) return;

    try {
      const title = el.eventTitle.value.trim().slice(0, 50);
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
      const hasPhoto = Boolean(finalPhoto);

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

      if (hasPhoto) {
        setEventPhotoSyncLoading(true);
      } else {
        isSyncingActive = true;
      }

      saveEventsLocally();
      const ok = await pushRemote();

      if (hasPhoto) {
        setEventPhotoSyncLoading(false);
      } else {
        isSyncingActive = false;
      }

      closeModal(el.eventModal);

      selectedDate = date;
      const d = parseKey(date);
      viewYear = d.getFullYear();
      viewMonth = d.getMonth();
      renderAll();

      openDay(date);
    } catch (err) {
      console.error('Error saving event:', err);
      setEventPhotoSyncLoading(false);
      isSyncingActive = false;
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
    // Profile Dropdown Toggle with Backdrop Blur
    const profileBtn = $('profileBtn');
    const profileDropdown = $('profileDropdown');
    const profileBackdrop = $('profileBackdrop');

    function toggleProfileDropdown(force) {
      if (!profileDropdown) return;
      const isHidden = profileDropdown.classList.contains('hidden');
      const willOpen = typeof force === 'boolean' ? force : isHidden;
      document.documentElement.classList.toggle('is-profile-open', willOpen);
      if (willOpen) {
        profileDropdown.classList.remove('hidden');
        if (profileBackdrop) profileBackdrop.classList.remove('hidden');
      } else {
        profileDropdown.classList.add('hidden');
        if (profileBackdrop) profileBackdrop.classList.add('hidden');
      }
    }

    if (profileBtn && profileDropdown) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfileDropdown();
      });

      if (profileBackdrop) {
        profileBackdrop.addEventListener('click', () => {
          toggleProfileDropdown(false);
        });
      }

      document.addEventListener('click', (e) => {
        if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
          toggleProfileDropdown(false);
        }
      });
    }

    if (el.openLoginModalBtn) {
      el.openLoginModalBtn.addEventListener('click', () => {
        toggleProfileDropdown(false);
        if (el.loginErrorMsg) el.loginErrorMsg.classList.add('hidden');
        if (el.loginForm) el.loginForm.reset();
        openModal(el.loginModal);
      });
    }
    if (el.logoutBtn) {
      el.logoutBtn.addEventListener('click', () => {
        toggleProfileDropdown(false);
        handleLogout();
      });
    }
    if (el.loginForm) {
      el.loginForm.addEventListener('submit', handleLoginSubmit);
    }

    if (el.openSettingsModalBtn) {
      el.openSettingsModalBtn.addEventListener('click', () => {
        toggleProfileDropdown(false);
        openSettingsModal();
      });
    }
    if (el.openAddUserBtn) {
      el.openAddUserBtn.addEventListener('click', openAddUserModal);
    }
    if (el.userForm) {
      el.userForm.addEventListener('submit', handleUserFormSubmit);
    }
    if (el.deleteUserFromFormBtn) {
      el.deleteUserFromFormBtn.addEventListener('click', async () => {
        const id = el.userFormId ? el.userFormId.value : '';
        if (id) {
          const deleted = await handleDeleteUser(id);
          if (deleted) closeModal(el.userFormModal);
        }
      });
    }

    if (el.themeToggleBtn) {
      el.themeToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTheme();
      });
    }

    if (el.prevBtn) el.prevBtn.addEventListener('click', () => changeMonth(-1));
    if (el.nextBtn) el.nextBtn.addEventListener('click', () => changeMonth(1));
    if (el.todayBtn) el.todayBtn.addEventListener('click', goToday);

    if (el.eventForm) el.eventForm.addEventListener('submit', handleEventSubmit);
    if (el.eventDate) {
      el.eventDate.addEventListener('input', () => renderPhotoForm());
      el.eventDate.addEventListener('change', () => renderPhotoForm());
    }

    // Movie controls & modal listeners
    if (el.openAddMovieBtn) el.openAddMovieBtn.addEventListener('click', openAddMovie);
    if (el.toggleMovieSelectBtn) el.toggleMovieSelectBtn.addEventListener('click', () => setMovieSelectMode(true));
    if (el.selectAllMoviesBtn) el.selectAllMoviesBtn.addEventListener('click', toggleSelectAllMovies);
    if (el.deleteSelectedMoviesBtn) el.deleteSelectedMoviesBtn.addEventListener('click', handleDeleteSelectedMovies);
    if (el.cancelMovieSelectBtn) el.cancelMovieSelectBtn.addEventListener('click', () => setMovieSelectMode(false));
    if (el.openMovieSearchBtn) el.openMovieSearchBtn.addEventListener('click', () => toggleWatchedMovieSearch());

    // Mobile Actions Menu listeners
    if (el.movieMobileActionsBtn) {
      el.movieMobileActionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (el.movieMobileActionsMenu) {
          el.movieMobileActionsMenu.classList.toggle('hidden');
        }
      });
    }
    if (el.movieMobileSearchCloseBtn) {
      el.movieMobileSearchCloseBtn.addEventListener('click', () => toggleWatchedMovieSearch(false));
    }
    if (el.mobileAddMovieBtn) {
      el.mobileAddMovieBtn.addEventListener('click', () => {
        if (el.movieMobileActionsMenu) el.movieMobileActionsMenu.classList.add('hidden');
        openAddMovie();
      });
    }
    if (el.mobileSearchMovieBtn) {
      el.mobileSearchMovieBtn.addEventListener('click', () => {
        if (el.movieMobileActionsMenu) el.movieMobileActionsMenu.classList.add('hidden');
        toggleWatchedMovieSearch(true);
      });
    }
    if (el.mobileSelectMovieBtn) {
      el.mobileSelectMovieBtn.addEventListener('click', () => {
        if (el.movieMobileActionsMenu) el.movieMobileActionsMenu.classList.add('hidden');
        setMovieSelectMode(true);
      });
    }
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
          if (isMovieSelectMode) {
            toggleMovieSelection(card.dataset.openMovieId);
          } else {
            openMovieDetail(card.dataset.openMovieId);
          }
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
          setDetailRatingDisplay(movie.rating);
        }
        setRatingEditMode(false);
      });
    }
    if (el.movieRatingSlider) {
      el.movieRatingSlider.addEventListener('input', updateRatingSliderBubble);
    }

    // Movie Ticket Photo handlers
    const handleTicketAction = () => {
      if (isMovieDetailEditing || !activeTicketPhoto) {
        if (el.movieTicketInput) el.movieTicketInput.click();
      } else {
        if (el.lightboxImage) el.lightboxImage.src = activeTicketPhoto;
        if (el.imageLightboxModal) openModal(el.imageLightboxModal);
      }
    };

    if (el.movieTicketBox) {
      el.movieTicketBox.addEventListener('click', handleTicketAction);
    }
    if (el.movieShowTicketMobileBtn) {
      el.movieShowTicketMobileBtn.addEventListener('click', handleTicketAction);
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

    if (el.eventTitle) {
      el.eventTitle.addEventListener('input', () => {
        const count = (el.eventTitle.value || '').length;
        const counter = $('eventTitleCharCount');
        if (counter) counter.textContent = `${count}/50`;
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
    if (el.linkPhotoBtn) el.linkPhotoBtn.addEventListener('click', openLinkedPhotoModal);
    if (el.linkedPhotoTabs) {
      el.linkedPhotoTabs.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('[data-linked-tab]');
        if (tabBtn) {
          currentLinkedPhotoTab = tabBtn.dataset.linkedTab;
          updateLinkedPhotoTabs();
          renderLinkedPhotoGrid();
        }
      });
    }

    // Event Header Bookmark & Share handlers
    const handleShareEvent = (title, date, desc) => {
      const text = `${title || 'Event'}${date ? ` (${date})` : ''}${desc ? `\n"${desc}"` : ''}`;
      if (navigator.share) {
        navigator.share({ title: title || 'Event', text }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    };

    const bookmarkDayBtn = $('bookmarkDayBtn');
    if (bookmarkDayBtn) {
      bookmarkDayBtn.addEventListener('click', () => {
        const ev = eventForDate(selectedDate);
        if (!ev) return;
        ev.bookmarked = !ev.bookmarked;
        saveEvents();
        updateDayBookmarkBtn(ev);
        renderBookmarksList();
      });
    }

    // Day Header Add Dropdown Handlers
    if (el.dayAddDropdownBtn) {
      el.dayAddDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (el.dayAddDropdownMenu) {
          el.dayAddDropdownMenu.classList.toggle('hidden');
        }
      });
    }
    if (el.dayAddMovieOptionBtn) {
      el.dayAddMovieOptionBtn.addEventListener('click', () => {
        if (el.dayAddDropdownMenu) el.dayAddDropdownMenu.classList.add('hidden');
        openAddMovie(selectedDate);
      });
    }
    if (el.dayAddFoodOptionBtn) {
      el.dayAddFoodOptionBtn.addEventListener('click', () => {
        if (el.dayAddDropdownMenu) el.dayAddDropdownMenu.classList.add('hidden');
        toast('Food tracking feature is in progress');
      });
    }
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
    if (el.eventPhotoDisplayWrap) {
      el.eventPhotoDisplayWrap.addEventListener('click', (e) => {
        if (e.target.closest('#removePhotoBtn')) return;
        isFormPhotoEditing = true;
        renderPhotoForm();
        setTimeout(updateCropperTransform, 30);
      });
    }

    if (el.removePhotoBtn) {
      el.removePhotoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        formPhoto = null;
        cropImageObj = null;
        isFormPhotoEditing = false;
        renderPhotoForm();
      });
    }

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
    document.addEventListener('click', async (e) => {
      // close day add dropdown when clicking outside
      if (!e.target.closest('#dayAddMenuWrap')) {
        if (el.dayAddDropdownMenu) el.dayAddDropdownMenu.classList.add('hidden');
      }

      // close movie mobile actions dropdown when clicking outside
      if (!e.target.closest('#movieMobileActionsWrap')) {
        if (el.movieMobileActionsMenu) el.movieMobileActionsMenu.classList.add('hidden');
      }

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

      const editUserBtn = e.target.closest('[data-edit-user-id]');
      if (editUserBtn) {
        openEditUserModal(editUserBtn.dataset.editUserId);
        return;
      }

      const deleteUserBtn = e.target.closest('[data-delete-user-id]');
      if (deleteUserBtn) {
        handleDeleteUser(deleteUserBtn.dataset.deleteUserId);
        return;
      }

      const selectLinkedBtn = e.target.closest('[data-select-linked-src]');
      if (selectLinkedBtn) {
        const src = decodeURIComponent(selectLinkedBtn.dataset.selectLinkedSrc);
        if (src) {
          loadPhotoForCropping(src);
          if (el.linkedPhotoModal) closeModal(el.linkedPhotoModal);
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
      if (detailSaveBtn && !isSyncingActive) {
        const ev = eventForDate(selectedDate);
        if (ev && detailCropImageObj) {
          const cropped = exportDetailCroppedSquarePhoto();
          if (cropped) {
            ev.photo = cropped;
            setDetailCropSyncLoading(true);
            saveEventsLocally();
            const ok = await pushRemote();
            setDetailCropSyncLoading(false);

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

      const bookmarkOpenBtn = e.target.closest('#openBookmarksBtn');
      if (bookmarkOpenBtn) {
        openBookmarksModal();
        return;
      }

      const openBookmarkItem = e.target.closest('[data-open-bookmark-date]');
      if (openBookmarkItem) {
        const date = openBookmarkItem.dataset.openBookmarkDate;
        closeModal(el.bookmarksModal);
        openDay(date);
        return;
      }

      const unbookmarkBtn = e.target.closest('[data-unbookmark-date]');
      if (unbookmarkBtn) {
        const date = unbookmarkBtn.dataset.unbookmarkDate;
        const ev = eventForDate(date);
        if (ev) {
          ev.bookmarked = false;
          saveEvents();
          renderBookmarksList();
          if (selectedDate === date && el.dayModal && !el.dayModal.classList.contains('hidden')) {
            updateDayBookmarkBtn(ev);
          }
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

    // ESC menutup modal teratas atau keluar mode seleksi
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isMovieSelectMode) {
          setMovieSelectMode(false);
          return;
        }
        closeTopModal();
      }
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
    initAuth();
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
