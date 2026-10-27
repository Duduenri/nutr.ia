import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Profile } from "../lib/api";
import { today } from "../lib/date";
import { Button, Card, ErrorText, fmt, ProgressBar } from "./ui";

interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AdaptiveEstimate {
  status: "not_applicable" | "collecting" | "unreliable" | "ready";
  windowDays: number;
  loggedDays: number;
  minLoggedDays: number;
  weighIns: number;
  weightSpanDays: number;
  minWeightSpanDays: number;
  avgIntake: number | null;
  weeklyChangeKg: number | null;
  tdee: number | null;
  formulaTdee: number | null;
  goalAdjust: number;
  current: Macros;
  suggested: Macros | null;
  capped: boolean;
}

function signed(v: number, digits = 0) {
  return `${v > 0 ? "+" : ""}${fmt(v, digits)}`;
}

export function AdaptiveCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["adaptive", today()],
    queryFn: () =>
      api.get<AdaptiveEstimate>(`/profile/adaptive?today=${today()}`),
  });
  const apply = useMutation({
    mutationFn: () =>
      api.post<Profile>(`/profile/adaptive/apply?today=${today()}`),
    onSuccess: (p) => {
      qc.setQueryData(["profile"], p);
      void qc.invalidateQueries({ queryKey: ["adaptive"] });
      void qc.invalidateQueries({ queryKey: ["diary"] });
    },
  });

  if (!data || data.status === "not_applicable") return null;

  if (data.status === "collecting") {
    const weightOk =
      data.weighIns >= 2 && data.weightSpanDays >= data.minWeightSpanDays;
    return (
      <Card>
        <h3 className="text-lg font-extrabold">🔬 Seu gasto real</h3>
        <p className="mt-1 text-sm text-ink/60">
          Com algumas semanas de registro eu calculo quanto seu corpo gasta de
          verdade (não pela fórmula) e ajusto suas calorias.
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div>
            <div className="flex justify-between font-bold">
              <span>📒 Dias bem registrados</span>
              <span>
                {Math.min(data.loggedDays, data.minLoggedDays)}/
                {data.minLoggedDays}
              </span>
            </div>
            <ProgressBar
              value={data.loggedDays}
              max={data.minLoggedDays}
              className="mt-1 h-1.5"
            />
          </div>
          <div className="flex justify-between font-bold">
            <span>
              ⚖️ Pesagens com {data.minWeightSpanDays}+ dias entre elas
            </span>
            <span>{weightOk ? "✓" : `${data.weighIns} pesagem(ns)`}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink/50">
          Conta o dia em que você registrou todas as refeições. Pese-se de
          manhã, em jejum, 1–2x por semana.
        </p>
      </Card>
    );
  }

  if (data.status === "unreliable") {
    return (
      <Card>
        <h3 className="text-lg font-extrabold">🔬 Seu gasto real</h3>
        <p className="mt-1 text-sm text-ink/60">
          Os números das últimas semanas ficaram estranhos (talvez alguma
          refeição não registrada ou pesagem em horário diferente). Continue
          registrando que eu recalculo.
        </p>
      </Card>
    );
  }

  const s = data.suggested!;
  const diff = s.kcal - data.current.kcal;
  const same = Math.abs(diff) < 50;

  return (
    <Card>
      <h3 className="text-lg font-extrabold">🔬 Seu gasto real</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold">{fmt(data.tdee)}</span>
        <span className="text-sm font-bold text-ink/60">kcal/dia</span>
      </div>
      <p className="text-sm text-ink/60">
        Nas últimas {data.windowDays / 7} semanas você comeu em média{" "}
        <b>{fmt(data.avgIntake)} kcal</b> e seu peso{" "}
        {Math.abs(data.weeklyChangeKg ?? 0) < 0.05
          ? "ficou estável"
          : `${(data.weeklyChangeKg ?? 0) > 0 ? "subiu" : "desceu"} ${fmt(Math.abs(data.weeklyChangeKg ?? 0), 2)} kg/semana`}
        .
        {data.formulaTdee != null &&
          ` A fórmula estimava ${fmt(data.formulaTdee)} kcal.`}
      </p>
      <div className="mt-3 rounded-2xl bg-soft p-3 text-sm">
        {same ? (
          <p className="font-bold">
            ✓ Sua meta de {fmt(data.current.kcal)} kcal já está certa pro seu
            objetivo.
          </p>
        ) : (
          <>
            <p className="font-bold">
              Pro seu objetivo ({signed(data.goalAdjust)} kcal sobre o gasto), a
              meta ideal é {signed(diff)} kcal:
            </p>
            <div className="mt-2 space-y-1">
              {(
                [
                  ["Calorias", "kcal", "kcal"],
                  ["Carboidratos", "carbs", "g"],
                  ["Gorduras", "fat", "g"],
                  ["Proteína", "protein", "g"],
                ] as const
              ).map(([label, key, unit]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-ink/60">{label}</span>
                  <span className="font-bold">
                    {fmt(data.current[key])} → {fmt(s[key])} {unit}
                  </span>
                </div>
              ))}
            </div>
            {data.capped && (
              <p className="mt-2 text-xs text-ink/50">
                Mudei no máximo 300 kcal de uma vez pra ir com calma; daqui a
                umas semanas eu reavalio.
              </p>
            )}
          </>
        )}
      </div>
      <ErrorText error={apply.error} />
      {!same && (
        <Button
          className="mt-3 w-full"
          loading={apply.isPending}
          onClick={() => apply.mutate()}
        >
          Aplicar nova meta
        </Button>
      )}
    </Card>
  );
}
