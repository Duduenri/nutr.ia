import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { formatDay, parseDay } from '../common/date';
import { requireEnv } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';

const FIELDS = [
  'waistCm',
  'hipCm',
  'chestCm',
  'armCm',
  'thighCm',
  'bodyFatPct',
] as const;

class MeasureDto {
  @IsDateString()
  date!: string;

  @IsOptional() @IsNumber() @Min(20) @Max(250) waistCm?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(250) hipCm?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(250) chestCm?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(100) armCm?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(150) thighCm?: number;
  @IsOptional() @IsNumber() @Min(2) @Max(70) bodyFatPct?: number;
}

class PhotoDto {
  @IsDateString()
  date!: string;
}

@Controller('body')
@UseGuards(AuthGuard)
export class BodyController {
  private readonly dir = resolve(requireEnv('UPLOAD_DIR'));

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async overview(@UserId() userId: string) {
    const [measures, photos] = await Promise.all([
      this.prisma.bodyMeasure.findMany({
        where: { userId },
        orderBy: { date: 'asc' },
      }),
      this.prisma.progressPhoto.findMany({
        where: { userId },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    return {
      measures: measures.map((m) => ({
        id: m.id,
        date: formatDay(m.date),
        ...Object.fromEntries(FIELDS.map((f) => [f, m[f]])),
      })),
      photos: photos.map((p) => ({
        id: p.id,
        date: formatDay(p.date),
        url: `/api/body/photos/${p.id}/file`,
      })),
    };
  }

  @Put('measures')
  async saveMeasures(@UserId() userId: string, @Body() dto: MeasureDto) {
    const values = Object.fromEntries(FIELDS.map((f) => [f, dto[f] ?? null]));
    if (FIELDS.every((f) => values[f] === null)) {
      throw new BadRequestException('Preencha pelo menos uma medida');
    }
    const date = parseDay(dto.date.slice(0, 10));
    await this.prisma.bodyMeasure.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...values },
      update: values,
    });
    return { ok: true };
  }

  @Delete('measures/:id')
  async removeMeasure(@UserId() userId: string, @Param('id') id: string) {
    const { count } = await this.prisma.bodyMeasure.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException();
    return { ok: true };
  }

  @Post('photos')
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  async addPhoto(
    @UserId() userId: string,
    @Body() dto: PhotoDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.mimetype.startsWith('image/')) {
      throw new BadRequestException('Envie uma foto');
    }
    const jpeg = await sharp(file.buffer)
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const photo = await this.prisma.progressPhoto.create({
      data: { userId, date: parseDay(dto.date.slice(0, 10)), path: '' },
    });
    const relative = join(userId, `progress-${photo.id}.jpg`);
    await mkdir(join(this.dir, userId), { recursive: true });
    await writeFile(join(this.dir, relative), jpeg);
    await this.prisma.progressPhoto.update({
      where: { id: photo.id },
      data: { path: relative },
    });
    return { id: photo.id };
  }

  @Get('photos/:id/file')
  async photoFile(
    @UserId() userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const photo = await this.prisma.progressPhoto.findFirst({
      where: { id, userId },
    });
    if (!photo?.path) throw new NotFoundException();
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(join(this.dir, photo.path));
  }

  @Delete('photos/:id')
  async removePhoto(@UserId() userId: string, @Param('id') id: string) {
    const photo = await this.prisma.progressPhoto.findFirst({
      where: { id, userId },
    });
    if (!photo) throw new NotFoundException();
    await this.prisma.progressPhoto.delete({ where: { id } });
    if (photo.path) {
      await unlink(join(this.dir, photo.path)).catch(() => undefined);
    }
    return { ok: true };
  }
}
