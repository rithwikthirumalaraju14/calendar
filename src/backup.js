import { fromKey } from './dates.js';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export function createBackup(notes, drafts) {
  return {
    format: 'deyam',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: [...notes].sort((a, b) => a.date.localeCompare(b.date)),
    drafts: [...drafts].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('That file is not readable JSON. Choose a deyam backup.');
  }
  if (!backup || !['deyam', 'moonlit-pages'].includes(backup.format) || backup.version !== 1 || !Array.isArray(backup.notes) || !Array.isArray(backup.drafts)) {
    throw new Error('Choose a backup downloaded from deyam (version 1).');
  }
  const validate = (records, isDraft) => {
    if (records.length > 100000) throw new Error('This backup has too many pages.');
    const seen = new Set();
    return records.map((record) => {
      if (!record || !fromKey(record.date) || typeof record.text !== 'string' || record.text.length > 1000000 || (!isDraft && !record.text.trim()) || typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt)) || seen.has(record.date)) {
        throw new Error('This backup contains an invalid or duplicate page. Nothing was imported.');
      }
      seen.add(record.date);
      // Copy only the supported fields. Note content is always rendered as text.
      return { date: record.date, text: record.text, updatedAt: record.updatedAt };
    });
  };
  return { notes: validate(backup.notes, false), drafts: validate(backup.drafts, true) };
}
