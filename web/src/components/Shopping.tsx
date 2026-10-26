import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Recipe } from "../lib/api";
import { Button, ErrorText, inputClass, Segmented, Sheet, Spinner } from "./ui";

const CATEGORIES = [
  "Hortifruti",
  "Açougue e peixaria",
  "Frios e laticínios",
  "Padaria",
  "Mercearia",
  "Bebidas",
  "Congelados",
  "Outros",
];

const CATEGORY_EMOJI: Record<string, string> = {
  Hortifruti: "🥬",
  "Açougue e peixaria": "🥩",
  "Frios e laticínios": "🧀",
  Padaria: "🥖",
  Mercearia: "🥫",
  Bebidas: "🧃",
  Congelados: "🧊",
  Outros: "🛒",
};

interface Item {
  name: string;
  quantity: string;
  category: string;
  checked: boolean;
}

interface ShoppingList {
  id: string;
  title: string;
  items: Item[];
  updatedAt: string;
}

export function ShoppingSheet({
  open,
  onClose,
  recipes,
}: {
  open: boolean;
  onClose: () => void;
  recipes: Recipe[];
}) {
  const { data: lists, isLoading } = useQuery({
    queryKey: ["shopping"],
    queryFn: () => api.get<ShoppingList[]>("/shopping"),
    enabled: open,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const current =
    lists?.find((l) => l.id === selected) ?? (creating ? null : lists?.[0]);

  return (
    <Sheet open={open} onClose={onClose} title="🛒 Lista de compras">
      <div className="pb-6">
        {isLoading ? (
          <Spinner />
        ) : current ? (
          <ListView
            list={current}
            others={lists!.filter((l) => l.id !== current.id)}
            onPick={setSelected}
            onNew={() => {
              setSelected(null);
              setCreating(true);
            }}
          />
        ) : (
          <Generator
            recipes={recipes}
            onCreated={(id) => {
              setCreating(false);
              setSelected(id);
            }}
            onCancel={
              lists?.length
                ? () => {
                    setCreating(false);
                  }
                : undefined
            }
          />
        )}
      </div>
    </Sheet>
  );
}

function Generator({
  recipes,
  onCreated,
  onCancel,
}: {
  recipes: Recipe[];
  onCreated: (id: string) => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const [source, setSource] = useState<"plan" | "recipes">("plan");
  const [picked, setPicked] = useState<string[]>([]);
  const [people, setPeople] = useState(1);
  const [days, setDays] = useState(7);
  const generate = useMutation({
    mutationFn: () =>
      api.post<ShoppingList>("/shopping/generate", {
        source,
        recipeIds: source === "recipes" ? picked : undefined,
        people,
        days: source === "plan" ? days : 1,
      }),
    onSuccess: (l) => {
      void qc.invalidateQueries({ queryKey: ["shopping"] });
      onCreated(l.id);
    },
  });
  const blank = useMutation({
    mutationFn: () =>
      api.post<ShoppingList>("/shopping", { title: "Minha lista" }),
    onSuccess: (l) => {
      void qc.invalidateQueries({ queryKey: ["shopping"] });
      onCreated(l.id);
    },
  });
  const sorted = [...recipes].sort(
    (a, b) => Number(b.favorite) - Number(a.favorite),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/60">
        A IA junta os ingredientes, soma as quantidades e separa por seção do
        mercado.
      </p>
      <Segmented
        options={[
          { value: "plan" as const, label: "Do plano alimentar" },
          { value: "recipes" as const, label: "De receitas" },
        ]}
        value={source}
        onChange={setSource}
      />
      {source === "plan" ? (
        <div>
          <span className="mb-1 block text-sm font-semibold text-ink/70">
            Compras pra quantos dias?
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[3, 7, 14].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-2xl py-2.5 text-sm font-bold ${days === d ? "bg-ink text-white" : "bg-soft"}`}
              >
                {d} dias
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink/50">
            Usa seu último plano alimentar do Coach.
          </p>
        </div>
      ) : (
        <div>
          <span className="mb-1 block text-sm font-semibold text-ink/70">
            Quais receitas você vai fazer?
          </span>
          {sorted.length === 0 ? (
            <p className="text-sm text-ink/60">
              Você ainda não tem receitas salvas.
            </p>
          ) : (
            <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
              {sorted.map((r) => {
                const on = picked.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() =>
                      setPicked(
                        on
                          ? picked.filter((id) => id !== r.id)
                          : [...picked, r.id],
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-left text-xs font-bold ${on ? "bg-ink text-white" : "bg-soft"}`}
                  >
                    {r.favorite ? "❤️ " : ""}
                    {r.emoji} {r.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between rounded-2xl bg-soft px-4 py-2">
        <span className="text-sm font-bold">Pra quantas pessoas?</span>
        <span className="flex items-center gap-3">
          <button
            onClick={() => setPeople(Math.max(1, people - 1))}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-bold"
          >
            −
          </button>
          <span className="w-4 text-center font-extrabold">{people}</span>
          <button
            onClick={() => setPeople(Math.min(10, people + 1))}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-bold"
          >
            +
          </button>
        </span>
      </div>
      <ErrorText error={generate.error ?? blank.error} />
      <Button
        className="w-full"
        loading={generate.isPending}
        disabled={source === "recipes" && picked.length === 0}
        onClick={() => generate.mutate()}
      >
        {generate.isPending ? "Montando a lista..." : "✨ Gerar lista"}
      </Button>
      <div className="flex justify-center gap-4">
        <button
          className="text-sm font-bold text-ink/50"
          disabled={blank.isPending}
          onClick={() => blank.mutate()}
        >
          Começar lista vazia
        </button>
        {onCancel && (
          <button className="text-sm font-bold text-ink/50" onClick={onCancel}>
            Voltar
          </button>
        )}
      </div>
    </div>
  );
}

function ListView({
  list,
  others,
  onPick,
  onNew,
}: {
  list: ShoppingList;
  others: ShoppingList[];
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [shared, setShared] = useState(false);

  const save = useMutation({
    mutationFn: (items: Item[]) =>
      api.patch<ShoppingList>(`/shopping/${list.id}`, { items }),
    onMutate: (items) => {
      qc.setQueryData<ShoppingList[]>(["shopping"], (old = []) =>
        old.map((l) => (l.id === list.id ? { ...l, items } : l)),
      );
    },
    onError: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/shopping/${list.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });

  const items = list.items;
  const done = items.filter((i) => i.checked).length;
  const toggle = (idx: number) =>
    save.mutate(
      items.map((i, j) => (j === idx ? { ...i, checked: !i.checked } : i)),
    );
  const add = () => {
    if (!name.trim()) return;
    save.mutate([
      ...items,
      {
        name: name.trim(),
        quantity: qty.trim(),
        category: "Outros",
        checked: false,
      },
    ]);
    setName("");
    setQty("");
  };
  const share = async () => {
    const text = [
      `🛒 ${list.title}`,
      ...CATEGORIES.flatMap((c) => {
        const inCat = items.filter((i) => i.category === c && !i.checked);
        return inCat.length
          ? [
              "",
              `${CATEGORY_EMOJI[c]} ${c}`,
              ...inCat.map(
                (i) => `• ${i.name}${i.quantity ? ` — ${i.quantity}` : ""}`,
              ),
            ]
          : [];
      }),
    ].join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await navigator.clipboard?.writeText(text);
    setShared(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-extrabold">{list.title}</h3>
        <p className="text-sm font-bold text-ink/50">
          {done}/{items.length} no carrinho
        </p>
      </div>
      {CATEGORIES.map((c) => {
        const inCat = items
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => item.category === c);
        if (!inCat.length) return null;
        return (
          <div key={c}>
            <h4 className="mb-1 text-sm font-extrabold text-ink/60">
              {CATEGORY_EMOJI[c]} {c}
            </h4>
            <ul className="space-y-1">
              {inCat.map(({ item, idx }) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 rounded-2xl bg-soft px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-mint-500"
                    checked={item.checked}
                    onChange={() => toggle(idx)}
                  />
                  <button
                    onClick={() => toggle(idx)}
                    className={`min-w-0 flex-1 text-left ${item.checked ? "text-ink/40 line-through" : ""}`}
                  >
                    <span className="font-bold">{item.name}</span>
                    {item.quantity && (
                      <span className="text-sm text-ink/60">
                        {" "}
                        · {item.quantity}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() =>
                      save.mutate(items.filter((_, j) => j !== idx))
                    }
                    className="px-1 text-ink/30"
                    aria-label="Remover item"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className={`${inputClass} min-w-0 flex-1`}
          placeholder="Adicionar item"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={`${inputClass} w-24`}
          placeholder="Qtd"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <Button className="shrink-0 px-4" disabled={!name.trim()}>
          +
        </Button>
      </form>
      <ErrorText error={save.error ?? remove.error} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => void share()}>
          {shared ? "Copiado ✓" : "📲 Compartilhar"}
        </Button>
        <Button variant="soft" onClick={onNew}>
          ✨ Nova lista
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-sm font-bold text-ink/50">
        {done > 0 && (
          <button
            onClick={() =>
              save.mutate(items.map((i) => ({ ...i, checked: false })))
            }
          >
            Desmarcar tudo
          </button>
        )}
        <button
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Apagar a lista "${list.title}"?`))
              remove.mutate();
          }}
        >
          Apagar lista
        </button>
      </div>
      {others.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold text-ink/50">Outras listas</p>
          <div className="flex flex-wrap gap-1.5">
            {others.map((l) => (
              <button
                key={l.id}
                onClick={() => onPick(l.id)}
                className="rounded-full bg-soft px-3 py-1.5 text-xs font-bold"
              >
                {l.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
