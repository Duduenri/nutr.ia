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

type Muscle =
  | "Peito"
  | "Costas"
  | "Ombros"
  | "Bíceps"
  | "Tríceps"
  | "Antebraço"
  | "Quadríceps"
  | "Posterior"
  | "Glúteos"
  | "Panturrilha"
  | "Abdômen";

const EXERCISE_RULES: [RegExp, Muscle[], Muscle[]][] = [
  [
    /coice.*gl[úu]te|gl[úu]te.*coice|kickback|frog pump|extens[ãa]o de quadril/,
    ["Glúteos"],
    ["Posterior"],
  ],
  [
    /chest press|press de peito|supino m[áa]quina/,
    ["Peito"],
    ["Tríceps", "Ombros"],
  ],
  [/dead bug|bird dog|hollow|abdominal|crunch|canivete/, ["Abdômen"], []],
  [/^leg\b|\bleg\b(?! curl)/, ["Quadríceps"], ["Glúteos"]],
  [
    /crucifixo invertido|face pull|voador invertido|posterior de ombro/,
    ["Ombros"],
    ["Costas"],
  ],
  [/encolhimento/, ["Costas"], ["Ombros"]],
  [/desenvolvimento|arnold|militar/, ["Ombros"], ["Tríceps"]],
  [/eleva[çc][ãa]o (lateral|frontal)/, ["Ombros"], []],
  [/supino inclinado/, ["Peito"], ["Ombros", "Tríceps"]],
  [/supino|peck|voador|crossover|cross over/, ["Peito"], ["Tríceps", "Ombros"]],
  [/crucifixo/, ["Peito"], ["Ombros"]],
  [/flex[ãa]o/, ["Peito"], ["Tríceps", "Ombros", "Abdômen"]],
  [/pullover/, ["Costas"], ["Peito"]],
  [/puxada|pulldown|pull down|barra fixa/, ["Costas"], ["Bíceps", "Antebraço"]],
  [/remada|serrote/, ["Costas"], ["Bíceps", "Ombros", "Antebraço"]],
  [
    /rosca (inversa|reversa|de punho|punho)|punho|antebra[çc]o|wrist/,
    ["Antebraço"],
    ["Bíceps"],
  ],
  [/farmer/, ["Antebraço"], ["Costas", "Abdômen"]],
  [/mergulho/, ["Tríceps"], ["Peito", "Ombros"]],
  [/tr[íi]ceps|franc[êe]s|testa|coice/, ["Tríceps"], []],
  [/rosca martelo/, ["Bíceps"], ["Antebraço"]],
  [/b[íi]ceps|rosca/, ["Bíceps"], ["Antebraço"]],
  [/panturrilha|g[êe]meos|s[óo]leo/, ["Panturrilha"], []],
  [/hip thrust|eleva[çc][ãa]o p[ée]lvica|ponte/, ["Glúteos"], ["Posterior"]],
  [/abdu[çc]|abdutora|kickback|gl[úu]te/, ["Glúteos"], []],
  [/stiff|terra romeno|good morning/, ["Posterior"], ["Glúteos", "Costas"]],
  [/terra/, ["Posterior", "Glúteos", "Costas"], ["Quadríceps", "Antebraço"]],
  [/flexora|nordic|posterior/, ["Posterior"], ["Panturrilha"]],
  [
    /afundo|b[úu]lgaro|passada|avan[çc]o|recuo/,
    ["Quadríceps", "Glúteos"],
    ["Posterior"],
  ],
  [/agachamento|squat/, ["Quadríceps"], ["Glúteos", "Posterior", "Abdômen"]],
  [/leg press|hack/, ["Quadríceps"], ["Glúteos"]],
  [/extensora|sissy|adu[çc]|adutora/, ["Quadríceps"], []],
  [/lombar|hiperextens/, ["Costas"], ["Glúteos", "Posterior"]],
  [/prancha|abdominal|abd[ôo]men|crunch|infra|obl[íi]quo/, ["Abdômen"], []],
];

export function exerciseMuscles(name: string): {
  primary: Muscle[];
  secondary: Muscle[];
} {
  const n = name.toLowerCase();
  const rule = EXERCISE_RULES.find(([re]) => re.test(n));
  return rule
    ? { primary: rule[1], secondary: rule[2] }
    : { primary: [], secondary: [] };
}

export const MUSCLE_ORDER = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Antebraço",
  "Quadríceps",
  "Posterior",
  "Glúteos",
  "Panturrilha",
  "Abdômen",
  "Outros",
];

export function muscleGroup(name: string): string {
  return exerciseMuscles(name).primary[0] ?? "Outros";
}
