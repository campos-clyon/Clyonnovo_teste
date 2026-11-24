/**
 * O LEMBRETE DA APP DE CLIENTE — 17-11-2026 (d59).
 *
 * Uma vez só, 3 dias depois do convite NOVO, a quem o recebeu e ainda não
 * aderiu (ver «ADERIU» em `seguimento-da-app.ts`): por email e, a quem tem
 * telemóvel na conta, por WhatsApp (pela fila própria, espaçado). Corre na
 * rotina `/api/cron/lembrete-da-app`. Quem só tem o convite antigo de 01-11
 * não recebe lembrete. No máximo: 1 convite novo + 1 lembrete por pessoa.
 *
 * d106 (24-11-2026): os textos v3 (d107, aprovados à letra), com a ligação
 * NOSSA de cada pessoa e os três botões (r=1, r=2, r=3); fica de fora quem
 * está no «não contactar», recusou ou disse que não tem Android, ou tem um
 * pedido cancelado. DESLIGADO desde 24-11-2026: o lembrete ao grupo de 17/11
 * espera pelo advogado (`LEMBRETE_DA_APP_LIGADO` em textos-do-seguimento-da-app.ts).
 */

import { telemovelDoAviso } from "./aviso-aos-profissionais";
import { montarEmailDaApp } from "./email-da-app-de-cliente";
import {
  LEMBRETE_DA_APP_LIGADO,
  LEMBRETE_DA_APP_POR_WHATSAPP_LIGADO,
  MODELO_DO_LEMBRETE_POR_EMAIL,
  TEXTO_DO_LEMBRETE_POR_WHATSAPP,
} from "./textos-do-seguimento-da-app";

/** Quantos lembretes por passagem (o resto sai na seguinte). */
export const LEMBRETES_POR_PASSAGEM = 20;
const INTERVALO_ENTRE_LEMBRETES_MS = 600;

/** O que está ligado de facto: o interruptor e o texto, os dois. */
export function estadoDoLembrete(): { email: boolean; whatsapp: boolean } {
  const email = LEMBRETE_DA_APP_LIGADO;
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
  if (!ligado.email) return { ligado: false, enviados: 0, porWhatsApp: 0, falhados: 0 };

  const { linkDeAdesaoGuardado } = await import("./convite-app-cliente-na-base");
  // Sem o link da Play, a página não leva a lado nenhum: não sai.
  if (!(await linkDeAdesaoGuardado())) return { ligado: true, enviados: 0, porWhatsApp: 0, falhados: 0 };

  const { convidadosParaOLembrete, reservarLembrete, desfazerLembrete, registarCanaisDoLembrete } = await import(
    "./seguimento-da-app-na-base"
  );
  const { enviarEmailDoSeguimento } = await import("./seguimento-da-app-envio");
  const { porWhatsAppDaAppNaFila } = await import("./convite-novo-da-app-na-base");
  const { linkNossoDoConvite } = await import("./percurso-da-app-cliente-na-base");
  const { naoContactarNaApp } = await import("./nao-contactar-na-app");

  let enviados = 0;
  let porWhatsApp = 0;
  let falhados = 0;
  // Lê-se mais do que se envia: quem fica de fora pelo «não contactar» não entope a passagem.
  const lista: Awaited<ReturnType<typeof convidadosParaOLembrete>> = [];
  for (const c of await convidadosParaOLembrete(agora, LEMBRETES_POR_PASSAGEM * 5)) {
    if (lista.length >= LEMBRETES_POR_PASSAGEM) break;
    if (await naoContactarNaApp({ email: c.email, telefone: c.telefone ?? undefined })) continue;
    lista.push(c);
  }
  for (const [i, c] of lista.entries()) {
    if (i > 0) await espera(INTERVALO_ENTRE_LEMBRETES_MS);
    // Reservar ANTES: uma passagem a correr ao mesmo tempo não envia outra vez.
    if (!(await reservarLembrete(c.email))) continue;
    const canais: string[] = [];
    const email = montarEmailDaApp(MODELO_DO_LEMBRETE_POR_EMAIL, { nome: c.nome, link: await linkNossoDoConvite(c.email) });
    if (await enviarEmailDoSeguimento({ para: c.email, assunto: email.assunto, texto: email.texto, html: email.html })) {
      canais.push("email");
    }
    // O WhatsApp não sai daqui de rajada: entra na fila própria e sai um de
    // cada vez, 20–45 s entre cada, das 9h às 20h (convite-novo-da-app-na-base.ts).
    if (ligado.whatsapp && telemovelDoAviso(c.telefone)) {
      try {
        if (await porWhatsAppDaAppNaFila(c.email, "lembrete")) {
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
