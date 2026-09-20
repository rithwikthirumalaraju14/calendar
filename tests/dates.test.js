import test from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, fromKey, monthDays, addDays, addMonths } from '../src/dates.js';

test('date keys preserve local calendar dates, including early years', () => {
  for (const key of ['2026-09-20', '2024-02-29', '0004-02-29', '0099-12-31', '2000-02-29']) {
    const parsed = fromKey(key);
    assert.ok(parsed);
    assert.equal(parsed.getHours(), 12);
    assert.equal(dateKey(parsed), key);
  }
});

test('invalid dates and non-leap February 29 are rejected', () => {
  for (const key of ['2025-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '0000-01-01', '2026-1-1', '<script>', null]) {
    assert.equal(fromKey(key), null, String(key));
  }
});

test('month grid starts Monday and crosses a year boundary correctly', () => {
  const days = monthDays(fromKey('2026-01-01'));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(dateKey(days[0]), '2025-12-29');
  assert.equal(dateKey(days.at(-1)), '2026-02-08');
  assert.equal(new Set(days.map(dateKey)).size, 42);
});

test('month navigation clamps long months and leap days', () => {
  assert.equal(dateKey(addMonths(fromKey('2024-01-31'), 1)), '2024-02-29');
  assert.equal(dateKey(addMonths(fromKey('2025-01-31'), 1)), '2025-02-28');
  assert.equal(dateKey(addMonths(fromKey('2024-02-29'), 12)), '2025-02-28');
  assert.equal(dateKey(addMonths(fromKey('2026-01-01'), -1)), '2025-12-01');
  assert.equal(dateKey(addDays(fromKey('2026-03-08'), 1)), '2026-03-09');
});
