import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EntrySource, Intensity, MealType, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AiService } from '../ai/ai.service';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { ageFrom } from '../profile/nutrition';
import { addDays, formatDay, parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { DiaryService } from './diary.service';

class EntryItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsNumber()
  @Min(0)
  grams!: number;

  @IsNumber()
  @Min(0)
  kcal!: number;

  @IsNumber()
  @Min(0)
  protein!: number;

  @IsNumber()
  @Min(0)
  carbs!: number;

  @IsNumber()
  @Min(0)
  fat!: number;

  @IsOptional()
  @IsNumber()
  fiber?: number;

  @IsOptional()
  @IsObject()
  micros?: Record<string, number>;

  @IsOptional()
  @IsString()
  foodId?: string;
}

class CreateEntriesDto {
  @IsDateString()
  date!: string;

  @IsEnum(MealType)
  meal!: MealType;

  @IsEnum(EntrySource)
  source!: EntrySource;

  @IsOptional()
  @IsString()
  photoId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EntryItemDto)
  items!: EntryItemDto[];
}

class UpdateEntryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  grams?: number;

  @IsOptional()
  @IsEnum(MealType)
  meal?: MealType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

class WaterDto {
  @IsDateString()
  date!: string;

  @IsInt()
  @Min(-2000)
  @Max(3000)
  ml!: number;
}

class SetDto {
  @IsInt()
  @Min(1)
  @Max(200)
  reps!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  kg!: number;
}

class ExerciseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => SetDto)
  sets!: SetDto[];
}

function exercisesText(exercises: ExerciseDto[] | undefined): string {
  return (exercises ?? [])
    .map(
      (e) =>
        `${e.name}: ${e.sets.map((s) => `${s.reps}x${s.kg}kg`).join(', ')}`,
    )
    .join('; ');
}

class EstimateActivityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(600)
  minutes!: number;

  @IsOptional()
  @IsEnum(Intensity)
  intensity?: Intensity;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(500)
  distanceKm?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  exercises?: ExerciseDto[];
}

class ActivityDto extends EstimateActivityDto {
  @IsDateString()
  date!: string;

  @IsInt()
  @Min(0)
  kcal!: number;
}

class NoteDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;
}

class WeightDto {
  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(30)
  @Max(300)
  kg!: number;
}

@Controller()
@UseGuards(AuthGuard)
export class DiaryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diary: DiaryService,
    private readonly ai: AiService,
  ) {}

  @Get('diary/:date')
  day(@UserId() userId: string, @Param('date') date: string) {
    return this.diary.day(userId, date);
  }

  @Post('entries')
  async createEntries(@UserId() userId: string, @Body() dto: CreateEntriesDto) {
    const date = parseDay(dto.date.slice(0, 10));
    if (dto.photoId) {
      await this.assertOwn(
        this.prisma.photo.findFirst({ where: { id: dto.photoId, userId } }),
      );
    }
    await this.prisma.mealEntry.createMany({
      data: dto.items.map((item) => ({
        userId,
        date,
        meal: dto.meal,
        source: dto.source,
        photoId: dto.photoId,
        name: item.name,
        grams: item.grams,
        kcal: item.kcal,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
        micros: item.micros,
        foodId: item.foodId,
      })),
    });
    return { ok: true };
  }

  @Patch('entries/:id')
  async updateEntry(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEntryDto,
  ) {
    const entry = await this.assertOwn(
      this.prisma.mealEntry.findFirst({ where: { id, userId } }),
    );
    const data: Prisma.MealEntryUpdateInput = {
      meal: dto.meal,
      name: dto.name,
    };
    if (dto.grams && entry.grams > 0) {
      const f = dto.grams / entry.grams;
      const micros = entry.micros as Record<string, number> | null;
      Object.assign(data, {
        grams: dto.grams,
        kcal: entry.kcal * f,
        protein: entry.protein * f,
        carbs: entry.carbs * f,
        fat: entry.fat * f,
        fiber: entry.fiber === null ? null : entry.fiber * f,
        micros: micros
          ? Object.fromEntries(
              Object.entries(micros).map(([k, v]) => [k, v * f]),
            )
          : undefined,
      });
    }
    return this.prisma.mealEntry.update({ where: { id }, data });
  }

  @Delete('entries/:id')
  async deleteEntry(@UserId() userId: string, @Param('id') id: string) {
    await this.assertOwn(
      this.prisma.mealEntry.findFirst({ where: { id, userId } }),
    );
    await this.prisma.mealEntry.delete({ where: { id } });
    return { ok: true };
  }

  @Post('water')
  async addWater(@UserId() userId: string, @Body() dto: WaterDto) {
    const date = parseDay(dto.date.slice(0, 10));
    if (dto.ml < 0) {
      const last = await this.prisma.waterLog.findFirst({
        where: { userId, date },
        orderBy: { createdAt: 'desc' },
      });
      if (last) {
        await this.prisma.waterLog.delete({ where: { id: last.id } });
      }
      return { ok: true };
    }
    await this.prisma.waterLog.create({ data: { userId, date, ml: dto.ml } });
    return { ok: true };
  }

  @Post('activities')
  addActivity(@UserId() userId: string, @Body() dto: ActivityDto) {
    return this.prisma.activity.create({
      data: {
        ...dto,
        details: dto.details?.trim() || null,
        exercises: dto.exercises?.length
          ? (dto.exercises as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        userId,
        date: parseDay(dto.date.slice(0, 10)),
      },
    });
  }

  @Get('activities/history')
  async activityHistory(
    @UserId() userId: string,
    @Query('today') today: string,
  ) {
    const end = parseDay(today);
    const [activities, steps] = await Promise.all([
      this.prisma.activity.findMany({
        where: { userId, date: { gte: addDays(end, -365), lte: end } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.dailySteps.findMany({
        where: { userId, date: { gte: addDays(end, -84), lte: end } },
        orderBy: { date: 'asc' },
      }),
    ]);
    return {
      activities: activities.map((a) => ({
        id: a.id,
        date: formatDay(a.date),
        name: a.name,
        minutes: a.minutes,
        kcal: a.kcal,
        intensity: a.intensity,
        details: a.details,
        distanceKm: a.distanceKm,
        exercises: a.exercises,
      })),
      steps: steps.map((s) => ({ date: formatDay(s.date), steps: s.steps })),
    };
  }

  @Post('activities/estimate')
  @HttpCode(200)
  async estimateActivity(
    @UserId() userId: string,
    @Body() dto: EstimateActivityDto,
  ) {
    const [user, weight] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.weightLog.findFirst({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    return this.ai.estimateActivity({
      ...dto,
      details:
        [dto.details?.trim(), exercisesText(dto.exercises)]
          .filter(Boolean)
          .join('. ') || undefined,
      weightKg: weight?.kg ?? user.startWeightKg,
      sex: user.sex,
      age: user.birthDate ? ageFrom(user.birthDate) : null,
    });
  }

  @Delete('activities/:id')
  async deleteActivity(@UserId() userId: string, @Param('id') id: string) {
    await this.assertOwn(
      this.prisma.activity.findFirst({ where: { id, userId } }),
    );
    await this.prisma.activity.delete({ where: { id } });
    return { ok: true };
  }

  @Post('notes')
  addNote(@UserId() userId: string, @Body() dto: NoteDto) {
    return this.prisma.note.create({
      data: { userId, text: dto.text, date: parseDay(dto.date.slice(0, 10)) },
    });
  }

  @Delete('notes/:id')
  async deleteNote(@UserId() userId: string, @Param('id') id: string) {
    await this.assertOwn(this.prisma.note.findFirst({ where: { id, userId } }));
    await this.prisma.note.delete({ where: { id } });
    return { ok: true };
  }

  @Post('weight')
  addWeight(@UserId() userId: string, @Body() dto: WeightDto) {
    return this.prisma.weightLog.create({
      data: { userId, kg: dto.kg, date: parseDay(dto.date.slice(0, 10)) },
    });
  }

  @Delete('weight/:id')
  async deleteWeight(@UserId() userId: string, @Param('id') id: string) {
    await this.assertOwn(
      this.prisma.weightLog.findFirst({ where: { id, userId } }),
    );
    await this.prisma.weightLog.delete({ where: { id } });
    return { ok: true };
  }

  private async assertOwn<T>(query: Promise<T | null>): Promise<T> {
    const found = await query;
    if (!found) {
      throw new NotFoundException();
    }
    return found;
  }
}
