import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup } from '../src/backup.js';

const note = { date: '2026-09-20', text: 'A quiet evening. 🌙\n<script>not code</script>', updatedAt: '2026-09-20T20:00:00.000Z' };

test('backup round-trip preserves multiline Unicode text and unfinished empty drafts', () => {
  const draft = { ...note, text: '' };
  const backup = createBackup([note], [draft]);
  assert.deepEqual(parseBackup(JSON.stringify(backup)), { notes: [note], drafts: [draft] });
});

test('a malformed record invalidates the whole import', () => {
  const backup = createBackup([note, { ...note, date: '2026-02-30' }], []);
  assert.throws(() => parseBackup(JSON.stringify(backup)), /invalid/);
  assert.throws(() => parseBackup('not json'), /JSON/);
  assert.throws(() => parseBackup('{"notes":[]}'), /version 1/);
});

test('duplicate dates, invalid timestamps, and empty saved notes are rejected', () => {
  for (const notes of [[note, note], [{ ...note, updatedAt: 'tomorrow' }], [{ ...note, text: '   ' }]]) {
    assert.throws(() => parseBackup(JSON.stringify(createBackup(notes, []))), /invalid/);
  }
});

test('unsupported fields are not copied into imported records', () => {
  const result = parseBackup(JSON.stringify(createBackup([{ ...note, arbitrary: 'extra' }], [])));
  assert.deepEqual(result.notes, [note]);
});

test('deyam exports keep older Moonlit Pages backups restorable', () => {
  const backup = createBackup([note], []);
  assert.equal(backup.format, 'deyam');
  assert.deepEqual(parseBackup(JSON.stringify({ ...backup, format: 'moonlit-pages' })).notes, [note]);
});
