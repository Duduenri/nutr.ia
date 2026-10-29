import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ExerciseEquivalent } from "../components/ExerciseEquivalent";
import {
  Button,
  ErrorText,
  Field,
  fmt,
  inputClass,
  Sheet,
  Spinner,
} from "../components/ui";
import {
  api,
  foodToItem,
  guessMeal,
  MEAL_EMOJI,
  MEAL_LABEL,
  scaleItem,
  type EntrySource,
  type Food,
  type FoodAnalysis,
  type FoodItem,
  type MealType,
} from "../lib/api";
import { today } from "../lib/date";
import { useInvalidateDay } from "../lib/hooks";
import { shrinkImage } from "../lib/image";
import { getRecognizer, type Recognizer } from "../lib/speech";

interface CartItem extends FoodItem {
  key: string;
  source: EntrySource;
  photoId?: string;
}

type Tab = "meal" | "barcode" | "search" | "recent" | "favorites" | "manual";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "meal", label: "Foto e texto", icon: "📷" },
  { id: "barcode", label: "Código de barras", icon: "🏷️" },
  { id: "search", label: "Buscar", icon: "🔍" },
  { id: "recent", label: "Recentes", icon: "🕘" },
  { id: "favorites", label: "Favoritas", icon: "⭐" },
  { id: "manual", label: "Manual", icon: "✏️" },
];

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export function AddFoodPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const date = params.get("date") ?? today();
  const [meal, setMeal] = useState<MealType>(
    (params.get("meal") as MealType | null) ?? guessMeal(),
  );
  const [tab, setTab] = useState<Tab>("meal");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);

  const addItems = (items: FoodItem[], source: EntrySource, photoId?: string) =>
    setCart((c) => [
      ...c,
      ...items.map((i) => ({ ...i, key: newKey(), source, photoId })),
    ]);

  const onAnalysis = (a: FoodAnalysis, source: EntrySource) => {
    setAnalysis(a);
    if (a.recognized && a.items.length) {
      addItems(a.items, source, a.photoId);
      setReviewOpen(true);
    }
  };

  const totalKcal = cart.reduce((s, i) => s + i.kcal, 0);

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-32">
      <header className="pt-safe sticky top-0 z-30 bg-mint-100 px-4 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl"
            aria-label="Voltar"
          >
            ‹
          </button>
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as MealType)}
            className="flex-1 rounded-full bg-white px-4 py-2 text-lg font-extrabold outline-none"
          >
            {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-sm font-bold ${
                tab === t.id ? "bg-ink text-white" : "bg-white text-ink/70"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="space-y-4 px-4 pt-4">
        {analysis && !analysis.recognized && (
          <p className="rounded-2xl bg-sun/40 px-4 py-3 font-semibold">
            Não reconheci comida aqui. Tenta outra foto ou descreve em texto 🙂
          </p>
        )}
        {tab === "meal" && <MealTab onResult={onAnalysis} />}
        {tab === "barcode" && (
          <BarcodeTab onAdd={(item) => addItems([item], "BARCODE")} />
        )}
        {tab === "search" && (
          <SearchTab onAdd={(item, source) => addItems([item], source)} />
        )}
        {tab === "favorites" && (
          <FavoritesTab onAdd={(items) => addItems(items, "FAVORITE")} />
        )}
        {tab === "manual" && (
          <ManualForm onAdd={(item) => addItems([item], "MANUAL")} />
        )}
        {tab === "recent" && (
          <RecentTab onAdd={(item) => addItems([item], "SEARCH")} />
        )}
      </main>

      {cart.length > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-40 bg-white/95 px-4 pt-3 shadow-[0_-4px_20px_rgba(36,50,74,0.08)] backdrop-blur">
          <Button
            className="mx-auto flex w-full max-w-lg"
            onClick={() => setReviewOpen(true)}
          >
            Revisar {cart.length} {cart.length === 1 ? "item" : "itens"} ·{" "}
            {fmt(totalKcal)} kcal
          </Button>
        </div>
      )}

      <ReviewSheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        cart={cart}
        setCart={setCart}
        meal={meal}
        setMeal={setMeal}
        date={date}
        analysis={analysis}
        onSaved={() =>
          navigate(`/${date === today() ? "" : `?d=${date}`}`, {
            replace: true,
          })
        }
      />
    </div>
  );
}

function DictateButton({
  value,
  onChange,
  onUsed,
}: {
  value: string;
  onChange: (v: string) => void;
  onUsed: () => void;
}) {
  const Ctor = getRecognizer();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognizer | null>(null);

  useEffect(() => () => recRef.current?.stop(), []);

  if (!Ctor) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const base = value.trim() ? `${value.trim()} ` : "";
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) {
        spoken += e.results[i][0].transcript;
      }
      onChange(base + spoken);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        setError("Permita o microfone nas configurações do navegador.");
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(null);
    rec.start();
    setListening(true);
    onUsed();
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className={`absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full text-xl ${
          listening
            ? "animate-pulse bg-peach-500 text-white"
            : "bg-ink text-white"
        }`}
        aria-label={listening ? "Parar ditado" : "Ditar"}
      >
        {listening ? "■" : "🎤"}
      </button>
      {error && <ErrorText error={error} />}
    </>
  );
}

function MealTab({
  onResult,
}: {
  onResult: (a: FoodAnalysis, source: EntrySource) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const clearPhoto = () => {
    setFile(null);
    setPreview(null);
  };

  const analyze = useMutation({
    mutationFn: async () => {
      const text = description.trim();
      if (!file) {
        return api.post<FoodAnalysis>("/ai/text", { text });
      }
      const form = new FormData();
      form.append("image", await shrinkImage(file), "refeicao.jpg");
      if (text) form.append("description", text);
      return api.post<FoodAnalysis>("/ai/photo", form);
    },
    onSuccess: (a) => {
      onResult(a, file ? "PHOTO" : usedVoice ? "VOICE" : "TEXT");
      if (a.recognized) {
        clearPhoto();
        setDescription("");
        setUsedVoice(false);
      }
    },
  });

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    analyze.reset();
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const canAnalyze = Boolean(file) || description.trim().length >= 2;

  return (
    <div className="space-y-4">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={pick}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pick}
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-3xl">
          <img
            src={preview}
            alt="Prévia"
            className="max-h-80 w-full object-cover"
          />
          {analyze.isPending ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/50 font-bold text-white">
              <Spinner className="h-10 w-10 border-4" />
              Analisando seu prato...
            </div>
          ) : (
            <button
              onClick={clearPhoto}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-ink/70 text-white"
              aria-label="Remover foto"
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-1 rounded-3xl bg-ink py-5 font-bold text-white"
          >
            <span className="text-3xl">📷</span>
            Tirar foto
          </button>
          <button
            onClick={() => galleryRef.current?.click()}
            className="flex flex-col items-center gap-1 rounded-3xl bg-white py-5 font-bold shadow-card"
          >
            <span className="text-3xl">🖼️</span>
            Da galeria
          </button>
        </div>
      )}

      <Field
        label={
          preview
            ? "Descreva o que comeu (quantidades deixam bem mais preciso)"
            : "Ou descreva o que comeu (com ou sem foto)"
        }
      >
        <div className="relative">
          <textarea
            className={`${inputClass} min-h-32 pb-14`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: massa folhada com frango e queijo feita na air fryer. 100 g de massa folhada e 1 fatia de queijo"
            disabled={analyze.isPending}
          />
          <DictateButton
            value={description}
            onChange={setDescription}
            onUsed={() => setUsedVoice(true)}
          />
        </div>
      </Field>
      <p className="-mt-2 text-xs text-ink/50">
        O que você informar (gramas, fatias, unidades, air fryer…) a IA usa
        exatamente; o resto ela estima pela foto.
      </p>

      <ErrorText error={analyze.error} />
      <Button
        className="w-full"
        loading={analyze.isPending}
        disabled={!canAnalyze}
        onClick={() => analyze.mutate()}
      >
        {analyze.isPending ? "Calculando..." : "Calcular com IA"}
      </Button>
    </div>
  );
}

function PortionSheet({
  food,
  onClose,
  onAdd,
}: {
  food: Food | null;
  onClose: () => void;
  onAdd: (item: FoodItem) => void;
}) {
  const [grams, setGrams] = useState("100");
  const [lastId, setLastId] = useState<string | null>(null);
  if (food && food.id !== lastId) {
    setLastId(food.id);
    setGrams(String(food.servingG ?? 100));
  }
  const g = parseFloat(grams.replace(",", ".")) || 0;
  const item = food ? foodToItem(food, g) : null;
  const chips = [
    ...new Set(
      [food?.servingG, 50, 100, 150, 200].filter((v): v is number =>
        Boolean(v),
      ),
    ),
  ];

  return (
    <Sheet open={Boolean(food)} onClose={onClose} title={food?.name}>
      {food && item && (
        <div className="space-y-4 pb-4">
          {food.brand && <p className="-mt-3 text-ink/60">{food.brand}</p>}
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            {[
              ["kcal", item.kcal, ""],
              ["Prot.", item.protein, "g"],
              ["Carbo", item.carbs, "g"],
              ["Gord.", item.fat, "g"],
            ].map(([label, value, unit]) => (
              <div key={label as string} className="rounded-2xl bg-soft py-2">
                <div className="font-extrabold">
                  {fmt(value as number)}
                  {unit}
                </div>
                <div className="text-ink/60">{label}</div>
              </div>
            ))}
          </div>
          <Field label="Quantidade (g ou ml)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => setGrams(String(c))}
                className="rounded-full bg-soft px-4 py-2 text-sm font-bold"
              >
                {c} g{c === food.servingG ? " (porção)" : ""}
              </button>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={g <= 0}
            onClick={() => {
              onAdd(item);
              onClose();
            }}
          >
            Adicionar
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function BarcodeTab({ onAdd }: { onAdd: (item: FoodItem) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [food, setFood] = useState<Food | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const lookup = useMutation({
    mutationFn: (c: string) => api.get<Food>(`/foods/barcode/${c}`),
    onSuccess: setFood,
  });

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => controlsRef.current?.stop(), []);

  const found = (text: string) => {
    stop();
    setCode(text);
    lookup.mutate(text);
  };

  const start = async () => {
    setCamError(null);
    lookup.reset();
    setScanning(true);
    try {
      const reader = new BrowserMultiFormatReader();
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result) => {
          if (result) found(result.getText());
        },
      );
    } catch {
      setScanning(false);
      setCamError(
        'Não consegui abrir a câmera. Use "foto do código" ou digite os números.',
      );
    }
  };

  const fromPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(
        url,
      );
      found(result.getText());
    } catch {
      setCamError(
        "Não achei código de barras na foto. Tente mais de perto e com boa luz.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-ink">
        <video
          ref={videoRef}
          className={`aspect-[4/3] w-full object-cover ${scanning ? "" : "hidden"}`}
          muted
          playsInline
        />
        {scanning ? (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-peach-500 shadow-[0_0_12px_#e8693a]" />
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-white">
            <span className="text-6xl">🏷️</span>
            <span className="font-semibold text-white/70">
              Escaneie o código de barras
            </span>
          </div>
        )}
      </div>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={fromPhoto}
      />
      <div className="grid grid-cols-2 gap-3">
        {scanning ? (
          <Button variant="soft" onClick={stop}>
            Parar
          </Button>
        ) : (
          <Button onClick={() => void start()}>Escanear</Button>
        )}
        <Button variant="soft" onClick={() => photoRef.current?.click()}>
          Foto do código
        </Button>
      </div>
      <ErrorText error={camError} />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) lookup.mutate(code.trim());
        }}
      >
        <input
          className={inputClass}
          inputMode="numeric"
          placeholder="Ou digite os números"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <Button className="shrink-0" loading={lookup.isPending}>
          Buscar
        </Button>
      </form>
      <ErrorText error={lookup.error} />
      <PortionSheet food={food} onClose={() => setFood(null)} onAdd={onAdd} />
    </div>
  );
}

function SearchTab({
  onAdd,
}: {
  onAdd: (item: FoodItem, source: EntrySource) => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [food, setFood] = useState<Food | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["foods", debounced],
    queryFn: () =>
      api.get<Food[]>(`/foods/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
  });

  return (
    <div className="space-y-3">
      <input
        className={inputClass}
        placeholder="Buscar alimento (tabela TACO)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {isFetching && (
        <div className="text-center text-mint-500">
          <Spinner />
        </div>
      )}
      <ul className="space-y-2">
        {data?.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => setFood(f)}
              className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left shadow-card"
            >
              <span className="min-w-0">
                <span className="block font-bold">{f.name}</span>
                <span className="text-xs text-ink/50">
                  {f.category ?? f.brand ?? ""} · P {fmt(f.per100g.protein, 1)}{" "}
                  · C {fmt(f.per100g.carbs, 1)} · G {fmt(f.per100g.fat, 1)}
                </span>
              </span>
              <span className="shrink-0 pl-2 text-right">
                <span className="block font-extrabold">
                  {fmt(f.per100g.kcal)}
                </span>
                <span className="text-xs text-ink/50">kcal/100g</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {debounced.length >= 2 && data?.length === 0 && !isFetching && (
        <p className="text-center text-ink/60">
          Nada encontrado. Tente a aba 📷 Foto e texto que a IA calcula pra
          você.
        </p>
      )}
      <Button
        variant="soft"
        className="w-full"
        onClick={() => setManualOpen(true)}
      >
        Adicionar manualmente
      </Button>
      <PortionSheet
        food={food}
        onClose={() => setFood(null)}
        onAdd={(i) => onAdd(i, "SEARCH")}
      />
      <ManualSheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onAdd={(i) => onAdd(i, "MANUAL")}
      />
    </div>
  );
}

function ManualSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (item: FoodItem) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Adicionar manualmente">
      <div className="pb-4">
        <ManualForm
          onAdd={(item) => {
            onAdd(item);
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
}

const EMPTY_MANUAL = {
  name: "",
  grams: "100",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
};

function ManualForm({ onAdd }: { onAdd: (item: FoodItem) => void }) {
  const [f, setF] = useState(EMPTY_MANUAL);
  const n = (v: string) => parseFloat(v.replace(",", ".")) || 0;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  const num = (k: keyof typeof f, label: string, placeholder = "0") => (
    <Field label={label}>
      <input
        className={inputClass}
        inputMode="decimal"
        placeholder={placeholder}
        value={f[k]}
        onChange={set(k)}
      />
    </Field>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/60">
        Já sabe os valores (rótulo, app, nutricionista)? Preencha da porção que
        você comeu.
      </p>
      <Field label="Nome">
        <input
          className={inputClass}
          value={f.name}
          placeholder="Ex.: barrinha de proteína"
          onChange={set("name")}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {num("grams", "Quantidade (g ou ml)", "100")}
        {num("kcal", "Calorias (kcal)")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {num("protein", "Proteína (g)")}
        {num("carbs", "Carboidrato (g)")}
        {num("fat", "Gordura (g)")}
        {num("fiber", "Fibra (g)")}
      </div>
      <Button
        className="w-full"
        disabled={!f.name.trim() || !f.kcal.trim()}
        onClick={() => {
          onAdd({
            name: f.name.trim(),
            grams: n(f.grams),
            kcal: n(f.kcal),
            protein: n(f.protein),
            carbs: n(f.carbs),
            fat: n(f.fat),
            fiber: f.fiber.trim() ? n(f.fiber) : null,
          });
          setF(EMPTY_MANUAL);
        }}
      >
        Adicionar
      </Button>
    </div>
  );
}

interface SavedMeal {
  id: string;
  name: string;
  meal: MealType | null;
  items: FoodItem[];
  kcal: number;
  protein: number;
}

function FavoritesTab({ onAdd }: { onAdd: (items: FoodItem[]) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["saved-meals"],
    queryFn: () => api.get<SavedMeal[]>("/saved-meals"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/saved-meals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-meals"] }),
  });

  if (isLoading) return <Spinner />;
  if (!data?.length) {
    return (
      <p className="rounded-2xl bg-white p-4 text-center text-sm text-ink/60 shadow-card">
        Nenhuma favorita ainda. No Diário, abra uma refeição que você repete
        sempre (ex.: seu café da manhã) e toque em{" "}
        <b>⭐ Salvar como favorita</b>. Depois é só um toque aqui.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {data.map((f) => (
        <li
          key={f.id}
          className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-card"
        >
          <button
            onClick={() => onAdd(f.items)}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block font-bold">
              ⭐ {f.name}
              {f.meal && (
                <span className="text-xs font-semibold text-ink/40">
                  {" "}
                  · {MEAL_EMOJI[f.meal]}
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-ink/50">
              {f.items.map((i) => i.name).join(", ")}
            </span>
            <span className="text-xs font-bold text-ink/60">
              {fmt(f.kcal)} kcal · P {fmt(f.protein)} g
            </span>
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Apagar a favorita "${f.name}"?`))
                remove.mutate(f.id);
            }}
            className="p-2 text-ink/30"
            aria-label="Apagar favorita"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

function RecentTab({ onAdd }: { onAdd: (item: FoodItem) => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const { data, isLoading } = useQuery({
    queryKey: ["recent", debounced],
    queryFn: () =>
      api.get<FoodItem[]>(
        `/foods/recent${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`,
      ),
  });
  const [added, setAdded] = useState<Set<string>>(new Set());

  const search = (
    <input
      className={inputClass}
      placeholder="Pesquisar nos seus registros (ex.: pão, frango)"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
    />
  );
  if (isLoading) {
    return (
      <div className="space-y-3">
        {search}
        <div className="text-center text-mint-500">
          <Spinner />
        </div>
      </div>
    );
  }
  if (!data?.length) {
    return (
      <div className="space-y-3">
        {search}
        <p className="text-center text-ink/60">
          {debounced
            ? `Nada com “${debounced}” nos seus registros. Tente a aba Buscar.`
            : "Seus alimentos registrados aparecem aqui pra adicionar rapidinho."}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {search}
      <ul className="space-y-2">
        {data.map((item, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{item.name}</span>
              <span className="text-xs text-ink/50">
                {fmt(item.grams)} g · {fmt(item.kcal)} kcal
              </span>
            </span>
            <button
              onClick={() => {
                onAdd(item);
                setAdded((s) => new Set(s).add(`${i}:${item.name}`));
              }}
              className={`grid h-10 w-10 place-items-center rounded-full text-xl ${added.has(`${i}:${item.name}`) ? "bg-mint-500 text-white" : "bg-ink text-white"}`}
              aria-label="Adicionar"
            >
              {added.has(`${i}:${item.name}`) ? "✓" : "+"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewSheet({
  open,
  onClose,
  cart,
  setCart,
  meal,
  setMeal,
  date,
  analysis,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  meal: MealType;
  setMeal: (m: MealType) => void;
  date: string;
  analysis: FoodAnalysis | null;
  onSaved: () => void;
}) {
  const invalidate = useInvalidateDay();
  const totals = cart.reduce(
    (t, i) => ({
      kcal: t.kcal + i.kcal,
      protein: t.protein + i.protein,
      carbs: t.carbs + i.carbs,
      fat: t.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const save = useMutation({
    mutationFn: async () => {
      const groups = new Map<string, CartItem[]>();
      for (const item of cart) {
        const k = `${item.source}|${item.photoId ?? ""}`;
        groups.set(k, [...(groups.get(k) ?? []), item]);
      }
      for (const items of groups.values()) {
        await api.post("/entries", {
          date,
          meal,
          source: items[0].source,
          photoId: items[0].photoId,
          items: items.map((item) => ({
            name: item.name,
            grams: item.grams,
            kcal: item.kcal,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber ?? undefined,
            micros: item.micros ?? undefined,
            foodId: item.foodId ?? undefined,
          })),
        });
      }
    },
    onSuccess: () => {
      invalidate();
      onSaved();
    },
  });

  const update = (key: string, patch: (i: CartItem) => CartItem) =>
    setCart((c) => c.map((i) => (i.key === key ? patch(i) : i)));

  const photoUrl =
    analysis?.photoUrl && cart.some((i) => i.photoId === analysis.photoId)
      ? analysis.photoUrl
      : null;

  return (
    <Sheet
      open={open && cart.length > 0}
      onClose={onClose}
      title="Revisar refeição"
    >
      <div className="space-y-4 pb-4">
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            className="max-h-48 w-full rounded-3xl object-cover"
          />
        )}
        {analysis?.comment &&
          cart.some(
            (i) =>
              i.source !== "BARCODE" &&
              i.source !== "SEARCH" &&
              i.source !== "MANUAL",
          ) && (
            <p className="rounded-2xl bg-mint-50 px-4 py-3 text-sm">
              🤖 {analysis.comment}
              {analysis.confidence !== "alta" && (
                <span className="block pt-1 text-ink/60">
                  Confiança{" "}
                  {analysis.confidence === "media" ? "média" : "baixa"} —
                  confira as quantidades.
                </span>
              )}
            </p>
          )}
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          {[
            ["kcal", totals.kcal, ""],
            ["Prot.", totals.protein, "g"],
            ["Carbo", totals.carbs, "g"],
            ["Gord.", totals.fat, "g"],
          ].map(([label, value, unit]) => (
            <div key={label as string} className="rounded-2xl bg-soft py-2">
              <div className="text-lg font-extrabold">
                {fmt(value as number)}
                {unit}
              </div>
              <div className="text-ink/60">{label}</div>
            </div>
          ))}
        </div>
        <ExerciseEquivalent kcal={totals.kcal} />
        <ul className="space-y-2">
          {cart.map((item) => (
            <li
              key={item.key}
              className="rounded-2xl border border-slate-100 p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 bg-transparent font-bold outline-none"
                  value={item.name}
                  onChange={(e) =>
                    update(item.key, (i) => ({ ...i, name: e.target.value }))
                  }
                />
                <button
                  onClick={() =>
                    setCart((c) => c.filter((i) => i.key !== item.key))
                  }
                  className="text-ink/40"
                  aria-label="Remover"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <GramsInput
                  grams={item.grams}
                  onChange={(g) =>
                    update(item.key, (i) => ({
                      ...scaleItem(i, g),
                      key: i.key,
                      source: i.source,
                      photoId: i.photoId,
                    }))
                  }
                />
                <span className="flex-1 text-xs text-ink/60">
                  P {fmt(item.protein)} · C {fmt(item.carbs)} · G{" "}
                  {fmt(item.fat)}
                </span>
                <span className="font-extrabold">{fmt(item.kcal)} kcal</span>
              </div>
            </li>
          ))}
        </ul>
        <Field label="Refeição">
          <select
            className={inputClass}
            value={meal}
            onChange={(e) => setMeal(e.target.value as MealType)}
          >
            {(Object.keys(MEAL_LABEL) as MealType[]).map((m) => (
              <option key={m} value={m}>
                {MEAL_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
        <ErrorText error={save.error} />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="soft" onClick={onClose}>
            Adicionar mais
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Salvar no diário
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function GramsInput({
  grams,
  onChange,
}: {
  grams: number;
  onChange: (g: number) => void;
}) {
  const [value, setValue] = useState(String(Math.round(grams)));
  const [prev, setPrev] = useState(grams);
  if (grams !== prev) {
    setPrev(grams);
    setValue(String(Math.round(grams)));
  }
  return (
    <label className="flex items-center gap-1 rounded-xl bg-soft px-2 py-1">
      <input
        className="w-14 bg-transparent text-right font-bold outline-none"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const g = parseFloat(value.replace(",", "."));
          if (g > 0 && g !== grams) onChange(g);
          else setValue(String(Math.round(grams)));
        }}
      />
      <span className="text-sm text-ink/60">g</span>
    </label>
  );
}
