import { useEffect, useState } from "react";

export const FASTING_PLANS = [
  {
    level: "Iniciantes",
    plans: [
      {
        id: "12:12",
        fast: 12,
        title: "12:12 Jejum circadiano",
        desc: "Você provavelmente já jejua assim!",
      },
      {
        id: "14:10",
        fast: 14,
        title: "14:10 Jejum para iniciantes",
        desc: "Café da manhã mais tarde para chegar perto da fase de queima de gordura",
      },
    ],
  },
  {
    level: "Intermediário",
    plans: [
      {
        id: "16:8",
        fast: 16,
        title: "16:8",
        desc: "O mais popular: passe por todas as etapas pulando uma refeição",
      },
      {
        id: "17:7",
        fast: 17,
        title: "17:7",
        desc: "Prolongue a fase de queima de gordura aumentando o jejum",
      },
    ],
  },
  {
    level: "Especialista",
    plans: [
      {
        id: "18:6",
        fast: 18,
        title: "18:6 Jejum especializado",
        desc: "Janela de alimentação pequena — só depois de dominar o 16:8",
      },
      {
        id: "20:4",
        fast: 20,
        title: "20:4 OMAD",
        desc: "Praticamente uma refeição por dia, só para quem já tem experiência",
      },
    ],
  },
] as const;

export function planHours(plan: string | null): number {
  return plan ? parseInt(plan.split(":")[0], 10) : 16;
}

const PHASES = [
  { from: 0, label: "Digestão: açúcar no sangue subindo", icon: "🍽️" },
  { from: 4, label: "Açúcar no sangue se normalizando", icon: "📉" },
  { from: 8, label: "Corpo usando as reservas de glicogênio", icon: "🔋" },
  { from: 12, label: "Começando a queimar gordura", icon: "🔥" },
  { from: 16, label: "Queima de gordura em alta", icon: "🔥" },
  { from: 18, label: "Entrando em cetose", icon: "⚡" },
  { from: 24, label: "Autofagia: renovação celular", icon: "✨" },
];

export function phaseFor(hours: number) {
  return [...PHASES].reverse().find((p) => hours >= p.from) ?? PHASES[0];
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function formatHoursShort(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${m ? ` ${m}min` : ""}` : `${m}min`;
}

export function relativeDayTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return `Hoje, ${time}`;
  if (same(d, yesterday)) return `Ontem, ${time}`;
  if (same(d, tomorrow)) return `Amanhã, ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${time}`;
}

export function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
