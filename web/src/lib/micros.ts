import type { Sex } from "./api";

export type MicroGroup = "vitamin" | "mineral" | "limit";

export interface MicroInfo {
  key: string;
  label: string;
  tag?: string;
  unit: string;
  group: MicroGroup;
  ref: { FEMALE: number; MALE: number };
  limit?: boolean;
  sources: string;
}

const same = (v: number) => ({ FEMALE: v, MALE: v });

export const MICROS: MicroInfo[] = [
  {
    key: "retinolMcg",
    label: "Vitamina A",
    unit: "mcg",
    group: "vitamin",
    ref: { FEMALE: 700, MALE: 900 },
    sources: "cenoura, abóbora, batata-doce, couve, manga, ovo",
  },
  {
    key: "tiaminaMg",
    label: "Vitamina B1",
    tag: "tiamina",
    unit: "mg",
    group: "vitamin",
    ref: { FEMALE: 1.1, MALE: 1.2 },
    sources: "feijão, carne de porco, aveia, arroz integral, sementes",
  },
  {
    key: "riboflavinaMg",
    label: "Vitamina B2",
    tag: "riboflavina",
    unit: "mg",
    group: "vitamin",
    ref: { FEMALE: 1.1, MALE: 1.3 },
    sources: "leite, iogurte, queijo, ovo, cogumelos",
  },
  {
    key: "niacinaMg",
    label: "Vitamina B3",
    tag: "niacina",
    unit: "mg",
    group: "vitamin",
    ref: { FEMALE: 14, MALE: 16 },
    sources: "frango, atum, carne, amendoim, cogumelos",
  },
  {
    key: "piridoxinaMg",
    label: "Vitamina B6",
    tag: "piridoxina",
    unit: "mg",
    group: "vitamin",
    ref: same(1.3),
    sources: "banana, frango, peixe, batata, grão-de-bico",
  },
  {
    key: "folatoMcg",
    label: "Vitamina B9",
    tag: "folato",
    unit: "mcg",
    group: "vitamin",
    ref: same(400),
    sources: "feijão, lentilha, folhas verde-escuras, brócolis, abacate",
  },
  {
    key: "vitaminaB12Mcg",
    label: "Vitamina B12",
    unit: "mcg",
    group: "vitamin",
    ref: same(2.4),
    sources: "carne, peixe, ovo, leite e queijo (não existe em vegetais)",
  },
  {
    key: "vitaminaCMg",
    label: "Vitamina C",
    unit: "mg",
    group: "vitamin",
    ref: { FEMALE: 75, MALE: 90 },
    sources: "acerola, goiaba, laranja, kiwi, morango, pimentão",
  },
  {
    key: "vitaminaDMcg",
    label: "Vitamina D",
    unit: "mcg",
    group: "vitamin",
    ref: same(15),
    sources: "sol (15 min), sardinha, salmão, gema de ovo",
  },
  {
    key: "vitaminaEMg",
    label: "Vitamina E",
    unit: "mg",
    group: "vitamin",
    ref: same(15),
    sources: "castanhas, amêndoas, semente de girassol, azeite, abacate",
  },
  {
    key: "calcioMg",
    label: "Cálcio",
    unit: "mg",
    group: "mineral",
    ref: same(1000),
    sources: "leite, iogurte, queijo, sardinha, couve, gergelim",
  },
  {
    key: "ferroMg",
    label: "Ferro",
    unit: "mg",
    group: "mineral",
    ref: { FEMALE: 18, MALE: 8 },
    sources:
      "carne vermelha, feijão, lentilha, folhas escuras (junto com vitamina C absorve melhor)",
  },
  {
    key: "magnesioMg",
    label: "Magnésio",
    unit: "mg",
    group: "mineral",
    ref: { FEMALE: 310, MALE: 400 },
    sources: "castanhas, aveia, feijão, banana, chocolate amargo",
  },
  {
    key: "zincoMg",
    label: "Zinco",
    unit: "mg",
    group: "mineral",
    ref: { FEMALE: 8, MALE: 11 },
    sources: "carne, frango, ovo, castanha de caju, grão-de-bico",
  },
  {
    key: "potassioMg",
    label: "Potássio",
    unit: "mg",
    group: "mineral",
    ref: { FEMALE: 2600, MALE: 3400 },
    sources: "banana, feijão, batata, abacate, água de coco",
  },
  {
    key: "fosforoMg",
    label: "Fósforo",
    unit: "mg",
    group: "mineral",
    ref: same(700),
    sources: "carnes, peixes, ovos, leite, feijão",
  },
  {
    key: "sodioMg",
    label: "Sódio",
    unit: "mg",
    group: "limit",
    ref: same(2000),
    limit: true,
    sources:
      "sal, comida pronta, embutidos, salgadinhos, temperos prontos e molhos",
  },
  {
    key: "colesterolMg",
    label: "Colesterol",
    unit: "mg",
    group: "limit",
    ref: same(300),
    limit: true,
    sources: "gema de ovo, miúdos, camarão, manteiga, carnes gordas",
  },
];

export const MICRO_BY_KEY = Object.fromEntries(MICROS.map((m) => [m.key, m]));

export function microRef(key: string, sex: Sex | null | undefined): number {
  const info = MICRO_BY_KEY[key];
  if (!info) return 0;
  return sex ? info.ref[sex] : Math.max(info.ref.FEMALE, info.ref.MALE);
}

export function microName(info: MicroInfo): string {
  return info.tag ? `${info.label} (${info.tag})` : info.label;
}
