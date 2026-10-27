import { Injectable } from '@nestjs/common';
import { addDays, formatDay, parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import {
  formulaTdee,
  goalAdjust,
  KCAL_PER_KG,
  kcalFloor,
  splitMacros,
} from './nutrition';

const WINDOW_DAYS = 28;
const MIN_LOGGED_DAYS = 10;
const MIN_WEIGHT_SPAN_DAYS = 10;
const MAX_STEP_KCAL = 300;
const DAY_MS = 86_400_000;

export type AdaptiveStatus =
  'not_applicable' | 'collecting' | 'unreliable' | 'ready';

export interface AdaptiveEstimate {
  status: AdaptiveStatus;
  windowDays: number;
  loggedDays: number;
  minLoggedDays: number;
  weighIns: number;
  weightSpanDays: number;
  minWeightSpanDays: number;
  avgIntake: number | null;
  weeklyChangeKg: number | null;
  tdee: number | null;
  formulaTdee: number | null;
  goalAdjust: number;
  current: { kcal: number; protein: number; carbs: number; fat: number };
  suggested: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  capped: boolean;
}

function slopePerDay(points: { t: number; kg: number }[]): number {
  const n = points.length;
  const mt = points.reduce((s, p) => s + p.t, 0) / n;
  const mk = points.reduce((s, p) => s + p.kg, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mt) * (p.kg - mk);
    den += (p.t - mt) ** 2;
  }
  return den ? num / den : 0;
}

@Injectable()
export class AdaptiveService {
  constructor(private readonly prisma: PrismaService) {}

  async estimate(userId: string, todayRaw: string): Promise<AdaptiveEstimate> {
    const today = parseDay(todayRaw.slice(0, 10));
    const from = addDays(today, -WINDOW_DAYS);
    const [user, days, weights] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.mealEntry.groupBy({
        by: ['date'],
        where: { userId, date: { gte: from, lt: today } },
        _sum: { kcal: true },
      }),
      this.prisma.weightLog.findMany({
        where: { userId, date: { gte: from, lte: today } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const current = {
      kcal: user.kcalTarget ?? 0,
      protein: user.proteinTarget ?? 0,
      carbs: user.carbsTarget ?? 0,
      fat: user.fatTarget ?? 0,
    };
    const minDay = Math.max(600, current.kcal * 0.45);
    const logged = days
      .map((d) => d._sum.kcal ?? 0)
      .filter((kcal) => kcal >= minDay);

    const byDay = new Map<string, number[]>();
    for (const w of weights) {
      const k = formatDay(w.date);
      byDay.set(k, [...(byDay.get(k) ?? []), w.kg]);
    }
    const points = [...byDay.entries()].map(([d, kgs]) => ({
      t: parseDay(d).getTime() / DAY_MS,
      kg: kgs.reduce((a, b) => a + b, 0) / kgs.length,
    }));
    const span = points.length
      ? Math.round(points[points.length - 1].t - points[0].t)
      : 0;
    const latestKg = points.length
      ? points[points.length - 1].kg
      : user.startWeightKg;

    const formula =
      user.sex &&
      user.birthDate &&
      user.heightCm &&
      user.activityLevel &&
      latestKg
        ? Math.round(
            formulaTdee({
              sex: user.sex,
              birthDate: user.birthDate,
              heightCm: user.heightCm,
              weightKg: latestKg,
              activityLevel: user.activityLevel,
            }),
          )
        : null;
    const adjust =
      user.goal && latestKg
        ? goalAdjust({
            goal: user.goal,
            weightKg: latestKg,
            targetWeightKg: user.targetWeightKg,
            targetDate: user.targetDate,
          })
        : 0;

    const base: AdaptiveEstimate = {
      status: 'collecting',
      windowDays: WINDOW_DAYS,
      loggedDays: logged.length,
      minLoggedDays: MIN_LOGGED_DAYS,
      weighIns: points.length,
      weightSpanDays: span,
      minWeightSpanDays: MIN_WEIGHT_SPAN_DAYS,
      avgIntake: logged.length
        ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length)
        : null,
      weeklyChangeKg: null,
      tdee: null,
      formulaTdee: formula,
      goalAdjust: adjust,
      current,
      suggested: null,
      capped: false,
    };
    if (user.bariatric || !user.sex || !user.goal || !current.kcal) {
      return { ...base, status: 'not_applicable' };
    }
    if (
      logged.length < MIN_LOGGED_DAYS ||
      points.length < 2 ||
      span < MIN_WEIGHT_SPAN_DAYS
    ) {
      return base;
    }

    const slope = slopePerDay(points);
    const tdee = Math.round(base.avgIntake! - slope * KCAL_PER_KG);
    const result = {
      ...base,
      weeklyChangeKg: Math.round(slope * 7 * 100) / 100,
      tdee,
    };
    if (tdee < 1000 || tdee > 5000) {
      return { ...result, status: 'unreliable' as const };
    }

    const ideal = Math.max(kcalFloor(user.sex), tdee + adjust);
    const step = Math.max(
      -MAX_STEP_KCAL,
      Math.min(MAX_STEP_KCAL, ideal - current.kcal),
    );
    const kcal = Math.round((current.kcal + step) / 50) * 50;
    const { fat, carbs } = splitMacros(kcal, current.protein);
    return {
      ...result,
      status: 'ready',
      suggested: { kcal, protein: current.protein, carbs, fat },
      capped: Math.abs(ideal - current.kcal) > MAX_STEP_KCAL,
    };
  }
}
