export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
export type EntrySource =
  | "PHOTO"
  | "TEXT"
  | "VOICE"
  | "BARCODE"
  | "SEARCH"
  | "MANUAL"
  | "RECIPE"
  | "FAVORITE";
export type Goal = "LOSE" | "MAINTAIN" | "GAIN";
export type Sex = "FEMALE" | "MALE";
export type SurgeryType = "BGA" | "SLEEVE" | "BYPASS" | "BPD_DS";
export type ActivityLevel =
  "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";

export type Micros = Record<string, number>;

export interface Profile {
  id: string;
  email: string;
  name: string;
  sex: Sex | null;
  birthDate: string | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  goal: Goal | null;
  startWeightKg: number | null;
  targetWeightKg: number | null;
  targetDate: string | null;
  currentWeightKg: number | null;
  fastingPlan: string | null;
  bariatric: boolean;
  surgeryDate: string | null;
  surgeryType: SurgeryType | null;
  goalPlan: GoalPlan | null;
  kcalTarget: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  fiberTarget: number | null;
  waterTargetMl: number | null;
  cupSizeMl: number;
  exerciseCredit: number;
  stepsToken: string;
  onboarded: boolean;
  createdAt: string;
}

export interface GoalPlan {
  kgToGo: number;
  daysLeft: number;
  weeklyRateKg: number;
  dailyKcalAdjust: number;
  pace: "ok" | "fast" | "too_fast" | "past" | "reached";
}

export interface Fast {
  id: string;
  startAt: string;
  endAt: string | null;
  goalHours: number;
  goalAt: string;
  hours: number;
  reached: boolean;
}

export interface FastingState {
  plan: string | null;
  active: Fast | null;
  lastEndedAt: string | null;
  lastMealAt: string | null;
  history: Fast[];
  week: { count: number; reached: number; averageHours: number | null };
}

export interface Recipe {
  id: string;
  title: string;
  emoji: string;
  meal: MealType;
  prepMinutes: number;
  servings: number;
  servingG: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: { item: string; quantity: string }[];
  steps: string[];
  tip: string | null;
  favorite: boolean;
  custom: boolean;
  createdAt: string;
}

export interface FoodItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  micros?: Micros | null;
  foodId?: string | null;
}

export interface Entry extends FoodItem {
  id: string;
  meal: MealType;
  source: EntrySource;
  photoUrl: string | null;
}

export interface Diary {
  date: string;
  targets: {
    kcal: number;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
    waterMl: number | null;
    cupSizeMl: number;
    exerciseCredit: number;
  };
  totals: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    micros: Micros;
  };
  burned: number;
  burnedCredit: number;
  steps: number;
  meals: {
    meal: MealType;
    targetKcal: number;
    kcal: number;
    yesterdayCount: number;
    entries: Entry[];
  }[];
  water: { ml: number; logs: { id: string; ml: number }[] };
  activities: {
    id: string;
    name: string;
    minutes: number;
    kcal: number;
    intensity: "LIGHT" | "MODERATE" | "VIGOROUS" | null;
    details: string | null;
    distanceKm: number | null;
    exercises: { name: string; sets: { reps: number; kg: number }[] }[] | null;
  }[];
  notes: { id: string; text: string; createdAt: string }[];
}

export interface FoodAnalysis {
  recognized: boolean;
  items: FoodItem[];
  suggestedMeal: MealType;
  confidence: "alta" | "media" | "baixa";
  comment: string;
  photoId?: string;
  photoUrl?: string;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  source: "TACO" | "OPEN_FOOD_FACTS" | "CUSTOM";
  per100g: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number | null;
    micros: Micros | null;
  };
  servingG: number | null;
}

export interface Mission {
  key: string;
  title: string;
  progress: number;
  goal: number;
  gems: number;
  claimed: boolean;
}

export interface Missions {
  streak: number;
  month: {
    title: string;
    daysLeft: number;
    progress: number;
    goal: number;
    gems: number;
    claimed: boolean;
  };
  daily: Mission[];
  weekly: Mission[];
}

export interface WeightStats {
  startKg: number | null;
  currentKg: number | null;
  targetKg: number | null;
  logs: { id: string; date: string; kg: number }[];
}

export interface NutritionStats {
  target: number;
  series: {
    date: string;
    kcal: number | null;
    protein: number | null;
    waterMl: number;
  }[];
  ratings: Record<"great" | "good" | "ok" | "bad", number>;
  macros: { protein: number; carbs: number; fat: number } | null;
  averageKcal: number | null;
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  photoId: string | null;
  previewUrl?: string;
  proposal?: TargetProposal | null;
  proposalState?: "pending" | "applied" | "dismissed" | null;
  createdAt: string;
}

export interface TargetProposal {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  waterMl?: number;
}

export interface Plan {
  id: string;
  kind: "diet" | "workout" | "recipe";
  title: string;
  content: string;
  previous: string | null;
  createdAt: string;
}

export interface PhotoItem {
  id: string;
  url: string;
  createdAt: string;
  date: string | null;
  meal: MealType | null;
  kcal: number;
  items: string[];
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: body && !isForm ? { "Content-Type": "application/json" } : {},
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message =
      res.status >= 502
        ? "O servidor está reiniciando. Tente de novo em alguns segundos."
        : "Algo deu errado";
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data.message) {
        message = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message;
      }
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

export const MEAL_LABEL: Record<MealType, string> = {
  BREAKFAST: "Café da manhã",
  LUNCH: "Almoço",
  DINNER: "Jantar",
  SNACK: "Lanche",
};

export const MEAL_EMOJI: Record<MealType, string> = {
  BREAKFAST: "☕",
  LUNCH: "🍽️",
  DINNER: "🥗",
  SNACK: "🍎",
};

export const GOAL_LABEL: Record<Goal, string> = {
  LOSE: "Perder peso",
  MAINTAIN: "Manter peso",
  GAIN: "Ganhar massa",
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  SEDENTARY: "Sedentária (pouco ou nenhum exercício)",
  LIGHT: "Leve (1–3x por semana)",
  MODERATE: "Moderada (3–5x por semana)",
  ACTIVE: "Ativa (6–7x por semana)",
  VERY_ACTIVE: "Muito ativa (treino pesado/diário)",
};

export const MICRO_LABEL: Record<
  string,
  { label: string; unit: string; ref: number; limit?: boolean }
> = {
  sodioMg: { label: "Sódio", unit: "mg", ref: 2000, limit: true },
  calcioMg: { label: "Cálcio", unit: "mg", ref: 1000 },
  ferroMg: { label: "Ferro", unit: "mg", ref: 14 },
  potassioMg: { label: "Potássio", unit: "mg", ref: 3500 },
  vitaminaCMg: { label: "Vitamina C", unit: "mg", ref: 100 },
  magnesioMg: { label: "Magnésio", unit: "mg", ref: 420 },
  zincoMg: { label: "Zinco", unit: "mg", ref: 11 },
  fosforoMg: { label: "Fósforo", unit: "mg", ref: 700 },
};

export function guessMeal(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "BREAKFAST";
  if (h < 15) return "LUNCH";
  if (h < 18) return "SNACK";
  return "DINNER";
}

export function scaleItem(item: FoodItem, grams: number): FoodItem {
  const f = item.grams > 0 ? grams / item.grams : 0;
  return {
    ...item,
    grams,
    kcal: item.kcal * f,
    protein: item.protein * f,
    carbs: item.carbs * f,
    fat: item.fat * f,
    fiber: item.fiber == null ? item.fiber : item.fiber * f,
    micros: item.micros
      ? Object.fromEntries(
          Object.entries(item.micros).map(([k, v]) => [k, v * f]),
        )
      : item.micros,
  };
}

export function foodToItem(food: Food, grams: number): FoodItem {
  return scaleItem(
    {
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      grams: 100,
      kcal: food.per100g.kcal,
      protein: food.per100g.protein,
      carbs: food.per100g.carbs,
      fat: food.per100g.fat,
      fiber: food.per100g.fiber,
      micros: food.per100g.micros,
      foodId: food.id,
    },
    grams,
  );
}

export interface AchievementInfo {
  key: string;
  title: string;
  description: string;
  emoji: string;
  gems: number;
  unlockedAt?: string | null;
}

export interface GameState {
  petName: string | null;
  gems: number;
  level: number;
  current: number;
  next: number | null;
  lifetimeGems: number;
  owned: string[];
  equipped: string[];
  friendsBadge: number;
  newAchievements: AchievementInfo[];
}

export interface ShopItem {
  id: string;
  name: string;
  slot: "hat" | "glasses" | "color" | "garden" | "species" | "scene";
  price: number;
  minLevel: number;
  owned: boolean;
  locked: boolean;
}

export interface ShopState {
  gems: number;
  level: number;
  deal: { itemId: string; price: number } | null;
  today: string[];
  items: ShopItem[];
}

export interface Supplement {
  id: string;
  name: string;
  emoji: string;
  dose: string | null;
  proteinG: number | null;
  kcal: number | null;
  timesPerDay: number;
  times: string[];
  logs: { id: string; takenAt: string }[];
}

export interface PrescriptionItem {
  name: string;
  emoji: string;
  dose: string;
  times: string[];
  proteinG: number | null;
  kcal: number | null;
  note: string;
  daily: boolean;
}

export interface WaterReminder {
  enabled: boolean;
  start: string;
  end: string;
  every: number;
}

export interface RankEntry {
  userId: string;
  name: string;
  petName: string | null;
  petLevel: number;
  petEquipped: string[];
  achievements: number;
  streak: number;
  daysLogged: number;
  waterDays: number;
  waterTodayPct: number;
  waterWeekPct: number;
  missions: number;
  fasts: number;
  points: number;
  weightLostPct: number | null;
  position: number;
  isMe: boolean;
}

export interface FriendsOverview {
  code: string;
  shareWeight: boolean;
  ranking: RankEntry[];
  incoming: { id: string; name: string; petName: string | null }[];
  outgoing: { id: string; name: string }[];
  cheers: { id: string; fromName: string; emoji: string; createdAt: string }[];
}

export type LabStatus = "LOW" | "NORMAL" | "HIGH" | "UNKNOWN";

export interface LabMarker {
  code: string;
  name: string;
  category: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  key: boolean;
  latest: { date: string; value: number; status: LabStatus };
  history: { date: string; value: number; status: LabStatus }[];
}

export interface LabOverview {
  exams: {
    id: string;
    title: string;
    collectedAt: string;
    results: number;
    hasFile: boolean;
  }[];
  markers: LabMarker[];
}

export interface BariGuide {
  surgeryType: SurgeryType | null;
  items: {
    key: string;
    name: string;
    dose: string | null;
    note: string | null;
    labCodes: string[];
  }[];
}

export interface BariMonth {
  month: string;
  days: {
    date: string;
    dosesTaken: number;
    dosesExpected: number;
    protein: number;
    proteinTarget: number;
    supplementsOk: boolean;
    proteinOk: boolean;
  }[];
  summary: {
    days: number;
    supplementsOk: number;
    proteinOk: number;
    bothOk: number;
  };
}

export const SURGERY_LABEL: Record<SurgeryType, string> = {
  BGA: "Banda gástrica",
  SLEEVE: "Sleeve",
  BYPASS: "Bypass",
  BPD_DS: "Duodenal switch",
};

export type ChallengeStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED"
  | "COMPLETED"
  | "FAILED";

export interface Challenge {
  id: string;
  title: string;
  stake: number;
  deadline: string;
  status: ChallengeStatus;
  proof: string | null;
  createdAt: string;
  resolvedAt: string | null;
  fromMe: boolean;
  otherId: string;
  otherName: string;
  won: boolean | null;
}

export interface ChallengeLock {
  friendId: string;
  canChallenge: boolean;
  reason: "open" | "winner" | null;
  until: string | null;
}

export interface ChallengesOverview {
  open: Challenge[];
  history: Challenge[];
  locks: ChallengeLock[];
}

export interface TrainingHistory {
  activities: {
    id: string;
    date: string;
    name: string;
    minutes: number;
    kcal: number;
    intensity: "LIGHT" | "MODERATE" | "VIGOROUS" | null;
    details: string | null;
    distanceKm: number | null;
    exercises: { name: string; sets: { reps: number; kg: number }[] }[] | null;
  }[];
  steps: { date: string; steps: number }[];
}

export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export interface RoutineExercise {
  name: string;
  sets: number;
  reps: string;
  repsTarget: number;
}

export interface RoutineDay {
  label: string;
  focus: string;
  weekday: Weekday | null;
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  name: string;
  days: RoutineDay[];
  updatedAt: string;
}
