import { ActivityLevel, Goal, Sex } from '@prisma/client';

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

const PROTEIN_G_PER_KG: Record<Goal, number> = {
  LOSE: 1.6,
  MAINTAIN: 1.6,
  GAIN: 1.8,
};

const KCAL_ADJUST: Record<Goal, number> = {
  LOSE: -500,
  MAINTAIN: 0,
  GAIN: 300,
};

const KCAL_PER_KG = 7700;
const DAY_MS = 86_400_000;

export interface GoalPlan {
  kgToGo: number;
  daysLeft: number;
  weeklyRateKg: number;
  dailyKcalAdjust: number;
  pace: 'ok' | 'fast' | 'too_fast' | 'past' | 'reached';
}

export function goalPlan(
  weightKg: number,
  targetKg: number,
  targetDate: Date,
  now = new Date(),
): GoalPlan {
  const kgToGo = Math.round((targetKg - weightKg) * 10) / 10;
  const daysLeft = Math.ceil((targetDate.getTime() - now.getTime()) / DAY_MS);
  if (Math.abs(kgToGo) < 0.1) {
    return {
      kgToGo,
      daysLeft,
      weeklyRateKg: 0,
      dailyKcalAdjust: 0,
      pace: 'reached',
    };
  }
  if (daysLeft <= 0) {
    return {
      kgToGo,
      daysLeft,
      weeklyRateKg: 0,
      dailyKcalAdjust: 0,
      pace: 'past',
    };
  }
  const weeklyRateKg = Math.round((kgToGo / daysLeft) * 7 * 100) / 100;
  const losing = kgToGo < 0;
  const raw = (kgToGo * KCAL_PER_KG) / daysLeft;
  const dailyKcalAdjust = Math.round(
    losing
      ? Math.min(-250, Math.max(-1000, raw))
      : Math.max(150, Math.min(500, raw)),
  );
  const rate = Math.abs(weeklyRateKg);
  const fastLimit = losing ? 0.75 : 0.35;
  const tooFastLimit = losing ? 1 : 0.5;
  const pace =
    rate > tooFastLimit ? 'too_fast' : rate > fastLimit ? 'fast' : 'ok';
  return { kgToGo, daysLeft, weeklyRateKg, dailyKcalAdjust, pace };
}

export interface TargetInput {
  sex: Sex;
  birthDate: Date;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number | null;
  targetDate: Date | null;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface Targets {
  kcalTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  fiberTarget: number;
  waterTargetMl: number;
}

export function ageFrom(birthDate: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
    age--;
  }
  return age;
}

// Mifflin-St Jeor
export function computeTargets(input: TargetInput): Targets {
  const age = ageFrom(input.birthDate);
  const bmr =
    10 * input.weightKg +
    6.25 * input.heightCm -
    5 * age +
    (input.sex === 'MALE' ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[input.activityLevel];
  const floor = input.sex === 'MALE' ? 1500 : 1200;
  const plan =
    input.goal !== 'MAINTAIN' && input.targetWeightKg && input.targetDate
      ? goalPlan(input.weightKg, input.targetWeightKg, input.targetDate)
      : null;
  const adjust =
    plan && plan.dailyKcalAdjust !== 0
      ? plan.dailyKcalAdjust
      : KCAL_ADJUST[input.goal];
  const kcal = Math.max(floor, Math.round(tdee + adjust));

  const proteinBaseKg =
    input.goal === 'LOSE' && input.targetWeightKg
      ? Math.min(input.weightKg, input.targetWeightKg)
      : input.weightKg;
  const protein = Math.round(proteinBaseKg * PROTEIN_G_PER_KG[input.goal]);
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return {
    kcalTarget: kcal,
    proteinTarget: protein,
    carbsTarget: carbs,
    fatTarget: fat,
    fiberTarget: input.sex === 'MALE' ? 30 : 25,
    waterTargetMl: Math.round((input.weightKg * 35) / 50) * 50,
  };
}
