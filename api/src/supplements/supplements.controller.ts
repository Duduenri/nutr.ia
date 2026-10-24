import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

class SupplementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(16)
  emoji!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dose?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  proteinG?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2000)
  kcal?: number;

  @IsInt()
  @Min(1)
  @Max(6)
  timesPerDay!: number;
}

class TakeDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  takenAt?: string;
}

const CLOCK_SKEW_MS = 5 * 60_000;

@Controller('supplements')
@UseGuards(AuthGuard)
export class SupplementsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@UserId() userId: string, @Query('date') day: string) {
    const date = parseDay(day);
    const [supplements, logs] = await Promise.all([
      this.prisma.supplement.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.supplementLog.findMany({
        where: { userId, date },
        orderBy: { takenAt: 'asc' },
      }),
    ]);
    return supplements.map((s) => ({
      ...s,
      logs: logs
        .filter((l) => l.supplementId === s.id)
        .map((l) => ({ id: l.id, takenAt: l.takenAt })),
    }));
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: SupplementDto) {
    return this.prisma.supplement.create({ data: { ...dto, userId } });
  }

  @Patch(':id')
  async update(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: SupplementDto,
  ) {
    await this.own(userId, id);
    return this.prisma.supplement.update({
      where: { id },
      data: {
        ...dto,
        dose: dto.dose ?? null,
        proteinG: dto.proteinG ?? null,
        kcal: dto.kcal ?? null,
      },
    });
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    await this.own(userId, id);
    await this.prisma.supplement.delete({ where: { id } });
    return { ok: true };
  }

  @Post(':id/take')
  async take(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: TakeDto,
  ) {
    const s = await this.own(userId, id);
    const date = parseDay(dto.date.slice(0, 10));
    const takenAt = dto.takenAt ? new Date(dto.takenAt) : new Date();
    if (takenAt.getTime() > Date.now() + CLOCK_SKEW_MS) {
      throw new BadRequestException('O horário não pode ser no futuro');
    }
    const entry = s.proteinG
      ? await this.prisma.mealEntry.create({
          data: {
            userId,
            date,
            meal: 'SNACK',
            source: 'SUPPLEMENT',
            name: s.dose ? `${s.name} (${s.dose})` : s.name,
            grams: 0,
            kcal: s.kcal ?? s.proteinG * 4,
            protein: s.proteinG,
            carbs: 0,
            fat: 0,
            createdAt: takenAt,
          },
        })
      : null;
    return this.prisma.supplementLog.create({
      data: {
        userId,
        supplementId: id,
        date,
        takenAt,
        mealEntryId: entry?.id,
      },
    });
  }

  @Delete('logs/:logId')
  async untake(@UserId() userId: string, @Param('logId') logId: string) {
    const log = await this.prisma.supplementLog.findFirst({
      where: { id: logId, userId },
    });
    if (!log) throw new NotFoundException();
    await this.prisma.$transaction([
      ...(log.mealEntryId
        ? [
            this.prisma.mealEntry.deleteMany({
              where: { id: log.mealEntryId, userId },
            }),
          ]
        : []),
      this.prisma.supplementLog.delete({ where: { id: logId } }),
    ]);
    return { ok: true };
  }

  private async own(userId: string, id: string) {
    const s = await this.prisma.supplement.findFirst({ where: { id, userId } });
    if (!s) throw new NotFoundException();
    return s;
  }
}
