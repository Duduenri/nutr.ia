import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { formatDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { PhotosService } from './photos.service';

@Controller('photos')
@UseGuards(AuthGuard)
export class PhotosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photos: PhotosService,
  ) {}

  @Get()
  async list(@UserId() userId: string, @Query('cursor') cursor?: string) {
    const photos = await this.prisma.photo.findMany({
      where: { userId, path: { not: '' }, chatMessages: { none: {} } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        entries: {
          select: { name: true, kcal: true, meal: true, date: true },
        },
      },
    });
    return photos.map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      url: `/api/photos/${p.id}/file`,
      date: p.entries[0] ? formatDay(p.entries[0].date) : null,
      meal: p.entries[0]?.meal ?? null,
      kcal: Math.round(p.entries.reduce((sum, e) => sum + e.kcal, 0)),
      items: p.entries.map((e) => e.name),
    }));
  }

  @Get(':id/file')
  async file(
    @UserId() userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const path = await this.photos.filePath(userId, id);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(path);
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    await this.photos.remove(userId, id);
    return { ok: true };
  }
}
