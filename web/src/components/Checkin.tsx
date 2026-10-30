import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { Card } from "./ui";

interface Checkin {
  sleep: number | null;
  sleepHours: number | null;
  energy: number | null;
  hunger: number | null;
}

const SCALES: {
  key: "sleep" | "energy" | "hunger";
  label: string;
  faces: string[];
  hint: string;
}[] = [
  {
    key: "sleep",
    label: "Sono",
    faces: ["😫", "😕", "😐", "🙂", "😴"],
    hint: "ruim → ótimo",
  },
  {
    key: "energy",
    label: "Energia",
    faces: ["🪫", "😮‍💨", "😐", "🙂", "⚡"],
    hint: "baixa → alta",
  },
  {
    key: "hunger",
    label: "Fome",
    faces: ["😌", "🙂", "😐", "😋", "🤤"],
    hint: "pouca → muita",
  },
];

const HOURS = [5, 6, 7, 8, 9];

export function CheckinCard({ date }: { date: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data } = useQuery({
    queryKey: ["checkin", date],
    queryFn: () => api.get<Checkin>(`/checkin?date=${date}`),
  });
  const save = useMutation({
    mutationFn: (patch: Partial<Checkin>) =>
      api.put<Checkin>("/checkin", { date, ...patch }),
    onSuccess: (c) => qc.setQueryData(["checkin", date], c),
  });
  if (!data) return null;

  const done =
    data.sleep !== null &&
    data.energy !== null &&
    data.hunger !== null &&
    data.sleepHours !== null;

  if (done && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center justify-between rounded-3xl bg-white px-4 py-3 text-left shadow-card"
      >
        <span className="text-sm font-bold text-ink/70">
          Hoje: sono {SCALES[0].faces[data.sleep! - 1]}{" "}
          {String(data.sleepHours).replace(".", ",")} h · energia{" "}
          {SCALES[1].faces[data.energy! - 1]} · fome{" "}
          {SCALES[2].faces[data.hunger! - 1]}
        </span>
        <span className="text-xs font-bold text-mint-500">editar</span>
      </button>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-extrabold">Como você está hoje?</h3>
        {done && (
          <button
            onClick={() => setEditing(false)}
            className="text-sm font-bold text-mint-500"
          >
            Pronto
          </button>
        )}
      </div>
      <p className="text-xs text-ink/50">
        Um toque em cada. A coach cruza com o que você come e treina.
      </p>
      <div className="mt-3 space-y-2">
        {SCALES.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="w-16 shrink-0">
              <span className="block text-sm font-bold">{s.label}</span>
              <span className="block text-[10px] text-ink/40">{s.hint}</span>
            </span>
            <div className="flex flex-1 justify-between">
              {s.faces.map((f, i) => (
                <button
                  key={f}
                  onClick={() => save.mutate({ [s.key]: i + 1 })}
                  className={`grid h-10 w-10 place-items-center rounded-full text-xl transition ${
                    data[s.key] === i + 1
                      ? "scale-110 bg-mint-100 ring-2 ring-mint-400"
                      : "bg-soft opacity-70"
                  }`}
                  aria-label={`${s.label} ${i + 1}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0">
            <span className="block text-sm font-bold">Dormiu</span>
            <span className="block text-[10px] text-ink/40">horas</span>
          </span>
          <div className="flex flex-1 justify-between">
            {HOURS.map((h) => (
              <button
                key={h}
                onClick={() => save.mutate({ sleepHours: h })}
                className={`h-10 w-10 rounded-full text-sm font-extrabold ${
                  data.sleepHours === h
                    ? "bg-mint-100 ring-2 ring-mint-400"
                    : "bg-soft text-ink/60"
                }`}
              >
                {h === 5 ? "≤5" : h === 9 ? "9+" : h}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
