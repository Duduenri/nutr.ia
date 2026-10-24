import { Injectable } from '@nestjs/common';
import { addDays, formatDay, parseDay } from '../common/date';
import { sumEntries } from '../diary/diary.service';
import { PrismaService } from '../prisma/prisma.service';
import { ageFrom } from '../profile/nutrition';

const GOAL_LABEL = {
  LOSE: 'perder peso',
  MAINTAIN: 'manter peso',
  GAIN: 'ganhar massa',
};

@Injectable()
export class UserContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string, todayRaw: string) {
    const today = parseDay(todayRaw.slice(0, 10));
    const weekAgo = addDays(today, -7);
    const [user, todayEntries, weekEntries, water, weights, fast] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        this.prisma.mealEntry.findMany({ where: { userId, date: today } }),
        this.prisma.mealEntry.findMany({
          where: { userId, date: { gte: weekAgo, lt: today } },
        }),
        this.prisma.waterLog.findMany({ where: { userId, date: today } }),
        this.prisma.weightLog.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          take: 5,
        }),
        this.prisma.fast.findFirst({ where: { userId, endAt: null } }),
      ]);

    const profile = [
      `Nome: ${user.name}`,
      user.sex && `Sexo: ${user.sex === 'FEMALE' ? 'feminino' : 'masculino'}`,
      user.birthDate && `Idade: ${ageFrom(user.birthDate)} anos`,
      user.heightCm && `Altura: ${user.heightCm} cm`,
      user.goal && `Objetivo: ${GOAL_LABEL[user.goal]}`,
      user.targetWeightKg &&
        `Peso desejado: ${user.targetWeightKg} kg${user.targetDate ? ` até ${formatDay(user.targetDate)}` : ''}`,
      user.fastingPlan && `Plano de jejum intermitente: ${user.fastingPlan}`,
      weights.length &&
        `Pesagens recentes: ${weights.map((w) => `${formatDay(w.date)} ${w.kg} kg`).join(', ')}`,
      `Metas diárias: ${user.kcalTarget} kcal, ${user.proteinTarget} g proteína, ${user.carbsTarget} g carboidrato, ${user.fatTarget} g gordura, ${user.waterTargetMl} ml água`,
    ]
      .filter(Boolean)
      .join('\n');

    const t = sumEntries(todayEntries);
    const waterMl = water.reduce((s, w) => s + w.ml, 0);
    const todayText = [
      `Data: ${formatDay(today)}`,
      `Consumido: ${Math.round(t.kcal)} kcal, ${Math.round(t.protein)} g proteína, ${Math.round(t.carbs)} g carbo, ${Math.round(t.fat)} g gordura, ${Math.round(t.fiber)} g fibra`,
      `Água: ${waterMl} ml`,
      fast &&
        `Em jejum há ${Math.round((Date.now() - fast.startAt.getTime()) / 360_000) / 10} h (meta ${fast.goalHours} h)`,
      todayEntries.length
        ? `Alimentos: ${todayEntries.map((e) => `${e.name} (${Math.round(e.grams)} g, ${Math.round(e.kcal)} kcal)`).join('; ')}`
        : 'Nada registrado ainda hoje.',
    ]
      .filter(Boolean)
      .join('\n');

    const perDay = new Map<string, number>();
    for (const e of weekEntries) {
      const k = formatDay(e.date);
      perDay.set(k, (perDay.get(k) ?? 0) + e.kcal);
    }
    const history = perDay.size
      ? [...perDay.entries()]
          .sort()
          .map(([d, kcal]) => `${d}: ${Math.round(kcal)} kcal`)
          .join('\n')
      : 'Sem registros nos últimos 7 dias.';

    return { profile, today: todayText, history };
  }
}
