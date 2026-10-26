import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MealType, Supplement, User } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { UserContextService } from '../coach/user-context.service';
import { addDays, parseDay } from '../common/date';
import { ChallengesService } from '../friends/challenges.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

const TICK_MS = 60_000;
const LATE_WINDOW_MIN = 15;
const DEFAULT_TZ = 'America/Sao_Paulo';
const WATER_KEY = 'water';
const HOUR_MS = 3_600_000;

const MEAL_CHECKS: { meal: MealType; at: number; label: string }[] = [
  { meal: 'BREAKFAST', at: 10 * 60 + 30, label: 'o café da manhã' },
  { meal: 'LUNCH', at: 14 * 60 + 30, label: 'o almoço' },
  { meal: 'DINNER', at: 21 * 60 + 30, label: 'o jantar' },
];
const PROTEIN_CHECK = 17 * 60;
const WEEKLY_AT = 19 * 60;
const WEEKLY_UNTIL = 22 * 60;

function localNow(timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    sunday: parts.weekday === 'Sun',
  };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function due(minutes: number, at: number): boolean {
  const late = minutes - at;
  return late >= 0 && late <= LATE_WINDOW_MIN;
}

type ReminderUser = User & { supplements: Supplement[] };

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly challenges: ChallengesService,
    private readonly ai: AiService,
    private readonly userContext: UserContextService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.challenges.expire();
      const users = await this.prisma.user.findMany({
        include: { supplements: { where: { times: { isEmpty: false } } } },
      });
      const subscribed = new Set(
        (
          await this.prisma.pushSubscription.findMany({
            select: { userId: true },
            distinct: ['userId'],
          })
        ).map((s) => s.userId),
      );
      for (const user of users) {
        try {
          await this.forUser(user, subscribed.has(user.id));
        } catch (error) {
          this.logger.error(`Lembretes de ${user.id}: ${String(error)}`);
        }
      }
    } catch (error) {
      this.logger.error(`Lembretes falharam: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async forUser(user: ReminderUser, subscribed: boolean) {
    const now = localNow(user.timezone ?? DEFAULT_TZ);
    const date = parseDay(now.day);
    if (now.sunday && now.minutes >= WEEKLY_AT && now.minutes < WEEKLY_UNTIL) {
      await this.weekly(user, now.day, date, subscribed);
    }
    if (!subscribed) return;
    if (user.waterReminder) await this.water(user, date, now.minutes);
    await this.supplements(user, date, now.minutes);
    await this.fast(user, date);
    if (user.mealReminders) {
      await this.meals(user, date, now.minutes);
      await this.protein(user, date, now.minutes);
    }
  }

  private async once(
    userId: string,
    key: string,
    date: Date,
    time: string,
  ): Promise<boolean> {
    const id = { userId, supplementId: key, date, time };
    const already = await this.prisma.reminderLog.findUnique({
      where: { userId_supplementId_date_time: id },
    });
    if (already) return false;
    await this.prisma.reminderLog.create({ data: id });
    return true;
  }

  private async supplements(user: ReminderUser, date: Date, minutes: number) {
    for (const s of user.supplements) {
      const times = [...s.times].sort();
      for (let i = 0; i < times.length; i++) {
        if (!due(minutes, toMinutes(times[i]))) continue;
        const taken = await this.prisma.supplementLog.count({
          where: { userId: user.id, supplementId: s.id, date },
        });
        if (taken > i) continue;
        if (!(await this.once(user.id, s.id, date, times[i]))) continue;
        await this.push.send(user.id, {
          title: `${s.emoji} Hora do ${s.name}`,
          body: s.dose
            ? `${s.dose} · toque pra marcar que tomou`
            : 'Toque pra marcar que tomou',
          url: '/',
          tag: `supp-${s.id}-${times[i]}`,
        });
      }
    }
  }

  private async water(user: User, date: Date, minutes: number) {
    const start = toMinutes(user.waterReminderStart);
    const end = toMinutes(user.waterReminderEnd);
    if (minutes < start || minutes > end) return;
    const slot =
      start +
      Math.floor((minutes - start) / user.waterReminderEvery) *
        user.waterReminderEvery;
    if (slot === start || minutes - slot > LATE_WINDOW_MIN) return;
    if (!(await this.once(user.id, WATER_KEY, date, clock(slot)))) return;

    const target = user.waterTargetMl ?? 2000;
    const drunk = await this.prisma.waterLog.aggregate({
      where: { userId: user.id, date },
      _sum: { ml: true },
    });
    const ml = drunk._sum.ml ?? 0;
    const expected =
      target * Math.min(1, (slot - start) / Math.max(1, end - start));
    if (ml >= target || ml >= expected) return;
    const liters = (v: number) =>
      (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    await this.push.send(user.id, {
      title: '💧 Bora beber água!',
      body: `Você está em ${liters(ml)} L de ${liters(target)} L hoje. Um copo agora já ajuda!`,
      url: '/',
      tag: 'water',
    });
  }

  private async fast(user: User, date: Date) {
    const fast = await this.prisma.fast.findFirst({
      where: { userId: user.id, endAt: null },
      orderBy: { startAt: 'desc' },
    });
    if (!fast) return;
    const goalAt = fast.startAt.getTime() + fast.goalHours * HOUR_MS;
    const since = Date.now() - goalAt;
    if (since < 0 || since > 2 * HOUR_MS) return;
    if (!(await this.once(user.id, 'fast', date, fast.id))) return;
    await this.push.send(user.id, {
      title: '⏱️ Jejum concluído! 🎉',
      body: `Você bateu as ${fast.goalHours}h de jejum. Quando for comer, comece pela proteína.`,
      url: '/jejum',
      tag: 'fast',
    });
  }

  private async meals(user: User, date: Date, minutes: number) {
    const check = MEAL_CHECKS.find((c) => due(minutes, c.at));
    if (!check) return;
    const [hasMeal, recent, fasting] = await Promise.all([
      this.prisma.mealEntry.count({
        where: { userId: user.id, date, meal: check.meal },
      }),
      this.prisma.mealEntry.count({
        where: { userId: user.id, date: { gte: addDays(date, -3) } },
      }),
      this.prisma.fast.count({ where: { userId: user.id, endAt: null } }),
    ]);
    if (hasMeal || !recent || fasting) return;
    if (
      !(await this.once(user.id, `meal:${check.meal}`, date, clock(check.at)))
    )
      return;
    await this.push.send(user.id, {
      title: '🍽️ Já comeu?',
      body: `Você ainda não registrou ${check.label}. Leva 10 segundos com foto 📸`,
      url: `/adicionar?meal=${check.meal}`,
      tag: `meal-${check.meal}`,
    });
  }

  private async protein(user: User, date: Date, minutes: number) {
    if (!due(minutes, PROTEIN_CHECK)) return;
    if (!user.proteinTarget || !(user.bariatric || user.goal === 'GAIN'))
      return;
    const sum = await this.prisma.mealEntry.aggregate({
      where: { userId: user.id, date },
      _sum: { protein: true },
      _count: { _all: true },
    });
    if (!sum._count._all) return;
    const eaten = sum._sum.protein ?? 0;
    if (eaten >= user.proteinTarget * 0.6) return;
    if (!(await this.once(user.id, 'protein', date, clock(PROTEIN_CHECK))))
      return;
    const missing = Math.round(user.proteinTarget - eaten);
    await this.push.send(user.id, {
      title: `💪 Faltam ${missing} g de proteína hoje`,
      body: user.bariatric
        ? 'Um shake proteico, ovo ou iogurte grego no lanche já ajuda muito.'
        : 'Capricha na proteína no lanche e no jantar pra ajudar os músculos.',
      url: '/',
      tag: 'protein',
    });
  }

  private async weekly(
    user: User,
    day: string,
    date: Date,
    subscribed: boolean,
  ) {
    const active = await this.prisma.mealEntry.count({
      where: { userId: user.id, date: { gte: addDays(date, -6), lte: date } },
    });
    if (!active) return;
    if (!(await this.once(user.id, 'weekly', date, 'summary'))) return;
    const summary = await this.ai.weeklySummary(
      await this.userContext.build(user.id, day),
    );
    await this.prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: 'ASSISTANT',
        content: `📊 **Resumo da semana**\n\n${summary.message}`,
      },
    });
    if (subscribed) {
      await this.push.send(user.id, {
        title: '📊 Seu resumo da semana chegou',
        body: summary.headline,
        url: '/coach',
        tag: 'weekly',
      });
    }
  }
}
