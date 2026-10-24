import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  api,
  foodToItem,
  guessMeal,
  type Diary,
  type Food,
  type FoodAnalysis,
  type Supplement,
} from "../lib/api";
import { today } from "../lib/date";
import { useInvalidateDay } from "../lib/hooks";
import {
  Button,
  Card,
  ErrorText,
  Field,
  fmt,
  inputClass,
  ProgressBar,
  Sheet,
  Spinner,
} from "./ui";

export function ProteinCard({ diary }: { diary: Diary }) {
  const [lookup, setLookup] = useState(false);
  const eaten = diary.totals.protein;
  const target = diary.targets.protein ?? 60;
  const missing = Math.max(0, target - eaten);
  const sources = diary.meals
    .flatMap((m) => m.entries)
    .filter((e) => e.protein >= 0.5)
    .sort((a, b) => b.protein - a.protein)
    .slice(0, 5);

  return (
    <Card className="border-2 border-[#fde1d6]">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-extrabold">🥩 Proteína hoje</h3>
        <span className="text-2xl font-extrabold">
          {fmt(eaten)}
          <span className="text-base font-bold text-ink/50">
            {" "}
            / {fmt(target)} g
          </span>
        </span>
      </div>
      <ProgressBar
        value={eaten}
        max={target}
        color={missing === 0 ? "bg-mint-500" : "bg-peach-400"}
        className="mt-2 h-4"
      />
      <p
        className={`mt-2 text-sm font-bold ${missing === 0 ? "text-mint-500" : "text-ink/60"}`}
      >
        {missing === 0
          ? "Meta de proteína batida! 💪"
          : `Faltam ${fmt(missing)} g de proteína`}
      </p>
      {sources.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {sources.map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span className="truncate text-ink/70">{e.name}</span>
              <span className="shrink-0 font-bold">{fmt(e.protein, 1)} g</span>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="soft"
        className="mt-3 w-full"
        onClick={() => setLookup(true)}
      >
        🔎 Quanto de proteína tem…?
      </Button>
      <ProteinLookup open={lookup} onClose={() => setLookup(false)} />
    </Card>
  );
}

function ProteinLookup({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateDay();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["foods", debounced],
    queryFn: () =>
      api.get<Food[]>(`/foods/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length >= 2,
  });

  const ai = useMutation({
    mutationFn: () => api.post<FoodAnalysis>("/ai/text", { text: q.trim() }),
  });

  const add = useMutation({
    mutationFn: () => {
      const item = foodToItem(
        picked!,
        parseFloat(grams.replace(",", ".")) || 0,
      );
      return api.post("/entries", {
        date: today(),
        meal: guessMeal(),
        source: "SEARCH",
        items: [
          {
            name: item.name,
            grams: item.grams,
            kcal: item.kcal,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber ?? undefined,
            micros: item.micros ?? undefined,
            foodId: item.foodId ?? undefined,
          },
        ],
      });
    },
    onSuccess: () => {
      invalidate();
      setPicked(null);
    },
  });

  const g = parseFloat(grams.replace(",", ".")) || 0;
  const pickedItem = picked ? foodToItem(picked, g) : null;

  return (
    <Sheet open={open} onClose={onClose} title="Quanto de proteína tem?">
      <div className="space-y-3 pb-6">
        <input
          className={inputClass}
          placeholder="Ex.: banana, ovo, peito de frango, iogurte"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPicked(null);
            ai.reset();
          }}
          autoFocus
        />
        {pickedItem && picked ? (
          <div className="space-y-3 rounded-3xl bg-[#fdf3e7] p-4">
            <div className="font-extrabold">{picked.name}</div>
            <div className="flex items-center gap-3">
              <input
                className={`${inputClass} w-28`}
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
              />
              <span className="font-bold text-ink/60">gramas</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ...new Set(
                  [picked.servingG, 50, 100, 150, 200].filter(
                    (v): v is number => Boolean(v),
                  ),
                ),
              ].map((c) => (
                <button
                  key={c}
                  onClick={() => setGrams(String(c))}
                  className="rounded-full bg-white px-3 py-1.5 text-sm font-bold"
                >
                  {c} g
                </button>
              ))}
            </div>
            <div className="text-center">
              <div className="text-4xl font-extrabold">
                {fmt(pickedItem.protein, 1)} g
              </div>
              <div className="text-sm font-bold text-ink/60">
                de proteína · {fmt(pickedItem.kcal)} kcal
              </div>
            </div>
            <ErrorText error={add.error} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="soft" onClick={() => setPicked(null)}>
                Voltar
              </Button>
              <Button
                loading={add.isPending}
                disabled={g <= 0}
                onClick={() => add.mutate()}
              >
                Comi isso
              </Button>
            </div>
            {add.isSuccess && (
              <p className="text-center text-sm font-bold text-mint-500">
                Registrado ✓
              </p>
            )}
          </div>
        ) : (
          <>
            {isFetching && (
              <div className="text-center text-mint-500">
                <Spinner />
              </div>
            )}
            <ul className="space-y-2">
              {data?.slice(0, 15).map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => {
                      setPicked(f);
                      setGrams(String(f.servingG ?? 100));
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-soft px-4 py-3 text-left"
                  >
                    <span className="min-w-0 font-bold">{f.name}</span>
                    <span className="shrink-0 text-right">
                      <span className="block font-extrabold">
                        {fmt(f.per100g.protein, 1)} g
                      </span>
                      <span className="text-xs text-ink/50">
                        proteína /100 g
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {debounced.length >= 2 && !isFetching && (
              <div className="space-y-2 rounded-3xl border-2 border-slate-100 p-3">
                <p className="text-sm text-ink/60">
                  {data?.length
                    ? "Não é nenhum desses?"
                    : "Não achei na tabela."}{" "}
                  Escreva com a quantidade (ex.: “1 scoop de whey”, “2 fatias de
                  peito de peru”) e a IA calcula:
                </p>
                <Button
                  variant="soft"
                  className="w-full"
                  loading={ai.isPending}
                  onClick={() => ai.mutate()}
                >
                  ✨ Calcular “{q.trim()}” com IA
                </Button>
                <ErrorText error={ai.error} />
                {ai.data?.items.map((i, n) => (
                  <div
                    key={n}
                    className="flex justify-between rounded-2xl bg-[#fdf3e7] px-4 py-2"
                  >
                    <span className="font-bold">
                      {i.name}{" "}
                      <span className="text-ink/50">({fmt(i.grams)} g)</span>
                    </span>
                    <span className="font-extrabold">
                      {fmt(i.protein, 1)} g prot.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

const PRESETS = [
  {
    name: "Whey protein",
    emoji: "🥤",
    dose: "1 scoop (30 g)",
    proteinG: 24,
    kcal: 120,
  },
  {
    name: "Shake proteico pronto",
    emoji: "🧃",
    dose: "250 ml",
    proteinG: 25,
    kcal: 150,
  },
  { name: "Multivitamínico", emoji: "💊", dose: "1 cápsula" },
  { name: "Vitamina B12", emoji: "💊", dose: "1 comprimido" },
  { name: "Ferro", emoji: "🩸", dose: "1 comprimido" },
  { name: "Cálcio citrato", emoji: "🦴", dose: "1 comprimido" },
  { name: "Vitamina D", emoji: "☀️", dose: "1 cápsula" },
];

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SupplementsCard({ date }: { date: string }) {
  const qc = useQueryClient();
  const invalidate = useInvalidateDay();
  const [editing, setEditing] = useState<Supplement | "new" | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["supplements", date],
    queryFn: () => api.get<Supplement[]>(`/supplements?date=${date}`),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["supplements"] });
    invalidate();
  };
  const take = useMutation({
    mutationFn: (id: string) =>
      api.post(`/supplements/${id}/take`, {
        date,
        takenAt:
          date === today()
            ? undefined
            : new Date(`${date}T12:00:00`).toISOString(),
      }),
    onSuccess: refresh,
  });
  const untake = useMutation({
    mutationFn: (logId: string) => api.del(`/supplements/logs/${logId}`),
    onSuccess: refresh,
  });

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-extrabold">💊 Reposição</h3>
        <button
          onClick={() => setEditing("new")}
          className="text-sm font-bold text-mint-500"
        >
          + Adicionar
        </button>
      </div>
      {isLoading && <Spinner />}
      {!isLoading && data.length === 0 && (
        <p className="mt-2 text-sm text-ink/60">
          Cadastre os suplementos e vitaminas que seu nutricionista passou. Aí é
          só tocar em “Tomei” e o horário fica registrado.
        </p>
      )}
      <ErrorText error={take.error ?? untake.error} />
      <ul className="mt-3 space-y-2">
        {data.map((s) => {
          const done = s.logs.length >= s.timesPerDay;
          return (
            <li
              key={s.id}
              className={`rounded-2xl px-3 py-2 ${done ? "bg-mint-50" : "bg-soft"}`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditing(s)}
                  className="text-2xl"
                  aria-label="Editar"
                >
                  {s.emoji}
                </button>
                <button
                  onClick={() => setEditing(s)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-bold">{s.name}</span>
                  <span className="text-xs text-ink/50">
                    {[
                      s.dose,
                      s.proteinG ? `${fmt(s.proteinG)} g proteína` : null,
                      `${s.logs.length}/${s.timesPerDay} hoje`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                <button
                  disabled={take.isPending}
                  onClick={() => take.mutate(s.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-extrabold ${
                    done ? "bg-white text-mint-500" : "bg-ink text-white"
                  }`}
                >
                  {done ? "✓ Tomei" : "Tomei"}
                </button>
              </div>
              {s.logs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-9">
                  {s.logs.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Desfazer o registro das ${timeLabel(l.takenAt)}?`,
                          )
                        )
                          untake.mutate(l.id);
                      }}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink/70"
                    >
                      ✓ {timeLabel(l.takenAt)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <SupplementSheet
        supplement={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </Card>
  );
}

function SupplementSheet({
  supplement,
  open,
  onClose,
  onSaved,
}: {
  supplement: Supplement | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const empty = {
    name: "",
    emoji: "💊",
    dose: "",
    proteinG: "",
    kcal: "",
    timesPerDay: "1",
  };
  const [f, setF] = useState(empty);
  const [key, setKey] = useState<string | null>(null);
  const k = open ? (supplement?.id ?? "new") : null;
  if (k !== key) {
    setKey(k);
    setF(
      supplement
        ? {
            name: supplement.name,
            emoji: supplement.emoji,
            dose: supplement.dose ?? "",
            proteinG: supplement.proteinG?.toString() ?? "",
            kcal: supplement.kcal?.toString() ?? "",
            timesPerDay: String(supplement.timesPerDay),
          }
        : empty,
    );
  }
  const set = (field: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [field]: e.target.value });
  const num = (v: string) =>
    v.trim() ? parseFloat(v.replace(",", ".")) : undefined;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(),
        emoji: f.emoji,
        dose: f.dose.trim() || undefined,
        proteinG: num(f.proteinG),
        kcal: num(f.kcal),
        timesPerDay: Math.max(1, parseInt(f.timesPerDay, 10) || 1),
      };
      return supplement
        ? api.patch(`/supplements/${supplement.id}`, body)
        : api.post("/supplements", body);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/supplements/${supplement!.id}`),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={supplement ? "Editar suplemento" : "Novo suplemento"}
    >
      <div className="space-y-3 pb-6">
        {!supplement && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() =>
                  setF({
                    name: p.name,
                    emoji: p.emoji,
                    dose: p.dose,
                    proteinG: p.proteinG?.toString() ?? "",
                    kcal: p.kcal?.toString() ?? "",
                    timesPerDay: "1",
                  })
                }
                className="rounded-full bg-soft px-3 py-1.5 text-sm font-bold"
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>
        )}
        <Field label="Nome">
          <input className={inputClass} value={f.name} onChange={set("name")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dose">
            <input
              className={inputClass}
              value={f.dose}
              onChange={set("dose")}
              placeholder="1 cápsula"
            />
          </Field>
          <Field label="Vezes por dia">
            <input
              className={inputClass}
              inputMode="numeric"
              value={f.timesPerDay}
              onChange={set("timesPerDay")}
            />
          </Field>
          <Field label="Proteína por dose (g)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={f.proteinG}
              onChange={set("proteinG")}
              placeholder="só se for proteico"
            />
          </Field>
          <Field label="Calorias por dose">
            <input
              className={inputClass}
              inputMode="decimal"
              value={f.kcal}
              onChange={set("kcal")}
            />
          </Field>
        </div>
        <p className="text-xs text-ink/50">
          Se tiver proteína, cada “Tomei” soma na proteína e nas calorias do
          dia.
        </p>
        <ErrorText error={save.error ?? remove.error} />
        <Button
          className="w-full"
          loading={save.isPending}
          disabled={!f.name.trim()}
          onClick={() => save.mutate()}
        >
          Salvar
        </Button>
        {supplement && (
          <Button
            variant="ghost"
            className="w-full"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Remover suplemento
          </Button>
        )}
      </div>
    </Sheet>
  );
}
