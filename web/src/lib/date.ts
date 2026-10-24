export function toDayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toDayString(new Date());
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return toDayString(new Date(y, m - 1, d + delta));
}

export function dayLabel(day: string): string {
  const t = today();
  if (day === t) return "Hoje";
  if (day === shiftDay(t, -1)) return "Ontem";
  if (day === shiftDay(t, 1)) return "Amanhã";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function shortDate(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}
