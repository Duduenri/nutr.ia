import type { Diary, FoodQuality, JunkSummary, JunkTag } from "../lib/api";
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
  const entries = diary.meals.flatMap((m) => m.entries);
  const total = entries.reduce((t, e) => t + e.kcal, 0);
  if (!entries.length || total <= 0) return null;
  const kcalOf = (q: FoodQuality) =>
    entries.filter((e) => e.quality === q).reduce((t, e) => t + e.kcal, 0);
  const share = {
    GOOD: (kcalOf("GOOD") / total) * 100,
    OK: (kcalOf("OK") / total) * 100,
    BAD: (kcalOf("BAD") / total) * 100,
  };
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
      </div>
      <div className="mt-1.5 flex gap-3 text-[11px] font-bold text-ink/50">
        {(["GOOD", "OK", "BAD"] as FoodQuality[]).map((q) => (
          <span key={q} className="flex items-center">
            <QualityDot quality={q} />
            {DOT_TITLE[q]}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold">
        {verdict(badPct, entries.length, bad[0]?.name.toLowerCase())}
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
