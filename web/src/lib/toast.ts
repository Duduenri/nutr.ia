import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  emoji: string;
  title: string;
  lines: string[];
}

let current: Toast | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function emit() {
  for (const l of listeners) l();
}

export function showToast(t: Omit<Toast, "id">, ms = 9000) {
  current = { ...t, id: Date.now() };
  clearTimeout(timer);
  timer = setTimeout(hideToast, ms);
  emit();
}

export function hideToast() {
  current = null;
  emit();
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
