import { MealType } from '@prisma/client';
import { addDays, formatDay, parseDay } from '../common/date';

export interface FreeMealSettings {
  freeMealEnabled: boolean;
  freeMealWeekday: number | null;
  freeMeal: MealType | null;
  freeMealSince: Date | null;
}

export interface FreeMealWeekRow {
  weekStart: Date;
  date: Date;
  meal: MealType;
  swapped: boolean;
}

export interface FreeMealSlot {
  date: string;
  meal: MealType;
  swapped: boolean;
}

export function weekStartOf(day: string): string {
  const date = parseDay(day);
  return formatDay(addDays(date, -((date.getUTCDay() + 6) % 7)));
}

export function defaultSlot(
  settings: FreeMealSettings,
  weekStart: string,
): FreeMealSlot | null {
  if (
    !settings.freeMealEnabled ||
    settings.freeMealWeekday === null ||
    !settings.freeMeal ||
    !settings.freeMealSince
  ) {
    return null;
  }
  const date = formatDay(
    addDays(parseDay(weekStart), (settings.freeMealWeekday + 6) % 7),
  );
  if (date < formatDay(settings.freeMealSince)) return null;
  return { date, meal: settings.freeMeal, swapped: false };
}

export function slotOfWeek(
  settings: FreeMealSettings,
  rows: FreeMealWeekRow[],
  weekStart: string,
): FreeMealSlot | null {
  const row = rows.find((r) => formatDay(r.weekStart) === weekStart);
  if (row) {
    return { date: formatDay(row.date), meal: row.meal, swapped: row.swapped };
  }
  return defaultSlot(settings, weekStart);
}

export function freeMealChecker(
  settings: FreeMealSettings,
  rows: FreeMealWeekRow[],
) {
  const cache = new Map<string, FreeMealSlot | null>();
  const slotFor = (day: string) => {
    const week = weekStartOf(day);
    if (!cache.has(week)) cache.set(week, slotOfWeek(settings, rows, week));
    const slot = cache.get(week)!;
    return slot && slot.date === day ? slot : null;
  };
  const dayOf = (date: Date | string) =>
    typeof date === 'string' ? date : formatDay(date);
  return {
    slotOn: (date: Date | string) => slotFor(dayOf(date)),
    isFreeDay: (date: Date | string) => slotFor(dayOf(date)) !== null,
    isFreeMeal: (date: Date | string, meal: MealType) =>
      slotFor(dayOf(date))?.meal === meal,
  };
}

export type FreeMealChecker = ReturnType<typeof freeMealChecker>;

export function weeksToFreeze(
  settings: FreeMealSettings,
  rows: FreeMealWeekRow[],
  today: string,
): FreeMealSlot[] {
  if (!settings.freeMealSince) return [];
  const slots: FreeMealSlot[] = [];
  const last = weekStartOf(today);
  for (
    let week = weekStartOf(formatDay(settings.freeMealSince));
    week <= last;
    week = formatDay(addDays(parseDay(week), 7))
  ) {
    if (rows.some((r) => formatDay(r.weekStart) === week)) continue;
    const slot = defaultSlot(settings, week);
    if (slot && slot.date <= today) slots.push(slot);
  }
  return slots;
}

export const MEAL_NAME: Record<MealType, string> = {
  BREAKFAST: 'café da manhã',
  LUNCH: 'almoço',
  DINNER: 'jantar',
  SNACK: 'lanche',
};

const WEEKDAY_NAME = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

export function describeFreeMeal(
  settings: { enabled: boolean; weekday: number | null; meal: MealType | null },
  week: FreeMealSlot | null,
  today: string,
): string | null {
  if (!settings.enabled || settings.weekday === null || !settings.meal) {
    return null;
  }
  const lines = [
    `Refeição livre combinada: ${MEAL_NAME[settings.meal]} de ${WEEKDAY_NAME[settings.weekday]}, uma vez por semana. Nessa refeição a pessoa come o que quiser: não repreenda, não chame de porcaria e não sugira compensar depois. As outras refeições do dia seguem o plano normal.`,
  ];
  if (week) {
    const weekday = WEEKDAY_NAME[parseDay(week.date).getUTCDay()];
    lines.push(
      week.date === today
        ? `Hoje é o dia da refeição livre (${MEAL_NAME[week.meal]}).`
        : `Nesta semana a refeição livre ${week.date < today ? 'foi' : 'é'} ${MEAL_NAME[week.meal]} de ${weekday} (${week.date})${week.swapped ? ', trocada do dia de sempre' : ''}.`,
    );
  }
  return lines.join(' ');
}
