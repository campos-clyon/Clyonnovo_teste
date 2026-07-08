/**
 * src/lib/webpush.ts
 * Envio de notificações Web Push (VAPID). Configura-se de forma preguiçosa a
 * partir das variáveis de ambiente e nunca lança — falha silenciosa com log,
 * para nunca bloquear o fluxo que a chama (ex: mudança de estado do pedido).
 *
 * Variáveis:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — chave pública VAPID (exposta ao browser)
 *   VAPID_PRIVATE_KEY             — chave privada VAPID (secreta)
 *   VAPID_SUBJECT                 — mailto:... ou URL de contacto
 */

import webpush from "web-push";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:geral@clyon.pt";
  if (!publicKey || !privateKey) {
    console.warn("[webpush] Chaves VAPID não configuradas — push não enviado.");
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envia uma notificação push a todas as subscrições de um utilizador (por email).
 * Remove automaticamente subscrições expiradas (404/410).
 */
export async function sendPushToUser(email: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  if (!email) return;

  const { getPushSubscriptionsByEmail, deletePushSubscription } = await import("@/lib/db");
  const subs = await getPushSubscriptionsByEmail(email);
  if (!subs.length) return;

  const data = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          // Subscrição expirada/removida no browser — limpar.
          await deletePushSubscription(s.endpoint).catch(() => {});
        } else {
          console.error("[webpush] falha ao enviar push:", code ?? err?.message ?? err);
        }
      }
    }),
  );
}
