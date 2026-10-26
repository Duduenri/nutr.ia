import { toDraft, type Exercise, type ExerciseDraft } from "../lib/training";

const COMMON = [
  "Agachamento",
  "Leg press",
  "Supino reto",
  "Remada",
  "Puxada alta",
  "Desenvolvimento",
  "Rosca direta",
  "Tríceps corda",
  "Stiff",
  "Cadeira extensora",
  "Mesa flexora",
  "Elevação lateral",
  "Elevação pélvica",
  "Panturrilha",
];

export function ExercisesEditor({
  value,
  onChange,
  known,
  last,
}: {
  value: ExerciseDraft[];
  onChange: (v: ExerciseDraft[]) => void;
  known: string[];
  last: Exercise[] | null;
}) {
  const update = (i: number, patch: Partial<ExerciseDraft>) =>
    onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const setField = (i: number, k: number, field: "reps" | "kg", v: string) =>
    update(i, {
      sets: value[i].sets.map((s, j) => (j === k ? { ...s, [field]: v } : s)),
    });
  const suggestions = [...new Set([...known, ...COMMON])];
  const used = new Set(value.map((e) => e.name.trim().toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink/70">
          Exercícios (opcional)
        </span>
        {last && value.length === 0 && (
          <button
            onClick={() => onChange(toDraft(last))}
            className="text-sm font-bold text-mint-500"
          >
            ↺ Repetir último treino
          </button>
        )}
      </div>
      <datalist id="exercise-names">
        {suggestions.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {value.map((e, i) => (
        <div key={i} className="rounded-2xl bg-soft p-3">
          <div className="flex items-center gap-2">
            <input
              list="exercise-names"
              className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 font-bold outline-none"
              placeholder="Nome do exercício"
              value={e.name}
              onChange={(ev) => update(i, { name: ev.target.value })}
            />
            <button
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="p-2 text-ink/40"
              aria-label="Remover exercício"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {e.sets.map((s, k) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="w-14 shrink-0 font-bold text-ink/50">
                  Série {k + 1}
                </span>
                <input
                  inputMode="numeric"
                  className="w-16 rounded-xl bg-white px-2 py-1.5 text-center outline-none"
                  value={s.reps}
                  onChange={(ev) => setField(i, k, "reps", ev.target.value)}
                />
                <span className="text-ink/50">reps ×</span>
                <input
                  inputMode="decimal"
                  className="w-16 rounded-xl bg-white px-2 py-1.5 text-center outline-none"
                  value={s.kg}
                  onChange={(ev) => setField(i, k, "kg", ev.target.value)}
                />
                <span className="text-ink/50">kg</span>
                {e.sets.length > 1 && (
                  <button
                    onClick={() =>
                      update(i, { sets: e.sets.filter((_, j) => j !== k) })
                    }
                    className="ml-auto px-1 text-ink/30"
                    aria-label="Remover série"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              update(i, {
                sets: [...e.sets, { ...e.sets[e.sets.length - 1] }],
              })
            }
            className="mt-2 text-sm font-bold text-mint-500"
          >
            + série
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {suggestions
          .filter((n) => !used.has(n.toLowerCase()))
          .slice(0, 8)
          .map((n) => (
            <button
              key={n}
              onClick={() =>
                onChange([
                  ...value,
                  { name: n, sets: [{ reps: "10", kg: "" }] },
                ])
              }
              className="rounded-full border border-dashed border-ink/25 px-3 py-1.5 text-xs font-bold text-ink/60"
            >
              + {n}
            </button>
          ))}
        <button
          onClick={() =>
            onChange([...value, { name: "", sets: [{ reps: "10", kg: "" }] }])
          }
          className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white"
        >
          + Outro exercício
        </button>
      </div>
    </div>
  );
}
