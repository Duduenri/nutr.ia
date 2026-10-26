import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { parseDay } from '../common/date';
import { ChallengesService } from '../friends/challenges.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

const TICK_MS = 60_000;
const LATE_WINDOW_MIN = 15;
const DEFAULT_TZ = 'America/Sao_Paulo';
const WATER_KEY = 'water';

function localNow(timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly challenges: ChallengesService,
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
        where: {
          pushSubscriptions: { some: {} },
          OR: [
            { waterReminder: true },
            { supplements: { some: { times: { isEmpty: false } } } },
          ],
        },
        include: { supplements: { where: { times: { isEmpty: false } } } },
      });
      for (const user of users) {
        const { day, minutes } = localNow(user.timezone ?? DEFAULT_TZ);
        const date = parseDay(day);
        if (user.waterReminder) {
          await this.water(user, date, minutes);
        }
        for (const s of user.supplements) {
          const times = [...s.times].sort();
          for (let i = 0; i < times.length; i++) {
            const late = minutes - toMinutes(times[i]);
            if (late < 0 || late > LATE_WINDOW_MIN) continue;
            const [taken, sent] = await Promise.all([
              this.prisma.supplementLog.count({
                where: { userId: user.id, supplementId: s.id, date },
              }),
              this.prisma.reminderLog.findUnique({
                where: {
                  userId_supplementId_date_time: {
                    userId: user.id,
                    supplementId: s.id,
                    date,
                    time: times[i],
                  },
                },
              }),
            ]);
            if (sent || taken > i) continue;
            await this.prisma.reminderLog.create({
              data: {
                userId: user.id,
                supplementId: s.id,
                date,
                time: times[i],
              },
            });
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
    } catch (error) {
      this.logger.error(`Lembretes falharam: ${String(error)}`);
    } finally {
      this.running = false;
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
    const time = `${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`;
    const key = {
      userId: user.id,
      supplementId: WATER_KEY,
      date,
      time,
    };
    const already = await this.prisma.reminderLog.findUnique({
      where: { userId_supplementId_date_time: key },
    });
    if (already) return;
    await this.prisma.reminderLog.create({ data: key });

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
}
