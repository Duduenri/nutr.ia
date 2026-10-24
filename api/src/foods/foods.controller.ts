import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Food } from '@prisma/client';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { normalize } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';

class CustomFoodDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6,14}$/)
  barcode?: string;

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
  @Min(0)
  fiber?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  servingG?: number;
}

interface OffResponse {
  status: number;
  product?: {
    product_name?: string;
    product_name_pt?: string;
    brands?: string;
    serving_quantity?: number | string;
    nutriments?: Record<string, number | string | undefined>;
  };
}

function toPublic(food: Food) {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    category: food.category,
    source: food.source,
    per100g: {
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      micros: food.micros,
    },
    servingG: food.servingG,
  };
}

function num(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

@Controller('foods')
@UseGuards(AuthGuard)
export class FoodsController {
  private readonly logger = new Logger(FoodsController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  async search(@UserId() userId: string, @Query('q') q = '') {
    const terms = normalize(q).split(/\s+/).filter(Boolean);
    if (!terms.length) {
      return [];
    }
    const foods = await this.prisma.food.findMany({
      where: {
        AND: terms.map((t) => ({ searchName: { contains: t } })),
        OR: [{ userId: null }, { userId }],
      },
      take: 40,
    });
    const first = terms[0];
    foods.sort((a, b) => {
      const as = a.searchName.startsWith(first) ? 0 : 1;
      const bs = b.searchName.startsWith(first) ? 0 : 1;
      return as - bs || a.name.length - b.name.length;
    });
    return foods.map(toPublic);
  }

  @Get('recent')
  async recent(@UserId() userId: string) {
    const entries = await this.prisma.mealEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const seen = new Set<string>();
    const result: typeof entries = [];
    for (const e of entries) {
      const key = normalize(e.name);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(e);
      }
      if (result.length >= 20) break;
    }
    return result.map((e) => ({
      name: e.name,
      grams: e.grams,
      kcal: e.kcal,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
      fiber: e.fiber,
      micros: e.micros,
      foodId: e.foodId,
    }));
  }

  @Get('barcode/:code')
  async barcode(@UserId() userId: string, @Param('code') code: string) {
    if (!/^\d{6,14}$/.test(code)) {
      throw new NotFoundException('Código inválido');
    }
    const cached = await this.prisma.food.findFirst({
      where: { barcode: code, OR: [{ userId: null }, { userId }] },
      orderBy: { userId: 'desc' },
    });
    if (cached) {
      return toPublic(cached);
    }

    const off = await this.fetchOpenFoodFacts(code);
    const n = off?.product?.nutriments;
    if (!off || off.status !== 1 || !n) {
      throw new NotFoundException('Produto não encontrado');
    }
    const product = off.product!;
    const name =
      product.product_name_pt || product.product_name || `Produto ${code}`;
    const kcal =
      num(n['energy-kcal_100g']) || Math.round(num(n['energy_100g']) / 4.184);
    const food = await this.prisma.food.create({
      data: {
        name,
        searchName: normalize(name),
        brand: product.brands?.split(',')[0]?.trim() || null,
        barcode: code,
        source: 'OPEN_FOOD_FACTS',
        kcal,
        protein: num(n['proteins_100g']),
        carbs: num(n['carbohydrates_100g']),
        fat: num(n['fat_100g']),
        fiber: num(n['fiber_100g']),
        micros: { sodioMg: num(n['sodium_100g']) * 1000 },
        servingG: num(product.serving_quantity) || null,
      },
    });
    return toPublic(food);
  }

  @Post()
  async create(@UserId() userId: string, @Body() dto: CustomFoodDto) {
    const food = await this.prisma.food.create({
      data: {
        ...dto,
        userId,
        searchName: normalize(dto.name),
        source: 'CUSTOM',
      },
    });
    return toPublic(food);
  }

  private async fetchOpenFoodFacts(code: string): Promise<OffResponse | null> {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_pt,brands,serving_quantity,nutriments`,
        {
          headers: { 'User-Agent': 'NutriApp/1.0 (uso pessoal)' },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as OffResponse;
    } catch (error) {
      this.logger.warn(`Open Food Facts falhou: ${String(error)}`);
      return null;
    }
  }
}
