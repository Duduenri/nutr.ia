import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ACTIVITY_LABEL,
  api,
  GOAL_LABEL,
  type ActivityLevel,
  type Goal,
  type Profile,
  type Sex,
} from "../lib/api";
import { today } from "../lib/date";
import { previewPace } from "../lib/goal";
import { Button, ErrorText, Field, inputClass } from "./ui";

export function ProfileForm({
  profile,
  submitLabel,
  onDone,
}: {
  profile: Profile;
  submitLabel: string;
  onDone: (p: Profile) => void;
}) {
  const [form, setForm] = useState({
    name: profile.name,
    sex: profile.sex ?? ("FEMALE" as Sex),
    birthDate: profile.birthDate?.slice(0, 10) ?? "",
    heightCm: profile.heightCm?.toString() ?? "",
    currentWeightKg: profile.currentWeightKg?.toString() ?? "",
    targetWeightKg: profile.targetWeightKg?.toString() ?? "",
    targetDate: profile.targetDate?.slice(0, 10) ?? "",
    bariatric: profile.bariatric,
    surgeryDate: profile.surgeryDate?.slice(0, 10) ?? "",
    goal: profile.goal ?? ("LOSE" as Goal),
    activityLevel: profile.activityLevel ?? ("LIGHT" as ActivityLevel),
  });
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const weight = parseFloat(form.currentWeightKg.replace(",", "."));
      const weightChanged = weight !== profile.currentWeightKg;
      return api.patch<Profile>("/profile", {
        name: form.name,
        sex: form.sex,
        birthDate: form.birthDate,
        heightCm: parseHeightCm(form.heightCm),
        targetWeightKg: parseFloat(form.targetWeightKg.replace(",", ".")),
        targetDate: form.targetDate || null,
        bariatric: form.bariatric,
        surgeryDate: form.bariatric ? form.surgeryDate || null : null,
        goal: form.goal,
        activityLevel: form.activityLevel,
        ...(weightChanged ? { currentWeightKg: weight, today: today() } : {}),
      });
    },
    onSuccess: (p) => {
      qc.setQueryData(["profile"], p);
      void qc.invalidateQueries();
      onDone(p);
    },
  });

  const pace = previewPace(
    parseFloat(form.currentWeightKg.replace(",", ".")),
    parseFloat(form.targetWeightKg.replace(",", ".")),
    form.targetDate,
  );

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <Field label="Nome">
        <input
          className={inputClass}
          value={form.name}
          onChange={set("name")}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {(["FEMALE", "MALE"] as Sex[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setForm((f) => ({ ...f, sex: s }))}
            className={`rounded-2xl border-2 py-3 font-bold ${
              form.sex === s ? "border-mint-500 bg-mint-50" : "border-slate-200"
            }`}
          >
            {s === "FEMALE" ? "👩 Feminino" : "👨 Masculino"}
          </button>
        ))}
      </div>
      <Field label="Data de nascimento">
        <input
          className={inputClass}
          type="date"
          value={form.birthDate}
          onChange={set("birthDate")}
          required
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Altura (cm)">
          <input
            className={inputClass}
            inputMode="decimal"
            value={form.heightCm}
            onChange={set("heightCm")}
            placeholder="159"
            required
          />
        </Field>
        <Field label="Peso (kg)">
          <input
            className={inputClass}
            inputMode="decimal"
            value={form.currentWeightKg}
            onChange={set("currentWeightKg")}
            required
          />
        </Field>
        <Field label="Meta (kg)">
          <input
            className={inputClass}
            inputMode="decimal"
            value={form.targetWeightKg}
            onChange={set("targetWeightKg")}
            required
          />
        </Field>
      </div>
      <Field label="Quero chegar na meta até (opcional)">
        <div className="flex gap-2">
          <input
            className={inputClass}
            type="date"
            min={today()}
            value={form.targetDate}
            onChange={set("targetDate")}
          />
          {form.targetDate && (
            <button
              type="button"
              className="shrink-0 rounded-2xl bg-soft px-4 font-bold text-ink/60"
              onClick={() => setForm((f) => ({ ...f, targetDate: "" }))}
            >
              Limpar
            </button>
          )}
        </div>
      </Field>
      {pace && (
        <p
          className={`-mt-2 rounded-2xl px-4 py-3 text-sm font-semibold ${pace.tone}`}
        >
          {pace.text}
        </p>
      )}
      <Field label="Objetivo">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setForm((f) => ({ ...f, goal: g }))}
              className={`rounded-2xl border-2 px-1 py-3 text-sm font-bold ${
                form.goal === g
                  ? "border-mint-500 bg-mint-50"
                  : "border-slate-200"
              }`}
            >
              {GOAL_LABEL[g]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Nível de atividade">
        <select
          className={inputClass}
          value={form.activityLevel}
          onChange={set("activityLevel")}
        >
          {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((a) => (
            <option key={a} value={a}>
              {ACTIVITY_LABEL[a]}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 p-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-mint-500"
          checked={form.bariatric}
          onChange={(e) =>
            setForm((f) => ({ ...f, bariatric: e.target.checked }))
          }
        />
        <span>
          <span className="block font-bold">Fiz cirurgia bariátrica</span>
          <span className="text-sm text-ink/60">
            Destaca a proteína do dia e ativa o controle de reposição
            (suplementos e vitaminas).
          </span>
        </span>
      </label>
      {form.bariatric && (
        <>
          <Field label="Data da cirurgia (opcional)">
            <input
              className={inputClass}
              type="date"
              max={today()}
              value={form.surgeryDate}
              onChange={set("surgeryDate")}
            />
          </Field>
          <p className="-mt-2 rounded-2xl bg-sun/30 px-4 py-3 text-sm">
            A meta de proteína vira o mínimo pós-bariátrica (60 g/dia ou mais,
            pelo seu peso ideal). Se seu nutricionista passou outra meta, ajuste
            em Perfil → ⚙️ → Metas.
          </p>
        </>
      )}
      <ErrorText error={mutation.error} />
      <Button className="w-full" loading={mutation.isPending}>
        {submitLabel}
      </Button>
    </form>
  );
}

function parseHeightCm(value: string): number {
  const n = parseFloat(value.replace(",", "."));
  return n > 0 && n < 3 ? Math.round(n * 100) : n;
}
