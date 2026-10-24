import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Fast } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

export const FASTING_PLANS = ['12:12', '14:10', '16:8', '17:7', '18:6', '20:4'];

const HOUR_MS = 3_600_000;
const CLOCK_SKEW_MS = 5 * 60_000;

class StartDto {
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsInt()
  @Min(8)
  @Max(48)
  goalHours!: number;
}

class UpdateDto {
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(48)
  goalHours?: number;
}

class EndDto {
  @IsOptional()
  @IsDateString()
  endAt?: string;
}

class PlanDto {
  @IsIn(FASTING_PLANS)
  plan!: string;
}

function notFuture(iso: string | undefined, label: string): Date {
  const date = iso ? new Date(iso) : new Date();
  if (date.getTime() > Date.now() + CLOCK_SKEW_MS) {
    throw new BadRequestException(`${label} não pode ser no futuro`);
  }
  return date;
}

function serialize(f: Fast) {
  const end = f.endAt ?? new Date();
  const hours = (end.getTime() - f.startAt.getTime()) / HOUR_MS;
  return {
    id: f.id,
    startAt: f.startAt,
    endAt: f.endAt,
    goalHours: f.goalHours,
    goalAt: new Date(f.startAt.getTime() + f.goalHours * HOUR_MS),
    hours: Math.round(hours * 10) / 10,
    reached: hours >= f.goalHours,
  };
}

@Controller('fasting')
@UseGuards(AuthGuard)
export class FastingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@UserId() userId: string) {
    const [user, active, history, lastMeal] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.fast.findFirst({ where: { userId, endAt: null } }),
      this.prisma.fast.findMany({
        where: { userId, endAt: { not: null } },
        orderBy: { startAt: 'desc' },
        take: 30,
      }),
      this.prisma.mealEntry.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const weekAgo = Date.now() - 7 * 24 * HOUR_MS;
    const lastWeek = history
      .filter((f) => f.startAt.getTime() >= weekAgo)
      .map(serialize);

    return {
      plan: user.fastingPlan,
      active: active ? serialize(active) : null,
      lastEndedAt: history[0]?.endAt ?? null,
      lastMealAt: lastMeal?.createdAt ?? null,
      history: history.map(serialize),
      week: {
        count: lastWeek.length,
        reached: lastWeek.filter((f) => f.reached).length,
        averageHours: lastWeek.length
          ? Math.round(
              (lastWeek.reduce((s, f) => s + f.hours, 0) / lastWeek.length) *
                10,
            ) / 10
          : null,
      },
    };
  }

  @Patch('plan')
  async setPlan(@UserId() userId: string, @Body() dto: PlanDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fastingPlan: dto.plan },
    });
    return { plan: dto.plan };
  }

  @Post('start')
  async start(@UserId() userId: string, @Body() dto: StartDto) {
    const active = await this.prisma.fast.findFirst({
      where: { userId, endAt: null },
    });
    if (active) {
      throw new ConflictException('Já existe um jejum em andamento');
    }
    const fast = await this.prisma.fast.create({
      data: {
        userId,
        goalHours: dto.goalHours,
        startAt: notFuture(dto.startAt, 'O início'),
      },
    });
    return serialize(fast);
  }

  @Patch(':id')
  async update(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDto,
  ) {
    const fast = await this.own(userId, id);
    const startAt = dto.startAt
      ? notFuture(dto.startAt, 'O início')
      : fast.startAt;
    if (fast.endAt && startAt >= fast.endAt) {
      throw new BadRequestException('O início precisa ser antes do fim');
    }
    const updated = await this.prisma.fast.update({
      where: { id },
      data: { startAt, goalHours: dto.goalHours },
    });
    return serialize(updated);
  }

  @Post(':id/end')
  @HttpCode(200)
  async end(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: EndDto,
  ) {
    const fast = await this.own(userId, id);
    const endAt = notFuture(dto.endAt, 'O fim');
    if (endAt <= fast.startAt) {
      throw new BadRequestException('O fim precisa ser depois do início');
    }
    const updated = await this.prisma.fast.update({
      where: { id },
      data: { endAt },
    });
    return serialize(updated);
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    await this.own(userId, id);
    await this.prisma.fast.delete({ where: { id } });
    return { ok: true };
  }

  private async own(userId: string, id: string) {
    const fast = await this.prisma.fast.findFirst({ where: { id, userId } });
    if (!fast) {
      throw new NotFoundException();
    }
    return fast;
  }
}
