import type { Proposta } from "@/lib/negociacao";

/** O que os ecrãs do painel do profissional partilham. */

export type Pedido = {
  negociacaoId: number;
  pedidoId: number;
  estado: string;
  fase: "a_negociar" | "a_executar" | "a_confirmar" | "confirmado" | "pago";
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
  /** Km em linha recta com folga de estrada, da base dele ao trabalho. */
  distanciaKm: number | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  querPagar: number | null;
  recebeSeAceitar: number | null;
  recebeSeFechado: number | null;
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
  tipo: "trabalho" | "levantamento";
  id: number;
  pedidoId: number | null;
  titulo: string;
  zona: string | null;
  valor: number;
  fase: string;
  data: string;
};

export type Carteira = {
  cativo: number;
  disponivel: number;
  aCaminho: number;
  levantado: number;
  totalGanho: number;
};

export type DadosDaCarteira = {
  carteira: Carteira;
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
  moradaFiscal: string;
  codigoPostalFiscal: string;
  localidadeFiscal: string;
  categorias: string[];
  zonas: string[];
  raioKm: number;
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
  return km < 1 ? "menos de 1 km" : `${Math.round(km)} km`;
}

/** A mesma distância, na linha do detalhe: desde a base que ele registou. */
export function distanciaDaBase(km: number): string {
  return km < 1
    ? "menos de 1 km da sua base"
    : `cerca de ${Math.round(km)} km da sua base`;
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
