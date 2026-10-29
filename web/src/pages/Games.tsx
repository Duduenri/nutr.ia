import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, ErrorText, Spinner } from "../components/ui";
import { api } from "../lib/api";

type Level = "easy" | "medium" | "hard";
type LetterResult = "correct" | "present" | "absent";

interface GamesOverview {
  day: string;
  termo: { finished: boolean; won: boolean; tries: number; reward: number };
  sudoku: Record<Level, { done: boolean; gems: number }>;
  gemsToday: number;
}

interface TermoView {
  day: string;
  maxTries: number;
  rows: { word: string; letters: string[]; result: LetterResult[] }[];
  finished: boolean;
  won: boolean;
  reward: number;
  answer: string | null;
  gems: number[];
}

interface SudokuView {
  day: string;
  level: Level;
  puzzle: number[];
  done: boolean;
  gems: number;
}

const LEVEL_LABEL: Record<Level, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

function GameHeader({
  title,
  back = "/jogos",
}: {
  title: string;
  back?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className="pt-safe flex items-center gap-3 bg-[#efeaff] px-4 pb-4">
      <button
        onClick={() => navigate(back)}
        className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl"
        aria-label="Voltar"
      >
        ‹
      </button>
      <h1 className="text-2xl font-extrabold">{title}</h1>
    </header>
  );
}

export function GamesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["games"],
    queryFn: () => api.get<GamesOverview>("/games"),
  });
  return (
    <div>
      <GameHeader title="Jogos 🎮" back="/bichinho" />
      <div className="space-y-4 px-4 pt-4">
        <p className="text-sm text-ink/60">
          Sem anúncio 😉 Um desafio novo de cada por dia, valendo gemas pro seu
          bichinho.
          {data && data.gemsToday > 0 && (
            <b> Hoje você já ganhou {data.gemsToday} 💎.</b>
          )}
        </p>
        {isLoading && <Spinner />}
        {data && (
          <>
            <Link
              to="/jogos/termo"
              className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-card"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mint-500 text-2xl font-extrabold text-white">
                T
              </span>
              <span className="flex-1">
                <span className="block text-lg font-extrabold">Termo</span>
                <span className="text-sm text-ink/60">
                  {data.termo.finished
                    ? data.termo.won
                      ? `✓ Acertou em ${data.termo.tries} · +${data.termo.reward} 💎`
                      : "Não foi dessa vez. Volte amanhã!"
                    : data.termo.tries
                      ? `${data.termo.tries}/6 tentativas`
                      : "Descubra a palavra do dia · até 60 💎"}
                </span>
              </span>
              <span className="text-2xl text-ink/30">›</span>
            </Link>
            <div className="rounded-3xl bg-white p-4 shadow-card">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#6b5bd6] text-2xl text-white">
                  #
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-extrabold">Sudoku</span>
                  <span className="text-sm text-ink/60">
                    Um por dia em cada nível
                  </span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                  <Link
                    key={l}
                    to={`/jogos/sudoku?nivel=${l}`}
                    className={`rounded-2xl px-2 py-3 text-center ${
                      data.sudoku[l].done ? "bg-mint-50" : "bg-soft"
                    }`}
                  >
                    <span className="block font-extrabold">
                      {LEVEL_LABEL[l]}
                    </span>
                    <span className="text-xs font-bold text-ink/60">
                      {data.sudoku[l].done
                        ? "✓ Feito"
                        : `${data.sudoku[l].gems} 💎`}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const TILE: Record<LetterResult, string> = {
  correct: "bg-mint-500 text-white border-mint-500",
  present: "bg-[#f2c14e] text-white border-[#f2c14e]",
  absent: "bg-ink/40 text-white border-transparent",
};

export function TermoPage() {
  const qc = useQueryClient();
  const [current, setCurrent] = useState("");
  const [shake, setShake] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["termo"],
    queryFn: () => api.get<TermoView>("/games/termo"),
  });
  const guess = useMutation({
    mutationFn: (word: string) =>
      api.post<TermoView>("/games/termo/guess", { guess: word }),
    onSuccess: (view) => {
      qc.setQueryData(["termo"], view);
      setCurrent("");
      void qc.invalidateQueries({ queryKey: ["games"] });
      void qc.invalidateQueries({ queryKey: ["game"] });
    },
    onError: () => {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    },
  });

  const finished = data?.finished ?? false;
  const press = useCallback(
    (key: string) => {
      if (finished || guess.isPending) return;
      if (key === "enter") {
        if (current.length === 5) guess.mutate(current);
        return;
      }
      if (key === "back") {
        setCurrent((c) => c.slice(0, -1));
        guess.reset();
        return;
      }
      if (/^[a-z]$/.test(key)) {
        setCurrent((c) => (c.length < 5 ? c + key : c));
        guess.reset();
      }
    },
    [current, finished, guess],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") press("enter");
      else if (e.key === "Backspace") press("back");
      else press(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  if (isLoading || !data) {
    return (
      <div>
        <GameHeader title="Termo" />
        <Spinner />
      </div>
    );
  }

  const keyState: Record<string, LetterResult> = {};
  const rank = { absent: 0, present: 1, correct: 2 };
  for (const r of data.rows) {
    r.letters.forEach((l, i) => {
      const prev = keyState[l];
      if (!prev || rank[r.result[i]] > rank[prev]) keyState[l] = r.result[i];
    });
  }

  const rows = Array.from({ length: data.maxTries }, (_, i) => {
    if (i < data.rows.length) return { kind: "done" as const, ...data.rows[i] };
    if (i === data.rows.length && !finished)
      return { kind: "current" as const, letters: current.split("") };
    return { kind: "empty" as const, letters: [] as string[] };
  });

  return (
    <div className="pb-6">
      <GameHeader title="Termo" />
      <div className="mx-auto max-w-[17rem] space-y-1.5 px-2 pt-3">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`grid grid-cols-5 gap-1.5 ${r.kind === "current" && shake ? "animate-bounce" : ""}`}
          >
            {Array.from({ length: 5 }, (_, j) => {
              const letter = r.letters[j] ?? "";
              const cls =
                r.kind === "done"
                  ? TILE[r.result[j]]
                  : letter
                    ? "border-ink/60 bg-white"
                    : "border-slate-200 bg-white";
              return (
                <div
                  key={j}
                  className={`grid aspect-square place-items-center rounded-xl border-2 text-2xl font-extrabold uppercase ${cls}`}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-sm px-4 pt-3 text-center">
        <ErrorText error={guess.error} />
        {finished && (
          <div className="rounded-3xl bg-white p-4 shadow-card">
            {data.won ? (
              <>
                <p className="text-2xl">🎉</p>
                <p className="font-extrabold">
                  Acertou em {data.rows.length}!{" "}
                  <span className="text-mint-500">+{data.reward} 💎</span>
                </p>
              </>
            ) : (
              <p className="font-extrabold">
                A palavra era <span className="uppercase">{data.answer}</span>
              </p>
            )}
            <p className="mt-1 text-sm text-ink/60">
              Volte amanhã pra uma palavra nova.
            </p>
          </div>
        )}
        {!finished && data.rows.length === 0 && (
          <p className="text-xs text-ink/50">
            Verde: letra no lugar certo · Amarelo: está na palavra em outro
            lugar · Cinza: não tem. Acentos não importam. Prêmio:{" "}
            {data.gems.join(" / ")} 💎 conforme a tentativa.
          </p>
        )}
      </div>
      <div className="mx-auto mt-4 max-w-md space-y-1.5 px-2">
        {KEYS.map((row, i) => (
          <div key={row} className="flex justify-center gap-1">
            {i === 2 && (
              <button
                onClick={() => press("back")}
                className="h-12 rounded-lg bg-soft px-2 text-lg font-bold"
                aria-label="Apagar"
              >
                ⌫
              </button>
            )}
            {row.split("").map((k) => (
              <button
                key={k}
                onClick={() => press(k)}
                className={`h-12 min-w-0 flex-1 rounded-lg text-lg font-extrabold uppercase ${
                  keyState[k] ? TILE[keyState[k]] : "bg-soft"
                }`}
              >
                {k}
              </button>
            ))}
            {i === 2 && (
              <button
                onClick={() => press("enter")}
                disabled={current.length !== 5 || guess.isPending}
                className="h-12 rounded-lg bg-ink px-3 text-sm font-extrabold text-white disabled:bg-ink/40"
              >
                {guess.isPending ? "…" : "ENTER"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function conflicts(grid: number[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (!v) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    for (let j = 0; j < 81; j++) {
      if (j === i || grid[j] !== v) continue;
      const r2 = Math.floor(j / 9);
      const c2 = j % 9;
      const sameBox =
        Math.floor(r / 3) === Math.floor(r2 / 3) &&
        Math.floor(c / 3) === Math.floor(c2 / 3);
      if (r === r2 || c === c2 || sameBox) bad.add(i);
    }
  }
  return bad;
}

function storageKey(day: string, level: Level) {
  return `sudoku:${day}:${level}`;
}

interface SudokuSave {
  grid: number[];
  notes: number[][];
}

function loadSave(day: string, level: Level, puzzle: number[]): SudokuSave {
  const fresh = {
    grid: [...puzzle],
    notes: Array.from({ length: 81 }, () => [] as number[]),
  };
  try {
    const raw = localStorage.getItem(storageKey(day, level));
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as number[] | SudokuSave;
    if (Array.isArray(saved)) {
      return saved.length === 81 ? { ...fresh, grid: saved } : fresh;
    }
    return saved.grid?.length === 81 && saved.notes?.length === 81
      ? saved
      : fresh;
  } catch {
    return fresh;
  }
}

function peers(i: number): number[] {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const out: number[] = [];
  for (let j = 0; j < 81; j++) {
    const r2 = Math.floor(j / 9);
    const c2 = j % 9;
    if (
      j !== i &&
      (r === r2 ||
        c === c2 ||
        (Math.floor(r / 3) === Math.floor(r2 / 3) &&
          Math.floor(c / 3) === Math.floor(c2 / 3)))
    )
      out.push(j);
  }
  return out;
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* armazenamento indisponível */
  }
}

export function SudokuPage() {
  const level = (new URLSearchParams(window.location.search).get("nivel") ??
    "easy") as Level;
  const { data, isLoading } = useQuery({
    queryKey: ["sudoku", level],
    queryFn: () => api.get<SudokuView>(`/games/sudoku?level=${level}`),
  });
  if (isLoading || !data) {
    return (
      <div>
        <GameHeader title={`Sudoku ${LEVEL_LABEL[level] ?? ""}`} />
        <Spinner />
      </div>
    );
  }
  return <SudokuBoard key={`${data.day}:${level}`} view={data} />;
}

function SudokuBoard({ view }: { view: SudokuView }) {
  const qc = useQueryClient();
  const [save, setSave] = useState(() =>
    loadSave(view.day, view.level, view.puzzle),
  );
  const { grid, notes } = save;
  const [sel, setSel] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const [checkErrors, setCheckErrors] = useState(() =>
    readFlag("sudoku:checkErrors"),
  );
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [result, setResult] = useState<{
    solved: boolean;
    reward: number;
  } | null>(null);
  const bad = conflicts(grid);
  const full = grid.every((v) => v > 0);

  const check = useMutation({
    mutationFn: (g: number[]) =>
      api.post<{ wrong: number[] }>("/games/sudoku/check", {
        level: view.level,
        grid: g,
      }),
    onSuccess: (r, g) => {
      const added = r.wrong.filter((i) => !wrong.has(i) && g[i] > 0).length;
      if (added) setMistakes((m) => m + added);
      setWrong(new Set(r.wrong));
    },
  });
  const submit = useMutation({
    mutationFn: (g: number[]) =>
      api.post<{ solved: boolean; reward: number }>("/games/sudoku/submit", {
        level: view.level,
        grid: g,
      }),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: ["games"] });
      void qc.invalidateQueries({ queryKey: ["game"] });
      void qc.invalidateQueries({ queryKey: ["sudoku", view.level] });
    },
  });

  const persist = (next: SudokuSave) => {
    setSave(next);
    try {
      localStorage.setItem(
        storageKey(view.day, view.level),
        JSON.stringify(next),
      );
    } catch {
      /* armazenamento indisponível */
    }
  };

  const put = (n: number) => {
    if (sel === null || view.puzzle[sel] !== 0 || view.done) return;
    if (pencil && n > 0) {
      if (grid[sel]) return;
      const cur = notes[sel];
      const toggled = cur.includes(n)
        ? cur.filter((x) => x !== n)
        : [...cur, n].sort();
      persist({ grid, notes: notes.map((x, i) => (i === sel ? toggled : x)) });
      return;
    }
    const nextGrid = grid.map((v, i) => (i === sel ? n : v));
    const clear = new Set(n ? peers(sel) : []);
    const nextNotes = notes.map((x, i) =>
      i === sel ? [] : clear.has(i) ? x.filter((d) => d !== n) : x,
    );
    persist({ grid: nextGrid, notes: nextNotes });
    setResult(null);
    if (checkErrors) check.mutate(nextGrid);
    if (nextGrid.every((v) => v > 0) && conflicts(nextGrid).size === 0) {
      submit.mutate(nextGrid);
    }
  };

  const toggleCheck = () => {
    const on = !checkErrors;
    setCheckErrors(on);
    writeFlag("sudoku:checkErrors", on);
    if (on) check.mutate(grid);
    else setWrong(new Set());
  };

  const selVal = sel !== null ? grid[sel] : 0;

  return (
    <div className="pb-6">
      <GameHeader title={`Sudoku ${LEVEL_LABEL[view.level]}`} />
      <div className="mx-auto max-w-sm px-3 pt-3">
        <div className="mb-2 flex items-center justify-between text-xs font-bold">
          <label className="flex items-center gap-2 text-ink/70">
            <input
              type="checkbox"
              className="h-4 w-4 accent-mint-500"
              checked={checkErrors}
              onChange={toggleCheck}
            />
            Avisar quando eu errar
          </label>
          {checkErrors && (
            <span className={mistakes ? "text-peach-500" : "text-ink/40"}>
              Erros: {mistakes}
            </span>
          )}
        </div>
        <div className="grid grid-cols-9 overflow-hidden rounded-xl border-2 border-ink bg-white">
          {grid.map((v, i) => {
            const r = Math.floor(i / 9);
            const c = i % 9;
            const given = view.puzzle[i] !== 0;
            const related =
              sel !== null &&
              (Math.floor(sel / 9) === r ||
                sel % 9 === c ||
                (Math.floor(Math.floor(sel / 9) / 3) === Math.floor(r / 3) &&
                  Math.floor((sel % 9) / 3) === Math.floor(c / 3)));
            const sameNumber = selVal > 0 && v === selVal;
            const isWrong = !given && (wrong.has(i) || bad.has(i));
            return (
              <button
                key={i}
                onClick={() => setSel(i)}
                className={`relative grid aspect-square place-items-center text-lg ${
                  c % 3 === 2 && c < 8
                    ? "border-r-2 border-r-ink"
                    : "border-r border-r-slate-200"
                } ${
                  r % 3 === 2 && r < 8
                    ? "border-b-2 border-b-ink"
                    : "border-b border-b-slate-200"
                } ${
                  sel === i
                    ? "bg-[#d9d2ff]"
                    : isWrong && v
                      ? "bg-peach-100"
                      : sameNumber
                        ? "bg-[#ebe6ff]"
                        : related
                          ? "bg-soft"
                          : ""
                } ${given ? "font-extrabold text-ink" : "font-bold text-[#6b5bd6]"} ${
                  isWrong ? "!text-peach-500" : ""
                }`}
              >
                {v ? (
                  v
                ) : notes[i].length ? (
                  <span className="grid h-full w-full grid-cols-3 p-0.5 text-[9px] font-bold leading-none text-ink/50">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                      <span key={d} className="grid place-items-center">
                        {notes[i].includes(d) ? d : ""}
                      </span>
                    ))}
                  </span>
                ) : (
                  ""
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setPencil((p) => !p)}
            disabled={view.done}
            className={`h-11 rounded-xl text-sm font-extrabold ${
              pencil ? "bg-[#6b5bd6] text-white" : "bg-white shadow-card"
            }`}
          >
            ✏️ Lápis {pencil ? "ligado" : "desligado"}
          </button>
          <button
            onClick={() => put(0)}
            disabled={view.done}
            className="h-11 rounded-xl bg-soft text-sm font-bold"
          >
            ⌫ Apagar
          </button>
        </div>
        <div className="mt-2 grid grid-cols-9 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => put(n)}
              disabled={view.done}
              className={`h-12 rounded-xl text-xl font-extrabold shadow-card active:bg-soft ${
                pencil ? "bg-[#efeaff] text-[#6b5bd6]" : "bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-4 text-center">
          <ErrorText error={submit.error ?? check.error} />
          {(view.done || result?.solved) && (
            <div className="rounded-3xl bg-white p-4 shadow-card">
              <p className="text-2xl">🎉</p>
              <p className="font-extrabold">
                Sudoku resolvido!
                {result?.reward ? (
                  <span className="text-mint-500"> +{result.reward} 💎</span>
                ) : null}
              </p>
              <p className="text-sm text-ink/60">Volte amanhã pra um novo.</p>
            </div>
          )}
          {result && !result.solved && (
            <p className="rounded-2xl bg-peach-100 px-4 py-3 text-sm font-bold text-peach-500">
              Tudo preenchido, mas algum número não bate. Confere de novo!
            </p>
          )}
          {!view.done && !result?.solved && full && bad.size > 0 && (
            <p className="text-sm font-bold text-peach-500">
              Tem número repetido (em vermelho).
            </p>
          )}
          {!view.done && !full && (
            <p className="text-xs text-ink/50">
              {pencil
                ? "Lápis ligado: os números viram anotações pequenas no quadrado."
                : "Toque num quadrado vazio e escolha o número."}{" "}
              Cada linha, coluna e bloco 3×3 tem 1 a 9 sem repetir. Vale{" "}
              {view.gems} 💎.
            </p>
          )}
          {view.done && !result && (
            <Button
              variant="soft"
              className="mt-2"
              onClick={() => setSel(null)}
            >
              Ok
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
