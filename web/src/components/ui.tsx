import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "ghost" | "soft" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white active:bg-ink/90 disabled:bg-ink/40",
  ghost: "bg-transparent text-ink/70 active:bg-ink/5",
  soft: "bg-white text-ink border border-slate-200 active:bg-soft",
  danger: "bg-peach-100 text-peach-500 active:bg-peach-100/70",
};

export function Button({
  variant = "primary",
  className = "",
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-bold transition ${VARIANTS[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4 border-2" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-6 w-6 border-[3px]" }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-current border-r-transparent ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl bg-white p-4 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  color = "bg-mint-500",
  className = "h-2",
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`w-full overflow-hidden rounded-full bg-soft ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-2xl bg-soft p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition ${
            value === o.value ? "bg-white shadow-card" : "text-ink/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="pb-safe relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-white px-5 pt-3">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">{title}</h2>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-soft text-lg"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink/70">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-mint-500";

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="rounded-2xl bg-peach-100 px-4 py-3 text-sm font-semibold text-peach-500">
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "–";
  return n.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}
