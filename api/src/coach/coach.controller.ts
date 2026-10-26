import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  UnprocessableEntityException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { Prisma } from '@prisma/client';
import {
  AiService,
  type ChatTurn,
  type WorkoutStructure,
} from '../ai/ai.service';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { PhotosService } from '../photos/photos.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserContextService } from './user-context.service';

class MessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

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
    private readonly photos: PhotosService,
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
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async send(
    @UserId() userId: string,
    @Body() dto: MessageDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const content = dto.content?.trim() ?? '';
    if (file && !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Envie uma foto');
    }
    if (!content && !file) {
      throw new BadRequestException('Escreva uma mensagem ou mande uma foto');
    }
    const photo = file ? await this.photos.save(userId, file.buffer) : null;
    const sent = await this.prisma.chatMessage.create({
      data: { userId, role: 'USER', content, photoId: photo?.id },
    });
    const recent = await this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const history: ChatTurn[] = recent.reverse().map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content:
        m.photoId && m.id !== sent.id
          ? `[mandei uma foto] ${m.content}`.trim()
          : m.content,
      imageBase64:
        m.id === sent.id ? photo?.jpeg.toString('base64') : undefined,
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
    const withPhotos = await this.prisma.chatMessage.findMany({
      where: { userId, photoId: { not: null } },
      select: { photoId: true },
    });
    await this.prisma.chatMessage.deleteMany({ where: { userId } });
    for (const { photoId } of withPhotos) {
      await this.photos.remove(userId, photoId!).catch(() => undefined);
    }
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
    const revised = await this.ai.revisePlan(
      await this.userContext.build(userId, dto.today),
      plan.content,
      dto.request,
      plan.kind,
    );
    if (revised.plan.trim().length < plan.content.length * 0.3) {
      throw new UnprocessableEntityException(
        'O ajuste veio incompleto, então mantive seu plano. Tente pedir de outro jeito.',
      );
    }
    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        content: revised.plan,
        previous: plan.content,
        structure: Prisma.JsonNull,
      },
    });
    return { ...updated, note: revised.note.trim() || null };
  }

  @Post('plans/:id/undo')
  @HttpCode(200)
  async undoPlan(@UserId() userId: string, @Param('id') id: string) {
    const plan = await this.prisma.plan.findFirst({ where: { id, userId } });
    if (!plan?.previous) {
      throw new NotFoundException('Não há versão anterior desse plano');
    }
    return this.prisma.plan.update({
      where: { id },
      data: {
        content: plan.previous,
        previous: plan.content,
        structure: Prisma.JsonNull,
      },
    });
  }

  @Get('workout-plans')
  async workoutPlans(@UserId() userId: string, @Query('id') id?: string) {
    const plans = await this.prisma.plan.findMany({
      where: { userId, kind: 'workout' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const plan = plans.find((p) => p.id === id) ?? plans[0];
    if (!plan) return { plans: [], selected: null };
    let structure = plan.structure as WorkoutStructure | null;
    if (!structure) {
      structure = await this.ai.structureWorkout(plan.content);
      await this.prisma.plan.update({
        where: { id: plan.id },
        data: { structure: structure },
      });
    }
    return {
      plans: plans.map((p) => ({
        id: p.id,
        title: p.title,
        createdAt: p.createdAt,
      })),
      selected: { id: plan.id, title: plan.title, days: structure.days },
    };
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
