/**
 * AS REGRAS NOVAS DA RETENÇÃO — decisão d32 do dono e do CEO, 26-10-2026.
 *
 * *«Aprovo todas»* — com o prazo *«90 dias depois de fechado»*. E, na versão 2
 * da mesma decisão: *«fica o primeiro nome do cliente, junto com a
 * localidade — para a equipa conseguir encontrar o pedido se houver um
 * problema de pagamentos»*.
 *
 * O QUE MUDA, em sete partes:
 *
 *   A · um pedido com trabalho (concluído, ou com dinheiro) deixa de ficar
 *       inteiro para sempre: 90 dias depois de FECHADO é anonimizado. A linha
 *       fica — serviço, localidade, datas, valores, taxas, estado,
 *       profissional, o primeiro nome do cliente —, e saem o resto do nome, o
 *       telefone, o email, a morada, a descrição, as notas e TODAS as
 *       fotografias (do pedido, da prova e dos ajustes);
 *   B · a guarda da purga deixa de ser «houve acordo»: protege pelo dinheiro e
 *       pelo trabalho feito. Um cancelado sem nada disso sai aos 60 dias;
 *   C · o arquivo dos apagados nasce anónimo (com o primeiro nome) e guarda o
 *       estado e o preço final; o registo deixa de guardar o nome e o email
 *       do cliente nas linhas da purga;
 *   D · um concluído com preço nunca se apaga — só se anonimiza;
 *   E · os ficheiros do Blob que nada referencia saem aos 30 dias;
 *   F · os contactos (leads) saem aos 60 dias;
 *   G · «rejeitado» conta como terminado (60 dias) e as conversas lidas do
 *       telemóvel guardam-se 60 dias, como o fio.
 *
 * TUDO ISTO NASCE EM ENSAIO. *«As regras novas entram em MODO ENSAIO»* — a
 * purga conta e escreve o que faria, e não muda nada, até o dono ligar o
 * interruptor nas Configs → Retenção. As regras de hoje continuam a correr
 * como estão. A única excepção é a metade de D que PROTEGE: um concluído com
 * preço deixa já de poder ser apagado, porque travar um apagar nunca estraga
 * nada.
 *
 * ESTE FICHEIRO É PURO: decide, não lê nem escreve na base. A parte que fala
 * com o MySQL e com o Blob está em `regras-novas-na-base.ts`, e é testada com
 * uma base fingida — as decisões testam-se aqui, com linhas escritas à mão.
 */

import { pagouAoProfissional } from "./dinheiro-do-trabalho";
import { temDividaDoProfissional } from "./divida-do-profissional";
import { modeloDaLinha } from "./sem-factura";
import { verificaOPagamento } from "./carteira";
import { DIAS_DE_RETENCAO_DOS_PEDIDOS, DIAS_PARA_OS_ABANDONADOS } from "./retencao";
import { fotografiasDaProva } from "./trabalho";

/** A: quantos dias depois de FECHADO se anonimiza um pedido com trabalho. */
export const DIAS_ATE_ANONIMIZAR_OS_TRABALHOS = 90;

/** E: quantos dias um ficheiro sem referência nenhuma espera antes de sair. */
export const DIAS_DOS_FICHEIROS_ORFAOS = 30;

/** F: quantos dias se guarda um contacto (lead), seja de onde for. */
export const DIAS_DOS_CONTACTOS = 60;

/** G: «rejeitado» passa a contar como terminado — os 60 dias dos outros. */
export const DIAS_DOS_REJEITADOS = DIAS_DE_RETENCAO_DOS_PEDIDOS;

/**
 * G: as conversas lidas do telemóvel. Hoje 90 dias; com as regras novas, os 60
 * do fio das mensagens (o comentário de `guardarRetratoDoTelemovelWhatsApp`
 * já dizia 60, e o número escrito era 90).
 */
export const DIAS_DO_TELEMOVEL_HOJE = 90;
export const DIAS_DO_TELEMOVEL_NAS_REGRAS_NOVAS = 60;

/** Os prefixos do Blob onde vivem ficheiros de pedidos e de provas. Os outros (viaturas/) não se varrem. */
export const PREFIXOS_DOS_FICHEIROS_DE_PEDIDOS = ["simulador/", "trabalhos/"] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * O PRIMEIRO NOME — versão 2 da d32.
 *
 * *«Guarda o primeiro nome tal como está (sem inventar), e se o nome tiver só
 * uma palavra fica essa.»* A primeira palavra, como foi escrita: sem mudar
 * maiúsculas, sem tirar acentos, sem adivinhar se «Dr.» é um título.
 * ────────────────────────────────────────────────────────────────────────── */
export function primeiroNome(nome: unknown): string | null {
  if (typeof nome !== "string") return null;
  const palavra = nome.trim().split(/\s+/)[0] ?? "";
  // Um endereço de email escrito no campo do nome não é um nome.
  if (!palavra || palavra.includes("@")) return null;
  return palavra.slice(0, 120);
}

/**
 * A ZONA DO CÓDIGO POSTAL: os quatro primeiros algarismos.
 *
 * O código inteiro (2750-123) aponta a uma rua; os quatro primeiros (2750)
 * são a localidade, que é o que a d32 manda guardar. Um código que não tenha
 * quatro algarismos à cabeça sai inteiro.
 */
export function zonaDoCodigoPostal(cp: unknown): string | null {
  if (typeof cp !== "string") return null;
  const m = cp.trim().match(/^(\d{4})/);
  return m ? m[1] : null;
}

/** Só valores simples das chaves dadas. Um objecto onde se esperava um número pode trazer qualquer coisa. */
function soEstas(o: unknown, chaves: readonly string[]): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if (!o || typeof o !== "object" || Array.isArray(o)) return r;
  const fonte = o as Record<string, unknown>;
  for (const c of chaves) {
    if (!(c in fonte)) continue;
    const v = fonte[c];
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) r[c] = v;
  }
  return r;
}

function lerJson(v: unknown): unknown {
  if (typeof v !== "string" || v.trim() === "") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/**
 * O FORMULÁRIO DO PEDIDO (`rawOrderJson`), só com o que não identifica ninguém.
 *
 * Fica por onde o pedido chegou — o formulário (`origemPedido`, `_source`) e o
 * canal da visita (`origemDaVisita`: a fonte, o meio e a campanha) —, que é o
 * que as contas dos contactos e do Google Ads lêem. O `gclid` é um
 * identificador do clique: sai, e fica no lugar dele a marca de que houve um
 * (o canal continua a dizer «Google Ads»). Tudo o resto sai por omissão:
 * moradas, email, telefone, descrição, fotografias.
 */
export function formularioAnonimizado(raw: unknown): string | null {
  const lido = lerJson(raw);
  if (!lido || typeof lido !== "object" || Array.isArray(lido)) return null;
  const fonte = lido as Record<string, unknown>;
  const r: Record<string, unknown> = { anonimizado: true, ...soEstas(fonte, ["origemPedido", "_source"]) };
  const visita = fonte.origemDaVisita;
  if (visita && typeof visita === "object" && !Array.isArray(visita)) {
    const v = soEstas(visita, ["utm_source", "utm_medium", "utm_campaign"]);
    if ((visita as Record<string, unknown>).gclid) v.gclid = "anonimizado";
    r.origemDaVisita = v;
  }
  return JSON.stringify(r);
}

/**
 * Um JSON só com os números (e as chaves de texto dadas). Para a estimativa
 * (`estimateJson`) e a revisão do preço (`reviewJson`): os totais e o IVA que
 * o detalhe do pedido lê ficam; as notas e os textos saem.
 */
export function jsonSoComNumeros(v: unknown, textosQueFicam: readonly string[] = []): string | null {
  const lido = lerJson(v);
  if (!lido || typeof lido !== "object" || Array.isArray(lido)) return null;
  const r: Record<string, unknown> = {};
  for (const [k, valor] of Object.entries(lido as Record<string, unknown>)) {
    if (typeof valor === "number" || typeof valor === "boolean") r[k] = valor;
    else if (textosQueFicam.includes(k) && (typeof valor === "string" || valor === null)) r[k] = valor;
  }
  return JSON.stringify(r);
}

/* ──────────────────────────────────────────────────────────────────────────
 * OS FICHEIROS DE UM PEDIDO — do pedido, da prova e dos ajustes no local.
 * ────────────────────────────────────────────────────────────────────────── */

const URL_DO_BLOB = /https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\/[^\s"'<>\\)]+/gi;

/** As fotografias e os ficheiros do pedido: `filesJson` e os endereços que o formulário guardou. */
export function ficheirosDoPedido(filesJson: unknown, rawOrderJson?: unknown): string[] {
  const urls: string[] = [];
  const lista = lerJson(filesJson);
  if (Array.isArray(lista)) {
    for (const f of lista) {
      if (f && typeof f === "object" && typeof (f as { url?: unknown }).url === "string") {
        urls.push((f as { url: string }).url);
      }
    }
  }
  if (typeof rawOrderJson === "string") {
    for (const m of rawOrderJson.matchAll(URL_DO_BLOB)) urls.push(m[0]);
  }
  return [...new Set(urls)];
}

/** As fotografias da prova de execução — a mesma leitura do resto do site. */
export function fotografiasDaProvaAnonimizavel(provaJson: unknown): string[] {
  return fotografiasDaProva(typeof provaJson === "string" ? provaJson : null);
}

/** As fotografias dos ajustes pedidos no local. */
export function fotografiasDosAjustes(ajustesJson: unknown): string[] {
  const l = lerJson(ajustesJson);
  if (!Array.isArray(l)) return [];
  const urls: string[] = [];
  for (const a of l) {
    const fotos = (a as { fotos?: unknown } | null)?.fotos;
    if (Array.isArray(fotos)) for (const u of fotos) if (typeof u === "string" && u) urls.push(u);
  }
  return urls;
}

/**
 * A PROVA, SEM AS FOTOGRAFIAS NEM A NOTA.
 *
 * Não fica a NULL de propósito: há ecrãs que lêem «tem prova» pela coluna
 * preenchida. Fica a data em que foi enviada e quantas fotografias havia. Só
 * se faz em trabalhos confirmados ou pagos (ver `negociacaoFechada`): aí o
 * dinheiro já não depende das fotografias (o prazo dos 7 dias só corre para um
 * trabalho por confirmar — `prazoCorre` em trabalho.ts).
 */
export function provaAnonimizada(provaJson: unknown): string | null {
  if (provaJson == null || provaJson === "") return null;
  const p = lerJson(provaJson) as { em?: unknown; fotos?: unknown } | null;
  return JSON.stringify({
    fotos: [],
    nota: null,
    em: typeof p?.em === "string" ? p.em : null,
    anonimizado: true,
    quantasFotografias: fotografiasDaProvaAnonimizavel(provaJson).length,
  });
}

/**
 * Os ajustes no local, sem as fotografias. Os valores, o motivo e as respostas
 * ficam: são a justificação de um valor que mudou, e o valor é dinheiro.
 */
export function ajustesSemFotografias(ajustesJson: unknown): string | null {
  const l = lerJson(ajustesJson);
  if (!Array.isArray(l)) return typeof ajustesJson === "string" ? ajustesJson : null;
  return JSON.stringify(
    l.map((a) => (a && typeof a === "object" ? { ...(a as Record<string, unknown>), fotos: [] } : a)),
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE ACONTECE A CADA COLUNA DO PEDIDO QUANDO É ANONIMIZADO.
 *
 * Uma lista para TODAS as colunas de `simulatorOrders`, e um teste que as lê
 * do CREATE e dos ALTER e chumba se aparecer uma coluna sem decisão. O UPDATE
 * da anonimização é construído a partir desta lista — não há uma segunda
 * lista escrita à mão que possa divergir dela.
 *
 *   · fica         — não identifica ninguém, ou é dinheiro, datas, estado;
 *   · nulo         — sai;
 *   · primeiro_nome, zona, formulario, so_numeros — sai o que identifica e
 *                    fica o resto, pelas funções acima.
 * ────────────────────────────────────────────────────────────────────────── */
export type ComoSeAnonimiza = "fica" | "nulo" | "primeiro_nome" | "zona" | "formulario" | "so_numeros";

export const COMO_SE_ANONIMIZA_O_PEDIDO: Record<string, ComoSeAnonimiza> = {
  id: "fica",
  serviceType: "fica",
  // O nome: só o primeiro (versão 2 da d32).
  contactName: "primeiro_nome",
  contactPhone: "nulo",
  contactEmail: "nulo",
  // A morada: a rua, a porta e o andar saem; a localidade e a zona do código postal ficam.
  address: "nulo",
  floor: "nulo",
  postalCode: "zona",
  city: "fica",
  hasElevator: "fica",
  parkingDistance: "fica",
  // O texto livre: a descrição, as notas, as mensagens, as conversas, o histórico.
  description: "nulo",
  // As fontes da descrição (29-10-2026): o texto da equipa e as frases do cliente.
  fontesDaDescricao: "nulo",
  notasInternas: "nulo",
  mensagemCliente: "nulo",
  chatJson: "nulo",
  historyJson: "nulo",
  calendarNotes: "nulo",
  clientRatingComment: "nulo",
  // A análise das fotografias e da descrição feita pelo modelo.
  analysisJsonExtended: "nulo",
  // As fotografias e os ficheiros (apagados do Blob a seguir).
  filesJson: "nulo",
  // O formulário: fica por onde chegou, sai o resto.
  rawOrderJson: "formulario",
  // A estimativa e a revisão do preço: ficam os números.
  estimateJson: "so_numeros",
  reviewJson: "so_numeros",
  // O NIF da factura e os links que abriam o pedido.
  nifFactura: "nulo",
  acessoTokenHash: "nulo",
  acessoTokenExpiraEm: "nulo",
  orcamentoToken: "nulo",
  // O resto é estado, datas, valores, taxas, quem tratou — fica.
  urgency: "fica",
  estimateMin: "fica",
  estimateMax: "fica",
  estimateTotal: "fica",
  distanceKm: "fica",
  distanceText: "fica",
  status: "fica",
  priority: "fica",
  precoFinal: "fica",
  precoFinalIva: "fica",
  assignedToId: "fica",
  assignedToName: "fica",
  assignedAt: "fica",
  colaboradorId: "fica",
  dataAgendada: "fica",
  viewedAt: "fica",
  createdAt: "fica",
  updatedAt: "fica",
  acceptedAt: "fica",
  scheduledDate: "fica",
  scheduledStartTime: "fica",
  scheduledEndTime: "fica",
  // O ponteiro para o evento da agenda: não é dado pessoal, e é por ele que se lá chega.
  calendarEventId: "fica",
  calendarEventUrl: "fica",
  calendarStatus: "fica",
  calendarTargetId: "fica",
  calendarTargetName: "fica",
  confirmadoPeloCliente: "fica",
  confirmadoEm: "fica",
  canceladoPeloCliente: "fica",
  canceladoPeloClienteEm: "fica",
  valorPagoAssistente: "fica",
  providerId: "fica",
  providerAcceptedAt: "fica",
  recurrenceFrequency: "fica",
  recurringDiscountPercent: "fica",
  clientRating: "fica",
  historyReadAt: "fica",
  valorMinimoCliente: "fica",
  valorMaximoCliente: "fica",
  precisaFatura: "fica",
  precisaGuiaTransporte: "fica",
  valorDesejadoCliente: "fica",
  baseDoPreco: "fica",
  formaDePagamento: "fica",
  statusAntesDeCancelar: "fica",
  valorDoClienteComIva: "fica",
  valorFixoClyon: "fica",
  concluidoEm: "fica",
  precoClienteClyon: "fica",
  taxaClyon: "fica",
  lucroManual: "fica",
  concluidoEmManual: "fica",
  propostaEnviadaEm: "fica",
  // O «Aceito este preço» da app de cliente (S7, 28-10-2026): uma data, não diz de quem.
  precoAceiteEm: "fica",
  // O motivo de uma taxa abaixo do escalão: justifica uma decisão de dinheiro.
  motivoTaxaClyon: "fica",
  // A marca de que já foi anonimizado — escrita pela própria anonimização.
  anonimizadoEm: "fica",
  // A junção à conta pedida pela app (29-10-2026, R13): o email de quem pediu sai; as datas ficam.
  juntarAContaPedidoPor: "nulo",
  juntarAContaPedidoEm: "fica",
  contaJuntadaEm: "fica",
};

/** O que a revisão do preço guarda em texto e pode ficar: a data. */
const TEXTOS_DA_REVISAO = ["reviewedAt"] as const;

/**
 * Os valores novos das colunas que mudam, a partir da linha como está.
 *
 * Pode correr duas vezes sobre a mesma linha e dá o mesmo.
 */
export function valoresDoPedidoAnonimizado(linha: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [coluna, como] of Object.entries(COMO_SE_ANONIMIZA_O_PEDIDO)) {
    const v = linha[coluna];
    switch (como) {
      case "fica":
        break;
      case "nulo":
        r[coluna] = null;
        break;
      case "primeiro_nome":
        r[coluna] = primeiroNome(v);
        break;
      case "zona":
        r[coluna] = zonaDoCodigoPostal(v);
        break;
      case "formulario":
        r[coluna] = formularioAnonimizado(v);
        break;
      case "so_numeros":
        r[coluna] = jsonSoComNumeros(v, coluna === "reviewJson" ? TEXTOS_DA_REVISAO : []);
        break;
    }
  }
  return r;
}

/** As colunas que a anonimização reescreve, pela ordem da lista. */
export const COLUNAS_QUE_A_ANONIMIZACAO_REESCREVE = Object.entries(COMO_SE_ANONIMIZA_O_PEDIDO)
  .filter(([, como]) => como !== "fica")
  .map(([c]) => c);

/* ──────────────────────────────────────────────────────────────────────────
 * A DECISÃO — o que as regras novas fazem a cada pedido.
 * ────────────────────────────────────────────────────────────────────────── */

type Data = Date | string | null | undefined;

export type NegociacaoParaRetencao = {
  id: number;
  estado: string;
  valorAcordado: number | null;
  execucaoEnviadaEm: Data;
  confirmadoEm: Data;
  pagoEm: Data;
  formaDePagamento: string | null;
  /** Trabalho CLYON (valor fixo): quem paga ao profissional é a CLYON. */
  ofertaClyon: string | null;
  semFactura?: unknown;
  negociacaoCriadaEm: Data;
  /** O pagamento dado por pago a esta negociação (`pagamentos.negociacaoPaga`). */
  clientePagouEm: Data;
  comoEntrou: string | null;
  /** Referências por pagar e ainda válidas. */
  referenciasVivas: number;
  /** Pagamentos recebidos e não devolvidos. */
  pagamentosRecebidos: number;
  /** Pagamentos devolvidos ao cliente. */
  pagamentosDevolvidos: number;
  /** Linhas no livro da carteira. */
  movimentos: number;
};

export type PedidoParaRetencao = {
  id: number;
  status: string | null;
  /** Dias inteiros desde a última mexida — no pedido, nas negociações ou nos pagamentos. */
  diasParado: number;
  /** A data marcada já passou (ou não há). */
  dataMarcadaPassou: boolean;
  /** Preço escrito no pedido: final, lucro à mão, ou valor fixo/preço de um Trabalho CLYON. */
  temPreco: boolean;
  /** Já foi anonimizado. */
  anonimizado: boolean;
  negociacoes: NegociacaoParaRetencao[];
};

export type PorqueFica =
  | "ja_anonimizado"
  | "data_marcada"
  | "no_prazo"
  | "dinheiro_por_acertar"
  | "acordo_vivo"
  | "pedido_aberto_com_acordo";

export type Decisao =
  | { faz: "apagar"; regra: "terminado" | "abandonado" | "sem_trabalho_nem_dinheiro" | "rejeitado" }
  | { faz: "anonimizar" }
  | { faz: "fica"; porque: PorqueFica };

const TERMINADOS = ["concluido", "cancelado", "arquivado", "rejeitado"];

const tem = (d: Data) => d != null && d !== "";

/** Houve trabalho: entregue, confirmado ou pago ao profissional. */
export function houveTrabalho(n: NegociacaoParaRetencao): boolean {
  return tem(n.execucaoEnviadaEm) || tem(n.confirmadoEm) || tem(n.pagoEm);
}

/** Houve dinheiro: um pagamento (feito, devolvido ou por pagar), um movimento na carteira, ou o profissional pago. */
export function houveDinheiro(n: NegociacaoParaRetencao): boolean {
  return (
    tem(n.pagoEm) ||
    tem(n.clientePagouEm) ||
    n.pagamentosRecebidos > 0 ||
    n.pagamentosDevolvidos > 0 ||
    n.referenciasVivas > 0 ||
    n.movimentos > 0
  );
}

/** Um acordo que ainda está de pé e por fazer — o profissional aceitou, e nada aconteceu ainda. */
export function acordoVivo(n: NegociacaoParaRetencao): boolean {
  return (n.estado === "acordada" || n.estado === "aguarda_contratacao") && !houveTrabalho(n) && !houveDinheiro(n);
}

/**
 * ESTA NEGOCIAÇÃO ESTÁ FECHADA? — «trabalho feito E dinheiro acertado».
 *
 * A leitura, escrita para o dono poder discordar dela:
 *
 *   · não há referência por pagar ainda válida;
 *   · com trabalho: está CONFIRMADO (ou pago ao profissional) — um trabalho só
 *     entregue ainda pode ter de se confirmar com o cliente, e o prazo dos 7
 *     dias depende das fotografias que a anonimização apaga;
 *   · o lado do cliente está feito: pagou à CLYON, ou pagou em mão ao
 *     profissional (e, com IVA incluído, o profissional já entregou à CLYON o
 *     que lhe devia), ou é um Trabalho CLYON confirmado, ou é dos de antes de
 *     a carteira perguntar pelo pagamento (`verificaOPagamento`, 01-10-2026) —
 *     exactamente o que a carteira do profissional já assume;
 *   · o lado do profissional: o que ele tem a receber já está na carteira
 *     dele (confirmado e pago pelo cliente), ou já lhe foi transferido. A
 *     linha da negociação não muda com a anonimização — o saldo dele também
 *     não;
 *   · sem trabalho, só com dinheiro: fechado se o que entrou foi devolvido.
 *     Um pagamento recebido de um trabalho que não se fez está por devolver.
 */
export function negociacaoFechada(n: NegociacaoParaRetencao): boolean {
  if (n.referenciasVivas > 0) return false;
  if (houveTrabalho(n)) {
    if (!tem(n.confirmadoEm) && !tem(n.pagoEm)) return false;
    if (pagouAoProfissional({ formaDePagamento: n.formaDePagamento, comoEntrou: n.comoEntrou })) {
      const devia = temDividaDoProfissional(n.formaDePagamento, modeloDaLinha(n, n.negociacaoCriadaEm));
      return !devia || tem(n.clientePagouEm);
    }
    if (n.ofertaClyon) return true;
    if (!verificaOPagamento({ negociacaoCriadaEm: n.negociacaoCriadaEm ?? null })) return true;
    return tem(n.clientePagouEm) || n.pagamentosRecebidos > 0;
  }
  if (n.pagamentosRecebidos > 0 || tem(n.clientePagouEm)) return false;
  if (n.movimentos > 0) return false;
  return true;
}

export type PrazosDasRegrasNovas = {
  terminados: number;
  abandonados: number;
  rejeitados: number;
  anonimizar: number;
};

export const PRAZOS_DAS_REGRAS_NOVAS: PrazosDasRegrasNovas = {
  terminados: DIAS_DE_RETENCAO_DOS_PEDIDOS,
  abandonados: DIAS_PARA_OS_ABANDONADOS,
  rejeitados: DIAS_DOS_REJEITADOS,
  anonimizar: DIAS_ATE_ANONIMIZAR_OS_TRABALHOS,
};

function paraAnonimizar(p: PedidoParaRetencao, prazos: PrazosDasRegrasNovas): Decisao {
  const comDinheiroOuTrabalho = p.negociacoes.filter((n) => houveTrabalho(n) || houveDinheiro(n));
  if (comDinheiroOuTrabalho.some((n) => !negociacaoFechada(n))) return { faz: "fica", porque: "dinheiro_por_acertar" };
  // Um acordo por fazer ao lado de um trabalho fechado é uma ponta solta que pode precisar do cliente.
  if (p.negociacoes.some(acordoVivo)) return { faz: "fica", porque: "acordo_vivo" };
  if (p.diasParado < prazos.anonimizar) return { faz: "fica", porque: "no_prazo" };
  return { faz: "anonimizar" };
}

/**
 * O QUE AS REGRAS NOVAS FAZEM A ESTE PEDIDO.
 *
 *   · já anonimizado, ou com a data marcada por passar → fica;
 *   · aberto (pendente, em curso…): a regra de hoje — 90 dias, e nunca com um
 *     acordo, trabalho ou dinheiro;
 *   · concluído: com preço (no pedido ou acordado) ou com trabalho/dinheiro,
 *     NUNCA se apaga (D) — anonimiza-se 90 dias depois de fechado (A); sem
 *     nada disso, apaga-se aos 60, como hoje;
 *   · cancelado, arquivado, rejeitado: com trabalho ou dinheiro, anonimiza-se
 *     (A); com um acordo ainda de pé, fica; sem nada, apaga-se aos 60 (B, e
 *     o rejeitado passa dos 90 para os 60 — G).
 */
export function decidirComAsRegrasNovas(
  p: PedidoParaRetencao,
  prazos: PrazosDasRegrasNovas = PRAZOS_DAS_REGRAS_NOVAS,
): Decisao {
  if (p.anonimizado) return { faz: "fica", porque: "ja_anonimizado" };
  if (!p.dataMarcadaPassou) return { faz: "fica", porque: "data_marcada" };

  const status = (p.status ?? "").trim() || "pendente";
  const comTrabalhoOuDinheiro = p.negociacoes.some((n) => houveTrabalho(n) || houveDinheiro(n));

  if (!TERMINADOS.includes(status)) {
    const acordoDeHoje = p.negociacoes.some(
      (n) => n.estado === "acordada" || n.estado === "aguarda_contratacao" || n.valorAcordado != null,
    );
    if (acordoDeHoje || comTrabalhoOuDinheiro) return { faz: "fica", porque: "pedido_aberto_com_acordo" };
    return p.diasParado >= prazos.abandonados ? { faz: "apagar", regra: "abandonado" } : { faz: "fica", porque: "no_prazo" };
  }

  if (status === "concluido") {
    const comPreco =
      p.temPreco || p.negociacoes.some((n) => n.valorAcordado != null || n.estado === "acordada");
    if (comPreco || comTrabalhoOuDinheiro) return paraAnonimizar(p, prazos);
    return p.diasParado >= prazos.terminados ? { faz: "apagar", regra: "terminado" } : { faz: "fica", porque: "no_prazo" };
  }

  // cancelado, arquivado, rejeitado
  if (comTrabalhoOuDinheiro) return paraAnonimizar(p, prazos);
  if (p.negociacoes.some(acordoVivo)) return { faz: "fica", porque: "acordo_vivo" };
  const prazo = status === "rejeitado" ? prazos.rejeitados : prazos.terminados;
  if (p.diasParado < prazo) return { faz: "fica", porque: "no_prazo" };
  if (status === "rejeitado") return { faz: "apagar", regra: "rejeitado" };
  // Tinha acordo (valor combinado) e hoje ficava para sempre: é a parte B.
  return p.negociacoes.some((n) => n.valorAcordado != null)
    ? { faz: "apagar", regra: "sem_trabalho_nem_dinheiro" }
    : { faz: "apagar", regra: "terminado" };
}

/**
 * O QUE A REGRA DE HOJE FAZ AO MESMO PEDIDO — para o ensaio dizer a diferença.
 *
 * É a mesma condição do SQL de `purgarPedidosTerminados`, escrita em
 * JavaScript só para contar: «hoje levaria N, com as regras novas levaria M».
 * Quem apaga a sério com as regras de hoje continua a ser o SQL.
 */
export function apagariaHoje(p: PedidoParaRetencao, prazos: PrazosDasRegrasNovas = PRAZOS_DAS_REGRAS_NOVAS): boolean {
  if (!p.dataMarcadaPassou) return false;
  const guarda = p.negociacoes.some(
    (n) =>
      n.estado === "acordada" ||
      n.estado === "aguarda_contratacao" ||
      n.valorAcordado != null ||
      tem(n.execucaoEnviadaEm) ||
      tem(n.confirmadoEm) ||
      tem(n.pagoEm),
  );
  if (guarda) return false;
  const status = (p.status ?? "").trim() || "pendente";
  if (status === "concluido" && p.temPreco) return false; // D, que já vale
  const terminado = ["concluido", "cancelado", "arquivado"].includes(status);
  return p.diasParado >= (terminado ? prazos.terminados : prazos.abandonados);
}
