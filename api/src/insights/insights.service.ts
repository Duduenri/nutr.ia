import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addDays, formatDay, parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;

interface Exercise {
  name: string;
  sets: { reps: number; kg: number }[];
}

export interface Insight {
  emoji: string;
  text: string;
  tone: 'good' | 'warn' | 'info';
}

function mondayOf(date: Date): Date {
  return addDays(date, -((date.getUTCDay() + 6) % 7));
}

function slope(points: { t: number; v: number }[]): number {
  const n = points.length;
  const mt = points.reduce((s, p) => s + p.t, 0) / n;
  const mv = points.reduce((s, p) => s + p.v, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - mt) * (p.v - mv);
    den += (p.t - mt) ** 2;
  }
  return den ? num / den : 0;
}

const avg = (list: number[]) =>
  list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;

const key = (name: string) => name.trim().toLowerCase();

const tons = (kg: number) =>
  kg >= 1000
    ? `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} toneladas`
    : `${Math.round(kg)} kg`;

const kgText = (kg: number) =>
  `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;

const dm = (d: Date) =>
  d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async forecast(userId: string, todayRaw: string) {
    const today = parseDay(todayRaw.slice(0, 10));
    const [user, weights] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.weightLog.findMany({
        where: { userId, date: { gte: addDays(today, -42), lte: today } },
        orderBy: { date: 'asc' },
      }),
    ]);
    const target = user.targetWeightKg;
    const points = weights.map((w) => ({
      t: w.date.getTime() / DAY_MS,
      v: w.kg,
    }));
    const span = points.length ? points[points.length - 1].t - points[0].t : 0;
    const current = points.length ? points[points.length - 1].v : null;
    const base = {
      currentKg: current,
      targetKg: target,
      targetDate: user.targetDate ? formatDay(user.targetDate) : null,
      weeklyKg: null as number | null,
      date: null as string | null,
      onTrack: null as boolean | null,
    };
    if (!target) return { ...base, status: 'no_target' as const };
    if (points.length < 2 || span < 7) {
      return { ...base, status: 'collecting' as const };
    }
    const perDay = slope(points);
    const weeklyKg = Math.round(perDay * 7 * 100) / 100;
    const togo = target - current!;
    if (Math.abs(togo) < 0.2) {
      return { ...base, weeklyKg, status: 'reached' as const };
    }
    if (Math.abs(perDay) < 0.005) {
      return { ...base, weeklyKg, status: 'stable' as const };
    }
    if (Math.sign(perDay) !== Math.sign(togo)) {
      return { ...base, weeklyKg, status: 'wrong_direction' as const };
    }
    const days = Math.ceil(togo / perDay);
    if (days > 3 * 365) {
      return { ...base, weeklyKg, status: 'too_far' as const };
    }
    const date = addDays(today, days);
    return {
      ...base,
      weeklyKg,
      date: formatDay(date),
      onTrack: user.targetDate ? date <= user.targetDate : null,
      status: 'projected' as const,
    };
  }

  async correlations(userId: string, todayRaw: string) {
    const today = parseDay(todayRaw.slice(0, 10));
    const from = addDays(today, -45);
    const [checkins, meals, activities] = await Promise.all([
      this.prisma.dailyCheckin.findMany({
        where: { userId, date: { gte: from, lte: today } },
      }),
      this.prisma.mealEntry.groupBy({
        by: ['date'],
        where: { userId, date: { gte: from, lt: today } },
        _sum: { kcal: true },
      }),
      this.prisma.activity.findMany({
        where: { userId, date: { gte: from, lte: today } },
        select: { date: true },
      }),
    ]);
    const kcalOn = new Map(
      meals.map((m) => [formatDay(m.date), m._sum.kcal ?? 0]),
    );
    const trained = new Set(activities.map((a) => formatDay(a.date)));
    const withKcal = checkins
      .map((c) => ({ ...c, kcal: kcalOn.get(formatDay(c.date)) }))
      .filter((c) => c.kcal && c.kcal > 600);

    const compare = (
      bad: (c: (typeof withKcal)[number]) => boolean,
      good: (c: (typeof withKcal)[number]) => boolean,
    ) => {
      const b = withKcal.filter(bad).map((c) => c.kcal!);
      const g = withKcal.filter(good).map((c) => c.kcal!);
      if (b.length < 2 || g.length < 2) return null;
      return Math.round(avg(b)! - avg(g)!);
    };
    const sleepKcal = compare(
      (c) => (c.sleep ?? 9) <= 2 || (c.sleepHours ?? 99) < 6,
      (c) => (c.sleep ?? 0) >= 4 || (c.sleepHours ?? 0) >= 7,
    );
    const hungerKcal = compare(
      (c) => (c.hunger ?? 0) >= 4,
      (c) => (c.hunger ?? 9) <= 2,
    );
    const energyTrained = checkins.filter((c) => c.energy !== null);
    const eTrain = avg(
      energyTrained
        .filter((c) => trained.has(formatDay(c.date)))
        .map((c) => c.energy!),
    );
    const eRest = avg(
      energyTrained
        .filter((c) => !trained.has(formatDay(c.date)))
        .map((c) => c.energy!),
    );
    const hours = checkins
      .filter((c) => c.sleepHours !== null)
      .map((c) => c.sleepHours!);
    return {
      checkins: checkins.length,
      sleepKcal,
      hungerKcal,
      energyTrain: eTrain,
      energyRest: eRest,
      avgSleepHours: avg(hours),
    };
  }

  async period(userId: string, kind: 'week' | 'month', todayRaw: string) {
    const today = parseDay(todayRaw.slice(0, 10));
    let start: Date;
    let end: Date;
    let prevStart: Date;
    let label: string;
    if (kind === 'week') {
      const monday = mondayOf(today);
      start = addDays(monday, -7);
      end = addDays(monday, -1);
      prevStart = addDays(start, -7);
      label = `Semana de ${dm(start)} a ${dm(end)}`;
    } else {
      const first = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
      );
      end = addDays(first, -1);
      start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      prevStart = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1),
      );
      label = start.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }
    const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
    const range = { gte: prevStart, lte: end };
    const [user, activities, meals, water, weights, measures, steps, history] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        this.prisma.activity.findMany({ where: { userId, date: range } }),
        this.prisma.mealEntry.groupBy({
          by: ['date'],
          where: { userId, date: range },
          _sum: { kcal: true, protein: true },
        }),
        this.prisma.waterLog.groupBy({
          by: ['date'],
          where: { userId, date: range },
          _sum: { ml: true },
        }),
        this.prisma.weightLog.findMany({
          where: { userId, date: { gte: addDays(start, -4), lte: end } },
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.bodyMeasure.findMany({
          where: { userId, date: { gte: addDays(start, -10), lte: end } },
          orderBy: { date: 'asc' },
        }),
        this.prisma.dailySteps.findMany({
          where: { userId, date: { gte: start, lte: end } },
        }),
        this.prisma.activity.findMany({
          where: {
            userId,
            date: { gte: addDays(start, -90), lt: start },
            exercises: { not: Prisma.DbNull },
          },
          select: { exercises: true },
        }),
      ]);

    const inPeriod = (d: Date) => d >= start && d <= end;
    const inPrev = (d: Date) => d >= prevStart && d < start;
    const cur = activities.filter((a) => inPeriod(a.date));
    const prev = activities.filter((a) => inPrev(a.date));
    const volume = (list: typeof activities) =>
      list.reduce(
        (t, a) =>
          t +
          ((a.exercises as Exercise[] | null) ?? []).reduce(
            (s, e) => s + e.sets.reduce((x, set) => x + set.reps * set.kg, 0),
            0,
          ),
        0,
      );
    const items: Insight[] = [];
    const periodWord = kind === 'week' ? 'nessa semana' : 'nesse mês';
    const prevWord = kind === 'week' ? 'na semana anterior' : 'no mês anterior';

    if (cur.length) {
      const minutes = cur.reduce((t, a) => t + a.minutes, 0);
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      items.push({
        emoji: '🏋️',
        text: `${cur.length} ${cur.length === 1 ? 'treino' : 'treinos'} e ${h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`} de atividade (${prev.length} ${prevWord})`,
        tone: cur.length >= prev.length ? 'good' : 'info',
      });
    }
    const vCur = volume(cur);
    const vPrev = volume(prev);
    if (vCur > 0) {
      const pct = vPrev ? Math.round(((vCur - vPrev) / vPrev) * 100) : null;
      items.push({
        emoji: '💪',
        text: `Você levantou ${tons(vCur)}${pct === null ? '' : pct >= 0 ? `, ${pct}% a mais que ${prevWord.replace('na ', 'a ').replace('no ', 'o ')}` : `, ${Math.abs(pct)}% a menos que ${prevWord.replace('na ', 'a ').replace('no ', 'o ')}`}`,
        tone: pct === null || pct >= 0 ? 'good' : 'info',
      });
    }

    const bestBefore = new Map<string, { name: string; kg: number }>();
    for (const a of [...history, ...activities.filter((x) => x.date < start)]) {
      for (const e of (a.exercises as Exercise[] | null) ?? []) {
        const kg = Math.max(0, ...e.sets.map((s) => s.kg));
        const k = key(e.name);
        if (kg > (bestBefore.get(k)?.kg ?? 0))
          bestBefore.set(k, { name: e.name, kg });
      }
    }
    const records: { name: string; from: number; to: number }[] = [];
    const bestNow = new Map<string, { name: string; kg: number }>();
    for (const a of cur) {
      for (const e of (a.exercises as Exercise[] | null) ?? []) {
        const kg = Math.max(0, ...e.sets.map((s) => s.kg));
        const k = key(e.name);
        if (kg > (bestNow.get(k)?.kg ?? 0))
          bestNow.set(k, { name: e.name, kg });
      }
    }
    for (const [k, now] of bestNow) {
      const before = bestBefore.get(k);
      if (before && now.kg > before.kg) {
        records.push({ name: now.name, from: before.kg, to: now.kg });
      }
    }
    records.sort((a, b) => (b.to - b.from) / b.from - (a.to - a.from) / a.from);
    if (records.length) {
      const top = records[0];
      items.push({
        emoji: '🏆',
        text: `${top.name} subiu de ${kgText(top.from)} → ${kgText(top.to)}${records.length > 1 ? ` (+${records.length - 1} ${records.length === 2 ? 'outro recorde' : 'outros recordes'})` : ''}`,
        tone: 'good',
      });
    }

    const loggedDays = meals.filter((m) => inPeriod(m.date));
    if (loggedDays.length) {
      if (user.proteinTarget) {
        const hit = loggedDays.filter(
          (m) => (m._sum.protein ?? 0) >= user.proteinTarget! * 0.95,
        ).length;
        items.push({
          emoji: '🥩',
          text: `Bateu a proteína em ${hit} de ${loggedDays.length} dias registrados`,
          tone: hit >= loggedDays.length * 0.6 ? 'good' : 'warn',
        });
      }
      if (user.kcalTarget) {
        const ok = loggedDays.filter(
          (m) =>
            Math.abs((m._sum.kcal ?? 0) - user.kcalTarget!) /
              user.kcalTarget! <=
            0.1,
        ).length;
        items.push({
          emoji: '🎯',
          text: `${ok} de ${loggedDays.length} dias dentro da meta de calorias (${loggedDays.length} de ${days} dias registrados)`,
          tone: ok >= loggedDays.length * 0.5 ? 'good' : 'info',
        });
      }
    } else {
      items.push({
        emoji: '📒',
        text: `Nenhuma refeição registrada ${periodWord}. Que tal voltar devagarinho, uma refeição por dia?`,
        tone: 'warn',
      });
    }
    const waterTarget = user.waterTargetMl ?? 2000;
    const waterDays = water.filter(
      (w) => inPeriod(w.date) && (w._sum.ml ?? 0) >= waterTarget,
    ).length;
    if (water.some((w) => inPeriod(w.date))) {
      items.push({
        emoji: '💧',
        text: `Meta de água batida em ${waterDays} de ${days} dias`,
        tone: waterDays >= days * 0.6 ? 'good' : 'info',
      });
    }
    if (steps.length) {
      const avgSteps = Math.round(
        steps.reduce((t, s) => t + s.steps, 0) / steps.length,
      );
      items.push({
        emoji: '👟',
        text: `Média de ${avgSteps.toLocaleString('pt-BR')} passos por dia registrado`,
        tone: avgSteps >= 8000 ? 'good' : 'info',
      });
    }

    const wStart = weights.filter((w) => w.date <= addDays(start, 2))[0];
    const wEnd = weights.filter((w) => inPeriod(w.date)).at(-1);
    const mStart = measures.find(
      (m) => m.waistCm !== null && m.date <= addDays(start, 3),
    );
    const mEnd = [...measures]
      .reverse()
      .find((m) => m.waistCm !== null && inPeriod(m.date));
    const dKg = wStart && wEnd && wEnd !== wStart ? wEnd.kg - wStart.kg : null;
    const dWaist =
      mStart && mEnd && mEnd !== mStart
        ? mEnd.waistCm! - mStart.waistCm!
        : null;
    if (dKg !== null || dWaist !== null) {
      const parts = [
        dKg !== null &&
          `Peso ${dKg < 0 ? 'caiu' : dKg > 0 ? 'subiu' : 'ficou em'} ${kgText(Math.abs(dKg))}`.replace(
            'ficou em 0 kg',
            'estável',
          ),
        dWaist !== null &&
          `cintura ${dWaist <= 0 ? '−' : '+'}${Math.abs(dWaist).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} cm`,
      ].filter(Boolean);
      const fatLoss =
        (dWaist !== null && dWaist < 0) || (dKg !== null && dKg < 0);
      const strengthKept = vCur > 0 && vCur >= vPrev * 0.95;
      items.push({
        emoji: '⚖️',
        text: `${parts.join(' e ')}${fatLoss && strengthKept ? ': perdendo gordura sem perder força 🔥' : ''}`,
        tone:
          user.goal === 'GAIN'
            ? (dKg ?? 0) >= 0
              ? 'good'
              : 'info'
            : fatLoss
              ? 'good'
              : 'info',
      });
    }

    const corr = await this.correlations(userId, formatDay(end));
    if (corr.sleepKcal !== null && corr.sleepKcal >= 150) {
      items.push({
        emoji: '😴',
        text: `Nos dias que você dormiu mal, comeu em média +${corr.sleepKcal} kcal`,
        tone: 'warn',
      });
    }
    if (
      corr.energyTrain !== null &&
      corr.energyRest !== null &&
      corr.energyTrain - corr.energyRest >= 0.5
    ) {
      items.push({
        emoji: '⚡',
        text: 'Nos dias que treinou, sua energia foi maior',
        tone: 'good',
      });
    }

    const fc = await this.forecast(userId, formatDay(today));
    if (fc.status === 'projected' && fc.date && fc.targetKg) {
      items.push({
        emoji: '📅',
        text: `No ritmo atual, você chega aos ${kgText(fc.targetKg)} por volta de ${dm(parseDay(fc.date))}`,
        tone: fc.onTrack === false ? 'warn' : 'good',
      });
    }

    return {
      kind,
      label,
      start: formatDay(start),
      end: formatDay(end),
      hasData: cur.length > 0 || loggedDays.length > 0,
      highlight: {
        workouts: cur.length,
        liftedKg: Math.round(vCur),
        records: records.length,
        loggedDays: loggedDays.length,
      },
      items,
    };
  }
}
