import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
import { dividaDoProfissional, temDividaDoProfissional } from "./divida-do-profissional";
import { modeloDaNegociacao } from "./iva-incluido";
import { lerForma } from "./forma-de-pagamento";
import { DIAS_ATE_LIBERTAR_SOZINHO, lerQuemConfirmou } from "./trabalho";
import type { DestinoDoValor } from "./carteira";

/**
 * O FIM DO TRABALHO, DITO IGUAL NO PAINEL, NA APP E NO AVISO — 28-10-2026 (d4).
 *
 * Num trabalho confirmado o painel dizia a todos «Confirmado pelo cliente — o
 * valor está disponível na sua carteira». Era falso quando confirmou a CLYON
 * (sem fotografias, ou num Trabalho CLYON) ou o prazo, quando o cliente ainda
 * não pagou (por cobrar) e quando foi em dinheiro (está com ele). O email do
 * trabalho confirmado já sabia os casos (`textoDoTrabalhoConfirmado`); o
 * painel, a app e o aviso no telemóvel não.
 *
 * Aqui fica a regra, pura e sem imports de servidor, para a app a importar:
 *
 *   · `tituloDoConfirmado` — quem confirmou e quando, se a base o souber;
 *   · `ondeEstaODinheiro`  — o caso e a frase da linha do dinheiro;
 *   · `avisoDoConfirmado`  — o corpo do aviso «Trabalho confirmado».
 *
 * O caso escolhe-se como a carteira escolhe (`destinoDoValorConcluido`): em
 * dinheiro, está com ele; o cliente ainda não pagou, por cobrar; o resto,
 * disponível. Com `pagoEm`, pago a esse dia.
 */

/** Onde está o dinheiro de um trabalho confirmado. */
export type OndeEstaODinheiro = "disponivel" | "por_cobrar" | "em_mao" | "em_mao_com_divida" | "pago";

function euros(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

const DIA = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function comoData(v: Date | string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «28/10/2026», à hora de Lisboa — ou "" sem data. */
export function diaDeLisboa(v: Date | string | null | undefined): string {
  const d = comoData(v);
  return d ? DIA.format(d) : "";
}

/**
 * QUEM CONFIRMOU, E QUANDO — o título do cartão de um trabalho confirmado.
 *
 *   · «Confirmado pelo cliente a 28/10/2026»
 *   · «Confirmado pela CLYON, com o cliente, a 28/10/2026» (num Trabalho CLYON,
 *     «Confirmado pela CLYON a …»: aí não há cliente a ouvir)
 *   · «Confirmado sozinho a 28/10/2026, 7 dias depois das fotografias»
 *   · «Confirmado» — quando a base não sabe quem (os de antes de 28-10-2026).
 */
export function tituloDoConfirmado(p: {
  confirmadoPor?: unknown;
  confirmadoEm?: Date | string | null;
  ofertaClyon?: boolean;
}): string {
  const por = lerQuemConfirmou(p.confirmadoPor);
  if (!por) return "Confirmado";
  const dia = diaDeLisboa(p.confirmadoEm);
  const a = dia ? ` a ${dia}` : "";
  if (por === "cliente") return `Confirmado pelo cliente${a}`;
  if (por === "clyon") {
    if (p.ofertaClyon) return `Confirmado pela CLYON${a}`;
    return dia ? `Confirmado pela CLYON, com o cliente, a ${dia}` : "Confirmado pela CLYON, com o cliente";
  }
  return `Confirmado sozinho${a}, ${DIAS_ATE_LIBERTAR_SOZINHO} dias depois das fotografias`;
}

/**
 * O CASO DO DINHEIRO, pelos mesmos predicados da carteira.
 *
 * `clientePagou`: `false` só quando a carteira pergunta e o pagamento não
 * entrou (por cobrar); `null`/`true` — não se pergunta, ou já pagou. É o
 * campo `clientePagou` que a rota dos trabalhos dá ao painel e à app.
 *
 * Em dinheiro manda «em mão», mesmo com `pagoEm`: a CLYON não transfere nada
 * num trabalho pago no local, e um «pago» antigo marcado por engano não o
 * torna verdade.
 */
export function casoDoDinheiro(t: {
  fase: string;
  emDinheiro: boolean;
  comDivida: boolean;
  clientePagou?: boolean | null;
}): OndeEstaODinheiro | null {
  if (t.fase !== "confirmado" && t.fase !== "pago") return null;
  if (t.emDinheiro) return t.comDivida ? "em_mao_com_divida" : "em_mao";
  if (t.fase === "pago") return "pago";
  if (t.clientePagou === false) return "por_cobrar";
  return "disponivel";
}

/** O caso a partir do destino que o email e a carteira usam. */
export function casoDoDestino(destino: DestinoDoValor, comDivida: boolean): OndeEstaODinheiro {
  if (destino === "em_mao") return comDivida ? "em_mao_com_divida" : "em_mao";
  return destino;
}

/** As frases de cada caso — as do Produto (proposta 3a de 28-10-2026). */
export function fraseDoDinheiro(
  caso: OndeEstaODinheiro,
  v: {
    /** O que é dele, já com a taxa da plataforma descontada. */
    liquido: number;
    /** Em dinheiro com IVA incluído: o que o cliente lhe deu e o que é da CLYON. */
    divida?: { recebidoDoCliente: number; total: number } | null;
    pagoEm?: Date | string | null;
  },
): string {
  const x = euros(v.liquido);
  switch (caso) {
    case "disponivel":
      return `${x} estão na sua carteira, prontos a transferir — o pedido de transferência é tratado em menos de 24 horas.`;
    case "por_cobrar":
      return `Os ${x} passam para a sua carteira assim que o pagamento do cliente entrar.`;
    case "em_mao":
      return `Foi pago em dinheiro no local: os ${x} já estão consigo.`;
    case "em_mao_com_divida":
      return v.divida
        ? `Dos ${euros(v.divida.recebidoDoCliente)} que recebeu, ${x} são seus; ${euros(v.divida.total)} de IVA e taxa da plataforma são da CLYON.`
        : `Foi pago em dinheiro no local: os ${x} já estão consigo.`;
    case "pago": {
      const dia = diaDeLisboa(v.pagoEm);
      return dia ? `Pago a ${dia}: ${x} transferidos para a sua conta.` : `Pago: ${x} transferidos para a sua conta.`;
    }
  }
}

/** O que o painel e a app sabem de um trabalho — os campos da rota dos trabalhos. */
export type TrabalhoParaODinheiro = {
  fase: string;
  formaDePagamento?: string | null;
  clientePagou?: boolean | null;
  valorAcordado?: number | string | null;
  /** As taxas DESTA negociação (`taxas` na rota). Sem elas, as de origem. */
  taxas?: { cliente?: unknown; profissional?: unknown } | null;
  /** Quando a negociação abriu (`criadaEm`): decide se há IVA incluído. */
  criadaEm?: Date | string | null;
  pagoEm?: Date | string | null;
};

/**
 * ONDE ESTÁ O DINHEIRO DESTE TRABALHO — o caso, a frase e o líquido.
 * `null` antes de confirmado, ou sem valor acordado.
 */
export function ondeEstaODinheiro(
  t: TrabalhoParaODinheiro,
): { caso: OndeEstaODinheiro; frase: string; liquido: number } | null {
  const acordado = t.valorAcordado != null ? Number(t.valorAcordado) : NaN;
  if (!Number.isFinite(acordado)) return null;
  const taxas = taxasDaNegociacao(
    t.taxas ? { taxaCliente: t.taxas.cliente, taxaProfissional: t.taxas.profissional } : null,
  );
  const emDinheiro = lerForma(t.formaDePagamento) === "dinheiro";
  const comDivida = emDinheiro && temDividaDoProfissional(t.formaDePagamento, modeloDaNegociacao(t.criadaEm ?? null));
  const caso = casoDoDinheiro({ fase: t.fase, emDinheiro, comDivida, clientePagou: t.clientePagou });
  if (!caso) return null;
  const liquido = quantoOProfissionalRecebe(acordado, taxas);
  const divida = comDivida ? dividaDoProfissional(acordado, taxas) : null;
  return { caso, liquido, frase: fraseDoDinheiro(caso, { liquido, divida, pagoEm: t.pagoEm }) };
}

/**
 * O AVISO «TRABALHO CONFIRMADO» DIZ O CASO — proposta 3c do Produto.
 * O título fica «Trabalho confirmado»; o corpo diz onde está o dinheiro.
 */
export function avisoDoConfirmado(p: {
  pedidoId: number;
  caso: OndeEstaODinheiro;
  liquido: number;
  /** Em dinheiro com IVA incluído: o que entrega à CLYON. */
  aPagarAClyon?: number | null;
}): { title: string; body: string } {
  const inicio = `O pedido #${p.pedidoId} ficou confirmado.`;
  const x = euros(p.liquido);
  let resto: string;
  switch (p.caso) {
    case "disponivel":
      resto = `${x} na sua carteira — pode pedir a transferência.`;
      break;
    case "por_cobrar":
      resto = `Os ${x} ficam na carteira quando o cliente pagar.`;
      break;
    case "em_mao_com_divida":
      resto =
        p.aPagarAClyon != null && Number.isFinite(p.aPagarAClyon)
          ? `Pago em dinheiro: entregue à CLYON ${euros(p.aPagarAClyon)}.`
          : "Pago em dinheiro: veja na carteira o que entrega à CLYON.";
      break;
    case "em_mao":
      resto = `Pago em dinheiro: os ${x} já estão consigo.`;
      break;
    case "pago":
      resto = `${x} transferidos para a sua conta.`;
      break;
  }
  return { title: "Trabalho confirmado", body: `${inicio} ${resto}` };
}
