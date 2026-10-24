import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  ValidateNested,
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

class QuestionsDto {
  @IsIn(Object.keys(PLAN_PROMPTS))
  kind!: PlanKind;

  @IsDateString()
  today!: string;
}

class AnswerDto {
  @IsString()
  @MaxLength(300)
  question!: string;

  @IsString()
  @MaxLength(1000)
  answer!: string;
}

class PlanDto extends QuestionsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers?: AnswerDto[];
}

class ReviseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  request!: string;

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
    const answers = (dto.answers ?? []).filter((a) => a.answer.trim());
    const prompt = answers.length
      ? `${spec.prompt}\n\nMinhas respostas para personalizar (use prioritariamente o que eu tenho em casa):\n${answers.map((a) => `- ${a.question} ${a.answer}`).join('\n')}`
      : spec.prompt;
    const content = await this.ai.chat(
      await this.userContext.build(userId, dto.today),
      [{ role: 'user', content: prompt }],
    );
    return this.prisma.plan.create({
      data: { userId, kind: dto.kind, title: spec.title, content },
    });
  }

  @Post('plans/questions')
  @HttpCode(200)
  async questions(@UserId() userId: string, @Body() dto: QuestionsDto) {
    return this.ai.planQuestions(
      await this.userContext.build(userId, dto.today),
      dto.kind,
    );
  }

  @Post('plans/:id/revise')
  @HttpCode(200)
  async revisePlan(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: ReviseDto,
  ) {
    const plan = await this.prisma.plan.findFirst({ where: { id, userId } });
    if (!plan) {
      throw new NotFoundException();
    }
    const content = await this.ai.revisePlan(
      await this.userContext.build(userId, dto.today),
      plan.content,
      dto.request,
    );
    return this.prisma.plan.update({ where: { id }, data: { content } });
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
