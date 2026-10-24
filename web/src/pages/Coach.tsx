import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import {
  Button,
  ErrorText,
  inputClass,
  Segmented,
  Sheet,
  Spinner,
} from "../components/ui";
import { api, type ChatMessage, type Plan } from "../lib/api";
import { today } from "../lib/date";

const SUGGESTIONS = [
  "O que posso comer no jantar pra bater minha proteína?",
  "Como estou indo hoje?",
  "Me dá ideias de lanche com menos de 200 kcal",
  "Estou com vontade de doce, o que faço?",
];

const PLAN_KINDS: { kind: Plan["kind"]; label: string; icon: string }[] = [
  { kind: "diet", label: "Plano alimentar", icon: "🥗" },
  { kind: "workout", label: "Plano de treino", icon: "🏋️‍♀️" },
];

export function CoachPage() {
  const [tab, setTab] = useState<"chat" | "plans">("chat");
  return (
    <div>
      <header className="pt-safe bg-mint-100 px-4 pb-4">
        <h1 className="mb-3 text-2xl font-extrabold">Coach 🤖</h1>
        <Segmented
          options={[
            { value: "chat", label: "Conversa" },
            { value: "plans", label: "Planos" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </header>
      {tab === "chat" ? <Chat /> : <Plans />}
    </div>
  );
}

function Chat() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat"],
    queryFn: () => api.get<ChatMessage[]>("/coach/messages"),
  });

  const send = useMutation({
    mutationFn: (content: string) =>
      api.post<ChatMessage>("/coach/messages", { content, today: today() }),
    onMutate: (content) => {
      qc.setQueryData<ChatMessage[]>(["chat"], (old = []) => [
        ...old,
        {
          id: `tmp-${Date.now()}`,
          role: "USER",
          content,
          createdAt: new Date().toISOString(),
        },
      ]);
      setText("");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["chat"] }),
  });

  const clear = useMutation({
    mutationFn: () => api.del("/coach/messages"),
    onSuccess: () => qc.setQueryData(["chat"], []),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, send.isPending]);

  const submit = (content: string) => {
    if (content.trim() && !send.isPending) send.mutate(content.trim());
  };

  return (
    <div className="flex min-h-[calc(100dvh-16rem)] flex-col px-4 pt-4">
      <div className="flex-1 space-y-3">
        {isLoading && (
          <div className="text-center text-mint-500">
            <Spinner />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="space-y-3">
            <p className="rounded-3xl bg-white p-4 shadow-card">
              Oi! Sou sua coach de nutrição 💚 Eu vejo o que você registrou no
              diário e te ajudo com dúvidas, ideias de refeição e motivação.
              Pergunta qualquer coisa!
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full bg-white px-4 py-2 text-left text-sm font-semibold shadow-card"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-3xl px-4 py-2 ${
                m.role === "USER"
                  ? "rounded-br-md bg-ink text-white"
                  : "prose-chat rounded-bl-md bg-white shadow-card"
              }`}
            >
              {m.role === "USER" ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : (
                <Markdown>{m.content}</Markdown>
              )}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex justify-start">
            <div className="rounded-3xl rounded-bl-md bg-white px-4 py-3 shadow-card">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink/40" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink/40 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink/40 [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        <ErrorText error={send.error} />
        {messages.length > 0 && (
          <button
            onClick={() => clear.mutate()}
            className="mx-auto block py-2 text-xs font-semibold text-ink/40"
          >
            Limpar conversa
          </button>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="sticky bottom-24 mt-3 flex gap-2 rounded-full bg-white p-1.5 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <input
          className="min-w-0 flex-1 bg-transparent px-4 outline-none"
          placeholder="Pergunte à coach..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white disabled:bg-ink/40"
          disabled={!text.trim() || send.isPending}
          aria-label="Enviar"
        >
          ➤
        </button>
      </form>
    </div>
  );
}

interface PlanQuestion {
  question: string;
  options: string[];
  multiple: boolean;
}

const REVISE_CHIPS: Record<Plan["kind"], string[]> = {
  diet: [
    "Troque o almoço",
    "Troque o jantar",
    "Deixe mais barato",
    "Receitas mais rápidas",
    "Sem carne vermelha",
  ],
  workout: [
    "Só tenho 30 min",
    "Treino em casa sem equipamento",
    "Mais pernas e glúteo",
    "Deixe mais leve",
    "Troque um exercício que não gosto",
  ],
  recipe: [],
};

const REVISE_HINT: Record<Plan["kind"], string> = {
  diet: "Ex.: “só tenho ovo, arroz e frango em casa”, “troca o jantar”, “não como peixe”.",
  workout:
    "Ex.: “prefiro bicicleta a corrida”, “não gosto de agachamento”, “só posso treinar 3x”, “tenho halteres de 2 kg”.",
  recipe: "O que você quer mudar?",
};

function Plans() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Plan | null>(null);
  const [asking, setAsking] = useState<Plan["kind"] | null>(null);
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/coach/plans"),
  });

  const created = (plan: Plan) => {
    void qc.invalidateQueries({ queryKey: ["plans"] });
    setAsking(null);
    setOpen(plan);
  };
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/coach/plans/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans"] });
      setOpen(null);
    },
  });

  return (
    <div className="space-y-4 px-4 pt-4">
      <p className="text-sm text-ink/60">
        A coach faz umas perguntas rápidas (o que você tem em casa, do que
        gosta…) e monta o plano pra você.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PLAN_KINDS.map((p) => (
          <button
            key={p.kind}
            onClick={() => setAsking(p.kind)}
            className="flex flex-col items-center gap-1 rounded-3xl bg-white px-2 py-4 text-center text-sm font-bold shadow-card"
          >
            <span className="text-3xl">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>
      <h2 className="pt-2 text-lg font-extrabold">Salvos</h2>
      {isLoading && <Spinner />}
      {!isLoading && plans.length === 0 && (
        <p className="text-ink/60">
          Gere um plano acima — ele fica salvo aqui.
        </p>
      )}
      <ul className="space-y-2">
        {plans.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => setOpen(p)}
              className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-card"
            >
              <span className="font-bold">
                {PLAN_KINDS.find((k) => k.kind === p.kind)?.icon ?? "👩‍🍳"}{" "}
                {p.title}
              </span>
              <span className="text-sm text-ink/50">
                {new Date(p.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <QuestionsSheet
        kind={asking}
        onClose={() => setAsking(null)}
        onCreated={created}
      />
      <Sheet
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.title}
      >
        {open && (
          <PlanView
            plan={open}
            onRevised={(p) => {
              void qc.invalidateQueries({ queryKey: ["plans"] });
              setOpen(p);
            }}
            onDelete={() => remove.mutate(open.id)}
            deleting={remove.isPending}
          />
        )}
      </Sheet>
    </div>
  );
}

function QuestionsSheet({
  kind,
  onClose,
  onCreated,
}: {
  kind: Plan["kind"] | null;
  onClose: () => void;
  onCreated: (p: Plan) => void;
}) {
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const [extra, setExtra] = useState<Record<number, string>>({});

  const questions = useQuery({
    queryKey: ["plan-questions", kind],
    queryFn: () =>
      api.post<{ questions: PlanQuestion[] }>("/coach/plans/questions", {
        kind,
        today: today(),
      }),
    enabled: kind !== null,
    staleTime: Infinity,
    gcTime: 0,
  });

  const create = useMutation({
    mutationFn: (withAnswers: boolean) =>
      api.post<Plan>("/coach/plans", {
        kind,
        today: today(),
        answers: withAnswers
          ? (questions.data?.questions ?? []).map((q, i) => ({
              question: q.question,
              answer: [...(picked[i] ?? []), extra[i] ?? ""]
                .filter((v) => v.trim())
                .join(", "),
            }))
          : undefined,
      }),
    onSuccess: (p) => {
      setPicked({});
      setExtra({});
      onCreated(p);
    },
  });

  const toggle = (i: number, option: string, multiple: boolean) =>
    setPicked((prev) => {
      const current = prev[i] ?? [];
      const has = current.includes(option);
      return {
        ...prev,
        [i]: multiple
          ? has
            ? current.filter((o) => o !== option)
            : [...current, option]
          : has
            ? []
            : [option],
      };
    });

  const label = PLAN_KINDS.find((k) => k.kind === kind)?.label ?? "Plano";

  return (
    <Sheet open={kind !== null} onClose={onClose} title={label}>
      <div className="space-y-5 pb-4">
        {create.isPending ? (
          <div className="flex flex-col items-center gap-3 py-10 font-semibold text-mint-500">
            <Spinner className="h-10 w-10 border-4" />
            Montando seu plano...
          </div>
        ) : questions.isLoading ? (
          <div className="flex flex-col items-center gap-3 py-10 font-semibold text-mint-500">
            <Spinner />
            Preparando umas perguntas...
          </div>
        ) : (
          <>
            <ErrorText error={questions.error} />
            {questions.data?.questions.map((q, i) => (
              <section key={i} className="space-y-2">
                <h3 className="font-extrabold">{q.question}</h3>
                {q.options.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((o) => {
                      const on = (picked[i] ?? []).includes(o);
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() => toggle(i, o, q.multiple)}
                          className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                            on ? "bg-ink text-white" : "bg-soft text-ink/70"
                          }`}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                )}
                <input
                  className={inputClass}
                  placeholder={
                    q.options.length
                      ? "Outro / detalhes (opcional)"
                      : "Sua resposta"
                  }
                  value={extra[i] ?? ""}
                  onChange={(e) =>
                    setExtra((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                />
              </section>
            ))}
            <ErrorText error={create.error} />
            <Button
              className="w-full"
              disabled={!questions.data}
              onClick={() => create.mutate(true)}
            >
              Montar meu plano
            </Button>
            <button
              className="w-full py-2 text-sm font-bold text-ink/50"
              onClick={() => create.mutate(false)}
            >
              Pular perguntas
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function PlanView({
  plan,
  onRevised,
  onDelete,
  deleting,
}: {
  plan: Plan;
  onRevised: (p: Plan) => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [request, setRequest] = useState("");
  const revise = useMutation({
    mutationFn: (text: string) =>
      api.post<Plan>(`/coach/plans/${plan.id}/revise`, {
        request: text,
        today: today(),
      }),
    onSuccess: (p) => {
      setRequest("");
      onRevised(p);
    },
  });

  return (
    <div className="pb-4">
      <div className={`prose-chat ${revise.isPending ? "opacity-40" : ""}`}>
        <Markdown>{plan.content}</Markdown>
      </div>
      <section className="mt-5 space-y-3 rounded-3xl bg-mint-50 p-4">
        <h3 className="font-extrabold">Ajustar este plano</h3>
        <p className="text-sm text-ink/60">{REVISE_HINT[plan.kind]}</p>
        <div className="flex flex-wrap gap-2">
          {REVISE_CHIPS[plan.kind].map((c) => (
            <button
              key={c}
              disabled={revise.isPending}
              onClick={() => revise.mutate(c)}
              className="rounded-full bg-white px-3 py-1.5 text-sm font-bold disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
        <textarea
          className={`${inputClass} min-h-20`}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="O que você quer mudar?"
        />
        <ErrorText error={revise.error} />
        <Button
          className="w-full"
          loading={revise.isPending}
          disabled={request.trim().length < 2}
          onClick={() => revise.mutate(request.trim())}
        >
          {revise.isPending ? "Ajustando..." : "Ajustar com IA"}
        </Button>
      </section>
      <Button
        variant="danger"
        className="mt-4 w-full"
        loading={deleting}
        onClick={onDelete}
      >
        Apagar
      </Button>
    </div>
  );
}
