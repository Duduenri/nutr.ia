import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { ChallengesService } from './challenges.service';

class CreateChallengeDto {
  @IsString()
  toId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsInt()
  @Min(10)
  @Max(1000)
  stake!: number;

  @IsDateString()
  deadline!: string;
}

class CompleteDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  proof?: string;
}

@Controller('challenges')
@UseGuards(AuthGuard)
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.challenges.list(userId);
  }

  @Post()
  async create(@UserId() userId: string, @Body() dto: CreateChallengeDto) {
    const c = await this.challenges.create(userId, {
      ...dto,
      deadline: new Date(dto.deadline),
    });
    return { id: c.id };
  }

  @Post(':id/accept')
  @HttpCode(200)
  async accept(@UserId() userId: string, @Param('id') id: string) {
    await this.challenges.accept(userId, id);
    return { ok: true };
  }

  @Post(':id/decline')
  @HttpCode(200)
  async decline(@UserId() userId: string, @Param('id') id: string) {
    await this.challenges.decline(userId, id);
    return { ok: true };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@UserId() userId: string, @Param('id') id: string) {
    await this.challenges.cancel(userId, id);
    return { ok: true };
  }

  @Post(':id/complete')
  @HttpCode(200)
  async complete(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CompleteDto,
  ) {
    await this.challenges.complete(userId, id, dto.proof);
    return { ok: true };
  }

  @Post(':id/give-up')
  @HttpCode(200)
  async giveUp(@UserId() userId: string, @Param('id') id: string) {
    await this.challenges.giveUp(userId, id);
    return { ok: true };
  }
}
