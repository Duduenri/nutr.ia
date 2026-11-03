const TIMED =
  /prancha|plank|isometri|wall sit|cadeirinha|hollow hold|dead hang|farmer|carregamento/;

export function isTimed(name: string): boolean {
  return TIMED.test(name.toLowerCase());
}

export function formatSets(
  name: string,
  sets: { reps: number; kg: number }[],
  sep = ' ',
): string {
  const timed = isTimed(name);
  return sets
    .map((s) =>
      timed
        ? `${s.reps}s${s.kg ? ` com ${s.kg}kg` : ''}`
        : `${s.reps}x${s.kg}kg`,
    )
    .join(sep);
}

export function setsVolume(
  name: string,
  sets: { reps: number; kg: number }[],
): number {
  return isTimed(name) ? 0 : sets.reduce((t, s) => t + s.reps * s.kg, 0);
}
