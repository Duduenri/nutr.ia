import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Svg } from "../components/Svg";
import { Button, ErrorText, Sheet, Spinner } from "../components/ui";
import { api, type GameState, type ShopItem, type ShopState } from "../lib/api";
import { today } from "../lib/date";
import { useGame } from "../lib/hooks";
import { gardenItemSvg, petSvg, sceneSvg, withItem } from "../lib/pet";
import { GemBadge } from "./PetHome";

export function ItemPreview({
  item,
  level,
  equipped,
  all,
  className = "h-20 w-20",
}: {
  item: Pick<ShopItem, "id" | "slot">;
  level: number;
  equipped: string[];
  all: Pick<ShopItem, "id" | "slot">[];
  className?: string;
}) {
  if (item.slot === "garden")
    return <Svg markup={gardenItemSvg(item.id)} className={className} />;
  if (item.slot === "scene")
    return (
      <Svg
        markup={sceneSvg(Math.min(level, 3), [item.id])}
        className={`${className} overflow-hidden rounded-2xl`}
      />
    );
  const base = equipped.filter(
    (id) => all.find((i) => i.id === id)?.slot === "color",
  );
  return (
    <Svg
      markup={petSvg(Math.min(level, 3), withItem(base, item, all))}
      className={className}
    />
  );
}

type Tab = "today" | "pets" | "clothes" | "colors" | "garden" | "scenes";

export function ShopPage() {
  const navigate = useNavigate();
  const day = today();
  const { data: game } = useGame();
  const [tab, setTab] = useState<Tab>("today");
  const [open, setOpen] = useState<ShopItem | null>(null);
  const { data: shop, isLoading } = useQuery({
    queryKey: ["shop", day],
    queryFn: () => api.get<ShopState>(`/game/shop?today=${day}`),
  });

  const level = game?.level ?? 1;
  const equipped = game?.equipped ?? [];
  const items = shop?.items ?? [];
  const byId = (id: string) => items.find((i) => i.id === id);
  const dealItem = shop?.deal ? byId(shop.deal.itemId) : undefined;

  const grid = (list: ShopItem[]) => (
    <div className="grid grid-cols-3 gap-3">
      {list.map((i) => (
        <button
          key={i.id}
          onClick={() => setOpen(i)}
          className="relative flex flex-col items-center gap-1 rounded-3xl border-2 border-slate-100 bg-white p-2"
        >
          {i.locked && (
            <span className="absolute left-2 top-2 text-sm">🔒</span>
          )}
          <ItemPreview item={i} level={level} equipped={equipped} all={items} />
          <span className="text-xs font-bold text-ink/70">{i.name}</span>
          <span
            className={`text-sm font-extrabold ${i.owned ? "text-mint-500" : i.locked ? "text-sun" : ""}`}
          >
            {i.owned
              ? "✓ Seu"
              : i.locked
                ? `Nível ${i.minLevel}`
                : `💎 ${shop?.deal?.itemId === i.id ? shop.deal.price : i.price}`}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-white pb-10">
      <header className="sticky top-0 z-30 bg-[#fbf7ec]">
        <div className="flex h-10 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`h-20 flex-1 -translate-y-10 rounded-full ${i % 2 ? "bg-white" : "bg-peach-500"}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 place-items-center rounded-full text-2xl"
            aria-label="Fechar"
          >
            ✕
          </button>
          <h1 className="font-serif text-3xl font-bold">Loja</h1>
          <GemBadge gems={shop?.gems ?? game?.gems ?? 0} />
        </div>
        <div className="no-scrollbar flex overflow-x-auto border-b border-slate-100 bg-white">
          {(
            [
              ["today", "⏰ Hoje"],
              ["pets", "🐾 Pets"],
              ["clothes", "👕 Roupas"],
              ["colors", "🎨 Cores"],
              ["garden", "🌻 Jardim"],
              ["scenes", "🏝️ Cenários"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 grow border-b-4 px-3 py-3 text-sm font-extrabold ${
                tab === id
                  ? "border-peach-400"
                  : "border-transparent text-ink/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-6 px-4 pt-4">
        {isLoading && (
          <div className="py-10 text-center text-mint-500">
            <Spinner />
          </div>
        )}
        {tab === "today" && shop && (
          <>
            {dealItem && shop.deal ? (
              <button
                onClick={() => setOpen(dealItem)}
                className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-[#fff4d6] to-[#fde8d4] p-4 text-left"
              >
                <div className="flex-1">
                  <div className="text-xl font-extrabold">Item do dia</div>
                  <div className="text-xl font-extrabold text-peach-500">
                    50% OFF
                  </div>
                  <div className="mt-2 text-sm font-bold text-ink/60">
                    {dealItem.name}
                  </div>
                  <div className="mt-1 font-extrabold">
                    💎 {shop.deal.price}{" "}
                    <span className="text-sm text-ink/40 line-through">
                      {dealItem.price}
                    </span>
                  </div>
                </div>
                <div className="rounded-3xl bg-white p-2 shadow-card">
                  <ItemPreview
                    item={dealItem}
                    level={level}
                    equipped={equipped}
                    all={items}
                    className="h-28 w-28"
                  />
                </div>
              </button>
            ) : (
              <p className="rounded-3xl bg-soft p-4 text-center font-semibold text-ink/60">
                Você já tem todos os itens disponíveis pro seu nível! 🎉
              </p>
            )}
            <section>
              <h2 className="mb-3 text-lg font-extrabold">Itens de hoje</h2>
              {grid(
                shop.today.map(byId).filter((i): i is ShopItem => Boolean(i)),
              )}
            </section>
          </>
        )}
        {tab === "clothes" && (
          <>
            <section>
              <h2 className="mb-3 text-lg font-extrabold">
                Chapéus e acessórios
              </h2>
              {grid(items.filter((i) => i.slot === "hat"))}
            </section>
            <section>
              <h2 className="mb-3 text-lg font-extrabold">Óculos</h2>
              {grid(items.filter((i) => i.slot === "glasses"))}
            </section>
          </>
        )}
        {tab === "colors" && grid(items.filter((i) => i.slot === "color"))}
        {tab === "pets" && (
          <>
            <p className="rounded-3xl border-2 border-slate-100 p-4 text-sm text-ink/60">
              Transforme seu bichinho! Os pets são raros e caros: junte gemas
              com missões, conquistas, jogos e desafios. Chapéus, óculos e cores
              continuam valendo.
            </p>
            {grid(items.filter((i) => i.slot === "species"))}
          </>
        )}
        {tab === "scenes" && (
          <>
            <p className="rounded-3xl border-2 border-slate-100 p-4 text-sm text-ink/60">
              Mude o lugar onde seu bichinho mora. Os itens do jardim vão junto!
            </p>
            {grid(items.filter((i) => i.slot === "scene"))}
          </>
        )}
        {tab === "garden" && (
          <>
            <p className="rounded-3xl border-2 border-slate-100 p-4 text-sm text-ink/60">
              Decore o jardim do seu bichinho. Suba de nível para desbloquear
              itens novos!
            </p>
            {grid(items.filter((i) => i.slot === "garden"))}
          </>
        )}
      </div>
      <BuySheet
        item={open}
        shop={shop}
        game={game}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

function BuySheet({
  item,
  shop,
  game,
  onClose,
}: {
  item: ShopItem | null;
  shop: ShopState | undefined;
  game: GameState | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const day = today();
  const done = (g: GameState) => {
    qc.setQueryData(["game"], g);
    void qc.invalidateQueries({ queryKey: ["shop"] });
    onClose();
  };
  const buy = useMutation({
    mutationFn: () =>
      api.post<GameState>("/game/buy", { itemId: item!.id, today: day }),
    onSuccess: done,
  });
  const wear = useMutation({
    mutationFn: () =>
      api.post<GameState>("/game/equip", { itemId: item!.id, equipped: true }),
    onSuccess: (g) => {
      done(g);
      navigate("/bichinho");
    },
  });

  if (!item || !shop || !game)
    return (
      <Sheet open={false} onClose={onClose}>
        {null}
      </Sheet>
    );
  const price = shop.deal?.itemId === item.id ? shop.deal.price : item.price;
  const missing = price - shop.gems;
  const preview = withItem(game.equipped, item, shop.items);

  return (
    <Sheet open onClose={onClose} title={item.name}>
      <div className="space-y-4 pb-6">
        <Svg
          markup={sceneSvg(game.level, preview)}
          className="h-64 w-full overflow-hidden rounded-3xl"
        />
        <ErrorText error={buy.error ?? wear.error} />
        {item.owned ? (
          <Button
            className="w-full"
            loading={wear.isPending}
            onClick={() => wear.mutate()}
          >
            Usar agora
          </Button>
        ) : item.locked ? (
          <p className="rounded-2xl bg-sun/30 px-4 py-3 text-center font-bold">
            🔒 Desbloqueia no nível {item.minLevel}. Você está no nível{" "}
            {game.level}.
          </p>
        ) : missing > 0 ? (
          <p className="rounded-2xl bg-soft px-4 py-3 text-center font-bold text-ink/70">
            Faltam 💎 {missing} — resgate missões e conquistas pra ganhar mais!
          </p>
        ) : (
          <Button
            className="w-full"
            loading={buy.isPending}
            onClick={() => buy.mutate()}
          >
            Comprar por 💎 {price}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
