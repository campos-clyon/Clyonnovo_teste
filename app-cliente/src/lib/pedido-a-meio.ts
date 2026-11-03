import { hojeOuOntem, horaEmLisboa, pecasEmLisboa } from "../../../src/lib/hora-de-lisboa";
import type { Rascunho } from "./novo-pedido";

/**
 * O PEDIDO A MEIO (d5 de 03-11-2026, ordem do CEO com o sim do dono).
 *
 * O rascunho do Pedir continua guardado no telemóvel a cada campo
 * (`guardado.ts`), mas quem fechava a app e voltava encontrava o pedido como o
 * deixou, sem lhe perguntarem nada. Agora, na primeira vez que o Pedir se vê
 * numa sessão nova da app, com um pedido a meio, aparece uma caixa:
 * «Tem um pedido a meio» — «Recolha de móveis, guardado hoje às 22:24.» —
 * com «Continuar» (o ecrã onde ficou, tudo preenchido) e «Começar do zero»
 * (apaga o rascunho e as cópias das fotografias, e abre a primeira pergunta).
 *
 * UMA SESSÃO NOVA DA APP é:
 *   - abri-la de raiz (fechada nos recentes, ou pelo sistema);
 *   - voltar depois de a fechar com o «voltar» do Android, sem ecrã para onde
 *     voltar (o Android guarda-a em segundo plano, mas quem a usa fechou-a);
 *   - voltar depois de 30 minutos fora (a medida de sessão do Google Analytics).
 * Ir à câmara, à galeria, ao WhatsApp ou ao email por uns minutos, e trocar
 * de separador, não abrem sessão nova: não se pergunta nada.
 *
 * UM PEDIDO A MEIO é um rascunho com o serviço escolhido (o mesmo marco de
 * `contarRascunhoNovo`). A morada da barra de cima e o nome e o telefone da
 * conta, que a app põe sozinha, não contam. Enviar o pedido apaga o rascunho:
 * nunca volta.
 *
 * Puro de propósito: os testes do site importam-no.
 */

/** Quanto tempo fora da app conta como tê-la fechado. */
export const AUSENCIA_QUE_FECHA_A_SESSAO_MS = 30 * 60_000;
/** O «voltar» que fecha a app põe-na em segundo plano logo a seguir; mais tarde, já não foi ele. */
export const VOLTAR_QUE_FECHA_A_APP_MS = 2_000;

/**
 * A app voltou ao primeiro plano: começa uma sessão nova?
 * `saiuEm` é quando foi para segundo plano; `voltarSemDestinoEm`, o último
 * «voltar» do Android sem ecrã para onde voltar (ou `null`).
 */
export function sessaoNovaAoVoltar(e: { saiuEm: number | null; voltouEm: number; voltarSemDestinoEm: number | null }): boolean {
  if (e.saiuEm === null) return false;
  if (e.voltarSemDestinoEm !== null) {
    const depois = e.saiuEm - e.voltarSemDestinoEm;
    if (depois >= 0 && depois <= VOLTAR_QUE_FECHA_A_APP_MS) return true;
  }
  return e.voltouEm - e.saiuEm >= AUSENCIA_QUE_FECHA_A_SESSAO_MS;
}

/** Um rascunho com o serviço escolhido. */
export function temPedidoAMeio(r: Pick<Rascunho, "servico"> | null | undefined): boolean {
  return typeof r?.servico === "string" && r.servico.trim() !== "";
}

/**
 * Perguntar «Continuar» ou «Começar do zero» ao entrar no Pedir?
 *   - só na primeira vez que o Pedir se vê nesta sessão da app: trocar de
 *     separador e voltar não pergunta outra vez (`vistoNaSessao`);
 *   - nunca a quem volta do link do email para enviar o pedido (`vemDeEntrar`);
 *   - só com um pedido a meio: um rascunho vazio, ou apagado ao enviar, não.
 */
export function perguntarPeloPedidoAMeio(e: {
  rascunho: Pick<Rascunho, "servico"> | null | undefined;
  sessao: number;
  vistoNaSessao: number | null;
  vemDeEntrar?: boolean;
}): boolean {
  if (e.vistoNaSessao === e.sessao) return false;
  if (e.vemDeEntrar) return false;
  return temPedidoAMeio(e.rascunho);
}

export const TITULO_DO_PEDIDO_A_MEIO = "Tem um pedido a meio";
export const CONTINUAR_O_PEDIDO = "Continuar";
export const COMECAR_DO_ZERO = "Começar do zero";

const dois = (n: number) => String(n).padStart(2, "0");

/** «hoje às 22:24», «ontem» ou «02/11», em Lisboa; sem data (ou com uma que não se lê), `null`. */
export function quandoFoiGuardado(guardadoEm: string | null | undefined, agora: Date = new Date()): string | null {
  if (typeof guardadoEm !== "string" || !guardadoEm) return null;
  const t = Date.parse(guardadoEm);
  if (!Number.isFinite(t)) return null;
  const quando = new Date(t);
  const dia = hojeOuOntem(quando, agora);
  if (dia === "ontem") return "ontem";
  if (dia !== null) return `hoje às ${horaEmLisboa(quando)}`;
  const p = pecasEmLisboa(quando);
  return `${dois(p.dia)}/${dois(p.mes)}`;
}

/** A linha da caixa: «Recolha de móveis, guardado hoje às 22:24.» */
export function linhaDoPedidoAMeio(nomeDoServico: string | null | undefined, guardadoEm: string | null | undefined, agora: Date = new Date()): string {
  const nome = typeof nomeDoServico === "string" ? nomeDoServico.trim() : "";
  const quando = quandoFoiGuardado(guardadoEm, agora);
  if (nome && quando) return `${nome}, guardado ${quando}.`;
  if (nome) return `${nome}.`;
  if (quando) return `Guardado ${quando}.`;
  return "Está guardado neste telemóvel.";
}

/**
 * As cópias das fotografias do rascunho que se apagam com «Começar do zero»:
 * só ficheiros dentro das pastas da própria app (`pastas`: a cache e os
 * documentos), sem «..» no caminho, sem repetir. Nunca um `content://` da
 * galeria, nem nada fora da app. As que já subiram ficam no armazenamento do
 * site, sem pedido que as use.
 */
export function copiasParaApagar(fotos: ReadonlyArray<{ uri?: unknown }> | null | undefined, pastas: ReadonlyArray<string | null | undefined>): string[] {
  const dentro = pastas.filter((p): p is string => typeof p === "string" && p.startsWith("file://")).map((p) => (p.endsWith("/") ? p : `${p}/`));
  const lista: string[] = [];
  for (const f of fotos ?? []) {
    const uri = f?.uri;
    if (typeof uri !== "string" || !uri.startsWith("file://")) continue;
    if (uri.split("/").some((s) => s === ".." || s === ".")) continue;
    if (!dentro.some((p) => uri.startsWith(p) && uri.length > p.length)) continue;
    if (!lista.includes(uri)) lista.push(uri);
  }
  return lista;
}
