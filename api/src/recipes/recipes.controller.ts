import {
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
import { MealType, Recipe } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AiService } from '../ai/ai.service';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { UserContextService } from '../coach/user-context.service';
import { parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';

class GenerateDto {
  @IsDateString()
  today!: string;

  @IsOptional()
  @IsEnum(MealType)
  meal?: MealType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  request?: string;
}

class FavoriteDto {
  @IsBoolean()
  favorite!: boolean;
}

class LogDto {
  @IsDateString()
  date!: string;

  @IsEnum(MealType)
  meal!: MealType;

  @IsNumber()
  @Min(0.25)
  @Max(10)
  servings!: number;
}

function serialize(r: Recipe) {
  return {
    ...r,
    ingredients: r.ingredients as { item: string; quantity: string }[],
    steps: r.steps as string[],
  };
}

@Controller('recipes')
@UseGuards(AuthGuard)
export class RecipesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly userContext: UserContextService,
  ) {}

  @Get()
  async list(@UserId() userId: string, @Query('favorites') favorites?: string) {
    const recipes = await this.prisma.recipe.findMany({
      where: { userId, ...(favorites === 'true' ? { favorite: true } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return recipes.map(serialize);
  }

  @Post('generate')
  async generate(@UserId() userId: string, @Body() dto: GenerateDto) {
    const [context, recent] = await Promise.all([
      this.userContext.build(userId, dto.today),
      this.prisma.recipe.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { title: true },
      }),
    ]);
    const generated = await this.ai.recipes(context, {
      meal: dto.meal,
      request: dto.request?.trim() || undefined,
      avoid: recent.map((r) => r.title),
    });
    const created = await this.prisma.$transaction(
      generated.map((r) =>
        this.prisma.recipe.create({
          data: {
            userId,
            title: r.title,
            emoji: r.emoji,
            meal: r.meal,
            prepMinutes: Math.round(r.prepMinutes),
            servings: Math.max(1, Math.round(r.servings)),
            servingG: r.servingG,
            kcal: r.perServing.kcal,
            protein: r.perServing.protein,
            carbs: r.perServing.carbs,
            fat: r.perServing.fat,
            fiber: r.perServing.fiber,
            ingredients: r.ingredients,
            steps: r.steps,
            tip: r.tip,
          },
        }),
      ),
    );
    return created.map(serialize);
  }

  @Patch(':id')
  async favorite(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: FavoriteDto,
  ) {
    await this.own(userId, id);
    const recipe = await this.prisma.recipe.update({
      where: { id },
      data: { favorite: dto.favorite },
    });
    return serialize(recipe);
  }

  @Post(':id/log')
  async log(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: LogDto,
  ) {
    const r = await this.own(userId, id);
    const n = dto.servings;
    await this.prisma.mealEntry.create({
      data: {
        userId,
        date: parseDay(dto.date.slice(0, 10)),
        meal: dto.meal,
        source: 'RECIPE',
        name: `${r.title}${n !== 1 ? ` (${n} porções)` : ''}`,
        grams: r.servingG * n,
        kcal: r.kcal * n,
        protein: r.protein * n,
        carbs: r.carbs * n,
        fat: r.fat * n,
        fiber: r.fiber * n,
      },
    });
    return { ok: true };
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    await this.own(userId, id);
    await this.prisma.recipe.delete({ where: { id } });
    return { ok: true };
  }

  private async own(userId: string, id: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, userId },
    });
    if (!recipe) {
      throw new NotFoundException();
    }
    return recipe;
  }
}
