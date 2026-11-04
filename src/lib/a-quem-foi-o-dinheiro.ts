import { lerForma } from "./forma-de-pagamento";
import {
  METODO_PAGO_AO_PROFISSIONAL,
  dividaDoRegistoEmMao,
  foiPagoEmMaoPor,
  pagoAoProfissionalRegistado,
} from "./pago-em-mao";
import { ladoDoCliente, ladoDoProfissional, type ComoEntrou, type TrabalhoParaGerir } from "./dinheiro-do-trabalho";
import type { SeparadorDoDinheiro } from "./filtros-dos-pagamentos";
import type { Taxas } from "./taxas-plataforma";

/**
 * A QUEM FOI O DINHEIRO — 03-11-2026 (d3, dono).
 *
 * *«Os pagamentos feitos à CLYON devem estar em categorias e secções
 * separadas dos pagamentos feitos para os pros.»*
 *
 * O ecrã dos Pagamentos somava num só «recebido» o que entrou na CLYON e o
 * que o cliente pagou ao profissional em mão (anotado com o método
 * `ao_profissional`) — dinheiro que a CLYON nunca recebeu. Os cartões dos
 * trabalhos contavam os pagos em mão em «Recebidos» e em «Pagos aos pros», e
 * a lista dos últimos pagamentos misturava as duas coisas.
 *
 * Esta é a pergunta, uma só, que os cartões, os números e as listas fazem:
 *
 *   · À CLYON — MB WAY e Multibanco pelo euPago; transferência ou numerário
 *     recebidos pela CLYON; a parte da CLYON que o profissional lhe pagou.
 *   · AO PROFISSIONAL — o cliente pagou-lhe em mão; e os acertos no saldo dele
 *     (a parte da CLYON descontada numa transferência, a quitação de 01/11),
 *     que não são dinheiro a entrar.
 *
 * As duas secções nunca se somam uma à outra. É pura, e tem testes
 * (`a-quem-foi-o-dinheiro.test.ts`). Os nomes que se lêem no ecrã vivem no
 * painel, que é do backoffice.
 */

export type Destino = "clyon" | "profissional";

/** De que é feita uma linha de `pagamentos`. */
export type NaturezaDoPagamento =
  /** MB WAY ou Multibanco, pelo euPago — entrou na conta da CLYON. */
  | "eupago"
  /** Transferência ou numerário recebidos pela CLYON, anotados à mão. */
  | "recebido_a_mao"
  /** O profissional pagou à CLYON a parte dela de um trabalho pago em mão. */
  | "pago_pelo_profissional"
  /** O cliente pagou ao profissional, em mão. A CLYON não recebeu. */
  | "em_mao"
  /** Abatimento no saldo ou quitação: nenhum dinheiro entrou nem saiu. */
  | "acerto_no_saldo"
  /** Um método que esta regra ainda não conhece. */
  | "outro";

/*
 * UM MÉTODO NOVO NÃO PASSA SEM SER CLASSIFICADO: a chave é o `ComoEntrou`
 * inteiro, e o TypeScript recusa a regra sem ele.
 */
const NATUREZAS: Record<ComoEntrou, NaturezaDoPagamento> = {
  multibanco: "eupago",
  mbway: "eupago",
  transferencia: "recebido_a_mao",
  numerario: "recebido_a_mao",
  pro_transferencia: "pago_pelo_profissional",
  pro_mbway: "pago_pelo_profissional",
  pro_numerario: "pago_pelo_profissional",
  [METODO_PAGO_AO_PROFISSIONAL]: "em_mao",
  abatimento: "acerto_no_saldo",
  quitacao: "acerto_no_saldo",
};

export type ClasseDoPagamento = {
  destino: Destino;
  natureza: NaturezaDoPagamento;
  /**
   * Conta no «recebido» da CLYON quando está pago. Só o que é à CLYON: o pago
   * em mão ao profissional e os acertos no saldo nunca entram.
   */
  entraNaClyon: boolean;
};

/**
 * UMA LINHA DE `pagamentos`: a quem foi, e de que é feita.
 *
 * Um método desconhecido fica à CLYON, como contava antes desta regra: um
 * pagamento novo nunca desaparece das contas em silêncio — aparece, e o teste
 * do `ComoEntrou` obriga a classificá-lo.
 */
export function classificarPagamento(metodo: string | null | undefined): ClasseDoPagamento {
  const m = String(metodo ?? "").trim();
  const natureza: NaturezaDoPagamento = (NATUREZAS as Record<string, NaturezaDoPagamento>)[m] ?? "outro";
  const destino: Destino = natureza === "em_mao" || natureza === "acerto_no_saldo" ? "profissional" : "clyon";
  return { destino, natureza, entraNaClyon: destino === "clyon" };
}

/**
 * UM TRABALHO: a quem o cliente pagou. Pago em mão ao profissional (combinado
 * em dinheiro, ou registado `ao_profissional`) é dele; tudo o resto paga-se à
 * CLYON. É a mesma pergunta da carteira (`foiPagoEmMaoPor`).
 */
export function destinoDoTrabalho(t: { formaDePagamento?: string | null; comoEntrou?: string | null }): Destino {
  return foiPagoEmMaoPor(t.formaDePagamento, t.comoEntrou) ? "profissional" : "clyon";
}

/**
 * EM QUE SECÇÃO DO ECRÃ VIVE CADA SEPARADOR do «Trabalho a trabalho». Os
 * pagos em mão e o que a CLYON paga aos profissionais ficam juntos, na secção
 * dos profissionais; o que o cliente paga à CLYON, na dela.
 */
export const SECCAO_DO_SEPARADOR: Record<SeparadorDoDinheiro, Destino> = {
  por_receber: "clyon",
  recebidos: "clyon",
  em_mao: "profissional",
  por_pagar: "profissional",
  pagos: "profissional",
};

/**
 * O TRABALHO ESTÁ NESTE SEPARADOR?
 *
 * Um pago em mão vive só em «Pagos em mão»: não está por receber nem
 * recebido pela CLYON, e a CLYON não o pagou ao profissional. Os outros
 * aparecem uma vez de cada lado — o que o cliente pagou à CLYON e o que a
 * CLYON pagou ao profissional.
 */
export function noSeparador(t: TrabalhoParaGerir, s: SeparadorDoDinheiro): boolean {
  const emMao = destinoDoTrabalho(t) === "profissional";
  switch (s) {
    case "em_mao":
      return emMao;
    case "por_receber":
      return !emMao && ladoDoCliente(t) === "por_receber";
    case "recebidos":
      return !emMao && ladoDoCliente(t) === "recebido";
    case "por_pagar":
      return !emMao && ladoDoProfissional(t) === "por_pagar";
    case "pagos":
      return !emMao && ladoDoProfissional(t) === "pago";
  }
}

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * A SOMA DE UM SEPARADOR. Do lado do cliente (o que pagou à CLYON, ou ao
 * profissional em mão), o que o cliente pagou; do que a CLYON paga, o que o
 * profissional recebe. Só se somam linhas do mesmo separador.
 */
export function somaDoSeparador(
  linhas: ReadonlyArray<{ clientePaga: number; profissionalRecebe: number }>,
  s: SeparadorDoDinheiro,
): number {
  const doCliente = s === "por_receber" || s === "recebidos" || s === "em_mao";
  return aosCentimos(linhas.reduce((n, t) => n + (doCliente ? t.clientePaga : t.profissionalRecebe), 0));
}

/**
 * A PARTE DA CLYON NUM TRABALHO PAGO EM MÃO — a taxa da plataforma, e o IVA
 * quando o cliente o pagou ao profissional.
 *
 *   · combinado em dinheiro: a dívida de sempre (`dividaDoProfissional`),
 *     cobrada quando o pagamento dela entrou (`clientePagouEm`);
 *   · registado «pago ao profissional»: a conta de `dividaDoRegistoEmMao`
 *     (24d1cc1d) — cobrada quando a linha à parte existe (`taxaAParteEm`).
 *     Desde 04-11-2026 (d9) paga-se como a do dinheiro: por referência na
 *     carteira dele, ou abatida no saldo.
 *
 * Nula fora dos pagos em mão, ou quando não há o dado (dinheiro do regime
 * antigo, sem dívida registada).
 */
export type TaxaDoPagoEmMao = {
  valor: number;
  cobrada: boolean;
  /**
   * Só se desconta no saldo, sem referência (01-11-2026). Desde 04-11-2026
   * (d9) nenhuma é assim: falso.
   */
  descontaNoSaldo: boolean;
  /**
   * COMO SE FECHOU — o método da linha à parte: `quitacao` (o acerto de
   * 01-11-2026, sem dinheiro), `abatimento` (no saldo dele), `pro_*` (ele
   * pagou à mão), `multibanco`/`mbway` (pela referência). Nulo por cobrar.
   */
  como?: string | null;
  /**
   * COM QUANTO SE FECHOU — o valor dessa linha. Depois de uma correcção do
   * pagamento (d9) a conta (`valor`) pode já não bater com ele: diz-se.
   */
  fechadaCom?: number | null;
};

export function taxaDoPagoEmMao(t: {
  formaDePagamento?: string | null;
  comoEntrou?: string | null;
  dividaDoProfissional?: number | null;
  clientePagouEm?: unknown;
  valorAcordado: number;
  taxas: Taxas;
  valorQueEntrou?: number | null;
  taxaAParteEm?: unknown;
  /** O método e o valor da linha à parte, quando existe (04-11-2026, d9). */
  taxaAParteComo?: string | null;
  taxaAParteValor?: number | null;
}): TaxaDoPagoEmMao | null {
  if (lerForma(t.formaDePagamento ?? null) === "dinheiro") {
    if (t.dividaDoProfissional == null || !Number.isFinite(t.dividaDoProfissional)) return null;
    return { valor: aosCentimos(t.dividaDoProfissional), cobrada: t.clientePagouEm != null, descontaNoSaldo: false };
  }
  if (!pagoAoProfissionalRegistado(t.formaDePagamento, t.comoEntrou)) return null;
  if (!Number.isFinite(t.valorAcordado)) return null;
  const d = dividaDoRegistoEmMao(t.valorAcordado, t.taxas, t.valorQueEntrou);
  if (d.total <= 0) return null;
  const cobrada = t.taxaAParteEm != null;
  return {
    valor: d.total,
    cobrada,
    descontaNoSaldo: false,
    como: cobrada ? (String(t.taxaAParteComo ?? "").trim() || null) : null,
    fechadaCom:
      cobrada && t.taxaAParteValor != null && Number.isFinite(Number(t.taxaAParteValor))
        ? aosCentimos(Number(t.taxaAParteValor))
        : null,
  };
}

/**
 * COMO SE DIZ A PARTE DA CLYON DE UM PAGO EM MÃO — 04-11-2026 (d9, dono).
 *
 * *«Nas 34 linhas do acerto de 01/11, os Pagamentos dizem "já está cobrada"
 * quando a dívida foi quitada sem entrar dinheiro: passa a "quitada no
 * acerto".»* Cada caminho com o seu nome; e, se uma correcção mudou a conta
 * depois de fechada, a diferença à vista (não se cobra sozinha).
 */
export function fraseDaParteDaClyon(x: TaxaDoPagoEmMao, euros: (v: number) => string): string {
  const parte = `a parte da CLYON, ${euros(x.valor)}`;
  if (!x.cobrada) {
    return `${parte}, está por pagar pelo profissional — pela referência na carteira dele, ou descontada no saldo`;
  }
  const como = String(x.como ?? "").trim();
  const quitada = como === "quitacao";
  const fechada = quitada
    ? "foi quitada no acerto de 01/11/2026"
    : como === "abatimento"
      ? "foi abatida no saldo do profissional"
      : como.startsWith("pro_") || como === "multibanco" || como === "mbway"
        ? "foi paga pelo profissional"
        : "está fechada";
  const diferenca = x.fechadaCom != null ? aosCentimos(x.valor - x.fechadaCom) : 0;
  if (Math.abs(diferenca) > 0.005) {
    return (
      `a parte da CLYON é ${euros(x.valor)} pela conta de hoje; ${fechada} com ${euros(x.fechadaCom as number)}` +
      `${quitada ? " (sem entrar dinheiro)" : ""} — ${diferenca > 0 ? "faltam" : "sobram"} ` +
      `${euros(Math.abs(diferenca))}, que não se acertam sozinhos`
    );
  }
  return `${parte}, ${fechada}${quitada ? ", sem entrar dinheiro" : ""}`;
}

/**
 * EM QUE MONTE DAS CARTEIRAS FICA UM TRABALHO — 04-11-2026 (d9, dono).
 *
 * *«Um trabalho pago em mão ao profissional nunca entra no "A pagar".»* As
 * Carteiras do backoffice (Finanças › «A pagar aos profissionais») liam o
 * pago em mão só pela forma combinada e, nos Trabalhos CLYON, nem
 * perguntavam como o cliente pagou: o #479 e o #496, pagos em mão ao
 * parceiro, ficavam «por pagar» — o caminho para a CLYON pagar duas vezes.
 *
 * A mesma pergunta dos Pagamentos (`destinoDoTrabalho`, `foiPagoEmMaoPor`):
 * pago em mão é «em mão», feito ou por fazer, seja Trabalho CLYON ou não.
 */
export type MonteDaCarteira = "em_mao" | "pago" | "por_finalizar" | "por_pagar";

export function monteNasCarteiras(t: {
  formaDePagamento?: string | null;
  comoEntrou?: string | null;
  confirmadoEm?: unknown;
  pagoEm?: unknown;
}): MonteDaCarteira {
  if (destinoDoTrabalho(t) === "profissional") return "em_mao";
  if (t.pagoEm != null) return "pago";
  if (t.confirmadoEm == null) return "por_finalizar";
  return "por_pagar";
}

/** O que falta cobrar aos profissionais nos trabalhos pagos em mão. */
export function porCobrarNosPagosEmMao(linhas: ReadonlyArray<{ taxaEmMao?: TaxaDoPagoEmMao | null }>): number {
  return aosCentimos(
    linhas.reduce((n, t) => n + (t.taxaEmMao && !t.taxaEmMao.cobrada ? t.taxaEmMao.valor : 0), 0),
  );
}

/**
 * O REGISTO DOS PAGAMENTOS, POR SECÇÃO.
 *
 * A base agrupa as linhas por método e estado (`resumoDosPagamentos`); daqui
 * sai o que cada secção mostra. O «recebido» da CLYON soma `valorPago` das
 * linhas pagas que são dela — como somava antes, menos o pago em mão.
 */
export type GrupoDoRegisto = {
  metodo: string | null;
  estado: string | null;
  n: number;
  valor: number;
  valorPago: number;
  comissao: number;
};

type Conta = { n: number; total: number };

export type ResumoDosRegistos = {
  clyon: {
    /** Pagos e entrados na CLYON. */
    recebidos: Conta;
    /** Referências e transferências à espera de pagamento. */
    aEspera: Conta;
    falhadosOuCancelados: number;
    /** Sai da parte da CLYON. */
    comissaoDoEupago: number;
  };
  profissional: {
    /** O cliente pagou ao profissional, em mão, anotado nos Pagamentos. */
    emMao: Conta;
    /** A parte da CLYON descontada no saldo do profissional, ou quitada. */
    acertos: Conta;
  };
};

const FALHADOS_OU_CANCELADOS = new Set(["falhado", "cancelado"]);

export function resumoDosRegistos(grupos: ReadonlyArray<GrupoDoRegisto>): ResumoDosRegistos {
  const r: ResumoDosRegistos = {
    clyon: { recebidos: { n: 0, total: 0 }, aEspera: { n: 0, total: 0 }, falhadosOuCancelados: 0, comissaoDoEupago: 0 },
    profissional: { emMao: { n: 0, total: 0 }, acertos: { n: 0, total: 0 } },
  };
  const somar = (c: Conta, n: number, v: number) => {
    c.n += n;
    c.total = aosCentimos(c.total + v);
  };
  for (const g of grupos) {
    const n = Number(g.n) || 0;
    const estado = String(g.estado ?? "").trim();
    const { natureza, entraNaClyon } = classificarPagamento(g.metodo);
    if (estado === "pago") {
      // A comissão do euPago é sempre da CLYON: sai da parte dela.
      r.clyon.comissaoDoEupago = aosCentimos(r.clyon.comissaoDoEupago + (Number(g.comissao) || 0));
      if (entraNaClyon) somar(r.clyon.recebidos, n, Number(g.valorPago) || 0);
      else if (natureza === "em_mao") somar(r.profissional.emMao, n, Number(g.valorPago) || 0);
      else somar(r.profissional.acertos, n, Number(g.valorPago) || 0);
    } else if (entraNaClyon && estado === "pendente") {
      somar(r.clyon.aEspera, n, Number(g.valor) || 0);
    } else if (entraNaClyon && FALHADOS_OU_CANCELADOS.has(estado)) {
      r.clyon.falhadosOuCancelados += n;
    }
  }
  return r;
}

/** Os últimos `quantos` pagamentos de uma secção, pela ordem em que vieram. */
export function ultimosDe<T extends { metodo: string | null }>(lista: ReadonlyArray<T>, destino: Destino, quantos = 25): T[] {
  return lista.filter((p) => classificarPagamento(p.metodo).destino === destino).slice(0, quantos);
}
