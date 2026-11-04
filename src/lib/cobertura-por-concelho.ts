import { CONCELHOS_DA_COBERTURA, concelhoDoPedido, type IdDoConcelho } from "./concelhos-da-cobertura";
import { distanciaParaElegibilidade } from "./distancia-entre-pontos";
import { primeiraPropostaDoProfissional, temposDeResposta } from "./tempo-de-resposta";

/**
 * A COBERTURA POR CONCELHO — 04-11-2026 (d16, Fase A do plano de expansão).
 *
 * «Medir todas as semanas: parceiros activos com base a 25 km ou menos, % de
 * pedidos com proposta em menos de 6 horas, fechados.» Primeiro fez-se à mão
 * (a Rede de Profissionais, a 03-11); isto é o contador no backoffice, só de
 * leitura. Uma linha por concelho — os 16 de hoje, e Vila Franca de Xira e
 * Mafra (Fase B).
 *
 * AS MESMAS RÉGUAS DO ENVIO. A distância é a de `profissional-elegivel.ts`
 * (linha recta × 1,3, da base do parceiro ao centro do concelho) e o raio é o
 * dele. O concelho do pedido é o da morada (`concelhoDoPedido`).
 *
 * AS COLUNAS:
 *   · no raio — aprovados (e activos na conta) com o centro do concelho dentro
 *     do raio deles;
 *   · base a 25 km ou menos — aprovados com a base perto;
 *   · activos perto em 14 / 30 dias — dos de base perto, os que fizeram pelo
 *     menos uma proposta ou um trabalho na janela (aceitar um Trabalho CLYON
 *     conta como proposta);
 *   · pedidos em 30 dias com a morada no concelho;
 *   · desses, quantos tiveram a 1.ª proposta (ou o preço da CLYON) em menos
 *     de 6 horas;
 *   · fechados — com um parceiro contratado, ou concluídos.
 *
 * A COR conta só os FORTES: de base perto, com pelo menos 2 trabalhos em 30
 * dias e que respondem em 6 horas ou menos (mediana). 2 ou mais = verde,
 * 1 = amarelo, 0 = vermelho.
 *
 * AS CONTAS DE TESTE FICAM DE FORA: os parceiros marcados (ou com «teste» no
 * nome) e os pedidos de teste (o nome do contacto, ou fechados com uma conta
 * de teste). Quem chama já as tira; esta função volta a tirá-las.
 *
 * Pura e testada (`cobertura-por-concelho.test.ts`).
 */

export const KM_DA_BASE_PERTO = 25;
export const HORAS_DA_PRIMEIRA_PROPOSTA = 6;
export const TRABALHOS_DE_QUEM_E_FORTE = 2;
export const MINUTOS_DE_QUEM_E_FORTE = 6 * 60;

export type CorDaCobertura = "verde" | "amarelo" | "vermelho";

export type ParceiroParaACobertura = {
  id: number;
  estado: string | null;
  isActive?: unknown;
  deTeste?: boolean;
  raioKm: number | null;
  baseLat: unknown;
  baseLng: unknown;
};

export type NegociacaoParaACobertura = {
  providerId: number;
  pedidoId: number;
  estado: string;
  createdAt: Date | string | null;
  updatedAt?: Date | string | null;
  propostasJson?: string | null;
  ofertaClyon?: string | null;
  abertoProfissionalEm?: Date | string | null;
  atribuidaEm?: Date | string | null;
  dataCombinada?: Date | string | null;
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
};

export type PedidoParaACobertura = {
  id: number;
  createdAt: Date | string | null;
  postalCode?: unknown;
  city?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  status?: string | null;
  /** O preço de um Trabalho CLYON enviado ao cliente — conta como a 1.ª proposta. */
  propostaEnviadaEm?: Date | string | null;
  deTeste?: boolean;
};

export type LinhaDaCobertura = {
  id: IdDoConcelho;
  nome: string;
  faseB: boolean;
  noRaio: number;
  basePerto: number;
  activos14: number;
  activos30: number;
  pedidos30: number;
  comPropostaEm6h: number;
  /** De 0 a 100, arredondado; null sem pedidos. */
  percentagemEm6h: number | null;
  fechados: number;
  fortes: number;
  cor: CorDaCobertura;
};

export type CoberturaPorConcelho = {
  linhas: LinhaDaCobertura[];
  /** Pedidos de 30 dias a que não se soube dar concelho, ou fora dos 18. */
  pedidosSemConcelho: number;
  calculadoEm: string;
};

function data(v: Date | string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A data de um trabalho feito (ou marcado): o envio da prova, a confirmação, o dia combinado ou a atribuição. */
function dataDoTrabalho(n: NegociacaoParaACobertura): Date | null {
  return data(n.execucaoEnviadaEm) ?? data(n.confirmadoEm) ?? data(n.dataCombinada) ?? data(n.atribuidaEm) ?? data(n.updatedAt) ?? data(n.createdAt);
}

/** Quando ele respondeu nesta negociação: a 1.ª proposta dele, ou — num Trabalho CLYON — o aceitar. */
function dataDaResposta(n: NegociacaoParaACobertura): Date | null {
  const propos = primeiraPropostaDoProfissional(n.propostasJson ?? null);
  if (propos) return propos;
  if (n.ofertaClyon && (n.estado === "aguarda_contratacao" || n.estado === "acordada")) {
    return data(n.atribuidaEm) ?? data(n.updatedAt);
  }
  return null;
}

export function corDaCobertura(fortes: number): CorDaCobertura {
  return fortes >= 2 ? "verde" : fortes === 1 ? "amarelo" : "vermelho";
}

export function coberturaPorConcelho(a: {
  parceiros: ParceiroParaACobertura[];
  negociacoes: NegociacaoParaACobertura[];
  pedidos: PedidoParaACobertura[];
  agora?: Date;
}): CoberturaPorConcelho {
  const agora = a.agora ?? new Date();
  const ha = (dias: number) => agora.getTime() - dias * 86_400_000;
  const desde14 = ha(14);
  const desde30 = ha(30);

  const parceiros = a.parceiros.filter(
    (p) => p.estado === "aprovado" && Number(p.isActive ?? 1) === 1 && !p.deTeste,
  );
  const deTeste = new Set(a.parceiros.filter((p) => p.deTeste).map((p) => Number(p.id)));
  const negociacoes = a.negociacoes.filter((n) => !deTeste.has(Number(n.providerId)));

  // ── Cada parceiro: a última resposta, os trabalhos de 30 dias, a rapidez ──
  const ultimaActividade = new Map<number, number>();
  const trabalhos30 = new Map<number, number>();
  for (const n of negociacoes) {
    const id = Number(n.providerId);
    const marcas: Array<Date | null> = [dataDaResposta(n)];
    if (n.estado === "acordada") {
      const t = dataDoTrabalho(n);
      marcas.push(t);
      if (t && t.getTime() >= desde30) trabalhos30.set(id, (trabalhos30.get(id) ?? 0) + 1);
    }
    for (const m of marcas) {
      if (m && m.getTime() > (ultimaActividade.get(id) ?? 0)) ultimaActividade.set(id, m.getTime());
    }
  }
  const rapidez = temposDeResposta(negociacoes, agora, 30);

  // ── Cada pedido de 30 dias: o concelho, a 1.ª proposta, se fechou ──
  const negsDoPedido = new Map<number, NegociacaoParaACobertura[]>();
  for (const n of a.negociacoes) {
    const k = Number(n.pedidoId);
    if (!negsDoPedido.has(k)) negsDoPedido.set(k, []);
    negsDoPedido.get(k)!.push(n);
  }
  const porConcelho = new Map<IdDoConcelho, { pedidos: number; em6h: number; fechados: number }>();
  let pedidosSemConcelho = 0;
  for (const p of a.pedidos) {
    const criado = data(p.createdAt);
    if (!criado || criado.getTime() < desde30) continue;
    const dele = negsDoPedido.get(Number(p.id)) ?? [];
    // Um pedido de teste: marcado por quem chama, ou fechado com uma conta de teste.
    if (p.deTeste || dele.some((n) => n.estado === "acordada" && deTeste.has(Number(n.providerId)))) continue;
    const id = concelhoDoPedido(p);
    if (!id) {
      pedidosSemConcelho += 1;
      continue;
    }
    const reais = dele.filter((n) => !deTeste.has(Number(n.providerId)));
    const respostas = [
      ...reais.map((n) => primeiraPropostaDoProfissional(n.propostasJson ?? null)),
      data(p.propostaEnviadaEm),
    ].filter((d): d is Date => d != null && d.getTime() >= criado.getTime());
    const primeira = respostas.length > 0 ? Math.min(...respostas.map((d) => d.getTime())) : null;
    const l = porConcelho.get(id) ?? { pedidos: 0, em6h: 0, fechados: 0 };
    l.pedidos += 1;
    if (primeira != null && primeira - criado.getTime() < HORAS_DA_PRIMEIRA_PROPOSTA * 3_600_000) l.em6h += 1;
    if (p.status === "concluido" || reais.some((n) => n.estado === "acordada")) l.fechados += 1;
    porConcelho.set(id, l);
  }

  // ── As linhas ──
  const linhas = CONCELHOS_DA_COBERTURA.map((c): LinhaDaCobertura => {
    let noRaio = 0;
    let basePerto = 0;
    let activos14 = 0;
    let activos30 = 0;
    let fortes = 0;
    for (const p of parceiros) {
      const km = distanciaParaElegibilidade({ lat: Number(p.baseLat), lng: Number(p.baseLng) }, c.centro);
      if (km == null) continue;
      const raio = p.raioKm == null ? null : Number(p.raioKm);
      if (raio != null && Number.isFinite(raio) && km <= raio) noRaio += 1;
      if (km > KM_DA_BASE_PERTO) continue;
      basePerto += 1;
      const ultima = ultimaActividade.get(Number(p.id)) ?? 0;
      if (ultima >= desde14) activos14 += 1;
      if (ultima >= desde30) activos30 += 1;
      const minutos = rapidez.get(Number(p.id))?.minutosAtePropor ?? null;
      if (
        (trabalhos30.get(Number(p.id)) ?? 0) >= TRABALHOS_DE_QUEM_E_FORTE &&
        minutos != null &&
        minutos <= MINUTOS_DE_QUEM_E_FORTE
      ) {
        fortes += 1;
      }
    }
    const pc = porConcelho.get(c.id) ?? { pedidos: 0, em6h: 0, fechados: 0 };
    return {
      id: c.id,
      nome: c.nome,
      faseB: c.faseB,
      noRaio,
      basePerto,
      activos14,
      activos30,
      pedidos30: pc.pedidos,
      comPropostaEm6h: pc.em6h,
      percentagemEm6h: pc.pedidos > 0 ? Math.round((pc.em6h / pc.pedidos) * 100) : null,
      fechados: pc.fechados,
      fortes,
      cor: corDaCobertura(fortes),
    };
  });

  return { linhas, pedidosSemConcelho, calculadoEm: agora.toISOString() };
}

/**
 * Os pedidos deste mês por concelho, para a página de recrutamento — só os que
 * passam o mínimo (`MINIMO_PARA_MOSTRAR` de pedidos-da-semana.ts): um número
 * pequeno não ajuda a recrutar, e não se mostra.
 */
export function pedidosPorConcelho(
  pedidos: PedidoParaACobertura[],
  minimo: number,
): Partial<Record<IdDoConcelho, number>> {
  const contagem: Partial<Record<IdDoConcelho, number>> = {};
  for (const p of pedidos) {
    if (p.deTeste) continue;
    const id = concelhoDoPedido(p);
    if (id) contagem[id] = (contagem[id] ?? 0) + 1;
  }
  const out: Partial<Record<IdDoConcelho, number>> = {};
  for (const [id, n] of Object.entries(contagem) as Array<[IdDoConcelho, number]>) if (n >= minimo) out[id] = n;
  return out;
}
