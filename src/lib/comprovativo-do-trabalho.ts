import crypto from "crypto";
import { trabalhosParaGerir, type TrabalhoParaGerir } from "./trabalhos-para-gerir";
import { comprovativoEmPdf, emEuros, type ParaQuem } from "./comprovativo-pdf";
import { nomeDoRecebimento } from "./dinheiro-do-trabalho";
import { nomeDeComoPagou } from "./pagamento-declarado";
import { primeiroNome } from "./mensagem-whatsapp";
import { servicoEmPalavras } from "./servico-em-palavras";
import { urlDeAccao } from "./url-do-site";

/**
 * O COMPROVATIVO DE UM TRABALHO — do pedido ao PDF, e o link para o cliente.
 * 24-10-2026, ver `comprovativo-pdf.ts`.
 *
 * Num sítio só, para o backoffice (descarregar) e para o link que vai ao
 * cliente (`/comprovativo/<token>`) darem o mesmo documento, com as mesmas
 * regras: o do cliente só depois de o dinheiro dele contar como recebido, o
 * do profissional só depois de se lhe pagar.
 */

export type ResultadoDoComprovativo =
  | { ok: true; bytes: Uint8Array; trabalho: TrabalhoParaGerir; nomeDoFicheiro: string }
  | { ok: false; erro: string; estado: number };

export async function comprovativoDoTrabalho(negociacaoId: number, para: ParaQuem): Promise<ResultadoDoComprovativo> {
  const [t] = await trabalhosParaGerir(negociacaoId);
  if (!t || !t.conta) return { ok: false, erro: "Trabalho não encontrado.", estado: 404 };
  if (para === "cliente" && !t.recebido) {
    return { ok: false, erro: "O cliente ainda não pagou — o comprovativo sai depois de o pagamento entrar.", estado: 409 };
  }
  if (para === "profissional" && !t.pagoEm) {
    return { ok: false, erro: "Ainda não se pagou ao profissional.", estado: 409 };
  }
  const doCliente = para === "cliente";
  const bytes = await comprovativoEmPdf({
    para,
    pedidoId: t.pedidoId,
    cliente: t.cliente,
    telefoneDoCliente: t.telefoneDoCliente,
    cidade: t.cidade,
    morada: t.morada,
    servico: t.servico,
    profissional: t.profissional,
    dataDoTrabalho: t.dataDoTrabalho,
    semFactura: t.semFactura,
    conta: t.conta,
    pagoEm: doCliente ? (t.clientePagouEm ?? t.declarado?.em ?? t.confirmadoEm) : t.pagoEm,
    como: doCliente
      ? t.comoEntrou
        ? nomeDoRecebimento(t.comoEntrou)
        : t.declarado && t.declarado.como !== "ainda_nao"
          ? nomeDeComoPagou(t.declarado.como)
          : null
      : null,
  });
  return { ok: true, bytes, trabalho: t, nomeDoFicheiro: `comprovativo-${t.pedidoId}-${para}.pdf` };
}

/*
 * O LINK PARA O CLIENTE — assinado, e não um número que se adivinhe.
 *
 * `<negociação>-<c|p>-<assinatura>`: a assinatura é um HMAC com o segredo do
 * servidor (`JWT_SECRET`), por isso mudar o número no link não abre o
 * comprovativo de outro pedido. Não caduca: é um recibo, e o cliente pode
 * voltar a ele daqui a meses.
 */
function assinatura(negociacaoId: number, para: ParaQuem): string | null {
  const segredo = process.env.JWT_SECRET;
  if (!segredo) return null;
  return crypto
    .createHmac("sha256", segredo)
    .update(`comprovativo:${negociacaoId}:${para}`)
    .digest("base64url")
    .slice(0, 24);
}

export function tokenDoComprovativo(negociacaoId: number, para: ParaQuem): string | null {
  const a = assinatura(negociacaoId, para);
  return a ? `${negociacaoId}-${para === "cliente" ? "c" : "p"}-${a}` : null;
}

export function lerTokenDoComprovativo(token: string): { negociacaoId: number; para: ParaQuem } | null {
  const m = /^(\d{1,10})-([cp])-([A-Za-z0-9_-]{24})$/.exec(token);
  if (!m) return null;
  const negociacaoId = Number(m[1]);
  const para: ParaQuem = m[2] === "c" ? "cliente" : "profissional";
  const esperada = assinatura(negociacaoId, para);
  if (!esperada) return null;
  const a = Buffer.from(m[3]);
  const b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? { negociacaoId, para } : null;
}

export function linkDoComprovativo(negociacaoId: number, para: ParaQuem): string | null {
  const token = tokenDoComprovativo(negociacaoId, para);
  return token ? `${urlDeAccao()}/comprovativo/${token}` : null;
}

/** A mensagem que leva o link ao cliente, pelo WhatsApp da CLYON. */
export function mensagemDoComprovativo(t: TrabalhoParaGerir, link: string): string {
  const nome = primeiroNome(t.cliente);
  const servico = servicoEmPalavras(t.servico);
  const total = t.conta ? ` (${emEuros(t.conta.total)})` : "";
  return [
    `Olá${nome ? `, ${nome}` : ""}! Aqui é a CLYON.`,
    `Segue o comprovativo do pagamento do pedido n.º ${t.pedidoId}${servico ? ` — ${servico}` : ""}${total}:`,
    link,
    "Obrigado pela preferência,\nEquipa CLYON",
  ].join("\n\n");
}
