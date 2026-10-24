export type ItemSlot = 'hat' | 'glasses' | 'color' | 'garden';

export interface ShopItem {
  id: string;
  name: string;
  slot: ItemSlot;
  price: number;
  minLevel: number;
}

export const DEFAULT_COLOR = 'color_pink';

export const ITEMS: ShopItem[] = [
  { id: 'hat_cap', name: 'Boné', slot: 'hat', price: 150, minLevel: 1 },
  { id: 'hat_bow', name: 'Lacinho', slot: 'hat', price: 120, minLevel: 1 },
  { id: 'hat_flower', name: 'Florzinha', slot: 'hat', price: 120, minLevel: 1 },
  {
    id: 'hat_party',
    name: 'Chapéu de festa',
    slot: 'hat',
    price: 150,
    minLevel: 1,
  },
  {
    id: 'hat_beach',
    name: 'Chapéu de praia',
    slot: 'hat',
    price: 250,
    minLevel: 2,
  },
  { id: 'hat_beanie', name: 'Gorro', slot: 'hat', price: 200, minLevel: 2 },
  {
    id: 'hat_chef',
    name: 'Chapéu de chef',
    slot: 'hat',
    price: 300,
    minLevel: 3,
  },
  { id: 'hat_crown', name: 'Coroa', slot: 'hat', price: 600, minLevel: 5 },
  {
    id: 'glasses_round',
    name: 'Óculos redondo',
    slot: 'glasses',
    price: 150,
    minLevel: 1,
  },
  {
    id: 'glasses_sun',
    name: 'Óculos de sol',
    slot: 'glasses',
    price: 250,
    minLevel: 1,
  },
  {
    id: 'glasses_cat',
    name: 'Gatinho',
    slot: 'glasses',
    price: 250,
    minLevel: 2,
  },
  {
    id: 'glasses_heart',
    name: 'Coração',
    slot: 'glasses',
    price: 300,
    minLevel: 3,
  },
  { id: 'color_pink', name: 'Rosinha', slot: 'color', price: 0, minLevel: 1 },
  { id: 'color_mint', name: 'Menta', slot: 'color', price: 200, minLevel: 1 },
  {
    id: 'color_peach',
    name: 'Pêssego',
    slot: 'color',
    price: 200,
    minLevel: 1,
  },
  { id: 'color_lilac', name: 'Lilás', slot: 'color', price: 200, minLevel: 2 },
  {
    id: 'color_yellow',
    name: 'Amarelinho',
    slot: 'color',
    price: 200,
    minLevel: 2,
  },
  { id: 'color_sky', name: 'Céu', slot: 'color', price: 250, minLevel: 3 },
  {
    id: 'garden_daisies',
    name: 'Margaridas',
    slot: 'garden',
    price: 120,
    minLevel: 1,
  },
  {
    id: 'garden_mushroom',
    name: 'Cogumelo',
    slot: 'garden',
    price: 150,
    minLevel: 1,
  },
  {
    id: 'garden_pot',
    name: 'Vaso de flor',
    slot: 'garden',
    price: 150,
    minLevel: 1,
  },
  {
    id: 'garden_butterflies',
    name: 'Borboletas',
    slot: 'garden',
    price: 300,
    minLevel: 3,
  },
  {
    id: 'garden_tree',
    name: 'Arvorezinha',
    slot: 'garden',
    price: 400,
    minLevel: 4,
  },
  {
    id: 'garden_pond',
    name: 'Laguinho',
    slot: 'garden',
    price: 500,
    minLevel: 5,
  },
];

export const LEVEL_THRESHOLDS = [
  0, 150, 400, 800, 1400, 2200, 3200, 4500, 6000, 8000,
];

export function levelFor(lifetimeGems: number) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (lifetimeGems >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const current = LEVEL_THRESHOLDS[level - 1];
  const next = LEVEL_THRESHOLDS[level] ?? null;
  return { level, current, next };
}

export interface AchievementStats {
  meals: number;
  photoMeals: number;
  bestStreak: number;
  waterDays: number;
  fastsReached: number;
  hasWeight: boolean;
  kgLost: number;
  goalReached: boolean;
  proteinDays: number;
  kcalDays: number;
  customRecipes: number;
  activities: number;
}

export interface Achievement {
  key: string;
  title: string;
  description: string;
  emoji: string;
  gems: number;
  check: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    key: 'start',
    title: 'Começou a jornada',
    description: 'Fez sua primeira pesagem no app',
    emoji: '🌱',
    gems: 150,
    check: (s) => s.hasWeight,
  },
  {
    key: 'first_meal',
    title: 'Primeiro registro',
    description: 'Registrou a primeira refeição',
    emoji: '🍽️',
    gems: 50,
    check: (s) => s.meals >= 1,
  },
  {
    key: 'first_photo',
    title: 'Fotógrafa de pratos',
    description: 'Registrou uma refeição por foto',
    emoji: '📸',
    gems: 50,
    check: (s) => s.photoMeals >= 1,
  },
  {
    key: 'meals_50',
    title: 'Diário em dia',
    description: '50 alimentos registrados',
    emoji: '📒',
    gems: 150,
    check: (s) => s.meals >= 50,
  },
  {
    key: 'meals_200',
    title: 'Mestre do diário',
    description: '200 alimentos registrados',
    emoji: '🏅',
    gems: 300,
    check: (s) => s.meals >= 200,
  },
  {
    key: 'streak_3',
    title: '3 dias seguidos',
    description: 'Registrou refeições 3 dias seguidos',
    emoji: '🔥',
    gems: 75,
    check: (s) => s.bestStreak >= 3,
  },
  {
    key: 'streak_7',
    title: 'Uma semana firme',
    description: '7 dias seguidos registrando',
    emoji: '🔥',
    gems: 150,
    check: (s) => s.bestStreak >= 7,
  },
  {
    key: 'streak_30',
    title: 'Hábito criado',
    description: '30 dias seguidos registrando',
    emoji: '🏆',
    gems: 400,
    check: (s) => s.bestStreak >= 30,
  },
  {
    key: 'water_1',
    title: 'Hidratada',
    description: 'Bateu a meta de água pela primeira vez',
    emoji: '💧',
    gems: 50,
    check: (s) => s.waterDays >= 1,
  },
  {
    key: 'water_7',
    title: 'Fonte de água',
    description: 'Bateu a meta de água em 7 dias',
    emoji: '🌊',
    gems: 150,
    check: (s) => s.waterDays >= 7,
  },
  {
    key: 'protein_5',
    title: 'Proteína em dia',
    description: 'Bateu a meta de proteína em 5 dias',
    emoji: '💪',
    gems: 150,
    check: (s) => s.proteinDays >= 5,
  },
  {
    key: 'kcal_7',
    title: 'No alvo',
    description: '7 dias dentro da meta de calorias',
    emoji: '🎯',
    gems: 200,
    check: (s) => s.kcalDays >= 7,
  },
  {
    key: 'fast_1',
    title: 'Primeiro jejum',
    description: 'Completou um jejum até a meta',
    emoji: '⏱️',
    gems: 75,
    check: (s) => s.fastsReached >= 1,
  },
  {
    key: 'fast_10',
    title: 'Jejum na rotina',
    description: 'Completou 10 jejuns',
    emoji: '🧘‍♀️',
    gems: 250,
    check: (s) => s.fastsReached >= 10,
  },
  {
    key: 'move_5',
    title: 'Em movimento',
    description: 'Registrou 5 atividades físicas',
    emoji: '🏃‍♀️',
    gems: 100,
    check: (s) => s.activities >= 5,
  },
  {
    key: 'recipe_mine',
    title: 'Chef da casa',
    description: 'Salvou uma receita sua',
    emoji: '👩‍🍳',
    gems: 75,
    check: (s) => s.customRecipes >= 1,
  },
  {
    key: 'lost_1',
    title: '-1 kg',
    description: 'Perdeu o primeiro quilo',
    emoji: '⚖️',
    gems: 100,
    check: (s) => s.kgLost >= 1,
  },
  {
    key: 'lost_3',
    title: '-3 kg',
    description: 'Já foram 3 quilos',
    emoji: '✨',
    gems: 200,
    check: (s) => s.kgLost >= 3,
  },
  {
    key: 'lost_5',
    title: '-5 kg',
    description: '5 quilos a menos!',
    emoji: '🌟',
    gems: 300,
    check: (s) => s.kgLost >= 5,
  },
  {
    key: 'lost_10',
    title: '-10 kg',
    description: '10 quilos a menos!!',
    emoji: '💎',
    gems: 500,
    check: (s) => s.kgLost >= 10,
  },
  {
    key: 'goal_reached',
    title: 'Meta alcançada',
    description: 'Chegou no peso desejado',
    emoji: '👑',
    gems: 1000,
    check: (s) => s.goalReached,
  },
];

export const MISSION_GEMS = { daily: 20, weekly: 60, month: 300 };
