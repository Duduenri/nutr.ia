import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  api,
  type Challenge,
  type ChallengeLock,
  type ChallengesOverview,
} from "../lib/api";
import { useGame } from "../lib/hooks";
import { Button, Card, ErrorText, inputClass, Sheet } from "./ui";

const IDEAS = [
  "Correr 20 min na esteira",
  "Bater a meta de água hoje",
  "Fazer 10 mil passos",
  "30 agachamentos",
  "Ficar sem doce até amanhã",
  "Comer salada no almoço e no jantar",
  "Caminhar 40 min",
  "Bater a meta de proteína hoje",
];

const STAKES = [20, 50, 100, 200];

const DEADLINES: { label: string; at: () => Date }[] = [
  {
    label: "Hoje até 23:59",
    at: () => {
      const d = new Date();
      d.setHours(23, 59, 0, 0);
      return d;
    },
  },
  { label: "24 horas", at: () => new Date(Date.now() + 24 * 3_600_000) },
  { label: "3 dias", at: () => new Date(Date.now() + 72 * 3_600_000) },
  { label: "1 semana", at: () => new Date(Date.now() + 7 * 24 * 3_600_000) },
];

export function useChallenges() {
  return useQuery({
    queryKey: ["challenges"],
    queryFn: () => api.get<ChallengesOverview>("/challenges"),
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["challenges"] });
    void qc.invalidateQueries({ queryKey: ["game"] });
    void qc.invalidateQueries({ queryKey: ["friends"] });
  };
}

function timeLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "prazo acabou";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `faltam ${Math.floor(h / 24)} dias`;
  if (h >= 1)
    return `faltam ${h}h${String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0")}`;
  return `faltam ${Math.max(1, Math.floor(ms / 60_000))} min`;
}

function when(date: string): string {
  return new Date(date).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const RESULT: Record<string, (c: Challenge) => string> = {
  COMPLETED: (c) =>
    c.won
      ? `🏆 Você cumpriu! +${c.stake} 💎`
      : `😅 ${c.otherName} cumpriu · -${c.stake} 💎`,
  FAILED: (c) =>
    c.won
      ? `🏆 Você ganhou! +${c.stake} 💎`
      : `😅 Não deu dessa vez · -${c.stake} 💎`,
  DECLINED: (c) => (c.fromMe ? `${c.otherName} recusou` : "Você recusou"),
  CANCELLED: () => "Cancelado",
  EXPIRED: () => "Ninguém aceitou a tempo",
};

export function ChallengesCard() {
  const { data } = useChallenges();
  const refresh = useRefresh();
  const [showHistory, setShowHistory] = useState(false);
  const [proofFor, setProofFor] = useState<string | null>(null);
  const [proof, setProof] = useState("");

  const act = useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: string;
      body?: unknown;
    }) => api.post(`/challenges/${id}/${action}`, body),
    onSuccess: () => {
      setProofFor(null);
      setProof("");
      refresh();
    },
  });

  if (!data || (data.open.length === 0 && data.history.length === 0)) {
    return (
      <Card className="bg-[#f3efff]">
        <h2 className="font-extrabold">⚔️ Desafios</h2>
        <p className="mt-1 text-sm text-ink/70">
          Toque numa amiga no ranking e mande um desafio valendo gemas. Ela
          precisa aceitar. Se cumprir no prazo, ganha as suas gemas e escolhe o
          próximo desafio. Se não cumprir, as gemas dela vão pra você.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 bg-[#f3efff]">
      <h2 className="font-extrabold">⚔️ Desafios</h2>
      {data.open.length === 0 && (
        <p className="text-sm text-ink/70">
          Nenhum desafio rolando. Toque numa amiga no ranking pra desafiar.
        </p>
      )}
      {data.open.map((c) => {
        const mine = !c.fromMe;
        return (
          <div key={c.id} className="rounded-2xl bg-white p-3">
            <p className="text-sm font-bold text-ink/60">
              {c.status === "PENDING"
                ? mine
                  ? `${c.otherName} te desafiou!`
                  : `Esperando ${c.otherName} aceitar`
                : mine
                  ? "Seu desafio"
                  : `${c.otherName} está no desafio`}
            </p>
            <p className="text-lg font-extrabold">{c.title}</p>
            <p className="text-xs font-bold text-ink/50">
              Valendo {c.stake} 💎 · até {when(c.deadline)} ·{" "}
              {timeLeft(c.deadline)}
            </p>
            {c.status === "PENDING" && mine && (
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1 py-2"
                  loading={act.isPending}
                  onClick={() => act.mutate({ id: c.id, action: "accept" })}
                >
                  Aceitar ⚔️
                </Button>
                <Button
                  variant="soft"
                  className="py-2"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: c.id, action: "decline" })}
                >
                  Recusar
                </Button>
              </div>
            )}
            {c.status === "PENDING" && !mine && (
              <button
                className="mt-2 text-sm font-bold text-ink/40"
                disabled={act.isPending}
                onClick={() => act.mutate({ id: c.id, action: "cancel" })}
              >
                Cancelar desafio
              </button>
            )}
            {c.status === "ACCEPTED" && mine && proofFor !== c.id && (
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1 py-2"
                  onClick={() => setProofFor(c.id)}
                >
                  Cumpri! ✅
                </Button>
                <Button
                  variant="soft"
                  className="py-2"
                  disabled={act.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Desistir? ${c.otherName} fica com ${c.stake * 2} 💎 (as suas ${c.stake} vão pra ela).`,
                      )
                    )
                      act.mutate({ id: c.id, action: "give-up" });
                  }}
                >
                  Desistir
                </Button>
              </div>
            )}
            {proofFor === c.id && (
              <div className="mt-3 space-y-2">
                <input
                  className={inputClass}
                  placeholder="Conta como foi (opcional): ex. 22 min, 3 km"
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1 py-2"
                    loading={act.isPending}
                    onClick={() =>
                      act.mutate({
                        id: c.id,
                        action: "complete",
                        body: { proof: proof.trim() || undefined },
                      })
                    }
                  >
                    Confirmar ✅
                  </Button>
                  <Button
                    variant="ghost"
                    className="py-2"
                    onClick={() => setProofFor(null)}
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <ErrorText error={act.error} />
      {data.history.length > 0 && (
        <div>
          <button
            className="text-sm font-bold text-ink/50"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "Ocultar últimos desafios ▴" : "Últimos desafios ▾"}
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1">
              {data.history.map((c) => (
                <li
                  key={c.id}
                  className="rounded-2xl bg-white/70 px-3 py-2 text-sm"
                >
                  <span className="font-bold">{c.title}</span>
                  <span className="text-ink/50">
                    {" "}
                    · {c.fromMe ? `pra ${c.otherName}` : `de ${c.otherName}`}
                  </span>
                  <span className="block text-xs font-bold text-ink/60">
                    {RESULT[c.status]?.(c)}
                    {c.proof && ` · “${c.proof}”`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export function ChallengeButton({
  friendId,
  friendName,
  lock,
}: {
  friendId: string;
  friendName: string;
  lock: ChallengeLock | undefined;
}) {
  const [open, setOpen] = useState(false);
  const blocked = lock && !lock.canChallenge;
  return (
    <div>
      <Button
        className="w-full !bg-[#6b5bd6] disabled:opacity-40"
        disabled={blocked}
        onClick={() => setOpen(true)}
      >
        ⚔️ Desafiar {friendName}
      </Button>
      {blocked && (
        <p className="mt-1 text-xs text-ink/50">
          {lock.reason === "open"
            ? "Já tem um desafio rolando entre vocês."
            : `${friendName} ganhou o último desafio e escolhe o próximo (até ${when(lock.until!)}).`}
        </p>
      )}
      <ChallengeSheet
        open={open}
        onClose={() => setOpen(false)}
        friendId={friendId}
        friendName={friendName}
      />
    </div>
  );
}

function ChallengeSheet({
  open,
  onClose,
  friendId,
  friendName,
}: {
  open: boolean;
  onClose: () => void;
  friendId: string;
  friendName: string;
}) {
  const refresh = useRefresh();
  const { data: game } = useGame();
  const [title, setTitle] = useState("");
  const [stake, setStake] = useState(50);
  const [deadline, setDeadline] = useState(1);
  const [sent, setSent] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      api.post("/challenges", {
        toId: friendId,
        title: title.trim(),
        stake,
        deadline: DEADLINES[deadline].at().toISOString(),
      }),
    onSuccess: () => {
      setSent(true);
      refresh();
    },
  });
  const close = () => {
    setTitle("");
    setSent(false);
    create.reset();
    onClose();
  };
  const gems = game?.gems ?? 0;

  return (
    <Sheet open={open} onClose={close} title={`Desafiar ${friendName}`}>
      <div className="space-y-4 pb-6 text-left">
        {sent ? (
          <>
            <p className="rounded-2xl bg-mint-50 px-4 py-3 font-bold">
              ⚔️ Desafio enviado! Quando {friendName} aceitar, valendo {stake}{" "}
              💎 de cada uma, começa a valer.
            </p>
            <Button className="w-full" onClick={close}>
              Fechar
            </Button>
          </>
        ) : (
          <>
            <div>
              <span className="mb-1 block text-sm font-semibold text-ink/70">
                Qual o desafio?
              </span>
              <input
                className={inputClass}
                value={title}
                maxLength={120}
                placeholder="Ex.: correr 20 min na esteira"
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    onClick={() => setTitle(idea)}
                    className="rounded-full bg-soft px-3 py-1.5 text-xs font-bold"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-semibold text-ink/70">
                Prazo
              </span>
              <div className="grid grid-cols-2 gap-2">
                {DEADLINES.map((d, i) => (
                  <button
                    key={d.label}
                    onClick={() => setDeadline(i)}
                    className={`rounded-2xl py-2.5 text-sm font-bold ${deadline === i ? "bg-ink text-white" : "bg-soft"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-semibold text-ink/70">
                Aposta (cada uma coloca) · você tem {gems} 💎
              </span>
              <div className="grid grid-cols-4 gap-2">
                {STAKES.map((v) => (
                  <button
                    key={v}
                    disabled={v > gems}
                    onClick={() => setStake(v)}
                    className={`rounded-2xl py-2.5 text-sm font-bold disabled:opacity-30 ${stake === v ? "bg-[#6b5bd6] text-white" : "bg-soft"}`}
                  >
                    {v} 💎
                  </button>
                ))}
              </div>
            </div>
            <p className="rounded-2xl bg-soft px-4 py-3 text-xs text-ink/70">
              Suas {stake} 💎 ficam guardadas até {friendName} responder. Se ela
              cumprir no prazo, leva as suas gemas e escolhe o próximo desafio.
              Se não cumprir ou desistir, as gemas dela vêm pra você. Se
              recusar, suas gemas voltam.
            </p>
            <ErrorText error={create.error} />
            <Button
              className="w-full !bg-[#6b5bd6] disabled:opacity-40"
              loading={create.isPending}
              disabled={title.trim().length < 3 || stake > gems}
              onClick={() => create.mutate()}
            >
              Enviar desafio valendo {stake} 💎
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
