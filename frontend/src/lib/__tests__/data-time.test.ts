import { describe, expect, it } from 'vitest';
import { elapsedDurationMs, fmtClockTimer, fmtDate } from '../data';

describe('KDS time helpers', () => {
  it('formats local dates as DD/MM/YYYY', () => {
    expect(fmtDate(new Date(2026, 7, 4, 9, 5, 0))).toBe('04/08/2026');
  });

  it('always formats durations as HH:mm:ss', () => {
    expect(fmtClockTimer(14 * 60_000 + 20_000)).toBe('00:14:20');
    expect(fmtClockTimer(3 * 3_600_000 + 2 * 60_000 + 7_000)).toBe('03:02:07');
  });

  it('clamps negative and invalid durations', () => {
    expect(fmtClockTimer(-1)).toBe('00:00:00');
    expect(fmtClockTimer(Number.NaN)).toBe('00:00:00');
    expect(elapsedDurationMs('2026-08-24 10:00:00', new Date(2026, 7, 24, 9).getTime())).toBe(0);
  });

  it('freezes elapsed time when the supplied completion timestamp stays fixed', () => {
    const createdAt = '2026-08-24 10:00:00';
    const completedAt = new Date(2026, 7, 24, 10, 14, 20).getTime();
    const firstRender = elapsedDurationMs(createdAt, completedAt);
    const laterRender = elapsedDurationMs(createdAt, completedAt);

    expect(firstRender).toBe(14 * 60_000 + 20_000);
    expect(laterRender).toBe(firstRender);
  });
});
