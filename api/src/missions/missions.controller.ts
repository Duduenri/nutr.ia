import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MealEntry, User } from '@prisma/client';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { addDays, formatDay, parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

interface DayData {
  entries: MealEntry[];
  waterMl: number;
  activities: number;
  steps: number;
}

interface Mission {
  key: string;
  title: string;
  progress: number;
  goal: number;
}

const AI_SOURCES = new Set(['PHOTO', 'TEXT', 'VOICE']);
const MONTH_GOAL = 60;
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function dailyMissions(user: User, d: DayData): Mission[] {
  const cup = user.cupSizeMl;
  const cups = Math.ceil((user.waterTargetMl ?? 2000) / cup);
  const meals = new Set(d.entries.map((e) => e.meal)).size;
  const protein = d.entries.reduce((s, e) => s + e.protein, 0);
  const kcal = d.entries.reduce((s, e) => s + e.kcal, 0);
  const target = user.kcalTarget ?? 2000;
  return [
    { key: 'meals', title: 'Registre 3 refeições', progress: meals, goal: 3 },
    {
      key: 'water',
      title: `Beba ${cups} copos de água`,
      progress: Math.floor(d.waterMl / cup),
      goal: cups,
    },
    {
      key: 'protein',
      title: `Coma ${user.proteinTarget ?? 0} g de proteína`,
      progress: Math.round(protein),
      goal: user.proteinTarget ?? 1,
    },
    {
      key: 'move',
      title: 'Registre 1 atividade ou 6.000 passos',
      progress: d.activities > 0 || d.steps >= 6000 ? 1 : 0,
      goal: 1,
    },
    {
      key: 'kcal',
      title: 'Feche o dia dentro da meta de calorias',
      progress: meals >= 3 && kcal <= target * 1.05 ? 1 : 0,
      goal: 1,
    },
  ].map((m) => ({ ...m, progress: Math.min(m.progress, m.goal) }));
}

function mondayOf(date: Date): Date {
  const dow = (date.getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

@Controller('missions')
@UseGuards(AuthGuard)
export class MissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':date')
  async get(@UserId() userId: string, @Param('date') day: string) {
    const date = parseDay(day);
    const monthStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
    );
    const weekStart = mondayOf(date);
    const from = monthStart < weekStart ? monthStart : weekStart;
    const range = { gte: from, lte: date };

    const [
      user,
      entries,
      water,
      activities,
      steps,
      weights,
      streakDays,
      fasts,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.mealEntry.findMany({ where: { userId, date: range } }),
      this.prisma.waterLog.findMany({ where: { userId, date: range } }),
      this.prisma.activity.findMany({ where: { userId, date: range } }),
      this.prisma.dailySteps.findMany({ where: { userId, date: range } }),
      this.prisma.weightLog.count({
        where: { userId, date: { gte: weekStart, lte: date } },
      }),
      this.prisma.mealEntry.findMany({
        where: { userId, date: { lte: date } },
        distinct: ['date'],
        select: { date: true },
        orderBy: { date: 'desc' },
        take: 400,
      }),
      this.prisma.fast.findMany({
        where: {
          userId,
          endAt: { not: null },
          startAt: { gte: weekStart, lt: addDays(date, 1) },
        },
      }),
    ]);

    const days = new Map<string, DayData>();
    const get = (d: Date) => {
      const key = formatDay(d);
      let v = days.get(key);
      if (!v) {
        v = { entries: [], waterMl: 0, activities: 0, steps: 0 };
        days.set(key, v);
      }
      return v;
    };
    entries.forEach((e) => get(e.date).entries.push(e));
    water.forEach((w) => (get(w.date).waterMl += w.ml));
    activities.forEach((a) => get(a.date).activities++);
    steps.forEach((s) => (get(s.date).steps = s.steps));

    const today = dailyMissions(
      user,
      days.get(day) ?? { entries: [], waterMl: 0, activities: 0, steps: 0 },
    );

    let monthDone = 0;
    for (let d = monthStart; d <= date; d = addDays(d, 1)) {
      const data = days.get(formatDay(d));
      if (data) {
        monthDone += dailyMissions(user, data).filter(
          (m) => m.progress >= m.goal,
        ).length;
      }
    }

    let waterDays = 0;
    let aiUses = 0;
    for (let d = weekStart; d <= date; d = addDays(d, 1)) {
      const data = days.get(formatDay(d));
      if (!data) continue;
      if (data.waterMl >= (user.waterTargetMl ?? 2000)) waterDays++;
      aiUses += data.entries.filter((e) => AI_SOURCES.has(e.source)).length;
    }

    const completedFasts = fasts.filter(
      (f) =>
        f.endAt!.getTime() - f.startAt.getTime() >= f.goalHours * 3_600_000,
    ).length;

    const loggedDays = new Set(streakDays.map((s) => formatDay(s.date)));
    let cursor = loggedDays.has(day) ? date : addDays(date, -1);
    let streak = 0;
    while (loggedDays.has(formatDay(cursor))) {
      streak++;
      cursor = addDays(cursor, -1);
    }

    const daysInMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();

    return {
      streak,
      month: {
        title: `Missão de ${MONTHS[date.getUTCMonth()]}`,
        daysLeft: daysInMonth - date.getUTCDate(),
        progress: Math.min(monthDone, MONTH_GOAL),
        goal: MONTH_GOAL,
      },
      daily: today,
      weekly: [
        {
          key: 'weight',
          title: 'Registre seu peso 2 vezes',
          progress: Math.min(weights, 2),
          goal: 2,
        },
        {
          key: 'ai',
          title: 'Registre 5 alimentos com a IA',
          progress: Math.min(aiUses, 5),
          goal: 5,
        },
        {
          key: 'waterDays',
          title: 'Bata a meta de água em 4 dias',
          progress: Math.min(waterDays, 4),
          goal: 4,
        },
        ...(user.fastingPlan
          ? [
              {
                key: 'fasting',
                title: `Complete 3 jejuns ${user.fastingPlan}`,
                progress: Math.min(completedFasts, 3),
                goal: 3,
              },
            ]
          : []),
      ],
    };
  }
}
