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
  {
    id: 'hat_headband',
    name: 'Faixa fitness',
    slot: 'hat',
    price: 150,
    minLevel: 1,
  },
  {
    id: 'hat_bunny',
    name: 'Orelhinhas de coelho',
    slot: 'hat',
    price: 200,
    minLevel: 1,
  },
  {
    id: 'hat_cowboy',
    name: 'Chapéu de cowboy',
    slot: 'hat',
    price: 300,
    minLevel: 2,
  },
  {
    id: 'hat_wizard',
    name: 'Chapéu de mago',
    slot: 'hat',
    price: 400,
    minLevel: 3,
  },
  {
    id: 'hat_tiara',
    name: 'Tiara de princesa',
    slot: 'hat',
    price: 450,
    minLevel: 4,
  },
  { id: 'hat_halo', name: 'Auréola', slot: 'hat', price: 700, minLevel: 6 },
  {
    id: 'glasses_star',
    name: 'Estrelinhas',
    slot: 'glasses',
    price: 200,
    minLevel: 1,
  },
  {
    id: 'glasses_nerd',
    name: 'Óculos nerd',
    slot: 'glasses',
    price: 200,
    minLevel: 2,
  },
  {
    id: 'glasses_swim',
    name: 'Óculos de natação',
    slot: 'glasses',
    price: 300,
    minLevel: 3,
  },
  {
    id: 'glasses_vr',
    name: 'Óculos futurista',
    slot: 'glasses',
    price: 500,
    minLevel: 5,
  },
  { id: 'color_coral', name: 'Coral', slot: 'color', price: 250, minLevel: 2 },
  { id: 'color_lime', name: 'Limão', slot: 'color', price: 250, minLevel: 3 },
  {
    id: 'color_galaxy',
    name: 'Galáxia',
    slot: 'color',
    price: 500,
    minLevel: 5,
  },
  { id: 'color_gold', name: 'Dourado', slot: 'color', price: 900, minLevel: 7 },
  {
    id: 'garden_dumbbell',
    name: 'Halteres',
    slot: 'garden',
    price: 150,
    minLevel: 1,
  },
  {
    id: 'garden_bottle',
    name: 'Garrafinha de água',
    slot: 'garden',
    price: 120,
    minLevel: 1,
  },
  {
    id: 'garden_watermelon',
    name: 'Melancia',
    slot: 'garden',
    price: 200,
    minLevel: 2,
  },
  {
    id: 'garden_sunflowers',
    name: 'Girassóis',
    slot: 'garden',
    price: 300,
    minLevel: 3,
  },
  {
    id: 'garden_bench',
    name: 'Banquinho',
    slot: 'garden',
    price: 350,
    minLevel: 4,
  },
  {
    id: 'garden_rainbow',
    name: 'Arco-íris',
    slot: 'garden',
    price: 800,
    minLevel: 6,
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
  friends: number;
  activityMinutes: number;
  weighIns: number;
  cheersSent: number;
  supplementLogs: number;
  bigStepDays: number;
  challengesWon: number;
  challengesDone: number;
  challengesSent: number;
  notes: number;
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
    key: 'friend_1',
    title: 'Primeira amizade',
    description: 'Adicionou uma amiga no app',
    emoji: '👯‍♀️',
    gems: 50,
    check: (s) => s.friends >= 1,
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
  {
    key: 'meals_500',
    title: 'Lenda do diário',
    description: '500 alimentos registrados',
    emoji: '📚',
    gems: 600,
    check: (s) => s.meals >= 500,
  },
  {
    key: 'photo_10',
    title: 'Álbum de pratos',
    description: '10 refeições registradas por foto',
    emoji: '🖼️',
    gems: 100,
    check: (s) => s.photoMeals >= 10,
  },
  {
    key: 'photo_50',
    title: 'Food influencer',
    description: '50 refeições registradas por foto',
    emoji: '🤳',
    gems: 300,
    check: (s) => s.photoMeals >= 50,
  },
  {
    key: 'streak_14',
    title: 'Duas semanas firmes',
    description: '14 dias seguidos registrando',
    emoji: '🔥',
    gems: 250,
    check: (s) => s.bestStreak >= 14,
  },
  {
    key: 'streak_60',
    title: 'Imparável',
    description: '60 dias seguidos registrando',
    emoji: '☄️',
    gems: 700,
    check: (s) => s.bestStreak >= 60,
  },
  {
    key: 'water_30',
    title: 'Oceano',
    description: 'Bateu a meta de água em 30 dias',
    emoji: '🐳',
    gems: 400,
    check: (s) => s.waterDays >= 30,
  },
  {
    key: 'protein_20',
    title: 'Força total',
    description: 'Bateu a meta de proteína em 20 dias',
    emoji: '🦾',
    gems: 300,
    check: (s) => s.proteinDays >= 20,
  },
  {
    key: 'kcal_30',
    title: 'Precisão de mestre',
    description: '30 dias dentro da meta de calorias',
    emoji: '🏹',
    gems: 500,
    check: (s) => s.kcalDays >= 30,
  },
  {
    key: 'fast_30',
    title: 'Monge do jejum',
    description: 'Completou 30 jejuns',
    emoji: '🕯️',
    gems: 500,
    check: (s) => s.fastsReached >= 30,
  },
  {
    key: 'move_20',
    title: 'Ritmo de atleta',
    description: 'Registrou 20 atividades físicas',
    emoji: '🏅',
    gems: 250,
    check: (s) => s.activities >= 20,
  },
  {
    key: 'move_50',
    title: 'Maratonista',
    description: 'Registrou 50 atividades físicas',
    emoji: '🏆',
    gems: 500,
    check: (s) => s.activities >= 50,
  },
  {
    key: 'minutes_600',
    title: '10 horas suando',
    description: 'Somou 10 horas de atividade física',
    emoji: '⏳',
    gems: 300,
    check: (s) => s.activityMinutes >= 600,
  },
  {
    key: 'steps_10k',
    title: '10 mil passos',
    description: 'Bateu 10 mil passos em um dia',
    emoji: '👟',
    gems: 100,
    check: (s) => s.bigStepDays >= 1,
  },
  {
    key: 'weigh_10',
    title: 'De olho na balança',
    description: 'Registrou 10 pesagens',
    emoji: '📈',
    gems: 100,
    check: (s) => s.weighIns >= 10,
  },
  {
    key: 'friends_3',
    title: 'Turminha',
    description: 'Tem 3 amigas no app',
    emoji: '🫶',
    gems: 150,
    check: (s) => s.friends >= 3,
  },
  {
    key: 'cheer_10',
    title: 'Torcida organizada',
    description: 'Mandou força 10 vezes',
    emoji: '📣',
    gems: 100,
    check: (s) => s.cheersSent >= 10,
  },
  {
    key: 'supp_30',
    title: 'Reposição em dia',
    description: 'Marcou 30 doses de suplemento',
    emoji: '💊',
    gems: 150,
    check: (s) => s.supplementLogs >= 30,
  },
  {
    key: 'notes_10',
    title: 'Querido diário',
    description: 'Escreveu 10 notas do dia',
    emoji: '📝',
    gems: 100,
    check: (s) => s.notes >= 10,
  },
  {
    key: 'challenge_sent',
    title: 'Provocadora',
    description: 'Mandou o primeiro desafio',
    emoji: '⚔️',
    gems: 50,
    check: (s) => s.challengesSent >= 1,
  },
  {
    key: 'challenge_done',
    title: 'Desafio aceito e cumprido',
    description: 'Cumpriu um desafio de amiga',
    emoji: '✅',
    gems: 100,
    check: (s) => s.challengesDone >= 1,
  },
  {
    key: 'challenge_won_5',
    title: 'Campeã dos desafios',
    description: 'Ganhou 5 desafios',
    emoji: '🥊',
    gems: 300,
    check: (s) => s.challengesWon >= 5,
  },
  {
    key: 'lost_15',
    title: '-15 kg',
    description: '15 quilos a menos!!',
    emoji: '🚀',
    gems: 700,
    check: (s) => s.kgLost >= 15,
  },
  {
    key: 'lost_20',
    title: '-20 kg',
    description: '20 quilos a menos!!!',
    emoji: '🦋',
    gems: 900,
    check: (s) => s.kgLost >= 20,
  },
];

export const MISSION_GEMS = { daily: 20, weekly: 60, month: 300 };
