import { SurgeryType } from '@prisma/client';

type Dose = string | Partial<Record<SurgeryType, string>>;

export interface GuideItem {
  key: string;
  name: string;
  dose: Dose;
  note?: string;
  labCodes: string[];
}

// Doses preventivas de referência pós-bariátrica (diretrizes ASMBS); a
// prescrição individual da equipe sempre prevalece.
export const BARI_GUIDE: GuideItem[] = [
  {
    key: 'protein',
    name: 'Proteína',
    dose: '60 g/dia ou mais (até ~1,5 g/kg de peso ideal)',
    note: 'Comece cada refeição pela proteína.',
    labCodes: ['albumina', 'proteinas_totais'],
  },
  {
    key: 'multi',
    name: 'Polivitamínico bariátrico',
    dose: 'Diário, na dose do rótulo',
    note: 'Base de toda a reposição.',
    labCodes: [],
  },
  {
    key: 'b12',
    name: 'Vitamina B12',
    dose: '350–1.000 mcg/dia via oral/sublingual, ou 1.000 mcg/mês injetável',
    labCodes: ['vitamina_b12'],
  },
  {
    key: 'vitd',
    name: 'Vitamina D3',
    dose: '3.000 UI/dia',
    note: 'Em deficiência, doses maiores só com prescrição.',
    labCodes: ['vitamina_d'],
  },
  {
    key: 'calcium',
    name: 'Cálcio (citrato)',
    dose: {
      BGA: '1.200–1.500 mg/dia',
      SLEEVE: '1.200–1.500 mg/dia',
      BYPASS: '1.200–1.500 mg/dia',
      BPD_DS: '1.800–2.400 mg/dia',
    },
    note: 'Somando alimentação e suplemento. Tomar longe do ferro.',
    labCodes: ['calcio', 'pth'],
  },
  {
    key: 'iron',
    name: 'Ferro',
    dose: {
      BGA: '18 mg/dia',
      SLEEVE: '45–60 mg/dia',
      BYPASS: '45–60 mg/dia',
      BPD_DS: '45–60 mg/dia',
    },
    note: 'Mulheres em idade fértil: 45–60 mg/dia. Tomar longe do cálcio.',
    labCodes: ['ferritina', 'ferro_serico', 'hemoglobina'],
  },
  {
    key: 'folate',
    name: 'Ácido fólico',
    dose: '400–800 mcg/dia (800–1.000 mcg para mulheres em idade fértil)',
    labCodes: ['acido_folico'],
  },
  {
    key: 'b1',
    name: 'Tiamina (B1)',
    dose: 'Mínimo 12 mg/dia, idealmente 50–100 mg/dia',
    note: 'Atenção redobrada se houver vômitos frequentes.',
    labCodes: [],
  },
  {
    key: 'zinc',
    name: 'Zinco',
    dose: {
      BGA: '8–11 mg/dia',
      SLEEVE: '8–22 mg/dia',
      BYPASS: '8–22 mg/dia',
      BPD_DS: '16–22 mg/dia',
    },
    note: 'Equilibrar com cobre (1 mg de cobre a cada 8–15 mg de zinco).',
    labCodes: ['zinco'],
  },
  {
    key: 'copper',
    name: 'Cobre',
    dose: {
      BGA: '1 mg/dia',
      SLEEVE: '1 mg/dia',
      BYPASS: '2 mg/dia',
      BPD_DS: '2 mg/dia',
    },
    labCodes: ['cobre'],
  },
  {
    key: 'vita',
    name: 'Vitamina A',
    dose: {
      BGA: '5.000 UI/dia',
      SLEEVE: '5.000–10.000 UI/dia',
      BYPASS: '5.000–10.000 UI/dia',
      BPD_DS: '10.000 UI/dia',
    },
    labCodes: ['vitamina_a'],
  },
  {
    key: 'vitk',
    name: 'Vitamina K',
    dose: {
      BGA: '90–120 mcg/dia',
      SLEEVE: '90–120 mcg/dia',
      BYPASS: '90–120 mcg/dia',
      BPD_DS: '300 mcg/dia',
    },
    labCodes: [],
  },
];

export const BARI_KEY_LABS = [
  'ferritina',
  'hemoglobina',
  'vitamina_b12',
  'vitamina_d',
  'calcio',
  'pth',
  'acido_folico',
  'albumina',
  'zinco',
  'ferro_serico',
];

export function guideFor(surgery: SurgeryType | null) {
  return BARI_GUIDE.map((g) => ({
    key: g.key,
    name: g.name,
    note: g.note ?? null,
    labCodes: g.labCodes,
    dose:
      typeof g.dose === 'string'
        ? g.dose
        : surgery
          ? (g.dose[surgery] ?? null)
          : Object.entries(g.dose)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · '),
  }));
}
