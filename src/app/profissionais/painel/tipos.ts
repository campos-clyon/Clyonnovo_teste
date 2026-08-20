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
  estrelas: number | null;
  valorAcordado: number | null;
  serviceType: string | null;
  city: string | null;
  urgency: string | null;
  description: string | null;
  filesJson: string | null;
  floor: string | null;
  hasElevator: string | null;
  precisaFatura: boolean;
  precisaGuiaTransporte: boolean;
  querPagar: number | null;
  recebeSeAceitar: number | null;
  recebeSeFechado: number | null;
  /** Só chegam preenchidos depois de ele ser contratado. */
  morada: string | null;
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
};

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
