/**
 * List of 12 Months (January - December)
 */
const MONTHS = [
  { number: 1, name: 'January' },
  { number: 2, name: 'February' },
  { number: 3, name: 'March' },
  { number: 4, name: 'April' },
  { number: 5, name: 'May' },
  { number: 6, name: 'June' },
  { number: 7, name: 'July' },
  { number: 8, name: 'August' },
  { number: 9, name: 'September' },
  { number: 10, name: 'October' },
  { number: 11, name: 'November' },
  { number: 12, name: 'December' }
];

/**
 * Year Configuration:
 * Defaults to current year, minimum selectable year starts at 2025
 */
const MIN_YEAR = 2025;
const MAX_TITLE_LENGTH = 50;
const MAX_DESC_LENGTH = 100;
const MAX_WISH_WORDS = 500;
const HOLD_DELETE_DURATION_MS = 2000;
const GLOBAL_STORE_ENDPOINT = '/api/store';
const LOCAL_STORAGE_KEY = 'tgbls_global_store_v1';
let WISH_DATA = {};
let globalRecapConfig = typeof RECAP_CONFIG !== 'undefined' ? RECAP_CONFIG : { stats: {}, highlights: {} };
let selectedYear = Math.max(MIN_YEAR, new Date().getFullYear());

/**
 * Tracks currently expanded month dropdowns
 */
const openMonthsState = new Set();

/**
 * Sample Event Log Data (Standard REST API JSON structure)
 * Ready to sync with a REST API backend for both Web and Kodular Android app.
 */
const SAMPLE_LOGBOOK_DATA = {
  status: 'success',
  events: [
    // Sample Data for 2025
    {
      id: 'EVT-2025-001',
      year: 2025,
      month: 1,
      date: '2025-01-06',
      title: 'Annual Opening & Planning Meeting',
      description: 'Preparing the operational activity schedule for the first half of 2025.'
    },
    {
      id: 'EVT-2025-002',
      year: 2025,
      month: 1,
      date: '2025-01-18',
      title: 'Equipment Inventory & Calibration Check',
      description: 'Inspecting core device readiness and recording baseline log entries.'
    },
    {
      id: 'EVT-2025-003',
      year: 2025,
      month: 2,
      date: '2025-02-12',
      title: 'Standard Operating Procedure (SOP) Training',
      description: 'Briefing team members on the updated event logging format.'
    },

    // Sample Data for 2026
    {
      id: 'EVT-2026-001',
      year: 2026,
      month: 1,
      date: '2026-01-05',
      title: 'Annual Planning & Kick-off Meeting',
      description: 'Setting annual objectives and assigning responsibilities across the team.'
    },
    {
      id: 'EVT-2026-002',
      year: 2026,
      month: 1,
      date: '2026-01-14',
      title: 'Early Year Equipment Inspection & Calibration',
      description: 'Checking primary hardware status and recording initial log data.'
    },
    {
      id: 'EVT-2026-003',
      year: 2026,
      month: 1,
      date: '2026-01-27',
      title: 'Weekly Evaluation & Data Synchronization',
      description: 'Reviewing January milestones and validating logbook entries.'
    },
    {
      id: 'EVT-2026-004',
      year: 2026,
      month: 2,
      date: '2026-02-10',
      title: 'Routine System Maintenance & Backup',
      description: 'Scheduled server maintenance and monthly database backup.'
    },
    {
      id: 'EVT-2026-005',
      year: 2026,
      month: 11,
      date: '2026-11-13',
      title: 'Web & Kodular Mobile API Integration Test',
      description: 'Testing JSON payload structure for REST API sync with the Android app.'
    }
  ]
};

/**
 * Formats ISO date ('YYYY-MM-DD') into 'DD/MM/YYYY' format (e.g. '13/11/2026')
 */
function formatDateDisplay(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate || '';
  }
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Parses 'DD/MM/YYYY' string into ISO date ('YYYY-MM-DD'), returning null if invalid
 */
function parseDisplayDateToIso(displayDate) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((displayDate || '').trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const checkDate = new Date(year, month - 1, day);
  if (
    checkDate.getFullYear() !== year ||
    checkDate.getMonth() !== month - 1 ||
    checkDate.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Initializes the year selector with Previous & Next arrow buttons
 */
function setupYearStepper() {
  const prevBtn = document.getElementById('btn-prev-year');
  const nextBtn = document.getElementById('btn-next-year');
  const yearDisplay = document.getElementById('year-display');

  if (!prevBtn || !nextBtn || !yearDisplay) return;

  function updateYearUI() {
    yearDisplay.textContent = String(selectedYear);
    prevBtn.disabled = selectedYear <= MIN_YEAR;
  }

  prevBtn.addEventListener('click', () => {
    if (selectedYear > MIN_YEAR) {
      selectedYear -= 1;
      updateYearUI();
      renderLogbookAccordion();
    }
  });

  nextBtn.addEventListener('click', () => {
    selectedYear += 1;
    updateYearUI();
    renderLogbookAccordion();
  });

  updateYearUI();
}

/**
 * Fetches event data for the selected year
 */
async function getLogbookEvents(year) {
  const filteredEvents = SAMPLE_LOGBOOK_DATA.events.filter(
    (ev) => Number(ev.year) === Number(year)
  );
  return {
    status: 'success',
    year: Number(year),
    events: filteredEvents
  };
}

/**
 * Determines the badge color class based on current month/year:
 * - Current active month: blue (.is-current)
 * - Past months: gray (.is-past)
 * - Upcoming months: soft blue if events exist, gray if empty
 */
function getBadgeStatusClass(year, monthNumber, eventCount) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year === currentYear && monthNumber === currentMonth) {
    return 'event-count-badge is-current';
  }
  if (year < currentYear || (year === currentYear && monthNumber < currentMonth)) {
    return 'event-count-badge is-past';
  }
  return eventCount > 0 ? 'event-count-badge' : 'event-count-badge empty';
}

/**
 * Renders the vertical month dropdown list for months that have events.
 * Months with 0 events are omitted.
 */
async function renderLogbookAccordion() {
  const container = document.getElementById('month-accordion-list');
  if (!container) return;

  const data = await getLogbookEvents(selectedYear);
  container.innerHTML = '';

  let renderedCount = 0;

  MONTHS.forEach((monthObj) => {
    const monthEvents = data.events.filter((ev) => Number(ev.month) === monthObj.number);
    const eventCount = monthEvents.length;

    // Omit months with no events
    if (eventCount === 0) {
      return;
    }

    renderedCount += 1;

    const monthItem = document.createElement('div');
    monthItem.className = 'month-item';
    if (openMonthsState.has(monthObj.number)) {
      monthItem.classList.add('open');
    }

    const dropdownBtn = document.createElement('button');
    dropdownBtn.type = 'button';
    dropdownBtn.className = 'month-dropdown-btn';
    dropdownBtn.setAttribute('aria-expanded', String(openMonthsState.has(monthObj.number)));

    const badgeClass = getBadgeStatusClass(selectedYear, monthObj.number, eventCount);
    const eventUnit = eventCount === 1 ? 'event' : 'events';

    dropdownBtn.innerHTML = `
      <div class="month-label-group">
        <span class="month-name">${monthObj.name}</span>
        <span class="${badgeClass}" title="${eventCount} ${eventUnit} in ${monthObj.name}">
          ${eventCount}
        </span>
      </div>
      <span class="dropdown-arrow" aria-hidden="true">
        <span class="material-icons">expand_more</span>
      </span>
    `;

    const contentPanel = document.createElement('div');
    contentPanel.className = 'month-content';

    const ul = document.createElement('ul');
    ul.className = 'event-list';

    monthEvents.forEach((ev) => {
      const li = document.createElement('li');
      li.className = 'event-card';

      li.innerHTML = `
        <div class="event-info">
          <span class="event-title">${ev.title}</span>
          <span class="event-date">${formatDateDisplay(ev.date)}</span>
          <p class="event-desc">${ev.description}</p>
        </div>
        <div class="event-actions">
          <button type="button" class="btn-event-action btn-event-edit" data-edit-id="${ev.id}" title="Edit Event">
            <span class="material-icons">edit</span>
            <span>Edit</span>
          </button>
          <button type="button" class="btn-event-action btn-event-delete" data-delete-id="${ev.id}" title="Hold 2s to delete">
            <span class="material-icons">delete</span>
            <span>Delete</span>
            <svg class="delete-hold-outline" aria-hidden="true">
              <rect class="delete-hold-rect" x="1" y="1" rx="7" ry="7" pathLength="100"></rect>
            </svg>
          </button>
        </div>
      `;

      const editBtn = li.querySelector('.btn-event-edit');
      editBtn.addEventListener('click', () => openEditModal(ev.id));

      const deleteBtn = li.querySelector('.btn-event-delete');
      setupHoldToDelete(deleteBtn, ev.id);

      ul.appendChild(li);
    });

    contentPanel.appendChild(ul);

    dropdownBtn.addEventListener('click', () => {
      const isOpen = monthItem.classList.toggle('open');
      dropdownBtn.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        openMonthsState.add(monthObj.number);
      } else {
        openMonthsState.delete(monthObj.number);
      }
    });

    monthItem.appendChild(dropdownBtn);
    monthItem.appendChild(contentPanel);
    container.appendChild(monthItem);
  });

  if (renderedCount === 0) {
    container.innerHTML = `
      <div class="empty-year-card">
        No events found for ${selectedYear}. Click the <strong>Add Event</strong> button at the bottom right to create one.
      </div>
    `;
  }
}

/**
 * Returns default ISO date ('YYYY-MM-DD') for the currently selected year
 */
function getDefaultIsoDateForSelectedYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${selectedYear}-${month}-${day}`;
}

/**
 * Updates a character counter element for a text field
 */
function updateCharCounter(counterId, length, maxLength) {
  const counterEl = document.getElementById(counterId);
  if (!counterEl) return;
  counterEl.textContent = `${length} / ${maxLength}`;
  counterEl.classList.toggle('at-limit', length >= maxLength);
}

/**
 * Binds live character clamping and counter updates to an input/textarea element
 */
function bindCharLimit(inputEl, counterId, maxLength) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    if (inputEl.value.length > maxLength) {
      inputEl.value = inputEl.value.slice(0, maxLength);
    }
    updateCharCounter(counterId, inputEl.value.length, maxLength);
  });
}

/**
 * Sets both the DD/MM/YYYY text input and hidden calendar picker from an ISO date
 */
function setModalDateInputs(isoDate) {
  const dateInput = document.getElementById('edit-event-date');
  const datePicker = document.getElementById('edit-event-date-picker');
  if (dateInput) {
    dateInput.value = formatDateDisplay(isoDate);
    dateInput.setCustomValidity('');
  }
  if (datePicker && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    datePicker.value = isoDate;
  }
}

/**
 * Opens the Add Event Modal
 */
function openAddModal() {
  const modalBackdrop = document.getElementById('edit-modal-backdrop');
  const modalTitle = document.getElementById('modal-edit-title');
  const titleInput = document.getElementById('edit-event-title');
  const descInput = document.getElementById('edit-event-desc');

  modalTitle.textContent = 'Add Event';
  document.getElementById('edit-event-id').value = '';
  titleInput.value = '';
  setModalDateInputs(getDefaultIsoDateForSelectedYear());
  descInput.value = '';

  updateCharCounter('edit-title-counter', 0, MAX_TITLE_LENGTH);
  updateCharCounter('edit-desc-counter', 0, MAX_DESC_LENGTH);

  modalBackdrop.classList.add('active');
  modalBackdrop.setAttribute('aria-hidden', 'false');
  titleInput.focus();
}

/**
 * Opens the Edit Event Modal
 */
function openEditModal(eventId) {
  const targetEvent = SAMPLE_LOGBOOK_DATA.events.find((item) => item.id === eventId);
  if (!targetEvent) return;

  const modalBackdrop = document.getElementById('edit-modal-backdrop');
  const modalTitle = document.getElementById('modal-edit-title');
  const titleInput = document.getElementById('edit-event-title');
  const descInput = document.getElementById('edit-event-desc');

  modalTitle.textContent = 'Edit Event';
  document.getElementById('edit-event-id').value = targetEvent.id;
  titleInput.value = (targetEvent.title || '').slice(0, MAX_TITLE_LENGTH);
  setModalDateInputs(targetEvent.date);
  descInput.value = (targetEvent.description || '').slice(0, MAX_DESC_LENGTH);

  updateCharCounter('edit-title-counter', titleInput.value.length, MAX_TITLE_LENGTH);
  updateCharCounter('edit-desc-counter', descInput.value.length, MAX_DESC_LENGTH);

  modalBackdrop.classList.add('active');
  modalBackdrop.setAttribute('aria-hidden', 'false');
}

/**
 * Closes the Add / Edit Event Modal
 */
function closeEditModal() {
  const modalBackdrop = document.getElementById('edit-modal-backdrop');
  if (!modalBackdrop) return;
  modalBackdrop.classList.remove('active');
  modalBackdrop.setAttribute('aria-hidden', 'true');
}

/**
 * Initializes the Add / Edit Event Modal and Floating Add Button
 */
function setupEditModal() {
  const form = document.getElementById('edit-event-form');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  const modalBackdrop = document.getElementById('edit-modal-backdrop');
  const titleInput = document.getElementById('edit-event-title');
  const descInput = document.getElementById('edit-event-desc');
  const dateInput = document.getElementById('edit-event-date');
  const datePicker = document.getElementById('edit-event-date-picker');
  const calendarBtn = document.getElementById('btn-open-calendar');
  const addBtn = document.getElementById('btn-add-event');

  if (addBtn) {
    addBtn.addEventListener('click', openAddModal);
  }

  bindCharLimit(titleInput, 'edit-title-counter', MAX_TITLE_LENGTH);
  bindCharLimit(descInput, 'edit-desc-counter', MAX_DESC_LENGTH);

  if (calendarBtn && datePicker) {
    calendarBtn.addEventListener('click', () => {
      if (typeof datePicker.showPicker === 'function') {
        try {
          datePicker.showPicker();
        } catch (_) {
          // Native overlay click still handles fallback
        }
      }
    });
  }

  if (datePicker) {
    datePicker.addEventListener('change', () => {
      if (datePicker.value) {
        setModalDateInputs(datePicker.value);
      }
    });
  }

  if (dateInput) {
    dateInput.addEventListener('input', () => {
      dateInput.setCustomValidity('');
      const digits = dateInput.value.replace(/\D/g, '').slice(0, 8);
      let formatted = digits;
      if (digits.length > 4) {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
      } else if (digits.length > 2) {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      }
      dateInput.value = formatted;

      const parsedIso = parseDisplayDateToIso(formatted);
      if (parsedIso && datePicker) {
        datePicker.value = parsedIso;
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeEditModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        closeEditModal();
      }
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-event-id').value;
      const title = document.getElementById('edit-event-title').value.trim().slice(0, MAX_TITLE_LENGTH);
      const isoDate = parseDisplayDateToIso(dateInput.value);
      const desc = document.getElementById('edit-event-desc').value.trim().slice(0, MAX_DESC_LENGTH);

      if (!isoDate) {
        dateInput.setCustomValidity('Please enter a valid date in DD/MM/YYYY format.');
        dateInput.reportValidity();
        return;
      }

      const [eventYear, eventMonth] = isoDate.split('-').map(Number);

      if (id) {
        // Update existing event
        const targetEvent = SAMPLE_LOGBOOK_DATA.events.find((item) => item.id === id);
        if (targetEvent) {
          targetEvent.title = title;
          targetEvent.date = isoDate;
          targetEvent.description = desc;
          targetEvent.year = eventYear;
          targetEvent.month = eventMonth;
        }
      } else {
        // Create new event
        const newEvent = {
          id: `EVT-${Date.now()}`,
          year: eventYear,
          month: eventMonth,
          date: isoDate,
          title,
          description: desc
        };
        SAMPLE_LOGBOOK_DATA.events.push(newEvent);

        if (eventYear >= MIN_YEAR && eventYear !== selectedYear) {
          selectedYear = eventYear;
          const yearDisplay = document.getElementById('year-display');
          const prevBtn = document.getElementById('btn-prev-year');
          if (yearDisplay) yearDisplay.textContent = String(selectedYear);
          if (prevBtn) prevBtn.disabled = selectedYear <= MIN_YEAR;
        }
        openMonthsState.add(eventMonth);
      }

      closeEditModal();
      renderLogbookAccordion();
      saveGlobalStore();
    });
  }
}

/**
 * Configures 2-second hold-to-delete with an outline progress animation
 */
function setupHoldToDelete(buttonEl, eventId) {
  const rectEl = buttonEl.querySelector('.delete-hold-rect');
  let animationFrameId = null;
  let holdStartTime = 0;

  function resetHold() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    buttonEl.classList.remove('is-holding');
    if (rectEl) {
      rectEl.style.strokeDashoffset = '100';
    }
  }

  function stepHold(timestamp) {
    const elapsed = timestamp - holdStartTime;
    const progress = Math.min(1, elapsed / HOLD_DELETE_DURATION_MS);

    if (rectEl) {
      rectEl.style.strokeDashoffset = String((1 - progress) * 100);
    }

    if (progress >= 1) {
      resetHold();
      handleDeleteEvent(eventId);
      return;
    }

    animationFrameId = requestAnimationFrame(stepHold);
  }

  function startHold() {
    if (animationFrameId !== null) return;

    if (rectEl) {
      const width = buttonEl.offsetWidth;
      const height = buttonEl.offsetHeight;
      rectEl.setAttribute('width', String(Math.max(0, width - 2)));
      rectEl.setAttribute('height', String(Math.max(0, height - 2)));
      rectEl.style.strokeDashoffset = '100';
    }

    buttonEl.classList.add('is-holding');
    holdStartTime = performance.now();
    animationFrameId = requestAnimationFrame(stepHold);
  }

  buttonEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    startHold();
  });

  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((evtName) => {
    buttonEl.addEventListener(evtName, resetHold);
  });

  buttonEl.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      startHold();
    }
  });

  buttonEl.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      resetHold();
    }
  });
}

/**
 * Deletes an event from the list immediately (after 2s hold completes)
 */
function handleDeleteEvent(eventId) {
  SAMPLE_LOGBOOK_DATA.events = SAMPLE_LOGBOOK_DATA.events.filter((item) => item.id !== eventId);
  renderLogbookAccordion();
  saveGlobalStore();
}

/**
 * Builds SVG circular progress markup with centered label
 */
function createCircleProgressMarkup(percent, label, strokeClass) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clampedPercent / 100);

  return `
    <div class="circle-progress">
      <svg class="circle-progress-svg" viewBox="0 0 60 60" aria-hidden="true">
        <circle class="circle-progress-track" cx="30" cy="30" r="${radius}"></circle>
        <circle
          class="circle-progress-fill ${strokeClass}"
          cx="30"
          cy="30"
          r="${radius}"
          stroke-dasharray="${circumference.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"
        ></circle>
      </svg>
      <span class="circle-progress-label">${label}</span>
    </div>
  `;
}

/**
 * Returns percentage of days passed in the current year (raw, rounded, and 1-decimal formatted)
 */
function getYearDaysProgress(now = new Date()) {
  const currentYear = now.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const startOfNextYear = new Date(currentYear + 1, 0, 1);
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDaysInYear = Math.round((startOfNextYear - startOfYear) / msPerDay);
  const dayOfYear =
    Math.floor((new Date(currentYear, now.getMonth(), now.getDate()) - startOfYear) / msPerDay) + 1;
  const rawPercent = Math.min(100, (dayOfYear / totalDaysInYear) * 100);

  return {
    dayOfYear,
    totalDaysInYear,
    rawPercent,
    roundedPercent: Math.round(rawPercent),
    oneDecimalPercent: rawPercent.toFixed(1)
  };
}

/**
 * Returns MyWish countdown state for the current month
 */
function getMyWishCountdownInfo(now = new Date()) {
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const currentDay = now.getDate();
  const totalDaysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const remainingDays = Math.max(0, totalDaysInMonth - currentDay);
  return {
    remainingDays,
    totalDaysInMonth,
    isAvailable: remainingDays === 0
  };
}

/**
 * Renders the home menu circular progress indicators and user greeting:
 * 1. MyEvent: percentage of days passed in the current month
 * 2. MyWish: countdown days to the last day of the current month ("Nd" or "Available Now" on target day)
 * 3. MyRecap: percentage of months passed in the current year
 * 4. MyProfile: greeting with user name ("Hi, Luigi!")
 */
function renderHomeMenuProgress() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth(); // 0-indexed (0 = Jan, 10 = Nov)
  const currentDay = now.getDate();
  const { remainingDays, totalDaysInMonth, isAvailable } = getMyWishCountdownInfo(now);

  // 1. MyEvent: percentage of days passed this month
  const monthDaysPercent = Math.min(100, Math.round((currentDay / totalDaysInMonth) * 100));
  const myEventProgressEl = document.getElementById('myevent-progress');
  if (myEventProgressEl) {
    myEventProgressEl.innerHTML = createCircleProgressMarkup(
      monthDaysPercent,
      `${monthDaysPercent}%`,
      'stroke-blue'
    );
  }

  // 2. MyWish: countdown days targeting the last day of this month
  const myWishProgressEl = document.getElementById('mywish-progress');
  const myWishAvailableEl = document.getElementById('mywish-available');

  if (myWishProgressEl && myWishAvailableEl) {
    if (isAvailable) {
      myWishProgressEl.innerHTML = '';
      myWishProgressEl.style.display = 'none';
      myWishAvailableEl.style.display = 'flex';
      myWishAvailableEl.innerHTML = `
        <div class="available-now-badge">Available Now</div>
      `;
    } else {
      const countdownPercent = Math.min(
        100,
        Math.round(((totalDaysInMonth - remainingDays) / totalDaysInMonth) * 100)
      );
      myWishProgressEl.style.display = 'flex';
      myWishProgressEl.innerHTML = createCircleProgressMarkup(
        countdownPercent,
        `${remainingDays}d`,
        'stroke-emerald'
      );
      myWishAvailableEl.innerHTML = '';
      myWishAvailableEl.style.display = 'none';
    }
  }

  // 3. MyRecap: percentage of days passed in the current year (rounded, no decimals)
  const { roundedPercent: yearDaysRoundedPercent } = getYearDaysProgress(now);
  const myRecapProgressEl = document.getElementById('myrecap-progress');
  if (myRecapProgressEl) {
    myRecapProgressEl.innerHTML = createCircleProgressMarkup(
      yearDaysRoundedPercent,
      `${yearDaysRoundedPercent}%`,
      'stroke-amber'
    );
  }
}

/**
 * Counts words in a string
 */
function countWords(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Truncates text so it does not exceed maxWords
 */
function truncateToMaxWords(text, maxWords) {
  const matches = [...text.matchAll(/\S+/g)];
  if (matches.length <= maxWords) return text;
  const cutoffIndex = matches[maxWords - 1].index + matches[maxWords - 1][0].length;
  return text.slice(0, cutoffIndex);
}

/**
 * Updates word counter UI and enforces maxWords on a textarea element
 */
function bindWordLimit(textareaEl, counterEl, maxWords, onInputChange) {
  function refreshCounter() {
    const words = countWords(textareaEl.value);
    if (counterEl) {
      counterEl.textContent = `${words} / ${maxWords} words`;
      counterEl.classList.toggle('at-limit', words >= maxWords);
    }
  }

  textareaEl.addEventListener('input', () => {
    if (countWords(textareaEl.value) > maxWords) {
      textareaEl.value = truncateToMaxWords(textareaEl.value, maxWords);
    }
    refreshCounter();
    if (onInputChange) onInputChange();
  });

  return refreshCounter;
}

/**
 * Initializes the MyWish form (one-time per month, confirmation before submit, locked after submit)
 */
function setupWishForm() {
  const form = document.getElementById('wish-form');
  const accomplishedInput = document.getElementById('wish-accomplished');
  const improveInput = document.getElementById('wish-improve');
  const accomplishedCounter = document.getElementById('wish-accomplished-counter');
  const improveCounter = document.getElementById('wish-improve-counter');
  const monthLabel = document.getElementById('wish-month-label');
  const statusMsg = document.getElementById('wish-status-msg');
  const submitBtn = document.getElementById('btn-wish-submit');

  const confirmBackdrop = document.getElementById('wish-confirm-backdrop');
  const confirmMessage = document.getElementById('wish-confirm-message');
  const confirmCancelBtn = document.getElementById('btn-wish-confirm-cancel');
  const confirmOkBtn = document.getElementById('btn-wish-confirm-ok');

  if (!form || !accomplishedInput || !improveInput) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const currentMonthName = MONTHS[currentMonthIndex] ? MONTHS[currentMonthIndex].name : '';
  const wishKey = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}`;

  if (monthLabel) {
    monthLabel.textContent = currentMonthName;
  }

  const clearStatus = () => {
    if (statusMsg && !(WISH_DATA[wishKey] && WISH_DATA[wishKey].submitted)) {
      statusMsg.textContent = '';
    }
  };

  const refreshAccomplishedCounter = bindWordLimit(
    accomplishedInput,
    accomplishedCounter,
    MAX_WISH_WORDS,
    clearStatus
  );
  const refreshImproveCounter = bindWordLimit(
    improveInput,
    improveCounter,
    MAX_WISH_WORDS,
    clearStatus
  );

  function lockWishForm() {
    accomplishedInput.readOnly = true;
    improveInput.readOnly = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitted';
    }
    if (statusMsg) {
      statusMsg.textContent = `Submitted for ${currentMonthName}. Wishes can only be submitted once per month and cannot be edited.`;
    }
  }

  function closeWishConfirmModal() {
    if (!confirmBackdrop) return;
    confirmBackdrop.classList.remove('active');
    confirmBackdrop.setAttribute('aria-hidden', 'true');
  }

  function openWishConfirmModal() {
    if (!confirmBackdrop) return;
    if (confirmMessage) {
      confirmMessage.textContent = `Once submitted, your wish for ${currentMonthName} cannot be edited or changed. Are you sure you want to submit?`;
    }
    confirmBackdrop.classList.add('active');
    confirmBackdrop.setAttribute('aria-hidden', 'false');
  }

  if (WISH_DATA[wishKey]) {
    accomplishedInput.value = WISH_DATA[wishKey].accomplished || '';
    improveInput.value = WISH_DATA[wishKey].improve || '';
    if (WISH_DATA[wishKey].submitted) {
      lockWishForm();
    }
  }
  refreshAccomplishedCounter();
  refreshImproveCounter();

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', closeWishConfirmModal);
  }

  if (confirmBackdrop) {
    confirmBackdrop.addEventListener('click', (e) => {
      if (e.target === confirmBackdrop) {
        closeWishConfirmModal();
      }
    });
  }

  if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', () => {
      if (WISH_DATA[wishKey] && WISH_DATA[wishKey].submitted) {
        closeWishConfirmModal();
        return;
      }

      const accomplished = truncateToMaxWords(accomplishedInput.value.trim(), MAX_WISH_WORDS);
      const improve = truncateToMaxWords(improveInput.value.trim(), MAX_WISH_WORDS);

      accomplishedInput.value = accomplished;
      improveInput.value = improve;
      refreshAccomplishedCounter();
      refreshImproveCounter();

      WISH_DATA[wishKey] = {
        accomplished,
        improve,
        submitted: true,
        submittedAt: new Date().toISOString()
      };

      closeWishConfirmModal();
      lockWishForm();
      saveGlobalStore();
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (WISH_DATA[wishKey] && WISH_DATA[wishKey].submitted) {
      return;
    }
    openWishConfirmModal();
  });
}

/**
 * Opens the MyWish locked explanation popup modal
 */
function openWishLockedModal() {
  const backdrop = document.getElementById('wish-locked-backdrop');
  const messageEl = document.getElementById('wish-locked-message');
  if (!backdrop) return;

  const now = new Date();
  const { remainingDays, totalDaysInMonth } = getMyWishCountdownInfo(now);
  const targetDateIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;
  const dayUnit = remainingDays === 1 ? 'day' : 'days';

  if (messageEl) {
    messageEl.textContent = `MyWish is locked until the last day of the month (${formatDateDisplay(targetDateIso)}). You can access it in ${remainingDays} ${dayUnit}.`;
  }

  backdrop.classList.add('active');
  backdrop.setAttribute('aria-hidden', 'false');
}

/**
 * Closes the MyWish locked explanation popup modal
 */
function closeWishLockedModal() {
  const backdrop = document.getElementById('wish-locked-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('active');
  backdrop.setAttribute('aria-hidden', 'true');
}

/**
 * Initializes the MyWish locked popup modal events
 */
function setupWishLockedModal() {
  const backdrop = document.getElementById('wish-locked-backdrop');
  const closeBtn = document.getElementById('btn-wish-locked-close');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeWishLockedModal);
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeWishLockedModal();
      }
    });
  }
}

/**
 * Renders the MyRecap 1x3 summary grid and Days progress container for the current year
 */
function renderMyRecap() {
  const now = new Date();
  const currentYear = now.getFullYear();

  const yearLabelEl = document.getElementById('recap-year-label');
  const totalEventsEl = document.getElementById('recap-total-events');
  const totalMoviesEl = document.getElementById('recap-total-movies');
  const totalMemoriesEl = document.getElementById('recap-total-memories');
  const daysPercentEl = document.getElementById('recap-days-percent');
  const daysFillEl = document.getElementById('recap-days-fill');

  if (yearLabelEl) {
    yearLabelEl.textContent = String(currentYear);
  }

  const eventsThisYear = SAMPLE_LOGBOOK_DATA.events.filter(
    (ev) => Number(ev.year) === currentYear
  ).length;

  const { dayOfYear, totalDaysInYear, rawPercent, oneDecimalPercent } = getYearDaysProgress(now);
  const config = globalRecapConfig || { stats: {}, highlights: {} };
  const stats = config.stats || {};
  const highlights = config.highlights || {};

  if (totalEventsEl) totalEventsEl.textContent = String(eventsThisYear);
  if (totalMoviesEl) {
    totalMoviesEl.innerHTML = `${stats.totalMovies ?? 0}<span class="recap-target">/${stats.targetMovies ?? 0}</span>`;
  }
  if (totalMemoriesEl) {
    totalMemoriesEl.innerHTML = `${stats.totalMemories ?? 0}<span class="recap-target">/${stats.targetMemories ?? 0}</span>`;
  }
  if (daysPercentEl) daysPercentEl.textContent = `${oneDecimalPercent}%`;

  if (daysFillEl) {
    daysFillEl.style.setProperty('--days-progress', `${rawPercent.toFixed(1)}%`);
  }

  const detailCardEl = document.getElementById('recap-detail-card');
  const detailListEl = document.getElementById('recap-detail-list');
  const detailStatusEl = document.getElementById('recap-detail-status');
  const remainingDaysInYear = Math.max(0, totalDaysInYear - dayOfYear);
  const isYearEndUnlocked = remainingDaysInYear === 0;

  if (detailStatusEl) {
    detailStatusEl.textContent = isYearEndUnlocked ? 'Available Now' : `Available in ${remainingDaysInYear} days`;
    detailStatusEl.classList.toggle('is-unlocked', isYearEndUnlocked);
  }

  if (detailCardEl) {
    detailCardEl.classList.toggle('is-collapsed', !isYearEndUnlocked);
  }

  if (detailListEl) {
    if (!isYearEndUnlocked) {
      detailListEl.style.display = 'none';
      detailListEl.innerHTML = '';
    } else {
      detailListEl.style.display = 'flex';

      const eventsThisYearList = SAMPLE_LOGBOOK_DATA.events
        .filter((ev) => Number(ev.year) === currentYear)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const latestEvent = eventsThisYearList[0];
      const latestEventValue = latestEvent
        ? `${latestEvent.title} (${formatDateDisplay(latestEvent.date)})`
        : 'No events logged yet';
      const totalEventsAllYears = SAMPLE_LOGBOOK_DATA.events.length;

      const recapDetails = [
        { label: 'Best Event', value: highlights.bestEvent || '-' },
        { label: 'Best Movie', value: highlights.bestMovie || '-' },
        { label: 'Best Memory', value: highlights.bestMemory || '-' },
        { label: 'Best Place', value: highlights.bestPlace || '-' },
        { label: 'Latest Event', value: latestEventValue },
        { label: 'Latest Movie', value: highlights.latestMovie || '-' },
        { label: 'Latest Memory', value: highlights.latestMemory || '-' },
        { label: 'Total Days Spend (This Year)', value: `${dayOfYear} / ${totalDaysInYear} days` },
        { label: 'Total Event (All Years)', value: `${totalEventsAllYears} events` }
      ];

      detailListEl.innerHTML = recapDetails
        .map(
          (item) => `
            <li class="recap-detail-item">
              <span class="recap-detail-label">${item.label}</span>
              <span class="recap-detail-value">${item.value}</span>
            </li>
          `
        )
        .join('');
    }
  }
}

/**
 * Handles navigation between pages (Home, MyEvent, MyWish, MyRecap, MyProfile)
 */
function setupNavigation() {
  const navButtons = document.querySelectorAll('[data-target]');
  const views = document.querySelectorAll('.view');

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      if (targetId === 'view-mywish' && !getMyWishCountdownInfo().isAvailable) {
        openWishLockedModal();
        return;
      }
      views.forEach((view) => {
        if (view.id === targetId) {
          view.classList.add('active');
        } else {
          view.classList.remove('active');
        }
      });
      if (targetId === 'view-home') {
        renderHomeMenuProgress();
      } else if (targetId === 'view-myrecap') {
        renderMyRecap();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/**
 * Applies a store payload ({ events, wishes, recap }) to in-memory state
 */
function applyStorePayload(data) {
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data.events)) {
    SAMPLE_LOGBOOK_DATA.events = data.events;
  }
  if (data.wishes && typeof data.wishes === 'object') {
    WISH_DATA = data.wishes;
  }
  if (data.recap && typeof data.recap === 'object') {
    globalRecapConfig = data.recap;
  }
}

/**
 * Loads global config & data from /api/store (Vercel Redis/KV), falling back to localStorage offline
 */
async function loadGlobalStore() {
  try {
    if (window.location.protocol !== 'file:') {
      const res = await fetch(GLOBAL_STORE_ENDPOINT, { cache: 'no-store' });
      if (res.ok) {
        const payload = await res.json();
        if (payload && payload.status === 'success' && payload.data) {
          applyStorePayload(payload.data);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload.data));
          } catch (_) {
            // Ignore storage quota errors
          }
          return;
        }
      }
    }
  } catch (_) {
    // Fall back to localStorage when offline or running locally without serverless API
  }

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      applyStorePayload(JSON.parse(cached));
    }
  } catch (_) {
    // Ignore malformed localStorage cache
  }
}

/**
 * Saves current events, wishes, and recap config to /api/store and localStorage
 */
async function saveGlobalStore() {
  const payload = {
    events: SAMPLE_LOGBOOK_DATA.events,
    wishes: WISH_DATA,
    recap: globalRecapConfig
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {
    // Ignore storage quota errors
  }

  if (window.location.protocol === 'file:') return;

  try {
    await fetch(GLOBAL_STORE_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    // Keep localStorage copy if network/API is temporarily unreachable
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  renderHomeMenuProgress();
  setupNavigation();
  setupYearStepper();
  setupEditModal();
  setupWishLockedModal();
  renderMyRecap();
  renderLogbookAccordion();

  await loadGlobalStore();
  setupWishForm();
  renderHomeMenuProgress();
  renderMyRecap();
  renderLogbookAccordion();
});
