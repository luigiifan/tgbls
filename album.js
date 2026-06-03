/* ============================================================
   Tigabelas — Photo Album
   Upload (multiple) → choose the event the photos belong to →
   stored in localStorage (downscaled). Uniform grid + search.
   ============================================================ */
(function () {
  'use strict';

  const KEY_THEME = 'tigabelas.theme';
  const KEY_PHOTOS = 'tigabelas.photos.v1';
  const KEY_EVENTS = 'tigabelas.events.v1';
  const KEY_TAGS = 'tigabelas.tags.v1';
  const MAX_DIM = 1600;
  const QUALITY = 0.82;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const $ = (id) => document.getElementById(id);
  let photos = [];
  let pendingPhotos = [];   // current upload batch awaiting event assignment
  let chosenEvent = null;   // event picked in step 1
  let chosenTimeline = [];  // its (filtered) timeline items for step 2

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    const dark = theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    $('iconSun').classList.toggle('hidden', !dark);
    $('iconMoon').classList.toggle('hidden', dark);
    localStorage.setItem(KEY_THEME, theme);
  }
  function initTheme() {
    let theme = localStorage.getItem(KEY_THEME);
    if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(theme);
  }

  /* ---------- Util ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function toast(message) {
    const t = document.createElement('div');
    t.className = 'pointer-events-auto rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-neutral-900';
    t.textContent = message;
    $('toastContainer').appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
      setTimeout(() => t.remove(), 300);
    }, 2200);
  }
  function parseKey(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }

  /* ---------- Storage ---------- */
  function loadPhotos() { try { photos = JSON.parse(localStorage.getItem(KEY_PHOTOS)) || []; } catch { photos = []; } }
  function savePhotos() {
    try { localStorage.setItem(KEY_PHOTOS, JSON.stringify(photos)); return true; }
    catch { toast('Storage full — could not save'); return false; }
  }
  function loadEvents() { try { return JSON.parse(localStorage.getItem(KEY_EVENTS)) || []; } catch { return []; } }
  function loadTagMap() {
    let tags = [];
    try { tags = JSON.parse(localStorage.getItem(KEY_TAGS)) || []; } catch { tags = []; }
    const map = {};
    tags.forEach((t) => { map[t.id] = t.name; });
    return map;
  }

  /* ---------- Downscale ---------- */
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (Math.max(width, height) > MAX_DIM) {
          const r = MAX_DIM / Math.max(width, height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        try { resolve(canvas.toDataURL('image/jpeg', QUALITY)); } catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  /* ---------- Upload flow ---------- */
  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    pendingPhotos = [];
    for (const file of files) {
      try { pendingPhotos.push(await fileToDataURL(file)); }
      catch { toast(`Could not read ${file.name}`); }
    }
    if (pendingPhotos.length) openEventChooser();
  }

  function eventLabel(ev) {
    const d = parseKey(ev.date);
    return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  }
  function openEventChooser() {
    renderPreview();
    renderEventStep();
    openModal($('eventChooserModal'));
  }
  // Left panel: thumbnails of the photos in this batch, each removable.
  function renderPreview() {
    $('previewCount').textContent = String(pendingPhotos.length);
    $('chooserPreview').innerHTML = pendingPhotos.map((src, i) => `
      <div class="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
        <img src="${src}" class="h-full w-full object-cover" />
        <button type="button" data-remove-pending="${i}" title="Remove"
          class="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100">
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>`).join('');
  }
  function removePending(i) {
    pendingPhotos.splice(i, 1);
    if (!pendingPhotos.length) { closeModal($('eventChooserModal')); return; }  // nothing left
    renderPreview();
    if ($('chooserBack').classList.contains('hidden')) renderEventStep();        // refresh "n photos selected"
  }
  // Step 1 — pick the event (mandatory)
  function renderEventStep() {
    chosenEvent = null;
    chosenTimeline = [];
    $('chooserBack').classList.add('hidden');
    $('chooserTitle').textContent = 'Assign to Event';
    $('chooserSub').textContent = `${pendingPhotos.length} photo${pendingPhotos.length > 1 ? 's' : ''} selected. Pick the event they belong to.`;
    const events = loadEvents().sort((a, b) => b.date.localeCompare(a.date));
    $('chooserList').innerHTML = events.length
      ? events.map((ev) => `
          <button type="button" data-pick-event="${ev.id}"
            class="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
            <span class="flex w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-100 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              <span class="text-base font-bold leading-none">${parseKey(ev.date).getDate()}</span>
              <span class="mt-0.5 text-[10px] font-medium uppercase">${MONTHS[parseKey(ev.date).getMonth()].slice(0, 3)}</span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">${escapeHtml(ev.title)}</span>
              <span class="block truncate text-xs text-neutral-500 dark:text-neutral-400">${ev.location ? escapeHtml(ev.location.name) : 'No location'}</span>
            </span>
            <svg class="h-4 w-4 flex-shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>`).join('')
      : `<p class="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">No events yet. Create an event on the calendar first, then upload photos to it.</p>`;
  }

  function pickEvent(id) {
    const ev = loadEvents().find((e) => e.id === id);
    if (!ev) return;
    chosenEvent = ev;
    chosenTimeline = (ev.timeline || []).filter((i) => i.title || i.time);
    if (!chosenTimeline.length) { assignBatch(ev, null); return; }   // no timeline → assign to whole event
    renderTimelineStep(ev);
  }
  // Step 2 — pick the moment (timeline item) within the chosen event
  function renderTimelineStep(ev) {
    $('chooserBack').classList.remove('hidden');
    $('chooserTitle').textContent = 'Pick a Moment';
    $('chooserSub').textContent = `Which part of "${ev.title}"?`;
    const whole = `
      <button type="button" data-pick-timeline="all"
        class="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
        <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path stroke-linecap="round" d="M3 9h18"/></svg>
        </span>
        <span class="min-w-0 flex-1 text-sm font-semibold">Whole event</span>
      </button>`;
    const items = chosenTimeline.map((i, idx) => `
      <button type="button" data-pick-timeline="${idx}"
        class="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
        <span class="flex h-9 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">${i.time || '—'}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold">${escapeHtml(i.title || 'Untitled')}</span>
          ${i.location ? `<span class="block truncate text-xs text-neutral-500 dark:text-neutral-400">${escapeHtml(i.location.name)}</span>` : ''}
        </span>
      </button>`).join('');
    $('chooserList').innerHTML = whole + items;
  }
  function pickTimeline(val) {
    if (!chosenEvent) return;
    const item = val === 'all' ? null : (chosenTimeline[Number(val)] || null);
    assignBatch(chosenEvent, item);
  }

  function assignBatch(ev, tlItem) {
    const tagMap = loadTagMap();
    const meta = {
      eventId: ev.id,
      eventTitle: ev.title,
      eventDate: ev.date,
      eventTags: (ev.tags || []).map((id) => tagMap[id]).filter(Boolean),
      eventCity: ev.location ? ev.location.name : '',
      timelineTitle: tlItem ? (tlItem.title || '') : '',
      timelineTime: tlItem ? (tlItem.time || '') : '',
    };

    let added = 0;
    for (const src of pendingPhotos) {
      photos.unshift({ id: uid(), src, ...meta });
      if (!savePhotos()) { photos.shift(); break; }
      added++;
    }
    pendingPhotos = [];
    chosenEvent = null;
    chosenTimeline = [];
    closeModal($('eventChooserModal'));
    renderGallery();
    if (added) toast(`${added} photo${added > 1 ? 's' : ''} added`);
  }

  // Caption: "Event title · 7 Jun 2026 · Moment"
  function photoCaption(p) {
    if (!p.eventTitle) return 'Unassigned';
    let s = escapeHtml(p.eventTitle);
    if (p.eventDate) s += ` · ${eventLabel({ date: p.eventDate })}`;
    if (p.timelineTitle) s += ` · ${escapeHtml(p.timelineTitle)}`;
    return s;
  }

  /* ---------- Search ---------- */
  function searchText(p) {
    const parts = [p.eventTitle, p.eventCity, p.timelineTitle, (p.eventTags || []).join(' ')];
    if (p.eventDate) {
      const d = parseKey(p.eventDate);
      parts.push(p.eventDate, MONTHS[d.getMonth()], String(d.getDate()), String(d.getFullYear()));
    }
    return parts.join(' ').toLowerCase();
  }
  function filteredPhotos() {
    const q = $('searchInput').value.trim().toLowerCase();
    if (!q) return photos;
    const terms = q.split(/\s+/);
    return photos.filter((p) => { const t = searchText(p); return terms.every((term) => t.includes(term)); });
  }

  /* ---------- Render ---------- */
  function renderGallery() {
    const list = filteredPhotos();
    $('photoCountNum').textContent = String(photos.length);
    const searching = $('searchInput').value.trim().length > 0;

    if (!list.length) {
      $('gallery').innerHTML = '';
      $('emptyHint').classList.remove('hidden');
      $('emptyTitle').textContent = searching ? 'No matches' : 'No photos yet';
      $('emptyMsg').innerHTML = searching
        ? 'Try a different month, date, event, tag, or city.'
        : 'Click <span class="font-semibold">Upload</span> to add your event photos.';
      return;
    }
    $('emptyHint').classList.add('hidden');

    $('gallery').innerHTML = list.map((p) => {
      const cap = photoCaption(p);
      return `
        <figure class="group relative aspect-square overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
          <img src="${p.src}" alt="${escapeHtml(p.eventTitle || 'Photo')}" loading="lazy" data-photo="${p.id}"
            class="h-full w-full cursor-zoom-in object-cover transition duration-300 group-hover:scale-105" />
          <figcaption class="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/70 to-transparent p-2.5 text-xs font-medium text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">${cap}</figcaption>
          <button type="button" data-del="${p.id}" title="Delete photo"
            class="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white opacity-0 backdrop-blur transition hover:bg-black/70 group-hover:opacity-100">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
          </button>
        </figure>`;
    }).join('');
  }

  function deletePhoto(id) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    if (!window.confirm('Delete this photo?')) return;
    photos = photos.filter((x) => x.id !== id);
    savePhotos();
    renderGallery();
    toast('Photo deleted');
  }

  /* ---------- Modal helpers ---------- */
  function openModal(m) { m.classList.remove('hidden'); m.classList.add('flex'); document.body.style.overflow = 'hidden'; }
  function closeModal(m) {
    m.classList.add('hidden'); m.classList.remove('flex');
    if ($('lightbox').classList.contains('hidden') && $('eventChooserModal').classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }

  /* ---------- Lightbox ---------- */
  function openLightbox(id) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    $('lightboxImg').src = p.src;
    $('lightboxImg').alt = p.eventTitle || 'Photo';
    const parts = [];
    if (p.eventTitle) parts.push(p.eventTitle);
    if (p.eventDate) parts.push(eventLabel({ date: p.eventDate }));
    if (p.timelineTitle) parts.push(p.timelineTitle);
    $('lightboxCaption').textContent = parts.join(' · ');
    openModal($('lightbox'));
  }

  /* ---------- Init ---------- */
  function init() {
    initTheme();
    loadPhotos();
    renderGallery();

    $('themeToggle').addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      applyTheme(isDark ? 'light' : 'dark');
    });

    // Upload button → open file picker directly
    const fileInput = $('fileInput');
    $('uploadBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });

    // back to the event list (step 1)
    $('chooserBack').addEventListener('click', renderEventStep);

    // search
    $('searchInput').addEventListener('input', renderGallery);

    // delegated clicks
    document.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove-pending]');
      if (rm) { removePending(Number(rm.dataset.removePending)); return; }
      const pickEv = e.target.closest('[data-pick-event]');
      if (pickEv) { pickEvent(pickEv.dataset.pickEvent); return; }
      const pickTl = e.target.closest('[data-pick-timeline]');
      if (pickTl) { pickTimeline(pickTl.dataset.pickTimeline); return; }
      if (e.target.closest('[data-close-chooser]') || e.target === $('eventChooserBackdrop')) {
        pendingPhotos = []; closeModal($('eventChooserModal')); return;
      }
      const del = e.target.closest('[data-del]');
      if (del) { deletePhoto(del.dataset.del); return; }
      const img = e.target.closest('[data-photo]');
      if (img) { openLightbox(img.dataset.photo); return; }
      if (e.target.closest('#lightboxClose') || e.target === $('lightbox')) closeModal($('lightbox'));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('lightbox').classList.contains('hidden')) closeModal($('lightbox'));
      else if (!$('eventChooserModal').classList.contains('hidden')) { pendingPhotos = []; closeModal($('eventChooserModal')); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
