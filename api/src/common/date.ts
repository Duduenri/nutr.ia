import { BadRequestException } from '@nestjs/common';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(value: string): Date {
  if (!DATE_RE.test(value)) {
    throw new BadRequestException('Data inválida, use AAAA-MM-DD');
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
