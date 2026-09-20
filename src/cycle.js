import { addDays, dateKey, fromKey } from './dates.js';

export const CYCLE_LENGTH_DAYS = 25;
export const CAREFUL_DAY_COUNT = 6;

export function cycleEstimate(startKey) {
  const start = fromKey(startKey);
  if (!start) return null;
  const expected = addDays(start, CYCLE_LENGTH_DAYS);
  const carefulDays = Array.from({ length: CAREFUL_DAY_COUNT }, (_, index) => dateKey(addDays(expected, index)));
  return {
    startKey,
    expectedKey: dateKey(expected),
    reminderKey: dateKey(addDays(expected, -1)),
    carefulDays,
  };
}

export function cycleState(startKey, currentKey) {
  const estimate = cycleEstimate(startKey);
  if (!estimate || !fromKey(currentKey)) return null;
  const carefulIndex = estimate.carefulDays.indexOf(currentKey);
  return {
    ...estimate,
    isReminderDay: currentKey === estimate.reminderKey,
    carefulDay: carefulIndex === -1 ? 0 : carefulIndex + 1,
  };
}
