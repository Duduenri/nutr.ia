import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { MealEntry, MealType } from '@prisma/client';
import { addDays, formatDay, parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { classifyFood } from './food-quality';
import { FreeMealService } from '../free-meal/free-meal.service';

export const MEAL_SPLIT: Record<MealType, number> = {
  BREAKFAST: 0.3,
  LUNCH: 0.3,
  DINNER: 0.3,
  SNACK: 0.1,
};

const KCAL_PER_STEP = 0.04;

type Micros = Record<string, number>;

export function sumEntries(entries: MealEntry[]) {
  const micros: Micros = {};
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const e of entries) {
    totals.kcal += e.kcal;
    totals.protein += e.protein;
    totals.carbs += e.carbs;
    totals.fat += e.fat;
    totals.fiber += e.fiber ?? 0;
    for (const [k, v] of Object.entries((e.micros as Micros | null) ?? {})) {
      if (typeof v === 'number') {
        micros[k] = (micros[k] ?? 0) + v;
      }
    }
  }
  return { ...totals, micros };
}

@Injectable()
export class DiaryService implements OnModuleInit {
  private readonly logger = new Logger(DiaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly freeMeal: FreeMealService,
  ) {}

  async onModuleInit() {
    const pending = await this.prisma.mealEntry.findMany({
      where: { quality: null },
      select: { id: true, name: true, food: { select: { category: true } } },
    });
    if (!pending.length) return;
    const groups = new Map<string, string[]>();
    for (const e of pending) {
      const r = classifyFood(e.name, e.food?.category);
      const key = JSON.stringify([r.quality, r.qualityTags]);
      groups.set(key, [...(groups.get(key) ?? []), e.id]);
    }
    for (const [key, ids] of groups) {
      const [quality, qualityTags] = JSON.parse(key) as [
        ReturnType<typeof classifyFood>['quality'],
        string[],
      ];
      await this.prisma.mealEntry.updateMany({
        where: { id: { in: ids } },
        data: { quality, qualityTags },
      });
    }
    this.logger.log(`Classified food quality of ${pending.length} entries`);
  }

  async day(userId: string, day: string) {
    const date = parseDay(day);
    const where = { userId, date };
    const [user, entries, water, activities, notes, steps, yesterday, free] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.mealEntry.findMany({
          where,
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.waterLog.findMany({ where, orderBy: { createdAt: 'asc' } }),
        this.prisma.activity.findMany({
          where,
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.note.findMany({ where, orderBy: { createdAt: 'asc' } }),
        this.prisma.dailySteps.findUnique({
          where: { userId_date: { userId, date } },
        }),
        this.prisma.mealEntry.groupBy({
          by: ['meal'],
          where: { userId, date: addDays(date, -1) },
          _count: { _all: true },
        }),
        this.freeMeal.checker(userId),
      ]);
    if (!user) {
      throw new NotFoundException();
    }

    const kcalTarget = user.kcalTarget ?? 2000;
    const freeMeal = free.slotOn(date);
    const meals = (Object.keys(MEAL_SPLIT) as MealType[]).map((meal) => {
      const items = entries.filter((e) => e.meal === meal);
      return {
        meal,
        free: freeMeal?.meal === meal,
        targetKcal: Math.round(kcalTarget * MEAL_SPLIT[meal]),
        kcal: Math.round(items.reduce((s, e) => s + e.kcal, 0)),
        yesterdayCount:
          yesterday.find((y) => y.meal === meal)?._count._all ?? 0,
        entries: items.map((e) => ({
          ...e,
          date: formatDay(e.date),
          photoUrl: e.photoId ? `/api/photos/${e.photoId}/file` : null,
        })),
      };
    });

    const stepsCount = steps?.steps ?? 0;
    const activityKcal = activities.reduce((s, a) => s + a.kcal, 0);

    return {
      date: day,
      targets: {
        kcal: kcalTarget,
        protein: user.proteinTarget,
        carbs: user.carbsTarget,
        fat: user.fatTarget,
        fiber: user.fiberTarget,
        waterMl: user.waterTargetMl,
        cupSizeMl: user.cupSizeMl,
        exerciseCredit: user.exerciseCredit,
      },
      totals: sumEntries(entries),
      burned: Math.round(activityKcal + stepsCount * KCAL_PER_STEP),
      burnedCredit: Math.round(
        ((activityKcal + stepsCount * KCAL_PER_STEP) * user.exerciseCredit) /
          100,
      ),
      steps: stepsCount,
      freeMeal,
      meals,
      water: {
        ml: water.reduce((s, w) => s + w.ml, 0),
        logs: water.map((w) => ({ id: w.id, ml: w.ml })),
      },
      activities: activities.map((a) => ({ ...a, date: formatDay(a.date) })),
      notes: notes.map((n) => ({ ...n, date: formatDay(n.date) })),
    };
  }
}
