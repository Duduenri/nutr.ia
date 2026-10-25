import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { getDocumentProxy, extractText } from 'unpdf';
import { AiService, LabExtraction } from '../ai/ai.service';
import { requireEnv } from '../common/env';
import { formatDay, parseDay } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { ageFrom } from '../profile/nutrition';
import { BARI_KEY_LABS } from './bari-guide';
import { cleanDocumentText, redactLabText } from './redact';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function statusFor(
  value: number,
  low: number | null,
  high: number | null,
  fallback: string,
): string {
  if (low === null && high === null) return fallback;
  if (low !== null && value < low) return 'LOW';
  if (high !== null && value > high) return 'HIGH';
  return 'NORMAL';
}

export async function pdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

@Injectable()
export class ExamsService {
  private readonly dir = resolve(requireEnv('UPLOAD_DIR'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async upload(userId: string, file: Buffer, mimetype: string, today: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const isPdf = mimetype === 'application/pdf';
    const ctx = {
      age: user.birthDate ? ageFrom(user.birthDate) : null,
      sex: user.sex,
      bariatric: user.bariatric,
      surgeryType: user.surgeryType,
    };
    let stored: Buffer = file;
    let extraction: LabExtraction;
    if (isPdf) {
      const text = redactLabText(await pdfText(file), user.name);
      extraction = await this.ai.extractLabs({ text }, ctx);
    } else {
      stored = await sharp(file)
        .rotate()
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      extraction = await this.ai.extractLabs(
        { imageBase64: stored.toString('base64') },
        ctx,
      );
    }
    return this.save(userId, extraction, stored, isPdf ? 'pdf' : 'jpg', today);
  }

  async save(
    userId: string,
    extraction: LabExtraction,
    file: Buffer | null,
    ext: string,
    today: string,
  ) {
    const collected = ISO_DAY.test(extraction.collectedAt)
      ? extraction.collectedAt
      : today;
    const exam = await this.prisma.labExam.create({
      data: {
        userId,
        collectedAt: parseDay(collected),
        title: `Exames de ${collected.split('-').reverse().join('/')}`,
      },
    });
    if (file) {
      const relative = join(userId, 'exams', `${exam.id}.${ext}`);
      await mkdir(join(this.dir, userId, 'exams'), { recursive: true });
      await writeFile(join(this.dir, relative), file);
      await this.prisma.labExam.update({
        where: { id: exam.id },
        data: { filePath: relative },
      });
    }

    let imported = 0;
    for (const r of extraction.results) {
      const code = r.code.trim().toLowerCase();
      const points = [
        { date: collected, value: r.value, current: true },
        ...r.history
          .filter((h) => ISO_DAY.test(h.date) && h.date !== collected)
          .map((h) => ({ date: h.date, value: h.value, current: false })),
      ];
      for (const p of points) {
        const data = {
          userId,
          examId: exam.id,
          date: parseDay(p.date),
          code,
          name: r.name,
          category: r.category,
          value: p.value,
          unit: r.unit,
          refLow: r.refLow,
          refHigh: r.refHigh,
          refText: r.refText || null,
          status: statusFor(
            p.value,
            r.refLow,
            r.refHigh,
            p.current ? r.status : 'UNKNOWN',
          ),
        };
        await this.prisma.labResult.upsert({
          where: {
            userId_code_date: { userId, code, date: data.date },
          },
          create: data,
          update: p.current ? data : {},
        });
        imported++;
      }
    }
    return { examId: exam.id, collectedAt: collected, imported };
  }

  async overview(userId: string) {
    const [exams, results] = await Promise.all([
      this.prisma.labExam.findMany({
        where: { userId },
        orderBy: { collectedAt: 'desc' },
        include: { _count: { select: { results: true } } },
      }),
      this.prisma.labResult.findMany({
        where: { userId },
        orderBy: { date: 'asc' },
      }),
    ]);
    const byCode = new Map<string, typeof results>();
    for (const r of results) {
      byCode.set(r.code, [...(byCode.get(r.code) ?? []), r]);
    }
    const markers = [...byCode.entries()].map(([code, list]) => {
      const latest = list[list.length - 1];
      return {
        code,
        name: latest.name,
        category: latest.category,
        unit: latest.unit,
        refLow: latest.refLow,
        refHigh: latest.refHigh,
        refText: latest.refText,
        key: BARI_KEY_LABS.includes(code),
        latest: {
          date: formatDay(latest.date),
          value: latest.value,
          status: latest.status,
        },
        history: list.map((r) => ({
          date: formatDay(r.date),
          value: r.value,
          status: r.status,
        })),
      };
    });
    return {
      exams: exams.map((e) => ({
        id: e.id,
        title: e.title,
        collectedAt: formatDay(e.collectedAt),
        results: e._count.results,
        hasFile: Boolean(e.filePath),
      })),
      markers,
    };
  }

  async filePath(userId: string, id: string) {
    const exam = await this.prisma.labExam.findFirst({ where: { id, userId } });
    if (!exam?.filePath) throw new NotFoundException();
    return join(this.dir, exam.filePath);
  }

  async remove(userId: string, id: string) {
    const exam = await this.prisma.labExam.findFirst({ where: { id, userId } });
    if (!exam) throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.labResult.deleteMany({ where: { userId, examId: id } }),
      this.prisma.labExam.delete({ where: { id } }),
    ]);
    if (exam.filePath) {
      await unlink(join(this.dir, exam.filePath)).catch(() => undefined);
    }
  }

  async addDocument(userId: string, title: string, buffer: Buffer) {
    const content = cleanDocumentText(await pdfText(buffer));
    return this.prisma.userDocument.create({
      data: { userId, title, content },
      select: { id: true, title: true, createdAt: true },
    });
  }
}
