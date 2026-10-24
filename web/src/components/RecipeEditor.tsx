import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, MEAL_LABEL, type MealType, type Recipe } from "../lib/api";
import { Button, ErrorText, Field, inputClass, Sheet } from "./ui";

const EMOJIS = [
  "🍽️",
  "🥗",
  "🍗",
  "🥩",
  "🐟",
  "🍳",
  "🥞",
  "🍝",
  "🍲",
  "🥪",
  "🌯",
  "🍕",
  "🥤",
  "🍓",
  "🍰",
  "🥑",
];

interface Draft {
  title: string;
  emoji: string;
  meal: MealType;
  prepMinutes: string;
  servings: string;
  servingG: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  ingredients: { item: string; quantity: string }[];
  steps: string;
  tip: string;
}

type Parsed = Omit<Recipe, "id" | "favorite" | "custom" | "createdAt">;

const EMPTY: Draft = {
  title: "",
  emoji: "🍽️",
  meal: "LUNCH",
  prepMinutes: "",
  servings: "1",
  servingG: "",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  ingredients: [{ item: "", quantity: "" }],
  steps: "",
  tip: "",
};

function toDraft(r: Parsed): Draft {
  return {
    title: r.title,
    emoji: r.emoji,
    meal: r.meal,
    prepMinutes: String(r.prepMinutes),
    servings: String(r.servings),
    servingG: String(Math.round(r.servingG)),
    kcal: String(Math.round(r.kcal)),
    protein: String(Math.round(r.protein)),
    carbs: String(Math.round(r.carbs)),
    fat: String(Math.round(r.fat)),
    fiber: String(Math.round(r.fiber)),
    ingredients: r.ingredients.length
      ? r.ingredients
      : [{ item: "", quantity: "" }],
    steps: r.steps.join("\n"),
    tip: r.tip ?? "",
  };
}

function draftAsText(d: Draft): string {
  return [
    d.title,
    `Rende ${d.servings} porções`,
    "Ingredientes:",
    ...d.ingredients
      .filter((i) => i.item.trim())
      .map((i) => `- ${i.quantity} ${i.item}`),
    "Modo de preparo:",
    d.steps,
  ].join("\n");
}

const num = (v: string) => parseFloat(v.replace(",", ".")) || 0;

export function RecipeEditor({
  open,
  recipe,
  onClose,
  onSaved,
}: {
  open: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onSaved: (r: Recipe) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [pasted, setPasted] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const openKey = open ? (recipe?.id ?? "new") : null;
  if (openKey !== key) {
    setKey(openKey);
    setDraft(recipe ? toDraft(recipe) : EMPTY);
    setPasted("");
  }

  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const organize = useMutation({
    mutationFn: (text: string) => api.post<Parsed>("/recipes/parse", { text }),
    onSuccess: (r) => setDraft(toDraft(r)),
  });

  const recalc = useMutation({
    mutationFn: () =>
      api.post<Parsed>("/recipes/parse", { text: draftAsText(draft) }),
    onSuccess: (r) =>
      setDraft((d) => ({
        ...d,
        servingG: String(Math.round(r.servingG)),
        kcal: String(Math.round(r.kcal)),
        protein: String(Math.round(r.protein)),
        carbs: String(Math.round(r.carbs)),
        fat: String(Math.round(r.fat)),
        fiber: String(Math.round(r.fiber)),
      })),
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: draft.title.trim(),
        emoji: draft.emoji,
        meal: draft.meal,
        prepMinutes: Math.round(num(draft.prepMinutes)),
        servings: Math.max(1, Math.round(num(draft.servings))),
        servingG: num(draft.servingG),
        kcal: num(draft.kcal),
        protein: num(draft.protein),
        carbs: num(draft.carbs),
        fat: num(draft.fat),
        fiber: num(draft.fiber),
        ingredients: draft.ingredients
          .filter((i) => i.item.trim())
          .map((i) => ({ item: i.item.trim(), quantity: i.quantity.trim() })),
        steps: draft.steps
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        tip: draft.tip.trim() || undefined,
      };
      return recipe
        ? api.put<Recipe>(`/recipes/${recipe.id}`, body)
        : api.post<Recipe>("/recipes", body);
    },
    onSuccess: (r) => {
      qc.setQueryData<Recipe[]>(["recipes"], (old = []) =>
        recipe ? old.map((o) => (o.id === r.id ? r : o)) : [r, ...old],
      );
      void qc.invalidateQueries({ queryKey: ["game"] });
      onSaved(r);
    },
  });

  const updateIngredient = (
    idx: number,
    patch: Partial<Draft["ingredients"][number]>,
  ) =>
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((i, n) =>
        n === idx ? { ...i, ...patch } : i,
      ),
    }));

  const busy = organize.isPending || recalc.isPending;
  const canSave =
    draft.title.trim().length >= 2 && num(draft.kcal) > 0 && !busy;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={recipe ? "Editar receita" : "Minha receita"}
    >
      <div className="space-y-4 pb-4">
        {!recipe && (
          <section className="space-y-2 rounded-3xl bg-mint-50 p-4">
            <h3 className="font-extrabold">✨ Jeito rápido</h3>
            <p className="text-sm text-ink/60">
              Cole ou escreva a receita do seu jeito (pode ser copiada de
              qualquer lugar). A IA organiza e calcula as calorias, mantendo
              suas quantidades.
            </p>
            <textarea
              className={`${inputClass} min-h-32`}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={
                "Ex.: Panqueca de banana\n2 ovos, 1 banana, 2 colheres de aveia\nAmasse tudo e faça na frigideira. Rende 2."
              }
            />
            <ErrorText error={organize.error} />
            <Button
              className="w-full"
              loading={organize.isPending}
              disabled={pasted.trim().length < 5}
              onClick={() => organize.mutate(pasted)}
            >
              {organize.isPending ? "Organizando..." : "Organizar com IA"}
            </Button>
          </section>
        )}

        <Field label="Nome da receita">
          <input
            className={inputClass}
            value={draft.title}
            onChange={set("title")}
          />
        </Field>
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, emoji: e }))}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl ${
                draft.emoji === e
                  ? "bg-mint-100 ring-2 ring-mint-500"
                  : "bg-soft"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Refeição">
            <select
              className={inputClass}
              value={draft.meal}
              onChange={set("meal")}
            >
              {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preparo (min)">
            <input
              className={inputClass}
              inputMode="numeric"
              value={draft.prepMinutes}
              onChange={set("prepMinutes")}
            />
          </Field>
          <Field label="Porções">
            <input
              className={inputClass}
              inputMode="numeric"
              value={draft.servings}
              onChange={set("servings")}
            />
          </Field>
        </div>

        <section>
          <h3 className="mb-2 font-extrabold">Ingredientes</h3>
          <div className="space-y-2">
            {draft.ingredients.map((ing, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  className={`${inputClass} w-28 shrink-0`}
                  placeholder="Qtd."
                  value={ing.quantity}
                  onChange={(e) =>
                    updateIngredient(idx, { quantity: e.target.value })
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Ingrediente"
                  value={ing.item}
                  onChange={(e) =>
                    updateIngredient(idx, { item: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="shrink-0 px-2 text-ink/40"
                  aria-label="Remover ingrediente"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      ingredients: d.ingredients.filter((_, n) => n !== idx),
                    }))
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-sm font-bold text-mint-500"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                ingredients: [...d.ingredients, { item: "", quantity: "" }],
              }))
            }
          >
            + Adicionar ingrediente
          </button>
        </section>

        <Field label="Modo de preparo (um passo por linha)">
          <textarea
            className={`${inputClass} min-h-28`}
            value={draft.steps}
            onChange={set("steps")}
          />
        </Field>

        <section className="space-y-3 rounded-3xl bg-soft p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-extrabold">Nutrientes por porção</h3>
            <button
              type="button"
              disabled={busy || !draft.ingredients.some((i) => i.item.trim())}
              onClick={() => recalc.mutate()}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            >
              {recalc.isPending ? "Calculando..." : "✨ Calcular com IA"}
            </button>
          </div>
          <ErrorText error={recalc.error} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="kcal">
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.kcal}
                onChange={set("kcal")}
              />
            </Field>
            <Field label="Proteína (g)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.protein}
                onChange={set("protein")}
              />
            </Field>
            <Field label="Carbo (g)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.carbs}
                onChange={set("carbs")}
              />
            </Field>
            <Field label="Gordura (g)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.fat}
                onChange={set("fat")}
              />
            </Field>
            <Field label="Fibra (g)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.fiber}
                onChange={set("fiber")}
              />
            </Field>
            <Field label="1 porção (g)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={draft.servingG}
                onChange={set("servingG")}
              />
            </Field>
          </div>
        </section>

        <Field label="Dica (opcional)">
          <input
            className={inputClass}
            value={draft.tip}
            onChange={set("tip")}
          />
        </Field>

        <ErrorText error={save.error} />
        {!canSave && !busy && draft.title.trim() && (
          <p className="text-center text-xs text-ink/50">
            Preencha as calorias (ou toque em ✨ Calcular com IA) para salvar.
          </p>
        )}
        <Button
          className="w-full"
          loading={save.isPending}
          disabled={!canSave}
          onClick={() => save.mutate()}
        >
          Salvar receita
        </Button>
      </div>
    </Sheet>
  );
}
