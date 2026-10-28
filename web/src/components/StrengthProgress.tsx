import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrainingHistory } from "../lib/api";
import { exerciseMuscles, MUSCLE_ORDER } from "../lib/training";
import { BodyLegend, BodyMap } from "./BodyMap";
import { Card, fmt } from "./ui";

type Activity = TrainingHistory["activities"][number];

function dayTime(day: string): number {
  return new Date(`${day}T12:00:00`).getTime();
}

function shortDay(t: number): string {
  return new Date(t).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

const key = (name: string) => name.trim().toLowerCase();

const PERIODS = [
  { days: 7, label: "7 dias", steps: [1, 4, 10] },
  { days: 30, label: "30 dias", steps: [1, 16, 40] },
] as const;

export function StrengthProgress({ activities }: { activities: Activity[] }) {
  const sessions = activities.filter((a) => a.exercises?.length);
  const byName = new Map<string, { label: string; count: number }>();
  sessions.forEach((a) =>
    a.exercises!.forEach((e) => {
      const k = key(e.name);
      const cur = byName.get(k);
      byName.set(k, {
        label: cur?.label ?? e.name,
        count: (cur?.count ?? 0) + 1,
      });
    }),
  );
  const names = [...byName.entries()].sort((a, b) => b[1].count - a[1].count);
  const [picked, setPicked] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [period, setPeriod] = useState<0 | 1>(0);
  if (!names.length) return null;

  const primaryOf = (label: string) => {
    const p = exerciseMuscles(label).primary;
    return p.length ? p : ["Outros"];
  };
  const groups = MUSCLE_ORDER.map((g) => ({
    name: g,
    count: names.filter(([, v]) => primaryOf(v.label).includes(g)).length,
  })).filter((g) => g.count > 0);
  const activeGroup = group ?? groups[0]?.name;
  const inGroup = names.filter(([, v]) =>
    primaryOf(v.label).includes(activeGroup),
  );
  const selected =
    picked && inGroup.some(([k]) => k === picked) ? picked : inGroup[0]?.[0];
  const pickedLabel = picked ? byName.get(picked)?.label : null;

  const { days, steps } = PERIODS[period];
  const since = Date.now() - days * 86_400_000;
  const load = new Map<string, number>();
  for (const a of sessions) {
    if (dayTime(a.date) < since) continue;
    for (const e of a.exercises!) {
      const m = exerciseMuscles(e.name);
      m.primary.forEach((g) => load.set(g, (load.get(g) ?? 0) + e.sets.length));
      m.secondary.forEach((g) =>
        load.set(g, (load.get(g) ?? 0) + e.sets.length / 2),
      );
    }
  }
  const exerciseMap = pickedLabel ? exerciseMuscles(pickedLabel) : null;
  const level = (muscle: string): 0 | 1 | 2 | 3 => {
    if (exerciseMap) {
      if (exerciseMap.primary.includes(muscle as never)) return 3;
      if (exerciseMap.secondary.includes(muscle as never)) return 1;
      return 0;
    }
    const sets = load.get(muscle) ?? 0;
    if (sets < steps[0]) return 0;
    if (sets < steps[1]) return 1;
    if (sets < steps[2]) return 2;
    return 3;
  };

  return (
    <Card>
      <h3 className="text-lg font-extrabold">
        🏋️ Músculos e evolução de carga
      </h3>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-bold text-ink/50">
          {exerciseMap
            ? `O que ${pickedLabel} trabalha`
            : `Séries por músculo nos últimos ${days} dias`}
        </span>
        {exerciseMap ? (
          <button
            onClick={() => setPicked(null)}
            className="text-xs font-bold text-mint-500"
          >
            Ver meus treinos
          </button>
        ) : (
          <div className="flex gap-1">
            {PERIODS.map((p, i) => (
              <button
                key={p.days}
                onClick={() => setPeriod(i as 0 | 1)}
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  period === i ? "bg-ink text-white" : "bg-soft text-ink/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <BodyMap
        level={level}
        selected={exerciseMap ? null : activeGroup}
        onSelect={(m) => {
          setGroup(m);
          setPicked(null);
        }}
      />
      <BodyLegend
        items={
          exerciseMap
            ? [
                ["Principal", 3],
                ["Também trabalha", 1],
              ]
            : [
                ["Não treinou", 0],
                ["Pouco", 1],
                ["Bom", 2],
                ["Muito", 3],
              ]
        }
      />
      {exerciseMap && (
        <p className="mt-1 text-center text-xs text-ink/60">
          {exerciseMap.primary.length
            ? `Principal: ${exerciseMap.primary.join(", ")}${exerciseMap.secondary.length ? ` · também: ${exerciseMap.secondary.join(", ")}` : ""}`
            : "Não reconheci esse exercício."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <button
            key={g.name}
            onClick={() => {
              setGroup(g.name);
              setPicked(null);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${
              g.name === activeGroup ? "bg-ink text-white" : "bg-soft"
            }`}
          >
            {g.name} <span className="opacity-60">{g.count}</span>
          </button>
        ))}
      </div>
      {inGroup.length === 0 ? (
        <p className="mt-3 text-sm text-ink/60">
          Nenhum exercício de {activeGroup.toLowerCase()} registrado ainda.
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {inGroup.map(([k, v]) => (
              <button
                key={k}
                onClick={() => setPicked(k)}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  k === selected
                    ? "border-mint-500 bg-mint-50 text-ink"
                    : "border-slate-200 text-ink/60"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <ExerciseProgress sessions={sessions} selected={selected!} />
        </>
      )}
    </Card>
  );
}

function ExerciseProgress({
  sessions,
  selected,
}: {
  sessions: Activity[];
  selected: string;
}) {
  const points = sessions.flatMap((a) =>
    a
      .exercises!.filter((e) => key(e.name) === selected)
      .map((e) => {
        const best = e.sets.reduce(
          (b, s) => (s.kg > b.kg || (s.kg === b.kg && s.reps > b.reps) ? s : b),
          e.sets[0],
        );
        return {
          t: dayTime(a.date),
          kg: best.kg,
          reps: best.reps,
          totalReps: e.sets.reduce((v, s) => v + s.reps, 0),
          volume: e.sets.reduce((v, s) => v + s.reps * s.kg, 0),
          sets: e.sets.length,
        };
      }),
  );
  const noLoad = points.every((p) => p.kg === 0);
  const unit = noLoad ? "reps" : "kg";
  const valueOf = (p: (typeof points)[number]) => (noLoad ? p.reps : p.kg);
  const series = points.map((p) => ({ ...p, v: valueOf(p) }));
  const first = series[0];
  const lastPoint = series[series.length - 1];
  const record = series.reduce((b, p) => (p.v > b.v ? p : b), series[0]);
  const gain = lastPoint.v - first.v;

  return (
    <>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-soft py-2">
          <div className="text-xs font-bold text-ink/50">Recorde</div>
          <div className="text-lg font-extrabold">
            {fmt(record.v, 1)} {unit}
          </div>
          <div className="text-xs text-ink/50">
            {noLoad ? "sem carga" : `${record.reps} reps`} ·{" "}
            {shortDay(record.t)}
          </div>
        </div>
        <div className="rounded-2xl bg-soft py-2">
          <div className="text-xs font-bold text-ink/50">Evolução</div>
          <div
            className={`text-lg font-extrabold ${gain > 0 ? "text-mint-500" : ""}`}
          >
            {gain > 0 ? "+" : ""}
            {fmt(gain, 1)} {unit}
          </div>
          <div className="text-xs text-ink/50">
            {fmt(first.v, 1)} → {fmt(lastPoint.v, 1)} {unit}
          </div>
        </div>
        <div className="rounded-2xl bg-soft py-2">
          <div className="text-xs font-bold text-ink/50">
            {noLoad ? "Último total" : "Último volume"}
          </div>
          <div className="text-lg font-extrabold">
            {noLoad
              ? `${lastPoint.totalReps} reps`
              : `${fmt(lastPoint.volume)} kg`}
          </div>
          <div className="text-xs text-ink/50">
            {lastPoint.sets} séries · {points.length}{" "}
            {points.length === 1 ? "treino" : "treinos"}
          </div>
        </div>
      </div>
      {points.length >= 2 ? (
        <div className="mt-3 h-44">
          <ResponsiveContainer>
            <LineChart
              data={series}
              margin={{ top: 10, right: 16, left: -14, bottom: 0 }}
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
                domain={["auto", "auto"]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}`}
                unit={` ${unit}`}
                width={58}
              />
              <Tooltip
                labelFormatter={(t: number) =>
                  new Date(t).toLocaleDateString("pt-BR")
                }
                formatter={(v: number, _n, item) => [
                  noLoad
                    ? `${v} reps · ${item.payload.totalReps} no total`
                    : `${fmt(v, 1)} kg × ${item.payload.reps} · volume ${fmt(item.payload.volume)} kg`,
                  "",
                ]}
                separator=""
              />
              <Line
                dataKey="v"
                stroke="#2fb38f"
                strokeWidth={2}
                dot={{ r: 4, fill: "#2fb38f", stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/60">
          Registre esse exercício em mais um treino pra ver o gráfico de
          evolução.
        </p>
      )}
      <p className="mt-1 text-xs text-ink/50">
        {noLoad
          ? "Sem carga registrada: o gráfico mostra as repetições da melhor série."
          : "Gráfico: maior carga de cada treino."}
      </p>
    </>
  );
}
