import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
} from "../components/ui";
import {
  api,
  MEAL_EMOJI,
  MEAL_LABEL,
  MICRO_LABEL,
  type Diary,
  type Entry,
  type MealType,
} from "../lib/api";
import { ExerciseEquivalent } from "../components/ExerciseEquivalent";
import { EXERCISES, exerciseMinutes, useWeightKg } from "../lib/exercise";
import { dayLabel, shiftDay, today } from "../lib/date";
import {
  formatDuration,
  formatHoursShort,
  phaseFor,
  relativeDayTime,
  useNow,
} from "../lib/fasting";
import { useFasting, useInvalidateDay } from "../lib/hooks";

export function DiaryPage() {
  const [params, setParams] = useSearchParams();
  const date = params.get("d") ?? today();
  const setDate = (d: string) =>
    setParams(d === today() ? {} : { d }, { replace: true });

  const { data, isLoading, error } = useQuery({
    queryKey: ["diary", date],
    queryFn: () => api.get<Diary>(`/diary/${date}`),
  });

  return (
    <div>
      {data ? (
        <Summary diary={data} />
      ) : (
        <div className="pt-safe h-64 bg-mint-100" />
      )}
      <div className="relative -mt-6 space-y-4 rounded-t-[2rem] bg-soft px-4 pt-4">
        <DateNav date={date} onChange={setDate} />
        {isLoading && (
          <div className="grid place-items-center py-10 text-mint-500">
            <Spinner />
          </div>
        )}
        <ErrorText error={error} />
        {data && (
          <>
            <OverTargetCard diary={data} date={date} />
            <Meals diary={data} date={date} />
            <FastingCard />
            <Water diary={data} date={date} />
            <Activities diary={data} date={date} />
            <Notes diary={data} date={date} />
          </>
        )}
      </div>
    </div>
  );
}

function DateNav({
  date,
  onChange,
}: {
  date: string;
  onChange: (d: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        className="grid h-12 w-12 place-items-center rounded-full bg-white text-xl shadow-card"
        onClick={() => onChange(shiftDay(date, -1))}
        aria-label="Dia anterior"
      >
        ‹
      </button>
      <label className="relative flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-lg font-extrabold capitalize shadow-card">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
        </svg>
        {dayLabel(date)}
        <input
          type="date"
          className="absolute inset-0 opacity-0"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </label>
      <button
        className="grid h-12 w-12 place-items-center rounded-full bg-white text-xl shadow-card"
        onClick={() => onChange(shiftDay(date, 1))}
        aria-label="Próximo dia"
      >
        ›
      </button>
    </div>
  );
}

function Ring({ value, max }: { value: number; max: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const over = value > max;
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="9"
        opacity="0.7"
      />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={over ? "#e8693a" : "#2fb38f"}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className="transition-all duration-700"
      />
    </svg>
  );
}

function Summary({ diary }: { diary: Diary }) {
  const [showMicros, setShowMicros] = useState(false);
  const { totals, targets, burned } = diary;
  const remaining = Math.round(targets.kcal - totals.kcal + burned);
  const macros = [
    {
      label: "Carboidratos",
      value: totals.carbs,
      max: targets.carbs,
      color: "bg-sun",
    },
    {
      label: "Proteínas",
      value: totals.protein,
      max: targets.protein,
      color: "bg-mint-500",
    },
    {
      label: "Gorduras",
      value: totals.fat,
      max: targets.fat,
      color: "bg-peach-400",
    },
    {
      label: "Fibras",
      value: totals.fiber,
      max: targets.fiber,
      color: "bg-sky",
    },
  ];

  return (
    <div className="pt-safe bg-mint-100 px-4 pb-10">
      <div className="flex items-center justify-between">
        <div className="w-24 text-center">
          <div className="text-2xl font-extrabold">{fmt(totals.kcal)}</div>
          <div className="text-sm font-semibold text-ink/60">Consumidas</div>
        </div>
        <div className="relative">
          <Ring value={totals.kcal} max={targets.kcal + burned} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-extrabold">
              {fmt(Math.abs(remaining))}
            </div>
            <div className="text-xs font-bold text-ink/60">
              {remaining >= 0 ? "kcal restantes" : "kcal acima"}
            </div>
          </div>
        </div>
        <div className="w-24 text-center">
          <div className="text-2xl font-extrabold">{fmt(burned)}</div>
          <div className="text-sm font-semibold text-ink/60">Gastas</div>
          {diary.steps > 0 && (
            <div className="text-xs text-ink/50">👟 {fmt(diary.steps)}</div>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        {macros.map((m) => (
          <div key={m.label}>
            <ProgressBar
              value={m.value}
              max={m.max ?? 0}
              color={m.color}
              className="h-1.5 bg-white/70"
            />
            <div className="mt-1 text-xs font-bold">{m.label}</div>
            <div className="text-xs text-ink/60">
              {fmt(m.value)} / {fmt(m.max)} g
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => setShowMicros((v) => !v)}
        className="mx-auto mt-2 block text-sm font-bold text-ink/50"
      >
        {showMicros
          ? "Ocultar vitaminas e minerais ▴"
          : "Vitaminas e minerais ▾"}
      </button>
      {showMicros && (
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 rounded-2xl bg-white/60 p-3 text-sm">
          {Object.entries(MICRO_LABEL).map(([key, { label, unit }]) => (
            <div key={key} className="flex justify-between">
              <span className="text-ink/70">{label}</span>
              <span className="font-bold">
                {fmt(totals.micros[key] ?? 0)} {unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Meals({ diary, date }: { diary: Diary; date: string }) {
  const [open, setOpen] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  return (
    <Card className="divide-y divide-slate-100 p-0">
      {diary.meals.map((m) => (
        <div key={m.meal}>
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              className="flex flex-1 items-center gap-3 text-left"
              onClick={() => setOpen(open === m.meal ? null : m.meal)}
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-soft text-3xl">
                {MEAL_EMOJI[m.meal]}
              </span>
              <span>
                <span className="block text-lg font-extrabold">
                  {MEAL_LABEL[m.meal]}
                </span>
                <span className="text-sm font-semibold text-ink/50">
                  {fmt(m.kcal)} / {fmt(m.targetKcal)} kcal
                  {m.entries.length > 0 &&
                    ` · ${m.entries.length} ${m.entries.length === 1 ? "item" : "itens"} ${open === m.meal ? "▴" : "▾"}`}
                </span>
              </span>
            </button>
            <Link
              to={`/adicionar?meal=${m.meal}&date=${date}`}
              className="grid h-12 w-12 place-items-center rounded-full bg-ink text-2xl text-white"
              aria-label={`Adicionar ao ${MEAL_LABEL[m.meal]}`}
            >
              +
            </Link>
          </div>
          {open === m.meal && m.entries.length > 0 && (
            <ul className="space-y-1 px-4 pb-3">
              {m.entries.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setEditing(e)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-soft px-3 py-2 text-left"
                  >
                    {e.photoUrl ? (
                      <img
                        src={e.photoUrl}
                        alt=""
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white">
                        🍴
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{e.name}</span>
                      <span className="text-xs text-ink/60">
                        {fmt(e.grams)} g · P {fmt(e.protein)} · C {fmt(e.carbs)}{" "}
                        · G {fmt(e.fat)}
                      </span>
                    </span>
                    <span className="font-extrabold">{fmt(e.kcal)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <EditEntrySheet entry={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function EditEntrySheet({
  entry,
  onClose,
}: {
  entry: Entry | null;
  onClose: () => void;
}) {
  const invalidate = useInvalidateDay();
  const [grams, setGrams] = useState("");
  const [meal, setMeal] = useState<MealType>("LUNCH");
  const [lastId, setLastId] = useState<string | null>(null);

  if (entry && entry.id !== lastId) {
    setLastId(entry.id);
    setGrams(String(Math.round(entry.grams)));
    setMeal(entry.meal);
  }

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/entries/${entry!.id}`, {
        grams: parseFloat(grams.replace(",", ".")),
        meal,
      }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/entries/${entry!.id}`),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  return (
    <Sheet open={Boolean(entry)} onClose={onClose} title={entry?.name}>
      {entry && (
        <div className="space-y-4 pb-4">
          {entry.photoUrl && (
            <img
              src={entry.photoUrl}
              alt=""
              className="max-h-60 w-full rounded-3xl object-cover"
            />
          )}
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <Macro label="kcal" value={entry.kcal} />
            <Macro label="Prot." value={entry.protein} unit="g" />
            <Macro label="Carbo" value={entry.carbs} unit="g" />
            <Macro label="Gord." value={entry.fat} unit="g" />
          </div>
          <ExerciseEquivalent kcal={entry.kcal} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade (g)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
              />
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
          <ErrorText error={save.error ?? remove.error} />
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remover
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Macro({
  label,
  value,
  unit = "",
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl bg-soft py-2">
      <div className="font-extrabold">
        {fmt(value)}
        {unit}
      </div>
      <div className="text-ink/60">{label}</div>
    </div>
  );
}

function Water({ diary, date }: { diary: Diary; date: string }) {
  const invalidate = useInvalidateDay();
  const cup = diary.targets.cupSizeMl;
  const goal = diary.targets.waterMl ?? 2000;
  const filled = Math.floor(diary.water.ml / cup);
  const slots = Math.max(Math.ceil(goal / cup), filled + 1);

  const mutation = useMutation({
    mutationFn: (ml: number) => api.post("/water", { date, ml }),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-extrabold">💧 Água</h3>
        <span className="font-extrabold text-sky-600">
          {fmt(diary.water.ml / 1000, 2)} L
        </span>
      </div>
      <div className="mb-3 text-sm text-ink/60">
        Meta: {fmt(goal / 1000, 2)} L · copo de {cup} ml
      </div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {Array.from({ length: slots }).map((_, i) => {
          const isFilled = i < filled;
          return (
            <button
              key={i}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(isFilled ? -1 : cup)}
              className={`flex h-14 items-center justify-center rounded-b-xl rounded-t-md text-xl font-bold transition [clip-path:polygon(0_0,100%_0,88%_100%,12%_100%)] ${
                isFilled ? "bg-sky text-white" : "bg-soft text-ink/40"
              }`}
              aria-label={isFilled ? "Remover copo" : "Adicionar copo"}
            >
              {isFilled ? "" : i === filled ? "+" : ""}
            </button>
          );
        })}
      </div>
      {diary.water.ml >= goal && (
        <p className="mt-3 text-center text-sm font-bold text-mint-500">
          Meta de água batida! 🎉
        </p>
      )}
    </Card>
  );
}

const ACTIVITY_PRESETS = [
  { name: "Caminhada", kcalPerMin: 4.5, emoji: "🚶‍♀️" },
  { name: "Corrida", kcalPerMin: 10, emoji: "🏃‍♀️" },
  { name: "Musculação", kcalPerMin: 6, emoji: "🏋️‍♀️" },
  { name: "Bicicleta", kcalPerMin: 7, emoji: "🚴‍♀️" },
  { name: "Dança", kcalPerMin: 6, emoji: "💃" },
  { name: "Pilates", kcalPerMin: 4, emoji: "🧘‍♀️" },
  { name: "Natação", kcalPerMin: 8, emoji: "🏊‍♀️" },
  { name: "Funcional", kcalPerMin: 8, emoji: "🤸‍♀️" },
];

function Activities({ diary, date }: { diary: Diary; date: string }) {
  const invalidate = useInvalidateDay();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", minutes: "30", kcal: "" });

  const add = useMutation({
    mutationFn: () =>
      api.post("/activities", {
        date,
        name: form.name,
        minutes: parseInt(form.minutes, 10),
        kcal: parseInt(form.kcal, 10),
      }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setForm({ name: "", minutes: "30", kcal: "" });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/activities/${id}`),
    onSuccess: invalidate,
  });

  const pickPreset = (p: (typeof ACTIVITY_PRESETS)[number]) => {
    const minutes = parseInt(form.minutes, 10) || 30;
    setForm({
      name: p.name,
      minutes: String(minutes),
      kcal: String(Math.round(minutes * p.kcalPerMin)),
    });
  };

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-extrabold">🏆 Atividades</h3>
        <span className="font-semibold text-ink/50">
          {fmt(diary.burned)} kcal gastas
        </span>
      </div>
      {diary.activities.length === 0 && diary.steps === 0 && (
        <p className="my-2 text-center text-ink/60">
          Registre uma atividade física para calcular suas calorias gastas
        </p>
      )}
      <ul className="my-2 space-y-1">
        {diary.steps > 0 && (
          <li className="flex justify-between rounded-2xl bg-soft px-3 py-2">
            <span className="font-bold">👟 {fmt(diary.steps)} passos</span>
            <span className="text-ink/60">{fmt(diary.steps * 0.04)} kcal</span>
          </li>
        )}
        {diary.activities.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-2xl bg-soft px-3 py-2"
          >
            <span>
              <span className="font-bold">{a.name}</span>
              <span className="text-sm text-ink/60"> · {a.minutes} min</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="font-bold">{a.kcal} kcal</span>
              <button
                onClick={() => remove.mutate(a.id)}
                className="text-ink/40"
                aria-label="Remover"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
      <Button className="w-full" onClick={() => setOpen(true)}>
        Adicionar atividade
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nova atividade">
        <div className="space-y-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            {ACTIVITY_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => pickPreset(p)}
                className={`rounded-2xl border-2 py-2 text-xs font-bold ${form.name === p.name ? "border-mint-500 bg-mint-50" : "border-slate-100"}`}
              >
                <div className="text-2xl">{p.emoji}</div>
                {p.name}
              </button>
            ))}
          </div>
          <Field label="Nome">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minutos">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.minutes}
                onChange={(e) => {
                  const minutes = e.target.value;
                  const preset = ACTIVITY_PRESETS.find(
                    (p) => p.name === form.name,
                  );
                  setForm({
                    ...form,
                    minutes,
                    kcal: preset
                      ? String(
                          Math.round(
                            (parseInt(minutes, 10) || 0) * preset.kcalPerMin,
                          ),
                        )
                      : form.kcal,
                  });
                }}
              />
            </Field>
            <Field label="Calorias gastas">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.kcal}
                onChange={(e) => setForm({ ...form, kcal: e.target.value })}
              />
            </Field>
          </div>
          <ErrorText error={add.error} />
          <Button
            className="w-full"
            loading={add.isPending}
            disabled={!form.name || !form.kcal || !form.minutes}
            onClick={() => add.mutate()}
          >
            Salvar atividade
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

function Notes({ diary, date }: { diary: Diary; date: string }) {
  const invalidate = useInvalidateDay();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const add = useMutation({
    mutationFn: () => api.post("/notes", { date, text }),
    onSuccess: () => {
      invalidate();
      setText("");
      setOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/notes/${id}`),
    onSuccess: invalidate,
  });

  return (
    <Card className="mb-4">
      <h3 className="text-lg font-extrabold">✏️ Notas</h3>
      {diary.notes.length === 0 && (
        <p className="my-2 text-ink/60">
          Descreva como foi seu dia, como se sentiu, o que quiser lembrar.
        </p>
      )}
      <ul className="my-2 space-y-2">
        {diary.notes.map((n) => (
          <li key={n.id} className="flex gap-2 rounded-2xl bg-soft px-3 py-2">
            <p className="flex-1 whitespace-pre-wrap">{n.text}</p>
            <button
              onClick={() => remove.mutate(n.id)}
              className="self-start text-ink/40"
              aria-label="Remover"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <Button className="w-full" variant="soft" onClick={() => setOpen(true)}>
        Adicionar nota
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nova nota">
        <div className="space-y-4 pb-4">
          <textarea
            className={`${inputClass} min-h-40`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Como foi seu dia?"
            autoFocus
          />
          <Button
            className="w-full"
            loading={add.isPending}
            disabled={!text.trim()}
            onClick={() => add.mutate()}
          >
            Salvar nota
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

function FastingCard() {
  const { data } = useFasting();
  const now = useNow();
  if (!data) return null;

  const active = data.active;
  if (active) {
    const elapsed = now - new Date(active.startAt).getTime();
    const goalMs = active.goalHours * 3_600_000;
    const phase = phaseFor(elapsed / 3_600_000);
    return (
      <Link
        to="/jejum"
        className="block rounded-3xl border-2 border-[#fdeaea] bg-white p-4 shadow-card"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold">
              Jejum {data.plan ?? `${active.goalHours}h`}
            </h3>
            <p className="text-sm font-bold text-peach-500">
              {phase.icon} {phase.label}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-ink/50">
              Tempo decorrido
            </div>
            <div className="font-serif text-3xl font-bold tabular-nums">
              {formatDuration(elapsed)}
            </div>
          </div>
        </div>
        <ProgressBar
          value={elapsed}
          max={goalMs}
          color={elapsed >= goalMs ? "bg-mint-500" : "bg-peach-400"}
          className="mt-3 h-3 bg-[#fdeaea]"
        />
        <div className="mt-1 flex justify-between text-xs font-semibold text-ink/50">
          <span>{relativeDayTime(active.startAt)}</span>
          <span>meta {relativeDayTime(active.goalAt)}</span>
        </div>
      </Link>
    );
  }

  const since = data.lastEndedAt
    ? now - new Date(data.lastEndedAt).getTime()
    : null;
  return (
    <Link
      to="/jejum"
      className="flex items-center gap-4 rounded-3xl border-2 border-slate-100 bg-white p-4 shadow-card"
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[#fdeaea] text-3xl">
        ⏱️
      </span>
      <span className="flex-1">
        <span className="block text-lg font-extrabold">
          Janela de alimentação
        </span>
        <span className="text-sm font-semibold text-ink/50">
          {since != null && since < 24 * 3_600_000
            ? `Comendo há ${formatHoursShort(since)} · toque para começar o jejum`
            : data.plan
              ? `Plano ${data.plan} · toque para começar o jejum`
              : "Jejum intermitente · escolha um plano"}
        </span>
      </span>
      <span className="text-2xl text-ink/30">›</span>
    </Link>
  );
}

function OverTargetCard({ diary, date }: { diary: Diary; date: string }) {
  const invalidate = useInvalidateDay();
  const weight = useWeightKg();
  const over = Math.round(
    diary.totals.kcal - diary.targets.kcal - diary.burned,
  );
  const add = useMutation({
    mutationFn: (a: { name: string; minutes: number; kcal: number }) =>
      api.post("/activities", { date, ...a }),
    onSuccess: invalidate,
  });
  if (over < 50) return null;

  return (
    <Card className="border-2 border-sky/60">
      <h3 className="text-lg font-extrabold">
        Passou {fmt(over)} kcal da meta hoje
      </h3>
      <p className="mt-1 text-sm text-ink/70">
        Tudo bem, um dia não muda seu resultado 💚 Se quiser equilibrar, dá pra
        gastar se mexendo:
      </p>
      <ul className="mt-3 space-y-2">
        {EXERCISES.map((e) => {
          const minutes = exerciseMinutes(over, weight, e.met);
          return (
            <li
              key={e.key}
              className="flex items-center gap-3 rounded-2xl bg-soft px-3 py-2"
            >
              <span className="text-2xl">{e.emoji}</span>
              <span className="flex-1">
                <span className="block font-extrabold">
                  {minutes} min de {e.label.toLowerCase()}
                </span>
                <span className="text-xs text-ink/50">{e.note}</span>
              </span>
              <button
                disabled={add.isPending}
                onClick={() =>
                  add.mutate({ name: e.label, minutes, kcal: over })
                }
                className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                Fiz ✓
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ink/50">
        Não precisa ficar sem comer pra compensar: volte ao plano normal na
        próxima refeição e continue bebendo água à vontade.
      </p>
    </Card>
  );
}
