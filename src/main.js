import './styles.css';
import { dateKey, fromKey, startOfMonth, addDays, addMonths, monthDays, fullDate, editorDate, monthName } from './dates.js';
import * as storage from './storage.js';
import { createBackup, parseBackup, MAX_BACKUP_BYTES } from './backup.js';
import { paintLunarSurface } from './lunar-surface.js';
import { setupPwa } from './pwa.js';
import { setupStickerCorner } from './stickers/corner.js';
import { CAREFUL_DAY_COUNT, cycleEstimate, cycleState } from './cycle.js';

const $ = (id) => document.getElementById(id);
const elements = {
  grid: $('calendar-days'), month: $('month-heading'), count: $('month-note-count'),
  editor: $('editor-panel'), textarea: $('note-text'), status: $('save-status'),
  save: $('save-note'), saveLabel: $('save-button-label'), remove: $('delete-note'),
  dialog: $('options-dialog'), backdrop: $('editor-backdrop'),
};
const mobile = window.matchMedia('(max-width: 820px)');
let selectedKey = dateKey(new Date());
let focusKey = selectedKey;
let visibleMonth = startOfMonth(new Date());
let notes = new Map();
let drafts = new Map();
let cycle;
let ready = false;
let storageUnavailable = false;
let saving = false;
let sheetOpen = false;
let mutationQueue = Promise.resolve();
let pendingWrites = 0;
let failedDrafts = new Set();
let toastTimer;
let toastAction;
let persistRequested = false;
let draftRevision = 0;
let lastToday = selectedKey;
let dismissedCycleMessage = '';
const shortDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

function queueMutation(action) {
  pendingWrites++;
  const result = mutationQueue.then(action);
  mutationQueue = result.catch(() => {}).finally(() => { pendingWrites--; });
  return result;
}

function notify(message, action = null, duration = 6000) {
  clearTimeout(toastTimer);
  $('toast-message').textContent = message;
  toastAction = action;
  $('toast-action').hidden = !action;
  (elements.dialog.open ? elements.dialog : sheetOpen ? elements.editor : document.body).append($('toast'));
  $('toast').hidden = false;
  if (duration) toastTimer = setTimeout(dismissToast, duration);
}

function dismissToast() {
  $('toast').hidden = true;
  toastAction = null;
  clearTimeout(toastTimer);
}

function currentText(key = selectedKey) {
  return drafts.get(key)?.text ?? notes.get(key)?.text ?? '';
}

function setStatus(message, kind = '') {
  if (elements.status.textContent !== message) elements.status.textContent = message;
  elements.status.className = kind ? `is-${kind}` : '';
}

function updateEditorState() {
  const note = notes.get(selectedKey);
  const text = elements.textarea.value;
  const dirty = text !== (note?.text ?? '');
  elements.textarea.disabled = !ready || saving;
  elements.save.disabled = !ready || saving || !text.trim() || !dirty;
  elements.saveLabel.textContent = saving ? 'Saving…' : note && !dirty ? 'Saved' : 'Save note';
  elements.remove.hidden = !note && !drafts.has(selectedKey);
  elements.remove.disabled = !ready || saving;
  const isTrackedStart = cycle?.startDate === selectedKey;
  $('track-cycle').disabled = !ready || saving;
  $('track-cycle').classList.toggle('is-tracked', isTrackedStart);
  $('cycle-button-label').textContent = isTrackedStart ? 'Tracked · remove' : cycle ? 'Update cycle' : 'Track cycle';
  const length = [...text].length;
  $('character-count').textContent = `${length.toLocaleString()} ${length === 1 ? 'character' : 'characters'}`;
}

function showPage() {
  const date = fromKey(selectedKey);
  $('selected-date-label').textContent = editorDate.format(date).toUpperCase();
  elements.textarea.setAttribute('aria-label', `Note for ${fullDate.format(date)}`);
  elements.textarea.value = currentText();
  elements.textarea.disabled = !ready;
  if (storageUnavailable) setStatus('Local storage couldn’t open. Reload to try again.', 'error');
  else if (!ready) setStatus('Opening your pages…');
  else if (failedDrafts.has(selectedKey)) setStatus('Draft not stored. Save or download a backup.', 'error');
  else if (drafts.has(selectedKey)) setStatus('Your unfinished draft is here');
  else if (notes.has(selectedKey)) setStatus('Saved on this device', 'saved');
  else setStatus('A fresh page, just for you');
  updateEditorState();
}

function renderCalendar() {
  const oldFocus = document.activeElement?.dataset.date;
  elements.month.replaceChildren(document.createTextNode(monthName.format(visibleMonth)));
  const year = document.createElement('span');
  year.className = 'month-year';
  year.textContent = String(visibleMonth.getFullYear());
  elements.month.append(year);
  const prefix = dateKey(visibleMonth).slice(0, 7);
  const count = [...notes.keys()].filter((key) => key.startsWith(prefix)).length;
  elements.count.textContent = count ? `${count} ${count === 1 ? 'day' : 'days'} held here` : 'A fresh page awaits';
  const today = dateKey(new Date());
  const estimate = cycleEstimate(cycle?.startDate);
  const carefulDays = new Set(estimate?.carefulDays ?? []);
  $('cycle-legend').hidden = !estimate;
  const dates = monthDays(visibleMonth);
  if (!dates.some((date) => dateKey(date) === focusKey)) {
    focusKey = selectedKey.startsWith(prefix) ? selectedKey : dateKey(visibleMonth);
  }
  const fragment = document.createDocumentFragment();
  for (const date of dates) {
    const key = dateKey(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day';
    button.dataset.date = key;
    button.tabIndex = key === focusKey ? 0 : -1;
    button.classList.toggle('is-outside', date.getMonth() !== visibleMonth.getMonth());
    button.classList.toggle('is-today', key === today);
    button.classList.toggle('is-selected', key === selectedKey);
    button.classList.toggle('has-note', notes.has(key));
    button.classList.toggle('has-draft', drafts.has(key));
    button.classList.toggle('is-cycle-start', key === estimate?.startKey);
    button.classList.toggle('is-expected', key === estimate?.expectedKey);
    button.classList.toggle('is-careful', carefulDays.has(key));
    button.disabled = !fromKey(key);
    button.setAttribute('aria-pressed', String(key === selectedKey));
    button.setAttribute('aria-label', `${fullDate.format(date)}${notes.has(key) ? ', has a note' : ''}${drafts.has(key) ? ', has an unfinished draft' : ''}`);
    if (key === today) button.setAttribute('aria-current', 'date');
    const number = document.createElement('span');
    number.className = 'day-number';
    number.textContent = String(date.getDate());
    button.append(number);
    fragment.append(button);
  }
  elements.grid.replaceChildren(fragment);
  elements.grid.setAttribute('aria-label', `Choose a date in ${monthName.format(visibleMonth)} ${visibleMonth.getFullYear()}`);
  $('previous-month').disabled = visibleMonth.getFullYear() === 1 && visibleMonth.getMonth() === 0;
  $('next-month').disabled = visibleMonth.getFullYear() === 9999 && visibleMonth.getMonth() === 11;
  if (oldFocus) elements.grid.querySelector(`[data-date="${oldFocus}"]`)?.focus({ preventScroll: true });
}

function setBackgroundInert(inert) {
  for (const id of ['topbar', 'hero', 'calendar-panel', 'cycle-reminder', 'mobile-invitation', 'page-footer']) {
    $(id).inert = inert;
  }
}

function updateCycleReminder({ allowSystemNotification = false } = {}) {
  const today = dateKey(new Date());
  const state = cycleState(cycle?.startDate, today);
  const reminder = $('cycle-reminder');
  let message = '';
  if (state?.isReminderDay) {
    message = `A gentle reminder: the next date is estimated for tomorrow. Take a little extra care for the following ${CAREFUL_DAY_COUNT} days.`;
  } else if (state?.carefulDay) {
    message = `Care day ${state.carefulDay} of ${CAREFUL_DAY_COUNT}. This is only a private calendar estimate, so listen to your body first.`;
  }
  const messageKey = message ? `${state.expectedKey}:${state.isReminderDay ? 'reminder' : state.carefulDay}` : '';
  $('cycle-reminder-text').textContent = message;
  reminder.hidden = !message || dismissedCycleMessage === messageKey;
  if (allowSystemNotification && state?.isReminderDay && cycle.lastNotifiedFor !== state.expectedKey) {
    showCycleNotification(state).catch((error) => console.error('Could not show the cycle reminder:', error));
  }
}

async function showCycleNotification(state) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = {
    body: `The next date is estimated for tomorrow. Take care for the following ${CAREFUL_DAY_COUNT} days.`,
    tag: `deyam-cycle-${state.expectedKey}`,
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
  };
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) await registration.showNotification('A gentle reminder from deyam', options);
    else new Notification('A gentle reminder from deyam', options);
  } else {
    new Notification('A gentle reminder from deyam', options);
  }
  cycle = { ...cycle, lastNotifiedFor: state.expectedKey };
  await queueMutation(() => storage.saveCycle(cycle));
}

async function requestCycleNotificationPermission() {
  if (!window.isSecureContext || !('Notification' in window)) return 'unavailable';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return 'unavailable'; }
}

async function trackSelectedCycle() {
  if (!ready || saving) return;
  if (selectedKey > dateKey(new Date())) {
    notify('Choose today or an earlier date as the cycle start.');
    return;
  }
  if (cycle?.startDate === selectedKey) {
    const previous = cycle;
    await queueMutation(() => storage.removeCycle());
    cycle = undefined;
    dismissedCycleMessage = '';
    renderCalendar();
    updateEditorState();
    updateCycleReminder();
    notify('Cycle tracking removed.', async () => {
      cycle = previous;
      await queueMutation(() => storage.saveCycle(cycle));
      renderCalendar();
      updateEditorState();
      updateCycleReminder({ allowSystemNotification: true });
    }, 10000);
    return;
  }
  // Ask while this direct button gesture still has browser permission to prompt.
  const permissionPromise = requestCycleNotificationPermission();
  const candidate = { startDate: selectedKey, updatedAt: new Date().toISOString(), lastNotifiedFor: null };
  await queueMutation(() => storage.saveCycle(candidate));
  cycle = candidate;
  dismissedCycleMessage = '';
  renderCalendar();
  updateEditorState();
  updateCycleReminder();
  const estimate = cycleEstimate(selectedKey);
  const permission = await permissionPromise;
  const expected = shortDate.format(fromKey(estimate.expectedKey));
  if (permission === 'granted') notify(`Cycle start saved. Estimated next date: ${expected}. Reminder enabled.`);
  else if (permission === 'denied') notify(`Cycle start saved. Estimated next date: ${expected}. Browser notifications are blocked.`);
  else notify(`Cycle start saved. Estimated next date: ${expected}. Open deyam regularly for the reminder.`);
  updateCycleReminder({ allowSystemNotification: true });
}

function updateViewport() {
  const viewport = window.visualViewport;
  if (viewport && mobile.matches) {
    document.documentElement.style.setProperty('--visible-height', `${viewport.height}px`);
    document.documentElement.style.setProperty('--keyboard-offset', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    elements.editor.classList.toggle('is-compact', viewport.height < 500);
  }
}

function openEditor() {
  if (!mobile.matches) return;
  sheetOpen = true;
  elements.editor.classList.add('is-open');
  elements.editor.inert = false;
  elements.editor.setAttribute('role', 'dialog');
  elements.editor.setAttribute('aria-modal', 'true');
  elements.editor.append($('toast'));
  elements.backdrop.hidden = false;
  document.body.classList.add('sheet-open');
  setBackgroundInert(true);
  updateViewport();
  $('close-editor').focus({ preventScroll: true });
}

function closeEditor(restoreFocus = true) {
  sheetOpen = false;
  elements.editor.classList.remove('is-open');
  elements.editor.removeAttribute('role');
  elements.editor.removeAttribute('aria-modal');
  elements.backdrop.hidden = true;
  document.body.classList.remove('sheet-open');
  document.body.append($('toast'));
  setBackgroundInert(false);
  if (mobile.matches) elements.editor.inert = true;
  if (restoreFocus) elements.grid.querySelector(`[data-date="${selectedKey}"]`)?.focus({ preventScroll: true });
}

function selectDate(key, open = true) {
  const date = fromKey(key);
  if (!date) return;
  selectedKey = key;
  focusKey = key;
  visibleMonth = startOfMonth(date);
  renderCalendar();
  showPage();
  if (open) openEditor();
}

function writeDraft() {
  if (!ready) return;
  const date = selectedKey;
  const text = elements.textarea.value;
  const revision = ++draftRevision;
  const matchesSaved = text === (notes.get(date)?.text ?? '');
  const draft = { date, text, updatedAt: new Date().toISOString() };
  if (matchesSaved) drafts.delete(date);
  else drafts.set(date, draft);
  updateEditorState();
  renderCalendar();
  // Every edit is immediately queued for local persistence; no debounce timer can
  // drop the last words when a phone backgrounds the app.
  queueMutation(() => matchesSaved ? storage.removeDraft(date) : storage.keepDraft(draft))
    .then(() => {
      failedDrafts.delete(date);
      if (selectedKey !== date || revision !== draftRevision) return;
      if (matchesSaved) {
        setStatus(notes.has(date) ? 'Saved on this device' : 'A fresh page, just for you', notes.has(date) ? 'saved' : '');
      } else {
        setStatus('Draft kept on this device');
      }
    })
    .catch((error) => {
      failedDrafts.add(date);
      console.error('Could not keep the draft:', error);
      if (selectedKey === date) setStatus('Draft not stored. Save or download a backup.', 'error');
    });
}

async function saveCurrentNote() {
  if (elements.save.disabled) return;
  const note = { date: selectedKey, text: elements.textarea.value, updatedAt: new Date().toISOString() };
  const returnToWriting = document.activeElement === elements.textarea;
  saving = true;
  updateEditorState();
  setStatus('Saving your words…');
  try {
    await queueMutation(() => storage.saveNote(note));
    notes.set(note.date, note);
    if (drafts.get(note.date)?.text === note.text) drafts.delete(note.date);
    failedDrafts.delete(note.date);
    if (selectedKey === note.date) {
      if (elements.textarea.value === note.text) setStatus('Saved on this device', 'saved');
      else setStatus('New changes kept as a draft');
    }
    renderCalendar();
    if (!persistRequested && navigator.storage?.persist) {
      persistRequested = true;
      navigator.storage.persist().catch(() => {});
    }
  } catch (error) {
    console.error('Could not save the note:', error);
    if (selectedKey === note.date) setStatus('Couldn’t save. Your text is still here.', 'error');
    notify('Storage may be full. Download a backup from app options.', null, 10000);
  } finally {
    saving = false;
    updateEditorState();
    if (returnToWriting && selectedKey === note.date) elements.textarea.focus({ preventScroll: true });
  }
}

async function deleteCurrentPage() {
  if (!ready || saving) return;
  const date = selectedKey;
  const previous = { notes: notes.has(date) ? [notes.get(date)] : [], drafts: drafts.has(date) ? [drafts.get(date)] : [] };
  if (!previous.notes.length && !previous.drafts.length) return;
  saving = true;
  elements.textarea.disabled = true;
  updateEditorState();
  try {
    await queueMutation(() => storage.removePage(date));
    notes.delete(date);
    drafts.delete(date);
    failedDrafts.delete(date);
    renderCalendar();
    if (selectedKey === date) showPage();
    notify('This page has been cleared.', async () => {
      try {
        const result = await queueMutation(() => storage.restorePages(previous));
        if (result.skipped) {
          notify('There’s new writing on that date. It has been kept.');
          return;
        }
        for (const note of previous.notes) notes.set(note.date, note);
        for (const draft of previous.drafts) drafts.set(draft.date, draft);
        renderCalendar();
        if (selectedKey === date) showPage();
        notify('Your page is back.');
      } catch (error) {
        console.error('Could not restore the page:', error);
        notify('Couldn’t restore the page. Please try Undo again.', toastAction, 0);
      }
    }, 10000);
  } catch (error) {
    console.error('Could not delete the note:', error);
    setStatus('Couldn’t delete. Your page is still here.', 'error');
  } finally {
    saving = false;
    elements.textarea.disabled = !ready;
    updateEditorState();
  }
}

function openOptions() {
  $('backup-status').textContent = '';
  $('export-notes').disabled = !ready;
  $('import-notes').disabled = !ready;
  elements.dialog.showModal();
}

async function exportPages() {
  if (!ready) return;
  await mutationQueue;
  const backup = createBackup(notes.values(), drafts.values());
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `deyam-${dateKey(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  $('backup-status').textContent = `Backup prepared: ${backup.notes.length} saved ${backup.notes.length === 1 ? 'note' : 'notes'} and ${backup.drafts.length} ${backup.drafts.length === 1 ? 'draft' : 'drafts'}. Keep the downloaded file somewhere safe.`;
}

async function importPages(file) {
  if (!file || !ready) return;
  $('import-notes').disabled = true;
  $('backup-status').textContent = 'Opening your backup…';
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 10 MB.');
    const backup = parseBackup(await file.text());
    const occupied = new Set([...notes.keys(), ...drafts.keys()]);
    const locallySkipped = new Set([...backup.notes, ...backup.drafts].filter((page) => occupied.has(page.date)).map((page) => page.date));
    const missing = {
      notes: backup.notes.filter((page) => !occupied.has(page.date)),
      drafts: backup.drafts.filter((page) => !occupied.has(page.date)),
    };
    const result = await queueMutation(() => storage.restorePages(missing));
    result.skipped += locallySkipped.size;
    for (const note of missing.notes) {
      if (result.dates.includes(note.date)) notes.set(note.date, note);
    }
    for (const draft of missing.drafts) {
      if (result.dates.includes(draft.date) && !drafts.has(draft.date)) drafts.set(draft.date, draft);
    }
    renderCalendar();
    showPage();
    $('backup-status').textContent = `${result.restored} ${result.restored === 1 ? 'day' : 'days'} restored.${result.skipped ? ` ${result.skipped} existing ${result.skipped === 1 ? 'day was' : 'days were'} kept.` : ''}`;
  } catch (error) {
    $('backup-status').textContent = error.message || 'Couldn’t restore this backup. Your existing pages are unchanged.';
  } finally {
    $('import-notes').disabled = false;
    $('backup-file').value = '';
  }
}

elements.grid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-date]');
  if (button) selectDate(button.dataset.date);
});
elements.grid.addEventListener('keydown', (event) => {
  const key = event.target.closest('button[data-date]')?.dataset.date;
  if (!key) return;
  const date = fromKey(key);
  let next;
  if (event.key === 'ArrowLeft') next = addDays(date, -1);
  else if (event.key === 'ArrowRight') next = addDays(date, 1);
  else if (event.key === 'ArrowUp') next = addDays(date, -7);
  else if (event.key === 'ArrowDown') next = addDays(date, 7);
  else if (event.key === 'Home') next = addDays(date, -((date.getDay() + 6) % 7));
  else if (event.key === 'End') next = addDays(date, 6 - ((date.getDay() + 6) % 7));
  else if (event.key === 'PageUp') next = addMonths(date, event.shiftKey ? -12 : -1);
  else if (event.key === 'PageDown') next = addMonths(date, event.shiftKey ? 12 : 1);
  if (!next || !fromKey(dateKey(next))) return;
  event.preventDefault();
  focusKey = dateKey(next);
  visibleMonth = startOfMonth(next);
  renderCalendar();
  elements.grid.querySelector(`[data-date="${focusKey}"]`)?.focus();
});
$('previous-month').addEventListener('click', () => { visibleMonth = startOfMonth(addMonths(visibleMonth, -1)); renderCalendar(); });
$('next-month').addEventListener('click', () => { visibleMonth = startOfMonth(addMonths(visibleMonth, 1)); renderCalendar(); });
$('today-button').addEventListener('click', () => selectDate(dateKey(new Date()), false));
elements.textarea.addEventListener('input', writeDraft);
elements.textarea.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); saveCurrentNote(); }
});
elements.save.addEventListener('click', saveCurrentNote);
elements.remove.addEventListener('click', deleteCurrentPage);
$('track-cycle').addEventListener('click', () => {
  trackSelectedCycle().catch((error) => {
    console.error('Could not update cycle tracking:', error);
    notify('Couldn’t update cycle tracking. Your existing setting is unchanged.');
  });
});
$('dismiss-cycle-reminder').addEventListener('click', () => {
  const state = cycleState(cycle?.startDate, dateKey(new Date()));
  dismissedCycleMessage = state ? `${state.expectedKey}:${state.isReminderDay ? 'reminder' : state.carefulDay}` : '';
  $('cycle-reminder').hidden = true;
});
$('close-editor').addEventListener('click', () => closeEditor());
elements.backdrop.addEventListener('click', () => closeEditor());
$('menu-button').addEventListener('click', openOptions);
$('storage-info').addEventListener('click', openOptions);
$('close-options').addEventListener('click', () => elements.dialog.close());
elements.dialog.addEventListener('close', () => {
  if (elements.dialog.contains($('toast'))) document.body.append($('toast'));
});
elements.dialog.addEventListener('click', (event) => {
  if (event.target !== elements.dialog) return;
  const bounds = elements.dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) elements.dialog.close();
});
$('export-notes').addEventListener('click', exportPages);
$('import-notes').addEventListener('click', () => $('backup-file').click());
$('backup-file').addEventListener('change', (event) => importPages(event.target.files[0]));
$('toast-dismiss').addEventListener('click', dismissToast);
$('toast-action').addEventListener('click', async () => {
  const action = toastAction;
  if (!action) return;
  clearTimeout(toastTimer);
  $('toast-action').disabled = true;
  try { await action(); } finally { $('toast-action').disabled = false; }
});
document.addEventListener('keydown', (event) => {
  if (!sheetOpen || elements.dialog.open) return;
  if (event.key === 'Escape') { event.preventDefault(); closeEditor(); }
  if (event.key === 'Tab') {
    const controls = [...elements.editor.querySelectorAll('button:not(:disabled), textarea:not(:disabled)')].filter((element) => !element.hidden && element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
mobile.addEventListener('change', () => {
  closeEditor(false);
  elements.editor.inert = mobile.matches;
  updateViewport();
});
window.visualViewport?.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('scroll', updateViewport);
window.addEventListener('beforeunload', (event) => {
  if (pendingWrites || failedDrafts.size) { event.preventDefault(); event.returnValue = ''; }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && dateKey(new Date()) !== lastToday) {
    lastToday = dateKey(new Date());
    renderCalendar();
  }
  if (!document.hidden) updateCycleReminder({ allowSystemNotification: true });
});
setInterval(() => updateCycleReminder({ allowSystemNotification: true }), 15 * 60 * 1000);

const image = new Image();
image.onload = () => {
  if (paintLunarSurface($('moon-canvas'), image)) $('moon-canvas').classList.add('is-ready');
};
image.src = `${import.meta.env.BASE_URL}assets/moon.jpg`;

renderCalendar();
showPage();
elements.editor.inert = mobile.matches;
setupStickerCorner();
setupPwa({
  beforeUpdate: async () => {
    await mutationQueue;
    if (failedDrafts.size) throw new Error('Keep or export unfinished writing before updating.');
  },
  notify,
});

try {
  const pages = await storage.openStorage();
  notes = new Map(pages.notes.map((note) => [note.date, note]));
  drafts = new Map(pages.drafts.map((draft) => [draft.date, draft]));
  cycle = await storage.readCycle();
  ready = true;
  renderCalendar();
  showPage();
  updateCycleReminder({ allowSystemNotification: true });
  document.body.dataset.ready = 'true';
} catch (error) {
  console.error('Could not open local storage:', error);
  storageUnavailable = true;
  setStatus('Local storage couldn’t open. Reload to try again.', 'error');
  notify('Your browser couldn’t open local storage. Check browser settings, then reload.', null, 0);
  document.body.dataset.ready = 'error';
} finally {
  $('calendar-panel').setAttribute('aria-busy', 'false');
  elements.editor.setAttribute('aria-busy', 'false');
}
