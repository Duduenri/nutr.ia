import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsDateString, IsIn, IsString } from 'class-validator';
import { MealEntry, User } from '@prisma/client';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { addDays, formatDay, parseDay } from '../common/date';
import { MISSION_GEMS } from '../game/catalog';
import { GameService } from '../game/game.service';
import { PrismaService } from '../prisma/prisma.service';

class ClaimDto {
  @IsDateString()
  date!: string;

  @IsIn(['daily', 'weekly', 'month'])
  scope!: 'daily' | 'weekly' | 'month';

  @IsString()
  key!: string;
}

const CLAIM_WINDOW_MS = 2 * 86_400_000;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly game: GameService,
  ) {}

  @Get(':date')
  async get(@UserId() userId: string, @Param('date') day: string) {
    const data = await this.compute(userId, day);
    const refs = this.refKeys(day);
    const claimed = new Set(
      (
        await this.prisma.gemTx.findMany({
          where: { userId, refKey: { startsWith: 'mission:' } },
          select: { refKey: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
      ).map((t) => t.refKey),
    );
    const mark = (scope: 'daily' | 'weekly', m: Mission) => ({
      ...m,
      gems: MISSION_GEMS[scope],
      claimed: claimed.has(refs[scope](m.key)),
    });
    return {
      ...data,
      month: {
        ...data.month,
        gems: MISSION_GEMS.month,
        claimed: claimed.has(refs.month()),
      },
      daily: data.daily.map((m) => mark('daily', m)),
      weekly: data.weekly.map((m) => mark('weekly', m)),
    };
  }

  @Post('claim')
  @HttpCode(200)
  async claim(@UserId() userId: string, @Body() dto: ClaimDto) {
    const day = dto.date.slice(0, 10);
    if (Math.abs(parseDay(day).getTime() - Date.now()) > CLAIM_WINDOW_MS) {
      throw new BadRequestException('Essa missão já expirou');
    }
    const data = await this.compute(userId, day);
    const refs = this.refKeys(day);
    let done: boolean;
    let refKey: string;
    let title: string;
    if (dto.scope === 'month') {
      done = data.month.progress >= data.month.goal;
      refKey = refs.month();
      title = data.month.title;
    } else {
      const mission = data[dto.scope].find((m) => m.key === dto.key);
      if (!mission) throw new NotFoundException('Missão não encontrada');
      done = mission.progress >= mission.goal;
      refKey = refs[dto.scope](dto.key);
      title = mission.title;
    }
    if (!done) throw new BadRequestException('Missão ainda não concluída');
    await this.game.award(
      userId,
      refKey,
      MISSION_GEMS[dto.scope],
      `Missão: ${title}`,
    );
    return this.game.state(userId);
  }

  private refKeys(day: string) {
    const weekStart = formatDay(mondayOf(parseDay(day)));
    return {
      daily: (key: string) => `mission:d:${day}:${key}`,
      weekly: (key: string) => `mission:w:${weekStart}:${key}`,
      month: () => `mission:m:${day.slice(0, 7)}`,
    };
  }

  private async compute(userId: string, day: string) {
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
