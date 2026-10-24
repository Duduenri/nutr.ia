import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorText, ProgressBar, Spinner } from "../components/ui";
import { api, type GameState, type Mission, type Missions } from "../lib/api";
import { today } from "../lib/date";

export function MissionsPage() {
  const day = today();
  const { data, isLoading, error } = useQuery({
    queryKey: ["missions", day],
    queryFn: () => api.get<Missions>(`/missions/${day}`),
  });
  const qc = useQueryClient();
  const claim = useMutation({
    mutationFn: (v: { scope: "daily" | "weekly" | "month"; key: string }) =>
      api.post<GameState>("/missions/claim", { date: day, ...v }),
    onSuccess: (g) => {
      qc.setQueryData(["game"], g);
      void qc.invalidateQueries({ queryKey: ["missions"] });
    },
  });

  return (
    <div>
      <header className="pt-safe relative overflow-hidden bg-gradient-to-br from-[#f6c79a] via-[#f3b07a] to-[#c98a54] px-5 pb-16">
        <div className="pointer-events-none absolute -right-10 top-10 h-48 w-48 rounded-full bg-sun/70 blur-sm" />
        <div className="pointer-events-none absolute -left-8 bottom-6 h-24 w-40 rounded-full bg-white/30" />
        <div className="relative flex items-start justify-between pt-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-ink">
              {data?.month.title ?? "Missões"}
            </h1>
            {data && (
              <p className="mt-1 font-bold text-ink/80">
                ⏱ {data.month.daysLeft} dias restantes
              </p>
            )}
          </div>
          {data && (
            <div className="rounded-full bg-white px-4 py-2 text-lg font-extrabold shadow-card">
              🔥 {data.streak}
            </div>
          )}
        </div>
        <div className="relative mt-4 text-center text-7xl">🧘‍♀️🥑</div>
        {data && (
          <div className="relative mt-6 rounded-3xl bg-white p-4 shadow-card">
            <div className="mb-2 font-extrabold">
              Conclua {data.month.goal} missões no mês
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <MissionBar
                  progress={data.month.progress}
                  goal={data.month.goal}
                  color="bg-peach-400"
                />
              </div>
              <Reward
                done={data.month.progress >= data.month.goal}
                claimed={data.month.claimed}
                gems={data.month.gems}
                onClaim={() => claim.mutate({ scope: "month", key: "month" })}
                pending={claim.isPending && claim.variables?.key === "month"}
              />
            </div>
          </div>
        )}
      </header>
      <div className="relative -mt-8 min-h-[50vh] space-y-6 rounded-t-[2rem] bg-white px-5 pt-6">
        {isLoading && (
          <div className="text-center text-mint-500">
            <Spinner />
          </div>
        )}
        <ErrorText error={error} />
        {data && (
          <>
            <Section
              title="Missão diária"
              hint="renova à meia-noite"
              missions={data.daily}
              color="bg-mint-500"
              onClaim={(key) => claim.mutate({ scope: "daily", key })}
              pendingKey={
                claim.isPending ? (claim.variables?.key ?? null) : null
              }
            />
            <hr className="border-slate-100" />
            <Section
              title="Missão da semana"
              hint="seg a dom"
              missions={data.weekly}
              color="bg-sun"
              onClaim={(key) => claim.mutate({ scope: "weekly", key })}
              pendingKey={
                claim.isPending ? (claim.variables?.key ?? null) : null
              }
            />
            <p className="pb-4 text-center text-sm text-ink/50">
              🔥 Sequência: dias seguidos com pelo menos uma refeição
              registrada.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Reward({
  done,
  claimed,
  gems,
  onClaim,
  pending,
}: {
  done: boolean;
  claimed: boolean;
  gems: number;
  onClaim: () => void;
  pending: boolean;
}) {
  if (claimed) {
    return (
      <div className="grid h-14 w-16 place-items-center rounded-2xl bg-mint-50 text-center text-xs font-extrabold text-mint-500">
        ✓<br />
        💎 {gems}
      </div>
    );
  }
  if (done) {
    return (
      <button
        onClick={onClaim}
        disabled={pending}
        className="grid h-14 w-16 animate-pulse place-items-center rounded-2xl bg-sun/50 text-center text-xs font-extrabold disabled:opacity-50"
      >
        🎁
        <span>+{gems} 💎</span>
      </button>
    );
  }
  return (
    <div className="grid h-14 w-16 place-items-center rounded-2xl bg-soft text-center text-xs font-bold text-ink/40">
      🔒
      <span>{gems} 💎</span>
    </div>
  );
}

function Section({
  title,
  hint,
  missions,
  color,
  onClaim,
  pendingKey,
}: {
  title: string;
  hint: string;
  missions: Mission[];
  color: string;
  onClaim: (key: string) => void;
  pendingKey: string | null;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink/70">
          {title}
        </h2>
        <span className="text-xs font-semibold text-ink/40">{hint}</span>
      </div>
      <ul className="space-y-5">
        {missions.map((m) => {
          const done = m.progress >= m.goal;
          return (
            <li key={m.key} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="mb-2 text-lg font-extrabold">{m.title}</div>
                <MissionBar progress={m.progress} goal={m.goal} color={color} />
              </div>
              <Reward
                done={done}
                claimed={m.claimed}
                gems={m.gems}
                onClaim={() => onClaim(m.key)}
                pending={pendingKey === m.key}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MissionBar({
  progress,
  goal,
  color,
}: {
  progress: number;
  goal: number;
  color: string;
}) {
  return (
    <div className="relative">
      <ProgressBar
        value={Math.max(progress, goal * 0.06)}
        max={goal}
        color={color}
        className="h-9"
      />
      <span className="absolute inset-0 grid place-items-center text-sm font-bold text-ink/60">
        {progress} / {goal}
      </span>
    </div>
  );
}
