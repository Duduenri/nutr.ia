import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { formatDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import {
  Achievement,
  ACHIEVEMENTS,
  AchievementStats,
  DEFAULT_COLOR,
  ITEMS,
  levelFor,
  ShopItem,
} from './catalog';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function seededIndex(seed: string, size: number): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return size ? h % size : 0;
}

function publicAchievement(a: Achievement) {
  return {
    key: a.key,
    title: a.title,
    description: a.description,
    emoji: a.emoji,
    gems: a.gems,
  };
}

function bestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = new Date(`${d}T00:00:00Z`).getTime();
    run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  async gems(userId: string) {
    const [all, earned] = await Promise.all([
      this.prisma.gemTx.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      this.prisma.gemTx.aggregate({
        where: { userId, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
    ]);
    return { balance: all._sum.amount ?? 0, lifetime: earned._sum.amount ?? 0 };
  }

  async award(userId: string, refKey: string, amount: number, reason: string) {
    const existing = await this.prisma.gemTx.findUnique({
      where: { userId_refKey: { userId, refKey } },
    });
    if (existing) {
      throw new ConflictException('Recompensa já resgatada');
    }
    await this.prisma.gemTx.create({
      data: { userId, refKey, amount, reason },
    });
  }

  async stats(userId: string): Promise<AchievementStats> {
    const [
      user,
      mealDays,
      photoMeals,
      waterDays,
      fasts,
      weightCount,
      latest,
      customRecipes,
      activities,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.mealEntry.groupBy({
        by: ['date'],
        where: { userId },
        _sum: { kcal: true, protein: true },
        _count: { _all: true },
      }),
      this.prisma.mealEntry.count({ where: { userId, source: 'PHOTO' } }),
      this.prisma.waterLog.groupBy({
        by: ['date'],
        where: { userId },
        _sum: { ml: true },
      }),
      this.prisma.fast.findMany({
        where: { userId, endAt: { not: null } },
        select: { startAt: true, endAt: true, goalHours: true },
      }),
      this.prisma.weightLog.count({ where: { userId } }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.recipe.count({ where: { userId, custom: true } }),
      this.prisma.activity.count({ where: { userId } }),
    ]);

    const kcalTarget = user.kcalTarget;
    const waterTarget = user.waterTargetMl;
    const start = user.startWeightKg;
    const current = latest?.kg ?? null;
    const target = user.targetWeightKg;

    return {
      meals: mealDays.reduce((s, d) => s + d._count._all, 0),
      photoMeals,
      bestStreak: bestStreak(mealDays.map((d) => formatDay(d.date))),
      waterDays: waterTarget
        ? waterDays.filter((d) => (d._sum.ml ?? 0) >= waterTarget).length
        : 0,
      fastsReached: fasts.filter(
        (f) =>
          f.endAt!.getTime() - f.startAt.getTime() >= f.goalHours * HOUR_MS,
      ).length,
      hasWeight: weightCount > 0,
      kgLost:
        user.goal === 'LOSE' && start && current
          ? Math.max(0, start - current)
          : 0,
      goalReached: Boolean(
        weightCount > 1 &&
        current &&
        target &&
        ((user.goal === 'LOSE' && current <= target) ||
          (user.goal === 'GAIN' && current >= target)),
      ),
      proteinDays: user.proteinTarget
        ? mealDays.filter((d) => (d._sum.protein ?? 0) >= user.proteinTarget!)
            .length
        : 0,
      kcalDays: kcalTarget
        ? mealDays.filter(
            (d) =>
              Math.abs((d._sum.kcal ?? 0) - kcalTarget) / kcalTarget <= 0.1,
          ).length
        : 0,
      customRecipes,
      activities,
    };
  }

  async evaluate(userId: string) {
    const [stats, unlocked] = await Promise.all([
      this.stats(userId),
      this.prisma.userAchievement.findMany({
        where: { userId },
        select: { key: true },
      }),
    ]);
    const have = new Set(unlocked.map((u) => u.key));
    const fresh = ACHIEVEMENTS.filter(
      (a) => !have.has(a.key) && a.check(stats),
    );
    if (!fresh.length) return;
    await this.prisma.$transaction([
      this.prisma.userAchievement.createMany({
        data: fresh.map((a) => ({ userId, key: a.key })),
        skipDuplicates: true,
      }),
      this.prisma.gemTx.createMany({
        data: fresh.map((a) => ({
          userId,
          refKey: `ach:${a.key}`,
          amount: a.gems,
          reason: `Conquista: ${a.title}`,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  async state(userId: string) {
    await this.evaluate(userId);
    const [user, gems, items, unseen] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.gems(userId),
      this.prisma.userItem.findMany({ where: { userId } }),
      this.prisma.userAchievement.findMany({
        where: { userId, seen: false },
        orderBy: { unlockedAt: 'asc' },
      }),
    ]);
    const equipped = items.filter((i) => i.equipped).map((i) => i.itemId);
    if (!equipped.some((id) => id.startsWith('color_'))) {
      equipped.push(DEFAULT_COLOR);
    }
    return {
      petName: user.petName,
      gems: gems.balance,
      ...levelFor(gems.lifetime),
      lifetimeGems: gems.lifetime,
      owned: [DEFAULT_COLOR, ...items.map((i) => i.itemId)],
      equipped,
      newAchievements: unseen
        .map((u) => ACHIEVEMENTS.find((a) => a.key === u.key))
        .filter((a) => a !== undefined)
        .map(publicAchievement),
    };
  }

  async achievements(userId: string) {
    await this.evaluate(userId);
    const unlocked = await this.prisma.userAchievement.findMany({
      where: { userId },
    });
    const byKey = new Map(unlocked.map((u) => [u.key, u.unlockedAt]));
    return ACHIEVEMENTS.map((a) => ({
      ...publicAchievement(a),
      unlockedAt: byKey.get(a.key) ?? null,
    }));
  }

  async markSeen(userId: string, keys: string[]) {
    await this.prisma.userAchievement.updateMany({
      where: { userId, key: { in: keys } },
      data: { seen: true },
    });
  }

  dailyDeal(day: string, level: number, owned: Set<string>) {
    const pool = ITEMS.filter(
      (i) => i.price > 0 && i.minLevel <= level && !owned.has(i.id),
    );
    if (!pool.length) return null;
    const item = pool[seededIndex(`deal:${day}`, pool.length)];
    return { itemId: item.id, price: Math.round(item.price / 2) };
  }

  todayItems(day: string): string[] {
    const pool = ITEMS.filter((i) => i.price > 0);
    const picked: string[] = [];
    let n = 0;
    while (picked.length < 6 && n < 50) {
      const item = pool[seededIndex(`today:${day}:${n++}`, pool.length)];
      if (!picked.includes(item.id)) picked.push(item.id);
    }
    return picked;
  }

  async shop(userId: string, day: string) {
    const state = await this.state(userId);
    const owned = new Set(state.owned);
    return {
      gems: state.gems,
      level: state.level,
      deal: this.dailyDeal(day, state.level, owned),
      today: this.todayItems(day),
      items: ITEMS.map((i) => ({
        ...i,
        owned: owned.has(i.id),
        locked: i.minLevel > state.level,
      })),
    };
  }

  async buy(userId: string, itemId: string, day: string) {
    const item = ITEMS.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Item não encontrado');
    const state = await this.state(userId);
    const owned = new Set(state.owned);
    if (owned.has(item.id))
      throw new ConflictException('Você já tem esse item');
    if (item.minLevel > state.level) {
      throw new BadRequestException(`Disponível no nível ${item.minLevel}`);
    }
    const deal = this.dailyDeal(day, state.level, owned);
    const price = deal?.itemId === item.id ? deal.price : item.price;
    if (state.gems < price)
      throw new BadRequestException('Gemas insuficientes');
    await this.prisma.$transaction([
      this.prisma.gemTx.create({
        data: {
          userId,
          amount: -price,
          reason: `Loja: ${item.name}`,
          refKey: `buy:${item.id}`,
        },
      }),
      this.prisma.userItem.create({ data: { userId, itemId: item.id } }),
    ]);
    await this.equip(userId, item.id, true);
    return this.state(userId);
  }

  async equip(userId: string, itemId: string, equipped: boolean) {
    const item: ShopItem | undefined = ITEMS.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Item não encontrado');
    if (item.id === DEFAULT_COLOR) {
      await this.prisma.userItem.upsert({
        where: { userId_itemId: { userId, itemId } },
        create: { userId, itemId },
        update: {},
      });
    }
    const owned = await this.prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });
    if (!owned) throw new BadRequestException('Compre o item primeiro');
    if (equipped && item.slot !== 'garden') {
      const sameSlot = ITEMS.filter((i) => i.slot === item.slot).map(
        (i) => i.id,
      );
      await this.prisma.userItem.updateMany({
        where: { userId, itemId: { in: sameSlot } },
        data: { equipped: false },
      });
    }
    await this.prisma.userItem.update({
      where: { userId_itemId: { userId, itemId } },
      data: { equipped },
    });
    return this.state(userId);
  }
}
