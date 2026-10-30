import type { Proposta } from "./negociacao";
import { faseParaOCliente, diasAteLibertar } from "./trabalho";
import { ajustesDe, vistaDoAjuste, type VistaDoAjuste } from "./ajuste-no-local";
import { instanteDaBase } from "./hora-de-lisboa";

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
};

/**
 * O mínimo que a conversão lê de uma linha — como vem da base (`SELECT n.*`)
 * ou do JSON da conta. Tudo opcional e solto de propósito: a mesma função
 * serve as duas, e um campo que não veio vale «não há».
 */
export type LinhaParaAVista = {
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
  o: { porCarga: boolean; perfil?: PerfilNaVista | null; agora: Date },
): NegociacaoDoCliente {
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
    fase,
    // O ajuste no local por responder (18-10-2026) — ver `ajuste-no-local.ts`.
    ajuste: contratado
      ? vistaDoAjuste(
          { estado: n.estado, fase, valorAcordado, ajustes: ajustesDe(n.ajustesJson ?? null) },
          o.agora,
        )
      : null,
    porCarga: o.porCarga,
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
