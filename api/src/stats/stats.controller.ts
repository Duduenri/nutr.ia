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
import { FoodQuality } from '@prisma/client';
import { junkStats } from '../diary/food-quality';
import { FreeMealService } from '../free-meal/free-meal.service';
import { normalize } from '../common/text';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly freeMeal: FreeMealService,
  ) {}

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

    const [user, rawEntries, water, free] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.mealEntry.findMany({ where: { userId, date: range } }),
      this.prisma.waterLog.findMany({ where: { userId, date: range } }),
      this.freeMeal.checker(userId),
    ]);
    const target = user.kcalTarget ?? 2000;
    const entries = rawEntries.map((e) => ({
      ...e,
      free: free.isFreeMeal(e.date, e.meal),
    }));

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

    const qualityByDay = new Map<
      string,
      Record<FoodQuality | 'FREE', number>
    >();
    for (const e of entries) {
      if (!e.quality && !e.free) continue;
      const key = formatDay(e.date);
      const d = qualityByDay.get(key) ?? { GOOD: 0, OK: 0, BAD: 0, FREE: 0 };
      d[e.free ? 'FREE' : e.quality!] += e.kcal;
      qualityByDay.set(key, d);
    }

    const series: {
      date: string;
      kcal: number | null;
      protein: number | null;
      waterMl: number;
      good: number;
      ok: number;
      bad: number;
      free: number;
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
        good: Math.round(qualityByDay.get(key)?.GOOD ?? 0),
        ok: Math.round(qualityByDay.get(key)?.OK ?? 0),
        bad: Math.round(qualityByDay.get(key)?.BAD ?? 0),
        free: Math.round(qualityByDay.get(key)?.FREE ?? 0),
      });
      if (d) {
        if (!free.isFreeDay(key)) ratings[rate(d.kcal, target)]++;
        p += d.protein * 4;
        c += d.carbs * 4;
        f += d.fat * 9;
      }
    }
    const junk = junkStats(entries);
    const macroKcal = p + c + f;
    const logged = byDay.size;
    const rated = Object.values(ratings).reduce((t, v) => t + v, 0);
    return {
      target,
      series,
      ratings: Object.fromEntries(
        Object.entries(ratings).map(([k, v]) => [
          k,
          rated ? Math.round((v / rated) * 100) : 0,
        ]),
      ),
      macros: macroKcal
        ? {
            protein: Math.round((p / macroKcal) * 100),
            carbs: Math.round((c / macroKcal) * 100),
            fat: Math.round((f / macroKcal) * 100),
          }
        : null,
      quality: junk.totalKcal
        ? {
            goodPct: junk.goodPct,
            badPct: junk.badPct,
            okPct: Math.max(0, 100 - junk.goodPct - junk.badPct - junk.freePct),
            freePct: junk.freePct,
            freeCount: junk.freeCount,
            badCount: junk.badCount,
            tags: junk.tags.map(([tag, count]) => ({ tag, count })),
            top: junk.top.map((t) => ({
              name: t.name,
              kcal: Math.round(t.kcal),
              count: t.count,
            })),
          }
        : null,
      averageKcal: logged
        ? Math.round(
            [...byDay.values()].reduce((s, d) => s + d.kcal, 0) / logged,
          )
        : null,
    };
  }

  @Get('micros')
  async micros(
    @UserId() userId: string,
    @Query('days') daysRaw: string,
    @Query('end') endRaw: string,
  ) {
    const days = parseInt(daysRaw, 10);
    if (![1, 7, 30].includes(days)) {
      throw new BadRequestException('days deve ser 1, 7 ou 30');
    }
    const end = parseDay(endRaw);
    const entries = await this.prisma.mealEntry.findMany({
      where: { userId, date: { gte: addDays(end, -(days - 1)), lte: end } },
      select: { date: true, name: true, micros: true },
    });
    const loggedDays = new Set(entries.map((e) => formatDay(e.date))).size;
    type Source = { name: string; amount: number; count: number };
    const acc = new Map<
      string,
      { total: number; withData: number; sources: Map<string, Source> }
    >();
    for (const e of entries) {
      const micros = (e.micros ?? {}) as Record<string, unknown>;
      for (const [key, raw] of Object.entries(micros)) {
        if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
        const n = acc.get(key) ?? {
          total: 0,
          withData: 0,
          sources: new Map<string, Source>(),
        };
        n.total += raw;
        n.withData++;
        if (raw > 0) {
          const k = normalize(e.name);
          const src = n.sources.get(k) ?? { name: e.name, amount: 0, count: 0 };
          n.sources.set(k, {
            ...src,
            amount: src.amount + raw,
            count: src.count + 1,
          });
        }
        acc.set(key, n);
      }
    }
    return {
      days,
      loggedDays,
      entries: entries.length,
      nutrients: Object.fromEntries(
        [...acc].map(([key, n]) => [
          key,
          {
            avg: loggedDays ? n.total / loggedDays : 0,
            coverage: entries.length ? n.withData / entries.length : 0,
            top: [...n.sources.values()]
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 5)
              .map((t) => ({ ...t, amount: t.amount / loggedDays })),
          },
        ]),
      ),
    };
  }
}
