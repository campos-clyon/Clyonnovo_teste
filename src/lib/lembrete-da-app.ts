/**
 * O LEMBRETE DA APP DE CLIENTE — 17-11-2026 (d59).
 *
 * Uma vez só, 3 dias depois do convite, a quem foi convidado e ainda não
 * aderiu (ver «ADERIU» em `seguimento-da-app.ts`): por email e, a quem tem
 * telefone na conta, por WhatsApp. Corre na rotina `/api/cron/lembrete-da-app`.
 *
 * DESLIGADO POR OMISSÃO. Só sai com o interruptor ligado E o texto aprovado
 * em `textos-do-seguimento-da-app.ts` — os textos novos são do Marketing e
 * precisam do sim do dono.
 */

import { LINK_DA_PLAY_STORE } from "./programa-da-app";
import { preencherTexto } from "./seguimento-da-app";
import {
  LEMBRETE_DA_APP_LIGADO,
  LEMBRETE_DA_APP_POR_WHATSAPP_LIGADO,
  TEXTO_DO_LEMBRETE_POR_EMAIL,
  TEXTO_DO_LEMBRETE_POR_WHATSAPP,
} from "./textos-do-seguimento-da-app";

/** Quantos lembretes por passagem (o resto sai na seguinte). */
export const LEMBRETES_POR_PASSAGEM = 20;
const INTERVALO_ENTRE_LEMBRETES_MS = 600;

/** O que está ligado de facto: o interruptor e o texto, os dois. */
export function estadoDoLembrete(): { email: boolean; whatsapp: boolean } {
  const email = LEMBRETE_DA_APP_LIGADO && TEXTO_DO_LEMBRETE_POR_EMAIL !== null;
  const whatsapp = email && LEMBRETE_DA_APP_POR_WHATSAPP_LIGADO && TEXTO_DO_LEMBRETE_POR_WHATSAPP !== null;
  return { email, whatsapp };
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function enviarLembretesDaApp(agora: Date): Promise<{
  ligado: boolean;
  enviados: number;
  porWhatsApp: number;
  falhados: number;
}> {
  const ligado = estadoDoLembrete();
  const textoEmail = TEXTO_DO_LEMBRETE_POR_EMAIL;
  const textoWhats = TEXTO_DO_LEMBRETE_POR_WHATSAPP;
  if (!ligado.email || !textoEmail) return { ligado: false, enviados: 0, porWhatsApp: 0, falhados: 0 };

  const { linkDeAdesaoGuardado } = await import("./convite-app-cliente-na-base");
  const link = await linkDeAdesaoGuardado();
  // Sem o link da Play, o lembrete não leva a lado nenhum: não sai.
  if (!link) return { ligado: true, enviados: 0, porWhatsApp: 0, falhados: 0 };

  const { convidadosParaOLembrete, reservarLembrete, desfazerLembrete, registarCanaisDoLembrete } = await import(
    "./seguimento-da-app-na-base"
  );
  const { enviarEmailDoSeguimento } = await import("./seguimento-da-app-envio");
  const { urlDeAccao } = await import("./url-do-site");
  const valores = { linkDeAdesao: link, linkDaPlayStore: LINK_DA_PLAY_STORE, linkDaConta: `${urlDeAccao()}/conta` };

  let enviados = 0;
  let porWhatsApp = 0;
  let falhados = 0;
  const lista = await convidadosParaOLembrete(agora, LEMBRETES_POR_PASSAGEM);
  for (const [i, c] of lista.entries()) {
    if (i > 0) await espera(INTERVALO_ENTRE_LEMBRETES_MS);
    // Reservar ANTES: uma passagem a correr ao mesmo tempo não envia outra vez.
    if (!(await reservarLembrete(c.email))) continue;
    const canais: string[] = [];
    if (
      await enviarEmailDoSeguimento({
        para: c.email,
        assunto: textoEmail.assunto,
        texto: preencherTexto(textoEmail.texto, valores),
      })
    ) {
      canais.push("email");
    }
    if (ligado.whatsapp && textoWhats && c.telefone) {
      try {
        const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
        if (await enviarAvisoWhatsApp(c.telefone, preencherTexto(textoWhats, valores))) {
          canais.push("whatsapp");
          porWhatsApp++;
        }
      } catch (e) {
        console.error("[lembrete-da-app] WhatsApp:", e instanceof Error ? e.message : e);
      }
    }
    if (canais.length === 0) {
      await desfazerLembrete(c.email);
      falhados++;
    } else {
      await registarCanaisDoLembrete(c.email, canais);
      enviados++;
    }
  }
  return { ligado: true, enviados, porWhatsApp, falhados };
}
