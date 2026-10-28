import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Svg } from "../components/Svg";
import { ErrorText, Spinner } from "../components/ui";
import { api, type GameState, type ShopItem, type ShopState } from "../lib/api";
import { today } from "../lib/date";
import { useGame } from "../lib/hooks";
import { sceneSvg } from "../lib/pet";
import { ItemPreview } from "./Shop";

const FILTERS: { id: ShopItem["slot"] | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "hat", label: "🎩 Chapéus" },
  { id: "glasses", label: "🕶️ Óculos" },
  { id: "color", label: "🎨 Cores" },
  { id: "garden", label: "🌻 Jardim" },
  { id: "species", label: "🐾 Pets" },
  { id: "scene", label: "🏝️ Cenários" },
];

export function WardrobePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: game } = useGame();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const { data: shop, isLoading } = useQuery({
    queryKey: ["shop", today()],
    queryFn: () => api.get<ShopState>(`/game/shop?today=${today()}`),
  });

  const equip = useMutation({
    mutationFn: (v: { itemId: string; equipped: boolean }) =>
      api.post<GameState>("/game/equip", v),
    onSuccess: (g) => qc.setQueryData(["game"], g),
  });

  const owned = (shop?.items ?? []).filter(
    (i) => i.owned && (filter === "all" || i.slot === filter),
  );

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white pb-10">
      <div className="relative">
        {game && (
          <Svg
            markup={sceneSvg(game.level, game.equipped)}
            className="h-[42vh] w-full"
          />
        )}
        <button
          onClick={() => navigate(-1)}
          className="pt-safe absolute left-4 top-2 grid h-10 w-10 place-items-center rounded-full bg-white/80 text-xl"
          aria-label="Fechar"
        >
          ✕
        </button>
        <Link
          to="/loja"
          className="pt-safe absolute right-4 top-2 rounded-full bg-white/80 px-4 py-2 text-sm font-extrabold"
        >
          🛍️ Loja
        </Link>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
              filter === f.id ? "bg-ink text-white" : "bg-soft text-ink/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="px-4 pt-4">
        {isLoading && (
          <div className="text-center text-mint-500">
            <Spinner />
          </div>
        )}
        <ErrorText error={equip.error} />
        {!isLoading && owned.length === 0 && (
          <p className="py-8 text-center text-ink/60">
            Nada aqui ainda. Passa na{" "}
            <Link to="/loja" className="font-bold underline">
              loja
            </Link>{" "}
            🛍️
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          {game &&
            owned.map((i) => {
              const on = game.equipped.includes(i.id);
              return (
                <button
                  key={i.id}
                  disabled={equip.isPending}
                  onClick={() => {
                    if (i.slot === "color" && on) return;
                    equip.mutate({ itemId: i.id, equipped: !on });
                  }}
                  className={`relative flex flex-col items-center gap-1 rounded-3xl border-2 bg-white p-2 ${
                    on ? "border-mint-400 bg-mint-50" : "border-slate-100"
                  }`}
                >
                  {on && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-mint-500 text-xs text-white">
                      ✓
                    </span>
                  )}
                  <ItemPreview
                    item={i}
                    level={game.level}
                    equipped={game.equipped}
                    all={shop?.items ?? []}
                  />
                  <span className="text-xs font-bold text-ink/70">
                    {i.name}
                  </span>
                </button>
              );
            })}
        </div>
        <p className="mt-4 text-center text-xs text-ink/40">
          Toque pra vestir ou tirar.
        </p>
      </div>
    </div>
  );
}
