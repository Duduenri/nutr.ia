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
  Patch,
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
  IsBoolean,
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
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { requireEnv } from '../common/env';
import { formatDay } from '../common/date';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { PhotosService } from '../photos/photos.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserContextService } from './user-context.service';

type TargetKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'waterMl';

const TARGET_LIMITS: Record<TargetKey, [number, number]> = {
  kcal: [1200, 6000],
  protein: [20, 400],
  carbs: [20, 900],
  fat: [20, 300],
  fiber: [5, 80],
  waterMl: [500, 6000],
};

function validTargets(
  raw: Partial<Record<TargetKey, number | null>>,
): Partial<Record<TargetKey, number>> | null {
  const out: Partial<Record<TargetKey, number>> = {};
  for (const [key, [min, max]] of Object.entries(TARGET_LIMITS) as [
    TargetKey,
    [number, number],
  ][]) {
    const v = raw[key];
    if (typeof v === 'number' && v >= min && v <= max) {
      out[key] = Math.round(v);
    }
  }
  return Object.keys(out).length ? out : null;
}

const PROGRESS_WORDS =
  /foto|evolu|progresso|f[íi]sico|shape|corpo|antes e depois|defini[çc][ãa]o|m[úu]sculo|barriga/i;

class ProposalDto {
  @IsBoolean()
  accept!: boolean;
}

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

class RenamePlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;
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

  private readonly uploadDir = resolve(requireEnv('UPLOAD_DIR'));

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
    if (PROGRESS_WORDS.test(content)) {
      const attached = await this.progressPhotos(userId);
      if (attached.images.length) {
        const last = history[history.length - 1];
        last.images = attached.images;
        last.content = `[Anexei minhas fotos de progresso do perfil, em ordem: ${attached.dates.join(', ')}] ${last.content}`;
      }
    }
    const { reply, targets } = await this.ai.coachReply(
      await this.userContext.build(userId, dto.today),
      history,
    );
    const proposal = targets ? validTargets(targets) : null;
    return this.prisma.chatMessage.create({
      data: {
        userId,
        role: 'ASSISTANT',
        content: reply,
        ...(proposal
          ? {
              proposal: proposal,
              proposalState: 'pending',
            }
          : {}),
      },
    });
  }

  private async progressPhotos(userId: string) {
    const all = await this.prisma.progressPhoto.findMany({
      where: { userId, path: { not: '' } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    const chosen = all.length <= 4 ? all : [all[0], ...all.slice(-3)];
    const images: string[] = [];
    const dates: string[] = [];
    for (const p of chosen) {
      try {
        const buf = await readFile(join(this.uploadDir, p.path));
        images.push(buf.toString('base64'));
        dates.push(formatDay(p.date));
      } catch {
        continue;
      }
    }
    return { images, dates };
  }

  @Post('messages/:id/proposal')
  @HttpCode(200)
  async answerProposal(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: ProposalDto,
  ) {
    const message = await this.prisma.chatMessage.findFirst({
      where: { id, userId, proposalState: 'pending' },
    });
    if (!message?.proposal) {
      throw new NotFoundException('Essa sugestão já foi respondida');
    }
    if (dto.accept) {
      const t = message.proposal as Partial<Record<TargetKey, number>>;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          kcalTarget: t.kcal,
          proteinTarget: t.protein,
          carbsTarget: t.carbs,
          fatTarget: t.fat,
          fiberTarget: t.fiber,
          waterTargetMl: t.waterMl,
        },
      });
    }
    return this.prisma.chatMessage.update({
      where: { id },
      data: { proposalState: dto.accept ? 'applied' : 'dismissed' },
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

  @Patch('plans/:id')
  async renamePlan(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: RenamePlanDto,
  ) {
    const plan = await this.prisma.plan.findFirst({ where: { id, userId } });
    if (!plan) throw new NotFoundException();
    return this.prisma.plan.update({
      where: { id },
      data: { title: dto.title.trim() },
    });
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
