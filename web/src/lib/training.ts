export const DISTANCE_SPORTS = ["Caminhada", "Corrida", "Bicicleta", "Natação"];

export const SPEED_SPORTS = ["Bicicleta"];

export function formatPace(minPerKm: number): string {
  const total = Math.round(minPerKm * 60);
  return `${Math.floor(total / 60)}'${String(total % 60).padStart(2, "0")}"/km`;
}

export function paceLabel(name: string, minutes: number, km: number): string {
  if (SPEED_SPORTS.includes(name)) {
    return `${(km / (minutes / 60)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km/h`;
  }
  return formatPace(minutes / km);
}

export function formatKm(km: number): string {
  return `${km.toLocaleString("pt-BR", { maximumFractionDigits: km < 10 ? 2 : 1 })} km`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
