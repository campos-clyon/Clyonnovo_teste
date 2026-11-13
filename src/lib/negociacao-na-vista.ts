import { estaVerificado } from "./parceiro-verificado";
import { guiaImpedeContratar } from "./guia-antes-de-contratar";
import type { Proposta } from "./negociacao";
import { faseParaOCliente, diasAteLibertar } from "./trabalho";
import { ajustesDe, vistaDoAjuste, type VistaDoAjuste } from "./ajuste-no-local";
import { instanteDaBase } from "./hora-de-lisboa";
import type { HorasNaBase } from "./horas-do-trabalho";
import { novoModeloEmVigor, TRABALHOS_CLYON_NO_MODELO_ANTIGO } from "./novo-modelo";
import type { PerguntaDoFecho } from "./fecho-do-modelo-novo";
import { perfilFiscalDoParceiro, type PerfilFiscal } from "./perfil-fiscal";
import { totaisDoNovoModelo, totalDoValor, type TotaisDoNovoModelo } from "./total-ao-cliente";
import { lerComoPagar, type ComoPagarAoParceiro } from "./pagar-ao-parceiro";

/**
 * O QUE O CLIENTE VÊ DO MODELO DE 15-11-2026 — d10 (`novo-modelo.ts`). `null`
 * antes da data e nos Trabalhos CLYON: nada muda no ecrã.
 *
 * Antes de contratar, serve para escolher: o tipo de fatura do parceiro, se emite
 * a guia, e a conta do preço (sem IVA, a fatura do trabalho, a da taxa e o total).
 * Depois de contratar, quem diz se paga ao parceiro é o servidor
 * (`GET /api/pagamentos` → `pagaAoParceiro`; `/api/pagamentos/ao-parceiro` → IBAN e
 * MB WAY): um trabalho já pago à CLYON antes de 15-11 segue o modelo antigo.
 */
export type NovoModeloNaVista = {
  perfilFiscal: PerfilFiscal;
  /**
   * O total com IVA que o cliente paga ao parceiro (as duas faturas), em euros,
   * do valor acordado ou, a negociar, da última proposta. `null` sem valor. Só o
   * total: a divisão (a fatura da taxa) vem do servidor depois de contratar.
   * A conta é `totalAoClienteDaNegociacao` (`total-ao-cliente.ts`, d17): o
   * mesmo número do bloco «Pagar a …», do email e da app.
   */
  total: number | null;
  /** O mesmo total sem IVA — nunca se mostra sozinho (d17). */
  semIva: number | null;
  /** Como o cliente escolheu pagar ao parceiro (`null` = ainda não escolheu). */
  pagarAoParceiroPor: ComoPagarAoParceiro | null;
};

/**
 * A NEGOCIAÇÃO COMO O CLIENTE A VÊ — uma função só (d8, R5, 28-10-2026).
 *
 * Havia duas cópias desta conversão: a da página do link (`VistaDoPedido.tsx`,
 * no servidor) e a da conta (`OrderDetailModal.tsx`, no browser), e já tinham
 * divergido — a da conta não passava a marca «sem fatura», e mostrava com IVA
 * o preço que o link mostrava sem ele; a do link não passava a avaliação já
 * dada, e voltava a pedi-la. A app de cliente era a terceira.
 *
 * Agora as três portas convertem por aqui: a página (`vista-do-pedido.ts`, que
 * junta os perfis), a conta (no browser — por isso este ficheiro não toca na
 * base) e a rota da app (`/api/cliente/pedidos/[id]`).
 *
 * A LINHA JÁ VEM PELA REGRA. Quem chama passou as negociações por
 * `negociacoesParaOCliente` (Trabalho CLYON sem nenhuma, só quem fez proposta,
 * sem a taxa do profissional, telefone só depois de contratado). Esta função
 * não filtra: converte.
 */

/** O perfil público do profissional, já em texto para atravessar até ao ecrã. */
export type PerfilNaVista = {
  naClyonDesde: string | null;
  trabalhosConcluidos: number;
  notaMedia: number | null;
  quantasAvaliacoes: number;
  categorias: string[];
  raioKm: number | null;
  avaliacoes: Array<{
    estrelas: number;
    comentario: string | null;
    avaliadoEm: string | null;
    servicoTipo: string | null;
    cidade: string | null;
    /** d6: registada pela CLYON a pedido do cliente. */
    registadaPelaClyon?: boolean;
  }>;
};

export type NegociacaoDoCliente = {
  id: number;
  estado: string;
  valorAcordado: number | null;
  /*
   * A COMISSÃO COM QUE ESTA NEGOCIAÇÃO NASCEU.
   *
   * O total deste ecrã é o número que o cliente decide em cima — e é uma
   * promessa. A taxa pode mudar no backoffice; o que já foi mostrado a alguém
   * não pode mudar com ela. Nulas querem dizer "anterior a isto" e valem as de
   * origem. A do profissional não chega aqui (d33): o preço do cliente faz-se
   * só com esta.
   */
  taxaCliente?: string | number | null;
  /** Como o cliente paga esta negociação. Nulo = na plataforma. */
  formaDePagamento?: string | null;
  acrescimoPagamento?: string | number | null;
  /**
   * QUANDO A NEGOCIAÇÃO ABRIU — decide o modelo do preço (01-10-2026). Sem
   * ela, o modelo antigo: ninguém vê um preço subir por um campo em falta.
   */
  criadaEm?: string | Date | null;
  /** Sem fatura (21-10-2026): sem IVA — ver `sem-factura.ts`. */
  semFactura?: number | null;
  propostas: Proposta[];
  profissionalNome: string;
  /*
   * O perfil público, calculado no servidor com dados REAIS. Pode ser null
   * (conta entretanto apagada, ou a conta, que não o carrega) e pode vir vazio
   * — zero avaliações, zero trabalhos. O ecrã diz a verdade nos dois casos.
   */
  perfil?: PerfilNaVista | null;
  /** "isento" ou "normal" — decide se há linha de IVA na confirmação. */
  regimeIva: string;
  guiaVerificada: boolean;
  /**
   * O trabalho exige a guia de resíduos e a dele está por verificar: não se
   * contrata (04-11-2026, d10.1) — ver `guia-antes-de-contratar.ts`.
   */
  guiaPorVerificar?: boolean;
  /** NIF, identidade e contacto confirmados — o único caso em que o cliente lê «verificado» (01-11-2026). */
  verificado: boolean;
  /** Só depois de o contratar. */
  profissionalTelefone: string | null;
  fase: "a_negociar" | "a_executar" | "a_confirmar" | "confirmado" | "pago";
  provaJson: string | null;
  diasAteLibertar: number | null;
  /** A avaliação que ele já deu, se deu. */
  estrelas?: number | null;
  /** As datas do fim, para o histórico contar a história toda. */
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
  avaliadoEm?: Date | string | null;
  /** O dia combinado e o terreno (a caminho, chegou) — a linha do tempo da app. */
  dataCombinada?: Date | string | null;
  aCaminhoEm?: Date | string | null;
  /** «Estou próximo» e a chegada confirmada pelo cliente (30-10-2026) — viagem-ate-ao-cliente.ts. */
  proximoEm?: Date | string | null;
  chegouEm?: Date | string | null;
  chegadaConfirmadaEm?: Date | string | null;
  /** O ajuste no local (18-10-2026), já decidido no servidor — ver `ajuste-no-local.ts`. */
  ajuste?: VistaDoAjuste | null;
  /** O valor é por carga e não pelo trabalho todo — ver `base-do-preco.ts`. */
  porCarga?: boolean;
  /**
   * POR HORA (31-10-2026): o valor é por hora, as horas previstas do pedido
   * (para a estimativa, mínimo 3), as horas marcadas pelo parceiro e os
   * materiais da proposta — ver horas-do-trabalho.ts e materiais-da-proposta.ts.
   */
  porHora?: boolean;
  horasPrevistas?: number | null;
  horas?: HorasNaBase | null;
  materiaisJson?: string | null;
  /** O modelo de 15-11-2026 (d10) — `null` antes da data. */
  novoModelo?: NovoModeloNaVista | null;
  /**
   * OS TOTAIS DO MODELO NOVO DE CADA VALOR (d17) — o acordado, as propostas e
   * os ajustes, já no preço do cliente, para o cartão, a linha do tempo e a app
   * dizerem o número do bloco «Pagar a …». Feitos no servidor
   * (`novoModeloParaOCliente`); `null` fora do modelo novo. Não saem para o ecrã:
   * saem os textos feitos com eles.
   */
  totaisNoNovoModelo?: TotaisDoNovoModelo | null;
  /**
   * «O TRABALHO JÁ FOI FEITO?» (d15, 13-11-2026) — 48 h depois da data, no modelo
   * novo, sem o «Está feito» do parceiro. Posta no servidor
   * (`negociacoesDaVistaDoCliente`), com o modelo conferido pelos pagamentos.
   */
  perguntaDoFecho?: PerguntaDoFecho | null;
};

/**
 * O mínimo que a conversão lê de uma linha — como vem da base (`SELECT n.*`)
 * ou do JSON da conta. Tudo opcional e solto de propósito: a mesma função
 * serve as duas, e um campo que não veio vale «não há».
 */
export type LinhaParaAVista = HorasNaBase & {
  id: number | string;
  estado: string;
  valorAcordado?: unknown;
  taxaCliente?: string | number | null;
  formaDePagamento?: string | null;
  acrescimoPagamento?: string | number | null;
  createdAt?: Date | string | null;
  semFactura?: number | null;
  propostasJson?: unknown;
  profissionalNome?: unknown;
  profissionalTelefone?: string | null;
  regimeIva?: unknown;
  guiaVerificadaEm?: unknown;
  /** d10: o regime confirmado, a guia declarada, o regime congelado, o Trabalho CLYON e a forma de pagar ao parceiro. */
  regimeIvaConfirmadoEm?: unknown;
  emiteGuiaTransporte?: unknown;
  regimeDoProfissional?: unknown;
  ofertaClyon?: unknown;
  pagarAoParceiroPor?: unknown;
  /** O estado da conta dele e quando foi aprovado — a transição da guia (d10 v2). Não saem para o ecrã. */
  profissionalEstado?: unknown;
  aprovadoEm?: unknown;
  parceiroVerificado?: unknown;
  provaJson?: string | null;
  ajustesJson?: string | null;
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
  estrelas?: unknown;
  avaliadoEm?: Date | string | null;
  dataCombinada?: Date | string | null;
  aCaminhoEm?: Date | string | null;
  proximoEm?: Date | string | null;
  chegouEm?: Date | string | null;
  chegadaConfirmadaEm?: Date | string | null;
};

function propostasDe(v: unknown): Proposta[] {
  if (Array.isArray(v)) return v as Proposta[];
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    const l = JSON.parse(v);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

function numeroOuNulo(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** O que o cliente faz a esta negociação, no ecrã da página, da conta e da app. */
export function negociacaoParaAVista(
  n: LinhaParaAVista,
  o: {
    porCarga: boolean;
    porHora?: boolean;
    horasPrevistas?: number | null;
    perfil?: PerfilNaVista | null;
    agora: Date;
    /** O pedido exige a guia de resíduos (`trabalhoExigeGuia`) — 04-11-2026, d10.1. */
    exigeGuia?: boolean;
    /**
     * O que o servidor sabe desta negociação no modelo de 15-11 (d17,
     * `novoModeloParaOCliente`): se segue o modelo novo com os pagamentos lidos,
     * e os totais pelas taxas dela. Sem ele, a conta faz-se com o que a linha traz.
     */
    novoModeloDoServidor?: { segue: boolean; totais: TotaisDoNovoModelo } | null;
  },
): NegociacaoDoCliente {
  const novoModelo = novoModeloComTotais(n, numeroOuNulo(n.valorAcordado), o.agora, o.novoModeloDoServidor);
  const contratado = n.estado === "acordada";
  const valorAcordado = numeroOuNulo(n.valorAcordado);
  // Para o cliente, pago ao profissional antes de confirmar não fecha (BO27, 29-10-2026).
  const fase = faseParaOCliente({
    estado: n.estado,
    execucaoEnviadaEm: n.execucaoEnviadaEm,
    confirmadoEm: n.confirmadoEm,
    pagoEm: n.pagoEm,
  });
  const criadaEm = instanteDaBase(n.createdAt ?? null);
  return {
    perfil: o.perfil ?? null,
    id: Number(n.id),
    estado: n.estado,
    valorAcordado,
    // A comissão desta negociação, para o total que o ecrã mostra ser o
    // mesmo com que ela nasceu — e não o de hoje.
    taxaCliente: n.taxaCliente ?? null,
    // COMO ELE PAGA: o ecrã divide a conta em dinheiro e diz o que acontece ao
    // valor em cada forma — sem ela, toda a gente lia a de quem paga pela plataforma.
    formaDePagamento: n.formaDePagamento ?? null,
    acrescimoPagamento: n.acrescimoPagamento ?? null,
    // QUANDO ABRIU — decide o modelo do preço (IVA incluído desde o corte).
    criadaEm: criadaEm ? criadaEm.toISOString() : null,
    // E a marca «sem fatura» (21-10-2026), que lhe tira o IVA.
    semFactura: n.semFactura ?? null,
    propostas: propostasDe(n.propostasJson),
    profissionalNome: String(n.profissionalNome ?? ""),
    // O contacto do profissional só depois de o contratar — a simetria do que
    // fazemos com a morada do cliente do outro lado.
    profissionalTelefone: contratado ? (n.profissionalTelefone ?? null) : null,
    regimeIva: String(n.regimeIva ?? "isento"),
    guiaVerificada: n.guiaVerificadaEm != null,
    // Só antes de contratado: depois, a pergunta já não se põe. Na transição de
    // 7 dias (d10 v2) o aprovado antes de 04-11 contrata-se, e o cliente não vê aviso.
    guiaPorVerificar:
      o.exigeGuia === true &&
      !contratado &&
      guiaImpedeContratar(
        { precisaGuiaTransporte: 1 },
        { guiaVerificadaEm: n.guiaVerificadaEm, estado: n.profissionalEstado, aprovadoEm: n.aprovadoEm },
        o.agora,
      ),
    verificado: estaVerificado({ parceiroVerificado: n.parceiroVerificado ?? 0 }),
    fase,
    // O ajuste no local por responder (18-10-2026) — ver `ajuste-no-local.ts`.
    ajuste: contratado
      ? vistaDoAjuste(
          { estado: n.estado, fase, valorAcordado, ajustes: ajustesDe(n.ajustesJson ?? null) },
          o.agora,
        )
      : null,
    novoModelo: novoModelo?.vista ?? null,
    totaisNoNovoModelo: novoModelo?.totais ?? null,
    porCarga: o.porCarga,
    // Por hora (31-10-2026): as horas e os materiais vão com a negociação.
    porHora: o.porHora === true,
    horasPrevistas: o.horasPrevistas ?? null,
    horas: {
      valorPorHora: n.valorPorHora ?? null,
      horasInicioEm: n.horasInicioEm ?? null,
      horasFimEm: n.horasFimEm ?? null,
      horasMinutos: n.horasMinutos ?? null,
      horasFaturadas: n.horasFaturadas ?? null,
      valorDasHoras: n.valorDasHoras ?? null,
      horasMarcadasEm: n.horasMarcadasEm ?? null,
      horasConfirmadasEm: n.horasConfirmadasEm ?? null,
      horasConfirmadasPor: n.horasConfirmadasPor ?? null,
      horasContestadasEm: n.horasContestadasEm ?? null,
      horasContestacao: n.horasContestacao ?? null,
      materiaisJson: n.materiaisJson ?? null,
      materiaisUsadosJson: n.materiaisUsadosJson ?? null,
      // A folha da mudança (11-11-2026): o cliente vê-a inteira, e o histórico.
      folhaJson: n.folhaJson ?? null,
      folhaHistoricoJson: n.folhaHistoricoJson ?? null,
      folhaNaMesaEm: n.folhaNaMesaEm ?? null,
      tarifaCongeladaJson: n.tarifaCongeladaJson ?? null,
    },
    materiaisJson: n.materiaisJson ?? null,
    provaJson: n.provaJson ?? null,
    // Sem fotografias não há prazo a anunciar (26-10-2026).
    diasAteLibertar: diasAteLibertar(
      {
        estado: n.estado,
        execucaoEnviadaEm: n.execucaoEnviadaEm,
        confirmadoEm: n.confirmadoEm,
        pagoEm: n.pagoEm,
        provaJson: n.provaJson ?? null,
      },
      o.agora,
    ),
    estrelas: numeroOuNulo(n.estrelas),
    execucaoEnviadaEm: n.execucaoEnviadaEm ?? null,
    confirmadoEm: n.confirmadoEm ?? null,
    pagoEm: n.pagoEm ?? null,
    avaliadoEm: n.avaliadoEm ?? null,
    dataCombinada: n.dataCombinada ?? null,
    aCaminhoEm: n.aCaminhoEm ?? null,
    proximoEm: n.proximoEm ?? null,
    chegouEm: n.chegouEm ?? null,
    chegadaConfirmadaEm: n.chegadaConfirmadaEm ?? null,
  };
}

/** «Quando» do pedido, em palavras — o mesmo na página, na conta e na app. */
export const QUANDO_EM_PALAVRAS: Readonly<Record<string, string>> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  this_week: "Esta semana",
  next_week: "Próxima semana",
  flexible: "Sem pressa",
};

/**
 * O bloco do modelo de 15-11 (d10) para uma negociação — `null` antes da data,
 * num Trabalho CLYON, ou quando o servidor diz que ela fica no modelo antigo (um
 * pagamento à CLYON antes do corte — `pagoAClyonAntesDoCorte`, d17).
 */
export function novoModeloNaVista(
  n: LinhaParaAVista,
  valorAcordado: number | null,
  agora: Date,
  doServidor?: { segue: boolean; totais: TotaisDoNovoModelo } | null,
): NovoModeloNaVista | null {
  return novoModeloComTotais(n, valorAcordado, agora, doServidor)?.vista ?? null;
}

/** O mesmo bloco e os totais de cada valor da negociação (d17). */
export function novoModeloComTotais(
  n: LinhaParaAVista,
  valorAcordado: number | null,
  agora: Date,
  doServidor?: { segue: boolean; totais: TotaisDoNovoModelo } | null,
): { vista: NovoModeloNaVista; totais: TotaisDoNovoModelo } | null {
  if (!novoModeloEmVigor(agora)) return null;
  const clyon = n.ofertaClyon != null && n.ofertaClyon !== "";
  if (TRABALHOS_CLYON_NO_MODELO_ANTIGO && clyon) return null;
  if (doServidor && !doServidor.segue) return null;
  const perfilFiscal = perfilFiscalDoParceiro(n);
  const propostas = propostasDe(n.propostasJson);
  const valor = valorAcordado ?? (propostas.length > 0 ? Number(propostas[propostas.length - 1].valor) : null);
  // Os totais do servidor (as taxas da negociação); sem ele, os da linha.
  const totais =
    doServidor?.totais ??
    totaisDoNovoModelo(n, [valorAcordado, ...propostas.map((p) => p.valor), ...ajustesDe(n.ajustesJson ?? null).flatMap((a) => [a.valorNovo, a.valorAntigo])]);
  const t = totalDoValor(totais, valor);
  return {
    vista: {
      perfilFiscal,
      total: t?.total ?? null,
      semIva: t?.semIva ?? null,
      pagarAoParceiroPor: lerComoPagar(n.pagarAoParceiroPor),
    },
    totais,
  };
}
