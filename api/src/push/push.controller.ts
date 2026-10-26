import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

class KeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

class SubscribeDto {
  @IsUrl({ require_tld: false })
  endpoint!: string;

  @ValidateNested()
  @Type(() => KeysDto)
  keys!: KeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

class WaterReminderDto {
  @IsBoolean()
  enabled!: boolean;

  @Matches(TIME)
  start!: string;

  @Matches(TIME)
  end!: string;

  @IsInt()
  @Min(30)
  @Max(240)
  every!: number;
}

class MealRemindersDto {
  @IsBoolean()
  enabled!: boolean;
}

class UnsubscribeDto {
  @IsString()
  endpoint!: string;
}

@Controller('push')
@UseGuards(AuthGuard)
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('key')
  key() {
    return { publicKey: this.push.publicKey };
  }

  @Get('status')
  async status(@UserId() userId: string) {
    const count = await this.prisma.pushSubscription.count({
      where: { userId },
    });
    return { subscribed: count > 0 };
  }

  @Post('subscribe')
  @HttpCode(200)
  async subscribe(@UserId() userId: string, @Body() dto: SubscribeDto) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: { userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
    });
    if (dto.timezone) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { timezone: dto.timezone },
      });
    }
    return { ok: true };
  }

  @Delete('subscribe')
  async unsubscribe(@UserId() userId: string, @Body() dto: UnsubscribeDto) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint: dto.endpoint },
    });
    return { ok: true };
  }

  @Get('water')
  async water(@UserId() userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      enabled: u.waterReminder,
      start: u.waterReminderStart,
      end: u.waterReminderEnd,
      every: u.waterReminderEvery,
    };
  }

  @Patch('water')
  async setWater(@UserId() userId: string, @Body() dto: WaterReminderDto) {
    if (dto.start >= dto.end) {
      throw new BadRequestException('O início precisa ser antes do fim');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        waterReminder: dto.enabled,
        waterReminderStart: dto.start,
        waterReminderEnd: dto.end,
        waterReminderEvery: dto.every,
      },
    });
    return dto;
  }

  @Get('meals')
  async mealReminders(@UserId() userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return { enabled: u.mealReminders };
  }

  @Patch('meals')
  async setMealReminders(
    @UserId() userId: string,
    @Body() dto: MealRemindersDto,
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mealReminders: dto.enabled },
    });
    return dto;
  }

  @Post('test')
  @HttpCode(200)
  async test(@UserId() userId: string) {
    const delivered = await this.push.send(userId, {
      title: '🔔 Lembretes ativados!',
      body: 'É assim que vou te avisar na hora de cada suplemento 💜',
      url: '/',
      tag: 'test',
    });
    return { delivered };
  }
}
