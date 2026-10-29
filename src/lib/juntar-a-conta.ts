import { createHash, randomInt } from "node:crypto";
import {
  appendOrderHistory,
  conferirCodigoDeJuncao,
  guardarCodigoDeJuncao,
  pedirJuncaoAConta,
  MINUTOS_DO_CODIGO,
} from "./db";
import { A_ESPERA_DA_MESA, avisarContactoDoPedido, avisoDeJuncao } from "./avisar-contacto-do-pedido";
import { mascararEmail } from "./mascarar-email";
import { limitarPorConta } from "./limite-rota-publica";

/**
 * JUNTAR À CONTA UM PEDIDO SEM EMAIL — 29-10-2026 (Segurança, R13).
 *
 * Quem tem o link (ou a sessão de convidado) de um pedido feito pelo WhatsApp
 * não fica com ele só por pedir: confirma-se pelo TELEFONE DO PEDIDO.
 *
 *   1. sem código: a CLYON manda por WhatsApp, ao telefone guardado no
 *      pedido (nunca a um vindo do corpo), um código de 6 algarismos que vale
 *      10 minutos e 5 tentativas → `aConfirmar`;
 *   2. com o código certo: o pedido passa para a conta, numa só escrita →
 *      `juntado`; as sessões de convidado do pedido morrem;
 *   3. sem telefone, ou o WhatsApp não saiu: fica à espera da Mesa
 *      (`aEsperaDaMesa`), que confirma, recusa ou desliga.
 *
 * Em todos os casos o contacto do pedido é avisado. Na base fica só o resumo
 * do código (preso ao pedido), nunca o código.
 */

export const CODIGO_ENVIADO =
  "Enviámos um código por WhatsApp para o telefone do pedido. Escreva-o aqui para juntar o pedido à sua conta.";
export const CODIGO_ERRADO = "O código não está certo. Confira a mensagem do WhatsApp e tente outra vez.";
export const CODIGO_EXPIRADO = "Este código já não vale. Peça outro.";

export const resumoDoCodigo = (pedidoId: number, codigo: string) =>
  createHash("sha256").update(`${pedidoId}:${codigo}`, "utf8").digest("hex");

export function mensagemDoCodigo(pedidoId: number, emailMascarado: string, codigo: string): string {
  return (
    `O código para ligar o pedido #${pedidoId} à conta ${emailMascarado}, na app da CLYON, é ${codigo}. ` +
    `Vale ${MINUTOS_DO_CODIGO} minutos. Não reconhece este pedido? Não partilhe o código e responda a esta mensagem.`
  );
}

export type ResultadoDaJuncao =
  | { estado: "juntado" }
  | { estado: "aConfirmar" | "aEsperaDaMesa"; mensagem: string }
  | { estado: "jaLigado" }
  | { estado: "errado" | "expirado" | "muitos"; mensagem: string };

export async function juntarPedidoSemEmail(c: {
  pedido: { id: number; contactPhone?: string | null; juntarAContaPedidoPor?: string | null };
  email: string;
  codigo?: unknown;
  porOnde: "app" | "site";
}): Promise<ResultadoDaJuncao> {
  const { pedido, email } = c;
  const mascarado = mascararEmail(email);
  // Lido antes de qualquer escrita: esta conta já tinha pedido a junção?
  const ja = (pedido.juntarAContaPedidoPor ?? "").trim().toLowerCase() === email;

  if (typeof c.codigo === "string" && c.codigo.trim()) {
    const codigo = c.codigo.trim();
    if (!/^\d{6}$/.test(codigo)) return { estado: "errado", mensagem: CODIGO_ERRADO };
    const r = await conferirCodigoDeJuncao(pedido.id, email, resumoDoCodigo(pedido.id, codigo));
    if (r === "errado") return { estado: "errado", mensagem: CODIGO_ERRADO };
    if (r === "expirado" || r === "semCodigo") return { estado: "expirado", mensagem: CODIGO_EXPIRADO };
    await appendOrderHistory(pedido.id, {
      type: "created",
      by: null,
      message: `Pedido juntado à conta ${mascarado} ${c.porOnde === "app" ? "pela app de cliente" : "pelo site"}, confirmado com o código enviado ao telefone do pedido.`,
    });
    await avisarContactoDoPedido(
      { id: pedido.id, contactPhone: pedido.contactPhone },
      `O pedido #${pedido.id} ficou ligado à conta ${mascarado} na CLYON. Não reconhece este pedido? Responda a esta mensagem.`,
    );
    return { estado: "juntado" };
  }

  // Um código novo no máximo de 3 em 3 por hora, por pedido (R20).
  const travao = await limitarPorConta("juntar-codigo", `pedido:${pedido.id}`, 3, 3600);
  if (travao.erro) return { estado: "muitos", mensagem: "Já pedimos vários códigos. Espere um pouco e tente outra vez." };

  const telefone = (pedido.contactPhone ?? "").trim();
  if (telefone) {
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (!(await guardarCodigoDeJuncao(pedido.id, email, resumoDoCodigo(pedido.id, codigo)))) return { estado: "jaLigado" };
    let saiu = false;
    try {
      const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
      saiu = await enviarAvisoWhatsApp(telefone, mensagemDoCodigo(pedido.id, mascarado, codigo));
    } catch (err) {
      console.error("[juntar-a-conta] WhatsApp do código:", err instanceof Error ? err.message : err);
    }
    if (saiu) {
      await appendOrderHistory(pedido.id, {
        type: "created",
        by: null,
        message: `Pedido para juntar à conta ${mascarado} ${c.porOnde === "app" ? "pela app de cliente" : "pelo site"}: código enviado por WhatsApp ao telefone do pedido. A Mesa pode também confirmar ou recusar.`,
      });
      return { estado: "aConfirmar", mensagem: CODIGO_ENVIADO };
    }
  }

  // Sem telefone, ou o WhatsApp não saiu: a Mesa decide.
  if (!(await pedirJuncaoAConta(pedido.id, email))) return { estado: "jaLigado" };
  if (!ja) {
    await appendOrderHistory(pedido.id, {
      type: "created",
      by: null,
      message: `Pedido para juntar à conta ${mascarado} ${c.porOnde === "app" ? "pela app de cliente" : "pelo site"}: confirme ou recuse na Mesa.`,
    });
    await avisarContactoDoPedido(pedido, avisoDeJuncao(pedido.id, mascarado));
  }
  return { estado: "aEsperaDaMesa", mensagem: A_ESPERA_DA_MESA };
}
