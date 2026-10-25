import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addDays, formatDay, parseDay } from '../common/date';
import { DEFAULT_COLOR, levelFor } from '../game/catalog';
import { PrismaService } from '../prisma/prisma.service';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const HOUR_MS = 3_600_000;
const MAX_CHEERS_PER_DAY = 3;

export const CHEER_EMOJIS = ['💪', '🔥', '👏', '💚', '🥳'];

function randomCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function mondayOf(date: Date): Date {
  return addDays(date, -((date.getUTCDay() + 6) % 7));
}

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.friendCode) return user.friendCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const updated = await this.prisma.user.update({
          where: { id: userId },
          data: { friendCode: randomCode() },
        });
        return updated.friendCode!;
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }
      }
    }
    throw new ConflictException('Não consegui gerar um código, tente de novo');
  }

  async friendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });
    return rows.map((r) =>
      r.requesterId === userId ? r.addresseeId : r.requesterId,
    );
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    const row = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
    return Boolean(row);
  }

  async weekStats(userId: string, day: string) {
    const today = parseDay(day);
    const weekStart = mondayOf(today);
    const range = { gte: weekStart, lte: today };
    const [
      user,
      mealDays,
      recentDays,
      water,
      claims,
      fasts,
      latest,
      earned,
      items,
      achievements,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.mealEntry.findMany({
        where: { userId, date: range },
        distinct: ['date'],
        select: { date: true },
      }),
      this.prisma.mealEntry.findMany({
        where: { userId, date: { gte: addDays(today, -90), lte: today } },
        distinct: ['date'],
        select: { date: true },
      }),
      this.prisma.waterLog.groupBy({
        by: ['date'],
        where: { userId, date: range },
        _sum: { ml: true },
      }),
      this.prisma.gemTx.count({
        where: {
          userId,
          refKey: { startsWith: 'mission:' },
          createdAt: { gte: weekStart },
        },
      }),
      this.prisma.fast.findMany({
        where: { userId, endAt: { not: null }, startAt: { gte: weekStart } },
        select: { startAt: true, endAt: true, goalHours: true },
      }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.gemTx.aggregate({
        where: { userId, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      this.prisma.userItem.findMany({ where: { userId, equipped: true } }),
      this.prisma.userAchievement.count({ where: { userId } }),
    ]);

    const logged = new Set(recentDays.map((d) => formatDay(d.date)));
    let cursor = logged.has(day) ? today : addDays(today, -1);
    let streak = 0;
    while (logged.has(formatDay(cursor))) {
      streak++;
      cursor = addDays(cursor, -1);
    }

    const waterDays = user.waterTargetMl
      ? water.filter((w) => (w._sum.ml ?? 0) >= user.waterTargetMl!).length
      : 0;
    const fastsDone = fasts.filter(
      (f) => f.endAt!.getTime() - f.startAt.getTime() >= f.goalHours * HOUR_MS,
    ).length;
    const daysLogged = mealDays.length;
    const equipped = items.map((i) => i.itemId);
    if (!equipped.some((id) => id.startsWith('color_'))) {
      equipped.push(DEFAULT_COLOR);
    }
    const start = user.startWeightKg;
    const current = latest?.kg;

    return {
      userId,
      name: user.name,
      petName: user.petName,
      petLevel: levelFor(earned._sum.amount ?? 0).level,
      petEquipped: equipped,
      achievements,
      streak,
      daysLogged,
      waterDays,
      missions: claims,
      fasts: fastsDone,
      points: daysLogged * 10 + waterDays * 5 + claims * 5 + fastsDone * 10,
      weightLostPct:
        user.shareWeight && user.goal === 'LOSE' && start && current
          ? Math.round(((start - current) / start) * 1000) / 10
          : null,
    };
  }

  async overview(userId: string, day: string) {
    const [code, me, friendIds, incoming, outgoing, cheers] = await Promise.all(
      [
        this.ensureCode(userId),
        this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        this.friendIds(userId),
        this.prisma.friendship.findMany({
          where: { addresseeId: userId, status: 'PENDING' },
          include: { requester: { select: { name: true, petName: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.friendship.findMany({
          where: { requesterId: userId, status: 'PENDING' },
          include: { addressee: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.cheer.findMany({
          where: { toId: userId, seen: false },
          include: { from: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ],
    );
    const stats = await Promise.all(
      [userId, ...friendIds].map((id) => this.weekStats(id, day)),
    );
    const ranking = stats
      .sort((a, b) => b.points - a.points || b.streak - a.streak)
      .map((s, i) => ({ ...s, position: i + 1, isMe: s.userId === userId }));
    return {
      code,
      shareWeight: me.shareWeight,
      ranking,
      incoming: incoming.map((f) => ({
        id: f.id,
        name: f.requester.name,
        petName: f.requester.petName,
      })),
      outgoing: outgoing.map((f) => ({ id: f.id, name: f.addressee.name })),
      cheers: cheers.map((c) => ({
        id: c.id,
        fromName: c.from.name,
        emoji: c.emoji,
        createdAt: c.createdAt,
      })),
    };
  }

  async request(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    const target = await this.prisma.user.findUnique({
      where: { friendCode: code },
    });
    if (!target) throw new NotFoundException('Código não encontrado');
    if (target.id === userId) {
      throw new BadRequestException('Esse é o seu próprio código 😄');
    }
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: target.id },
          { requesterId: target.id, addresseeId: userId },
        ],
      },
    });
    if (existing?.status === 'ACCEPTED') {
      throw new ConflictException(`Você e ${target.name} já são amigas`);
    }
    if (existing && existing.requesterId === target.id) {
      await this.prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED' },
      });
      return { status: 'accepted', name: target.name };
    }
    if (existing) {
      throw new ConflictException('Pedido já enviado, falta aceitar');
    }
    await this.prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id },
    });
    return { status: 'requested', name: target.name };
  }

  async accept(userId: string, id: string) {
    const row = await this.prisma.friendship.findFirst({
      where: { id, addresseeId: userId, status: 'PENDING' },
    });
    if (!row) throw new NotFoundException();
    await this.prisma.friendship.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });
  }

  async remove(userId: string, otherOrFriendshipId: string) {
    const deleted = await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          {
            id: otherOrFriendshipId,
            OR: [{ requesterId: userId }, { addresseeId: userId }],
          },
          { requesterId: userId, addresseeId: otherOrFriendshipId },
          { requesterId: otherOrFriendshipId, addresseeId: userId },
        ],
      },
    });
    if (!deleted.count) throw new NotFoundException();
  }

  async cheer(userId: string, toId: string, emoji: string) {
    if (!(await this.areFriends(userId, toId))) {
      throw new BadRequestException('Vocês ainda não são amigas');
    }
    const sentToday = await this.prisma.cheer.count({
      where: {
        fromId: userId,
        toId,
        createdAt: { gte: new Date(Date.now() - 24 * HOUR_MS) },
      },
    });
    if (sentToday >= MAX_CHEERS_PER_DAY) {
      throw new BadRequestException('Já mandou bastante força hoje 💚');
    }
    await this.prisma.cheer.create({ data: { fromId: userId, toId, emoji } });
  }
}
