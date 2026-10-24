import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

class StepsDto {
  @Transform(({ value }) => Math.round(Number(value)))
  @IsInt()
  @Min(0)
  @Max(200000)
  steps!: number;

  @IsOptional()
  @IsDateString()
  date?: string;
}

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('steps')
  @HttpCode(200)
  async steps(
    @Headers('x-steps-token') token: string | undefined,
    @Body() dto: StepsDto,
  ) {
    const user = token
      ? await this.prisma.user.findUnique({ where: { stepsToken: token } })
      : null;
    if (!user) {
      throw new UnauthorizedException();
    }
    const day = (
      dto.date ??
      new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    ).slice(0, 10);
    const date = parseDay(day);
    await this.prisma.dailySteps.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: { userId: user.id, date, steps: dto.steps },
      update: { steps: dto.steps },
    });
    return { ok: true, date: day, steps: dto.steps };
  }
}
