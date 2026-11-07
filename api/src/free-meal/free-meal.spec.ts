import { parseDay } from '../common/date';
import {
  freeMealChecker,
  weeksToFreeze,
  weekStartOf,
  type FreeMealSettings,
  type FreeMealWeekRow,
} from './free-meal';
import { junkStats, qualityAchievementStats } from '../diary/food-quality';

const saturdayDinner: FreeMealSettings = {
  freeMealEnabled: true,
  freeMealWeekday: 6,
  freeMeal: 'DINNER',
  freeMealSince: parseDay('2026-10-20'),
};

const row = (
  weekStart: string,
  date: string,
  meal: FreeMealWeekRow['meal'],
  swapped = false,
): FreeMealWeekRow => ({
  weekStart: parseDay(weekStart),
  date: parseDay(date),
  meal,
  swapped,
});

describe('weekStartOf', () => {
  it('starts weeks on monday', () => {
    expect(weekStartOf('2026-11-02')).toBe('2026-11-02');
    expect(weekStartOf('2026-11-07')).toBe('2026-11-02');
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02');
  });
});

describe('freeMealChecker', () => {
  it('marks only the configured meal on the configured weekday', () => {
    const free = freeMealChecker(saturdayDinner, []);
    expect(free.isFreeMeal('2026-11-07', 'DINNER')).toBe(true);
    expect(free.isFreeMeal('2026-11-07', 'LUNCH')).toBe(false);
    expect(free.isFreeDay('2026-11-07')).toBe(true);
    expect(free.isFreeDay('2026-11-06')).toBe(false);
  });

  it('ignores weeks before the feature was enabled', () => {
    const free = freeMealChecker(
      { ...saturdayDinner, freeMealSince: parseDay('2026-11-08') },
      [],
    );
    expect(free.isFreeMeal('2026-11-07', 'DINNER')).toBe(false);
    expect(free.isFreeMeal('2026-11-14', 'DINNER')).toBe(true);
  });

  it('a swap replaces the default slot of that week only', () => {
    const free = freeMealChecker(saturdayDinner, [
      row('2026-11-02', '2026-11-04', 'LUNCH', true),
    ]);
    expect(free.isFreeMeal('2026-11-04', 'LUNCH')).toBe(true);
    expect(free.isFreeMeal('2026-11-07', 'DINNER')).toBe(false);
    expect(free.isFreeMeal('2026-11-14', 'DINNER')).toBe(true);
  });

  it('keeps frozen history after the feature is disabled', () => {
    const free = freeMealChecker(
      {
        freeMealEnabled: false,
        freeMealWeekday: null,
        freeMeal: null,
        freeMealSince: null,
      },
      [row('2026-10-26', '2026-10-31', 'DINNER')],
    );
    expect(free.isFreeMeal('2026-10-31', 'DINNER')).toBe(true);
    expect(free.isFreeMeal('2026-11-07', 'DINNER')).toBe(false);
  });
});

describe('weeksToFreeze', () => {
  it('freezes past default slots that have no row yet', () => {
    const slots = weeksToFreeze(
      saturdayDinner,
      [row('2026-10-26', '2026-10-29', 'LUNCH', true)],
      '2026-11-06',
    );
    expect(slots).toEqual([
      { date: '2026-10-24', meal: 'DINNER', swapped: false },
    ]);
  });

  it('freezes this week when its slot is today', () => {
    const slots = weeksToFreeze(
      { ...saturdayDinner, freeMealSince: parseDay('2026-11-02') },
      [],
      '2026-11-07',
    );
    expect(slots.map((s) => s.date)).toEqual(['2026-11-07']);
  });

  it('does not freeze an upcoming slot of this week', () => {
    const slots = weeksToFreeze(
      { ...saturdayDinner, freeMealSince: parseDay('2026-11-02') },
      [],
      '2026-11-06',
    );
    expect(slots).toEqual([]);
  });

  it('freezes this week when its slot already passed', () => {
    const slots = weeksToFreeze(
      { ...saturdayDinner, freeMealSince: parseDay('2026-11-02') },
      [],
      '2026-11-08',
    );
    expect(slots.map((s) => s.date)).toEqual(['2026-11-07']);
  });
});

describe('quality stats with a free meal', () => {
  const pizza = {
    name: 'Pizza',
    kcal: 800,
    quality: 'BAD' as const,
    qualityTags: ['fastfood'],
  };
  const rice = {
    name: 'Arroz',
    kcal: 200,
    quality: 'GOOD' as const,
    qualityTags: [],
  };

  it('junkStats moves free meal kcal out of the junk share', () => {
    const stats = junkStats([rice, { ...pizza, free: true }]);
    expect(stats.badCount).toBe(0);
    expect(stats.badPct).toBe(0);
    expect(stats.freePct).toBe(80);
    expect(stats.freeCount).toBe(1);
  });

  it('a free meal does not break a clean day', () => {
    const day = (free: boolean) =>
      [rice, rice, { ...pizza, free }].map((e) => ({
        ...e,
        date: parseDay('2026-11-07'),
      }));
    expect(qualityAchievementStats(day(true), '2026-11-08').cleanDays).toBe(1);
    expect(qualityAchievementStats(day(false), '2026-11-08').cleanDays).toBe(0);
  });
});
