/**
 * O CLIENTE PAGA À CLYON — d82 (CEO e dono, 21-11-2026).
 *
 * Num Trabalho CLYON do modelo de 15-11 o cliente paga diretamente ao parceiro,
 * e o parceiro passa à CLYON a taxa e o IVA dela por uma referência na carteira
 * dele. Às vezes o parceiro pede ao cliente que pague à CLYON. Este é o caminho
 * para isso, só do administrador, com motivo e a escolha com / sem fatura:
 *
 *   · o trabalho passa ao caminho em que o cliente paga à CLYON e a CLYON paga
 *     ao profissional — o mesmo da d58 (`clientePagouOTrabalhoClyon` em
 *     `taxa-a-passar-a-clyon.ts` lê a marca `negociacoes.clientePagaAClyonEm`),
 *     e com ele a lógica do modelo antigo em todo o lado (a Mesa, os Pagamentos,
 *     as Carteiras, a carteira do parceiro, a página do cliente);
 *   · a dívida da taxa na carteira do parceiro desaparece (o trabalho é «pago
 *     pela CLYON»), e as referências por pagar dela ficam canceladas, com o
 *     motivo — nada se apaga;
 *   · o «Enviar o valor final ao cliente» pede o valor certo (sem fatura = o
 *     valor sem IVA, como na d70) e o «Já pagámos ao profissional» a parte dele
 *     (o valor menos a taxa);
 *   · fica no histórico do pedido e no registo, com o antes e o depois.
 *
 * Faz-se antes ou depois de o trabalho estar feito. Desfaz-se (só o
 * administrador, com motivo) enquanto não houver pagamento do cliente nem se
 * tiver pago ao profissional.
 *
 * Puro: a escrita é `cliente-paga-a-clyon-na-base.ts`, a porta
 * `/api/admin/pagamentos/cliente-paga-a-clyon`, o ecrã `ClientePagaAClyon.tsx`.
 */

export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 300;

/** O nome do botão, igual nos Pagamentos e no cartão da Mesa / Trabalhos CLYON. */
export const ROTULO_DO_BOTAO = "O cliente paga à CLYON";

const aosCentimos = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const emEuros = (v: number): string => `${aosCentimos(v).toFixed(2).replace(".", ",")} €`;

export type PedidoDePassagem = {
  accao: "passar";
  negociacaoId: number;
  motivo: string;
  comFatura: boolean;
  /** Um valor «por carga» passa a valor total com este número (sem IVA). Nulo = fica como está. */
  valorTotal: number | null;
  /** Só a conta, sem gravar. */
  previsualizar: boolean;
};

export type PedidoDeDesfazer = {
  accao: "desfazer";
  negociacaoId: number;
  motivo: string;
  previsualizar: boolean;
};

function lerMotivo(v: unknown): { ok: true; motivo: string } | { ok: false; erro: string } {
  const motivo = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (motivo.length < MOTIVO_MINIMO) return { ok: false, erro: "Escreva o motivo." };
  return { ok: true, motivo: motivo.slice(0, MOTIVO_MAXIMO) };
}

/** O corpo do pedido, lido e conferido. A fatura escolhe-se sempre: «com» ou «sem», nunca por omissão. */
export function lerPedidoDoClientePagaAClyon(
  corpo: Record<string, unknown>,
): { ok: true; pedido: PedidoDePassagem | PedidoDeDesfazer } | { ok: false; erro: string } {
  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) return { ok: false, erro: "Trabalho não indicado." };
  const m = lerMotivo(corpo.motivo);
  if (!m.ok) return m;
  const previsualizar = corpo.previsualizar === true;
  if (corpo.accao === "desfazer") return { ok: true, pedido: { accao: "desfazer", negociacaoId, motivo: m.motivo, previsualizar } };
  if (corpo.accao !== "passar") return { ok: false, erro: "Ação desconhecida." };
  if (corpo.fatura !== "com" && corpo.fatura !== "sem") return { ok: false, erro: "Escolha com fatura ou sem fatura." };
  let valorTotal: number | null = null;
  if (corpo.valorTotal != null && corpo.valorTotal !== "") {
    const v = Number(String(corpo.valorTotal).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0 || v > 100_000) return { ok: false, erro: "O valor total não é válido." };
    valorTotal = aosCentimos(v);
  }
  return {
    ok: true,
    pedido: { accao: "passar", negociacaoId, motivo: m.motivo, comFatura: corpo.fatura === "com", valorTotal, previsualizar },
  };
}

export type PorqueNaoPassa =
  | "nao_fechado"
  | "nao_e_trabalho_clyon"
  | "nao_e_do_novo_modelo"
  | "ja_passado"
  | "em_dinheiro"
  | "ja_ha_pagamento"
  | "partes_pagas"
  | "ja_pago_ao_profissional"
  | "base_nao_e_por_carga";

export const PORQUE_NAO_PASSA: Record<PorqueNaoPassa, string> = {
  nao_fechado: "Este trabalho ainda não tem quem o faça (não está contratado).",
  nao_e_trabalho_clyon: "Só nos Trabalhos CLYON.",
  nao_e_do_novo_modelo: "Este trabalho já segue o caminho em que o cliente paga à CLYON.",
  ja_passado: "Já está: o cliente paga à CLYON.",
  em_dinheiro: "Combinado em dinheiro no local: o cliente paga ao profissional.",
  ja_ha_pagamento:
    "Já há um pagamento registado neste trabalho (o parceiro já passou a taxa, ou o cliente já pagou). Corrija primeiro esse pagamento.",
  partes_pagas: "O parceiro já pagou parte da taxa ou do IVA. Corrija primeiro essas partes.",
  ja_pago_ao_profissional: "Já se registou o pagamento ao profissional.",
  base_nao_e_por_carga: "Só um valor «por carga» passa a valor total aqui.",
};

export type TrabalhoParaAPassagem = {
  estado: string;
  trabalhoClyon: boolean;
  novoModelo: boolean;
  passadoEm: unknown;
  formaDePagamento: string | null;
  /** Linhas de `pagamentos` desta negociação já pagas (qualquer parte). */
  pagamentosPagos: number;
  /** Partes da taxa / do IVA já marcadas como pagas (`cobrancasAoProfissional`). */
  partesPagas: number;
  pagoAoProfissionalEm: unknown;
  base: "total" | "carga" | "hora";
};

const temData = (v: unknown) => v != null && v !== "";

/** Porque é que este trabalho não passa ao caminho em que o cliente paga à CLYON — ou `null`, passa. */
export function porqueNaoPassa(t: TrabalhoParaAPassagem, p: Pick<PedidoDePassagem, "valorTotal">): PorqueNaoPassa | null {
  if (t.estado !== "acordada") return "nao_fechado";
  if (!t.trabalhoClyon) return "nao_e_trabalho_clyon";
  if (temData(t.passadoEm)) return "ja_passado";
  if (!t.novoModelo) return "nao_e_do_novo_modelo";
  if (t.formaDePagamento === "dinheiro") return "em_dinheiro";
  if (temData(t.pagoAoProfissionalEm)) return "ja_pago_ao_profissional";
  if (t.pagamentosPagos > 0) return "ja_ha_pagamento";
  if (t.partesPagas > 0) return "partes_pagas";
  if (p.valorTotal != null && t.base !== "carga") return "base_nao_e_por_carga";
  return null;
}

export type PorqueNaoDesfaz = "nao_passado" | "cliente_pagou" | "ja_pago_ao_profissional";

export const PORQUE_NAO_DESFAZ: Record<PorqueNaoDesfaz, string> = {
  nao_passado: "Este trabalho não foi passado ao caminho em que o cliente paga à CLYON.",
  cliente_pagou: "O cliente já pagou à CLYON: já não se desfaz. Corrija primeiro esse pagamento.",
  ja_pago_ao_profissional: "Já se registou o pagamento ao profissional: já não se desfaz.",
};

/** Porque é que a passagem não se desfaz — ou `null`, desfaz-se. */
export function porqueNaoDesfaz(t: {
  passadoEm: unknown;
  /** Linhas do cliente (não «divida») já pagas. */
  pagamentosDoClientePagos: number;
  pagoAoProfissionalEm: unknown;
}): PorqueNaoDesfaz | null {
  if (!temData(t.passadoEm)) return "nao_passado";
  if (temData(t.pagoAoProfissionalEm)) return "ja_pago_ao_profissional";
  if (t.pagamentosDoClientePagos > 0) return "cliente_pagou";
  return null;
}

/** O que muda, para o histórico, o registo e o diálogo. */
export type OAntes = {
  /** O que o cliente pagava ao parceiro. */
  clientePagavaAoParceiro: number | null;
  /** O que o parceiro passava à CLYON (a taxa e o IVA dela). */
  parceiroPassavaAClyon: number | null;
  semFactura: boolean;
  base: "total" | "carga" | "hora";
  valor: number | null;
};

export type ODepois = {
  /** O que o cliente paga à CLYON. */
  clientePaga: number;
  comFatura: boolean;
  /** O que a CLYON paga ao profissional (o valor menos a taxa). */
  profissionalRecebe: number;
  /** O que fica para a CLYON (a taxa). */
  clyon: number;
  base: "total" | "carga" | "hora";
  valor: number | null;
};

export type ReferenciaCancelada = { pagamentoId: number; metodo: string; valor: number };

/** A frase do histórico do pedido e do registo, quando passa. */
export function fraseDaPassagem(a: {
  quem: string;
  motivo: string;
  antes: OAntes;
  depois: ODepois;
  referenciasCanceladas: number;
}): string {
  const valorAoCliente = a.depois.comFatura
    ? `${emEuros(a.depois.clientePaga)} com IVA`
    : `${emEuros(a.depois.clientePaga)} (sem fatura)`;
  const base =
    a.antes.base === "carga" && a.depois.base === "total" && a.depois.valor != null
      ? ` O valor por carga passa a valor total: ${emEuros(a.depois.valor)} sem IVA.`
      : "";
  const antes =
    a.antes.clientePagavaAoParceiro != null && a.antes.parceiroPassavaAClyon != null
      ? ` Antes: o cliente pagava ${emEuros(a.antes.clientePagavaAoParceiro)} ao parceiro e o parceiro passava ${emEuros(a.antes.parceiroPassavaAClyon)} à CLYON.`
      : "";
  const refs =
    a.referenciasCanceladas > 0
      ? ` ${a.referenciasCanceladas === 1 ? "A referência por pagar da taxa do parceiro ficou cancelada" : `As ${a.referenciasCanceladas} referências por pagar da taxa do parceiro ficaram canceladas`}.`
      : "";
  return (
    `O cliente paga à CLYON, por ${a.quem}: ${valorAoCliente}; a CLYON paga ${emEuros(a.depois.profissionalRecebe)} ao profissional ` +
    `e fica com ${emEuros(a.depois.clyon)}. A taxa deixa de estar na carteira do parceiro.${base}${antes}${refs} Motivo: «${a.motivo}».`
  );
}

/** A frase do histórico do pedido e do registo, quando se desfaz. */
export function fraseDoDesfazer(a: { quem: string; motivo: string; referenciasCanceladas: number }): string {
  const refs =
    a.referenciasCanceladas > 0
      ? ` ${a.referenciasCanceladas === 1 ? "A referência por pagar do cliente ficou cancelada" : `As ${a.referenciasCanceladas} referências por pagar do cliente ficaram canceladas`}.`
      : "";
  return (
    `Desfeito por ${a.quem}: o cliente volta a pagar ao parceiro, e o parceiro passa à CLYON a taxa e o IVA dela, ` +
    `pela referência na carteira dele. A fatura e o valor voltam ao que eram.${refs} Motivo: «${a.motivo}».`
  );
}

/** Uma entrada do histórico guardado na negociação (`clientePagaAClyonHistoricoJson`). */
export type EntradaDoHistorico = {
  accao: "passar" | "desfazer";
  em: string;
  por: string;
  motivo: string;
  /** O que estava na negociação e no pedido antes — o desfazer repõe-no. */
  antes: {
    semFactura: boolean;
    motivoSemFactura: string | null;
    taxaCliente: number | null;
    taxaProfissional: number | null;
    taxasComFacturaJson: string | null;
    base: "total" | "carga" | "hora";
    valorFixoClyon: number | null;
    precoClienteClyon: number | null;
    valorAcordado: number | null;
  };
  /** Os números do antes e do depois (o que se escreve no histórico do pedido). */
  conta?: { antes: OAntes; depois: ODepois } | null;
  referenciasCanceladas: ReferenciaCancelada[];
};

/** O histórico guardado, lido; um texto ilegível dá uma lista vazia. */
export function lerHistorico(v: unknown): EntradaDoHistorico[] {
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    const j = JSON.parse(v);
    return Array.isArray(j) ? (j as EntradaDoHistorico[]) : [];
  } catch {
    return [];
  }
}

/** A última passagem do histórico — a que o desfazer repõe. */
export function ultimaPassagem(h: EntradaDoHistorico[]): EntradaDoHistorico | null {
  for (let i = h.length - 1; i >= 0; i--) if (h[i].accao === "passar") return h[i];
  return null;
}

/** A passagem gravada na linha (quando, por quem, porquê), ou `null`. */
export function lerPassagem(l: {
  clientePagaAClyonEm?: unknown;
  clientePagaAClyonPor?: unknown;
  clientePagaAClyonMotivo?: unknown;
}): { em: unknown; por: string | null; motivo: string | null } | null {
  if (!temData(l.clientePagaAClyonEm)) return null;
  return {
    em: l.clientePagaAClyonEm,
    por: typeof l.clientePagaAClyonPor === "string" ? l.clientePagaAClyonPor : null,
    motivo: typeof l.clientePagaAClyonMotivo === "string" ? l.clientePagaAClyonMotivo : null,
  };
}
