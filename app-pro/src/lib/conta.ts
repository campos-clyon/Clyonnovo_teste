/**
 * A CONTA E A CARTEIRA DO PROFISSIONAL, COMO A APP AS LÊ — fase 4, 18-10-2026.
 *
 * Os tipos são as respostas de `GET /api/profissionais/perfil` e
 * `GET /api/profissionais/carteira` — as mesmas que o painel no navegador lê.
 * As regras (o que falta no perfil, as distinções, o IBAN, o MB WAY, o mínimo
 * de uma transferência) vêm dos ficheiros do site, por caminho relativo: uma
 * regra que mude no site muda na app no build seguinte.
 *
 * Puro (sem React Native): os testes do site importam-no.
 */
import { resumoDoPerfil, faltasDaSeccao, type ResumoDoPerfil, type SeccaoComFalta, type Falta } from "../../../src/lib/perfil-por-completar";
import {
  distincoesDe,
  FICHA_DA_DISTINCAO,
  quantasFaltamParaACoroa,
  type Distincao,
} from "../../../src/lib/distincoes-do-profissional";
import { MINIMO_PARA_LEVANTAR } from "../../../src/lib/carteira";
import { diaEmLisboa } from "../../../src/lib/hora-de-lisboa";
import { SERVICOS_PUBLICOS, type ServiceCategory } from "../../../src/lib/service-categories";

export { FICHA_DA_DISTINCAO, MINIMO_PARA_LEVANTAR };
export type { Distincao, Falta, ResumoDoPerfil, SeccaoComFalta };

// ── Os serviços que se escolhem ─────────────────────────────────────────────

/**
 * OS SERVIÇOS DA INSCRIÇÃO — 27-10-2026 (auditoria da orquestra).
 *
 * Os mesmos do /quero-ser-parceiro (`InscricaoForm.tsx`): os do plano
 * (`SERVICOS_PUBLICOS`, sem montagem nem jardinagem desde 25-10) e sem
 * «Outro serviço». O registo da app e o perfil escolhem daqui.
 */
export const SERVICOS_DA_INSCRICAO: ServiceCategory[] = SERVICOS_PUBLICOS.filter((c) => c.id !== "outro");

/**
 * O que o perfil mostra para escolher: os da inscrição e, à vista e marcado,
 * um que ele já tenha de antes e que já não está no plano — para o poder
 * tirar. Um que não tenha nunca aparece.
 */
export function servicosParaEscolher(
  todos: readonly ServiceCategory[],
  activos: readonly string[],
): ServiceCategory[] {
  const daInscricao = new Set(SERVICOS_DA_INSCRICAO.map((c) => c.id));
  return todos.filter((c) => daInscricao.has(c.id) || activos.includes(c.id));
}

// ── O perfil ────────────────────────────────────────────────────────────────

export type Avaliacao = { estrelas: number; comentario: string | null; em: string };

export type Perfil = {
  nome: string;
  email: string;
  telefone: string;
  nif: string;
  cidade: string;
  baseLat: number | null;
  baseLng: number | null;
  moradaFiscal: string;
  codigoPostalFiscal: string;
  localidadeFiscal: string;
  tipoVeiculo: string;
  fotoViaturaUrl: string | null;
  fotosViatura: string[];
  categorias: string[];
  zonas: string[];
  raioKm: number;
  custoKm: number | null;
  custoHoraPessoa: number | null;
  pessoasNaEquipa: number | null;
  custosFixosAnuais: Record<string, number | null> | null;
  trabalhosPorMes: number | null;
  margemPercent: number | null;
  /**
   * A margem de referência da CLYON, a que entra sem a dele — a das Configs,
   * que a rota do perfil manda (28-10-2026, d11). Era «40» escrito na app.
   */
  margemDeReferenciaPercent?: number | null;
  horasPorTrabalho: number | null;
  riscoPercent: number | null;
  avisosNoWhatsApp: boolean;
  avisosNoWhatsAppEm: string | null;
  emiteFatura: boolean;
  regimeIva: string;
  emiteGuiaTransporte: boolean;
  numeroTransportador: string;
  guiaVerificada: boolean;
  estado: string;
  /** Já vem encurtado do site («PT50 ···· 3233»): o IBAN inteiro nunca sai de lá. */
  iban: string;
  temIban: boolean;
  ibanTitular: string;
  mbway: string;
  desde: string | null;
  avaliacao: number | null;
  quantasAvaliacoes: number;
  trabalhosConcluidos: number;
  ultimasAvaliacoes: Avaliacao[];
};

export const ESTADO_DA_CONTA: Record<string, string> = {
  aprovado: "activo",
  pendente: "à espera de aprovação",
  rejeitado: "não aprovado",
  suspenso: "suspenso",
};

/** «5,0» — ou null sem avaliações. */
export function mediaCurta(media: number | null | undefined): string | null {
  return media == null || !Number.isFinite(media) ? null : media.toFixed(1).replace(".", ",");
}

/** O que falta no perfil, pela mesma conta do painel. */
export function resumoDe(p: Perfil): ResumoDoPerfil {
  return resumoDoPerfil(p);
}

/** Quantos campos faltam numa secção — o número ao lado da linha do menu. */
export function faltasEm(p: Perfil, seccao: SeccaoComFalta): Falta[] {
  return faltasDaSeccao(resumoDe(p).faltas, seccao);
}

/** As distinções dele e, sem coroa, quantas avaliações faltam para ela. */
export function distincoesDoPerfil(p: Perfil): { distincoes: Distincao[]; faltamParaACoroa: number | null } {
  const conta = { media: p.avaliacao, quantasAvaliacoes: p.quantasAvaliacoes, trabalhosConcluidos: p.trabalhosConcluidos };
  return { distincoes: distincoesDe(conta), faltamParaACoroa: quantasFaltamParaACoroa(conta) };
}

/** «21/09/2026» — um dia, em Lisboa. */
export function diaCurto(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const [a, m, dia] = diaEmLisboa(d).split("-");
  return `${dia}/${m}/${a}`;
}

// ── A carteira ──────────────────────────────────────────────────────────────

export type Movimento = {
  tipo: "trabalho" | "levantamento" | "divida_abatida";
  id: number;
  pedidoId: number | null;
  titulo: string;
  zona: string | null;
  /** O que sai é negativo. */
  valor: number;
  fase: string;
  data: string;
};

export type DividaDaCarteira = {
  negociacaoId: number;
  pedidoId: number | null;
  titulo: string;
  total: number;
  iva: number;
  comissao: number;
  recebidoDoCliente: number;
  paga: boolean;
  abatida: boolean;
  abatidaNoLevantamento: boolean;
  nasceuEm: string | null;
  venceEm: string | null;
  referencia: { metodo: "mbway" | "multibanco"; entidade: string | null; referencia: string | null; expiraEm: string | null } | null;
};

export type RespostaDaCarteira = {
  carteira: {
    porCobrar: number;
    cativo: number;
    disponivel: number;
    aCaminho: number;
    levantado: number;
    recebidoEmMao: number;
    abatidoEmDividas: number;
    totalGanho: number;
  };
  aPagarAClyon: number;
  levantavel: number;
  /** A parte do cativo de trabalhos ainda por fazer (site desde 18-10-2026; antes, ausente). */
  cativoPorFazer?: number;
  bloqueioEmDinheiro: { total: number; explicacao: string; negociacoes: number[] } | null;
  dividas: DividaDaCarteira[];
  movimentos: Movimento[];
  iban: string;
  temIban: boolean;
  titular: string | null;
  temPedidoPendente: boolean;
};

/**
 * «PARA RECEBER» — o número do topo da carteira, 18-10-2026 (pedido do dono).
 *
 * O que já é dele e ainda não lhe chegou ao banco: o disponível, o que vai a
 * caminho e o cativo dos trabalhos já feitos (à espera da confirmação). Sem
 * o cativo dos trabalhos por fazer — «deve ser valor para receber, mas não o
 * futuro».
 */
export function paraReceberDe(c: Pick<RespostaDaCarteira, "carteira" | "cativoPorFazer">): number {
  const k = c.carteira;
  const cativoFeito = Math.max(0, k.cativo - (c.cativoPorFazer ?? 0));
  return Math.round((k.disponivel + k.aCaminho + cativoFeito) * 100) / 100;
}

/** Pode pedir uma transferência agora? — a mesma condição do botão do painel. */
export function podeTransferir(c: Pick<RespostaDaCarteira, "temIban" | "temPedidoPendente" | "levantavel">): boolean {
  return c.temIban && !c.temPedidoPendente && c.levantavel >= MINIMO_PARA_LEVANTAR;
}

/** O valor de uma transferência, lido como ele o escreve («12,50»), ou null. */
export function lerValorDaTransferencia(texto: string, levantavel: number): number | null {
  const v = Number(texto.replace(/\s|€/g, "").replace(",", "."));
  if (!Number.isFinite(v) || v < MINIMO_PARA_LEVANTAR) return null;
  return Math.round(v * 100) / 100 <= levantavel ? Math.round(v * 100) / 100 : null;
}

/** O nome da fase de um movimento, como no histórico do painel. */
export const FASE_DO_MOVIMENTO: Record<string, string> = {
  a_executar: "por fazer",
  a_confirmar: "à espera da confirmação",
  confirmado: "confirmado",
  pago: "pago",
  pedido: "a caminho",
  recusado: "recusada",
};

/** Os movimentos agrupados por mês de Lisboa, o mais recente primeiro. */
export function movimentosPorMes(movimentos: Movimento[]): Array<{ mes: string; rotulo: string; total: number; movimentos: Movimento[] }> {
  const grupos = new Map<string, Movimento[]>();
  for (const m of movimentos) {
    const d = new Date(m.data);
    if (!Number.isFinite(d.getTime())) continue;
    const mes = diaEmLisboa(d).slice(0, 7);
    grupos.set(mes, [...(grupos.get(mes) ?? []), m]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([mes, lista]) => {
      const nome = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-PT", { timeZone: "UTC", month: "long", year: "numeric" });
      return {
        mes,
        rotulo: nome.charAt(0).toUpperCase() + nome.slice(1),
        total: Math.round(lista.reduce((s, m) => s + m.valor, 0) * 100) / 100,
        movimentos: lista,
      };
    });
}
