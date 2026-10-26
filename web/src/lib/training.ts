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

export const STRENGTH_SPORTS = ["Musculação", "Funcional"];

export interface Exercise {
  name: string;
  sets: { reps: number; kg: number }[];
}

export function exerciseSummary(e: Exercise): string {
  const kg = (v: number) =>
    v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const same = e.sets.every(
    (s) => s.reps === e.sets[0].reps && s.kg === e.sets[0].kg,
  );
  if (same) {
    const s = e.sets[0];
    return `${e.name} ${e.sets.length}×${s.reps}${s.kg ? ` · ${kg(s.kg)} kg` : ""}`;
  }
  return `${e.name} ${e.sets.map((s) => `${s.reps}×${kg(s.kg)}`).join(", ")} kg`;
}

export interface ExerciseDraft {
  name: string;
  sets: { reps: string; kg: string }[];
}

const num = (v: string) => parseFloat(v.replace(",", ".")) || 0;

export function toDraft(list: Exercise[]): ExerciseDraft[] {
  return list.map((e) => ({
    name: e.name,
    sets: e.sets.map((s) => ({ reps: String(s.reps), kg: String(s.kg) })),
  }));
}

export function fromDraft(list: ExerciseDraft[]): Exercise[] {
  return list
    .map((e) => ({
      name: e.name.trim(),
      sets: e.sets
        .filter((s) => num(s.reps) > 0)
        .map((s) => ({ reps: Math.round(num(s.reps)), kg: num(s.kg) })),
    }))
    .filter((e) => e.name && e.sets.length);
}

const MUSCLE_RULES: [string, RegExp][] = [
  [
    "Ombros",
    /crucifixo invertido|face pull|desenvolvimento|eleva[çc][ãa]o (lateral|frontal)|encolhimento|arnold/,
  ],
  [
    "Pernas",
    /hip thrust|agachamento|leg press|extensora|flexora|stiff|afundo|passada|panturrilha|eleva[çc][ãa]o p[ée]lvica|gl[úu]teo|abdu[çc]|adu[çc]|hack|b[úu]lgaro|terra|cadeira|mesa/,
  ],
  ["Tríceps", /tr[íi]ceps|franc[êe]s|mergulho|testa|coice/],
  ["Bíceps", /b[íi]ceps|rosca/],
  ["Peito", /supino|crucifixo|peck|voador|flex[ãa]o|crossover|cross over/],
  [
    "Costas",
    /puxada|remada|pulldown|pull down|barra fixa|pullover|serrote|lombar/,
  ],
  ["Abdômen", /prancha|abdominal|abd[ôo]men|crunch|infra|obl[íi]quo/],
];

export const MUSCLE_ORDER = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Pernas",
  "Abdômen",
  "Outros",
];

export function muscleGroup(name: string): string {
  const n = name.toLowerCase();
  return MUSCLE_RULES.find(([, re]) => re.test(n))?.[0] ?? "Outros";
}
