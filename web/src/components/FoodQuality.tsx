import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Diary,
  FoodQuality,
  JunkSummary,
  JunkTag,
  NutritionStats,
} from "../lib/api";
import { hideToast, showToast, useToast } from "../lib/toast";
import { Card } from "./ui";

const LABEL: Record<JunkTag, { emoji: string; label: string }> = {
  doce: { emoji: "🍫", label: "doce" },
  fritura: { emoji: "🍟", label: "fritura" },
  ultraprocessado: { emoji: "📦", label: "ultraprocessado" },
  refrigerante: { emoji: "🥤", label: "refri" },
  alcool: { emoji: "🍺", label: "álcool" },
  embutido: { emoji: "🌭", label: "embutido" },
  fastfood: { emoji: "🍔", label: "fast food" },
};

const ROASTS: Record<JunkTag, string[]> = {
  doce: [
    "Alerta de açúcar! O dentista agradece a preferência 😬",
    "Doce detectado. Seu pâncreas pediu demissão",
    "Lá vem açúcar… a balança já tá sabendo",
  ],
  fritura: [
    "Óleo detectado. Seu coração mandou um áudio de 3 minutos reclamando",
    "Isso aí nadou no óleo antes de chegar em você",
  ],
  ultraprocessado: [
    "Mais ingredientes que receita de vó, e nenhum que ela reconheceria",
    "Direto da fábrica pro seu prato. A comida de verdade chorou",
  ],
  refrigerante: [
    "Açúcar com gás e marketing. Nem mata a fome",
    "Calorias que passam reto e nem dizem oi",
  ],
  alcool: [
    "O fígado tá anotando tudo 📝",
    "Calorias líquidas: o crossfit do fígado",
  ],
  embutido: [
    "Embutido: nem o fabricante sabe o que tem dentro",
    "Embutido na área. O sódio agradece a visita",
  ],
  fastfood: [
    "Fast food? O palhaço tá orgulhoso, a meta nem tanto",
    "O delivery do pecado chegou",
  ],
};

const SWAPS: Record<JunkTag, string> = {
  doce: "Troca esperta: fruta com pasta de amendoim ou iogurte com cacau",
  fritura: "Troca esperta: a mesma coisa na air fryer",
  ultraprocessado: "Troca esperta: pão com ovo ou sanduíche natural",
  refrigerante: "Troca esperta: refri zero ou água com gás e limão",
  alcool: "Dica: um copo d'água entre cada dose e nada de petisco frito junto",
  embutido: "Troca esperta: frango desfiado, ovo ou atum",
  fastfood: "Troca esperta: hambúrguer caseiro ou pizza de rap10",
};

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export function showJunkToast(junk: JunkSummary) {
  const tag = (junk.items.find((i) => i.tags.length)?.tags[0] ??
    "ultraprocessado") as JunkTag;
  const kcal = junk.items.reduce((t, i) => t + i.kcal, 0);
  const names = junk.items.map((i) => i.name).join(", ");
  const pct = Math.round((kcal / junk.targetKcal) * 100);
  const dayPct = Math.round((junk.dayKcal / junk.targetKcal) * 100);
  const lines = [`🔴 ${names}: ${kcal} kcal (${pct}% do seu dia)`];
  if (junk.dayCount > junk.items.length) {
    lines.push(
      `Porcaria hoje: ${junk.dayKcal} kcal, ${dayPct}% da meta${dayPct >= 30 ? ". Tá virando dia do lixo 🗑️" : ""}`,
    );
  }
  if (
    junk.bariatric &&
    junk.items.some((i) =>
      i.tags.some((t) => ["doce", "fritura", "refrigerante"].includes(t)),
    )
  ) {
    lines.push(
      "⚠️ Pós-bariátrica: doce e gordura podem dar dumping. Vai devagar",
    );
  }
  lines.push(SWAPS[tag]);
  showToast({ emoji: LABEL[tag].emoji, title: pick(ROASTS[tag]), lines });
}

export function Toaster() {
  const toast = useToast();
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <button
        key={toast.id}
        onClick={hideToast}
        className="pointer-events-auto w-full max-w-md animate-[toast-in_.25s_ease-out] rounded-3xl border-2 border-peach-400 bg-white p-4 text-left shadow-card"
      >
        <span className="flex items-start gap-3">
          <span className="text-3xl">{toast.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">{toast.title}</span>
            {toast.lines.map((l, i) => (
              <span key={i} className="mt-1 block text-sm text-ink/70">
                {l}
              </span>
            ))}
          </span>
          <span className="text-ink/30">✕</span>
        </span>
      </button>
    </div>
  );
}

const DOT: Record<FoodQuality, string> = {
  GOOD: "bg-mint-500",
  OK: "bg-sun",
  BAD: "bg-peach-500",
};

const DOT_TITLE: Record<FoodQuality, string> = {
  GOOD: "Comida de verdade",
  OK: "Ok",
  BAD: "Porcaria",
};

export function QualityDot({ quality }: { quality?: FoodQuality | null }) {
  if (!quality) return null;
  return (
    <span
      className={`mr-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle ${DOT[quality]}`}
      title={DOT_TITLE[quality]}
      aria-label={DOT_TITLE[quality]}
    />
  );
}

function verdict(badPct: number, count: number, top?: string): string {
  if (badPct === 0) {
    return count >= 3
      ? "🥦 Zero porcaria até agora. Quem é você e o que fez com a gente?"
      : "🥦 Zero porcaria até agora. Segue assim";
  }
  if (badPct < 15) return `👌 ${badPct}% de porcaria. Tá no controle`;
  if (badPct < 30)
    return `😬 ${badPct}% das calorias de hoje foram porcaria. Segura a mão aí`;
  if (badPct < 50)
    return `🚨 ${badPct}% de porcaria. O corpo pediu salada e você mandou ${top ?? "besteira"}`;
  return `🗑️ ${badPct}% de porcaria. Hoje o diário virou cardápio de festa infantil`;
}

export function DayQualityCard({ diary }: { diary: Diary }) {
  const all = diary.meals.flatMap((m) => m.entries);
  const entries = diary.meals.filter((m) => !m.free).flatMap((m) => m.entries);
  const freeKcal = diary.meals
    .filter((m) => m.free)
    .flatMap((m) => m.entries)
    .reduce((t, e) => t + e.kcal, 0);
  const total = all.reduce((t, e) => t + e.kcal, 0);
  if (!all.length || total <= 0) return null;
  const kcalOf = (q: FoodQuality) =>
    entries.filter((e) => e.quality === q).reduce((t, e) => t + e.kcal, 0);
  const share = {
    GOOD: (kcalOf("GOOD") / total) * 100,
    OK: (kcalOf("OK") / total) * 100,
    BAD: (kcalOf("BAD") / total) * 100,
  };
  const freeShare = (freeKcal / total) * 100;
  const bad = entries
    .filter((e) => e.quality === "BAD")
    .sort((a, b) => b.kcal - a.kcal);
  const badPct = Math.round(share.BAD);

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-extrabold">Qualidade do dia</h3>
        <span className="text-xs font-bold text-ink/50">
          {Math.round(share.GOOD)}% comida de verdade
        </span>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-soft">
        {(["GOOD", "OK", "BAD"] as FoodQuality[]).map((q) => (
          <div key={q} className={DOT[q]} style={{ width: `${share[q]}%` }} />
        ))}
        <div className={FREE_DOT} style={{ width: `${freeShare}%` }} />
      </div>
      <div className="mt-1.5 flex gap-3 text-[11px] font-bold text-ink/50">
        {(["GOOD", "OK", "BAD"] as FoodQuality[]).map((q) => (
          <span key={q} className="flex items-center">
            <QualityDot quality={q} />
            {DOT_TITLE[q]}
          </span>
        ))}
        {freeKcal > 0 && <FreeLegend />}
      </div>
      <p className="mt-2 text-sm font-semibold">
        {entries.length
          ? verdict(badPct, entries.length, bad[0]?.name.toLowerCase())
          : "🍕 Só refeição livre até agora. Aproveita!"}
      </p>
      {bad.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {bad.slice(0, 5).map((e) => (
            <span
              key={e.id}
              className="rounded-full bg-peach-100 px-2.5 py-1 text-xs font-bold"
            >
              {(e.qualityTags ?? [])
                .map((t) => LABEL[t as JunkTag]?.emoji)
                .filter(Boolean)
                .join("") || "🔴"}{" "}
              {e.name} · {Math.round(e.kcal)} kcal
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

const COLOR: Record<FoodQuality | "FREE", string> = {
  GOOD: "#2fb38f",
  OK: "#ffd85e",
  BAD: "#e8693a",
  FREE: "#8b6fd6",
};

const FREE_DOT = "bg-grape-500";

function FreeLegend() {
  return (
    <span className="flex items-center">
      <span
        className={`mr-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle ${FREE_DOT}`}
      />
      Refeição livre
    </span>
  );
}

function periodVerdict(badPct: number): string {
  if (badPct >= 40)
    return `🗑️ ${badPct}% das calorias foram porcaria. Isso não é dieta, é rodízio de besteira`;
  if (badPct >= 25)
    return `🍩 ${badPct}% de porcaria. A comida de verdade tá perdendo de lavada`;
  if (badPct >= 10) return `😬 ${badPct}% de porcaria. Dá pra apertar mais`;
  return `🥦 Só ${badPct}% de porcaria. Comendo igual gente grande 💪`;
}

export function NutritionQualityCard({ data }: { data: NutritionStats }) {
  const q = data.quality;
  if (!q) return null;
  const series = data.series.map((s) => ({
    ...s,
    label: `${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`,
  }));
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-extrabold">Qualidade da comida</h3>
        <span className="text-xs font-bold text-ink/50">
          {q.goodPct}% comida de verdade
        </span>
      </div>
      <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-soft">
        <div className={DOT.GOOD} style={{ width: `${q.goodPct}%` }} />
        <div className={DOT.OK} style={{ width: `${q.okPct}%` }} />
        <div className={DOT.BAD} style={{ width: `${q.badPct}%` }} />
        <div className={FREE_DOT} style={{ width: `${q.freePct}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-3 text-center text-xs font-bold text-ink/60">
        <span>
          <QualityDot quality="GOOD" />
          Verdade {q.goodPct}%
        </span>
        <span>
          <QualityDot quality="OK" />
          Ok {q.okPct}%
        </span>
        <span>
          <QualityDot quality="BAD" />
          Porcaria {q.badPct}%
        </span>
      </div>
      {q.freeCount > 0 && (
        <p className="mt-1 flex justify-center text-xs font-bold text-ink/60">
          <FreeLegend />
          &nbsp;{q.freePct}% ({q.freeCount}{" "}
          {q.freeCount === 1 ? "item" : "itens"}, fora da conta)
        </p>
      )}
      <p className="mt-3 text-sm font-semibold">{periodVerdict(q.badPct)}</p>
      <div className="mt-3 h-44">
        <ResponsiveContainer>
          <BarChart
            data={series}
            margin={{ top: 8, right: 6, left: -18, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#eef0f4" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v: number, name: string) => [
                `${v} kcal`,
                name === "good"
                  ? "Comida de verdade"
                  : name === "ok"
                    ? "Ok"
                    : name === "free"
                      ? "Refeição livre"
                      : "Porcaria",
              ]}
            />
            <Bar dataKey="good" stackId="q" fill={COLOR.GOOD} />
            <Bar dataKey="ok" stackId="q" fill={COLOR.OK} />
            <Bar dataKey="bad" stackId="q" fill={COLOR.BAD} />
            <Bar
              dataKey="free"
              stackId="q"
              fill={COLOR.FREE}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {q.tags.length > 0 && (
        <>
          <h4 className="mt-3 text-sm font-extrabold">Placar da porcaria</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {q.tags.map((t) => (
              <span
                key={t.tag}
                className="rounded-full bg-peach-100 px-2.5 py-1 text-xs font-bold"
              >
                {LABEL[t.tag].emoji} {LABEL[t.tag].label} {t.count}x
              </span>
            ))}
          </div>
        </>
      )}
      {q.top.length > 0 && (
        <>
          <h4 className="mt-3 text-sm font-extrabold">Campeões de porcaria</h4>
          <ol className="mt-1 space-y-1 text-sm">
            {q.top.map((t, i) => (
              <li key={t.name} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  {["🥇", "🥈", "🥉"][i]} {t.name}
                  {t.count > 1 ? ` (${t.count}x)` : ""}
                </span>
                <span className="shrink-0 font-bold">{t.kcal} kcal</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}
