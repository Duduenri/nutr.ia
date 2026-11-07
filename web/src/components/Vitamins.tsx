import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Profile } from "../lib/api";
import { today } from "../lib/date";
import {
  MICROS,
  microName,
  microRef,
  type MicroGroup,
  type MicroInfo,
} from "../lib/micros";
import {
  Card,
  ErrorText,
  fmt,
  ProgressBar,
  Segmented,
  Sheet,
  Spinner,
} from "./ui";

interface MicroStat {
  avg: number;
  coverage: number;
  top: { name: string; amount: number; count: number }[];
}

interface MicrosStats {
  days: number;
  loggedDays: number;
  entries: number;
  nutrients: Record<string, MicroStat>;
}

type Range = "1" | "7" | "30";

const RANGES: { value: Range; label: string }[] = [
  { value: "1", label: "Hoje" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
];

const GROUPS: { group: MicroGroup; title: string; hint: string }[] = [
  {
    group: "vitamin",
    title: "Vitaminas",
    hint: "quanto mais perto de 100%, melhor",
  },
  {
    group: "mineral",
    title: "Minerais",
    hint: "quanto mais perto de 100%, melhor",
  },
  {
    group: "limit",
    title: "Pra moderar",
    hint: "o ideal é ficar abaixo do limite",
  },
];

const digits = (v: number) => (v < 10 ? 1 : 0);

function pctOf(value: number, ref: number) {
  return ref > 0 ? Math.round((value / ref) * 100) : 0;
}

function barColor(info: MicroInfo, pct: number) {
  if (info.limit) return pct > 100 ? "bg-peach-500" : "bg-mint-500";
  if (pct >= 100) return "bg-mint-500";
  if (pct >= 50) return "bg-sun";
  return "bg-peach-400";
}

export function VitaminsTab({ profile }: { profile: Profile }) {
  const [range, setRange] = useState<Range>("7");
  const [open, setOpen] = useState<MicroInfo | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["stats", "micros", range],
    queryFn: () =>
      api.get<MicrosStats>(`/stats/micros?days=${range}&end=${today()}`),
  });
  const per = range === "1" ? "hoje" : "por dia (média)";

  const rows = MICROS.map((info) => {
    const stat = data?.nutrients[info.key];
    const ref = microRef(info.key, profile.sex);
    return { info, stat, ref, pct: pctOf(stat?.avg ?? 0, ref) };
  });
  const tracked = rows.filter((r) => !r.info.limit && r.stat?.coverage);
  const ok = tracked.filter((r) => r.pct >= 100);
  const low = tracked
    .filter((r) => r.pct < 70)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  return (
    <>
      <Segmented options={RANGES} value={range} onChange={setRange} />
      <ErrorText error={error} />
      {isLoading && (
        <div className="grid place-items-center py-10 text-mint-500">
          <Spinner />
        </div>
      )}
      {data && data.entries === 0 && (
        <Card>
          <p className="text-center text-ink/60">
            Nenhum alimento registrado nesse período. Registre suas refeições
            pra ver suas vitaminas e minerais.
          </p>
        </Card>
      )}
      {data && data.entries > 0 && (
        <>
          <Card>
            <h3 className="text-lg font-extrabold">
              {ok.length} de {tracked.length} em dia
            </h3>
            <p className="text-sm text-ink/60">
              {data.loggedDays} {data.loggedDays === 1 ? "dia" : "dias"} com
              registro · referência para{" "}
              {profile.sex === "MALE"
                ? "homens adultos"
                : profile.sex === "FEMALE"
                  ? "mulheres adultas"
                  : "adultos"}
            </p>
            {low.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-extrabold">Tá faltando</p>
                {low.map((r) => (
                  <button
                    key={r.info.key}
                    onClick={() => setOpen(r.info)}
                    className="block w-full rounded-2xl bg-peach-100 px-3 py-2 text-left text-sm"
                  >
                    <b>
                      {r.info.label} · {r.pct}%
                    </b>
                    <span className="block text-ink/70">
                      Onde tem: {r.info.sources}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
          {GROUPS.map(({ group, title, hint }) => (
            <Card key={group}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-extrabold">{title}</h3>
                <span className="text-right text-xs text-ink/50">{hint}</span>
              </div>
              <ul className="mt-2 divide-y divide-slate-100">
                {rows
                  .filter((r) => r.info.group === group)
                  .map(({ info, stat, ref, pct }) => (
                    <li key={info.key}>
                      <button
                        onClick={() => setOpen(info)}
                        className="block w-full py-2.5 text-left"
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate font-bold">
                            {info.label}
                            {info.tag && (
                              <span className="ml-1 text-xs font-semibold text-ink/50">
                                {info.tag}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-sm font-extrabold">
                            {stat?.coverage
                              ? `${fmt(stat.avg, digits(stat.avg))} ${info.unit} · ${pct}%`
                              : "sem dados"}
                          </span>
                        </span>
                        {stat?.coverage ? (
                          <>
                            <ProgressBar
                              value={stat.avg}
                              max={ref}
                              color={barColor(info, pct)}
                              className="mt-1.5 h-2"
                            />
                            {stat.coverage < 0.6 && (
                              <span className="mt-1 block text-[11px] text-ink/40">
                                Só {Math.round(stat.coverage * 100)}% dos
                                alimentos têm esse dado, o valor real pode ser
                                maior
                              </span>
                            )}
                          </>
                        ) : null}
                      </button>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
          <p className="pb-2 text-center text-xs text-ink/40">
            Valores {per}, estimados pela tabela TACO, rótulos e IA. Não
            substituem exame de sangue nem a orientação da sua nutricionista.
          </p>
        </>
      )}
      {open && (
        <MicroSheet
          info={open}
          stat={data?.nutrients[open.key]}
          ref_={microRef(open.key, profile.sex)}
          per={per}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function MicroSheet({
  info,
  stat,
  ref_,
  per,
  onClose,
}: {
  info: MicroInfo;
  stat: MicroStat | undefined;
  ref_: number;
  per: string;
  onClose: () => void;
}) {
  const avg = stat?.avg ?? 0;
  const pct = pctOf(avg, ref_);
  return (
    <Sheet open onClose={onClose} title={microName(info)}>
      <div className="space-y-4 pb-6">
        <div className="rounded-2xl bg-soft p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold">
              {fmt(avg, digits(avg))} {info.unit}
            </span>
            <span className="text-sm font-bold text-ink/60">
              {pct}% {info.limit ? "do limite" : "da referência"}
            </span>
          </div>
          <ProgressBar
            value={avg}
            max={ref_}
            color={barColor(info, pct)}
            className="mt-2 h-2"
          />
          <p className="mt-2 text-xs text-ink/50">
            {per[0].toUpperCase() + per.slice(1)}.{" "}
            {info.limit ? "Limite" : "Referência"} diária:{" "}
            {fmt(ref_, digits(ref_))} {info.unit}.
          </p>
        </div>
        <div className="rounded-2xl bg-mint-50 px-4 py-3 text-sm">
          <b>{info.limit ? "De onde costuma vir:" : "Onde encontrar:"}</b>{" "}
          {info.sources}
        </div>
        {stat?.top.length ? (
          <div>
            <h4 className="mb-2 font-extrabold">
              {info.limit ? "O que mais trouxe" : "O que mais te deu"}
            </h4>
            <ul className="space-y-2">
              {stat.top.map((t) => (
                <li
                  key={t.name}
                  className="flex items-baseline justify-between gap-3 rounded-2xl bg-soft px-3 py-2"
                >
                  <span className="min-w-0 truncate font-bold">
                    {t.name}
                    {t.count > 1 ? ` (${t.count}x)` : ""}
                  </span>
                  <span className="shrink-0 font-extrabold">
                    {fmt(t.amount, digits(t.amount))} {info.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-center text-sm text-ink/60">
            Nenhum alimento do período trouxe {info.label}.
          </p>
        )}
      </div>
    </Sheet>
  );
}
