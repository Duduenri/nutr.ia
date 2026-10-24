import { EXERCISES, exerciseMinutes, useWeightKg } from "../lib/exercise";

export function ExerciseEquivalent({ kcal }: { kcal: number }) {
  const weight = useWeightKg();
  if (kcal < 20) return null;
  return (
    <div className="rounded-2xl bg-sky/20 px-3 py-2">
      <div className="mb-1 text-xs font-bold text-ink/60">Pra gastar isso:</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
        {EXERCISES.map((e) => (
          <span key={e.key}>
            {e.emoji} {exerciseMinutes(kcal, weight, e.met)} min{" "}
            {e.label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
