import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { GameService } from './game.service';

class PetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name!: string;
}

class BuyDto {
  @IsString()
  itemId!: string;

  @IsDateString()
  today!: string;
}

class EquipDto {
  @IsString()
  itemId!: string;

  @IsBoolean()
  equipped!: boolean;
}

class SeenDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  keys!: string[];
}

@Controller('game')
@UseGuards(AuthGuard)
export class GameController {
  constructor(
    private readonly game: GameService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  state(@UserId() userId: string) {
    return this.game.state(userId);
  }

  @Patch('pet')
  async rename(@UserId() userId: string, @Body() dto: PetDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { petName: dto.name.trim() },
    });
    return this.game.state(userId);
  }

  @Get('shop')
  shop(@UserId() userId: string, @Query('today') today: string) {
    parseDay(today);
    return this.game.shop(userId, today);
  }

  @Post('buy')
  @HttpCode(200)
  buy(@UserId() userId: string, @Body() dto: BuyDto) {
    return this.game.buy(userId, dto.itemId, dto.today.slice(0, 10));
  }

  @Post('equip')
  @HttpCode(200)
  equip(@UserId() userId: string, @Body() dto: EquipDto) {
    return this.game.equip(userId, dto.itemId, dto.equipped);
  }

  @Get('achievements')
  achievements(@UserId() userId: string) {
    return this.game.achievements(userId);
  }

  @Post('achievements/seen')
  @HttpCode(200)
  async seen(@UserId() userId: string, @Body() dto: SeenDto) {
    await this.game.markSeen(userId, dto.keys);
    return { ok: true };
  }
}
