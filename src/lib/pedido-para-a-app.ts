import { precoDoCliente, desdobramentoDoIva, type PrecoDoCliente } from "./preco-do-cliente";
import { taxasDaNegociacao, TAXA_IVA } from "./taxas-plataforma";
import { modeloDaLinha } from "./sem-factura";
import { notaDoPrecoParaOCliente } from "./itens-a-mais";
import type { BaseDoPreco } from "./base-do-preco";
import { promessaDaForma, prazoAutomaticoPorExtenso } from "./pagamento-na-plataforma";
import { accoesDisponiveis, propostaPendente, propostasRestantes, type Negociacao } from "./negociacao";
import { fotografiasDaProva, porConfirmarComOCliente, type FaseDoTrabalho } from "./trabalho";
import { pecasEmLisboa, instanteDaBase } from "./hora-de-lisboa";
import { nomeDoServico } from "./service-categories";
import type { NegociacaoDoCliente } from "./negociacao-na-vista";
import { chegadaConfirmadaPelosDois, clientePodeConfirmarChegada, estadoDaViagemParaOCliente } from "./viagem-ate-ao-cliente";
import {
  CONFIRMO_AS_HORAS,
  CONFIRMO_AS_HORAS_E_OS_MATERIAIS,
  NAO_CONCORDO,
  REGRA_DAS_HORAS,
  TITULO_DAS_HORAS,
  clientePodeResponderAsHoras,
  duracaoEmPalavras,
  estadoDasHorasParaOCliente,
  horasConfirmadas,
  horasDaEstimativa,
  horasEmPalavras,
  horasNaoTravamOFim,
  porHoraParaOCliente,
  precoPorHoraParaOCliente,
  quemConfirmouAsHorasEmPalavras,
  resumoDasHoras,
  valorPorHoraDe,
} from "./horas-do-trabalho";
import { lerMateriaisDaProposta, materiaisParaOCliente } from "./materiais-da-proposta";

/**
 * O PEDIDO, EM TEXTO PRONTO A MOSTRAR — para a app de cliente (d8, R4/R5,
 * 28-10-2026).
 *
 * A app não tem regras de preço, taxas nem IVA: mostra o texto tal como chega.
 * Os números saem daqui já escritos, pelas mesmas funções da página do pedido
 * (`precoDoCliente`, `desdobramentoDoIva`, `notaDoPrecoParaOCliente`,
 * `promessaDaForma`, `prazoAutomaticoPorExtenso`), a partir da mesma conversão
 * (`negociacaoParaAVista`). O mesmo pedido dá o mesmo texto no site e na app.
 *
 * O QUE NUNCA SAI DAQUI: o valor do profissional (nem o acordado, nem o das
 * propostas, nem o do ajuste), a taxa de quem quer que seja, notas internas.
 * Cada campo da resposta é escrito à mão, nesta lista — nada de `...linha`.
 *
 * Datas e horas em Lisboa, sempre (dono, 26-10-2026), seja qual for o fuso do
 * telemóvel: em ISO e em texto.
 */

const emEuros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const IVA_EM_PERCENTAGEM = `${Math.round(TAXA_IVA * 100)} %`;

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const dois = (n: number) => String(n).padStart(2, "0");

/** O instante em ISO, ou `null`. Texto da base sem fuso lê-se em UTC (`instanteDaBase`). */
export function isoOuNulo(v: Date | string | null | undefined): string | null {
  const d = instanteDaBase(v ?? null);
  return d ? d.toISOString() : null;
}

/** «sexta-feira, 30 de outubro, às 09:00» — em Lisboa. Meia-noite em ponto é um dia sem hora. */
export function quandoEmLisboa(v: Date | string | null | undefined): string | null {
  const d = instanteDaBase(v ?? null);
  if (!d) return null;
  const p = pecasEmLisboa(d);
  const dia = `${DIAS[p.diaDaSemana]}, ${p.dia} de ${MESES[p.mes - 1]}`;
  return p.hora === 0 && p.minuto === 0 ? dia : `${dia}, às ${dois(p.hora)}:${dois(p.minuto)}`;
}

/** «30/10/2026» — o dia em Lisboa. */
export function diaCurtoEmLisboa(v: Date | string | null | undefined): string | null {
  const d = instanteDaBase(v ?? null);
  if (!d) return null;
  const p = pecasEmLisboa(d);
  return `${dois(p.dia)}/${dois(p.mes)}/${p.ano}`;
}

/** «março de 2026» — o mês em Lisboa. */
export function mesEmLisboa(v: Date | string | null | undefined): string | null {
  const d = instanteDaBase(v ?? null);
  if (!d) return null;
  const p = pecasEmLisboa(d);
  return `${MESES[p.mes - 1]} de ${p.ano}`;
}

export type TextosDoPreco = {
  /** O número grande: o que se paga. Com IVA, salvo nas negociações sem ele. */
  principal: string;
  /** De que é feito — o sem IVA vai sempre com o com IVA, nunca sozinho. */
  detalhe: string;
  /** Pelo trabalho todo (itens a mais), por carga ou por hora. */
  nota: string;
};

/** Os textos do preço que o cliente paga por um valor do profissional, no modelo DESTA negociação. */
export function textosDoPreco(
  valorDoProfissional: number,
  n: Pick<NegociacaoDoCliente, "taxaCliente" | "semFactura" | "criadaEm">,
  base: BaseDoPreco,
): TextosDoPreco {
  const conta = precoDoCliente(valorDoProfissional, taxasDaNegociacao(n), modeloDaLinha(n, n.criadaEm));
  return textosDaConta(conta, notaDoPrecoParaOCliente(base));
}

/** Os mesmos textos para uma conta já feita (a da proposta CLYON, por exemplo). */
export function textosDaConta(conta: PrecoDoCliente, nota: string): TextosDoPreco {
  return conta.ivaIncluido
    ? { principal: `${emEuros(conta.aPagar)} com IVA`, detalhe: desdobramentoDoIva(conta), nota }
    : {
        principal: `${emEuros(conta.aPagar)} sem IVA`,
        detalhe: `Se quiser fatura, acrescem ${IVA_EM_PERCENTAGEM} de IVA: ${emEuros(conta.total)}.`,
        nota,
      };
}

/**
 * OS TEXTOS DE UM PREÇO POR HORA — 31-10-2026. O número grande é o preço de
 * uma hora com IVA («61,50 €/hora com IVA»); por baixo, o sem IVA ao lado e o
 * mínimo («50,00 €/hora + IVA (61,50 €/hora com IVA), mínimo 3 horas»); e a
 * nota é a estimativa (horas previstas × valor por hora). Nunca um total e um
 * valor por hora misturados.
 */
export function textosDoPrecoPorHora(
  valorPorHora: number,
  n: Pick<NegociacaoDoCliente, "taxaCliente" | "semFactura" | "criadaEm" | "horasPrevistas">,
): TextosDoPreco {
  const taxas = taxasDaNegociacao(n);
  const modelo = modeloDaLinha(n, n.criadaEm);
  const conta = precoDoCliente(valorPorHora, taxas, modelo);
  const p = precoPorHoraParaOCliente(valorPorHora, n.horasPrevistas, taxas, modelo);
  return {
    principal: `${emEuros(conta.aPagar)}/hora${conta.ivaIncluido ? " com IVA" : " sem IVA"}`,
    detalhe: porHoraParaOCliente(conta),
    nota: p.estimativa,
  };
}

/**
 * O BLOCO DAS HORAS para o cliente (link, conta e app de cliente) — 31-10-2026.
 * `null` num trabalho que não é por hora. Diz o preço por hora e a
 * estimativa, e — quando o parceiro as marcou — «das HH:MM às HH:MM = N h →
 * total …», quem confirmou, ou o «Não concordo» dele.
 */
export function horasParaOCliente(n: NegociacaoDoCliente, emCima: number | null, porHora: boolean = n.porHora === true) {
  if (!porHora) return null;
  const taxas = taxasDaNegociacao(n);
  const modelo = modeloDaLinha(n, n.criadaEm);
  const h = { ...(n.horas ?? {}), valorAcordado: n.valorAcordado };
  const valorPorHora = n.estado === "acordada" ? valorPorHoraDe(h) : emCima;
  const r = resumoDasHoras(h, taxas, modelo);
  const comMateriais = (r?.materiais.length ?? 0) > 0;
  const precoHora = valorPorHora != null ? precoPorHoraParaOCliente(valorPorHora, n.horasPrevistas, taxas, modelo) : null;
  return {
    titulo: TITULO_DAS_HORAS,
    porHoraTexto: precoHora?.porHora ?? null,
    estimativaTexto: horasConfirmadas(h) ? null : (precoHora?.estimativa ?? null),
    horasPrevistas: horasDaEstimativa(n.horasPrevistas),
    regraTexto: REGRA_DAS_HORAS,
    marcadas: r
      ? {
          texto: r.textoParaOCliente,
          inicio: r.inicio,
          fim: r.fim,
          passaDaMeiaNoite: r.passaDaMeiaNoite,
          horas: r.horas,
          horasTexto: horasEmPalavras(r.horas),
          duracaoTexto: duracaoEmPalavras(r.minutos),
          materiais: r.materiais.map((l) => `${l.quantidade} × ${l.nome}`),
          totalTexto: r.cliente.ivaIncluido
            ? `${emEuros(r.cliente.semIva)} + IVA = ${emEuros(r.cliente.total)}`
            : `${emEuros(r.cliente.semIva)} + IVA`,
          aPagar: r.cliente.aPagar,
          marcadasEmTexto: quandoEmLisboa(r.marcadasEm),
          confirmadas: r.confirmadas,
          confirmadasPorTexto: quemConfirmouAsHorasEmPalavras(r.confirmadasPor) || null,
          confirmadasEmTexto: quandoEmLisboa(r.confirmadasEm),
          contestadas: r.contestadas,
          contestacao: r.contestacao,
        }
      : null,
    estadoTexto: estadoDasHorasParaOCliente(h),
    podeResponder: n.estado === "acordada" && clientePodeResponderAsHoras(h),
    botaoConfirmar: comMateriais ? CONFIRMO_AS_HORAS_E_OS_MATERIAIS : CONFIRMO_AS_HORAS,
    botaoNaoConcordo: NAO_CONCORDO,
  };
}

/**
 * O que o cliente tem de saber em cada fase de um trabalho já contratado — a
 * tabela do E2 (d8 fase 2, S9): concluído › por confirmar (com ou sem
 * fotografias) › chegou › a caminho › dia combinado › contratado.
 */
function estadoDoContratado(c: ContratadoDoPedido): string {
  const nome = c.profissionalNome;
  if (c.fase === "confirmado" || c.fase === "pago") return "Concluído";
  if (c.fase === "a_confirmar") {
    // Com ou sem fotografias, confirma o cliente (30-10-2026).
    return "Por confirmar";
  }
  if (c.chegouEm && nome) return `${nome} chegou`;
  if (c.proximoEm && nome) return `${nome} está próximo`;
  if (c.aCaminhoEm && nome) return `${nome} vai a caminho`;
  const dia = quandoEmLisboa(c.dataCombinada);
  if (dia) return `Dia combinado: ${dia}`;
  return nome ? `Contratado — ${nome}` : "Contratado";
}

export type ContratadoDoPedido = {
  fase: FaseDoTrabalho;
  profissionalNome: string;
  dataCombinada?: Date | string | null;
  aCaminhoEm?: Date | string | null;
  proximoEm?: Date | string | null;
  chegouEm?: Date | string | null;
  chegadaConfirmadaEm?: Date | string | null;
  /** Se a prova do «está feito» tem fotografias (sem elas, a CLYON confirma). */
  comFotografias?: boolean;
};

/** O contratado a partir de uma linha (crua ou da vista), com o terreno e a prova. */
export function contratadoDaLinha(n: {
  fase: FaseDoTrabalho;
  profissionalNome: unknown;
  dataCombinada?: Date | string | null;
  aCaminhoEm?: Date | string | null;
  proximoEm?: Date | string | null;
  chegouEm?: Date | string | null;
  chegadaConfirmadaEm?: Date | string | null;
  provaJson?: string | null;
}): ContratadoDoPedido {
  return {
    fase: n.fase,
    profissionalNome: String(n.profissionalNome ?? ""),
    dataCombinada: n.dataCombinada ?? null,
    aCaminhoEm: n.aCaminhoEm ?? null,
    proximoEm: n.proximoEm ?? null,
    chegouEm: n.chegouEm ?? null,
    chegadaConfirmadaEm: n.chegadaConfirmadaEm ?? null,
    comFotografias: fotografiasDaProva(n.provaJson ?? null).length > 0,
  };
}

/**
 * O ESTADO DO PEDIDO, EM PALAVRAS — UMA SÓ TABELA (d8 fase 2, S9): a lista da
 * app (R4), o pedido da app (R5) e a conta do site dizem o mesmo, pela tabela
 * do E2. A primeira linha que se aplica:
 *
 *   cancelado › contratado (a tabela do contratado) › concluído sem negociação
 *   › Trabalho CLYON (preço aceite / por responder / por enviar) › com
 *   propostas › enviado aos profissionais › a ser revisto pela CLYON.
 *
 * `contratado` é a negociação fechada (num Trabalho CLYON, a da oferta — o
 * cliente sabe quem faz o trabalho, a CLYON di-lo na adjudicação).
 * `comPropostas` conta as que o cliente vê, por decidir; `enviado` diz se o
 * pedido já foi aos profissionais.
 */
export function estadoDoPedidoParaOCliente(p: {
  status: string | null | undefined;
  canceladoPeloCliente?: unknown;
  trabalhoClyon: boolean;
  contratado: ContratadoDoPedido | null;
  comPropostas: number;
  enviado: boolean;
  /** Num Trabalho CLYON: o preço já foi ao cliente, e se ele o aceitou (S7). */
  precoEnviado?: boolean;
  precoAceite?: boolean;
  /** A CLYON pediu mais detalhes e ele ainda não respondeu (S18, 29-10-2026). */
  precisaDeSi?: boolean;
}): string {
  const status = String(p.status ?? "");
  if (["cancelado", "rejeitado", "arquivado"].includes(status) || Number(p.canceladoPeloCliente) === 1) {
    return "Cancelado";
  }
  if (p.precisaDeSi) return ESTADO_PRECISA_DE_SI;
  if (p.contratado) return estadoDoContratado(p.contratado);
  if (status === "concluido") return "Concluído";
  if (p.trabalhoClyon) {
    if (p.precoAceite) return "Preço aceite — a CLYON escolhe quem faz";
    if (p.precoEnviado) return "Preço da CLYON por responder";
    return "A ser revisto pela CLYON";
  }
  if (p.comPropostas > 0) return "Tem propostas";
  if (p.enviado) return "À espera de propostas";
  return "A ser revisto pela CLYON";
}

/** O estado de um pedido em que a CLYON pediu mais detalhes (S18, 29-10-2026). */
export const ESTADO_PRECISA_DE_SI = "A CLYON precisa de mais detalhes";

/** Os estados de um pedido fechado — vão para o fim da lista. */
export function pedidoFechado(estadoTexto: string): boolean {
  return estadoTexto === "Concluído" || estadoTexto === "Cancelado";
}

/** A ordem da novidade, do que mais urge para o que menos (a lista da app ordena por ela). */
export const ORDEM_DAS_NOVIDADES = [
  "Responda à CLYON",
  "Responda ao ajuste",
  "Confirme o trabalho",
  "Por pagar",
  "Responda ao preço",
  "propostas",
] as const;

export function pesoDaNovidade(novidade: string | null): number {
  if (!novidade) return ORDEM_DAS_NOVIDADES.length;
  const i = ORDEM_DAS_NOVIDADES.indexOf(novidade as (typeof ORDEM_DAS_NOVIDADES)[number]);
  return i >= 0 ? i : ORDEM_DAS_NOVIDADES.length - 1;
}

/**
 * HÁ ALGUMA COISA À ESPERA DELE? — a novidade do cartão da lista. Pela ordem
 * do que mais urge; `null` quando não há nada a fazer.
 *
 * «Propostas novas» são as que esperam resposta DELE — a mesma regra do
 * distintivo da conta (`propostasAEsperaDoCliente`): uma proposta dele à
 * espera do profissional não é trabalho dele.
 */
export function novidadeDoPedido(p: {
  /** A CLYON pediu mais detalhes (S18). */
  precisaDeSi?: boolean;
  ajustePorResponder: boolean;
  porConfirmar: boolean;
  porPagar: boolean;
  /** Num Trabalho CLYON: o preço foi enviado e ele ainda não respondeu (S9). */
  precoPorResponder?: boolean;
  propostasPorResponder: number;
}): string | null {
  if (p.precisaDeSi) return "Responda à CLYON";
  if (p.ajustePorResponder) return "Responda ao ajuste";
  if (p.porConfirmar) return "Confirme o trabalho";
  if (p.porPagar) return "Por pagar";
  if (p.precoPorResponder) return "Responda ao preço";
  if (p.propostasPorResponder === 1) return "1 proposta nova";
  if (p.propostasPorResponder > 1) return `${p.propostasPorResponder} propostas novas`;
  return null;
}

/** Esta negociação espera uma resposta dele (proposta do profissional, ou o «aceito» por contratar)? */
export function esperaPeloCliente(n: Pick<NegociacaoDoCliente, "estado" | "propostas">, agora: Date): boolean {
  if (n.estado === "aguarda_contratacao") return true;
  if (n.estado !== "aberta") return false;
  return propostaPendente({ estado: "aberta", valorAcordado: null, propostas: n.propostas }, agora)?.por === "profissional";
}

function provaDe(json: string | null): { fotos: string[]; nota: string | null } {
  if (!json) return { fotos: [], nota: null };
  try {
    const p = JSON.parse(json);
    return {
      fotos: Array.isArray(p?.fotos) ? p.fotos.filter((f: unknown) => typeof f === "string") : [],
      nota: typeof p?.nota === "string" && p.nota.trim() ? p.nota : null,
    };
  } catch {
    return { fotos: [], nota: null };
  }
}

/** A negociação para a app — só o que o cliente pode ver, e já em texto. */
export function negociacaoParaAApp(n: NegociacaoDoCliente, base: BaseDoPreco, agora: Date) {
  const nome = n.profissionalNome;
  const contratado = n.estado === "acordada";
  const motor: Negociacao = {
    estado: n.estado as Negociacao["estado"],
    valorAcordado: n.valorAcordado,
    propostas: n.propostas,
  };
  const pendente = contratado ? null : propostaPendente(motor, agora);
  // O que está em cima da mesa: a proposta por responder, ou o valor fechado.
  const emCima = pendente?.valor ?? n.valorAcordado;
  const modelo = modeloDaLinha(n, n.criadaEm);
  const promessa = promessaDaForma(n.formaDePagamento, modelo);
  const prova = provaDe(n.provaJson);
  const pendenteDoAjuste = n.ajuste?.pendente ?? null;
  // Desde 30-10-2026 confirma sempre o cliente (a CLYON pode antecipar-se no backoffice).
  const porConfirmarPelaClyon = false;
  void porConfirmarComOCliente({
    estado: n.estado,
    execucaoEnviadaEm: n.execucaoEnviadaEm,
    confirmadoEm: n.confirmadoEm,
    pagoEm: n.pagoEm,
    provaJson: n.provaJson,
  });

  // As acções que `agirComoCliente` aceita agora, para os botões da app.
  const accoes: string[] = contratado
    ? [
        ...(pendenteDoAjuste ? ["aprovar_ajuste", "recusar_ajuste"] : []),
        // «Confirmo que chegou» — depois do «Cheguei» dele, antes do «está feito» (30-10-2026).
        ...(n.fase === "a_executar" && clientePodeConfirmarChegada(n) ? ["confirmar_chegada"] : []),
        // As horas de um trabalho por hora (31-10-2026): confirmar ou «Não concordo».
        ...(n.porHora && clientePodeResponderAsHoras(n.horas ?? {}) ? ["confirmar_horas", "contestar_horas"] : []),
        // E o fim só com as horas confirmadas.
        ...(n.fase === "a_confirmar" && horasNaoTravamOFim(n.horas ?? {}) ? ["confirmar"] : []),
        ...((n.fase === "confirmado" || n.fase === "pago") && !n.estrelas ? ["avaliar"] : []),
      ]
    : accoesDisponiveis(motor, "cliente", agora);

  const estadoTexto = contratado
    ? estadoDoContratado(
        contratadoDaLinha({
          fase: n.fase,
          profissionalNome: nome,
          dataCombinada: n.dataCombinada,
          aCaminhoEm: n.aCaminhoEm,
          proximoEm: n.proximoEm,
          chegouEm: n.chegouEm,
          chegadaConfirmadaEm: n.chegadaConfirmadaEm,
          provaJson: n.provaJson,
        }),
      )
    : n.estado === "aguarda_contratacao"
      ? "Aceitou o seu valor. Falta confirmar que o contrata."
      : pendente?.por === "profissional"
        ? `Proposta de ${nome}`
        : pendente
          ? "O seu valor — à espera da resposta"
          : "À espera da proposta";

  const formaTexto = !contratado
    ? promessa.whatsappAntesDeAceitar
    : n.fase === "confirmado" || n.fase === "pago"
      ? promessa.depoisDeConfirmar
      : promessa.clienteEmCurso.replaceAll("{PRO}", nome);

  return {
    id: n.id,
    estado: n.estado,
    estadoTexto,
    fase: n.fase,
    profissional: {
      nome,
      // Só depois de contratado — a regra já vem de `negociacoesParaOCliente`.
      telefone: contratado ? n.profissionalTelefone : null,
      guiaVerificada: n.guiaVerificada,
      notaMedia: n.perfil?.notaMedia ?? null,
      notaTexto:
        n.perfil && n.perfil.quantasAvaliacoes > 0 && n.perfil.notaMedia != null
          ? `★ ${n.perfil.notaMedia.toFixed(1).replace(".", ",")} · ${n.perfil.quantasAvaliacoes} ${
              n.perfil.quantasAvaliacoes === 1 ? "avaliação" : "avaliações"
            }`
          : "Sem avaliações ainda",
      quantasAvaliacoes: n.perfil?.quantasAvaliacoes ?? 0,
      trabalhosConcluidos: n.perfil?.trabalhosConcluidos ?? 0,
      naClyonDesde: n.perfil?.naClyonDesde ?? null,
      naClyonDesdeTexto: mesEmLisboa(n.perfil?.naClyonDesde),
      // As zonas saíram a 29-10-2026; vai vazia porque as apps já instaladas a lêem.
      zonas: [] as string[],
      raioKm: n.perfil?.raioKm ?? null,
      avaliacoes: (n.perfil?.avaliacoes ?? []).map((a) => ({
        estrelas: a.estrelas,
        comentario: a.comentario,
        quando: diaCurtoEmLisboa(a.avaliadoEm),
        servico: a.servicoTipo ? nomeDoServico(a.servicoTipo) : null,
        cidade: a.cidade,
      })),
    },
    accoes,
    aguardaContratacao: n.estado === "aguarda_contratacao",
    propostasRestantes: contratado ? 0 : propostasRestantes(motor, "cliente", agora),
    /*
     * POR HORA (31-10-2026): o preço de uma hora, com a estimativa na nota; com
     * as horas confirmadas, o total delas (o `valorAcordado` passou a sê-lo).
     */
    preco:
      emCima == null
        ? null
        : base === "hora"
          ? contratado && horasConfirmadas(n.horas ?? {})
            ? textosDaConta(
                precoDoCliente(emCima, taxasDaNegociacao(n), modeloDaLinha(n, n.criadaEm)),
                "Total das horas confirmadas.",
              )
            : textosDoPrecoPorHora(contratado ? (valorPorHoraDe({ ...(n.horas ?? {}), valorAcordado: emCima }) ?? emCima) : emCima, n)
          : textosDoPreco(emCima, n, base),
    // As horas e os materiais (31-10-2026) — `null` quando não há.
    horas: horasParaOCliente(n, emCima, base === "hora"),
    materiaisTexto: materiaisParaOCliente(
      lerMateriaisDaProposta(n.materiaisJson ?? null),
      taxasDaNegociacao(n),
      modeloDaLinha(n, n.criadaEm),
    ),
    precoEtiqueta: contratado && base === "hora" && horasConfirmadas(n.horas ?? {})
      ? "total das horas"
      : contratado
      ? "valor combinado"
      : pendente?.por === "profissional"
        ? "proposta dele"
        : pendente
          ? "o seu valor — à espera da resposta"
          : "à espera da proposta dele",
    formaTexto,
    dataCombinada: isoOuNulo(n.dataCombinada),
    dataCombinadaTexto: quandoEmLisboa(n.dataCombinada),
    aCaminhoEm: isoOuNulo(n.aCaminhoEm),
    aCaminhoEmTexto: quandoEmLisboa(n.aCaminhoEm),
    proximoEm: isoOuNulo(n.proximoEm),
    proximoEmTexto: quandoEmLisboa(n.proximoEm),
    chegouEm: isoOuNulo(n.chegouEm),
    chegouEmTexto: quandoEmLisboa(n.chegouEm),
    chegadaConfirmadaEm: isoOuNulo(n.chegadaConfirmadaEm),
    chegadaConfirmadaEmTexto: quandoEmLisboa(n.chegadaConfirmadaEm),
    // A viagem até ao cliente, em palavras de cliente («parceiro»), e se as duas confirmações já estão.
    viagemTexto: contratado ? estadoDaViagemParaOCliente(n) : null,
    chegadaConfirmada: chegadaConfirmadaPelosDois(n),
    execucaoEnviadaEm: isoOuNulo(n.execucaoEnviadaEm),
    execucaoEnviadaEmTexto: quandoEmLisboa(n.execucaoEnviadaEm),
    confirmadoEm: isoOuNulo(n.confirmadoEm),
    confirmadoEmTexto: quandoEmLisboa(n.confirmadoEm),
    pagoEm: isoOuNulo(n.pagoEm),
    pagoEmTexto: quandoEmLisboa(n.pagoEm),
    avaliado: Boolean(n.estrelas),
    estrelas: n.estrelas ?? null,
    prova: prova.fotos,
    provaNota: prova.nota,
    ajuste: pendenteDoAjuste
      ? {
          motivo: pendenteDoAjuste.motivo,
          fotos: pendenteDoAjuste.fotos,
          sobe: pendenteDoAjuste.valorNovo > pendenteDoAjuste.valorAntigo,
          antes: textosDoPreco(pendenteDoAjuste.valorAntigo, n, base),
          depois: textosDoPreco(pendenteDoAjuste.valorNovo, n, base),
          ate: pendenteDoAjuste.expiraEm,
          ateTexto: quandoEmLisboa(pendenteDoAjuste.expiraEm),
          regraTexto: `O valor só muda se aceitar. Se não aceitar, ou não responder até ${
            quandoEmLisboa(pendenteDoAjuste.expiraEm) ?? "ao fim do dia"
          }, fica o valor que combinou.`,
        }
      : null,
    porConfirmarPelaClyon,
    diasAteLibertarTexto: n.diasAteLibertar != null ? prazoAutomaticoPorExtenso(n.diasAteLibertar) : null,
    botaoDeConfirmar: promessa.botaoDeConfirmar,
  };
}

export type NegociacaoNaApp = ReturnType<typeof negociacaoParaAApp>;
