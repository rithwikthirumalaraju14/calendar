import { openDB } from 'idb';

let database;

export async function openStorage() {
  // Keep the original database name so the deyam rebrand preserves existing pages.
  database = await openDB('moonlit-pages', 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    },
    blocking() {
      database?.close();
    },
  });
  return readPages();
}

export async function readCycle() {
  return database.get('settings', 'cycle');
}

export async function saveCycle(value) {
  const transaction = database.transaction('settings', 'readwrite');
  await transaction.store.put({ key: 'cycle', ...value });
  await transaction.done;
}

export async function removeCycle() {
  const transaction = database.transaction('settings', 'readwrite');
  await transaction.store.delete('cycle');
  await transaction.done;
}

export async function readPages() {
  const transaction = database.transaction(['notes', 'drafts'], 'readonly');
  const [notes, drafts] = await Promise.all([
    transaction.objectStore('notes').getAll(),
    transaction.objectStore('drafts').getAll(),
  ]);
  await transaction.done;
  return { notes, drafts };
}

export async function keepDraft(draft) {
  const transaction = database.transaction('drafts', 'readwrite');
  await transaction.store.put(draft);
  await transaction.done;
}

export async function removeDraft(date) {
  const transaction = database.transaction('drafts', 'readwrite');
  await transaction.store.delete(date);
  await transaction.done;
}

export async function saveNote(note) {
  const transaction = database.transaction(['notes', 'drafts'], 'readwrite');
  await Promise.all([
    transaction.objectStore('notes').put(note),
    transaction.objectStore('drafts').delete(note.date),
  ]);
  await transaction.done;
}

export async function removePage(date) {
  const transaction = database.transaction(['notes', 'drafts'], 'readwrite');
  await Promise.all([
    transaction.objectStore('notes').delete(date),
    transaction.objectStore('drafts').delete(date),
  ]);
  await transaction.done;
}

// Imports and undo only fill unoccupied dates, inside one atomic transaction.
// Existing saved notes OR drafts take precedence over a backup.
export async function restorePages(backup) {
  const transaction = database.transaction(['notes', 'drafts'], 'readwrite');
  const notes = transaction.objectStore('notes');
  const drafts = transaction.objectStore('drafts');
  const [noteKeys, draftKeys] = await Promise.all([notes.getAllKeys(), drafts.getAllKeys()]);
  const occupied = new Set([...noteKeys, ...draftKeys]);
  const restored = new Set();
  const skipped = new Set();
  const writes = [];
  for (const [records, store] of [[backup.notes, notes], [backup.drafts, drafts]]) {
    for (const record of records) {
      if (occupied.has(record.date)) skipped.add(record.date);
      else {
        writes.push(store.put(record));
        restored.add(record.date);
      }
    }
  }
  await Promise.all(writes);
  await transaction.done;
  return { restored: restored.size, skipped: skipped.size, dates: [...restored] };
}
