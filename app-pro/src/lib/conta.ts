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
import { CATEGORIAS_DOS_PROFISSIONAIS, type GrupoDeServicos } from "../../../src/lib/service-categories";
import {
  faltaDosPrecosDasMudancas,
  type FaltaDosPrecosDasMudancas,
  type PrecosDasMudancasNaConta,
} from "../../../src/lib/precos-das-mudancas-do-profissional";
import type { NovoModeloDaCarteira, NovoModeloDoPerfil } from "./novo-modelo";

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
export const SERVICOS_DA_INSCRICAO: readonly GrupoDeServicos[] = CATEGORIAS_DOS_PROFISSIONAIS;

/*
 * UMA SÓ LISTA — 29-10-2026. O perfil mostrava também, marcada, uma categoria
 * antiga que ele já tivesse (montagem, jardinagem), para a tirar. Saiu: o
 * registo, o perfil, o painel e o backoffice escolhem todos de
 * `CATEGORIAS_DOS_PROFISSIONAIS`, e uma categoria antiga fica gravada como
 * estava (a gravação manda a lista inteira dele).
 */

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
  /**
   * Os preços das mudanças (11-11-2026, d4): o estado para a linha do menu e a
   * falta para o cartão; null a quem não tem «Mudanças». Um site de antes não o manda.
   */
  precosDasMudancas?: PrecosDasMudancasNaConta | null;
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
  /** A guia de resíduos (d5, 12-11-2026): o operador licenciado onde descarrega. */
  destinoDosResiduos?: string;
  /** A prova do registo no SILiAmb: só o nome e a data (o ficheiro só o administrador abre). */
  provaDaGuia?: { nome: string | null; em: string } | null;
  /** O aviso do formato do código APA, calculado pelo site (ou null). */
  avisoDoCodigoApa?: string | null;
  estado: string;
  /** Já vem encurtado do site («PT50 ···· 3233»): o IBAN inteiro nunca sai de lá. */
  iban: string;
  temIban: boolean;
  ibanTitular: string;
  mbway: string;
  /** Quando mudaram o IBAN, o titular ou o MB WAY (d1, 12-11-2026); null nas contas de antes. */
  ibanMudadoEm?: string | null;
  ibanMudadoRecente?: boolean;
  /** O titular bate com o nome da conta? null quando não se sabe. */
  titularBateComONome?: boolean | null;
  desde: string | null;
  avaliacao: number | null;
  quantasAvaliacoes: number;
  trabalhosConcluidos: number;
  ultimasAvaliacoes: Avaliacao[];
  /**
   * O MODELO DE 15-11-2026 (d10): o que falta para receber e o perfil fiscal que
   * o cliente vê. Vem ao lado de `perfil` na rota e junta-se aqui ao ler; `null`
   * (ou ausente) antes da data ou num site antigo.
   */
  novoModelo?: NovoModeloDoPerfil | null;
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

/**
 * Os preços das mudanças por pôr — a falta do cartão, pela mesma conta do
 * painel: só a quem tem «Mudanças» e ainda não gravou preços.
 */
export function faltaDasMudancasDe(p: Perfil): FaltaDosPrecosDasMudancas | null {
  return faltaDosPrecosDasMudancas(p.categorias.includes("mudancas"), p.precosDasMudancas?.estado);
}

/**
 * O estado dos preços na linha do menu: «na lista» é sossego; «por preencher»
 * e «fora da lista» pedem um toque (`aviso`). Null sem estado.
 */
export function estadoDasMudancasNoMenu(p: Perfil | null): { rotulo: string; aviso: boolean } | null {
  const e = p?.precosDasMudancas;
  return e ? { rotulo: e.rotulo, aviso: e.estado !== "na_lista" } : null;
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
  /** Por pagar, o que FALTA (o mesmo que `porPagar`). */
  total: number;
  /** Por pagar, o que falta do IVA e da taxa — a frase NÃO se escolhe por aqui. */
  iva: number;
  comissao: number;
  /**
   * AS DUAS PARTES — 11-11-2026. A dívida inteira e o estado de cada parte,
   * como a rota da carteira os manda. Ausentes num site antigo: as frases de
   * `frases-da-divida.ts` caem no que falta e não mostram linhas.
   */
  ivaDaDivida?: number;
  comissaoDaDivida?: number;
  porPagar?: number;
  partes?: { parte: "iva" | "taxa"; valor: number; paga: boolean; pagoEm?: string | null }[];
  recebidoDoCliente: number;
  paga: boolean;
  abatida: boolean;
  abatidaNoLevantamento: boolean;
  nasceuEm: string | null;
  venceEm: string | null;
  /** Pago em mão num trabalho da plataforma: desconta-se do saldo, sem referência (01-11-2026). */
  descontaNoSaldo?: boolean;
  referencia: { metodo: "mbway" | "multibanco"; entidade: string | null; referencia: string | null; expiraEm: string | null } | null;
};

/** Um trabalho na carteira — `LinhaDaCarteira` de src/lib/trabalhos-da-carteira.ts (30-10-2026). */
export type LinhaDaCarteira = {
  negociacaoId: number;
  pedidoId: number | null;
  servico: string | null;
  cliente: string | null;
  diaDoTrabalhoTexto: string | null;
  valor: number;
  taxa: number;
  recebe: number;
  grupo: "por_receber" | "retido" | "recebido";
  razao: string;
  falta: number;
  recebidoEmTexto: string | null;
  como: string | null;
};

export type RespostaDaCarteira = {
  /** Os blocos de cima (30-10-2026); ausentes num site antigo. */
  resumo?: {
    porReceber: number;
    aCaminho: number;
    podePedir: number;
    aEsperaDaConfirmacao: number;
    clienteAindaNaoPagou: number;
    recebidoEsteMes: number;
    recebidoUltimos12Meses: number;
    recebidoTotal: number;
    recebidoEmMao: number;
  };
  trabalhos?: LinhaDaCarteira[];
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
  /** O modelo de 15-11-2026 (d10): o valor em atraso, o stand-by e os dados para receber. `null` antes da data. */
  novoModelo?: NovoModeloDaCarteira | null;
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
