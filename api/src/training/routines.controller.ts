import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Plan, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import { AiService, type WorkoutStructure } from '../ai/ai.service';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

class RoutineExerciseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  sets!: number;

  @IsString()
  @MaxLength(30)
  reps!: string;

  @IsInt()
  @Min(1)
  @Max(200)
  repsTarget!: number;
}

class RoutineDayDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label!: string;

  @IsString()
  @MaxLength(60)
  focus!: string;

  @IsOptional()
  @IsIn(WEEKDAYS)
  weekday?: (typeof WEEKDAYS)[number] | null;

  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => RoutineExerciseDto)
  exercises!: RoutineExerciseDto[];
}

class SaveRoutineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => RoutineDayDto)
  days!: RoutineDayDto[];
}

class CreateRoutineDto {
  @IsOptional()
  @IsString()
  planId?: string;
}

function fromStructure(structure: WorkoutStructure) {
  return structure.days.map((d) => ({
    label: d.label,
    focus: d.focus,
    weekday: d.weekday,
    exercises: d.exercises.map((e) => ({
      name: e.name,
      sets: Math.min(10, Math.max(1, Math.round(e.sets) || 3)),
      reps: e.reps,
      repsTarget: Math.min(200, Math.max(1, Math.round(e.repsTarget) || 10)),
    })),
  }));
}

@Controller('routines')
@UseGuards(AuthGuard)
export class RoutinesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  @Get()
  async list(@UserId() userId: string) {
    const routines = await this.prisma.workoutRoutine.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    if (routines.length) return routines;
    const plan = await this.prisma.plan.findFirst({
      where: { userId, kind: 'workout', structure: { not: Prisma.DbNull } },
      orderBy: { createdAt: 'desc' },
    });
    if (!plan) return [];
    return [await this.fromPlan(userId, plan)];
  }

  @Post()
  async create(@UserId() userId: string, @Body() dto: CreateRoutineDto) {
    if (dto.planId) {
      const plan = await this.prisma.plan.findFirst({
        where: { id: dto.planId, userId, kind: 'workout' },
      });
      if (!plan) throw new NotFoundException('Plano de treino não encontrado');
      return this.fromPlan(userId, plan);
    }
    return this.prisma.workoutRoutine.create({
      data: {
        userId,
        name: 'Minha rotina',
        days: [{ label: 'Treino A', focus: '', weekday: null, exercises: [] }],
      },
    });
  }

  @Put(':id')
  async save(
    @UserId() userId: string,
    @Param('id') id: string,
    @Body() dto: SaveRoutineDto,
  ) {
    await this.own(userId, id);
    return this.prisma.workoutRoutine.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        days: dto.days.map((d) => ({
          label: d.label.trim(),
          focus: d.focus.trim(),
          weekday: d.weekday ?? null,
          exercises: d.exercises.map((e) => ({
            name: e.name.trim(),
            sets: e.sets,
            reps: e.reps.trim(),
            repsTarget: e.repsTarget,
          })),
        })),
      },
    });
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    await this.own(userId, id);
    await this.prisma.workoutRoutine.delete({ where: { id } });
    return { ok: true };
  }

  private async fromPlan(userId: string, plan: Plan) {
    let structure = plan.structure as WorkoutStructure | null;
    if (!structure) {
      structure = await this.ai.structureWorkout(plan.content);
      await this.prisma.plan.update({
        where: { id: plan.id },
        data: { structure: structure },
      });
    }
    return this.prisma.workoutRoutine.create({
      data: {
        userId,
        name: plan.title,
        days: fromStructure(structure),
      },
    });
  }

  private async own(userId: string, id: string) {
    const row = await this.prisma.workoutRoutine.findFirst({
      where: { id, userId },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
}
