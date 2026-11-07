import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { MealType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { FreeMealService } from './free-meal.service';

class FreeMealSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number | null;

  @IsOptional()
  @IsEnum(MealType)
  meal?: MealType | null;
}

class FreeMealSwapDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsEnum(MealType)
  meal?: MealType;
}

@Controller('free-meal')
@UseGuards(AuthGuard)
export class FreeMealController {
  constructor(private readonly freeMeal: FreeMealService) {}

  @Get()
  state(@UserId() userId: string) {
    return this.freeMeal.state(userId);
  }

  @Patch()
  update(@UserId() userId: string, @Body() dto: FreeMealSettingsDto) {
    return this.freeMeal.updateSettings(userId, dto);
  }

  @Put('week')
  swap(@UserId() userId: string, @Body() dto: FreeMealSwapDto) {
    return this.freeMeal.swap(userId, dto.date.slice(0, 10), dto.meal);
  }

  @Delete('week')
  reset(@UserId() userId: string) {
    return this.freeMeal.resetWeek(userId);
  }
}
