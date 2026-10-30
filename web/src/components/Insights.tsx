import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type TrainingHistory } from "../lib/api";
import { today } from "../lib/date";
import { useGame } from "../lib/hooks";
import { shareStory } from "../lib/share";
import { exerciseMuscles, MUSCLE_ORDER } from "../lib/training";
import { Button, Card, ErrorText, Sheet, Spinner } from "./ui";

type Kind = "week" | "month";

interface Insight {
  emoji: string;
  text: string;
  tone: "good" | "warn" | "info";
}

interface PeriodInsights {
  kind: Kind;
  label: string;
  start: string;
  end: string;
  hasData: boolean;
  highlight: {
    workouts: number;
    liftedKg: number;
    records: number;
    loggedDays: number;
  };
  items: Insight[];
}

const TONE: Record<Insight["tone"], string> = {
  good: "bg-mint-50",
  warn: "bg-peach-100/70",
  info: "bg-soft",
};

function forgottenMuscles(history: TrainingHistory | undefined): Insight[] {
  if (!history) return [];
  const last = new Map<string, number>();
  for (const a of history.activities) {
    const t = new Date(`${a.date}T12:00:00`).getTime();
    for (const e of a.exercises ?? []) {
      for (const m of exerciseMuscles(e.name).primary) {
        last.set(m, Math.max(last.get(m) ?? 0, t));
      }
    }
  }
  const now = Date.now();
  return MUSCLE_ORDER.filter((m) => last.has(m))
    .map((m) => ({ m, days: Math.floor((now - last.get(m)!) / 86_400_000) }))
    .filter((x) => x.days >= 9 && x.days <= 60)
    .sort((a, b) => b.days - a.days)
    .slice(0, 2)
    .map((x) => ({
      emoji: "⚠️",
      text: `${x.m} não é treinado há ${x.days} dias`,
      tone: "warn" as const,
    }));
}

export function useInsights(kind: Kind, enabled = true) {
  const day = today();
  return useQuery({
    queryKey: ["insights", kind, day],
    queryFn: () =>
      api.get<PeriodInsights>(`/insights/period?kind=${kind}&today=${day}`),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function InsightsSheet({
  open,
  onClose,
  initial = "week",
}: {
  open: boolean;
  onClose: () => void;
  initial?: Kind;
}) {
  const [kind, setKind] = useState<Kind>(initial);
  const { data, isLoading } = useInsights(kind, open);
  const day = today();
  const { data: history } = useQuery({
    queryKey: ["training", day],
    queryFn: () => api.get<TrainingHistory>(`/activities/history?today=${day}`),
    enabled: open,
  });
  const { data: game } = useGame();
  const [shareError, setShareError] = useState<unknown>(null);
  const [sharing, setSharing] = useState(false);

  const items = data ? [...data.items, ...forgottenMuscles(history)] : [];

  const share = async () => {
    if (!data || !game) return;
    setSharing(true);
    setShareError(null);
    try {
      const good = items.filter((i) => i.tone === "good");
      const top = good[0] ?? items[0];
      await shareStory({
        kicker: kind === "week" ? "Minha semana" : "Meu mês",
        emoji: "📊",
        title: top ? top.text : data.label,
        subtitle: good
          .slice(1, 3)
          .map((i) => `${i.emoji} ${i.text}`)
          .join("  ·  "),
        badge: [
          data.highlight.workouts &&
            `${data.highlight.workouts} ${data.highlight.workouts === 1 ? "treino" : "treinos"}`,
          data.highlight.records &&
            `${data.highlight.records} ${data.highlight.records === 1 ? "recorde" : "recordes"}`,
          data.highlight.loggedDays &&
            `${data.highlight.loggedDays} dias no diário`,
        ]
          .filter(Boolean)
          .join(" · "),
        petLevel: game.level,
        petEquipped: game.equipped,
      });
    } catch (e) {
      setShareError(e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={kind === "week" ? "📊 Sua semana" : "🗓️ Seu mês"}
    >
      <div className="space-y-3 pb-6">
        <div className="flex gap-2">
          {(["week", "month"] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 rounded-full py-2 text-sm font-bold ${kind === k ? "bg-ink text-white" : "bg-soft"}`}
            >
              {k === "week" ? "Semana passada" : "Mês passado"}
            </button>
          ))}
        </div>
        {isLoading || !data ? (
          <Spinner />
        ) : (
          <>
            <p className="text-sm font-bold text-ink/50 first-letter:uppercase">
              {data.label}
            </p>
            {!data.hasData && (
              <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-ink/60">
                Poucos registros nesse período. Registre refeições e treinos que
                o resumo fica cheio de novidades.
              </p>
            )}
            <ul className="space-y-2">
              {items.map((i, n) => (
                <li
                  key={n}
                  className={`flex gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold ${TONE[i.tone]}`}
                >
                  <span className="text-lg">{i.emoji}</span>
                  <span>{i.text}</span>
                </li>
              ))}
            </ul>
            <ErrorText error={shareError} />
            <Button
              className="w-full"
              loading={sharing}
              disabled={!data.hasData}
              onClick={() => void share()}
            >
              📲 Compartilhar no Stories
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function dismissedKey(kind: Kind, start: string) {
  return `insights-dismissed:${kind}:${start}`;
}

function isDismissed(kind: Kind, start: string) {
  try {
    return localStorage.getItem(dismissedKey(kind, start)) === "1";
  } catch {
    return false;
  }
}

export function InsightsBanner() {
  const now = new Date();
  const monthly = now.getDate() <= 5;
  const weekly = [1, 2, 3].includes(now.getDay());
  const kind: Kind = monthly ? "month" : "week";
  const { data } = useInsights(kind, monthly || weekly);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (!data || !data.hasData || hidden || isDismissed(kind, data.start)) {
    return null;
  }
  const top = data.items.find((i) => i.tone === "good") ?? data.items[0];
  return (
    <Card className="bg-[#efeaff]">
      <div className="flex items-start justify-between gap-2">
        <button className="flex-1 text-left" onClick={() => setOpen(true)}>
          <span className="block text-lg font-extrabold">
            {kind === "week"
              ? "📊 Sua semana chegou!"
              : "🗓️ Retrospectiva do mês"}
          </span>
          {top && (
            <span className="mt-1 block text-sm text-ink/70">
              {top.emoji} {top.text}
            </span>
          )}
          <span className="mt-2 inline-block text-sm font-bold text-[#6b5bd6]">
            Ver resumo completo ›
          </span>
        </button>
        <button
          onClick={() => {
            try {
              localStorage.setItem(dismissedKey(kind, data.start), "1");
            } catch {
              /* armazenamento indisponível */
            }
            setHidden(true);
          }}
          className="px-1 text-ink/30"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
      <InsightsSheet
        open={open}
        onClose={() => setOpen(false)}
        initial={kind}
      />
    </Card>
  );
}
