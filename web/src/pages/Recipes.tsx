import { ShoppingSheet } from "../components/Shopping";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Button,
  ErrorText,
  Field,
  fmt,
  inputClass,
  Segmented,
  Sheet,
  Spinner,
} from "../components/ui";
import {
  api,
  guessMeal,
  MEAL_LABEL,
  type MealType,
  type Recipe,
} from "../lib/api";
import { today } from "../lib/date";
import { useInvalidateDay } from "../lib/hooks";
import { RecipeEditor } from "../components/RecipeEditor";

const MEAL_GRADIENT: Record<MealType, string> = {
  BREAKFAST: "from-[#ffe7a8] to-[#f6c79a]",
  LUNCH: "from-[#c9eee3] to-[#7fcfbd]",
  DINNER: "from-[#d4e6fa] to-[#9db8dd]",
  SNACK: "from-[#fde1d6] to-[#f6a07c]",
};

const MEAL_FILTERS: { value: MealType | "ANY"; label: string }[] = [
  { value: "ANY", label: "Qualquer" },
  { value: "BREAKFAST", label: "Café" },
  { value: "LUNCH", label: "Almoço" },
  { value: "DINNER", label: "Jantar" },
  { value: "SNACK", label: "Lanche" },
];

export function RecipesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "fav" | "mine">("all");
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const [meal, setMeal] = useState<MealType | "ANY">("ANY");
  const [request, setRequest] = useState("");
  const [open, setOpen] = useState<Recipe | null>(null);
  const [shopping, setShopping] = useState(false);

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => api.get<Recipe[]>("/recipes"),
  });

  const generate = useMutation({
    mutationFn: () =>
      api.post<Recipe[]>("/recipes/generate", {
        today: today(),
        meal: meal === "ANY" ? undefined : meal,
        request: request.trim() || undefined,
      }),
    onSuccess: (created) => {
      qc.setQueryData<Recipe[]>(["recipes"], (old = []) => [
        ...created,
        ...old,
      ]);
      setTab("all");
    },
  });

  const shown =
    tab === "fav"
      ? recipes.filter((r) => r.favorite)
      : tab === "mine"
        ? recipes.filter((r) => r.custom)
        : recipes;

  return (
    <div>
      <header className="pt-safe bg-mint-100 px-4 pb-4">
        <h1 className="mb-1 text-2xl font-extrabold">Receitas 👩‍🍳</h1>
        <p className="mb-3 text-sm text-ink/60">
          Recomendadas pra suas metas e pro que falta comer hoje.
        </p>
        <div className="space-y-3 rounded-3xl bg-white p-4 shadow-card">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {MEAL_FILTERS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMeal(m.value)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${
                  meal === m.value ? "bg-ink text-white" : "bg-soft text-ink/70"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <input
            className={inputClass}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Algum pedido? Ex.: com frango, sem forno, até 20 min"
          />
          <ErrorText error={generate.error} />
          <Button
            className="w-full"
            loading={generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending
              ? "Criando receitas..."
              : "✨ Recomendar receitas"}
          </Button>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={() => setEditing("new")}>
            ＋ Minha receita
          </Button>
          <Button variant="soft" onClick={() => setShopping(true)}>
            🛒 Lista de compras
          </Button>
        </div>
        <Segmented
          options={[
            { value: "all", label: `Todas (${recipes.length})` },
            {
              value: "fav",
              label: `Favoritas (${recipes.filter((r) => r.favorite).length})`,
            },
            {
              value: "mine",
              label: `Minhas (${recipes.filter((r) => r.custom).length})`,
            },
          ]}
          value={tab}
          onChange={setTab}
        />
        {isLoading && (
          <div className="text-center text-mint-500">
            <Spinner />
          </div>
        )}
        {!isLoading && shown.length === 0 && (
          <p className="py-8 text-center text-ink/60">
            {tab === "fav"
              ? "Toque no ❤️ de uma receita pra guardar aqui."
              : tab === "mine"
                ? "Suas receitas aparecem aqui. Toque em “Adicionar minha receita”."
                : "Toque em “Recomendar receitas” e a IA cria opções pensadas pra você."}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 pb-4">
          {shown.map((r) => (
            <RecipeCard key={r.id} recipe={r} onOpen={() => setOpen(r)} />
          ))}
        </div>
      </div>
      <RecipeSheet
        recipe={open ? (recipes.find((r) => r.id === open.id) ?? open) : null}
        onClose={() => setOpen(null)}
        onEdit={(r) => {
          setOpen(null);
          setEditing(r);
        }}
      />
      <ShoppingSheet
        open={shopping}
        onClose={() => setShopping(false)}
        recipes={recipes}
      />
      <RecipeEditor
        open={editing !== null}
        recipe={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(r) => {
          setEditing(null);
          setTab("mine");
          setOpen(r);
        }}
      />
    </div>
  );
}

function RecipeCard({
  recipe,
  onOpen,
}: {
  recipe: Recipe;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="overflow-hidden rounded-3xl bg-white text-left shadow-card"
    >
      <div
        className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${MEAL_GRADIENT[recipe.meal]}`}
      >
        <span className="text-6xl drop-shadow">{recipe.emoji}</span>
        {recipe.favorite && (
          <span className="absolute right-2 top-2 text-lg">❤️</span>
        )}
        {recipe.custom && (
          <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-bold text-white">
            minha
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">
          {MEAL_LABEL[recipe.meal]}
        </span>
      </div>
      <div className="p-3">
        <div className="line-clamp-2 min-h-[2.5rem] font-serif text-base font-bold leading-tight">
          {recipe.title}
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="font-bold">{fmt(recipe.kcal)} kcal</span>
          <span className="text-ink/50">{recipe.prepMinutes} min</span>
        </div>
      </div>
    </button>
  );
}

function RecipeSheet({
  recipe,
  onClose,
  onEdit,
}: {
  onEdit: (r: Recipe) => void;
  recipe: Recipe | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const invalidate = useInvalidateDay();
  const [servings, setServings] = useState(1);
  const [meal, setMeal] = useState<MealType>(guessMeal());
  const [logged, setLogged] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (recipe && recipe.id !== lastId) {
    setLastId(recipe.id);
    setServings(1);
    setMeal(recipe.meal);
    setLogged(false);
  }

  const update = (r: Recipe) =>
    qc.setQueryData<Recipe[]>(["recipes"], (old = []) =>
      old.map((o) => (o.id === r.id ? r : o)),
    );

  const favorite = useMutation({
    mutationFn: () =>
      api.patch<Recipe>(`/recipes/${recipe!.id}`, {
        favorite: !recipe!.favorite,
      }),
    onSuccess: update,
  });
  const log = useMutation({
    mutationFn: () =>
      api.post(`/recipes/${recipe!.id}/log`, { date: today(), meal, servings }),
    onSuccess: () => {
      invalidate();
      setLogged(true);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/recipes/${recipe!.id}`),
    onSuccess: () => {
      qc.setQueryData<Recipe[]>(["recipes"], (old = []) =>
        old.filter((o) => o.id !== recipe!.id),
      );
      onClose();
    },
  });

  return (
    <Sheet open={Boolean(recipe)} onClose={onClose}>
      {recipe && (
        <div className="space-y-4 pb-4">
          <div
            className={`-mx-5 -mt-3 flex h-40 items-center justify-center bg-gradient-to-br ${MEAL_GRADIENT[recipe.meal]}`}
          >
            <span className="text-8xl drop-shadow">{recipe.emoji}</span>
          </div>
          <div className="flex items-start gap-3">
            <h2 className="flex-1 font-serif text-2xl font-bold leading-tight">
              {recipe.title}
            </h2>
            <button
              onClick={() => favorite.mutate()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-soft text-2xl"
              aria-label="Favoritar"
            >
              {recipe.favorite ? "❤️" : "🤍"}
            </button>
          </div>
          <p className="-mt-2 text-sm text-ink/60">
            ⏱ {recipe.prepMinutes} min · rende {recipe.servings}{" "}
            {recipe.servings === 1 ? "porção" : "porções"} de ~
            {fmt(recipe.servingG)} g
          </p>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            {[
              ["kcal", recipe.kcal, ""],
              ["Prot.", recipe.protein, "g"],
              ["Carbo", recipe.carbs, "g"],
              ["Gord.", recipe.fat, "g"],
            ].map(([label, value, unit]) => (
              <div key={label as string} className="rounded-2xl bg-soft py-2">
                <div className="font-extrabold">
                  {fmt(value as number)}
                  {unit}
                </div>
                <div className="text-ink/60">{label}</div>
              </div>
            ))}
          </div>
          <p className="-mt-2 text-center text-xs text-ink/50">
            valores por porção
          </p>

          <section>
            <h3 className="mb-2 text-lg font-extrabold">Ingredientes</h3>
            <ul className="space-y-1">
              {recipe.ingredients.map((i, idx) => (
                <li
                  key={idx}
                  className="flex justify-between gap-3 border-b border-slate-100 py-1.5"
                >
                  <span>{i.item}</span>
                  <span className="shrink-0 font-bold text-ink/70">
                    {i.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-lg font-extrabold">Modo de preparo</h3>
            <ol className="space-y-2">
              {recipe.steps.map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-100 text-sm font-extrabold">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>
          {recipe.tip && (
            <p className="rounded-2xl bg-sun/30 px-4 py-3 text-sm">
              💡 {recipe.tip}
            </p>
          )}

          <section className="space-y-3 rounded-3xl bg-mint-50 p-4">
            <h3 className="font-extrabold">Comi essa receita</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Porções">
                <select
                  className={inputClass}
                  value={servings}
                  onChange={(e) => setServings(parseFloat(e.target.value))}
                >
                  {[0.5, 1, 1.5, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {fmt(n, 1)} ({fmt(recipe.kcal * n)} kcal)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Refeição">
                <select
                  className={inputClass}
                  value={meal}
                  onChange={(e) => setMeal(e.target.value as MealType)}
                >
                  {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => (
                    <option key={m} value={m}>
                      {MEAL_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <ErrorText error={log.error} />
            <Button
              className="w-full"
              loading={log.isPending}
              disabled={logged}
              onClick={() => log.mutate()}
            >
              {logged
                ? "Registrado no diário ✓"
                : "Registrar no diário de hoje"}
            </Button>
          </section>
          <Button
            variant="soft"
            className="w-full"
            onClick={() => onEdit(recipe)}
          >
            ✏️ Editar receita
          </Button>
          <Button
            variant="ghost"
            className="w-full text-sm"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Apagar receita
          </Button>
        </div>
      )}
    </Sheet>
  );
}
