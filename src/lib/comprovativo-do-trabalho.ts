import crypto from "crypto";
import { folhaDeJson, folhaNoEcra } from "./folha-da-mudanca";
import { tarifaCongeladaDeJson } from "./conta-da-mudanca";
import { moradaCompleta, trabalhosParaGerir, type TrabalhoParaGerir } from "./trabalhos-para-gerir";
import { folhaDaNegociacao, getPool } from "./db";
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

/**
 * A morada do pedido, para o comprovativo do cliente (dono, 30-10-2026). Lê-se
 * aqui e não em `trabalhosParaGerir`: essa só conta com colunas que a
 * anonimização não reescreve. Num pedido já anonimizado sai o que lá estiver.
 */
async function moradaDoPedido(pedidoId: number): Promise<string | null> {
  try {
    const pool = await getPool();
    if (!pool) return null;
    const [rows] = (await pool.execute("SELECT address, floor, postalCode, city FROM simulatorOrders WHERE id = ? LIMIT 1", [pedidoId])) as [
      Array<{ address: string | null; floor: string | null; postalCode: string | null; city: string | null }>,
      unknown,
    ];
    const r = rows[0];
    return r ? moradaCompleta(r.address, r.floor, r.postalCode, r.city) : null;
  } catch {
    return null;
  }
}

/** As linhas da folha da mudança (11-11-2026) — só com a folha confirmada; null nas outras. */
async function linhasDaFolhaDoTrabalho(negociacaoId: number, para: ParaQuem) {
  try {
    const f = await folhaDaNegociacao(negociacaoId);
    const folha = folhaDeJson(f?.folhaJson ?? null);
    if (!f || !folha) return null;
    const t = tarifaCongeladaDeJson(f.tarifaCongeladaJson ?? null);
    return folhaNoEcra(folha, para === "cliente" ? "cliente" : "parceiro", t?.minimoHoras ?? folha.conta.horas.cobradas).linhas;
  } catch {
    return null;
  }
}

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
    morada: doCliente ? await moradaDoPedido(t.pedidoId) : null,
    servico: t.servico,
    profissional: t.profissional,
    dataDoTrabalho: t.dataDoTrabalho,
    semFactura: t.semFactura,
    conta: t.conta,
    folha: await linhasDaFolhaDoTrabalho(negociacaoId, para),
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
 * DESDE 10-11-2026 (d24): `<negociação>-<c|p>-<caduca>-<assinatura>`.
 *
 *   · SEGREDO PRÓPRIO. O HMAC usava o `JWT_SECRET` tal e qual, o mesmo que
 *     assina as sessões. Agora usa `COMPROVATIVO_SECRET` quando existe e, sem
 *     ele, uma chave tirada do `JWT_SECRET` só para isto (HMAC com um rótulo):
 *     um segredo não serve dois fins com a mesma chave;
 *   · PRAZO. O link leva a data em que caduca, dentro da assinatura, e vale
 *     `DIAS_DO_LINK_DO_COMPROVATIVO` dias. Um PDF com a morada e o telefone
 *     não fica aberto para sempre a quem apanhar o link. Caducado, pede-se
 *     outro (o botão do backoffice gera um novo).
 *
 * Os links ANTIGOS (`<negociação>-<c|p>-<assinatura>`, sem prazo) já foram
 * pelo WhatsApp: continuam a abrir até `LINKS_ANTIGOS_ATE`, e depois não.
 */
export const DIAS_DO_LINK_DO_COMPROVATIVO = 90;
/** Até quando abrem os links sem prazo enviados antes de 10-11-2026 (90 dias). */
export const LINKS_ANTIGOS_ATE = new Date("2027-02-08T23:59:59Z");

function chaveDoComprovativo(): string | null {
  const proprio = process.env.COMPROVATIVO_SECRET?.trim();
  if (proprio) return proprio;
  const base = process.env.JWT_SECRET;
  if (!base) return null;
  return crypto.createHmac("sha256", base).update("clyon:comprovativo:v2").digest("base64url");
}

function assinaturaComPrazo(negociacaoId: number, para: ParaQuem, caduca: string): string | null {
  const chave = chaveDoComprovativo();
  if (!chave) return null;
  return crypto
    .createHmac("sha256", chave)
    .update(`comprovativo:v2:${negociacaoId}:${para}:${caduca}`)
    .digest("base64url")
    .slice(0, 32);
}

/** A assinatura dos links antigos — só para os ler até `LINKS_ANTIGOS_ATE`. */
function assinaturaAntiga(negociacaoId: number, para: ParaQuem): string | null {
  const segredo = process.env.JWT_SECRET;
  if (!segredo) return null;
  return crypto
    .createHmac("sha256", segredo)
    .update(`comprovativo:${negociacaoId}:${para}`)
    .digest("base64url")
    .slice(0, 24);
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function tokenDoComprovativo(
  negociacaoId: number,
  para: ParaQuem,
  agora: Date = new Date(),
): string | null {
  const caduca = Math.floor(agora.getTime() / 1000 + DIAS_DO_LINK_DO_COMPROVATIVO * 86400).toString(36);
  const a = assinaturaComPrazo(negociacaoId, para, caduca);
  return a ? `${negociacaoId}-${para === "cliente" ? "c" : "p"}-${caduca}-${a}` : null;
}

export function lerTokenDoComprovativo(
  token: string,
  agora: Date = new Date(),
): { negociacaoId: number; para: ParaQuem } | null {
  const novo = /^([0-9]{1,10})-([cp])-([0-9a-z]{4,10})-([A-Za-z0-9_-]{32})$/.exec(token);
  if (novo) {
    const negociacaoId = Number(novo[1]);
    const para: ParaQuem = novo[2] === "c" ? "cliente" : "profissional";
    const esperada = assinaturaComPrazo(negociacaoId, para, novo[3]);
    if (!esperada || !iguais(novo[4], esperada)) return null;
    if (parseInt(novo[3], 36) * 1000 < agora.getTime()) return null;
    return { negociacaoId, para };
  }
  const antigo = /^([0-9]{1,10})-([cp])-([A-Za-z0-9_-]{24})$/.exec(token);
  if (!antigo || agora.getTime() > LINKS_ANTIGOS_ATE.getTime()) return null;
  const negociacaoId = Number(antigo[1]);
  const para: ParaQuem = antigo[2] === "c" ? "cliente" : "profissional";
  const esperada = assinaturaAntiga(negociacaoId, para);
  return esperada && iguais(antigo[3], esperada) ? { negociacaoId, para } : null;
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
