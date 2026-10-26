import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BodyCards } from "../components/Body";
import { ProfileForm } from "../components/ProfileForm";
import { WaterReminderForm } from "../components/Reminders";
import { TrainingTab } from "./Training";
import {
  Button,
  Card,
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
  GOAL_LABEL,
  MEAL_LABEL,
  type NutritionStats,
  type PhotoItem,
  type Profile,
  type WeightStats,
} from "../lib/api";
import { shiftDay, shortDate, today } from "../lib/date";
import { previewPace } from "../lib/goal";
import { useInvalidateDay } from "../lib/hooks";

type Tab = "weight" | "nutrition" | "training" | "photos";

export function ProfilePage({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<Tab>("weight");
  const [settings, setSettings] = useState(false);

  return (
    <div>
      <header className="pt-safe bg-mint-100 px-5">
        <div className="flex items-center gap-4 pt-2">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-white bg-peach-100 text-5xl font-extrabold text-peach-500">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold">{profile.name}</h1>
            <p className="text-ink/60">
              {profile.goal ? GOAL_LABEL[profile.goal] : ""}
            </p>
            <span className="mt-2 inline-block rounded-full bg-white px-4 py-1.5 text-lg font-extrabold">
              {fmt(profile.kcalTarget)} kcal / d
            </span>
          </div>
          <button
            onClick={() => setSettings(true)}
            className="grid h-12 w-12 place-items-center self-start rounded-full text-3xl"
            aria-label="Configurações"
          >
            ⚙️
          </button>
        </div>
        <div className="mt-4 flex">
          {(
            [
              ["weight", "Peso"],
              ["nutrition", "Nutrição"],
              ["training", "Treinos"],
              ["photos", "Fotos"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 border-b-4 py-3 text-lg font-extrabold ${
                tab === id
                  ? "border-ink text-ink"
                  : "border-transparent text-ink/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="space-y-4 px-4 pt-4">
        {tab === "weight" && <WeightTab profile={profile} />}
        {tab === "nutrition" && <NutritionTab profile={profile} />}
        {tab === "training" && <TrainingTab />}
        {tab === "photos" && <PhotosTab />}
      </div>
      <SettingsSheet
        open={settings}
        onClose={() => setSettings(false)}
        profile={profile}
      />
    </div>
  );
}

const WEIGHT_RANGES = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "1 mês" },
  { value: "180", label: "6 meses" },
  { value: "all", label: "Todo" },
] as const;

function WeightTab({ profile }: { profile: Profile }) {
  const invalidate = useInvalidateDay();
  const qc = useQueryClient();
  const [range, setRange] =
    useState<(typeof WEIGHT_RANGES)[number]["value"]>("30");
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(today());

  const { data, isLoading } = useQuery({
    queryKey: ["stats", "weight"],
    queryFn: () => api.get<WeightStats>("/stats/weight"),
  });

  const refresh = () => {
    invalidate();
    void qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const add = useMutation({
    mutationFn: () =>
      api.post("/weight", { date, kg: parseFloat(kg.replace(",", ".")) }),
    onSuccess: () => {
      refresh();
      setOpen(false);
      setKg("");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/weight/${id}`),
    onSuccess: refresh,
  });

  const chart = useMemo(() => {
    if (!data) return [];
    const from = range === "all" ? "" : shiftDay(today(), -parseInt(range, 10));
    const rows: { t: number; kg?: number; goal?: number }[] = data.logs
      .filter((l) => l.date >= from)
      .map((l) => ({ t: dayTime(l.date), kg: l.kg }));
    const last = data.logs[data.logs.length - 1];
    if (range === "all" && last && data.targetKg && profile.targetDate) {
      rows.push({ t: dayTime(last.date), goal: last.kg });
      rows.push({
        t: dayTime(profile.targetDate.slice(0, 10)),
        goal: data.targetKg,
      });
    }
    return rows.sort((a, b) => a.t - b.t);
  }, [data, range, profile.targetDate]);

  if (isLoading || !data) {
    return (
      <div className="text-center text-mint-500">
        <Spinner />
      </div>
    );
  }

  const values = [
    ...chart.map((p) => p.kg ?? p.goal),
    data.targetKg ?? undefined,
  ].filter((v): v is number => v != null);
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);
  const lost =
    data.startKg != null && data.currentKg != null
      ? data.startKg - data.currentKg
      : null;

  return (
    <>
      <div className="grid grid-cols-3 text-center">
        <WeightStat label="Peso inicial" value={data.startKg} />
        <WeightStat label="Peso atual" value={data.currentKg} />
        <WeightStat label="Peso desejado" value={data.targetKg} />
      </div>
      {lost != null && lost !== 0 && (
        <p className="text-center font-bold text-mint-500">
          {lost > 0
            ? `🎉 ${fmt(lost, 1)} kg a menos desde o início`
            : `${fmt(-lost, 1)} kg a mais desde o início`}
        </p>
      )}
      <Button className="w-full py-4 text-lg" onClick={() => setOpen(true)}>
        Adicionar uma pesagem
      </Button>
      <GoalCard profile={profile} />
      <WeeklyTips createdAt={profile.createdAt} />
      <Card>
        <h3 className="mb-3 text-lg font-extrabold">Meta de peso</h3>
        <Segmented
          options={[...WEIGHT_RANGES]}
          value={range}
          onChange={setRange}
        />
        <div className="mt-4 h-64">
          {chart.length === 0 ? (
            <p className="pt-20 text-center text-ink/50">
              Sem pesagens nesse período
            </p>
          ) : (
            <ResponsiveContainer>
              <LineChart
                data={chart}
                margin={{ top: 10, right: 24, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#eef0f4" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={[
                    (lo: number) => lo - 86_400_000,
                    (hi: number) => hi + 86_400_000,
                  ]}
                  tickFormatter={(t: number) =>
                    new Date(t).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })
                  }
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[min, max]}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  labelFormatter={(t: number) =>
                    new Date(t).toLocaleDateString("pt-BR")
                  }
                  formatter={(v: number, name: string) => [
                    `${fmt(v, 1)} kg`,
                    name === "goal" ? "Caminho até a meta" : "Peso",
                  ]}
                />
                {data.targetKg && (
                  <ReferenceLine
                    y={data.targetKg}
                    stroke="#24324a"
                    strokeDasharray="6 6"
                    label={{
                      value: `${data.targetKg} kg`,
                      position: "insideTopRight",
                      fontSize: 12,
                    }}
                  />
                )}
                <Line
                  dataKey="goal"
                  stroke="#f6a07c"
                  strokeWidth={2}
                  strokeDasharray="4 6"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="#2fb38f"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#2fb38f" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {range !== "all" && profile.targetDate && (
          <p className="mt-2 text-center text-xs text-ink/50">
            Veja em “Todo” o caminho até a meta
          </p>
        )}
      </Card>
      <BodyCards />
      {data.logs.length > 0 && (
        <Card className="mb-4">
          <h3 className="mb-2 text-lg font-extrabold">Histórico</h3>
          <ul className="divide-y divide-slate-100">
            {[...data.logs]
              .reverse()
              .slice(0, 20)
              .map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-ink/70">
                    {new Date(`${l.date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-extrabold">{fmt(l.kg, 1)} kg</span>
                    <button
                      onClick={() => remove.mutate(l.id)}
                      className="text-ink/40"
                      aria-label="Remover"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Nova pesagem">
        <div className="space-y-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso (kg)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Data">
              <input
                className={inputClass}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          <ErrorText error={add.error} />
          <Button
            className="w-full"
            loading={add.isPending}
            disabled={!kg}
            onClick={() => add.mutate()}
          >
            Salvar
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function WeightStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-2xl font-extrabold">
        {value != null ? `${fmt(value, 1)} kg` : "–"}
      </div>
      <div className="text-sm font-semibold text-ink/60">{label}</div>
    </div>
  );
}

const RATING_META = [
  { key: "great", emoji: "😄", color: "#7fcfbd" },
  { key: "good", emoji: "😉", color: "#d6e38a" },
  { key: "ok", emoji: "🙂", color: "#ffc98a" },
  { key: "bad", emoji: "😐", color: "#f6a07c" },
] as const;

function NutritionTab({ profile }: { profile: Profile }) {
  const [days, setDays] = useState<"7" | "30" | "90">("7");
  const targetKcal =
    (profile.proteinTarget ?? 0) * 4 +
    (profile.carbsTarget ?? 0) * 4 +
    (profile.fatTarget ?? 0) * 9;
  const pct = (g: number | null, k: number) =>
    targetKcal ? Math.round((((g ?? 0) * k) / targetKcal) * 100) : null;
  const goal = {
    protein: pct(profile.proteinTarget, 4),
    carbs: pct(profile.carbsTarget, 4),
    fat: pct(profile.fatTarget, 9),
  };
  const { data, isLoading } = useQuery({
    queryKey: ["stats", "nutrition", days],
    queryFn: () =>
      api.get<NutritionStats>(`/stats/nutrition?days=${days}&end=${today()}`),
  });

  return (
    <>
      <Segmented
        options={[
          { value: "7", label: "7 dias" },
          { value: "30", label: "30 dias" },
          { value: "90", label: "90 dias" },
        ]}
        value={days}
        onChange={setDays}
      />
      {isLoading || !data ? (
        <div className="text-center text-mint-500">
          <Spinner />
        </div>
      ) : (
        <>
          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-lg font-extrabold">Calorias</h3>
              {data.averageKcal != null && (
                <span className="text-sm text-ink/60">
                  média {fmt(data.averageKcal)} kcal
                </span>
              )}
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart
                  data={data.series.map((s) => ({
                    ...s,
                    label: shortDate(s.date),
                  }))}
                  margin={{ top: 16, right: 6, left: -18, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#eef0f4" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[
                      0,
                      (max: number) =>
                        Math.ceil((Math.max(max, data.target) * 1.1) / 100) *
                        100,
                    ]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${fmt(v)} kcal`, "Consumido"]}
                  />
                  <ReferenceLine
                    y={data.target}
                    stroke="#24324a"
                    strokeDasharray="6 6"
                    ifOverflow="extendDomain"
                    label={{
                      value: `${data.target} kcal`,
                      position: "insideTopRight",
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="kcal" radius={[6, 6, 0, 0]}>
                    {data.series.map((s) => (
                      <Cell
                        key={s.date}
                        fill={
                          s.kcal != null && s.kcal > data.target * 1.1
                            ? "#f6a07c"
                            : "#2fb38f"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <h3 className="mb-2 text-lg font-extrabold">Avaliação dos dias</h3>
            <p className="mb-2 text-sm text-ink/60">
              Quão perto da meta de calorias você ficou
            </p>
            <div className="flex h-40 items-end justify-around gap-4">
              {RATING_META.map((r) => (
                <div
                  key={r.key}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="text-xs font-bold text-ink/60">
                    {data.ratings[r.key]}%
                  </span>
                  <div
                    className="w-full rounded-t-xl"
                    style={{
                      height: `${Math.max(data.ratings[r.key], 2)}%`,
                      background: r.color,
                    }}
                  />
                  <span className="text-3xl">{r.emoji}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="mb-4">
            <h3 className="mb-3 text-lg font-extrabold">
              Distribuição de macros (%)
            </h3>
            {data.macros ? (
              <>
                <div className="flex h-6 overflow-hidden rounded-full">
                  <div
                    className="bg-mint-500"
                    style={{ width: `${data.macros.protein}%` }}
                  />
                  <div
                    className="bg-sun"
                    style={{ width: `${data.macros.carbs}%` }}
                  />
                  <div
                    className="bg-peach-400"
                    style={{ width: `${data.macros.fat}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 text-center">
                  <MacroLegend
                    color="bg-mint-500"
                    label="Proteínas"
                    value={data.macros.protein}
                    goal={goal.protein}
                  />
                  <MacroLegend
                    color="bg-sun"
                    label="Carboidratos"
                    value={data.macros.carbs}
                    goal={goal.carbs}
                  />
                  <MacroLegend
                    color="bg-peach-400"
                    label="Gorduras"
                    value={data.macros.fat}
                    goal={goal.fat}
                  />
                </div>
              </>
            ) : (
              <p className="text-ink/50">Registre refeições para ver aqui.</p>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function MacroLegend({
  color,
  label,
  value,
  goal,
}: {
  color: string;
  label: string;
  value: number;
  goal: number | null;
}) {
  const ok = goal != null && Math.abs(value - goal) <= 5;
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 text-sm text-ink/70">
        <span className={`h-3 w-3 rounded-full ${color}`} />
        {label}
      </div>
      <div className="text-xl font-extrabold">{value}%</div>
      {goal != null && (
        <div
          className={`mx-auto mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-bold ${
            ok ? "bg-mint-50 text-mint-500" : "bg-peach-100 text-peach-500"
          }`}
        >
          {ok ? "✓ na meta" : `meta ${goal}%`}
        </div>
      )}
    </div>
  );
}

function PhotosTab() {
  const invalidate = useInvalidateDay();
  const [open, setOpen] = useState<PhotoItem | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["photos"],
    queryFn: () => api.get<PhotoItem[]>("/photos"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/photos/${id}`),
    onSuccess: () => {
      invalidate();
      setOpen(null);
    },
  });

  if (isLoading) {
    return (
      <div className="text-center text-mint-500">
        <Spinner />
      </div>
    );
  }
  if (!data?.length) {
    return (
      <p className="pt-6 text-center text-ink/60">
        As fotos das refeições que você enviar ficam salvas aqui 📸
      </p>
    );
  }
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-1.5">
        {data.map((p) => (
          <button
            key={p.id}
            onClick={() => setOpen(p)}
            className="relative aspect-square overflow-hidden rounded-2xl bg-soft"
          >
            <img
              src={p.url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-1 left-1 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-white">
              {p.kcal > 0
                ? `${p.kcal} kcal`
                : new Date(p.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
            </span>
          </button>
        ))}
      </div>
      <Sheet open={Boolean(open)} onClose={() => setOpen(null)}>
        {open && (
          <div className="space-y-3 pb-4">
            <img src={open.url} alt="" className="w-full rounded-3xl" />
            <p className="font-bold">
              {new Date(open.createdAt).toLocaleString("pt-BR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {open.meal && ` · ${MEAL_LABEL[open.meal]}`}
            </p>
            {open.items.length > 0 ? (
              <p className="text-ink/70">
                {open.items.join(", ")} — <b>{open.kcal} kcal</b>
              </p>
            ) : (
              <p className="text-ink/50">
                Foto não foi salva em nenhuma refeição.
              </p>
            )}
            <Button
              variant="danger"
              className="w-full"
              loading={remove.isPending}
              onClick={() => remove.mutate(open.id)}
            >
              Apagar foto
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

function SettingsSheet({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}) {
  const qc = useQueryClient();
  const [section, setSection] = useState<
    "menu" | "profile" | "targets" | "steps" | "reminders"
  >("menu");
  const close = () => {
    setSection("menu");
    onClose();
  };
  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      qc.clear();
      window.location.href = "/";
    },
  });

  return (
    <Sheet
      open={open}
      onClose={close}
      title={
        {
          menu: "Configurações",
          profile: "Meus dados",
          targets: "Metas diárias",
          steps: "Passos do iPhone",
          reminders: "Notificações",
        }[section]
      }
    >
      <div className="pb-4">
        {section === "menu" && (
          <div className="space-y-2">
            {(
              [
                ["profile", "👤 Meus dados e objetivo"],
                ["targets", "🎯 Ajustar metas e copo de água"],
                ["reminders", "🔔 Notificações e lembrete de água"],
                ["steps", "👟 Importar passos do iPhone"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className="w-full rounded-2xl bg-soft px-4 py-4 text-left font-bold"
              >
                {label}
              </button>
            ))}
            <Button
              variant="danger"
              className="mt-4 w-full"
              loading={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Sair
            </Button>
          </div>
        )}
        {section === "profile" && (
          <ProfileForm
            profile={profile}
            submitLabel="Salvar e recalcular metas"
            onDone={close}
          />
        )}
        {section === "targets" && (
          <TargetsForm profile={profile} onDone={close} />
        )}
        {section === "steps" && <StepsHelp token={profile.stepsToken} />}
        {section === "reminders" && <WaterReminderForm onDone={close} />}
      </div>
    </Sheet>
  );
}

function TargetsForm({
  profile,
  onDone,
}: {
  profile: Profile;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    kcalTarget: String(profile.kcalTarget ?? ""),
    proteinTarget: String(profile.proteinTarget ?? ""),
    carbsTarget: String(profile.carbsTarget ?? ""),
    fatTarget: String(profile.fatTarget ?? ""),
    waterTargetMl: String(profile.waterTargetMl ?? ""),
    cupSizeMl: String(profile.cupSizeMl),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: async () => {
      const { cupSizeMl, ...targets } = f;
      await api.patch("/profile", { cupSizeMl: parseInt(cupSizeMl, 10) });
      return api.patch<Profile>(
        "/profile/targets",
        Object.fromEntries(
          Object.entries(targets).map(([k, v]) => [k, parseInt(v, 10)]),
        ),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      onDone();
    },
  });
  const recalc = useMutation({
    mutationFn: () => api.post<Profile>("/profile/recalculate"),
    onSuccess: () => {
      void qc.invalidateQueries();
      onDone();
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calorias (kcal)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={f.kcalTarget}
            onChange={set("kcalTarget")}
          />
        </Field>
        <Field label="Proteínas (g)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={f.proteinTarget}
            onChange={set("proteinTarget")}
          />
        </Field>
        <Field label="Carboidratos (g)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={f.carbsTarget}
            onChange={set("carbsTarget")}
          />
        </Field>
        <Field label="Gorduras (g)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={f.fatTarget}
            onChange={set("fatTarget")}
          />
        </Field>
        <Field label="Água (ml/dia)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={f.waterTargetMl}
            onChange={set("waterTargetMl")}
          />
        </Field>
        <Field label="Tamanho do copo (ml)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={f.cupSizeMl}
            onChange={set("cupSizeMl")}
          />
        </Field>
      </div>
      <ErrorText error={save.error ?? recalc.error} />
      <Button
        className="w-full"
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        Salvar metas
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        loading={recalc.isPending}
        onClick={() => recalc.mutate()}
      >
        Voltar pro cálculo automático
      </Button>
    </div>
  );
}

function StepsHelp({ token }: { token: string }) {
  const url = `${window.location.origin}/api/integrations/steps`;
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value).then(() => setCopied(label));
  };

  return (
    <div className="space-y-3 text-sm">
      <p>
        O app Atalhos do iPhone manda seus passos do app Saúde pra cá
        automaticamente:
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Abra <b>Atalhos</b> → aba <b>Automação</b> → <b>+</b> →{" "}
          <b>Hora do Dia</b> (ex.: 21:00, diariamente) →{" "}
          <b>Executar Imediatamente</b>.
        </li>
        <li>
          Adicione a ação <b>Buscar Amostras de Saúde</b>: tipo <b>Passos</b>,
          agrupar por <b>Dia</b>, período <b>Hoje</b>.
        </li>
        <li>
          Adicione <b>Calcular Estatísticas</b> → <b>Soma</b> das amostras.
        </li>
        <li>
          Adicione <b>Obter Conteúdo do URL</b> com o endereço abaixo, método{" "}
          <b>POST</b>, cabeçalho <b>x-steps-token</b> com o token abaixo e corpo{" "}
          <b>JSON</b> com o campo <b>steps</b> = Soma.
        </li>
      </ol>
      <CopyRow
        label="URL"
        value={url}
        copied={copied === "url"}
        onCopy={() => copy("url", url)}
      />
      <CopyRow
        label="Token"
        value={token}
        copied={copied === "token"}
        onCopy={() => copy("token", token)}
      />
      <p className="text-ink/50">
        Pode rodar várias vezes por dia — sempre atualiza o total do dia.
      </p>
    </div>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-soft px-3 py-2">
      <span className="font-bold">{label}</span>
      <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
      <button
        onClick={onCopy}
        className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold"
      >
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  );
}

function dayTime(day: string): number {
  return new Date(`${day}T12:00:00`).getTime();
}

const PACE_BADGE = {
  ok: { text: "Ritmo saudável ✅", tone: "bg-mint-50 text-mint-500" },
  fast: { text: "Ritmo puxado 💪", tone: "bg-sun/40 text-ink" },
  too_fast: {
    text: "Rápido demais — calorias no mínimo seguro",
    tone: "bg-peach-100 text-peach-500",
  },
  past: {
    text: "A data já passou — escolha outra",
    tone: "bg-soft text-ink/60",
  },
  reached: { text: "Meta alcançada! 🎉", tone: "bg-mint-50 text-mint-500" },
};

function GoalCard({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const plan = profile.goalPlan;
  const date = profile.targetDate
    ? new Date(`${profile.targetDate.slice(0, 10)}T12:00:00`)
    : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold">🎯 Minha meta</h3>
          <p className="text-2xl font-extrabold">
            {profile.targetWeightKg
              ? `${fmt(profile.targetWeightKg, 1)} kg`
              : "–"}
            {date && (
              <span className="text-base font-bold text-ink/60">
                {" "}
                até {date.toLocaleDateString("pt-BR")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-bold"
        >
          {date ? "Editar" : "Definir data"}
        </button>
      </div>
      {plan ? (
        <>
          {plan.pace !== "past" && plan.pace !== "reached" && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-soft py-2">
                <div className="font-extrabold">
                  {fmt(Math.abs(plan.kgToGo), 1)} kg
                </div>
                <div className="text-xs text-ink/60">
                  {plan.kgToGo < 0 ? "a perder" : "a ganhar"}
                </div>
              </div>
              <div className="rounded-2xl bg-soft py-2">
                <div className="font-extrabold">
                  {Math.ceil(plan.daysLeft / 7)} sem.
                </div>
                <div className="text-xs text-ink/60">{plan.daysLeft} dias</div>
              </div>
              <div className="rounded-2xl bg-soft py-2">
                <div className="font-extrabold">
                  {fmt(Math.abs(plan.weeklyRateKg), 2)} kg
                </div>
                <div className="text-xs text-ink/60">por semana</div>
              </div>
            </div>
          )}
          <p
            className={`mt-3 rounded-2xl px-4 py-2 text-center text-sm font-bold ${PACE_BADGE[plan.pace].tone}`}
          >
            {PACE_BADGE[plan.pace].text}
          </p>
          {plan.dailyKcalAdjust !== 0 && (
            <p className="mt-2 text-center text-sm text-ink/60">
              {plan.dailyKcalAdjust < 0 ? "Déficit" : "Superávit"} de{" "}
              {fmt(Math.abs(plan.dailyKcalAdjust))} kcal/dia → meta de{" "}
              {fmt(profile.kcalTarget)} kcal
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-ink/60">
          Escolha até quando quer chegar lá e eu calculo o ritmo por semana e
          ajusto suas calorias.
        </p>
      )}
      <GoalSheet open={open} onClose={() => setOpen(false)} profile={profile} />
    </Card>
  );
}

function GoalSheet({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}) {
  const qc = useQueryClient();
  const [kg, setKg] = useState(profile.targetWeightKg?.toString() ?? "");
  const [date, setDate] = useState(profile.targetDate?.slice(0, 10) ?? "");
  const target = parseFloat(kg.replace(",", "."));
  const pace = previewPace(profile.currentWeightKg ?? 0, target, date);

  const save = useMutation({
    mutationFn: () =>
      api.patch<Profile>("/profile", {
        targetWeightKg: target,
        targetDate: date || null,
        goal:
          profile.currentWeightKg &&
          Math.abs(target - profile.currentWeightKg) >= 0.5
            ? target < profile.currentWeightKg
              ? "LOSE"
              : "GAIN"
            : "MAINTAIN",
      }),
    onSuccess: (p) => {
      qc.setQueryData(["profile"], p);
      void qc.invalidateQueries();
      onClose();
    },
  });

  return (
    <Sheet open={open} onClose={onClose} title="Minha meta">
      <div className="space-y-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso desejado (kg)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
            />
          </Field>
          <Field label="Até quando">
            <input
              className={inputClass}
              type="date"
              min={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        {profile.currentWeightKg && (
          <p className="text-sm text-ink/60">
            Peso atual: {fmt(profile.currentWeightKg, 1)} kg
          </p>
        )}
        {pace && (
          <p
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${pace.tone}`}
          >
            {pace.text}
          </p>
        )}
        <ErrorText error={save.error} />
        <Button
          className="w-full"
          loading={save.isPending}
          disabled={!target}
          onClick={() => save.mutate()}
        >
          Salvar meta e recalcular calorias
        </Button>
        {date && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setDate("")}
          >
            Sem data definida
          </Button>
        )}
      </div>
    </Sheet>
  );
}

const WEEKLY_TIPS = [
  { emoji: "🥗", text: "Você se sente melhor e cria boas práticas." },
  { emoji: "🍒", text: "Você começa a ver seu corpo mudar." },
  { emoji: "🥕", text: "Hábitos saudáveis estão enraizados na sua rotina." },
  { emoji: "⚖️", text: "Você está vendo os primeiros resultados na balança!" },
  {
    emoji: "🍗",
    text: "Capriche na proteína: ela segura a fome e protege os músculos.",
  },
  {
    emoji: "📈",
    text: "Platôs são normais. Mantenha a constância que a balança volta a descer.",
  },
  {
    emoji: "😴",
    text: "Durma bem: noite mal dormida aumenta a fome no dia seguinte.",
  },
  {
    emoji: "🎉",
    text: "Comemore o que a balança não mostra: roupas, energia, disposição.",
  },
];

function WeeklyTips({ createdAt }: { createdAt: string }) {
  const week =
    Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (7 * 86_400_000),
    ) + 1;
  const current = Math.min(week, WEEKLY_TIPS.length);
  return (
    <section>
      <h3 className="mb-2 px-1 text-lg font-extrabold">Conselhos pra você</h3>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {WEEKLY_TIPS.map((tip, i) => {
          const n = i + 1;
          return (
            <div
              key={n}
              ref={(el) => {
                if (el && n === current)
                  el.scrollIntoView({ block: "nearest", inline: "center" });
              }}
              className={`flex w-[85%] shrink-0 snap-center items-center gap-3 rounded-3xl p-4 ${
                n === current ? "bg-[#fde8d4]" : "bg-white opacity-70"
              }`}
            >
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-4xl">
                {tip.emoji}
              </span>
              <span>
                <span className="mb-1 inline-block rounded-lg bg-[#f3b07a] px-2 py-0.5 text-sm font-bold text-white">
                  {n === current ? `Semana ${n} · agora` : `Fim da semana ${n}`}
                </span>
                <span className="block text-sm">{tip.text}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
