import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsDateString,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AiService, type ChatTurn } from '../ai/ai.service';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UserContextService } from './user-context.service';

class MessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @IsDateString()
  today!: string;
}

const PLAN_PROMPTS = {
  diet: {
    title: 'Plano alimentar',
    prompt:
      'Monte um plano alimentar de 1 dia para mim (café, almoço, lanche, jantar) batendo minhas metas de calorias e proteína, com comidas brasileiras simples e baratas. Dê quantidades em gramas/medidas caseiras e kcal/proteína de cada refeição. No fim, 2 opções de substituição para cada refeição.',
  },
  workout: {
    title: 'Plano de treino',
    prompt:
      'Monte um plano de treino semanal para mim alinhado ao meu objetivo, que dê para fazer em casa ou academia (indique as duas opções quando fizer sentido). Para cada dia: exercícios, séries, repetições e descanso. Inclua aquecimento e dicas de progressão.',
  },
} as const;

type PlanKind = keyof typeof PLAN_PROMPTS;

class PlanDto {
  @IsIn(Object.keys(PLAN_PROMPTS))
  kind!: PlanKind;

  @IsDateString()
  today!: string;
}

@Controller('coach')
@UseGuards(AuthGuard)
export class CoachController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly userContext: UserContextService,
  ) {}

  @Get('messages')
  async messages(@UserId() userId: string) {
    const messages = await this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return messages.reverse();
  }

  @Post('messages')
  async send(@UserId() userId: string, @Body() dto: MessageDto) {
    await this.prisma.chatMessage.create({
      data: { userId, role: 'USER', content: dto.content },
    });
    const recent = await this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const history: ChatTurn[] = recent.reverse().map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content,
    }));
    while (history.length && history[0].role !== 'user') {
      history.shift();
    }
    const reply = await this.ai.chat(
      await this.userContext.build(userId, dto.today),
      history,
    );
    return this.prisma.chatMessage.create({
      data: { userId, role: 'ASSISTANT', content: reply },
    });
  }

  @Delete('messages')
  async clear(@UserId() userId: string) {
    await this.prisma.chatMessage.deleteMany({ where: { userId } });
    return { ok: true };
  }

  @Get('plans')
  plans(@UserId() userId: string) {
    return this.prisma.plan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  @Post('plans')
  async createPlan(@UserId() userId: string, @Body() dto: PlanDto) {
    const spec = PLAN_PROMPTS[dto.kind];
    const content = await this.ai.chat(
      await this.userContext.build(userId, dto.today),
      [{ role: 'user', content: spec.prompt }],
    );
    return this.prisma.plan.create({
      data: { userId, kind: dto.kind, title: spec.title, content },
    });
  }

  @Delete('plans/:id')
  async deletePlan(@UserId() userId: string, @Param('id') id: string) {
    const plan = await this.prisma.plan.findFirst({ where: { id, userId } });
    if (!plan) {
      throw new NotFoundException();
    }
    await this.prisma.plan.delete({ where: { id } });
    return { ok: true };
  }
}
