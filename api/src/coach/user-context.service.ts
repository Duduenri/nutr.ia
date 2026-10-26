import { Injectable } from '@nestjs/common';
import { addDays, formatDay, parseDay } from '../common/date';
import { sumEntries } from '../diary/diary.service';
import { PrismaService } from '../prisma/prisma.service';
import { ageFrom } from '../profile/nutrition';

interface Exercise {
  name: string;
  sets: { reps: number; kg: number }[];
}

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
    const [
      user,
      todayEntries,
      weekEntries,
      water,
      weights,
      fast,
      labs,
      documents,
      activities,
    ] = await Promise.all([
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
      this.prisma.labResult.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 300,
      }),
      this.prisma.userDocument.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.prisma.activity.findMany({
        where: { userId, date: { gte: addDays(today, -30), lte: today } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
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
      user.bariatric &&
        `Fez cirurgia bariátrica${user.surgeryDate ? ` em ${formatDay(user.surgeryDate)}` : ''} — priorize proteína, porções pequenas e a orientação da equipe dela`,
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

    const latestByCode = new Map<string, (typeof labs)[number]>();
    for (const l of labs) {
      if (!latestByCode.has(l.code)) latestByCode.set(l.code, l);
    }
    const statusLabel: Record<string, string> = {
      LOW: 'abaixo',
      HIGH: 'acima',
      NORMAL: 'normal',
      UNKNOWN: 'sem faixa',
    };
    const exams = [...latestByCode.values()]
      .map(
        (l) =>
          `${l.name}: ${l.value} ${l.unit} (${statusLabel[l.status] ?? l.status}${l.refText ? `; ref ${l.refText}` : ''}) em ${formatDay(l.date)}`,
      )
      .join('\n');
    const material = documents
      .map((d) => `### ${d.title}\n${d.content}`)
      .join('\n\n')
      .slice(0, 60_000);

    const training = activities
      .map((a) => {
        const exercises = (a.exercises as Exercise[] | null) ?? [];
        return [
          `${formatDay(a.date)}: ${a.name}, ${a.minutes} min, ${a.kcal} kcal`,
          a.distanceKm &&
            `${a.distanceKm} km (${Math.round((a.minutes / a.distanceKm) * 10) / 10} min/km)`,
          exercises.length &&
            exercises
              .map(
                (e) =>
                  `${e.name} ${e.sets.map((s) => `${s.reps}x${s.kg}kg`).join(' ')}`,
              )
              .join('; '),
          a.details && `obs: ${a.details.slice(0, 300).replace(/\n+/g, ' ')}`,
        ]
          .filter(Boolean)
          .join(' | ');
      })
      .join('\n');

    return {
      profile,
      today: todayText,
      history,
      exams: exams || undefined,
      material: material || undefined,
      training: training || undefined,
    };
  }
}
