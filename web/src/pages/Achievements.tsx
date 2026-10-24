import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShareAchievement } from "../components/AchievementPopup";
import { Button, ErrorText, Sheet, Spinner } from "../components/ui";
import { api, type AchievementInfo } from "../lib/api";

export function AchievementsPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<AchievementInfo | null>(null);
  const share = useShareAchievement();
  const { data, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => api.get<AchievementInfo[]>("/game/achievements"),
  });
  const unlocked = data?.filter((a) => a.unlockedAt).length ?? 0;

  return (
    <div>
      <header className="pt-safe flex items-center gap-3 bg-[#fde8d4] px-4 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl"
          aria-label="Voltar"
        >
          ‹
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">Conquistas 🏆</h1>
          <p className="text-sm text-ink/60">
            {unlocked} de {data?.length ?? "–"} desbloqueadas
          </p>
        </div>
      </header>
      {isLoading && (
        <div className="py-10 text-center text-mint-500">
          <Spinner />
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 p-4">
        {data?.map((a) => {
          const on = Boolean(a.unlockedAt);
          return (
            <button
              key={a.key}
              onClick={() => setOpen(a)}
              className={`flex flex-col items-center gap-1 rounded-3xl p-3 text-center shadow-card ${
                on ? "bg-white" : "bg-white/60"
              }`}
            >
              <span
                className={`grid h-16 w-16 place-items-center rounded-full text-4xl ${
                  on ? "bg-[#fde8d4]" : "bg-soft grayscale opacity-40"
                }`}
              >
                {on ? a.emoji : "🔒"}
              </span>
              <span
                className={`text-xs font-extrabold leading-tight ${on ? "" : "text-ink/40"}`}
              >
                {a.title}
              </span>
              <span className="text-[11px] font-bold text-mint-500">
                💎 {a.gems}
              </span>
            </button>
          );
        })}
      </div>
      <Sheet open={Boolean(open)} onClose={() => setOpen(null)}>
        {open && (
          <div className="space-y-3 pb-6 text-center">
            <div
              className={`mx-auto grid h-28 w-28 place-items-center rounded-full text-6xl ${
                open.unlockedAt
                  ? "bg-[#fde8d4]"
                  : "bg-soft grayscale opacity-50"
              }`}
            >
              {open.emoji}
            </div>
            <h2 className="text-2xl font-extrabold">{open.title}</h2>
            <p className="text-ink/60">{open.description}</p>
            <p className="font-extrabold text-mint-500">💎 {open.gems} gemas</p>
            {open.unlockedAt ? (
              <>
                <p className="text-sm text-ink/50">
                  Desbloqueada em{" "}
                  {new Date(open.unlockedAt).toLocaleDateString("pt-BR")}
                </p>
                <ErrorText error={share.error} />
                <Button
                  className="w-full"
                  loading={share.isPending}
                  onClick={() => share.mutate(open)}
                >
                  📲 Compartilhar no Stories
                </Button>
              </>
            ) : (
              <p className="rounded-2xl bg-soft px-4 py-3 text-sm font-semibold text-ink/60">
                Ainda bloqueada — continue firme que ela chega! 💪
              </p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
