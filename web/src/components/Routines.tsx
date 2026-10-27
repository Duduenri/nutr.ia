import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  api,
  type Routine,
  type RoutineDay,
  type RoutineExercise,
  type Weekday,
} from "../lib/api";
import { useRoutines, WEEKDAY_LABEL } from "../lib/routines";
import { Button, ErrorText, inputClass, Sheet, Spinner } from "./ui";

export function RoutineManager() {
  const qc = useQueryClient();
  const { data: routines, isLoading } = useRoutines();
  const [editing, setEditing] = useState<Routine | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<Routine>("/routines", {}),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["routines"] });
      setEditing(r);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/routines/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });

  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/60">
        Sua rotina fixa: os dias e exercícios que aparecem quando você registra
        musculação. Dá pra criar do zero ou a partir de um plano do Coach (Coach
        → Planos → “Usar como minha rotina”).
      </p>
      {routines?.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-2 rounded-2xl bg-soft px-4 py-3"
        >
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() => setEditing(r)}
          >
            <span className="block truncate font-bold">🏋️ {r.name}</span>
            <span className="block truncate text-xs text-ink/50">
              {r.days.map((d) => d.label).join(" · ")}
            </span>
          </button>
          <button
            onClick={() => setEditing(r)}
            className="grid h-9 w-9 place-items-center rounded-full"
            aria-label="Editar rotina"
          >
            ✏️
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Apagar a rotina "${r.name}"?`))
                remove.mutate(r.id);
            }}
            className="grid h-9 w-9 place-items-center rounded-full"
            aria-label="Apagar rotina"
          >
            🗑️
          </button>
        </div>
      ))}
      <ErrorText error={create.error ?? remove.error} />
      <Button
        variant="soft"
        className="w-full"
        loading={create.isPending}
        onClick={() => create.mutate()}
      >
        ＋ Nova rotina em branco
      </Button>
      <RoutineEditor routine={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

const emptyExercise = (): RoutineExercise => ({
  name: "",
  sets: 3,
  reps: "8–12",
  repsTarget: 10,
});

function RoutineEditor({
  routine,
  onClose,
}: {
  routine: Routine | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [openDay, setOpenDay] = useState<number | null>(0);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (routine && routine.id !== loadedId) {
    setLoadedId(routine.id);
    setName(routine.name);
    setDays(routine.days);
    setOpenDay(0);
  }
  if (!routine && loadedId) setLoadedId(null);

  const save = useMutation({
    mutationFn: () =>
      api.put<Routine>(`/routines/${routine!.id}`, {
        name,
        days: days.map((d) => ({
          ...d,
          exercises: d.exercises.filter((e) => e.name.trim()),
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["routines"] });
      onClose();
    },
  });

  const setDay = (i: number, patch: Partial<RoutineDay>) =>
    setDays(days.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const setEx = (i: number, k: number, patch: Partial<RoutineExercise>) =>
    setDay(i, {
      exercises: days[i].exercises.map((e, j) =>
        j === k ? { ...e, ...patch } : e,
      ),
    });
  const moveEx = (i: number, k: number, dir: -1 | 1) => {
    const list = [...days[i].exercises];
    const to = k + dir;
    if (to < 0 || to >= list.length) return;
    [list[k], list[to]] = [list[to], list[k]];
    setDay(i, { exercises: list });
  };

  return (
    <Sheet open={Boolean(routine)} onClose={onClose} title="Editar rotina">
      <div className="space-y-3 pb-6">
        <input
          className={`${inputClass} font-bold`}
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da rotina"
        />
        {days.map((d, i) => (
          <div key={i} className="rounded-2xl bg-soft p-3">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setOpenDay(openDay === i ? null : i)}
            >
              <span>
                <span className="font-extrabold">{d.label || "Sem nome"}</span>
                <span className="text-sm text-ink/50">
                  {d.focus ? ` · ${d.focus}` : ""} · {d.exercises.length}{" "}
                  exercícios
                </span>
              </span>
              <span className="text-ink/40">{openDay === i ? "▴" : "▾"}</span>
            </button>
            {openDay === i && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-xl bg-white px-3 py-2 text-sm font-bold outline-none"
                    value={d.label}
                    maxLength={40}
                    placeholder="Nome (ex.: Terça)"
                    onChange={(e) => setDay(i, { label: e.target.value })}
                  />
                  <input
                    className="rounded-xl bg-white px-3 py-2 text-sm outline-none"
                    value={d.focus}
                    maxLength={60}
                    placeholder="Foco (ex.: Costas)"
                    onChange={(e) => setDay(i, { focus: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(WEEKDAY_LABEL) as Weekday[]).map((w) => (
                    <button
                      key={w}
                      onClick={() =>
                        setDay(i, { weekday: d.weekday === w ? null : w })
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        d.weekday === w ? "bg-ink text-white" : "bg-white"
                      }`}
                    >
                      {WEEKDAY_LABEL[w]}
                    </button>
                  ))}
                </div>
                {d.exercises.map((e, k) => (
                  <div key={k} className="rounded-xl bg-white p-2">
                    <div className="flex items-center gap-1">
                      <input
                        className="min-w-0 flex-1 px-1 py-1 text-sm font-bold outline-none"
                        value={e.name}
                        maxLength={60}
                        placeholder="Exercício"
                        onChange={(ev) =>
                          setEx(i, k, { name: ev.target.value })
                        }
                      />
                      <button
                        onClick={() => moveEx(i, k, -1)}
                        className="px-1 text-ink/40"
                        aria-label="Subir"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveEx(i, k, 1)}
                        className="px-1 text-ink/40"
                        aria-label="Descer"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() =>
                          setDay(i, {
                            exercises: d.exercises.filter((_, j) => j !== k),
                          })
                        }
                        className="px-1 text-ink/40"
                        aria-label="Remover exercício"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-1 flex items-center gap-2 px-1 text-xs text-ink/60">
                      <input
                        inputMode="numeric"
                        className="w-10 rounded-lg bg-soft px-1 py-1 text-center text-sm font-bold text-ink outline-none"
                        value={String(e.sets)}
                        onChange={(ev) =>
                          setEx(i, k, {
                            sets: Math.min(
                              10,
                              Math.max(1, parseInt(ev.target.value, 10) || 1),
                            ),
                          })
                        }
                      />
                      séries ×
                      <input
                        className="min-w-0 flex-1 rounded-lg bg-soft px-2 py-1 text-center text-sm font-bold text-ink outline-none"
                        value={e.reps}
                        maxLength={30}
                        onChange={(ev) => {
                          const first = parseInt(
                            ev.target.value.match(/\d+/)?.[0] ?? "",
                            10,
                          );
                          setEx(i, k, {
                            reps: ev.target.value,
                            repsTarget:
                              first > 0 ? Math.min(200, first) : e.repsTarget,
                          });
                        }}
                      />
                      reps
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setDay(i, {
                        exercises: [...d.exercises, emptyExercise()],
                      })
                    }
                    className="flex-1 rounded-xl border border-dashed border-ink/25 py-2 text-sm font-bold text-ink/60"
                  >
                    ＋ Exercício
                  </button>
                  {days.length > 1 && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Remover o dia "${d.label}"?`)) {
                          setDays(days.filter((_, j) => j !== i));
                          setOpenDay(null);
                        }
                      }}
                      className="rounded-xl px-3 py-2 text-sm font-bold text-ink/40"
                    >
                      Remover dia
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {days.length < 7 && (
          <Button
            variant="soft"
            className="w-full"
            onClick={() => {
              setDays([
                ...days,
                {
                  label: `Treino ${String.fromCharCode(65 + days.length)}`,
                  focus: "",
                  weekday: null,
                  exercises: [emptyExercise()],
                },
              ]);
              setOpenDay(days.length);
            }}
          >
            ＋ Adicionar dia
          </Button>
        )}
        <ErrorText error={save.error} />
        <Button
          className="w-full"
          loading={save.isPending}
          disabled={!name.trim() || days.some((d) => !d.label.trim())}
          onClick={() => save.mutate()}
        >
          Salvar rotina
        </Button>
      </div>
    </Sheet>
  );
}

export function RoutineButton() {
  const [open, setOpen] = useState(false);
  const { data: routines } = useRoutines();
  const main = routines?.[0];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-card"
      >
        <span className="text-3xl">🏋️</span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">Minha rotina de treino</span>
          <span className="block truncate text-xs text-ink/50">
            {main
              ? main.days.map((d) => d.label).join(" · ")
              : "Monte seus dias e exercícios fixos"}
          </span>
        </span>
        <span className="text-sm font-bold text-mint-500">Editar</span>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Minha rotina de treino"
      >
        <div className="pb-6">
          <RoutineManager />
        </div>
      </Sheet>
    </>
  );
}
