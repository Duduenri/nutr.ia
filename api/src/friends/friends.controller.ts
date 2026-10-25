import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsString, Length } from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { CHEER_EMOJIS, FriendsService } from './friends.service';

class RequestDto {
  @IsString()
  @Length(6, 6, { message: 'O código tem 6 letras/números' })
  code!: string;
}

class SettingsDto {
  @IsBoolean()
  shareWeight!: boolean;
}

class CheerDto {
  @IsIn(CHEER_EMOJIS)
  emoji!: string;
}

@Controller('friends')
@UseGuards(AuthGuard)
export class FriendsController {
  constructor(
    private readonly friends: FriendsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  overview(@UserId() userId: string, @Query('today') today: string) {
    parseDay(today);
    return this.friends.overview(userId, today);
  }

  @Post('request')
  @HttpCode(200)
  request(@UserId() userId: string, @Body() dto: RequestDto) {
    return this.friends.request(userId, dto.code);
  }

  @Post(':id/accept')
  @HttpCode(200)
  async accept(@UserId() userId: string, @Param('id') id: string) {
    await this.friends.accept(userId, id);
    return { ok: true };
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    await this.friends.remove(userId, id);
    return { ok: true };
  }

  @Patch('settings')
  async settings(@UserId() userId: string, @Body() dto: SettingsDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { shareWeight: dto.shareWeight },
    });
    return { shareWeight: dto.shareWeight };
  }

  @Post(':id/cheer')
  @HttpCode(200)
  async cheer(
    @UserId() userId: string,
    @Param('id') toId: string,
    @Body() dto: CheerDto,
  ) {
    await this.friends.cheer(userId, toId, dto.emoji);
    return { ok: true };
  }

  @Post('cheers/seen')
  @HttpCode(200)
  async seen(@UserId() userId: string) {
    await this.prisma.cheer.updateMany({
      where: { toId: userId, seen: false },
      data: { seen: true },
    });
    return { ok: true };
  }
}
