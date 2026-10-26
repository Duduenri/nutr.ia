import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { api } from "../lib/api";
import { today } from "../lib/date";
import { shrinkImage } from "../lib/image";
import { Button, Card, ErrorText, Field, fmt, inputClass, Sheet } from "./ui";

type MeasureKey =
  "waistCm" | "hipCm" | "chestCm" | "armCm" | "thighCm" | "bodyFatPct";

type Measure = { id: string; date: string } & Record<MeasureKey, number | null>;

interface BodyOverview {
  measures: Measure[];
  photos: { id: string; date: string; url: string }[];
}

const MEASURES: { key: MeasureKey; label: string; unit: string }[] = [
  { key: "waistCm", label: "Cintura", unit: "cm" },
  { key: "hipCm", label: "Quadril", unit: "cm" },
  { key: "chestCm", label: "Peito", unit: "cm" },
  { key: "armCm", label: "Braço", unit: "cm" },
  { key: "thighCm", label: "Coxa", unit: "cm" },
  { key: "bodyFatPct", label: "Gordura", unit: "%" },
];

const DAY_MS = 86_400_000;

function dayTime(day: string): number {
  return new Date(`${day}T12:00:00`).getTime();
}

function shortDay(day: string | number): string {
  const d =
    typeof day === "number" ? new Date(day) : new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function useBody() {
  return useQuery({
    queryKey: ["body"],
    queryFn: () => api.get<BodyOverview>("/body"),
  });
}

export function BodyCards() {
  const { data } = useBody();
  if (!data) return null;
  return (
    <>
      <MeasuresCard measures={data.measures} />
      <ProgressPhotosCard photos={data.photos} />
    </>
  );
}

function MeasuresCard({ measures }: { measures: Measure[] }) {
  const [open, setOpen] = useState(false);
  const available = MEASURES.filter((m) =>
    measures.some((x) => x[m.key] !== null),
  );
  const [picked, setPicked] = useState<MeasureKey | null>(null);
  const selected =
    available.find((m) => m.key === picked) ?? available[0] ?? null;
  const series = selected
    ? measures
        .filter((m) => m[selected.key] !== null)
        .map((m) => ({ t: dayTime(m.date), v: m[selected.key]! }))
    : [];

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-extrabold">📏 Medidas</h3>
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-bold text-mint-500"
        >
          + Medir
        </button>
      </div>
      {available.length === 0 ? (
        <p className="mt-1 text-sm text-ink/60">
          A balança não mostra tudo: quem ganha músculo pode manter o peso e
          perder cintura. Meça cintura, quadril, braço… a cada 2–4 semanas e
          acompanhe aqui.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {available.map((m) => {
              const values = measures.filter((x) => x[m.key] !== null);
              const first = values[0][m.key]!;
              const last = values[values.length - 1][m.key]!;
              const diff = last - first;
              return (
                <button
                  key={m.key}
                  onClick={() => setPicked(m.key)}
                  className={`rounded-2xl px-2 py-2 text-center ${
                    selected?.key === m.key
                      ? "bg-mint-50 ring-2 ring-mint-400"
                      : "bg-soft"
                  }`}
                >
                  <div className="text-xs font-bold text-ink/50">{m.label}</div>
                  <div className="text-lg font-extrabold">
                    {fmt(last, 1)} {m.unit}
                  </div>
                  {values.length > 1 && (
                    <div className="text-xs font-bold text-ink/60">
                      {diff > 0 ? "+" : ""}
                      {fmt(diff, 1)} {m.unit}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {selected && series.length >= 2 && (
            <div className="mt-3 h-40">
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
                    tickFormatter={(v: number) => fmt(v, 1)}
                  />
                  <Tooltip
                    labelFormatter={(t: number) =>
                      new Date(t).toLocaleDateString("pt-BR")
                    }
                    formatter={(v: number) => [
                      `${fmt(v, 1)} ${selected.unit}`,
                      selected.label,
                    ]}
                  />
                  <Line
                    dataKey="v"
                    stroke="#2fb38f"
                    strokeWidth={2}
                    dot={{
                      r: 4,
                      fill: "#2fb38f",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-ink/50">
            Diferença desde a primeira medição ({shortDay(measures[0].date)})
          </p>
        </>
      )}
      <MeasureSheet
        open={open}
        onClose={() => setOpen(false)}
        last={measures[measures.length - 1] ?? null}
      />
    </Card>
  );
}

function MeasureSheet({
  open,
  onClose,
  last,
}: {
  open: boolean;
  onClose: () => void;
  last: Measure | null;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<Record<MeasureKey, string>>(
    () =>
      Object.fromEntries(MEASURES.map((m) => [m.key, ""])) as Record<
        MeasureKey,
        string
      >,
  );
  const save = useMutation({
    mutationFn: () =>
      api.put("/body/measures", {
        date: today(),
        ...Object.fromEntries(
          MEASURES.map((m) => [
            m.key,
            f[m.key].trim()
              ? parseFloat(f[m.key].replace(",", "."))
              : undefined,
          ]),
        ),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["body"] });
      onClose();
    },
  });

  return (
    <Sheet open={open} onClose={onClose} title="Medidas de hoje">
      <div className="space-y-3 pb-6">
        <p className="text-sm text-ink/60">
          Meça com fita, de manhã, sempre no mesmo lugar (cintura na altura do
          umbigo, braço contraído no meio). Preencha só o que mediu.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {MEASURES.map((m) => (
            <Field key={m.key} label={`${m.label} (${m.unit})`}>
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder={
                  last?.[m.key] != null ? `antes: ${fmt(last[m.key], 1)}` : ""
                }
                value={f[m.key]}
                onChange={(e) => setF({ ...f, [m.key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <ErrorText error={save.error} />
        <Button
          className="w-full"
          loading={save.isPending}
          disabled={MEASURES.every((m) => !f[m.key].trim())}
          onClick={() => save.mutate()}
        >
          Salvar medidas
        </Button>
      </div>
    </Sheet>
  );
}

function ProgressPhotosCard({ photos }: Pick<BodyOverview, "photos">) {
  const qc = useQueryClient();
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [slot, setSlot] = useState<"before" | "after">("before");
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("date", today());
      form.append("photo", await shrinkImage(file), "progresso.jpg");
      return api.post("/body/photos", form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["body"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/body/photos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["body"] }),
  });

  const latest = photos[photos.length - 1];
  const monthAgo = latest
    ? [...photos]
        .reverse()
        .find((p) => dayTime(p.date) <= dayTime(latest.date) - 30 * DAY_MS)
    : undefined;
  const a =
    photos.find((p) => p.id === before) ?? monthAgo ?? photos[0] ?? null;
  const b = photos.find((p) => p.id === after) ?? latest ?? null;
  const days =
    a && b ? Math.round((dayTime(b.date) - dayTime(a.date)) / DAY_MS) : 0;

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-extrabold">📸 Fotos de progresso</h3>
        <label className="cursor-pointer text-sm font-bold text-mint-500">
          {upload.isPending ? "Enviando…" : "+ Foto"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <ErrorText error={upload.error ?? remove.error} />
      {photos.length === 0 ? (
        <p className="mt-1 text-sm text-ink/60">
          Tire uma foto de frente e uma de lado, mesma luz e mesma roupa, a cada
          2–4 semanas. Aqui você compara lado a lado. As fotos são só suas:
          ninguém mais vê.
        </p>
      ) : (
        <>
          {a && b && a.id !== b.id ? (
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Antes", a],
                  ["Depois", b],
                ].map(([label, p]) => {
                  const photo = p as typeof a;
                  return (
                    <div key={label as string}>
                      <img
                        src={photo.url}
                        alt={label as string}
                        className="aspect-[3/4] w-full rounded-2xl object-cover"
                      />
                      <div className="mt-1 text-center text-xs font-bold text-ink/60">
                        {label as string} · {shortDay(photo.date)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-center text-sm font-bold">
                {days} dias de diferença
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink/60">
              Adicione mais uma foto daqui a umas semanas pra comparar.
            </p>
          )}
          {photos.length > 2 && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-ink/50">
              Trocar foto do
              {(["before", "after"] as const).map((sl) => (
                <button
                  key={sl}
                  onClick={() => setSlot(sl)}
                  className={`rounded-full px-3 py-1 ${slot === sl ? "bg-ink text-white" : "bg-soft"}`}
                >
                  {sl === "before" ? "Antes" : "Depois"}
                </button>
              ))}
            </div>
          )}
          <div className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 pb-1">
            {photos.map((p) => (
              <div key={p.id} className="relative shrink-0">
                <button
                  onClick={() =>
                    slot === "before" ? setBefore(p.id) : setAfter(p.id)
                  }
                  className={`block overflow-hidden rounded-xl ${
                    p.id === a?.id || p.id === b?.id
                      ? "ring-2 ring-mint-500"
                      : ""
                  }`}
                >
                  <img src={p.url} alt="" className="h-20 w-16 object-cover" />
                </button>
                <div className="text-center text-[10px] font-bold text-ink/50">
                  {shortDay(p.date)}
                </div>
                <button
                  onClick={() => {
                    if (window.confirm("Apagar essa foto?"))
                      remove.mutate(p.id);
                  }}
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-white"
                  aria-label="Apagar foto"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
