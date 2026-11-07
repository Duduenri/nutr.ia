import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  api,
  MEAL_EMOJI,
  MEAL_LABEL,
  WEEKDAY_LABEL,
  type FreeMealState,
  type MealType,
} from "../lib/api";
import { shiftDay } from "../lib/date";
import { showToast } from "../lib/toast";
import { Button, Card, ErrorText, Sheet, Spinner } from "./ui";

const MEALS = Object.keys(MEAL_LABEL) as MealType[];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function weekStartOf(day: string): string {
  return shiftDay(day, -((weekdayOf(day) + 6) % 7));
}

export function useFreeMeal() {
  return useQuery({
    queryKey: ["free-meal"],
    queryFn: () => api.get<FreeMealState>("/free-meal"),
  });
}

function useInvalidateFreeMeal() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["free-meal", "diary", "missions", "stats", "game"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function showFreeMealToast() {
  showToast({
    emoji: "🍕",
    title: "Refeição livre! Aproveita sem culpa 😋",
    lines: [
      "Essa não conta como porcaria nem quebra suas sequências.",
      "Na próxima refeição é só voltar pro plano normal.",
    ],
  });
}

function slotLabel(weekday: number, meal: MealType) {
  return `${WEEKDAY_LABEL[weekday]}, ${MEAL_LABEL[meal].toLowerCase()}`;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-3 py-2.5 text-sm font-bold transition active:scale-95 ${
        active ? "bg-ink text-white" : "bg-soft text-ink/70"
      }`}
    >
      {children}
    </button>
  );
}

export function FreeMealForm({ onDone }: { onDone: () => void }) {
  const { data, isLoading } = useFreeMeal();
  if (isLoading || !data) return <Spinner />;
  return <FreeMealFormBody state={data} onDone={onDone} />;
}

function FreeMealFormBody({
  state,
  onDone,
}: {
  state: FreeMealState;
  onDone: () => void;
}) {
  const invalidate = useInvalidateFreeMeal();
  const [enabled, setEnabled] = useState(state.enabled);
  const [weekday, setWeekday] = useState<number>(state.weekday ?? 6);
  const [meal, setMeal] = useState<MealType>(state.meal ?? "DINNER");
  const save = useMutation({
    mutationFn: () =>
      api.patch<FreeMealState>(
        "/free-meal",
        enabled ? { enabled, weekday, meal } : { enabled },
      ),
    onSuccess: () => {
      invalidate();
      onDone();
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/70">
        Uma refeição por semana pra comer o que der vontade. Nela o app não
        reclama de porcaria, ela não quebra suas sequências e o dia não conta na
        meta de calorias. As outras refeições seguem o plano normal.
      </p>
      <label className="flex items-center justify-between rounded-2xl bg-soft px-4 py-4 font-bold">
        🍕 Quero uma refeição livre
        <input
          type="checkbox"
          className="h-6 w-6 accent-ink"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </label>
      {enabled && (
        <>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink/70">
              Dia da semana
            </p>
            <div className="grid grid-cols-4 gap-2">
              {WEEK_ORDER.map((d) => (
                <Chip
                  key={d}
                  active={weekday === d}
                  onClick={() => setWeekday(d)}
                >
                  {WEEKDAY_LABEL[d].slice(0, 3)}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-ink/70">Refeição</p>
            <div className="grid grid-cols-2 gap-2">
              {MEALS.map((m) => (
                <Chip key={m} active={meal === m} onClick={() => setMeal(m)}>
                  {MEAL_EMOJI[m]} {MEAL_LABEL[m]}
                </Chip>
              ))}
            </div>
          </div>
          <p className="rounded-2xl bg-grape-100 px-4 py-3 text-sm">
            Toda semana: <b>{slotLabel(weekday, meal)}</b>. Dá pra trocar o dia
            de uma semana pelo diário, uma vez por semana.
          </p>
          {state.bariatric && (
            <p className="rounded-2xl bg-peach-100 px-4 py-3 text-sm font-semibold text-peach-500">
              ⚠️ Pós-bariátrica: doce, fritura e refri podem dar dumping. Mesmo
              na refeição livre, porção pequena, coma devagar e combine com sua
              nutricionista.
            </p>
          )}
        </>
      )}
      <ErrorText error={save.error} />
      <Button
        className="w-full"
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        Salvar
      </Button>
    </div>
  );
}

export function FreeMealDayCard({ date }: { date: string }) {
  const { data } = useFreeMeal();
  const [picking, setPicking] = useState(false);
  if (!data?.enabled || weekStartOf(date) !== weekStartOf(data.today)) {
    return null;
  }
  const week = data.week;
  const isToday = week?.date === date;

  return (
    <>
      <Card className="flex items-center gap-3 bg-grape-100 py-3">
        <span className="text-3xl">🍕</span>
        <span className="min-w-0 flex-1 text-sm">
          {isToday && week ? (
            <>
              <b className="block text-base">
                Refeição livre: {MEAL_LABEL[week.meal].toLowerCase()}
              </b>
              Aproveita sem culpa. O resto do dia segue o plano.
            </>
          ) : (
            <>
              <b className="block">Refeição livre da semana</b>
              {week
                ? slotLabel(weekdayOf(week.date), week.meal)
                : "Nenhuma nesta semana"}
              {week?.swapped ? " (trocada)" : ""}
            </>
          )}
        </span>
        <button
          onClick={() => setPicking(true)}
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-card active:scale-95"
        >
          {isToday ? "Trocar" : "Usar neste dia"}
        </button>
      </Card>
      {picking && (
        <SwapSheet state={data} date={date} onClose={() => setPicking(false)} />
      )}
    </>
  );
}

function SwapSheet({
  state,
  date,
  onClose,
}: {
  state: FreeMealState;
  date: string;
  onClose: () => void;
}) {
  const invalidate = useInvalidateFreeMeal();
  const week = state.week;
  const [meal, setMeal] = useState<MealType>(
    week?.date === date ? week.meal : (state.meal ?? "DINNER"),
  );
  const done = () => {
    invalidate();
    onClose();
  };
  const swap = useMutation({
    mutationFn: () => api.put("/free-meal/week", { date, meal }),
    onSuccess: done,
  });
  const reset = useMutation({
    mutationFn: () => api.del("/free-meal/week"),
    onSuccess: done,
  });
  const losing = week && !(week.date === date && week.meal === meal);

  return (
    <Sheet open onClose={onClose} title="Refeição livre neste dia">
      <div className="space-y-4 pb-6">
        <div className="grid grid-cols-2 gap-2">
          {MEALS.map((m) => (
            <Chip key={m} active={meal === m} onClick={() => setMeal(m)}>
              {MEAL_EMOJI[m]} {MEAL_LABEL[m]}
            </Chip>
          ))}
        </div>
        {losing && (
          <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-ink/70">
            Vale uma por semana: a de{" "}
            {WEEKDAY_LABEL[weekdayOf(week.date)].toLowerCase()} (
            {MEAL_LABEL[week.meal].toLowerCase()}) deixa de valer.
          </p>
        )}
        <ErrorText error={swap.error ?? reset.error} />
        <Button
          className="w-full"
          loading={swap.isPending}
          onClick={() => swap.mutate()}
        >
          Usar {slotLabel(weekdayOf(date), meal)}
        </Button>
        {week?.swapped && (
          <Button
            variant="ghost"
            className="w-full"
            loading={reset.isPending}
            onClick={() => reset.mutate()}
          >
            Voltar pro dia de sempre
          </Button>
        )}
      </div>
    </Sheet>
  );
}
