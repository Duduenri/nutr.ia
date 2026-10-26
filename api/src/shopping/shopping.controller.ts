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
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AiService, SHOPPING_CATEGORIES } from '../ai/ai.service';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class GenerateDto {
  @IsIn(['plan', 'recipes'])
  source!: 'plan' | 'recipes';

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  recipeIds?: string[];

  @IsInt()
  @Min(1)
  @Max(10)
  people!: number;

  @IsInt()
  @Min(1)
  @Max(14)
  days!: number;
}

class ItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(40)
  quantity!: string;

  @IsIn(SHOPPING_CATEGORIES)
  category!: string;

  @IsBoolean()
  checked!: boolean;
}

class UpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];
}

class CreateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;
}

@Controller('shopping')
@UseGuards(AuthGuard)
export class ShoppingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  @Get()
  list(@UserId() userId: string) {
    return this.prisma.shoppingList.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: CreateDto) {
    return this.prisma.shoppingList.create({
      data: { userId, title: dto.title.trim(), items: [] },
    });
  }

  @Post('generate')
  async generate(@UserId() userId: string, @Body() dto: GenerateDto) {
    let source: string;
    if (dto.source === 'plan') {
      const plan = await this.prisma.plan.findFirst({
        where: {
          userId,
          kind: 'diet',
          ...(dto.planId ? { id: dto.planId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!plan) {
        throw new BadRequestException(
          'Crie um plano alimentar no Coach primeiro',
        );
      }
      source = `Plano alimentar de 1 dia (repita para os ${dto.days} dias):\n${plan.content}`;
    } else {
      const recipes = await this.prisma.recipe.findMany({
        where: { userId, id: { in: dto.recipeIds ?? [] } },
      });
      if (!recipes.length) {
        throw new BadRequestException('Escolha pelo menos uma receita');
      }
      source = `Receitas que vou fazer (cada uma uma vez, rendimento indicado):\n${recipes
        .map(
          (r) =>
            `- ${r.title} (rende ${r.servings} porções): ${JSON.stringify(r.ingredients)}`,
        )
        .join('\n')}`;
    }
    const draft = await this.ai.shoppingList(source, dto.people, dto.days);
    return this.prisma.shoppingList.create({
      data: {
        userId,
        title: draft.title,
        items: draft.items.map((i) => ({
          ...i,
          checked: false,
        })),
      },
    });
  }

  @Patch(':id')
  async update(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDto,
  ) {
    await this.own(userId, id);
    return this.prisma.shoppingList.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        items: dto.items as unknown as Prisma.InputJsonValue,
      },
    });
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    await this.own(userId, id);
    await this.prisma.shoppingList.delete({ where: { id } });
    return { ok: true };
  }

  private async own(userId: string, id: string) {
    const row = await this.prisma.shoppingList.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
}
