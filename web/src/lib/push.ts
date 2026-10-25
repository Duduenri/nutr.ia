import { api } from "./api";

export type PushSupport = "ok" | "ios-browser" | "unsupported";

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupport(): PushSupport {
  const capable =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (isIos() && !isStandalone()) return "ios-browser";
  return capable ? "ok" : "unsupported";
}

export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return { reg, sub: await reg.pushManager.getSubscription() };
}

export async function deviceSubscribed(): Promise<boolean> {
  if (pushSupport() !== "ok" || Notification.permission !== "granted") {
    return false;
  }
  const { sub } = await currentSubscription();
  if (!sub) return false;
  await saveSubscription(sub);
  return true;
}

function saveSubscription(sub: PushSubscription) {
  return api.post("/push/subscribe", {
    ...sub.toJSON(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "As notificações estão bloqueadas. Libere em Ajustes → Notificações → nutri.ia e tente de novo.",
    );
  }
  const { reg, sub: existing } = await currentSubscription();
  const { publicKey } = await api.get<{ publicKey: string }>("/push/key");
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToBytes(publicKey),
    }));
  await saveSubscription(sub);
}

export async function disablePush(): Promise<void> {
  const { sub } = await currentSubscription();
  if (!sub) return;
  await api.del("/push/subscribe", { endpoint: sub.endpoint });
  await sub.unsubscribe();
}
