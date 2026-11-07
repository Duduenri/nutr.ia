import { FoodQuality } from '@prisma/client';
import { normalize } from '../common/text';

export const JUNK_TAGS = [
  'doce',
  'fritura',
  'ultraprocessado',
  'refrigerante',
  'alcool',
  'embutido',
  'fastfood',
] as const;
export type JunkTag = (typeof JUNK_TAGS)[number];

export interface FoodQualityResult {
  quality: FoodQuality;
  qualityTags: JunkTag[];
}

const LIGHT = /\b(zero|diet|sem acucar|sem adicao de acucar)\b/;

const RULES: [RegExp, JunkTag, FoodQuality][] = [
  [
    /\b(cerveja|chopp?|quentao|alcoolic[oa]|com alcool|vinho|espumante|caipirinha|caipiroska|vodka|whisky|uisque|cachaca|gin|tequila|licor|drink|aperol|sake|heineken|brahma|skol|budweiser|amstel|corona|stella)\b/,
    'alcool',
    'BAD',
  ],
  [
    /\b(refrigerante|refri|coca[- ]?cola|coca|guarana|fanta|sprite|pepsi|soda|tang|suco de caixinha|nectar|energetico|red bull|monster|cha gelado|ice tea|toddynho)\b/,
    'refrigerante',
    'BAD',
  ],
  [
    /\b(salgadinhos?(?! (fritos?|de festa))|elma chips|doritos|ruffles|cheetos|fandangos|pingo de ouro|baconzitos?|torcida|miojo|lamen|nissin|nuggets?|lasanha congelada|cup noodles?)\b/,
    'ultraprocessado',
    'BAD',
  ],
  [
    /\b(cheeseburger|big mac|whopper|mc ?donalds?|burger king|pizza|cachorro[- ]quente|hot dog|x[- ]?(salada|bacon|tudo|burguer|egg)|batata do mc|mc ?lanche|kfc|subway|esfirra|calzone)\b/,
    'fastfood',
    'BAD',
  ],
  [
    /\b(coxinha(?! da asa)|pastel|pasteis|risoles?|quibe frito|croquetes?|enroladinho|bolinhas? de queijo|salgad(os?|inhos?) (fritos?|de festa)|empanad[oa]s?|batata frita|batatas fritas|polenta frita|mandioca frita|aipim frito|frango frito|peixe frito|a milanesa|parmegiana|torresmo|oleo absorvido|churros|sonho|donuts?|rosquinha frita|pastelzinho|bolinhos? de (arroz|bacalhau|chuva|mandioca|aipim))\b/,
    'fritura',
    'BAD',
  ],
  [
    /\b(salsichas?|mortadela|salame|bacon|linguica calabresa|calabresa|copa|apresuntado|hot ?pocket)\b/,
    'embutido',
    'BAD',
  ],
  [
    /\b(chocolates?|bombons?|brigadeiros?|beijinho|bis|laka|ouro branco|sonho de valsa|kit ?kat|m&ms?|confeti|baton|prestigio|trufa|bala|balas|pirulitos?|chicletes?|jujuba|marshmallow|sorvetes?|picole|milk ?shake|cookies?|cookiws|biscoitos? recheados?|bolachas? recheadas?|oreo|negresco|passatempo|trakinas|wafer|bolos?|tortas? doces?|pudim|mousse|doce de leite|leite condensado|pacoca|pacoquinha|pe de moleque|rapadura|goiabada|cocada|nutella|creme de avelas?|nescau|toddy|achocolatado|ovomaltine|sucrilhos|super balls|cereal de chocolate|froot loops|barra de cereal com cobertura|gelatina|acucarad[oa]|cupcake|brownie|petit gateau|panetone|chocotone|cuca|sagu|ambrosia|quindim|canjica|arroz doce|doce|doces)\b|^acucar\b/,
    'doce',
    'BAD',
  ],
];

const SOFT: [RegExp, JunkTag][] = [
  [
    /\b(presunto|peito de peru|blanquet|linguica|linguicinha|salsichao)\b/,
    'embutido',
  ],
  [/\b(frito|frita|fritos|fritas|fritura)\b/, 'fritura'],
  [/\b(com acucar|mel)\b/, 'doce'],
  [
    /\b(granola|biscoito|bolacha|maionese|ketchup|margarina|requeijao|cream cheese|catupiry)\b/,
    'ultraprocessado',
  ],
];

const GOOD =
  /\b(arroz|feijao|lentilha|grao[- ]de[- ]bico|ervilha|soja|ovos?|frango|galinha|peito|file|patinho|alcatra|carne|bife|porco|suino|lombo|peixe|tilapia|salmao|atum|sardinha|camarao|alface|tomate|cenoura|brocolis|couve|repolho|abobrinha|abobora|chuchu|beterraba|pepino|rucula|espinafre|legumes?|verduras?|salada|banana|maca|mamao|laranja|tangerina|bergamota|morango|uva|melancia|melao|manga|pera|kiwi|abacaxi|abacate|ameixa|goiaba|maracuja|limao|acai puro|frutas?|batata|batata[- ]doce|mandioca|aipim|inhame|cara|aveia|quinoa|iogurte natural|cottage|ricota|queijo branco|castanhas?|nozes|amendoas|amendoim|chia|linhaca|cafe|cha|chimarrao|agua|leite)\b/;

const FRYING_EXCEPTIONS = /air ?fryer|sem oleo|assad[oa]|grelhad[oa]|cozid[oa]/;

const GOOD_CATEGORIES = [
  'Verduras, hortaliças e derivados',
  'Frutas e derivados',
  'Leguminosas e derivados',
  'Pescados e frutos do mar',
  'Ovos e derivados',
  'Nozes e sementes',
];

export function classifyFood(
  name: string,
  category?: string | null,
): FoodQualityResult {
  const n = normalize(name).replace(/(batata|milho)[- ]doce/g, '$1');
  const light = LIGHT.test(n);
  const noFry = FRYING_EXCEPTIONS.test(n);
  const tags = new Set<JunkTag>();
  let bad = false;

  for (const [re, tag] of RULES) {
    if (!re.test(n)) continue;
    if (light && (tag === 'refrigerante' || tag === 'doce')) continue;
    if (tag === 'fritura' && noFry && !/pastel|coxinha|risole|salgad/.test(n))
      continue;
    if (tag === 'doce' && /\bsem acucar\b/.test(n)) continue;
    if (tag === 'fastfood' && /caseir/.test(n)) continue;
    if (tag === 'doce' && /proteic|whey|protein/.test(n)) continue;
    tags.add(tag);
    bad = true;
  }
  if (category === 'Produtos açucarados' && !light) {
    tags.add('doce');
    bad = true;
  }
  if (bad) return { quality: 'BAD', qualityTags: [...tags] };

  for (const [re, tag] of SOFT) {
    if (!re.test(n)) continue;
    if (tag === 'fritura' && noFry) continue;
    tags.add(tag);
  }
  if (tags.size) return { quality: 'OK', qualityTags: [...tags] };

  if (
    (category && GOOD_CATEGORIES.includes(category)) ||
    (GOOD.test(n) &&
      !/\b(pao|massa|macarrao|tapioca|pure|whey|suplemento)\b/.test(n))
  ) {
    return { quality: 'GOOD', qualityTags: [] };
  }
  return { quality: 'OK', qualityTags: [] };
}

export function isJunkTag(tag: string): tag is JunkTag {
  return (JUNK_TAGS as readonly string[]).includes(tag);
}

export const JUNK_LABEL: Record<JunkTag, { emoji: string; label: string }> = {
  doce: { emoji: '🍫', label: 'doce' },
  fritura: { emoji: '🍟', label: 'fritura' },
  ultraprocessado: { emoji: '📦', label: 'ultraprocessado' },
  refrigerante: { emoji: '🥤', label: 'refri/bebida açucarada' },
  alcool: { emoji: '🍺', label: 'álcool' },
  embutido: { emoji: '🌭', label: 'embutido' },
  fastfood: { emoji: '🍔', label: 'fast food' },
};

interface QualityEntry {
  name: string;
  kcal: number;
  quality: FoodQuality | null;
  qualityTags: string[];
  free?: boolean;
}

export function junkStats(all: QualityEntry[]) {
  const total = all.reduce((t, e) => t + e.kcal, 0);
  const free = all.filter((e) => e.free);
  const entries = all.filter((e) => !e.free);
  const freeKcal = free.reduce((t, e) => t + e.kcal, 0);
  const bad = entries.filter((e) => e.quality === 'BAD');
  const good = entries.filter((e) => e.quality === 'GOOD');
  const badKcal = bad.reduce((t, e) => t + e.kcal, 0);
  const goodKcal = good.reduce((t, e) => t + e.kcal, 0);
  const tags: Partial<Record<JunkTag, number>> = {};
  for (const e of bad) {
    for (const t of e.qualityTags.filter(isJunkTag)) {
      tags[t] = (tags[t] ?? 0) + 1;
    }
  }
  const byName = new Map<
    string,
    { name: string; kcal: number; count: number }
  >();
  for (const e of bad) {
    const k = normalize(e.name);
    const cur = byName.get(k) ?? { name: e.name, kcal: 0, count: 0 };
    byName.set(k, { ...cur, kcal: cur.kcal + e.kcal, count: cur.count + 1 });
  }
  return {
    totalKcal: Math.round(total),
    badKcal: Math.round(badKcal),
    badCount: bad.length,
    badPct: total ? Math.round((badKcal / total) * 100) : 0,
    goodPct: total ? Math.round((goodKcal / total) * 100) : 0,
    freeKcal: Math.round(freeKcal),
    freeCount: free.length,
    freePct: total ? Math.round((freeKcal / total) * 100) : 0,
    tags: (Object.entries(tags) as [JunkTag, number][]).sort(
      (a, b) => b[1] - a[1],
    ),
    top: [...byName.values()].sort((a, b) => b.kcal - a.kcal).slice(0, 3),
  };
}

export type JunkStats = ReturnType<typeof junkStats>;

function longestRun(days: string[]): number {
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of [...new Set(days)].sort()) {
    const t = new Date(`${d}T00:00:00Z`).getTime();
    run = prev !== null && t - prev === 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

export function qualityAchievementStats(
  rows: {
    date: Date;
    kcal: number;
    quality: FoodQuality | null;
    qualityTags: string[];
    free?: boolean;
  }[],
  today: string,
) {
  const days = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = r.date.toISOString().slice(0, 10);
    if (d >= today) continue;
    days.set(d, [...(days.get(d) ?? []), r]);
  }
  const full = [...days].filter(([, list]) => list.length >= 3);
  const clean = full
    .filter(([, list]) => list.every((e) => e.free || e.quality !== 'BAD'))
    .map(([d]) => d);
  const realFood = full.filter(([, list]) => {
    const total = list.filter((e) => !e.free).reduce((t, e) => t + e.kcal, 0);
    const good = list
      .filter((e) => e.quality === 'GOOD')
      .reduce((t, e) => t + e.kcal, 0);
    return total > 0 && good / total >= 0.8;
  }).length;
  const without = (tag: JunkTag) =>
    longestRun(
      full
        .filter(([, list]) =>
          list.every(
            (e) =>
              e.free || e.quality !== 'BAD' || !e.qualityTags.includes(tag),
          ),
        )
        .map(([d]) => d),
    );
  const weeks = new Map<string, { days: number; total: number; bad: number }>();
  for (const [d, list] of days) {
    const date = new Date(`${d}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const k = date.toISOString().slice(0, 10);
    const w = weeks.get(k) ?? { days: 0, total: 0, bad: 0 };
    for (const e of list) {
      w.total += e.kcal;
      if (e.quality === 'BAD' && !e.free) w.bad += e.kcal;
    }
    weeks.set(k, { ...w, days: w.days + 1 });
  }
  return {
    cleanDays: clean.length,
    cleanStreak: longestRun(clean),
    realFoodDays: realFood,
    noSweetStreak: without('doce'),
    noSodaStreak: without('refrigerante'),
    cleanWeeks: [...weeks.values()].filter(
      (w) => w.days >= 5 && w.total > 0 && w.bad / w.total < 0.1,
    ).length,
  };
}
