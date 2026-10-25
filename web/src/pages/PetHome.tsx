import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Svg } from "../components/Svg";
import {
  Button,
  ErrorText,
  inputClass,
  ProgressBar,
  Spinner,
} from "../components/ui";
import {
  api,
  type AchievementInfo,
  type GameState,
  type Missions,
} from "../lib/api";
import { today } from "../lib/date";
import { useGame } from "../lib/hooks";
import { sceneSvg } from "../lib/pet";

export function GemBadge({ gems }: { gems: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-mint-400 bg-white px-3 py-1 font-extrabold">
      💎 {gems.toLocaleString("pt-BR")}
    </span>
  );
}

function NamePet() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const save = useMutation({
    mutationFn: () => api.patch<GameState>("/game/pet", { name }),
    onSuccess: (g) => qc.setQueryData(["game"], g),
  });
  return (
    <div className="space-y-3 rounded-3xl bg-white p-4 shadow-card">
      <h2 className="text-lg font-extrabold">Seu bichinho chegou! 🌱</h2>
      <p className="text-sm text-ink/60">
        Ele cresce conforme você cuida da sua alimentação. Que nome você quer
        dar pra ele?
      </p>
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={name}
          maxLength={20}
          placeholder="Ex.: Brotinho"
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          className="shrink-0"
          loading={save.isPending}
          disabled={!name.trim()}
          onClick={() => save.mutate()}
        >
          Salvar
        </Button>
      </div>
      <ErrorText error={save.error} />
    </div>
  );
}

export function PetHomePage() {
  const { data: game, isLoading } = useGame();
  const day = today();
  const { data: missions } = useQuery({
    queryKey: ["missions", day],
    queryFn: () => api.get<Missions>(`/missions/${day}`),
  });
  const { data: achievements } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => api.get<AchievementInfo[]>("/game/achievements"),
  });

  if (isLoading || !game) {
    return (
      <div className="grid h-96 place-items-center text-mint-500">
        <Spinner />
      </div>
    );
  }

  const claimable = missions
    ? [...missions.daily, ...missions.weekly].filter(
        (m) => m.progress >= m.goal && !m.claimed,
      ).length +
      (missions.month.progress >= missions.month.goal && !missions.month.claimed
        ? 1
        : 0)
    : 0;
  const unlocked = achievements?.filter((a) => a.unlockedAt).length ?? 0;
  const span = game.next ? game.next - game.current : 1;

  return (
    <div>
      <div className="relative">
        <Svg
          markup={sceneSvg(game.level, game.equipped)}
          className="h-[62vh] max-h-[520px] w-full"
        />
        <div className="pt-safe absolute inset-x-0 top-0 px-4">
          <div className="flex items-center gap-3 rounded-full border-2 border-white bg-white/70 px-4 py-2 backdrop-blur">
            <span className="min-w-0 flex-1 truncate text-lg font-extrabold">
              {game.petName ?? "Seu bichinho"}
            </span>
            <span className="font-extrabold text-peach-500">
              Nível {game.level}
            </span>
            <div className="w-20">
              <ProgressBar
                value={game.next ? game.lifetimeGems - game.current : 1}
                max={span}
                color="bg-peach-400"
                className="h-3 bg-white"
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <GemBadge gems={game.gems} />
          </div>
        </div>
      </div>

      <div className="relative -mt-6 space-y-3 rounded-t-[2rem] bg-[#e7eeb8] px-4 pb-4 pt-4">
        {!game.petName && <NamePet />}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/loja"
            className="flex flex-col items-center gap-1 rounded-3xl bg-white/70 py-4 font-extrabold"
          >
            <span className="text-4xl">🛍️</span>
            Loja
          </Link>
          <Link
            to="/meus-itens"
            className="flex flex-col items-center gap-1 rounded-3xl bg-white/70 py-4 font-extrabold"
          >
            <span className="text-4xl">🧺</span>
            Meus itens
          </Link>
        </div>
        <Link
          to="/missoes"
          className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card"
        >
          <span className="text-3xl">🎯</span>
          <span className="flex-1">
            <span className="block font-extrabold">Missões</span>
            <span className="text-sm text-ink/60">
              Complete e resgate gemas
            </span>
          </span>
          {claimable > 0 && (
            <span className="rounded-full bg-peach-500 px-2.5 py-1 text-xs font-extrabold text-white">
              {claimable} pra resgatar
            </span>
          )}
          <span className="text-2xl text-ink/30">›</span>
        </Link>
        <Link
          to="/amigos"
          className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card"
        >
          <span className="text-3xl">👯‍♀️</span>
          <span className="flex-1">
            <span className="block font-extrabold">Amigos</span>
            <span className="text-sm text-ink/60">
              Ranking da semana e mandar força
            </span>
          </span>
          {game.friendsBadge > 0 && (
            <span className="rounded-full bg-peach-500 px-2.5 py-1 text-xs font-extrabold text-white">
              {game.friendsBadge}
            </span>
          )}
          <span className="text-2xl text-ink/30">›</span>
        </Link>
        <Link
          to="/conquistas"
          className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card"
        >
          <span className="text-3xl">🏆</span>
          <span className="flex-1">
            <span className="block font-extrabold">Conquistas</span>
            <span className="text-sm text-ink/60">
              {unlocked} de {achievements?.length ?? "–"} desbloqueadas
            </span>
          </span>
          <span className="text-2xl text-ink/30">›</span>
        </Link>
        <p className="px-2 text-center text-xs text-ink/50">
          {game.next
            ? `Faltam ${(game.next - game.lifetimeGems).toLocaleString("pt-BR")} gemas ganhas pro nível ${game.level + 1}. Seu bichinho cresce a cada nível!`
            : "Nível máximo! Seu bichinho está florindo 🌸"}
        </p>
      </div>
    </div>
  );
}
