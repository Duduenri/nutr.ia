import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { addDays, formatDay, parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { guideFor } from './bari-guide';
import { ExamsService } from './exams.service';

const MAX_FILE = 25 * 1024 * 1024;

class UploadDto {
  @IsDateString()
  today!: string;
}

class DocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

@Controller()
@UseGuards(AuthGuard)
export class ExamsController {
  constructor(
    private readonly exams: ExamsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('exams')
  overview(@UserId() userId: string) {
    return this.exams.overview(userId);
  }

  @Post('exams')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE } }))
  upload(
    @UserId() userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDto,
  ) {
    if (
      !file ||
      !(
        file.mimetype === 'application/pdf' ||
        file.mimetype.startsWith('image/')
      )
    ) {
      throw new BadRequestException('Envie o PDF ou uma foto do laudo');
    }
    return this.exams.upload(
      userId,
      file.buffer,
      file.mimetype,
      dto.today.slice(0, 10),
    );
  }

  @Get('exams/:id/file')
  async file(
    @UserId() userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(await this.exams.filePath(userId, id));
  }

  @Delete('exams/:id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    await this.exams.remove(userId, id);
    return { ok: true };
  }

  @Get('documents')
  documents(@UserId() userId: string) {
    return this.prisma.userDocument.findMany({
      where: { userId },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 60 * 1024 * 1024 } }),
  )
  addDocument(
    @UserId() userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: DocumentDto,
  ) {
    if (file?.mimetype !== 'application/pdf') {
      throw new BadRequestException('Envie um PDF');
    }
    const title = dto.title?.trim() || file.originalname.replace(/\.pdf$/i, '');
    return this.exams.addDocument(userId, title, file.buffer);
  }

  @Delete('documents/:id')
  async removeDocument(@UserId() userId: string, @Param('id') id: string) {
    await this.prisma.userDocument.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  @Get('bari/guide')
  async guide(@UserId() userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      surgeryType: user.surgeryType,
      items: guideFor(user.surgeryType),
    };
  }

  @Get('bari/month')
  async month(
    @UserId() userId: string,
    @Query('month') month: string,
    @Query('today') today: string,
  ) {
    if (!/^\d{4}-\d{2}$/.test(month ?? '')) {
      throw new BadRequestException('Mês inválido, use AAAA-MM');
    }
    const start = parseDay(`${month}-01`);
    const lastOfMonth = addDays(
      new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)),
      -1,
    );
    const end = parseDay(today) < lastOfMonth ? parseDay(today) : lastOfMonth;
    const range = { gte: start, lte: end };
    const [user, supplements, logs, protein] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.supplement.findMany({ where: { userId } }),
      this.prisma.supplementLog.findMany({ where: { userId, date: range } }),
      this.prisma.mealEntry.groupBy({
        by: ['date'],
        where: { userId, date: range },
        _sum: { protein: true },
      }),
    ]);
    const proteinTarget = user.proteinTarget ?? 60;
    const proteinByDay = new Map(
      protein.map((p) => [formatDay(p.date), p._sum.protein ?? 0]),
    );
    const days: {
      date: string;
      dosesTaken: number;
      dosesExpected: number;
      protein: number;
      proteinTarget: number;
      supplementsOk: boolean;
      proteinOk: boolean;
    }[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = formatDay(d);
      const active = supplements.filter((s) => formatDay(s.createdAt) <= key);
      const expected = active.reduce((sum, s) => sum + s.timesPerDay, 0);
      const taken = active.reduce(
        (sum, s) =>
          sum +
          Math.min(
            s.timesPerDay,
            logs.filter(
              (l) => l.supplementId === s.id && formatDay(l.date) === key,
            ).length,
          ),
        0,
      );
      const p = Math.round(proteinByDay.get(key) ?? 0);
      days.push({
        date: key,
        dosesTaken: taken,
        dosesExpected: expected,
        protein: p,
        proteinTarget,
        supplementsOk: expected > 0 && taken >= expected,
        proteinOk: p >= proteinTarget,
      });
    }
    return {
      month,
      days,
      summary: {
        days: days.length,
        supplementsOk: days.filter((d) => d.supplementsOk).length,
        proteinOk: days.filter((d) => d.proteinOk).length,
        bothOk: days.filter((d) => d.supplementsOk && d.proteinOk).length,
      },
    };
  }
}
