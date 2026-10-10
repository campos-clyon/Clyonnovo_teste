import type { Proposta } from "@/lib/negociacao";
import type { SugestaoParaOProfissional } from "@/lib/sugestao-para-o-profissional";
import type { ModoDaOferta } from "@/lib/oferta-clyon";
import { kmPorExtenso } from "@/lib/sinais-do-trabalho";

/** O que os ecrãs do painel do profissional partilham. */

export type Pedido = {
  negociacaoId: number;
  pedidoId: number;
  estado: string;
  fase: "a_negociar" | "a_executar" | "a_confirmar" | "confirmado" | "pago";
  /**
   * O CLIENTE já pagou este trabalho À CLYON. `null` = a pergunta não existe.
   *
   * Nulo enquanto a plataforma não cobrar — e nulo não é «não pagou». Um é
   * «ainda não há pagamentos nesta plataforma», o outro é «este cliente não
   * pagou». Mostrar o primeiro como o segundo alarmava todos os profissionais
   * de uma vez.
   */
  clientePagou?: boolean | null;
  diasAteLibertar: number | null;
  provaJson: string | null;
  /** O JSON das propostas, tal como vem da base. */
  propostas: string | null;
  actualizadoEm: string;
  /** As datas do fim do trabalho — entram no histórico da negociação. */
  execucaoEnviadaEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  avaliadoEm: string | null;
  /** Quando ELE o arrumou. Não mexe no que o cliente vê. */
  arquivadoEm: string | null;
  estrelas: number | null;
  valorAcordado: number | null;
  serviceType: string | null;
  city: string | null;
  urgency: string | null;
  /** A data e hora desejadas pelo cliente, quando as indicou. */
  dataAgendada?: string | null;
  /**
   * Quando o cliente fez o pedido — o zero de "amanhã".
   *
   * A urgência fica gravada como palavra e lê-se sempre contra hoje: sem esta
   * data, um pedido de segunda-feira continuava a prometer «amanhã» na quinta.
   */
  criadoEm?: string | null;
  /**
   * "total" ou "carga" — o que o valor MEDE.
   *
   * Ver `base-do-preco.ts`. Anda agarrado ao número desde o formulário: um
   * «150 €» sem unidade tanto é o trabalho todo como cada viagem ao aterro.
   */
  baseDoPreco?: string | null;
  /*
   * O QUE UMA CARGA VALE NA CARRINHA DELE, quando o pedido e por carga.
   *
   * Vem pronto do servidor -- frase feita e tudo -- porque a conta depende
   * da carrinha que ele declarou no perfil, e o cartao nao a conhece. Vem
   * `null` quando nao ha nada a dizer: pedido por valor total, carrinha por
   * declarar, ou a carrinha grande, que e a referencia.
   *
   * ⚠️ E informacao para DECIDIR, nao o valor que ele aceita. Ver
   * `carga-da-carrinha.ts`.
   */
  cargaNaSuaCarrinha?: {
    titulo: string;
    texto: string;
    curto: string;
  } | null;
  /**
   * O dia que ele combinou com o cliente, depois de ser contratado.
   *
   * Diferente de `dataAgendada`, que é o que o cliente PEDIU. Guardar as duas
   * é o que permite ver que um trabalho pedido para quinta acabou marcado para
   * sábado. Ver `agenda-dos-trabalhos.ts`.
   */
  dataCombinada?: string | null;
  /** Quanto tempo leva, em minutos — null é «as duas horas do costume» (03-10-2026). */
  duracaoMinutos?: number | null;
  description: string | null;
  filesJson: string | null;
  floor: string | null;
  hasElevator: string | null;
  parkingDistance: string | null;
  /** Mudança: a outra ponta, e o percurso entre as duas. */
  moradaDestino?: string | null;
  localidadeDestino?: string | null;
  andarDestino?: string | null;
  elevadorDestino?: string | null;
  estacionamentoDestino?: string | null;
  percursoKm?: number | null;
  /** Entulho: como está e quantos sacos são. */
  entulhoEstado?: string | null;
  entulhoQuantidade?: string | null;
  /** O que o cliente escreveu quando não eram sacos — «4 m³». */
  entulhoQuantidadeDita?: string | null;
  /** Km de carro, da base dele ao trabalho — pela estrada quando dá. */
  distanciaKm: number | null;
  /** Minutos de carro, quando a estrada foi consultada. */
  minutosDeCarro?: number | null;
  /**
   * `estrada` = percurso real. `estimativa` = linha recta com folga.
   *
   * O ecrã tem de saber a diferença: dizer «33 km» sobre uma linha recta é
   * apresentar um palpite como se fosse uma medição.
   */
  distanciaMedidaPor?: "estrada" | "estimativa" | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  querPagar: number | null;
  recebeSeAceitar: number | null;
  recebeSeFechado: number | null;
  /** As taxas gravadas nesta negociação — para o ecrã contar como o servidor conta. */
  taxas?: { cliente: number; profissional: number };
  /** Como o cliente paga: na_plataforma, dinheiro ou pos_recolha. */
  formaDePagamento?: string | null;
  /** Quando a negociação abriu — decide o modelo do preço (IVA incluído, 01-10-2026). */
  criadaEm?: string | null;
  /**
   * A conta da CLYON feita PARA ELE: custos com os quilómetros dele, preço
   * sugerido e o que lhe fica. Ver `sugestao-para-o-profissional.ts`.
   *
   * Desde 10-09-2026 é o SEGUNDO número do cartão, em letra pequena: diz-lhe
   * se o trabalho lhe compensa, e já não quanto vale o trabalho — isso é o
   * `valorDaClyon`.
   */
  sugestao?: SugestaoParaOProfissional | null;
  /**
   * O valor que a CLYON pôs no pedido, no líquido dele.
   *
   * "O valor que deve aparecer para os pros nos pedidos é o valor que
   * colocamos aqui" — é o número grande do cartão.
   */
  valorDaClyon?: number | null;
  /**
   * Quantos OUTROS profissionais já puseram um número neste pedido.
   *
   * A barra da concorrência lê-se daqui — ver `concorrencia.ts`. Zero é uma
   * corrida de um; seis é uma corrida que ele provavelmente já perdeu, e essa
   * diferença é a que decide se vale a pena responder.
   */
  concorrentes?: number | null;
  /**
   * UM TRABALHO CLYON DE VALOR FIXO — 02-10-2026. Nulo = um pedido como os
   * outros. «distribuida»: aceitar põe-no na lista, e a CLYON escolhe;
   * «directa»: só a ele, e aceitar fecha. Ver `oferta-clyon.ts`.
   */
  ofertaClyon?: ModoDaOferta | null;
  /**
   * O PEDIDO FOI CANCELADO OU ARQUIVADO pela CLYON — 08-10-2026. Separa, nos
   * Recusados, o que se perdeu porque o pedido acabou do que ficou com outro
   * profissional. Ver `pedido-arrumado.ts`.
   */
  pedidoCancelado?: boolean;
  /** O valor do Trabalho CLYON — desde 08-10-2026, o preço ao cliente sem IVA; o que ele recebe é isto menos a taxa. */
  valorFixo?: number | null;
  /**
   * Quando ele abriu este trabalho pela primeira vez. `null` = ainda por abrir.
   *
   * É isto que faz o distintivo «novo» apagar-se sozinho. Antes, «novo» queria
   * dizer «está no separador dos novos» — e ficava em todos os cartões para
   * sempre, mesmo nos que ele já tinha lido dez vezes.
   */
  abertoEm?: string | null;
  /** Só chegam preenchidos depois de ele ser contratado. */
  morada: string | null;
  /** Contexto real do cliente (por email); null quando não há historial ligável. */
  clienteContexto?: { desde: string | null; confirmados: number } | null;
  contactoNome: string | null;
  contactoTelefone: string | null;
};

export type Movimento = {
  /** `divida_abatida`: o IVA e a comissão pagos à CLYON com o saldo (01-10-2026). */
  tipo: "trabalho" | "levantamento" | "divida_abatida";
  id: number;
  pedidoId: number | null;
  titulo: string;
  zona: string | null;
  valor: number;
  fase: string;
  data: string;
};

export type Carteira = {
  /**
   * Trabalho feito que o cliente ainda não pagou — nem cá nem lá.
   *
   * Linha separada de `cativo` de propósito: cativo quer dizer «a CLYON tem o
   * seu dinheiro», e juntá-los prometia uma garantia sobre dinheiro que ninguém
   * entregou. Zero enquanto a plataforma não cobrar.
   */
  porCobrar: number;
  cativo: number;
  disponivel: number;
  aCaminho: number;
  levantado: number;
  /** Pago em dinheiro, no local. Já está com ele; nunca passou pela CLYON. */
  recebidoEmMao?: number;
  /** O saldo com que pagou dívidas à CLYON — «abater no saldo», 01-10-2026. */
  abatidoEmDividas?: number;
  totalGanho: number;
};

/**
 * Uma dívida à CLYON — o IVA e a comissão de um trabalho pago em dinheiro,
 * com IVA incluído (01-10-2026). Com a referência viva, quando a há.
 */
export type DividaDaCarteira = {
  negociacaoId: number;
  pedidoId: number | null;
  titulo: string;
  total: number;
  iva: number;
  comissao: number;
  recebidoDoCliente: number;
  /** Até quando tem para a pagar antes de ficar bloqueado no dinheiro (01-10-2026). */
  venceEm?: string | null;
  referencia: {
    metodo: "mbway" | "multibanco";
    entidade: string | null;
    referencia: string | null;
    expiraEm: string | null;
  } | null;
};

export type DadosDaCarteira = {
  carteira: Carteira;
  /** O que deve à CLYON de trabalhos em dinheiro com IVA incluído. 01-10-2026. */
  aPagarAClyon?: number;
  /**
   * O que pode pedir para transferir: o disponível menos o que deve à CLYON
   * («abater no saldo», 01-10-2026). Em falta (resposta antiga), o disponível.
   */
  levantavel?: number;
  /**
   * Não pode propor nem aceitar trabalhos em dinheiro: tem dívidas por pagar
   * há mais de 7 dias. A explicação traz o valor e a referência. 01-10-2026.
   */
  bloqueioEmDinheiro?: { total: number; explicacao: string; negociacoes: number[] } | null;
  dividas?: DividaDaCarteira[];
  movimentos: Movimento[];
  iban: string;
  temIban: boolean;
  titular: string | null;
  temPedidoPendente: boolean;
};

export type Perfil = {
  nome: string;
  email: string;
  telefone: string;
  nif: string;
  cidade: string;
  /** Onde a base ficou no mapa. `null` = ainda não foi escolhida da lista. */
  baseLat?: number | null;
  baseLng?: number | null;
  moradaFiscal: string;
  /** Outro caminho para o dinheiro, quando não há IBAN à mão. */
  mbway?: string;
  codigoPostalFiscal: string;
  localidadeFiscal: string;
  categorias: string[];
  zonas: string[];
  raioKm: number;
  /** Os custos dele, para a sugestão de valor. `null` = referência da CLYON. */
  custoKm?: number | null;
  custoHoraPessoa?: number | null;
  pessoasNaEquipa?: number | null;
  /** Por rubrica, em euros por ano: viaVerde, manutencao, iuc, inspecao, seguro. */
  custosFixosAnuais?: Record<string, number | null> | null;
  trabalhosPorMes?: number | null;
  margemPercent?: number | null;
  /** Horas que um trabalho lhe leva em média, deslocação e recolha incluídas. */
  horasPorTrabalho?: number | null;
  /** Seguro de risco: % dos custos directos posta de lado em cada trabalho. */
  riscoPercent?: number | null;
  /** Disse que sim aos avisos de pedido novo no WhatsApp — e quando. */
  avisosNoWhatsApp?: boolean;
  avisosNoWhatsAppEm?: string | null;
  emiteFatura: boolean;
  regimeIva: string;
  emiteGuiaTransporte: boolean;
  numeroTransportador: string;
  guiaVerificada: boolean;
  estado: string;
  iban: string;
  temIban: boolean;
  ibanTitular: string;
  desde: string | null;
  /** Média das avaliações, ou null enquanto não houver nenhuma. */
  avaliacao: number | null;
  quantasAvaliacoes: number;
  /** Trabalhos confirmados pelo cliente. E o numero do cartao do perfil. */
  trabalhosConcluidos?: number;
  /** «carrinha», «camiao» — a palavra que ja existia. */
  tipoVeiculo?: string;
  /** A fotografia da viatura, no Blob. Null enquanto nao puser nenhuma. */
  fotoViaturaUrl?: string | null;
  /*
   * TODAS AS VIATURAS — 19-09-2026. A de cima continua a existir e é a
   * primeira desta lista: é dela que vivem o cartão do perfil e a ficha no
   * backoffice, que só mostram uma.
   */
  fotosViatura?: string[];
  /** As avaliações recebidas, sem quem as escreveu. */
  ultimasAvaliacoes: Array<{
    estrelas: number;
    comentario: string | null;
    em: string | null;
  }>;
};

export const URGENCIA: Record<string, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  this_week: "Esta semana",
  next_week: "Próxima semana",
  flexible: "Sem pressa",
  // Dois pedidos antigos ficaram com o valor escrito em português.
  flexivel: "Sem pressa",
};

/*
 * O ACESSO AO LOCAL, EM PORTUGUÊS.
 *
 * Os valores ficam guardados no vocabulário do formulário do cliente e do
 * motor de preços; no ecrã do profissional saía o valor cru — "Estacionar:
 * door". Aqui traduz-se.
 *
 * A LISTA VEIO DA BASE, NÃO DA CABEÇA. A primeira versão disto tinha só
 * "easy" e "difficult" — que era o que o formulário do backoffice oferecia —
 * e o valor mais comum de todos, `door`, com 75 pedidos, caía no descuido e
 * aparecia em inglês. Perguntou-se à base o que lá está mesmo antes de
 * escrever estas linhas.
 *
 * As palavras são as mesmas que o cliente leu quando respondeu (ver
 * OrderSummaryCard), viradas para quem vai lá: ele não quer saber o que foi
 * perguntado, quer saber se encosta a carrinha.
 */
export const ELEVADOR: Record<string, string> = {
  yes: "Com elevador",
  small: "Elevador pequeno",
  no: "Sem elevador",
  // Um pedido antigo ficou com o valor escrito em português.
  sim: "Com elevador",
  unknown: "Não sabemos",
};

export const ESTACIONAMENTO: Record<string, string> = {
  door: "Encosta-se à porta",
  under_20m: "Até 20 m da porta",
  over_30m: "Mais de 30 m da porta",
  difficult: "Estacionamento difícil",
  // Vocabulário antigo do backoffice, em pedidos já gravados.
  easy: "Sem dificuldade",
  porta: "Encosta-se à porta",
  unknown: "Não sabemos",
};

/**
 * O estado do entulho, que decide se o trabalho é carregar ou ensacar primeiro.
 *
 * O motor de preços conta mais 30% de tempo para entulho no chão — e quem vai
 * lá precisa de saber a mesma coisa antes de propor um valor.
 */
export const ESTADO_DO_ENTULHO: Record<string, string> = {
  ensacado: "já ensacado",
  chao: "no chão, por ensacar",
  misto: "misto",
  // Pedidos antigos, e só esses: a escolha saiu dos formulários. Ver
  // `sacos-de-entulho.ts` — recolhe-se a saco de 25 kg, à mão.
  bigbags: "em big bags",
};

/**
 * Traduz, e cala-se quando não há nada de útil a dizer.
 *
 * "Não sei" e um valor por preencher não são informação — são uma linha a
 * ocupar espaço no ecrã de quem está a decidir. E um valor que não
 * conheçamos passa tal e qual: melhor estranho do que desaparecido.
 */
export function emPortugues(
  dicionario: Record<string, string>,
  valor: string | null | undefined,
): string | null {
  if (!valor) return null;
  const limpo = valor.trim();
  if (!limpo || limpo === "unknown") return null;
  return dicionario[limpo] ?? limpo;
}

/**
 * A distância, dita como quem fala.
 *
 * Sem o til: ele pediu para o tirar, e tinha razão — um sinal de matemática
 * no meio de uma morada lê-se como ruído, não como "por alto". A ressalva
 * não se perde, muda de sítio: na lista o número vai limpo, e na linha do
 * detalhe a aproximação diz-se por palavras ("cerca de"), que é como uma
 * pessoa a diria.
 */
export function distanciaPorExtenso(km: number): string {
  /*
   * COM A CASA DECIMAL, porque ao lado dela está o €/km.
   *
   * O cartão mostrava «15 km» e «21,4 €/km» sobre 329,00 €, e quem dividisse
   * chegava a 21,9. A distância arredondava a inteiro; o €/km dividia pela
   * verdadeira, 15,37. Ver `kmPorExtenso` — a decisão está lá.
   *
   * O «menos de 1 km» fica: abaixo do quilómetro o número não é o assunto.
   */
  return km < 1 ? "menos de 1 km" : `${kmPorExtenso(km)} km`;
}

/** A mesma distância, na linha do detalhe: desde a base que ele registou. */
/**
 * A distância dita como quem fala, e a dizer de si própria.
 *
 * «cerca de 6 km da sua base» era o que se dizia sempre, viesse o número de
 * onde viesse. Agora que há duas origens — a estrada e a linha recta — a
 * palavra muda com ela: o que foi medido diz-se sem «cerca de», e o que foi
 * estimado assume-o.
 */
export function distanciaDaBase(
  km: number | null | undefined,
  medidaPor?: "estrada" | "estimativa" | null,
): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  const n = distanciaPorExtenso(km);
  if (!n) return null;
  if (medidaPor === "estrada") return `${n} de carro, da sua base`;
  /*
   * "cerca de menos de 1 km" não se diz. Quando a frase já é aproximada por
   * si — «menos de 1 km» — o «cerca de» só a torna desajeitada.
   */
  return n.startsWith("menos de") ? `${n} da sua base` : `cerca de ${n} da sua base`;
}


export function fotosDe(json: string | null): Array<{ url: string; name?: string }> {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? l.filter((f) => f && typeof f.url === "string") : [];
  } catch {
    return [];
  }
}

export function provaDe(json: string | null): { fotos: string[]; nota: string; em: string } | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json);
    return {
      fotos: Array.isArray(p?.fotos) ? p.fotos.filter((f: unknown) => typeof f === "string") : [],
      nota: typeof p?.nota === "string" ? p.nota : "",
      em: typeof p?.em === "string" ? p.em : "",
    };
  } catch {
    return null;
  }
}

/**
 * De quem é a vez, numa negociação aberta.
 *
 * "O profissional fez uma proposta mas o pedido ficou no estado «à espera da
 * sua resposta» — devia estar à espera da resposta do cliente, já que foi ele
 * que fez a proposta."
 *
 * O estado `aberta` cobre os DOIS lados da mesma mesa: o cliente propôs e
 * falta ele responder, ou ele propôs e falta o cliente. A lista dizia sempre
 * a primeira, porque olhava só para o nome do estado — e o ecrã de dentro,
 * que olha para as propostas, dizia a segunda. O mesmo trabalho contava duas
 * histórias conforme se abria ou não.
 *
 * Quem manda é a última proposta PENDENTE, e de quem ela é. Se não houver
 * nenhuma pendente, ninguém está à espera de ninguém — e é isso que se diz.
 */
export function deQuemEAVez(propostasJson: string | null): "sua" | "cliente" | null {
  const pendente = [...propostasDe(propostasJson)]
    .reverse()
    .find((x) => x?.estado === "pendente");
  if (!pendente) return null;
  return pendente.por === "profissional" ? "cliente" : "sua";
}

/**
 * As propostas tal como estão gravadas.
 *
 * O tipo é o do motor — `Proposta` de negociacao.ts — e não um parecido escrito
 * aqui. Um tipo paralelo aceita o que o motor recusa, e a divergência só
 * aparece quando alguém abre uma negociação e vê os valores errados.
 */
export function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}
