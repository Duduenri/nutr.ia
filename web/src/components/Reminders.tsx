import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type PrescriptionItem, type WaterReminder } from "../lib/api";
import { enablePush, deviceSubscribed, isIos, pushSupport } from "../lib/push";
import { Button, ErrorText, Field, inputClass, Sheet, Spinner } from "./ui";

export function NotificationsSetup() {
  const qc = useQueryClient();
  const support = pushSupport();
  const { data: subscribed, isLoading } = useQuery({
    queryKey: ["push-device"],
    queryFn: deviceSubscribed,
    enabled: support === "ok",
  });
  const test = useMutation({
    mutationFn: () => api.post<{ delivered: number }>("/push/test"),
  });
  const enable = useMutation({
    mutationFn: enablePush,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["push-device"] });
      test.mutate();
    },
  });

  if (support === "ios-browser") {
    return (
      <div className="rounded-2xl bg-sky/20 px-4 py-3 text-sm text-ink/80">
        <p className="font-extrabold">🔔 Pra receber lembretes no iPhone:</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>
            No Safari, toque em <b>Compartilhar</b> (quadrado com seta) →{" "}
            <b>Adicionar à Tela de Início</b>.
          </li>
          <li>
            Abra o nutri.ia <b>pelo ícone</b> na tela de início.
          </li>
          <li>
            Volte aqui e toque em <b>Ativar notificações</b>.
          </li>
        </ol>
        <p className="mt-1 text-xs text-ink/50">
          Precisa do iOS 16.4 ou mais novo.
        </p>
      </div>
    );
  }
  if (support === "unsupported") {
    return (
      <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-ink/60">
        Este navegador não aceita notificações.{" "}
        {isIos() ? "Atualize o iPhone para o iOS 16.4 ou mais novo." : ""}
      </p>
    );
  }
  if (isLoading) return <Spinner />;
  if (subscribed) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-mint-50 px-4 py-3">
        <span className="text-sm font-bold">
          🔔 Notificações ativas neste aparelho
        </span>
        <button
          disabled={test.isPending}
          onClick={() => test.mutate()}
          className="shrink-0 text-sm font-bold text-mint-500"
        >
          {test.isPending
            ? "Enviando…"
            : test.isSuccess
              ? "Enviado ✓"
              : "Testar"}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        loading={enable.isPending}
        onClick={() => enable.mutate()}
      >
        🔔 Ativar notificações
      </Button>
      <p className="text-center text-xs text-ink/50">
        Quando o aparelho perguntar, toque em <b>Permitir</b>.
      </p>
      <ErrorText error={enable.error ?? test.error} />
    </div>
  );
}

const EVERY = [
  { value: 60, label: "1h" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2h" },
  { value: 180, label: "3h" },
];

export function WaterReminderForm({ onDone }: { onDone?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["water-reminder"],
    queryFn: () => api.get<WaterReminder>("/push/water"),
  });
  const [draft, setDraft] = useState<WaterReminder | null>(null);
  const f = draft ?? data;
  const save = useMutation({
    mutationFn: (body: WaterReminder) => api.patch("/push/water", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["water-reminder"] });
      setDraft(null);
      onDone?.();
    },
  });

  if (isLoading || !f) return <Spinner />;
  const set = (patch: Partial<WaterReminder>) => setDraft({ ...f, ...patch });

  return (
    <div className="space-y-4">
      <NotificationsSetup />
      <label className="flex items-center justify-between rounded-2xl bg-soft px-4 py-3">
        <span className="font-bold">💧 Lembrar de beber água</span>
        <input
          type="checkbox"
          className="h-6 w-6 accent-mint-500"
          checked={f.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Das">
          <input
            type="time"
            className={inputClass}
            value={f.start}
            onChange={(e) => set({ start: e.target.value })}
          />
        </Field>
        <Field label="Até">
          <input
            type="time"
            className={inputClass}
            value={f.end}
            onChange={(e) => set({ end: e.target.value })}
          />
        </Field>
      </div>
      <div>
        <span className="mb-1 block text-sm font-semibold text-ink/70">
          A cada
        </span>
        <div className="flex gap-2">
          {EVERY.map((o) => (
            <button
              key={o.value}
              onClick={() => set({ every: o.value })}
              className={`flex-1 rounded-2xl py-2.5 text-sm font-bold ${
                f.every === o.value ? "bg-ink text-white" : "bg-soft"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink/50">
        Só aviso se você estiver atrasada na meta do dia. Se já bebeu o
        suficiente até aquela hora, fico quietinha.
      </p>
      <ErrorText error={save.error} />
      <Button
        className="w-full"
        loading={save.isPending}
        onClick={() => save.mutate(f)}
      >
        Salvar
      </Button>
    </div>
  );
}

export function WaterReminderSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Lembrete de água">
      <div className="pb-6">
        <WaterReminderForm onDone={onClose} />
      </div>
    </Sheet>
  );
}

export function TimesEditor({
  times,
  onChange,
}: {
  times: string[];
  onChange: (times: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {times.map((t, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-full bg-soft pl-3 pr-1"
        >
          <input
            type="time"
            value={t}
            onChange={(e) =>
              onChange(times.map((x, j) => (j === i ? e.target.value : x)))
            }
            className="bg-transparent py-1.5 text-sm font-bold outline-none"
          />
          <button
            onClick={() => onChange(times.filter((_, j) => j !== i))}
            className="grid h-7 w-7 place-items-center rounded-full text-ink/50"
            aria-label="Remover horário"
          >
            ✕
          </button>
        </span>
      ))}
      {times.length < 6 && (
        <button
          onClick={() => onChange([...times, times.length ? "20:00" : "08:00"])}
          className="rounded-full border border-dashed border-ink/30 px-3 py-1.5 text-sm font-bold text-ink/60"
        >
          + horário
        </button>
      )}
    </div>
  );
}

type Draft = PrescriptionItem & { selected: boolean };

export function PrescriptionImportSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<Draft[] | null>(null);
  const [saved, setSaved] = useState(false);
  const close = () => {
    setItems(null);
    setSaved(false);
    onClose();
  };

  const read = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post<{ items: PrescriptionItem[] }>(
        "/supplements/import",
        form,
      );
    },
    onSuccess: (res) =>
      setItems(res.items.map((it) => ({ ...it, selected: it.daily }))),
  });
  const save = useMutation({
    mutationFn: async (list: Draft[]) => {
      for (const it of list) {
        await api.post("/supplements", {
          name: it.name.trim(),
          emoji: it.emoji || "💊",
          dose: it.dose.trim() || undefined,
          proteinG: it.proteinG ?? undefined,
          kcal: it.kcal ?? undefined,
          timesPerDay: Math.max(1, it.times.length),
          times: it.daily ? it.times : [],
        });
      }
    },
    onSuccess: () => {
      onSaved();
      setSaved(true);
    },
  });
  const update = (i: number, patch: Partial<Draft>) =>
    setItems((list) =>
      list ? list.map((it, j) => (j === i ? { ...it, ...patch } : it)) : list,
    );
  const chosen = items?.filter((it) => it.selected && it.name.trim()) ?? [];

  return (
    <Sheet open={open} onClose={close} title="Importar receita">
      <div className="space-y-4 pb-6">
        {saved ? (
          <>
            <p className="rounded-2xl bg-mint-50 px-4 py-3 font-bold">
              ✓ {chosen.length} suplemento(s) cadastrados com horário.
            </p>
            <p className="text-sm text-ink/60">
              Ative as notificações pra eu te avisar na hora de cada um:
            </p>
            <NotificationsSetup />
            <Button variant="soft" className="w-full" onClick={close}>
              Pronto
            </Button>
          </>
        ) : !items ? (
          <>
            <p className="text-sm text-ink/60">
              Mande o PDF ou uma foto da receita. Eu leio, monto os horários e
              você confere antes de salvar. Nome, CPF e dados do médico não vão
              pra IA.
            </p>
            <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-ink/20 bg-soft font-bold">
              {read.isPending ? (
                <>
                  <Spinner />
                  <span className="text-sm text-ink/60">Lendo a receita…</span>
                </>
              ) : (
                <>
                  <span className="text-3xl">📄</span>
                  Escolher PDF ou foto
                </>
              )}
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                disabled={read.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) read.mutate(file);
                  e.target.value = "";
                }}
              />
            </label>
            <ErrorText error={read.error} />
          </>
        ) : (
          <>
            {items.length === 0 && (
              <p className="text-sm text-ink/60">
                Não encontrei suplementos nessa receita. Tente outra foto ou
                cadastre manualmente.
              </p>
            )}
            <ul className="space-y-3">
              {items.map((it, i) => (
                <li
                  key={i}
                  className={`space-y-2 rounded-2xl p-3 ${it.selected ? "bg-soft" : "bg-soft/40 opacity-60"}`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-mint-500"
                      checked={it.selected}
                      onChange={(e) =>
                        update(i, { selected: e.target.checked })
                      }
                    />
                    <span className="text-xl">{it.emoji}</span>
                    <input
                      className="min-w-0 flex-1 bg-transparent font-bold outline-none"
                      value={it.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                    />
                  </div>
                  <input
                    className="w-full rounded-xl bg-white px-3 py-2 text-sm outline-none"
                    value={it.dose}
                    placeholder="Dose"
                    onChange={(e) => update(i, { dose: e.target.value })}
                  />
                  <TimesEditor
                    times={it.times}
                    onChange={(times) => update(i, { times })}
                  />
                  {(it.note || !it.daily) && (
                    <p className="text-xs text-ink/60">
                      {!it.daily &&
                        "⚠️ Não é diário — sem lembrete automático. "}
                      {it.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink/50">
              Confira com a receita original. Horários sugeridos seguem as
              orientações dela (ex.: ferro longe do cálcio); ajuste se quiser.
            </p>
            <ErrorText error={save.error} />
            <Button
              className="w-full"
              loading={save.isPending}
              disabled={chosen.length === 0}
              onClick={() => save.mutate(chosen)}
            >
              Salvar {chosen.length} suplemento(s)
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setItems(null)}
            >
              Escolher outro arquivo
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
