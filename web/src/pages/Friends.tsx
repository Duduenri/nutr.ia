import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChallengeButton,
  ChallengesCard,
  useChallenges,
} from "../components/Challenges";
import { Svg } from "../components/Svg";
import {
  Button,
  Card,
  ErrorText,
  inputClass,
  Sheet,
  Spinner,
} from "../components/ui";
import { api, type FriendsOverview, type RankEntry } from "../lib/api";
import { today } from "../lib/date";
import { clearPendingFriend, pendingFriend } from "../lib/pendingFriend";
import { petSvg } from "../lib/pet";

const CHEERS = ["💪", "🔥", "👏", "💚", "🥳"];
const MEDALS = ["🥇", "🥈", "🥉"];

function useFriends() {
  return useQuery({
    queryKey: ["friends", today()],
    queryFn: () => api.get<FriendsOverview>(`/friends?today=${today()}`),
  });
}

export function FriendsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error } = useFriends();
  const autoCode = (params.get("add") ?? pendingFriend())?.toUpperCase();
  const [code, setCode] = useState(autoCode ?? "");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<RankEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["friends"] });
    void qc.invalidateQueries({ queryKey: ["game"] });
  };

  const request = useMutation({
    mutationFn: (c: string) =>
      api.post<{ status: string; name: string }>("/friends/request", {
        code: c,
      }),
    onSettled: () => {
      clearPendingFriend();
      setParams({}, { replace: true });
    },
    onSuccess: (r) => {
      setCode("");
      setNotice(
        r.status === "accepted"
          ? `Agora você e ${r.name} são amigas! 🎉`
          : `Pedido enviado pra ${r.name}. Quando ela aceitar, aparece no ranking.`,
      );
      refresh();
    },
  });
  const accept = useMutation({
    mutationFn: (id: string) => api.post(`/friends/${id}/accept`),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/friends/${id}`),
    onSuccess: () => {
      setOpen(null);
      refresh();
    },
  });
  const seen = useMutation({
    mutationFn: () => api.post("/friends/cheers/seen"),
    onSuccess: refresh,
  });
  const settings = useMutation({
    mutationFn: (shareWeight: boolean) =>
      api.patch("/friends/settings", { shareWeight }),
    onSuccess: refresh,
  });

  const myCode = data?.code;
  useEffect(() => {
    if (
      autoCode &&
      myCode &&
      autoCode !== myCode &&
      autoCode.length === 6 &&
      request.isIdle
    ) {
      request.mutate(autoCode);
    }
  }, [autoCode, myCode, request]);

  const invite = async () => {
    if (!data) return;
    const url = `${window.location.origin}/amigos?add=${data.code}`;
    const text = `Bora cuidar da alimentação juntas no nutri.ia? 💚 Meu código de amiga: ${data.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "nutri.ia", text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await navigator.clipboard?.writeText(`${text}\n${url}`);
    setCopied(true);
  };

  return (
    <div>
      <header className="pt-safe bg-gradient-to-br from-[#fde1d6] to-[#fde8d4] px-4 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl"
            aria-label="Voltar"
          >
            ‹
          </button>
          <h1 className="text-2xl font-extrabold">Amigos 👯‍♀️</h1>
        </div>
        {data && (
          <div className="mt-4 rounded-3xl bg-white p-4 shadow-card">
            <div className="text-sm font-bold text-ink/50">
              Seu código de amiga
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-3xl font-extrabold tracking-[0.2em]">
                {data.code}
              </span>
              <Button
                className="shrink-0 px-4 py-2"
                onClick={() => void invite()}
              >
                {copied ? "Copiado ✓" : "📲 Convidar"}
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="space-y-4 px-4 pt-4">
        {isLoading && (
          <div className="text-center text-mint-500">
            <Spinner />
          </div>
        )}
        <ErrorText error={error} />

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length === 6) request.mutate(code.trim());
          }}
        >
          <input
            className={`${inputClass} font-mono uppercase tracking-widest`}
            placeholder="Código da amiga"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
          />
          <Button
            className="shrink-0"
            loading={request.isPending}
            disabled={code.length !== 6}
          >
            Adicionar
          </Button>
        </form>
        <ErrorText error={request.error} />
        {notice && (
          <p className="rounded-2xl bg-mint-50 px-4 py-3 text-sm font-bold text-mint-500">
            {notice}
          </p>
        )}

        {data && data.cheers.length > 0 && (
          <Card className="space-y-2 bg-[#fdf3e7]">
            {data.cheers.map((c) => (
              <p key={c.id} className="font-bold">
                <span className="text-2xl">{c.emoji}</span> {c.fromName} te
                mandou força!
              </p>
            ))}
            <Button
              variant="soft"
              className="w-full"
              loading={seen.isPending}
              onClick={() => seen.mutate()}
            >
              Valeu! 💚
            </Button>
          </Card>
        )}

        {data && data.ranking.length > 1 && <ChallengesCard />}

        {data && data.incoming.length > 0 && (
          <Card className="space-y-3">
            <h2 className="font-extrabold">Pedidos de amizade</h2>
            {data.incoming.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <span className="flex-1 font-bold">
                  {f.name} quer ser sua amiga
                </span>
                <Button
                  className="px-4 py-2"
                  loading={accept.isPending}
                  onClick={() => accept.mutate(f.id)}
                >
                  Aceitar
                </Button>
                <button
                  className="text-sm font-bold text-ink/40"
                  onClick={() => remove.mutate(f.id)}
                >
                  Recusar
                </button>
              </div>
            ))}
          </Card>
        )}

        {data && data.outgoing.length > 0 && (
          <div className="space-y-1">
            {data.outgoing.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-2xl bg-soft px-4 py-2 text-sm"
              >
                <span>⏳ Esperando {f.name} aceitar</span>
                <button
                  className="font-bold text-ink/40"
                  onClick={() => remove.mutate(f.id)}
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        )}

        {data && (
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-extrabold">🏆 Ranking da semana</h2>
              <span className="text-xs font-semibold text-ink/40">
                zera toda segunda
              </span>
            </div>
            {data.ranking.length === 1 && (
              <p className="mb-3 rounded-2xl bg-soft px-4 py-3 text-sm text-ink/60">
                Convide amigas com o seu código pra competir juntas! 💚
              </p>
            )}
            <ul className="space-y-2">
              {data.ranking.map((r) => (
                <li key={r.userId}>
                  <button
                    onClick={() => setOpen(r)}
                    className={`flex w-full items-center gap-3 rounded-3xl p-3 text-left shadow-card ${
                      r.isMe ? "bg-mint-50 ring-2 ring-mint-400" : "bg-white"
                    }`}
                  >
                    <span className="w-8 text-center text-2xl font-extrabold">
                      {MEDALS[r.position - 1] ?? r.position}
                    </span>
                    <Svg
                      markup={petSvg(r.petLevel, r.petEquipped)}
                      className="h-12 w-12 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold">
                        {r.name}{" "}
                        {r.isMe && (
                          <span className="text-xs font-bold text-mint-500">
                            (você)
                          </span>
                        )}
                      </span>
                      <span className="flex flex-wrap gap-x-2 text-xs font-bold text-ink/50">
                        <span>🔥 {r.streak}</span>
                        <span>📅 {r.daysLogged}/7</span>
                        <span>💧 {r.waterTodayPct}% hoje</span>
                        <span>🎯 {r.missions}</span>
                        {r.fasts > 0 && <span>⏱️ {r.fasts}</span>}
                        {r.weightLostPct !== null && r.weightLostPct > 0 && (
                          <span>⚖️ -{r.weightLostPct}%</span>
                        )}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-xl font-extrabold">
                        {r.points}
                      </span>
                      <span className="text-[10px] font-bold text-ink/40">
                        pontos
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink/50">
              Pontos: 10 por dia com refeição registrada, 5 por meta de água, 5
              por missão resgatada e 10 por jejum completo. 💧 = quanto da meta
              de água já bebeu hoje. Ninguém vê suas calorias, comidas, fotos ou
              peso.
            </p>
          </section>
        )}

        {data && (
          <label className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-slate-100 p-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-mint-500"
              checked={data.shareWeight}
              disabled={settings.isPending}
              onChange={(e) => settings.mutate(e.target.checked)}
            />
            <span className="text-sm">
              <span className="block font-bold">
                Mostrar meu progresso de peso
              </span>
              <span className="text-ink/60">
                As amigas veem só o % que você já perdeu, nunca os quilos.
              </span>
            </span>
          </label>
        )}
      </div>

      <FriendSheet
        entry={open}
        onClose={() => setOpen(null)}
        onRemove={(id) => remove.mutate(id)}
        removing={remove.isPending}
      />
    </div>
  );
}

function FriendSheet({
  entry,
  onClose,
  onRemove,
  removing,
}: {
  entry: RankEntry | null;
  onClose: () => void;
  onRemove: (userId: string) => void;
  removing: boolean;
}) {
  const [sent, setSent] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const { data: challenges } = useChallenges();
  if (entry && entry.userId !== lastId) {
    setLastId(entry.userId);
    setSent(null);
  }
  const cheer = useMutation({
    mutationFn: (emoji: string) =>
      api.post(`/friends/${entry!.userId}/cheer`, { emoji }),
    onSuccess: (_, emoji) => setSent(emoji),
  });

  return (
    <Sheet open={Boolean(entry)} onClose={onClose}>
      {entry && (
        <div className="space-y-4 pb-6 text-center">
          <Svg
            markup={petSvg(entry.petLevel, entry.petEquipped)}
            className="mx-auto h-36 w-36"
          />
          <div>
            <h2 className="text-2xl font-extrabold">{entry.name}</h2>
            <p className="text-sm text-ink/60">
              {entry.petName ? `${entry.petName} · ` : ""}nível {entry.petLevel}{" "}
              · {entry.achievements} conquistas · ⭐ {entry.points} pontos
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              ["🔥", entry.streak, "dias seguidos"],
              ["📅", `${entry.daysLogged}/7`, "dias na semana"],
              ["💧", `${entry.waterTodayPct}%`, "da água hoje"],
              ["💧", `${entry.waterWeekPct}%`, "média na semana"],
              ["🎯", entry.missions, "missões"],
              ["⏱️", entry.fasts, "jejuns"],
            ].map(([icon, value, label]) => (
              <div key={label as string} className="rounded-2xl bg-soft py-2">
                <div className="text-lg font-extrabold">
                  {icon} {value}
                </div>
                <div className="text-xs text-ink/50">{label}</div>
              </div>
            ))}
          </div>
          {entry.weightLostPct !== null && entry.weightLostPct > 0 && (
            <p className="font-bold text-mint-500">
              ⚖️ Já perdeu {entry.weightLostPct}% do peso inicial
            </p>
          )}
          {!entry.isMe && (
            <>
              <ChallengeButton
                friendId={entry.userId}
                friendName={entry.name}
                lock={challenges?.locks.find(
                  (l) => l.friendId === entry.userId,
                )}
              />
              <div>
                <p className="mb-2 font-extrabold">Mandar força</p>
                <div className="flex justify-center gap-2">
                  {CHEERS.map((e) => (
                    <button
                      key={e}
                      disabled={cheer.isPending}
                      onClick={() => cheer.mutate(e)}
                      className="grid h-12 w-12 place-items-center rounded-full bg-soft text-2xl active:scale-95"
                    >
                      {e}
                    </button>
                  ))}
                </div>
                {sent && (
                  <p className="mt-2 text-sm font-bold text-mint-500">
                    {sent} enviado pra {entry.name}!
                  </p>
                )}
                <ErrorText error={cheer.error} />
              </div>
              <button
                className="text-sm font-bold text-ink/40"
                disabled={removing}
                onClick={() => {
                  if (window.confirm(`Remover ${entry.name} dos amigos?`))
                    onRemove(entry.userId);
                }}
              >
                Remover amizade
              </button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
