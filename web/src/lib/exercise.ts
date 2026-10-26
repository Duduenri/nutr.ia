import { useProfile } from "./hooks";

export const EXERCISES = [
  { key: "run", label: "Corrida", emoji: "🏃‍♀️", met: 8.3, note: "8 km/h" },
  {
    key: "bike",
    label: "Bicicleta",
    emoji: "🚴‍♀️",
    met: 6.8,
    note: "ritmo moderado",
  },
  {
    key: "treadmill",
    label: "Esteira",
    emoji: "🚶‍♀️",
    met: 4.3,
    note: "caminhada a 5,6 km/h",
  },
] as const;

// MET: kcal/min = MET × 3,5 × peso(kg) / 200
export function exerciseMinutes(kcal: number, weightKg: number, met: number) {
  return Math.max(1, Math.round(kcal / ((met * 3.5 * weightKg) / 200)));
}

export function activityKcal(minutes: number, weightKg: number, met: number) {
  return Math.round((minutes * met * 3.5 * weightKg) / 200);
}

export function useWeightKg(): number {
  const { data } = useProfile();
  return data?.currentWeightKg ?? data?.startWeightKg ?? 70;
}
