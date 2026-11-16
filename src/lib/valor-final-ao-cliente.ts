import { quantoOClientePaga } from "./eupago";
import { contaDoCliente } from "./taxas-plataforma";
import { acertoDasHoras } from "./pagamento-para-o-cliente";
import { totalAoCliente } from "./total-ao-cliente";
import { emEuros } from "./conta-do-pagamento";
import { comoTratar } from "./whatsapp-recolha";
import { eDoCliente } from "./parte-do-pagamento";
import { temDividaDoProfissional } from "./divida-do-profissional";
import type { RegimeDoProfissional } from "./pagamento-directo";
import type { TrabalhoAPagar } from "./acesso-ao-pagamento";
import type { Pagamento } from "./pagamentos-na-base";
export { AVISO_SEM_NADA_PAGO, semNadaPagoRegistado } from "./aviso-sem-nada-pago";

/**
 * «ENVIAR O VALOR FINAL AO CLIENTE» — d38 v2, commit d (15-11-2026).
 *
 * Depois da folha final, o cliente que ainda não pagou («por receber») recebe o
 * valor final — só quando a equipa carrega no botão (Pagamentos, Mesa e
 * Trabalhos CLYON, na caixa da folha final). Antes de sair, a pré-visualização:
 * o total com IVA e o sem IVA ao lado (nunca sozinho), o que mudou e porquê se
 * a equipa o quiser juntar, e o canal (WhatsApp, email ou os dois).
 *
 * Dois caminhos, pelo modelo do trabalho:
 *
 *   · PAGA À CLYON (modelo antigo e Trabalhos CLYON) — uma referência
 *     Multibanco nova e um MB WAY novo, pela mesma via do «Gerar referência»;
 *     as referências antigas desse trabalho ficam canceladas, e uma que o
 *     cliente pague na mesma fica fora de vigor no webhook (não fecha o pedido,
 *     fica à vista para devolver — `pagamentoForaDeVigor`). Num trabalho à hora
 *     já pago pela estimativa, pede-se só a diferença (`acertoDasHoras`);
 *   · PAGA AO PARCEIRO (modelo de 15-11) — os dados de pagamento do parceiro e
 *     as duas faturas: a do trabalho (do parceiro) e a da CLYON (a taxa da
 *     plataforma, com a reserva do valor único quando a há).
 *
 * O pagamento entra sozinho pelo webhook. Pura: a conta e as mensagens; quem
 * envia é `valor-final-no-servidor.ts`.
 */

export type CanalDoValorFinal = "whatsapp" | "email" | "ambos";

export function lerCanal(v: unknown): CanalDoValorFinal | null {
  return v === "whatsapp" || v === "email" || v === "ambos" ? v : null;
}

/** O lugar da referência na pré-visualização; o servidor gera-a e troca-a ao enviar. */
export const REFERENCIA_POR_GERAR = "[a referência Multibanco nova entra aqui ao enviar]";

export type ContaDoValorFinal =
  | {
      modo: "referencia";
      /** O total final, com IVA (ou sem fatura, sem IVA nenhum). */
      total: number;
      semIva: number;
      iva: number;
      comFactura: boolean;
      /** O que se pede agora: o total, ou a diferença das horas. */
      aPedir: number;
      parte: "trabalho" | "diferenca";
      /** Já pago pela estimativa (só na diferença das horas). */
      pagoAteAgora: number;
    }
  | {
      modo: "parceiro";
      total: number;
      semIva: number;
      iva: number;
      faturaDoParceiro: number;
      faturaDaClyon: number;
      regime: RegimeDoProfissional;
    };

type TrabalhoParaOValorFinal = Pick<
  TrabalhoAPagar,
  "acordado" | "taxas" | "modelo" | "acrescimo" | "formaDePagamento" | "novoModelo" | "porHora" | "reservaCent"
>;

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * A CONTA DO VALOR FINAL — os mesmos números do resto da casa: o que o cliente
 * paga (`quantoOClientePaga`, o do «Gerar referência»), a diferença das horas
 * (`acertoDasHoras`) e, no modelo de 15-11, o total pelo regime do parceiro
 * (`totalAoCliente`, com a reserva). Recusa quando o cliente já não está «por
 * receber».
 */
export function contaDoValorFinal(
  t: TrabalhoParaOValorFinal,
  linhas: Pagamento[],
  regime: RegimeDoProfissional,
): { ok: true; conta: ContaDoValorFinal } | { ok: false; porque: string } {
  if (t.novoModelo === true) {
    // O pagamento da negociação é o do parceiro (a parte da CLYON): pago, o cliente já lhe pagou.
    if (linhas.some((l) => l.estado === "pago" && l.parte !== "diferenca")) {
      return { ok: false, porque: "O parceiro já passou à CLYON a parte dela: o cliente já pagou." };
    }
    const c = totalAoCliente(t.acordado, t.taxas, regime, t.reservaCent ?? 0);
    if (!c) return { ok: false, porque: "Este trabalho ainda não tem um valor final." };
    return {
      ok: true,
      conta: {
        modo: "parceiro",
        total: c.total,
        semIva: c.semIva,
        iva: c.iva,
        faturaDoParceiro: c.faturaDoParceiro,
        faturaDaClyon: c.faturaDaTaxa,
        regime: c.regime,
      },
    };
  }
  if (t.formaDePagamento === "dinheiro" || temDividaDoProfissional(t.formaDePagamento, t.modelo)) {
    return { ok: false, porque: "Este trabalho paga-se em dinheiro, no local: não há referência a enviar." };
  }

  const doCliente = linhas.filter(eDoCliente);
  const pagoDoTrabalho = doCliente.find((l) => l.parte !== "diferenca" && l.estado === "pago");
  if (pagoDoTrabalho) {
    const acerto = acertoDasHoras(t, linhas);
    if (!acerto) return { ok: false, porque: "O cliente já pagou este trabalho." };
    if (acerto.aDevolver > 0) {
      return { ok: false, porque: `O cliente pagou ${emEuros(acerto.aDevolver)} a mais: é para lhe devolver, não para cobrar.` };
    }
    if (!(acerto.aPagar > 0)) return { ok: false, porque: "O cliente já pagou o valor final." };
    if (doCliente.some((l) => l.parte === "diferenca" && l.estado === "pago")) {
      return { ok: false, porque: "A diferença das horas já está paga." };
    }
    return {
      ok: true,
      conta: {
        modo: "referencia",
        ...totais(t, acerto.comFactura),
        total: acerto.final,
        comFactura: acerto.comFactura,
        aPedir: acerto.aPagar,
        parte: "diferenca",
        pagoAteAgora: acerto.pagoAteAgora,
      },
    };
  }

  // Sem pagamento: com fatura no modelo do IVA incluído; antes dele, a escolha da última referência (fatura por omissão).
  const ultima = [...doCliente].sort((a, b) => b.id - a.id)[0];
  const comFactura = t.modelo === "iva_incluido" ? true : (ultima?.comFactura ?? true);
  const tot = totais(t, comFactura);
  if (!(tot.total > 0)) return { ok: false, porque: "Este trabalho ainda não tem um valor final." };
  return { ok: true, conta: { modo: "referencia", ...tot, comFactura, aPedir: tot.total, parte: "trabalho", pagoAteAgora: 0 } };
}

function totais(t: TrabalhoParaOValorFinal, comFactura: boolean): { total: number; semIva: number; iva: number } {
  const total = quantoOClientePaga(t.acordado, t.taxas, t.modelo, comFactura, t.acrescimo);
  if (!comFactura) return { total, semIva: total, iva: 0 };
  const semIva =
    t.modelo === "iva_incluido"
      ? contaDoCliente(t.acordado, t.taxas, t.acrescimo).semIva
      : quantoOClientePaga(t.acordado, t.taxas, t.modelo, false, t.acrescimo);
  return { total, semIva, iva: aosCentimos(total - semIva) };
}

/** O total numa frase — com IVA e, ao lado, sem IVA; sem fatura, di-lo. */
export function totalEmPalavras(c: Pick<ContaDoValorFinal, "total" | "semIva" | "iva">): string {
  return c.iva > 0 ? `${emEuros(c.total)} com IVA (${emEuros(c.semIva)} sem IVA)` : `${emEuros(c.total)} (sem fatura)`;
}

/**
 * A SUGESTÃO DO «O QUE MUDOU» — a partir da última folha final gravada: as
 * horas, a equipa, a deslocação e o material. A equipa junta-a se quiser, e
 * pode reescrevê-la.
 */
export function oQueMudouDaFolha(
  e:
    | {
        pessoas?: number;
        horas?: number;
        deslocacao?: { tipo: "km"; km: number } | { tipo: "euros"; cent: number };
        materiais?: { descricao: string; cent: number }[];
      }
    | null
    | undefined,
): string {
  if (!e || !e.horas) return "";
  const virgula = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  const partes = [`${virgula(e.horas)} h de trabalho, com uma equipa de ${e.pessoas === 3 ? 3 : 2} pessoas`];
  if (e.deslocacao?.tipo === "km" && e.deslocacao.km > 0) partes.push(`deslocação de ${virgula(e.deslocacao.km)} km`);
  if (e.deslocacao?.tipo === "euros" && e.deslocacao.cent > 0) partes.push("deslocação");
  const material = (e.materiais ?? []).map((m) => m.descricao.trim()).filter(Boolean);
  if (material.length > 0) partes.push(`material: ${material.join(", ")}`);
  return `A conta final é a do dia do trabalho: ${partes.join("; ")}.`;
}

/** O modelo antigo (e os Trabalhos CLYON): o cliente paga à CLYON (regra s da orquestra). */
export const PAGA_A_CLYON_NO_MODELO_ANTIGO = "Paga à CLYON, que só paga ao parceiro depois de o trabalho estar feito.";

export type ParaPagarAoParceiro = {
  nome: string | null;
  iban: string | null;
  titular: string | null;
  mbway: string | null;
  faturas: { doTrabalho: string | null; daTaxa: string | null };
};

export type DadosDaMensagem = {
  pedidoId: number;
  cliente: string | null;
  conta: ContaDoValorFinal;
  /** O que mudou e porquê — só se a equipa o quiser juntar. */
  oQueMudou?: string | null;
  /** Modo referência: a Multibanco gerada (sem ela, o marcador da pré-visualização). */
  multibanco?: { entidade: string | null; referencia: string | null } | null;
  /** Modo referência: houve pedido MB WAY para o telemóvel do cliente. */
  mbway?: boolean;
  /** Modo parceiro: os dados para pagar e as faturas. */
  parceiro?: ParaPagarAoParceiro | null;
};

/** A mensagem ao cliente, em voz de plataforma («parceiro», nunca quem faz o trabalho é a CLYON). */
export function mensagemDoValorFinal(d: DadosDaMensagem, agora: Date): string {
  const c = d.conta;
  const linhas: (string | null)[] = [
    `${comoTratar(d.cliente, agora)} Aqui é a CLYON.`,
    `O valor final do seu pedido n.º ${d.pedidoId} ficou em ${totalEmPalavras(c)}.`,
    d.oQueMudou?.trim() ? d.oQueMudou.trim() : null,
  ];
  if (c.modo === "referencia") {
    if (c.parte === "diferenca") {
      linhas.push(`Já pagou ${emEuros(c.pagoAteAgora)} pela estimativa. Falta a diferença: ${emEuros(c.aPedir)}${c.iva > 0 ? " (com IVA)" : ""}.`);
    }
    const mb = d.multibanco;
    const multibanco =
      mb && mb.referencia
        ? `Multibanco — Entidade ${mb.entidade ?? "—"}, Referência ${mb.referencia}, Valor ${emEuros(c.aPedir)}`
        : `Multibanco — ${REFERENCIA_POR_GERAR}`;
    linhas.push(
      [
        `Para pagar ${emEuros(c.aPedir)}:`,
        `• ${multibanco}`,
        d.mbway !== false ? "• MB WAY — enviámos um pedido para o seu telemóvel: aceite-o na app MB WAY." : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    linhas.push(PAGA_A_CLYON_NO_MODELO_ANTIGO);
  } else {
    const p = d.parceiro ?? null;
    linhas.push(
      [
        `Paga diretamente ao parceiro${p?.nome ? ` ${p.nome}` : ""}, em duas faturas:`,
        `• Fatura do trabalho, passada pelo parceiro: ${emEuros(c.faturaDoParceiro)}${c.regime === "isento" ? " (isento de IVA)" : " (com IVA)"}`,
        `• Fatura da taxa da plataforma, passada pela CLYON: ${emEuros(c.faturaDaClyon)} (com IVA)`,
      ].join("\n"),
    );
    const formas = [
      p?.iban ? `• Transferência — IBAN ${p.iban}${p.titular ? ` (${p.titular})` : ""}` : null,
      p?.mbway ? `• MB WAY — ${p.mbway}` : null,
    ].filter(Boolean);
    linhas.push(
      formas.length > 0
        ? [`Para pagar ${emEuros(c.total)} ao parceiro:`, ...formas].join("\n")
        : "O parceiro diz-lhe como pagar; se precisar, fale connosco.",
    );
    const faturas = [
      p?.faturas.doTrabalho ? `Fatura do trabalho: ${p.faturas.doTrabalho}` : null,
      p?.faturas.daTaxa ? `Fatura da taxa da plataforma: ${p.faturas.daTaxa}` : null,
    ].filter(Boolean);
    if (faturas.length > 0) linhas.push(faturas.join("\n"));
  }
  linhas.push("Obrigado pela preferência,\nEquipa CLYON");
  return linhas.filter(Boolean).join("\n\n");
}

/** O assunto do email. */
export function assuntoDoValorFinal(pedidoId: number): string {
  return `CLYON — o valor final do seu pedido n.º ${pedidoId}`;
}

/** «WhatsApp e email» — o histórico diz por onde saiu. */
export function canaisEmPalavras(canais: ReadonlyArray<"whatsapp" | "email">): string {
  const nomes = canais.map((c) => (c === "whatsapp" ? "WhatsApp" : "email"));
  return nomes.length === 2 ? `${nomes[0]} e ${nomes[1]}` : (nomes[0] ?? "nenhum canal");
}
