/* ============================================================
   Tigabelas — Photo Album
   Upload via drag & drop or file picker. Stored in localStorage
   (images are downscaled to keep storage small).
   ============================================================ */
(function () {
  'use strict';

  const KEY_THEME = 'tigabelas.theme';
  const KEY_PHOTOS = 'tigabelas.photos.v1';
  const MAX_DIM = 1600;      // px — longest side after downscale
  const QUALITY = 0.82;      // JPEG quality

  const $ = (id) => document.getElementById(id);
  let photos = [];

  /* ---------- Theme (shared with the calendar page) ---------- */
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

  /* ---------- Storage ---------- */
  function loadPhotos() {
    try { photos = JSON.parse(localStorage.getItem(KEY_PHOTOS)) || []; }
    catch { photos = []; }
  }
  function savePhotos() {
    try {
      localStorage.setItem(KEY_PHOTOS, JSON.stringify(photos));
      return true;
    } catch {
      toast('Storage full — could not save photo');
      return false;
    }
  }

  /* ---------- Downscale an image file to a small data URL ---------- */
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (Math.max(width, height) > MAX_DIM) {
          const r = MAX_DIM / Math.max(width, height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        try { resolve(canvas.toDataURL('image/jpeg', QUALITY)); }
        catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  /* ---------- Add files ---------- */
  async function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    let added = 0;
    for (const file of files) {
      try {
        const src = await fileToDataURL(file);
        const caption = file.name.replace(/\.[^.]+$/, '');
        photos.unshift({ id: uid(), src, caption, date: new Date().toISOString().slice(0, 10) });
        if (!savePhotos()) { photos.shift(); break; }   // rolled back if storage full
        added++;
      } catch {
        toast(`Could not read ${file.name}`);
      }
    }
    if (added) { renderGallery(); closeUploadModal(); toast(`${added} photo${added > 1 ? 's' : ''} added`); }
  }

  /* ---------- Upload modal ---------- */
  function openUploadModal() {
    const m = $('uploadModal');
    m.classList.remove('hidden'); m.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
  function closeUploadModal() {
    const m = $('uploadModal');
    m.classList.add('hidden'); m.classList.remove('flex');
    if ($('lightbox').classList.contains('hidden')) document.body.style.overflow = '';
  }

  /* ---------- Render gallery ---------- */
  function renderGallery() {
    const gallery = $('gallery');
    $('photoCountNum').textContent = String(photos.length);
    $('emptyHint').classList.toggle('hidden', photos.length > 0);

    gallery.innerHTML = photos.map((p) => {
      const caption = p.caption
        ? `<figcaption class="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/70 to-transparent p-3 text-sm font-medium text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">${escapeHtml(p.caption)}</figcaption>`
        : '';
      return `
        <figure class="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <img src="${p.src}" alt="${escapeHtml(p.caption || 'Photo')}" loading="lazy" data-photo="${p.id}"
            class="w-full cursor-zoom-in object-cover transition duration-300 group-hover:scale-[1.03]" />
          ${caption}
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

  /* ---------- Lightbox ---------- */
  function openLightbox(id) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    $('lightboxImg').src = p.src;
    $('lightboxImg').alt = p.caption || 'Photo';
    $('lightboxCaption').textContent = p.caption || '';
    const lb = $('lightbox');
    lb.classList.remove('hidden'); lb.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    const lb = $('lightbox');
    lb.classList.add('hidden'); lb.classList.remove('flex');
    document.body.style.overflow = '';
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

    // upload popup
    $('uploadBtn').addEventListener('click', openUploadModal);

    // file picker
    const fileInput = $('fileInput');
    $('dropzone').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

    // drag & drop
    const dz = $('dropzone');
    const hi = () => dz.classList.add('border-neutral-900', 'bg-neutral-100/60', 'dark:border-white', 'dark:bg-neutral-800/40');
    const lo = () => dz.classList.remove('border-neutral-900', 'bg-neutral-100/60', 'dark:border-white', 'dark:bg-neutral-800/40');
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); hi(); }));
    ['dragleave', 'dragend'].forEach((ev) => dz.addEventListener(ev, lo));
    dz.addEventListener('drop', (e) => { e.preventDefault(); lo(); if (e.dataTransfer) addFiles(e.dataTransfer.files); });
    // prevent the whole window from navigating when a file is dropped outside the zone
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    // gallery clicks (open / delete) + modal close
    document.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { deletePhoto(del.dataset.del); return; }
      const img = e.target.closest('[data-photo]');
      if (img) { openLightbox(img.dataset.photo); return; }
      if (e.target.closest('[data-close-upload]') || e.target === $('uploadBackdrop')) { closeUploadModal(); return; }
      if (e.target.closest('#lightboxClose') || e.target === $('lightbox')) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('lightbox').classList.contains('hidden')) closeLightbox();
      else closeUploadModal();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
