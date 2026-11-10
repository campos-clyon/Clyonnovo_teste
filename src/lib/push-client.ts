/**
 * src/lib/push-client.ts
 * Helpers do lado do browser para Web Push: registar o service worker,
 * pedir permissão, subscrever/cancelar e sincronizar com o servidor.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

/** Já existe uma subscrição push ativa neste browser? */
export async function isPushEnabled(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Para onde vai a subscrição. Por omissão, a rota do cliente e do profissional
 * (pela sessão do cookie); o backoffice manda-a à dele, com o token (d23).
 */
export type DestinoDaSubscricao = { rota: string; cabecalhos?: Record<string, string> };
const DESTINO_DE_SEMPRE: DestinoDaSubscricao = { rota: "/api/push/subscribe" };

/** Ativa as notificações do navegador. Devolve true se ficou subscrito. */
export async function enablePush(destino: DestinoDaSubscricao = DESTINO_DE_SEMPRE): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // cast: a lib DOM tipa o buffer como ArrayBufferLike (inclui SharedArrayBuffer),
      // mas em runtime é sempre um ArrayBuffer normal.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const res = await fetch(destino.rota, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(destino.cabecalhos ?? {}) },
    body: JSON.stringify({ accao: "ligar", subscription: sub.toJSON() }),
  });
  return res.ok;
}

/** Desativa as notificações do navegador neste dispositivo. */
export async function disablePush(destino?: DestinoDaSubscricao): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await fetch(destino?.rota ?? "/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(destino?.cabecalhos ?? {}) },
    body: JSON.stringify({ accao: "desligar", endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
