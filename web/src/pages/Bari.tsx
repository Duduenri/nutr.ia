import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Button,
  Card,
  ErrorText,
  fmt,
  Segmented,
  Sheet,
  Spinner,
} from "../components/ui";
import {
  api,
  SURGERY_LABEL,
  type BariGuide,
  type BariMonth,
  type LabMarker,
  type LabOverview,
  type LabStatus,
  type Profile,
  type SurgeryType,
} from "../lib/api";
import { shortDate, today } from "../lib/date";

const STATUS: Record<LabStatus, { label: string; tone: string }> = {
  LOW: { label: "Abaixo", tone: "bg-peach-100 text-peach-500" },
  HIGH: { label: "Acima", tone: "bg-peach-100 text-peach-500" },
  NORMAL: { label: "Normal", tone: "bg-mint-50 text-mint-500" },
  UNKNOWN: { label: "Sem faixa", tone: "bg-soft text-ink/50" },
};

function StatusChip({ status }: { status: LabStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${STATUS[status].tone}`}
    >
      {STATUS[status].label}
    </span>
  );
}

function dayTime(day: string) {
  return new Date(`${day}T12:00:00`).getTime();
}

type Tab = "exams" | "goals" | "guide";

export function BariPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("exams");
  return (
    <div>
      <header className="pt-safe bg-gradient-to-br from-[#ece4fb] to-[#fde8d4] px-4 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl"
            aria-label="Voltar"
          >
            ‹
          </button>
          <h1 className="text-2xl font-extrabold">Saúde bari 💜</h1>
        </div>
        <div className="mt-4">
          <Segmented
            options={[
              { value: "exams", label: "Exames" },
              { value: "goals", label: "Metas" },
              { value: "guide", label: "Guia" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </header>
      <div className="space-y-4 px-4 pt-4">
        {tab === "exams" && <ExamsTab />}
        {tab === "goals" && <GoalsTab />}
        {tab === "guide" && <GuideTab />}
        <p className="pb-4 text-center text-xs text-ink/50">
          O app ajuda a acompanhar, mas não faz diagnóstico. Converse sobre os
          resultados e as doses com sua equipe (nutricionista e médico).
        </p>
      </div>
    </div>
  );
}

function ExamsTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<LabMarker | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: () => api.get<LabOverview>("/exams"),
  });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("today", today());
      return api.post<{ imported: number; collectedAt: string }>(
        "/exams",
        form,
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["exams"] });
      void qc.invalidateQueries({ queryKey: ["bari-guide"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/exams/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["exams"] }),
  });

  const markers = data?.markers ?? [];
  const key = markers.filter((m) => m.key);
  const out = markers.filter(
    (m) => m.latest.status === "LOW" || m.latest.status === "HIGH",
  );
  const categories = [
    ...new Set(markers.filter((m) => !m.key).map((m) => m.category)),
  ].sort();

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload.mutate(f);
        }}
      />
      <Card className="space-y-3 text-center">
        <div className="text-4xl">🧪</div>
        <p className="text-sm text-ink/60">
          Envie o PDF do laboratório ou uma foto do laudo. A IA lê cada
          resultado, a faixa de referência e o histórico. Seu nome, CPF e RG são
          removidos antes da leitura.
        </p>
        <ErrorText error={upload.error} />
        {upload.isSuccess && (
          <p className="rounded-2xl bg-mint-50 px-4 py-2 text-sm font-bold text-mint-500">
            {upload.data.imported} resultados importados ✓
          </p>
        )}
        <Button
          className="w-full"
          loading={upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {upload.isPending
            ? "Lendo seu exame… (até 1 min)"
            : "📎 Enviar exame"}
        </Button>
      </Card>

      {isLoading && (
        <div className="text-center text-mint-500">
          <Spinner />
        </div>
      )}

      {markers.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-white py-3 shadow-card">
            <div className="text-2xl font-extrabold text-mint-500">
              {markers.length - out.length}
            </div>
            <div className="text-xs text-ink/60">dentro da faixa</div>
          </div>
          <div className="rounded-2xl bg-white py-3 shadow-card">
            <div
              className={`text-2xl font-extrabold ${out.length ? "text-peach-500" : "text-ink/40"}`}
            >
              {out.length}
            </div>
            <div className="text-xs text-ink/60">fora da faixa</div>
          </div>
        </div>
      )}

      {key.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-extrabold">
            ⭐ Importantes na bariátrica
          </h2>
          <MarkerList markers={key} onOpen={setOpen} />
        </section>
      )}
      {categories.map((c) => (
        <section key={c}>
          <h2 className="mb-2 font-extrabold text-ink/70">{c}</h2>
          <MarkerList
            markers={markers.filter((m) => !m.key && m.category === c)}
            onOpen={setOpen}
          />
        </section>
      ))}

      {data && data.exams.length > 0 && (
        <section>
          <h2 className="mb-2 font-extrabold text-ink/70">Laudos enviados</h2>
          <ul className="space-y-2">
            {data.exams.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card"
              >
                <span className="flex-1">
                  <span className="block font-bold">{e.title}</span>
                  <span className="text-xs text-ink/50">
                    {e.results} resultados
                  </span>
                </span>
                {e.hasFile && (
                  <a
                    href={`/api/exams/${e.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-mint-500"
                  >
                    Ver
                  </a>
                )}
                <button
                  className="text-sm font-bold text-ink/40"
                  onClick={() => {
                    if (
                      window.confirm(`Apagar ${e.title} e os resultados dele?`)
                    )
                      remove.mutate(e.id);
                  }}
                >
                  Apagar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <MarkerSheet marker={open} onClose={() => setOpen(null)} />
    </>
  );
}

function MarkerList({
  markers,
  onOpen,
}: {
  markers: LabMarker[];
  onOpen: (m: LabMarker) => void;
}) {
  return (
    <ul className="space-y-2">
      {markers.map((m) => (
        <li key={m.code}>
          <button
            onClick={() => onOpen(m)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-card"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{m.name}</span>
              <span className="text-xs text-ink/50">
                {m.refLow !== null || m.refHigh !== null
                  ? `ref ${m.refLow !== null ? fmt(m.refLow, 2) : ""}${m.refLow !== null && m.refHigh !== null ? "–" : ""}${m.refHigh !== null ? fmt(m.refHigh, 2) : ""}`
                  : (m.refText ?? "")}
                {" · "}
                {shortDate(m.latest.date)}
              </span>
            </span>
            <span className="text-right font-extrabold">
              {fmt(m.latest.value, 2)}{" "}
              <span className="text-xs font-bold text-ink/50">{m.unit}</span>
            </span>
            <StatusChip status={m.latest.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function MarkerSheet({
  marker,
  onClose,
}: {
  marker: LabMarker | null;
  onClose: () => void;
}) {
  const points =
    marker?.history.map((h) => ({ t: dayTime(h.date), value: h.value })) ?? [];
  const values = points
    .map((p) => p.value)
    .concat(
      [marker?.refLow, marker?.refHigh].filter(
        (v): v is number => v !== null && v !== undefined,
      ),
    );
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = (max - min) * 0.15 || 1;

  return (
    <Sheet open={Boolean(marker)} onClose={onClose} title={marker?.name}>
      {marker && (
        <div className="space-y-4 pb-6">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-extrabold">
              {fmt(marker.latest.value, 2)}{" "}
              <span className="text-base text-ink/50">{marker.unit}</span>
            </span>
            <StatusChip status={marker.latest.status} />
          </div>
          {marker.refText && (
            <p className="text-sm text-ink/60">
              Referência do laudo: {marker.refText}
            </p>
          )}
          {points.length > 1 && (
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart
                  data={points}
                  margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#eef0f4" />
                  {(marker.refLow !== null || marker.refHigh !== null) && (
                    <ReferenceArea
                      y1={marker.refLow ?? min - pad}
                      y2={marker.refHigh ?? max + pad}
                      fill="#2fb38f"
                      fillOpacity={0.08}
                      ifOverflow="extendDomain"
                    />
                  )}
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(t: number) =>
                      new Date(t).toLocaleDateString("pt-BR", {
                        month: "2-digit",
                        year: "2-digit",
                      })
                    }
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[min - pad, max + pad]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    labelFormatter={(t: number) =>
                      new Date(t).toLocaleDateString("pt-BR")
                    }
                    formatter={(v: number) => [
                      `${fmt(v, 2)} ${marker.unit}`,
                      marker.name,
                    ]}
                  />
                  <Line
                    dataKey="value"
                    stroke="#8b6fd6"
                    strokeWidth={3}
                    dot={{ r: 5, fill: "#8b6fd6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {[...marker.history].reverse().map((h) => (
              <li
                key={h.date}
                className="flex items-center justify-between py-2"
              >
                <span className="text-ink/70">
                  {new Date(`${h.date}T12:00:00`).toLocaleDateString("pt-BR")}
                </span>
                <span className="flex items-center gap-2 font-extrabold">
                  {fmt(h.value, 2)} {marker.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

function monthShift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function GoalsTab() {
  const current = today().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [picked, setPicked] = useState<BariMonth["days"][number] | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["bari-month", month],
    queryFn: () =>
      api.get<BariMonth>(`/bari/month?month=${month}&today=${today()}`),
  });
  const [y, m] = month.split("-").map(Number);
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const rawLabel = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  return (
    <>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth(monthShift(month, -1))}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl shadow-card"
        >
          ‹
        </button>
        <span className="text-lg font-extrabold">{label}</span>
        <button
          disabled={month >= current}
          onClick={() => setMonth(monthShift(month, 1))}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl shadow-card disabled:opacity-30"
        >
          ›
        </button>
      </div>
      {isLoading && (
        <div className="text-center text-mint-500">
          <Spinner />
        </div>
      )}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["💊", data.summary.supplementsOk, "reposição completa"],
              ["🥩", data.summary.proteinOk, "proteína batida"],
              ["⭐", data.summary.bothOk, "as duas"],
            ].map(([icon, n, text]) => (
              <div
                key={text as string}
                className="rounded-2xl bg-white py-3 shadow-card"
              >
                <div className="text-xl font-extrabold">
                  {icon} {n}
                  <span className="text-sm text-ink/40">
                    /{data.summary.days}
                  </span>
                </div>
                <div className="text-xs text-ink/60">{text}</div>
              </div>
            ))}
          </div>
          <Card>
            <div className="mb-2 grid grid-cols-7 text-center text-xs font-bold text-ink/40">
              {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstDow }).map((_, i) => (
                <span key={`e${i}`} />
              ))}
              {data.days.map((d) => {
                const both = d.supplementsOk && d.proteinOk;
                const one = d.supplementsOk || d.proteinOk;
                return (
                  <button
                    key={d.date}
                    onClick={() => setPicked(d)}
                    className={`aspect-square rounded-xl text-sm font-extrabold ${
                      both
                        ? "bg-mint-500 text-white"
                        : one
                          ? "bg-sun/60"
                          : "bg-soft text-ink/40"
                    }`}
                  >
                    {Number(d.date.slice(8))}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs font-bold text-ink/60">
              <span>🟩 reposição + proteína</span>
              <span>🟨 uma das duas</span>
              <span>⬜ nenhuma</span>
            </div>
          </Card>
          {picked && (
            <Card className="space-y-1">
              <h3 className="font-extrabold">
                {new Date(`${picked.date}T12:00:00`).toLocaleDateString(
                  "pt-BR",
                )}
              </h3>
              <p className="text-sm">
                💊 Reposição: {picked.dosesTaken}/{picked.dosesExpected} doses{" "}
                {picked.supplementsOk ? "✅" : ""}
              </p>
              <p className="text-sm">
                🥩 Proteína: {picked.protein}/{picked.proteinTarget} g{" "}
                {picked.proteinOk ? "✅" : ""}
              </p>
            </Card>
          )}
          {data.days.every((d) => d.dosesExpected === 0) && (
            <p className="rounded-2xl bg-sun/30 px-4 py-3 text-sm">
              Cadastre seus suplementos no card 💊 Reposição do Diário pra
              acompanhar aqui.
            </p>
          )}
        </>
      )}
    </>
  );
}

function GuideTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: guide } = useQuery({
    queryKey: ["bari-guide"],
    queryFn: () => api.get<BariGuide>("/bari/guide"),
  });
  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: () => api.get<LabOverview>("/exams"),
  });
  const { data: docs } = useQuery({
    queryKey: ["documents"],
    queryFn: () =>
      api.get<{ id: string; title: string; createdAt: string }[]>("/documents"),
  });
  const setSurgery = useMutation({
    mutationFn: (surgeryType: SurgeryType) =>
      api.patch<Profile>("/profile", { surgeryType }),
    onSuccess: (p) => {
      qc.setQueryData(["profile"], p);
      void qc.invalidateQueries({ queryKey: ["bari-guide"] });
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post("/documents", form);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["documents"] }),
  });
  const removeDoc = useMutation({
    mutationFn: (id: string) => api.del(`/documents/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["documents"] }),
  });
  const statusOf = (code: string) =>
    exams?.markers.find((m) => m.code === code);

  return (
    <>
      <Card>
        <h2 className="mb-2 font-extrabold">Tipo de cirurgia</h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SURGERY_LABEL) as SurgeryType[]).map((s) => (
            <button
              key={s}
              disabled={setSurgery.isPending}
              onClick={() => setSurgery.mutate(s)}
              className={`rounded-2xl border-2 py-2 text-sm font-bold ${
                guide?.surgeryType === s
                  ? "border-[#8b6fd6] bg-[#ece4fb]"
                  : "border-slate-100"
              }`}
            >
              {SURGERY_LABEL[s]}
            </button>
          ))}
        </div>
        {!guide?.surgeryType && (
          <p className="mt-2 text-xs text-ink/50">
            Escolha pra ver as doses certas pra sua cirurgia.
          </p>
        )}
      </Card>
      <section>
        <h2 className="mb-2 text-lg font-extrabold">
          Doses preventivas de referência
        </h2>
        <ul className="space-y-2">
          {guide?.items.map((g) => (
            <li key={g.key} className="rounded-2xl bg-white p-3 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <span className="font-extrabold">{g.name}</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {g.labCodes.map((c) => {
                    const m = statusOf(c);
                    return m ? (
                      <span
                        key={c}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[m.latest.status].tone}`}
                      >
                        {m.name}: {fmt(m.latest.value, 1)}
                      </span>
                    ) : null;
                  })}
                </span>
              </div>
              <p className="text-sm font-bold text-[#6b52c0]">
                {g.dose ?? "—"}
              </p>
              {g.note && <p className="text-xs text-ink/60">{g.note}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink/50">
          Referência geral pós-bariátrica. A prescrição da sua equipe sempre
          vale mais.
        </p>
      </section>
      <Card className="space-y-3">
        <h2 className="font-extrabold">📚 Material da nutricionista</h2>
        <p className="text-sm text-ink/60">
          PDFs que você enviar aqui viram base da sua coach: ela responde usando
          esse material. Fica só na sua conta.
        </p>
        <ul className="space-y-1">
          {docs?.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-2xl bg-soft px-3 py-2 text-sm"
            >
              <span className="truncate font-bold">{d.title}</span>
              <button
                className="shrink-0 font-bold text-ink/40"
                onClick={() => removeDoc.mutate(d.id)}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload.mutate(f);
          }}
        />
        <ErrorText error={upload.error} />
        <Button
          variant="soft"
          className="w-full"
          loading={upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          📎 Enviar PDF
        </Button>
      </Card>
    </>
  );
}
