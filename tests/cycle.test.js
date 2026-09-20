import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREFUL_DAY_COUNT, cycleEstimate, cycleState } from '../src/cycle.js';

test('cycle estimate is 25 days after the selected local date', () => {
  const estimate = cycleEstimate('2026-09-20');
  assert.equal(estimate.expectedKey, '2026-10-15');
  assert.equal(estimate.reminderKey, '2026-10-14');
  assert.deepEqual(estimate.carefulDays, ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
  assert.equal(estimate.carefulDays.length, CAREFUL_DAY_COUNT);
});

test('cycle estimate crosses month, year, and leap-day boundaries', () => {
  assert.equal(cycleEstimate('2026-12-20').expectedKey, '2027-01-14');
  assert.equal(cycleEstimate('2024-02-10').expectedKey, '2024-03-06');
  assert.equal(cycleEstimate('2024-02-29').expectedKey, '2024-03-25');
});

test('cycle state identifies the prior-day reminder and six careful days', () => {
  assert.equal(cycleState('2026-08-27', '2026-09-20').isReminderDay, true);
  for (let day = 21; day <= 26; day++) {
    assert.equal(cycleState('2026-08-27', `2026-09-${day}`).carefulDay, day - 20);
  }
  assert.equal(cycleState('2026-08-27', '2026-09-27').carefulDay, 0);
  assert.equal(cycleState('invalid', '2026-09-20'), null);
});
