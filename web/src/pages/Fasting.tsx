import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  ErrorText,
  Field,
  fmt,
  inputClass,
  Sheet,
  Spinner,
} from "../components/ui";
import { api, type Fast, type FastingState } from "../lib/api";
import { useFasting } from "../lib/hooks";
import {
  FASTING_PLANS,
  formatDuration,
  formatHoursShort,
  phaseFor,
  planHours,
  relativeDayTime,
  toLocalInput,
  useNow,
} from "../lib/fasting";

const HOUR_MS = 3_600_000;

export function FastingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useFasting();
  const [pickPlan, setPickPlan] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["fasting"] });
    void qc.invalidateQueries({ queryKey: ["missions"] });
  };

  return (
    <div>
      <header className="pt-safe flex items-center gap-3 bg-[#fdeaea] px-4 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl"
          aria-label="Voltar"
        >
          ‹
        </button>
        <h1 className="flex-1 text-xl font-extrabold">Jejum</h1>
        {data && (
          <button
            onClick={() => setPickPlan(true)}
            className="rounded-full border-2 border-white bg-white/70 px-4 py-1.5 font-bold"
          >
            {data.plan ? `Plano ${data.plan}` : "Escolher plano"} ✏️
          </button>
        )}
      </header>
      <div className="space-y-4 px-4 pt-4">
        {isLoading && (
          <div className="text-center text-peach-400">
            <Spinner />
          </div>
        )}
        <ErrorText error={error} />
        {data && (
          <>
            {data.active ? (
              <ActiveFast fast={data.active} onChange={refresh} />
            ) : (
              <StartFast
                state={data}
                onChange={refresh}
                onPickPlan={() => setPickPlan(true)}
              />
            )}
            <WeekStats state={data} />
            <History history={data.history} onChange={refresh} />
            <p className="pb-4 text-center text-xs text-ink/50">
              Jejum não é indicado para gestantes, lactantes, menores de idade,
              diabéticos em uso de medicação ou quem tem histórico de transtorno
              alimentar. Na dúvida, fale com um profissional de saúde. Beba
              bastante água durante o jejum.
            </p>
          </>
        )}
      </div>
      <PlanPicker
        open={pickPlan}
        current={data?.plan ?? null}
        onClose={() => setPickPlan(false)}
        onPicked={refresh}
      />
    </div>
  );
}

function FastRing({ pct }: { pct: number }) {
  const r = 88;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 200 200"
      className="absolute inset-0 h-full w-full -rotate-90"
    >
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke="#fdeaea"
        strokeWidth="14"
      />
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke={pct >= 1 ? "#2fb38f" : "#f6a07c"}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, pct))}
        className="transition-all duration-1000"
      />
    </svg>
  );
}

function ActiveFast({ fast, onChange }: { fast: Fast; onChange: () => void }) {
  const now = useNow();
  const [editStart, setEditStart] = useState(false);
  const [editGoal, setEditGoal] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const start = new Date(fast.startAt).getTime();
  const elapsed = now - start;
  const goalMs = fast.goalHours * HOUR_MS;
  const pct = elapsed / goalMs;
  const phase = phaseFor(elapsed / HOUR_MS);
  const remaining = goalMs - elapsed;

  const end = useMutation({
    mutationFn: () => api.post(`/fasting/${fast.id}/end`, {}),
    onSuccess: onChange,
  });
  const cancel = useMutation({
    mutationFn: () => api.del(`/fasting/${fast.id}`),
    onSuccess: onChange,
  });

  return (
    <Card className="text-center">
      <div className="relative mx-auto aspect-square w-full max-w-72">
        <FastRing pct={pct} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold text-ink/50">
            Tempo em jejum
          </span>
          <span className="font-serif text-5xl font-bold tabular-nums">
            {formatDuration(elapsed)}
          </span>
          <span className="mt-1 text-sm font-bold text-ink/60">
            {pct >= 1
              ? "Meta batida! 🎉"
              : `faltam ${formatHoursShort(remaining)}`}
          </span>
        </div>
      </div>
      <p className="mt-2 font-bold text-peach-500">
        {phase.icon} {phase.label}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-left">
        <div>
          <div className="text-sm font-bold text-peach-400">Iniciado</div>
          <div className="font-extrabold">{relativeDayTime(fast.startAt)}</div>
          <button
            onClick={() => setEditStart(true)}
            className="mt-1 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-bold"
          >
            Editar
          </button>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-peach-400">
            Meta ({fast.goalHours}h)
          </div>
          <div className="font-extrabold">{relativeDayTime(fast.goalAt)}</div>
          <button
            onClick={() => setEditGoal(true)}
            className="mt-1 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-bold"
          >
            Editar
          </button>
        </div>
      </div>
      <ErrorText error={end.error ?? cancel.error} />
      <Button
        className="mt-5 w-full"
        loading={end.isPending}
        onClick={() => end.mutate()}
      >
        Terminar jejum
      </Button>
      {confirmCancel ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <span className="font-semibold">Apagar este jejum?</span>
          <button
            className="font-bold text-peach-500"
            onClick={() => cancel.mutate()}
          >
            Sim, apagar
          </button>
          <button
            className="font-bold text-ink/50"
            onClick={() => setConfirmCancel(false)}
          >
            Não
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmCancel(true)}
          className="mt-3 text-sm font-bold text-peach-500 underline"
        >
          Cancelar o jejum atual
        </button>
      )}
      <EditStartSheet
        open={editStart}
        fast={fast}
        onClose={() => setEditStart(false)}
        onSaved={onChange}
      />
      <EditGoalSheet
        open={editGoal}
        fast={fast}
        onClose={() => setEditGoal(false)}
        onSaved={onChange}
      />
    </Card>
  );
}

function StartFast({
  state,
  onChange,
  onPickPlan,
}: {
  state: FastingState;
  onChange: () => void;
  onPickPlan: () => void;
}) {
  const now = useNow(30_000);
  const goalHours = planHours(state.plan);
  const lastMeal = state.lastMealAt
    ? new Date(state.lastMealAt).getTime()
    : null;
  const lastMealRecent = lastMeal && now - lastMeal < 20 * HOUR_MS;
  const eatingSince = state.lastEndedAt
    ? new Date(state.lastEndedAt).getTime()
    : null;

  const start = useMutation({
    mutationFn: (startAt?: string) =>
      api.post("/fasting/start", { goalHours, startAt }),
    onSuccess: onChange,
  });

  return (
    <Card className="space-y-3 text-center">
      <div className="text-5xl">🍽️</div>
      <h2 className="text-xl font-extrabold">
        Você está na janela de alimentação
      </h2>
      {eatingSince && eatingSince > now - 24 * HOUR_MS && (
        <p className="text-ink/60">
          Seu último jejum terminou há {formatHoursShort(now - eatingSince)}.
        </p>
      )}
      {!state.plan && (
        <button
          onClick={onPickPlan}
          className="font-bold text-peach-500 underline"
        >
          Escolha um plano de jejum (padrão 16:8)
        </button>
      )}
      <ErrorText error={start.error} />
      <Button
        className="w-full"
        loading={start.isPending && !start.variables}
        onClick={() => start.mutate(undefined)}
      >
        Começar jejum de {goalHours}h agora
      </Button>
      {lastMealRecent && state.lastMealAt && (
        <Button
          variant="soft"
          className="w-full"
          loading={start.isPending && Boolean(start.variables)}
          onClick={() => start.mutate(state.lastMealAt!)}
        >
          Contar desde a última refeição ({relativeDayTime(state.lastMealAt)})
        </Button>
      )}
    </Card>
  );
}

function WeekStats({ state }: { state: FastingState }) {
  return (
    <Card>
      <h3 className="mb-3 text-lg font-extrabold">Últimos 7 dias</h3>
      <div className="grid grid-cols-3 text-center">
        <div>
          <div className="text-2xl font-extrabold">{state.week.count}</div>
          <div className="text-sm text-ink/60">jejuns</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold">
            {state.week.count
              ? Math.round((state.week.reached / state.week.count) * 100)
              : 0}
            %
          </div>
          <div className="text-sm text-ink/60">bateram a meta</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold">
            {state.week.averageHours != null
              ? `${fmt(state.week.averageHours, 1)}h`
              : "–"}
          </div>
          <div className="text-sm text-ink/60">média</div>
        </div>
      </div>
    </Card>
  );
}

function History({
  history,
  onChange,
}: {
  history: Fast[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Fast | null>(null);
  if (!history.length) return null;
  const recent = history.slice(0, 14).reverse();
  const maxH = Math.max(24, ...recent.map((f) => f.hours));

  return (
    <Card>
      <h3 className="mb-3 text-lg font-extrabold">Histórico</h3>
      <div className="mb-4 flex h-32 items-end gap-1.5">
        {recent.map((f) => (
          <div
            key={f.id}
            className="relative flex flex-1 flex-col items-center justify-end"
            style={{ height: "100%" }}
          >
            <div
              className={`w-full rounded-t-md ${f.reached ? "bg-mint-500" : "bg-peach-400"}`}
              style={{ height: `${(f.hours / maxH) * 100}%` }}
              title={`${f.hours}h`}
            />
            <div
              className="absolute w-full border-t-2 border-dashed border-ink/30"
              style={{ bottom: `${(f.goalHours / maxH) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <ul className="divide-y divide-slate-100">
        {history.slice(0, 10).map((f) => (
          <li key={f.id}>
            <button
              onClick={() => setEditing(f)}
              className="flex w-full items-center justify-between py-2 text-left"
            >
              <span className="text-sm text-ink/70">
                {relativeDayTime(f.startAt)}
              </span>
              <span className="font-extrabold">
                {fmt(f.hours, 1)}h{" "}
                <span className="text-sm font-semibold text-ink/50">
                  / {f.goalHours}h
                </span>{" "}
                {f.reached ? "✅" : "⏱️"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <EditPastSheet
        fast={editing}
        onClose={() => setEditing(null)}
        onSaved={onChange}
      />
    </Card>
  );
}

function EditStartSheet({
  open,
  fast,
  onClose,
  onSaved,
}: {
  open: boolean;
  fast: Fast;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(toLocalInput(fast.startAt));
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/fasting/${fast.id}`, {
        startAt: new Date(value).toISOString(),
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Quando começou?">
      <div className="space-y-4 pb-4">
        <Field label="Início do jejum (horário da última refeição)">
          <input
            className={inputClass}
            type="datetime-local"
            value={value}
            max={toLocalInput(new Date())}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <ErrorText error={save.error} />
        <Button
          className="w-full"
          loading={save.isPending}
          disabled={!value}
          onClick={() => save.mutate()}
        >
          Salvar
        </Button>
      </div>
    </Sheet>
  );
}

const GOAL_OPTIONS = [12, 13, 14, 15, 16, 17, 18, 20, 24];

function EditGoalSheet({
  open,
  fast,
  onClose,
  onSaved,
}: {
  open: boolean;
  fast: Fast;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation({
    mutationFn: (goalHours: number) =>
      api.patch(`/fasting/${fast.id}`, { goalHours }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Meta deste jejum">
      <div className="grid grid-cols-3 gap-2 pb-4">
        {GOAL_OPTIONS.map((h) => (
          <button
            key={h}
            disabled={save.isPending}
            onClick={() => save.mutate(h)}
            className={`rounded-2xl border-2 py-3 font-extrabold ${h === fast.goalHours ? "border-peach-400 bg-[#fdeaea]" : "border-slate-100"}`}
          >
            {h}h
          </button>
        ))}
        <div className="col-span-3">
          <ErrorText error={save.error} />
        </div>
      </div>
    </Sheet>
  );
}

function EditPastSheet({
  fast,
  onClose,
  onSaved,
}: {
  fast: Fast | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);
  if (fast && fast.id !== lastId) {
    setLastId(fast.id);
    setStart(toLocalInput(fast.startAt));
    setEnd(toLocalInput(fast.endAt ?? new Date()));
  }

  const save = useMutation({
    mutationFn: async () => {
      await api.post(`/fasting/${fast!.id}/end`, {
        endAt: new Date(end).toISOString(),
      });
      await api.patch(`/fasting/${fast!.id}`, {
        startAt: new Date(start).toISOString(),
      });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/fasting/${fast!.id}`),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <Sheet open={Boolean(fast)} onClose={onClose} title="Editar jejum">
      <div className="space-y-4 pb-4">
        <Field label="Início">
          <input
            className={inputClass}
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="Fim">
          <input
            className={inputClass}
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
        <ErrorText error={save.error ?? remove.error} />
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Apagar
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function PlanPicker({
  open,
  current,
  onClose,
  onPicked,
}: {
  open: boolean;
  current: string | null;
  onClose: () => void;
  onPicked: () => void;
}) {
  const save = useMutation({
    mutationFn: (plan: string) => api.patch("/fasting/plan", { plan }),
    onSuccess: () => {
      onPicked();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Planos de jejum">
      <div className="space-y-5 pb-4">
        {FASTING_PLANS.map((group) => (
          <section key={group.level}>
            <h3 className="mb-2 font-serif text-xl font-bold">{group.level}</h3>
            <div className="space-y-2">
              {group.plans.map((p) => (
                <button
                  key={p.id}
                  disabled={save.isPending}
                  onClick={() => save.mutate(p.id)}
                  className={`flex w-full items-center gap-4 rounded-3xl p-3 text-left ${
                    current === p.id
                      ? "bg-[#fdeaea] ring-2 ring-peach-400"
                      : "bg-soft"
                  }`}
                >
                  <PlanDonut fast={p.fast} />
                  <span>
                    <span className="block font-extrabold">{p.title}</span>
                    <span className="text-sm text-ink/60">{p.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <ErrorText error={save.error} />
      </div>
    </Sheet>
  );
}

function PlanDonut({ fast }: { fast: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 60 60"
      className="h-16 w-16 shrink-0 -rotate-90 rounded-2xl bg-sky/30 p-1"
    >
      <circle
        cx="30"
        cy="30"
        r={r}
        fill="none"
        stroke="#9db8dd"
        strokeWidth="7"
      />
      <circle
        cx="30"
        cy="30"
        r={r}
        fill="none"
        stroke="#f79a9a"
        strokeWidth="7"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fast / 24)}
      />
    </svg>
  );
}
