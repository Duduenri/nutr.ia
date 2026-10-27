import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RoutineButton } from "../components/Routines";
import { StrengthProgress } from "../components/StrengthProgress";
import { Card, fmt, Segmented, Spinner } from "../components/ui";
import { api, type TrainingHistory } from "../lib/api";
import { today } from "../lib/date";
import {
  DISTANCE_SPORTS,
  exerciseSummary,
  formatDuration,
  formatKm,
  formatPace,
  paceLabel,
  SPEED_SPORTS,
} from "../lib/training";

type Activity = TrainingHistory["activities"][number];
type Metric = "minutes" | "km" | "kcal";

const SPORT_EMOJI: Record<string, string> = {
  Caminhada: "🚶‍♀️",
  Corrida: "🏃‍♀️",
  Musculação: "🏋️‍♀️",
  Bicicleta: "🚴‍♀️",
  Dança: "💃",
  Pilates: "🧘‍♀️",
  Natação: "🏊‍♀️",
  Funcional: "🤸‍♀️",
};

const WEEKS = 12;
const DAY_MS = 86_400_000;

function dayTime(day: string): number {
  return new Date(`${day}T12:00:00`).getTime();
}

function weekStart(day: string): number {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function shortDay(t: number): string {
  return new Date(t).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function emoji(name: string) {
  return SPORT_EMOJI[name] ?? "⚡";
}

function sum(list: Activity[], pick: (a: Activity) => number) {
  return list.reduce((s, a) => s + pick(a), 0);
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before && !now) return null;
  if (!before)
    return <span className="text-xs font-bold text-mint-500">novo</span>;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0)
    return <span className="text-xs font-bold text-ink/40">=</span>;
  return (
    <span
      className={`text-xs font-bold ${pct > 0 ? "text-mint-500" : "text-peach-500"}`}
    >
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

export function TrainingTab() {
  const day = today();
  const { data, isLoading } = useQuery({
    queryKey: ["training", day],
    queryFn: () => api.get<TrainingHistory>(`/activities/history?today=${day}`),
  });
  const [sport, setSport] = useState("all");
  const [metric, setMetric] = useState<Metric>("minutes");

  const all = useMemo(() => data?.activities ?? [], [data]);
  const sports = useMemo(() => {
    const count = new Map<string, number>();
    all.forEach((a) => count.set(a.name, (count.get(a.name) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [all]);
  const acts = useMemo(
    () => (sport === "all" ? all : all.filter((a) => a.name === sport)),
    [all, sport],
  );

  const thisWeek = weekStart(day);
  const weeks = useMemo(
    () =>
      Array.from({ length: WEEKS }, (_, i) => {
        const start = thisWeek - (WEEKS - 1 - i) * 7 * DAY_MS;
        const list = acts.filter((a) => weekStart(a.date) === start);
        return {
          start,
          label: shortDay(start),
          sessions: list.length,
          minutes: sum(list, (a) => a.minutes),
          km: Math.round(sum(list, (a) => a.distanceKm ?? 0) * 10) / 10,
          kcal: sum(list, (a) => a.kcal),
        };
      }),
    [acts, thisWeek],
  );

  if (isLoading) {
    return (
      <div className="text-center text-mint-500">
        <Spinner />
      </div>
    );
  }
  if (all.length === 0) {
    return (
      <div className="space-y-4">
        <RoutineButton />
        <Card className="text-center">
          <div className="text-5xl">🏃‍♀️</div>
          <h3 className="mt-2 text-lg font-extrabold">
            Seus treinos aparecem aqui
          </h3>
          <p className="mt-1 text-sm text-ink/60">
            Registre atividades no Diário (com distância, pra corrida e
            caminhada) e acompanhe a evolução: tempo por semana, ritmo,
            recordes.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-full bg-ink px-6 py-3 font-bold text-white"
          >
            Ir pro Diário
          </Link>
        </Card>
      </div>
    );
  }

  const now = weeks[WEEKS - 1];
  const prev = weeks[WEEKS - 2];
  const hasKm = acts.some((a) => a.distanceKm);
  const shownMetric: Metric = metric === "km" && !hasKm ? "minutes" : metric;

  const paceSport =
    sport !== "all"
      ? DISTANCE_SPORTS.includes(sport)
        ? sport
        : null
      : (sports.find(
          (s) =>
            DISTANCE_SPORTS.includes(s) &&
            all.filter((a) => a.name === s && a.distanceKm).length >= 2,
        ) ?? null);
  const speed = paceSport ? SPEED_SPORTS.includes(paceSport) : false;
  const paceSeries = paceSport
    ? all
        .filter((a) => a.name === paceSport && a.distanceKm && a.distanceKm > 0)
        .map((a) => ({
          t: dayTime(a.date),
          value: speed
            ? a.distanceKm! / (a.minutes / 60)
            : a.minutes / a.distanceKm!,
          km: a.distanceKm!,
        }))
    : [];

  const withKm = acts.filter((a) => a.distanceKm);
  const longest = withKm.reduce<Activity | null>(
    (best, a) => (!best || a.distanceKm! > best.distanceKm! ? a : best),
    null,
  );
  const fastest = withKm
    .filter((a) => a.distanceKm! >= 1 && !SPEED_SPORTS.includes(a.name))
    .reduce<Activity | null>(
      (best, a) =>
        !best || a.minutes / a.distanceKm! < best.minutes / best.distanceKm!
          ? a
          : best,
      null,
    );
  const longestTime = acts.reduce<Activity | null>(
    (best, a) => (!best || a.minutes > best.minutes ? a : best),
    null,
  );
  const bestWeek = weeks.reduce((best, w) =>
    w.minutes > best.minutes ? w : best,
  );
  let streak = 0;
  for (let i = now.sessions ? WEEKS - 1 : WEEKS - 2; i >= 0; i--) {
    if (!weeks[i].sessions) break;
    streak++;
  }

  const month = all.filter((a) => dayTime(a.date) > dayTime(day) - 30 * DAY_MS);
  const bySport = sports
    .map((name) => {
      const list = month.filter((a) => a.name === name);
      return {
        name,
        sessions: list.length,
        minutes: sum(list, (a) => a.minutes),
        km: sum(list, (a) => a.distanceKm ?? 0),
      };
    })
    .filter((s) => s.sessions > 0);

  const steps = data?.steps ?? [];
  const stepsAvg = (start: number) => {
    const days = steps.filter(
      (s) => dayTime(s.date) >= start && dayTime(s.date) < start + 7 * DAY_MS,
    );
    return days.length
      ? Math.round(days.reduce((t, s) => t + s.steps, 0) / days.length)
      : 0;
  };

  const maxMinutes = Math.max(30, ...weeks.map((w) => w.minutes));
  const step = maxMinutes > 300 ? 120 : maxMinutes > 150 ? 60 : 30;
  const minuteTicks = Array.from(
    { length: Math.ceil(maxMinutes / step) + 1 },
    (_, i) => i * step,
  );

  const metricFmt = (v: number) =>
    shownMetric === "minutes"
      ? formatDuration(v)
      : shownMetric === "km"
        ? formatKm(v)
        : `${fmt(v)} kcal`;

  return (
    <div className="space-y-4 pb-4">
      <RoutineButton />
      {sports.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["all", ...sports].map((s) => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                sport === s ? "bg-ink text-white" : "bg-white shadow-card"
              }`}
            >
              {s === "all" ? "Tudo" : `${emoji(s)} ${s}`}
            </button>
          ))}
        </div>
      )}

      <Card>
        <h3 className="mb-3 text-lg font-extrabold">Esta semana</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Treinos", now.sessions, prev.sessions, String(now.sessions)],
            ["Tempo", now.minutes, prev.minutes, formatDuration(now.minutes)],
            ...(hasKm
              ? [["Distância", now.km, prev.km, formatKm(now.km)] as const]
              : []),
            ["Calorias", now.kcal, prev.kcal, `${fmt(now.kcal)} kcal`],
          ].map(([label, value, before, text]) => (
            <div key={label} className="rounded-2xl bg-soft px-3 py-2">
              <div className="text-xs font-bold text-ink/50">{label}</div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl font-extrabold">{text}</span>
                <Delta now={value as number} before={before as number} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/50">
          Comparado com a semana passada · {streak}{" "}
          {streak === 1 ? "semana seguida" : "semanas seguidas"} treinando 🔥
        </p>
      </Card>

      <Card>
        <h3 className="mb-2 text-lg font-extrabold">Últimas 12 semanas</h3>
        <Segmented
          options={[
            { value: "minutes" as Metric, label: "Tempo" },
            ...(hasKm ? [{ value: "km" as Metric, label: "Km" }] : []),
            { value: "kcal" as Metric, label: "Calorias" },
          ]}
          value={shownMetric}
          onChange={setMetric}
        />
        <div className="mt-3 h-52">
          <ResponsiveContainer>
            <BarChart
              data={weeks}
              margin={{ top: 10, right: 6, left: -18, bottom: 0 }}
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
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                ticks={shownMetric === "minutes" ? minuteTicks : undefined}
                domain={
                  shownMetric === "minutes"
                    ? [0, minuteTicks[minuteTicks.length - 1]]
                    : [0, "auto"]
                }
                tickFormatter={(v: number) =>
                  shownMetric === "minutes" ? formatDuration(v) : String(v)
                }
              />
              <Tooltip
                cursor={{ fill: "#f4f6fa" }}
                labelFormatter={(l: string) => `Semana de ${l}`}
                formatter={(v: number, _n, item) => [
                  `${metricFmt(v)} · ${item.payload.sessions} treino(s)`,
                  "",
                ]}
                separator=""
              />
              <Bar dataKey={shownMetric} radius={[4, 4, 0, 0]}>
                {weeks.map((w) => (
                  <Cell
                    key={w.start}
                    fill={w.start === thisWeek ? "#2fb38f" : "#8fdcc6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-ink/50">
          Semana mais forte: {formatDuration(bestWeek.minutes)} (semana de{" "}
          {bestWeek.label})
        </p>
      </Card>

      {paceSport && paceSeries.length >= 2 && (
        <Card>
          <h3 className="text-lg font-extrabold">
            {emoji(paceSport)} {speed ? "Velocidade" : "Ritmo"} na{" "}
            {paceSport.toLowerCase()}
          </h3>
          <p className="text-xs text-ink/50">
            {speed
              ? "Quanto mais alto, mais rápido"
              : "Quanto mais alto no gráfico, mais rápido (menos minutos por km)"}
          </p>
          <div className="mt-3 h-48">
            <ResponsiveContainer>
              <LineChart
                data={paceSeries}
                margin={{ top: 10, right: 16, left: -6, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#eef0f4" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={shortDay}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  reversed={!speed}
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) =>
                    speed ? `${fmt(v, 1)}` : formatPace(v).replace("/km", "")
                  }
                />
                <Tooltip
                  labelFormatter={(t: number) =>
                    new Date(t).toLocaleDateString("pt-BR")
                  }
                  formatter={(v: number, _n, item) => [
                    `${speed ? `${fmt(v, 1)} km/h` : formatPace(v)} · ${formatKm(item.payload.km)}`,
                    "",
                  ]}
                  separator=""
                />
                <Line
                  dataKey="value"
                  stroke="#2fb38f"
                  strokeWidth={2}
                  dot={{
                    r: 4,
                    fill: "#2fb38f",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <StrengthProgress activities={acts} />

      <Card>
        <h3 className="mb-3 text-lg font-extrabold">🏅 Recordes</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            longest && {
              label: "Maior distância",
              value: formatKm(longest.distanceKm!),
              sub: `${emoji(longest.name)} ${shortDay(dayTime(longest.date))}`,
            },
            fastest && {
              label: "Melhor ritmo",
              value: formatPace(fastest.minutes / fastest.distanceKm!),
              sub: `${emoji(fastest.name)} ${formatKm(fastest.distanceKm!)} · ${shortDay(dayTime(fastest.date))}`,
            },
            longestTime && {
              label: "Treino mais longo",
              value: formatDuration(longestTime.minutes),
              sub: `${emoji(longestTime.name)} ${shortDay(dayTime(longestTime.date))}`,
            },
            {
              label: "Total no ano",
              value: formatDuration(sum(acts, (a) => a.minutes)),
              sub: `${acts.length} treinos${hasKm ? ` · ${formatKm(sum(acts, (a) => a.distanceKm ?? 0))}` : ""}`,
            },
          ]
            .filter((r) => r !== null)
            .map((r) => (
              <div key={r.label} className="rounded-2xl bg-soft px-3 py-2">
                <div className="text-xs font-bold text-ink/50">{r.label}</div>
                <div className="text-lg font-extrabold">{r.value}</div>
                <div className="text-xs text-ink/50">{r.sub}</div>
              </div>
            ))}
        </div>
      </Card>

      {sport === "all" && bySport.length > 0 && (
        <Card>
          <h3 className="mb-2 text-lg font-extrabold">Últimos 30 dias</h3>
          <ul className="divide-y divide-slate-100">
            {bySport.map((s) => (
              <li key={s.name}>
                <button
                  onClick={() => setSport(s.name)}
                  className="flex w-full items-center gap-3 py-2 text-left"
                >
                  <span className="text-2xl">{emoji(s.name)}</span>
                  <span className="flex-1 font-bold">{s.name}</span>
                  <span className="text-right text-sm">
                    <span className="block font-extrabold">
                      {s.sessions}x · {formatDuration(s.minutes)}
                    </span>
                    {s.km > 0 && (
                      <span className="text-xs text-ink/50">
                        {formatKm(s.km)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {steps.length > 0 && (
        <Card>
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-extrabold">👟 Passos</h3>
            <Delta
              now={stepsAvg(thisWeek)}
              before={stepsAvg(thisWeek - 7 * DAY_MS)}
            />
          </div>
          <p className="text-sm text-ink/60">
            Média de {fmt(stepsAvg(thisWeek))} por dia nesta semana (semana
            passada: {fmt(stepsAvg(thisWeek - 7 * DAY_MS))})
          </p>
        </Card>
      )}

      <Card>
        <h3 className="mb-2 text-lg font-extrabold">Histórico</h3>
        <ul className="space-y-2">
          {[...acts]
            .reverse()
            .slice(0, 20)
            .map((a) => (
              <li key={a.id} className="rounded-2xl bg-soft px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">
                    {emoji(a.name)} {a.name}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-ink/50">
                    {new Date(`${a.date}T12:00:00`).toLocaleDateString(
                      "pt-BR",
                      {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      },
                    )}
                  </span>
                </div>
                <div className="text-sm text-ink/70">
                  {formatDuration(a.minutes)}
                  {a.distanceKm &&
                    ` · ${formatKm(a.distanceKm)} · ${paceLabel(a.name, a.minutes, a.distanceKm)}`}{" "}
                  · {fmt(a.kcal)} kcal
                </div>
                {a.exercises?.map((e, i) => (
                  <p key={i} className="text-xs text-ink/60">
                    🏋️ {exerciseSummary(e)}
                  </p>
                ))}
                {a.details && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink/50">
                    {a.details}
                  </p>
                )}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
