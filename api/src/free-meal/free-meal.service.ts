import { BadRequestException, Injectable } from '@nestjs/common';
import { MealType } from '@prisma/client';
import { parseDay, todayIn } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import {
  freeMealChecker,
  slotOfWeek,
  weeksToFreeze,
  weekStartOf,
  type FreeMealChecker,
} from './free-meal';

const SETTINGS_SELECT = {
  freeMealEnabled: true,
  freeMealWeekday: true,
  freeMeal: true,
  freeMealSince: true,
  timezone: true,
  bariatric: true,
} as const;

export interface FreeMealSettingsInput {
  enabled: boolean;
  weekday?: number | null;
  meal?: MealType | null;
}

@Injectable()
export class FreeMealService {
  constructor(private readonly prisma: PrismaService) {}

  async checker(userId: string): Promise<FreeMealChecker> {
    const { settings, rows } = await this.load(userId);
    return freeMealChecker(settings, rows);
  }

  async state(userId: string) {
    const { settings, rows, today, bariatric } = await this.load(userId);
    const week = slotOfWeek(settings, rows, weekStartOf(today));
    return {
      enabled: settings.freeMealEnabled,
      weekday: settings.freeMealWeekday,
      meal: settings.freeMeal,
      bariatric,
      today,
      week,
    };
  }

  async updateSettings(userId: string, input: FreeMealSettingsInput) {
    if (
      input.enabled &&
      (input.weekday === null || input.weekday === undefined || !input.meal)
    ) {
      throw new BadRequestException('Escolha o dia e a refeição livre');
    }
    const { settings, rows, today } = await this.load(userId);
    const frozen = weeksToFreeze(settings, rows, today);
    const currentWeek = parseDay(weekStartOf(today));
    await this.prisma.$transaction([
      this.prisma.freeMealWeek.createMany({
        data: frozen.map((slot) => ({
          userId,
          weekStart: parseDay(weekStartOf(slot.date)),
          date: parseDay(slot.date),
          meal: slot.meal,
        })),
        skipDuplicates: true,
      }),
      ...(input.enabled
        ? []
        : [
            this.prisma.freeMealWeek.deleteMany({
              where: {
                userId,
                weekStart: currentWeek,
                swapped: true,
                date: { gt: parseDay(today) },
              },
            }),
          ]),
      this.prisma.user.update({
        where: { id: userId },
        data: input.enabled
          ? {
              freeMealEnabled: true,
              freeMealWeekday: input.weekday,
              freeMeal: input.meal,
              freeMealSince: parseDay(today),
            }
          : { freeMealEnabled: false, freeMealSince: null },
      }),
    ]);
    return this.state(userId);
  }

  async swap(userId: string, day: string, meal?: MealType) {
    const { settings, today } = await this.load(userId);
    if (!settings.freeMealEnabled || !settings.freeMeal) {
      throw new BadRequestException('Ative a refeição livre nas configurações');
    }
    const weekStart = weekStartOf(today);
    if (weekStartOf(day) !== weekStart) {
      throw new BadRequestException(
        'Só dá pra trocar a refeição livre dentro desta semana',
      );
    }
    const data = {
      date: parseDay(day),
      meal: meal ?? settings.freeMeal,
      swapped: true,
    };
    await this.prisma.freeMealWeek.upsert({
      where: { userId_weekStart: { userId, weekStart: parseDay(weekStart) } },
      create: { userId, weekStart: parseDay(weekStart), ...data },
      update: data,
    });
    return this.state(userId);
  }

  async resetWeek(userId: string) {
    const { today } = await this.load(userId);
    await this.prisma.freeMealWeek.deleteMany({
      where: {
        userId,
        weekStart: parseDay(weekStartOf(today)),
        swapped: true,
      },
    });
    return this.state(userId);
  }

  private async load(userId: string) {
    const [user, rows] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: SETTINGS_SELECT,
      }),
      this.prisma.freeMealWeek.findMany({ where: { userId } }),
    ]);
    const { timezone, bariatric, ...settings } = user;
    return {
      settings,
      rows,
      bariatric,
      today: todayIn(timezone ?? 'America/Sao_Paulo'),
    };
  }
}
