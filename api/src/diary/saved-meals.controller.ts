import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MealEntry, MealType, Prisma } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { addDays, parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

class SaveMealDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsDateString()
  date!: string;

  @IsEnum(MealType)
  meal!: MealType;
}

class LogSavedDto {
  @IsDateString()
  date!: string;

  @IsEnum(MealType)
  meal!: MealType;
}

class RepeatDto extends LogSavedDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;
}

type SavedItem = Pick<
  MealEntry,
  'name' | 'grams' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'foodId'
> & { micros: Prisma.JsonValue };

function toItem(e: MealEntry): SavedItem {
  return {
    name: e.name,
    grams: e.grams,
    kcal: e.kcal,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    fiber: e.fiber,
    micros: e.micros,
    foodId: e.foodId,
  };
}

@Controller()
@UseGuards(AuthGuard)
export class SavedMealsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('saved-meals')
  async list(@UserId() userId: string) {
    const rows = await this.prisma.savedMeal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => {
      const items = r.items as SavedItem[];
      return {
        id: r.id,
        name: r.name,
        meal: r.meal,
        items,
        kcal: Math.round(items.reduce((s, i) => s + i.kcal, 0)),
        protein: Math.round(items.reduce((s, i) => s + i.protein, 0)),
      };
    });
  }

  @Post('saved-meals')
  async save(@UserId() userId: string, @Body() dto: SaveMealDto) {
    const entries = await this.prisma.mealEntry.findMany({
      where: { userId, date: parseDay(dto.date.slice(0, 10)), meal: dto.meal },
      orderBy: { createdAt: 'asc' },
    });
    if (!entries.length) {
      throw new BadRequestException('Essa refeição está vazia');
    }
    const saved = await this.prisma.savedMeal.create({
      data: {
        userId,
        name: dto.name.trim(),
        meal: dto.meal,
        items: entries.map(toItem),
      },
    });
    return { id: saved.id };
  }

  @Delete('saved-meals/:id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    const { count } = await this.prisma.savedMeal.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException();
    return { ok: true };
  }

  @Post('saved-meals/:id/log')
  async log(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: LogSavedDto,
  ) {
    const saved = await this.prisma.savedMeal.findFirst({
      where: { id, userId },
    });
    if (!saved) throw new NotFoundException();
    await this.insert(userId, dto, saved.items as SavedItem[]);
    return { ok: true };
  }

  @Post('entries/repeat')
  async repeat(@UserId() userId: string, @Body() dto: RepeatDto) {
    const to = parseDay(dto.date.slice(0, 10));
    const from = dto.fromDate
      ? parseDay(dto.fromDate.slice(0, 10))
      : addDays(to, -1);
    const entries = await this.prisma.mealEntry.findMany({
      where: { userId, date: from, meal: dto.meal },
      orderBy: { createdAt: 'asc' },
    });
    if (!entries.length) {
      throw new NotFoundException('Nada registrado nessa refeição ontem');
    }
    await this.insert(userId, dto, entries.map(toItem));
    return { ok: true, count: entries.length };
  }

  private insert(userId: string, dto: LogSavedDto, items: SavedItem[]) {
    const date = parseDay(dto.date.slice(0, 10));
    return this.prisma.mealEntry.createMany({
      data: items.map((i) => ({
        ...i,
        micros: i.micros ?? Prisma.JsonNull,
        userId,
        date,
        meal: dto.meal,
        source: 'FAVORITE' as const,
      })),
    });
  }
}
