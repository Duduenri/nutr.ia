import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ActivityLevel, Goal, Sex, SurgeryType, User } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { computeTargets, goalPlan } from './nutrition';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(100, { message: 'Altura deve estar entre 100 e 250 cm (ex.: 159)' })
  @Max(250, { message: 'Altura deve estar entre 100 e 250 cm (ex.: 159)' })
  heightCm?: number;

  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @IsOptional()
  @IsNumber()
  @Min(30, { message: 'Peso deve estar entre 30 e 300 kg' })
  @Max(300, { message: 'Peso deve estar entre 30 e 300 kg' })
  currentWeightKg?: number;

  @IsOptional()
  @IsDateString()
  today?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(30, { message: 'Peso deve estar entre 30 e 300 kg' })
  @Max(300, { message: 'Peso deve estar entre 30 e 300 kg' })
  targetWeightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(1000)
  cupSizeMl?: number;

  @IsOptional()
  @IsBoolean()
  bariatric?: boolean;

  @IsOptional()
  @IsDateString()
  surgeryDate?: string | null;

  @IsOptional()
  @IsIn(['BGA', 'SLEEVE', 'BYPASS', 'BPD_DS', null])
  surgeryType?: SurgeryType | null;
}

class OverrideTargetsDto {
  @IsOptional()
  @IsInt()
  kcalTarget?: number;

  @IsOptional()
  @IsInt()
  proteinTarget?: number;

  @IsOptional()
  @IsInt()
  carbsTarget?: number;

  @IsOptional()
  @IsInt()
  fatTarget?: number;

  @IsOptional()
  @IsInt()
  waterTargetMl?: number;
}

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@UserId() userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException();
    }
    const latest = await this.prisma.weightLog.findFirst({
      where: { userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return this.serialize(user, latest?.kg ?? user.startWeightKg);
  }

  @Patch()
  async update(@UserId() userId: string, @Body() dto: UpdateProfileDto) {
    const {
      currentWeightKg,
      birthDate,
      today,
      targetDate,
      surgeryDate,
      ...rest
    } = dto;
    let user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        ...(birthDate ? { birthDate: parseDay(birthDate.slice(0, 10)) } : {}),
        ...(surgeryDate === null ? { surgeryDate: null } : {}),
        ...(surgeryDate
          ? { surgeryDate: parseDay(surgeryDate.slice(0, 10)) }
          : {}),
        ...(targetDate === null ? { targetDate: null } : {}),
        ...(targetDate
          ? { targetDate: parseDay(targetDate.slice(0, 10)) }
          : {}),
      },
    });

    if (currentWeightKg) {
      if (!user.startWeightKg) {
        user = await this.prisma.user.update({
          where: { id: userId },
          data: { startWeightKg: currentWeightKg },
        });
      }
      const date = parseDay((today ?? new Date().toISOString()).slice(0, 10));
      await this.prisma.weightLog.create({
        data: { userId, date, kg: currentWeightKg },
      });
    }

    return this.recalculate(userId);
  }

  @Post('recalculate')
  recalculate(@UserId() userId: string) {
    return this.applyTargets(userId);
  }

  @Patch('targets')
  async overrideTargets(
    @UserId() userId: string,
    @Body() dto: OverrideTargetsDto,
  ) {
    await this.prisma.user.update({ where: { id: userId }, data: dto });
    return this.get(userId);
  }

  private async applyTargets(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const latest = await this.prisma.weightLog.findFirst({
      where: { userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    const weightKg = latest?.kg ?? user.startWeightKg;
    if (
      user.sex &&
      user.birthDate &&
      user.heightCm &&
      user.activityLevel &&
      user.goal &&
      weightKg
    ) {
      const targets = computeTargets({
        sex: user.sex,
        birthDate: user.birthDate,
        heightCm: user.heightCm,
        weightKg,
        targetWeightKg: user.targetWeightKg,
        targetDate: user.targetDate,
        activityLevel: user.activityLevel,
        goal: user.goal,
        bariatric: user.bariatric,
      });
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: targets,
      });
      return this.serialize(updated, weightKg);
    }
    return this.serialize(user, weightKg);
  }

  private serialize(user: User, currentWeightKg: number | null) {
    return {
      ...user,
      passwordHash: undefined,
      currentWeightKg,
      onboarded: Boolean(user.kcalTarget),
      goalPlan:
        currentWeightKg && user.targetWeightKg && user.targetDate
          ? goalPlan(currentWeightKg, user.targetWeightKg, user.targetDate)
          : null,
    };
  }
}
