import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { requireEnv } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PhotosService {
  private readonly dir = requireEnv('UPLOAD_DIR');

  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, input: Buffer) {
    const jpeg = await sharp(input)
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const photo = await this.prisma.photo.create({
      data: { userId, path: '' },
    });
    const relative = join(userId, `${photo.id}.jpg`);
    await mkdir(join(this.dir, userId), { recursive: true });
    await writeFile(join(this.dir, relative), jpeg);
    await this.prisma.photo.update({
      where: { id: photo.id },
      data: { path: relative },
    });
    return { id: photo.id, jpeg };
  }

  async filePath(userId: string, id: string) {
    const photo = await this.prisma.photo.findFirst({ where: { id, userId } });
    if (!photo?.path) {
      throw new NotFoundException();
    }
    return join(this.dir, photo.path);
  }

  async remove(userId: string, id: string) {
    const photo = await this.prisma.photo.findFirst({ where: { id, userId } });
    if (!photo) {
      throw new NotFoundException();
    }
    await this.prisma.photo.delete({ where: { id } });
    if (photo.path) {
      await unlink(join(this.dir, photo.path)).catch(() => undefined);
    }
  }
}
