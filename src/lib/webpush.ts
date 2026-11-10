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
import { aparelhosDaApp, appDoAparelho, enviarAvisoNaApp, type AppNativa, type Bilhete } from "./push-nativo";
import type { StoredPushSubscription } from "@/lib/db";

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
  /** O trabalho a abrir na app do profissional. O navegador ignora-o. */
  negociacaoId?: number;
  /** O pedido a abrir na app de cliente, e que aviso é (S10, 28-10-2026). */
  pedidoId?: number;
  tipo?: string;
}

/**
 * COM A APP, SÓ A APP — 28-10-2026 (d9). Quem tem a CLYON Pro e também ligou
 * os avisos no navegador recebia cada aviso duas vezes. Se o aviso do
 * profissional chegou à app (a Expo aceitou-o em pelo menos um telemóvel), o
 * navegador fica de fora. Se a app falhou toda, o navegador continua a ser o
 * caminho — um aviso repetido é melhor do que nenhum. Os avisos ao cliente
 * não mudam.
 */
export function soAAppRecebe(para: AppNativa, bilhetes: Bilhete[]): boolean {
  return para === "pro" && bilhetes.some((b) => !b.erro);
}

/**
 * Envia uma notificação push a todas as subscrições de um utilizador (por email).
 * Remove automaticamente subscrições expiradas (404/410).
 *
 * Desde 18-10-2026 a mesma tabela guarda também os tokens da app do
 * profissional (ver `push-nativo.ts`). Esses vão pela Expo e não precisam das
 * chaves VAPID: um site sem VAPID continua a avisar a app.
 *
 * DESDE 25-10-2026 DIZ PARA QUE APP É (`para`): «pro» para o que é do
 * profissional, «cliente» para o que é do cliente. Nos telemóveis só toca a
 * app certa, mesmo com as duas no mesmo email; o navegador continua a receber
 * como recebia (ver `push-nativo.ts`).
 *
 * DEVOLVE A QUANTOS APARELHOS CHEGOU — 10-11-2026 (d23). Quem não precisa
 * ignora-o; os avisos à equipa só se dão por enviados com pelo menos um.
 */
export async function sendPushToUser(email: string, payload: PushPayload, para: AppNativa): Promise<number> {
  if (!email) return 0;

  let subs: StoredPushSubscription[];
  let deletePushSubscription: (endpoint: string) => Promise<void>;
  try {
    const db = await import("@/lib/db");
    deletePushSubscription = db.deletePushSubscription;
    subs = await db.getPushSubscriptionsByEmail(email);
  } catch (err) {
    console.error("[webpush] não li as subscrições:", err instanceof Error ? err.message : err);
    return 0;
  }
  if (!subs.length) return 0;

  const daApp = aparelhosDaApp(subs, para);
  const doNavegador = subs.filter((s) => appDoAparelho(s) === "web");

  const bilhetes = daApp.length
    ? await enviarAvisoNaApp(daApp, payload, { para, esquecer: deletePushSubscription })
    : [];
  const naApp = bilhetes.filter((b) => !b.erro).length;
  if (soAAppRecebe(para, bilhetes)) return naApp;
  if (!doNavegador.length || !ensureConfigured()) return naApp;

  const data = JSON.stringify(payload);

  let noNavegador = 0;
  await Promise.all(
    doNavegador.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
        noNavegador++;
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
  return naApp + noNavegador;
}
