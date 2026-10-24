import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Button, ErrorText, Segmented, Sheet, Spinner } from "../components/ui";
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

function Plans() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Plan | null>(null);
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/coach/plans"),
  });

  const create = useMutation({
    mutationFn: (kind: Plan["kind"]) =>
      api.post<Plan>("/coach/plans", { kind, today: today() }),
    onSuccess: (plan) => {
      void qc.invalidateQueries({ queryKey: ["plans"] });
      setOpen(plan);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/coach/plans/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans"] });
      setOpen(null);
    },
  });

  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="grid grid-cols-2 gap-2">
        {PLAN_KINDS.map((p) => (
          <button
            key={p.kind}
            disabled={create.isPending}
            onClick={() => create.mutate(p.kind)}
            className="flex flex-col items-center gap-1 rounded-3xl bg-white px-2 py-4 text-center text-sm font-bold shadow-card disabled:opacity-50"
          >
            <span className="text-3xl">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>
      {create.isPending && (
        <div className="flex items-center justify-center gap-3 rounded-3xl bg-mint-50 p-4 font-semibold text-mint-500">
          <Spinner /> Montando com base no seu perfil...
        </div>
      )}
      <ErrorText error={create.error} />
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
                {PLAN_KINDS.find((k) => k.kind === p.kind)?.icon} {p.title}
              </span>
              <span className="text-sm text-ink/50">
                {new Date(p.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.title}
      >
        {open && (
          <div className="pb-4">
            <div className="prose-chat">
              <Markdown>{open.content}</Markdown>
            </div>
            <Button
              variant="danger"
              className="mt-4 w-full"
              loading={remove.isPending}
              onClick={() => remove.mutate(open.id)}
            >
              Apagar
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
