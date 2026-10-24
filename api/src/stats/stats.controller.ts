import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { addDays, formatDay, parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

type Rating = 'great' | 'good' | 'ok' | 'bad';

function rate(kcal: number, target: number): Rating {
  const diff = Math.abs(kcal - target) / target;
  if (diff <= 0.1) return 'great';
  if (diff <= 0.2) return 'good';
  if (diff <= 0.35) return 'ok';
  return 'bad';
}

@Controller('stats')
@UseGuards(AuthGuard)
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('weight')
  async weight(@UserId() userId: string) {
    const [user, logs] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.weightLog.findMany({
        where: { userId },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    return {
      startKg: user.startWeightKg ?? logs[0]?.kg ?? null,
      currentKg: logs.at(-1)?.kg ?? user.startWeightKg,
      targetKg: user.targetWeightKg,
      logs: logs.map((l) => ({ id: l.id, date: formatDay(l.date), kg: l.kg })),
    };
  }

  @Get('nutrition')
  async nutrition(
    @UserId() userId: string,
    @Query('days') daysRaw: string,
    @Query('end') endRaw: string,
  ) {
    const days = parseInt(daysRaw, 10);
    if (![7, 30, 90].includes(days)) {
      throw new BadRequestException('days deve ser 7, 30 ou 90');
    }
    const end = parseDay(endRaw);
    const start = addDays(end, -(days - 1));
    const range = { gte: start, lte: end };

    const [user, entries, water] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.mealEntry.findMany({ where: { userId, date: range } }),
      this.prisma.waterLog.findMany({ where: { userId, date: range } }),
    ]);
    const target = user.kcalTarget ?? 2000;

    const byDay = new Map<
      string,
      { kcal: number; protein: number; carbs: number; fat: number }
    >();
    for (const e of entries) {
      const key = formatDay(e.date);
      const d = byDay.get(key) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      d.kcal += e.kcal;
      d.protein += e.protein;
      d.carbs += e.carbs;
      d.fat += e.fat;
      byDay.set(key, d);
    }
    const waterByDay = new Map<string, number>();
    for (const w of water) {
      const key = formatDay(w.date);
      waterByDay.set(key, (waterByDay.get(key) ?? 0) + w.ml);
    }

    const series: {
      date: string;
      kcal: number | null;
      protein: number | null;
      waterMl: number;
    }[] = [];
    const ratings: Record<Rating, number> = {
      great: 0,
      good: 0,
      ok: 0,
      bad: 0,
    };
    let p = 0;
    let c = 0;
    let f = 0;
    for (let i = 0; i < days; i++) {
      const key = formatDay(addDays(start, i));
      const d = byDay.get(key);
      series.push({
        date: key,
        kcal: d ? Math.round(d.kcal) : null,
        protein: d ? Math.round(d.protein) : null,
        waterMl: waterByDay.get(key) ?? 0,
      });
      if (d) {
        ratings[rate(d.kcal, target)]++;
        p += d.protein * 4;
        c += d.carbs * 4;
        f += d.fat * 9;
      }
    }
    const macroKcal = p + c + f;
    const logged = byDay.size;
    return {
      target,
      series,
      ratings: Object.fromEntries(
        Object.entries(ratings).map(([k, v]) => [
          k,
          logged ? Math.round((v / logged) * 100) : 0,
        ]),
      ),
      macros: macroKcal
        ? {
            protein: Math.round((p / macroKcal) * 100),
            carbs: Math.round((c / macroKcal) * 100),
            fat: Math.round((f / macroKcal) * 100),
          }
        : null,
      averageKcal: logged
        ? Math.round(
            [...byDay.values()].reduce((s, d) => s + d.kcal, 0) / logged,
          )
        : null,
    };
  }
}
