import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type AchievementInfo } from "../lib/api";
import { useGame } from "../lib/hooks";
import { shareStory } from "../lib/share";
import { Button, ErrorText } from "./ui";

export function useShareAchievement() {
  const { data: game } = useGame();
  return useMutation({
    mutationFn: (a: AchievementInfo) =>
      shareStory({
        kicker: "Nova conquista! 🎉",
        emoji: a.emoji,
        title: a.title,
        subtitle: a.description,
        badge: `+${a.gems} gemas 💎`,
        petLevel: game?.level ?? 1,
        petEquipped: game?.equipped ?? [],
      }),
  });
}

export function AchievementPopup() {
  const qc = useQueryClient();
  const { data: game } = useGame();
  const [index, setIndex] = useState(0);
  const share = useShareAchievement();
  const seen = useMutation({
    mutationFn: (keys: string[]) =>
      api.post("/game/achievements/seen", { keys }),
    onSuccess: () => {
      setIndex(0);
      void qc.invalidateQueries({ queryKey: ["game"] });
    },
  });

  const list = game?.newAchievements ?? [];
  if (!list.length || seen.isPending) return null;
  const a = list[Math.min(index, list.length - 1)];
  const last = index >= list.length - 1;
  const close = () => seen.mutate(list.map((x) => x.key));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-white text-center shadow-2xl">
        <div className="bg-gradient-to-b from-mint-100 to-[#fdf3e7] px-6 pb-6 pt-8">
          <p className="text-sm font-extrabold uppercase tracking-wide text-mint-500">
            Nova conquista! {list.length > 1 && `(${index + 1}/${list.length})`}
          </p>
          <div className="mx-auto mt-6 grid h-32 w-32 place-items-center rounded-full bg-white text-7xl shadow-card">
            {a.emoji}
          </div>
        </div>
        <div className="space-y-3 px-6 pb-6 pt-4">
          <h2 className="text-2xl font-extrabold">{a.title}</h2>
          <p className="text-ink/60">{a.description}</p>
          <p className="mx-auto w-fit rounded-full bg-mint-50 px-4 py-1.5 font-extrabold text-mint-500">
            +{a.gems} gemas 💎
          </p>
          <ErrorText error={share.error} />
          <Button
            className="w-full"
            loading={share.isPending}
            onClick={() => share.mutate(a)}
          >
            📲 Compartilhar no Stories
          </Button>
          {last ? (
            <Button variant="ghost" className="w-full" onClick={close}>
              Fechar
            </Button>
          ) : (
            <Button
              variant="soft"
              className="w-full"
              onClick={() => setIndex(index + 1)}
            >
              Próxima conquista ›
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
