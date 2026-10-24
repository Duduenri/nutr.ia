export function previewPace(current: number, target: number, date: string) {
  if (!date || !current || !target) return null;
  const days = Math.ceil(
    (new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000,
  );
  const kg = target - current;
  if (days <= 0 || Math.abs(kg) < 0.1) return null;
  const weekly = Math.abs((kg / days) * 7);
  const losing = kg < 0;
  const weeks = Math.round(days / 7);
  const rate = weekly.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const base = `${Math.abs(kg).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg em ~${weeks} semanas = ${rate} kg/semana.`;
  if (weekly > (losing ? 1 : 0.5)) {
    const safeWeeks = Math.ceil(Math.abs(kg) / (losing ? 0.75 : 0.35));
    const safe = new Date(Date.now() + safeWeeks * 7 * 86_400_000);
    return {
      tone: "bg-peach-100 text-peach-500",
      text: `${base} Rápido demais para ser saudável — as calorias ficam no mínimo seguro. Uma data mais realista: ${safe.toLocaleDateString("pt-BR")}.`,
    };
  }
  if (weekly > (losing ? 0.75 : 0.35)) {
    return {
      tone: "bg-sun/40 text-ink",
      text: `${base} Possível, mas puxado. 💪`,
    };
  }
  return {
    tone: "bg-mint-50 text-mint-500",
    text: `${base} Ritmo saudável ✅`,
  };
}
