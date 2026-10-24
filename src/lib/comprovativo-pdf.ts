import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ContaDoPagamento } from "./conta-do-pagamento";
import { ENTIDADE_QUE_FACTURA, IDENTIFICACAO } from "./identificacao-legal";
import { pecasEmLisboa } from "./hora-de-lisboa";
import { servicoEmPalavras } from "./servico-em-palavras";

/**
 * O COMPROVATIVO DE PAGAMENTO, EM PDF — 24-10-2026.
 *
 * *«Como geramos comprovativo em PDF de pagamento aqui?»* — e, a seguir, *«crie
 * essa função»* — o dono, sobre o #476 (pago ao profissional). Não havia
 * nenhum: o backoffice registava o dinheiro e não dava papel a ninguém.
 *
 * Dois documentos, um para cada ponta do dinheiro:
 *
 *   · o do CLIENTE — o que pagou, pelo quê, quando e como; com factura, diz
 *     quem a emite (a parceira), e sem factura di-lo também;
 *   · o do PROFISSIONAL — o valor do trabalho, a comissão da CLYON e o que se
 *     lhe pagou, e quando.
 *
 * Os números são os da conta em degraus (`conta-do-pagamento.ts`) — os mesmos
 * do cartão de onde se carrega. NÃO É UMA FACTURA, e o documento di-lo: a
 * factura é da parceira (`ENTIDADE_QUE_FACTURA`).
 *
 * As letras são as Helvetica do próprio PDF (sem ficheiros de fonte), que só
 * conhecem o alfabeto da Europa Ocidental: um nome com outra coisa (um emoji,
 * outro alfabeto) perde esses sinais em vez de rebentar o documento
 * (`paraOPdf`).
 */

export type ParaQuem = "cliente" | "profissional";

export type DadosDoComprovativo = {
  para: ParaQuem;
  pedidoId: number;
  cliente: string | null;
  telefoneDoCliente: string | null;
  cidade: string | null;
  /** O serviço como a base o guarda (`recolha_moveis`). */
  servico: string | null;
  profissional: string;
  /** O dia do trabalho, ISO. */
  dataDoTrabalho: string | null;
  semFactura: boolean;
  conta: ContaDoPagamento;
  /** Quando o dinheiro passou: do cliente para a CLYON, ou da CLYON para o profissional. */
  pagoEm: string | null;
  /** Como passou, já em palavras («MB WAY», «Transferência»), quando se sabe. */
  como: string | null;
};

/** Um euro como se escreve cá: «1 234,50 €». */
export function emEuros(v: number): string {
  const [inteiro, cent] = (Math.round(v * 100) / 100).toFixed(2).split(".");
  const grupos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grupos},${cent} €`;
}

/** «23/10/2026», no relógio de Lisboa. */
export function diaEmPalavras(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = pecasEmLisboa(d);
  return `${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}/${p.ano}`;
}

/** Os caracteres que as letras do PDF sabem desenhar (WinAnsi); o resto sai. */
const FORA_DO_LATIM = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function paraOPdf(s: string | null | undefined): string {
  return [...String(s ?? "")]
    .filter((c) => {
      const n = c.codePointAt(0) ?? 0;
      return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || FORA_DO_LATIM.includes(c);
    })
    .join("")
    .trim();
}

export type LinhaDeValor = { rotulo: string; valor: string; destaque?: boolean; nota?: string };

/**
 * O QUE O COMPROVATIVO DIZ — sem o desenhar, para se poder ler e testar.
 */
export function conteudoDoComprovativo(d: DadosDoComprovativo, emitidoEm: Date) {
  const servico = servicoEmPalavras(d.servico);
  const servicoComMaiuscula = servico ? servico.charAt(0).toUpperCase() + servico.slice(1) : "Serviço";
  const numero = `${d.pedidoId}-${d.para === "cliente" ? "C" : "P"}`;
  const pagoEm = diaEmPalavras(d.pagoEm);
  const trabalho = [
    { rotulo: "Pedido", valor: `n.º ${d.pedidoId}` },
    { rotulo: "Serviço", valor: `${servicoComMaiuscula}${d.cidade ? ` — ${d.cidade}` : ""}` },
    ...(diaEmPalavras(d.dataDoTrabalho) ? [{ rotulo: "Dia do trabalho", valor: diaEmPalavras(d.dataDoTrabalho) as string }] : []),
    d.para === "cliente"
      ? { rotulo: "Executado por", valor: d.profissional }
      : { rotulo: "Cliente", valor: d.cliente?.trim() || "—" },
  ];

  let valores: LinhaDeValor[];
  let nota: string;
  if (d.para === "cliente") {
    const c = d.conta;
    valores = [
      { rotulo: "Valor do serviço, sem IVA", valor: emEuros(c.semIva) },
      d.semFactura || c.iva === 0
        ? { rotulo: "IVA", valor: emEuros(0), nota: "sem factura" }
        : { rotulo: "IVA (23 %)", valor: emEuros(c.iva) },
      { rotulo: "Total pago", valor: emEuros(c.total), destaque: true },
    ];
    nota = d.semFactura
      ? "Pagamento sem factura, a pedido do cliente. Este documento comprova o pagamento e não é uma factura."
      : `Este documento comprova o pagamento e não substitui a factura, emitida pela ${ENTIDADE_QUE_FACTURA.nomeLegal} (NIF ${ENTIDADE_QUE_FACTURA.nif}).`;
  } else {
    /*
     * O valor do trabalho é o degrau com esse nome, quando há taxa do cliente
     * por cima (as negociações de antes da regra dos 11 %); senão, o valor sem
     * IVA. A comissão é o que vai dele ao que se pagou.
     */
    const c = d.conta;
    const valorDoTrabalho = c.degraus.find((x) => x.rotulo === "Valor do trabalho")?.valor ?? c.semIva;
    const comissao = Math.round((valorDoTrabalho - c.profissional) * 100) / 100;
    const pct = valorDoTrabalho > 0 ? Math.round((comissao / valorDoTrabalho) * 1000) / 10 : 0;
    valores = [
      { rotulo: "Valor do trabalho, sem IVA", valor: emEuros(valorDoTrabalho) },
      { rotulo: `Comissão da CLYON (${String(pct).replace(".", ",")} %)`, valor: `- ${emEuros(comissao)}` },
      { rotulo: "Valor pago ao profissional", valor: emEuros(c.profissional), destaque: true },
    ];
    nota = "Comprovativo do pagamento feito pela CLYON ao profissional pelo trabalho acima. Não é uma factura.";
  }

  return {
    titulo: d.para === "cliente" ? "Comprovativo de pagamento" : "Comprovativo de pagamento ao profissional",
    numero,
    emitidoEm: diaEmPalavras(emitidoEm) as string,
    destinatario:
      d.para === "cliente"
        ? { rotulo: "Cliente", nome: d.cliente?.trim() || "—", extra: d.telefoneDoCliente?.trim() || null }
        : { rotulo: "Profissional", nome: d.profissional, extra: null },
    trabalho,
    valores,
    pagamento: pagoEm ? `Pago a ${pagoEm}${d.como ? ` · ${d.como}` : ""}` : null,
    nota,
  };
}

const ANIL = rgb(0.06, 0.09, 0.16);
const CIANO = rgb(0, 0.47, 0.71);
const CINZENTO = rgb(0.4, 0.45, 0.52);
const LINHA = rgb(0.85, 0.88, 0.92);

/** O PDF, pronto a descarregar. */
export async function comprovativoEmPdf(d: DadosDoComprovativo, emitidoEm = new Date()): Promise<Uint8Array> {
  const c = conteudoDoComprovativo(d, emitidoEm);
  const pdf = await PDFDocument.create();
  pdf.setTitle(paraOPdf(`${c.titulo} — pedido ${d.pedidoId}`));
  pdf.setAuthor("CLYON");
  pdf.setCreator("CLYON");
  const pagina = pdf.addPage([595.28, 841.89]); // A4
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 56;
  const L = 595.28 - M * 2;
  let y = 841.89 - M;

  const escrever = (p: PDFPage, texto: string, x: number, yy: number, tam: number, fonte: PDFFont, cor = ANIL) =>
    p.drawText(paraOPdf(texto), { x, y: yy, size: tam, font: fonte, color: cor });
  const aDireita = (texto: string, yy: number, tam: number, fonte: PDFFont, cor = ANIL) => {
    const t = paraOPdf(texto);
    escrever(pagina, t, M + L - fonte.widthOfTextAtSize(t, tam), yy, tam, fonte, cor);
  };
  /** Quebra um texto em linhas que caibam na largura. */
  const linhas = (texto: string, tam: number, fonte: PDFFont, largura: number) => {
    const palavras = paraOPdf(texto).split(/\s+/);
    const saida: string[] = [];
    let actual = "";
    for (const p of palavras) {
      const tentativa = actual ? `${actual} ${p}` : p;
      if (fonte.widthOfTextAtSize(tentativa, tam) > largura && actual) {
        saida.push(actual);
        actual = p;
      } else actual = tentativa;
    }
    if (actual) saida.push(actual);
    return saida;
  };
  const traco = (yy: number) => pagina.drawLine({ start: { x: M, y: yy }, end: { x: M + L, y: yy }, thickness: 0.8, color: LINHA });

  // O cabeçalho: a marca à esquerda, o documento à direita.
  escrever(pagina, IDENTIFICACAO.nomeComercial, M, y - 18, 24, negrito, CIANO);
  aDireita(c.titulo, y - 8, 13, negrito);
  aDireita(`N.º ${c.numero} · emitido a ${c.emitidoEm}`, y - 24, 9, normal, CINZENTO);
  y -= 44;
  for (const t of [
    `${IDENTIFICACAO.nomeLegal} · NIF ${IDENTIFICACAO.nif}`,
    IDENTIFICACAO.morada,
    `${IDENTIFICACAO.email} · ${IDENTIFICACAO.telefone} · clyon.pt`,
  ]) {
    escrever(pagina, t, M, y, 8.5, normal, CINZENTO);
    y -= 12;
  }
  y -= 8;
  traco(y);
  y -= 26;

  // Para quem.
  escrever(pagina, c.destinatario.rotulo.toUpperCase(), M, y, 8, negrito, CINZENTO);
  y -= 16;
  escrever(pagina, c.destinatario.nome, M, y, 13, negrito);
  if (c.destinatario.extra) {
    y -= 14;
    escrever(pagina, c.destinatario.extra, M, y, 9.5, normal, CINZENTO);
  }
  y -= 28;

  // O trabalho.
  escrever(pagina, "TRABALHO", M, y, 8, negrito, CINZENTO);
  y -= 16;
  for (const l of c.trabalho) {
    escrever(pagina, l.rotulo, M, y, 10, normal, CINZENTO);
    escrever(pagina, l.valor, M + 120, y, 10, normal);
    y -= 15;
  }
  y -= 14;

  // Os valores.
  escrever(pagina, "VALORES", M, y, 8, negrito, CINZENTO);
  y -= 8;
  traco(y);
  y -= 18;
  for (const v of c.valores) {
    if (v.destaque) {
      traco(y + 12);
      y -= 4;
    }
    const tam = v.destaque ? 12.5 : 10.5;
    const fonte = v.destaque ? negrito : normal;
    escrever(pagina, v.rotulo + (v.nota ? ` (${v.nota})` : ""), M, y, tam, fonte, v.destaque ? ANIL : CINZENTO);
    aDireita(v.valor, y, tam, fonte);
    y -= v.destaque ? 22 : 18;
  }
  traco(y + 8);
  if (c.pagamento) {
    y -= 10;
    escrever(pagina, c.pagamento, M, y, 10.5, negrito, CIANO);
    y -= 14;
  }
  y -= 22;

  // A nota: o que este documento é, e o que não é.
  for (const l of linhas(c.nota, 9, normal, L)) {
    escrever(pagina, l, M, y, 9, normal, CINZENTO);
    y -= 12.5;
  }

  // O rodapé.
  escrever(pagina, `${IDENTIFICACAO.nomeComercial} · clyon.pt`, M, M - 20, 8, normal, CINZENTO);
  aDireita(`Pedido n.º ${d.pedidoId}`, M - 20, 8, normal, CINZENTO);

  return pdf.save();
}
