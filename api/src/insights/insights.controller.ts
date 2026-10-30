import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { InsightsService } from './insights.service';

class CheckinDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  sleep?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(16)
  sleepHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  energy?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  hunger?: number;
}

@Controller()
@UseGuards(AuthGuard)
export class InsightsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
  ) {}

  @Get('checkin')
  async checkin(@UserId() userId: string, @Query('date') day: string) {
    const date = parseDay(day);
    const row = await this.prisma.dailyCheckin.findUnique({
      where: { userId_date: { userId, date } },
    });
    return {
      sleep: row?.sleep ?? null,
      sleepHours: row?.sleepHours ?? null,
      energy: row?.energy ?? null,
      hunger: row?.hunger ?? null,
    };
  }

  @Put('checkin')
  async saveCheckin(@UserId() userId: string, @Body() dto: CheckinDto) {
    const date = parseDay(dto.date.slice(0, 10));
    const data = {
      sleep: dto.sleep,
      sleepHours: dto.sleepHours,
      energy: dto.energy,
      hunger: dto.hunger,
    };
    const row = await this.prisma.dailyCheckin.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...data },
      update: data,
    });
    return {
      sleep: row.sleep,
      sleepHours: row.sleepHours,
      energy: row.energy,
      hunger: row.hunger,
    };
  }

  @Get('insights/forecast')
  forecast(@UserId() userId: string, @Query('today') today: string) {
    parseDay(today);
    return this.insights.forecast(userId, today);
  }

  @Get('insights/period')
  period(
    @UserId() userId: string,
    @Query('kind') kind: string,
    @Query('today') today: string,
  ) {
    parseDay(today);
    if (kind !== 'week' && kind !== 'month') {
      throw new BadRequestException('Período inválido');
    }
    return this.insights.period(userId, kind, today);
  }
}
