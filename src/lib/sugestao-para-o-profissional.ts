import { estimateLaborHours, type FastEstimateInput } from "@/lib/pricing-helper";
import type { SimulatorSettingsMap } from "@/lib/simulator-settings";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import {
  custosFixosPorTrabalhoDe,
  totalDosCustosFixosAnuais,
  type CustosFixosAnuais,
} from "@/lib/custos-fixos-do-profissional";

/**
 * A SUGESTÃO DA CLYON, CALCULADA PARA QUEM ESTÁ A VER O PEDIDO.
 *
 * "A CLYON deve dar uma sugestão, não um valor para aceitação inicial. O
 * valor que coloquei aparece para aceitar ou fazer uma proposta, mas devia
 * vir somente o valor com uma estimativa de custos, lucros e a nossa
 * estimativa de valor a cobrar — e vamos usar dados reais do profissional
 * que está a ver o pedido para calcular individualmente esses valores."
 * — 09-09-2026.
 *
 * Até aqui o profissional abria o pedido e via o valor de partida como uma
 * coisa a aceitar: «O cliente quer pagar 330 € — Aceitar». Esse número era
 * o mesmo para todos, viesse de Amora ou de Setúbal, e não dizia nada sobre
 * se o trabalho lhe compensa. Agora vê a conta feita PARA ELE, com a mesma
 * fórmula que o backoffice usa para si próprio (`calculateFastEstimate`):
 *
 *   custo mínimo  = combustível + pessoal + custos fixos
 *   preço sugerido = custo mínimo × (1 + margem)
 *
 * O que muda de profissional para profissional: os quilómetros são os DELE
 * — da base dele ao trabalho, pela estrada — e, se os tiver definido no
 * perfil, o custo por km, o custo por hora e pessoa, o tamanho da equipa,
 * os custos fixos (anuais, divididos pelos trabalhos do ano) e a margem que
 * quer são os dele. "Esses dados eram nossos — vamos deixar o pro responder
 * com os dados dele." Sem isso, campo a campo, entram os valores de
 * referência da CLYON.
 *
 * É pura de propósito: recebe números e devolve números. Quem vai buscar a
 * distância e os parâmetros à base são as rotas — esta função tem de ser
 * testável sem base nenhuma.
 */

export type ParametrosDeCusto = {
  /** €/km, ida e volta contados. */
  custoKm: number;
  /** €/hora por pessoa. */
  custoHoraPessoa: number;
  /** Pessoas na equipa, quando o profissional não disse quantas tem. */
  numPessoas: number;
  /** Custos fixos por serviço, em €. */
  overhead: number;
  /** Margem sobre o custo (0,4 = 40 %). */
  margem: number;
};

/** Os parâmetros da CLYON, lidos do mesmo mapa que o simulador usa. */
export function parametrosDoMapa(mapa: Partial<SimulatorSettingsMap>): ParametrosDeCusto {
  const n = (v: unknown, porOmissao: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : porOmissao;
  return {
    custoKm: n(mapa.custo_km, 0.5),
    custoHoraPessoa: n(mapa.custo_hora_pessoa, 9),
    numPessoas: n(mapa.num_pessoas_equipa, 3),
    overhead: n(mapa.overhead_por_servico, 17),
    margem: n(mapa.margem_lucro, 0.4),
  };
}

/**
 * Os custos fixos anuais, por rubrica, e a conta que os põe por trabalho,
 * vivem em custos-fixos-do-profissional.ts — sem servidor, para o ecrã do
 * perfil os poder pré-visualizar. Aqui só se usam.
 */
export {
  RUBRICAS_DOS_CUSTOS_FIXOS,
  totalDosCustosFixosAnuais,
  type CustosFixosAnuais,
} from "@/lib/custos-fixos-do-profissional";

/** O que o profissional definiu no perfil. `null` = usa a referência da CLYON. */
export type CustosDoProfissional = {
  custoKm?: number | null;
  custoHoraPessoa?: number | null;
  pessoasNaEquipa?: number | null;
  custosFixosAnuais?: CustosFixosAnuais | null;
  /** Quantos trabalhos faz por mês, em média — o divisor dos custos fixos. */
  trabalhosPorMes?: number | null;
  /** A margem que quer, em percentagem (40 = 40 %). */
  margemPercent?: number | null;
  /**
   * O tempo médio que UM trabalho lhe leva, em horas, deslocação e recolha
   * incluídas. "Assim não usaremos esse dado pela IA e sim o estipulado pelo
   * pro." Quando está, manda sobre a estimativa do simulador.
   */
  horasPorTrabalho?: number | null;
  /**
   * O seguro de risco, em percentagem dos custos directos (combustível e
   * pessoal). Uma reserva para partidos, cancelamentos e viagens em vão, que
   * entra no custo mínimo ANTES da margem. Vazio = 0 %.
   */
  riscoPercent?: number | null;
};

/**
 * Os custos fixos POR TRABALHO, a partir dos anuais dele.
 *
 * Só existe quando há rubricas E um número de trabalhos por mês: sem o
 * divisor, 3 000 € por ano não dizem nada sobre um trabalho. Devolve null e
 * a conta cai na referência da CLYON.
 */
export function custosFixosPorTrabalho(custos: CustosDoProfissional | null | undefined): number | null {
  return custosFixosPorTrabalhoDe(
    totalDosCustosFixosAnuais(custos?.custosFixosAnuais),
    numero(custos?.trabalhosPorMes),
  );
}

/** O que do pedido entra na conta. Nada disto é morada nem contacto. */
export type PedidoParaSugestao = {
  serviceType?: string | null;
  entulhoEstado?: string | null;
  entulhoQuantidade?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  parkingDistance?: string | null;
  description?: string | null;
  /** Mudança: origem → destino, em km. */
  percursoKm?: number | string | null;
  andarDestino?: string | null;
  elevadorDestino?: string | null;
  estacionamentoDestino?: string | null;
  /** "total" ou "carga" — o que o valor mede. */
  baseDoPreco?: string | null;
};

export type SugestaoParaOProfissional = {
  horas: number;
  pessoas: number;
  custoHoraPessoa: number;
  custoKm: number;
  /** Km contados para o combustível (ida e volta, ou o percurso da mudança). */
  kmDeCarro: number | null;
  custoCombustivel: number;
  custoPessoal: number;
  custosFixos: number;
  /** A reserva de risco deste trabalho, em €, e a percentagem que a gerou. */
  seguroDeRisco: number;
  riscoPercent: number;
  /** Abaixo disto é prejuízo. */
  custoMinimo: number;
  margem: number;
  /** O que propor ao cliente, sem IVA. */
  precoSugerido: number;
  /** O que lhe fica desse preço, já com a taxa CLYON descontada. */
  recebeSePropuser: number;
  /** recebeSePropuser − custoMinimo. */
  lucroEstimado: number;
  /** O pedido é pago por carga: a conta é de UMA carga. */
  porCarga: boolean;
  /** Entraram os custos do perfil dele, e não os de referência. */
  comOsSeusCustos: boolean;
  /** Não havia distância: o combustível ficou a zero e a conta é por baixo. */
  semDistancia: boolean;
  /** As parcelas, por extenso, para o ecrã mostrar de onde vem o número. */
  pressupostos: string[];
};

function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Os campos da conta, lidos de uma linha de `simulatorOrders`.
 *
 * Os do serviço vivem em colunas; os que só alguns serviços têm — sacos de
 * entulho, percurso da mudança, acesso ao destino — vivem no JSON do
 * formulário, pelos MESMOS caminhos que a consulta do painel do
 * profissional usa. Uma linha sem JSON, ou com JSON estragado, dá os
 * campos do serviço e mais nada — a conta sai por baixo, não deixa de sair.
 */
export function pedidoParaSugestaoDaLinha(linha: Record<string, unknown>): PedidoParaSugestao {
  let raw: Record<string, unknown> = {};
  try {
    const j = typeof linha.rawOrderJson === "string" ? JSON.parse(linha.rawOrderJson) : null;
    if (j && typeof j === "object") raw = j as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : v == null ? null : String(v));
  const destinoAcesso = (raw.destinationAccess ?? {}) as Record<string, unknown>;
  const mudanca = (raw.movingDistance ?? {}) as Record<string, unknown>;
  return {
    serviceType: texto(linha.serviceType),
    entulhoEstado: texto(raw.entulhoState),
    entulhoQuantidade: texto(raw.entulhoQuantidade),
    floor: texto(linha.floor),
    hasElevator: texto(linha.hasElevator),
    parkingDistance: texto(linha.parkingDistance),
    description: texto(linha.description),
    percursoKm: numero(mudanca.distanceKm),
    andarDestino: texto(destinoAcesso.floor),
    elevadorDestino: texto(destinoAcesso.hasElevator),
    estacionamentoDestino: texto(destinoAcesso.parkingDistance),
    baseDoPreco: texto(linha.baseDoPreco),
  };
}

/** «1 h», «2,5 h» — vírgula decimal, sem zeros a mais. */
function horasPorExtenso(h: number): string {
  const arredondado = Math.round(h * 100) / 100;
  return `${String(arredondado).replace(".", ",")} h`;
}

function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
const km = (v: number) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")} km`;

/**
 * A conta, para este profissional e este pedido.
 *
 * `distanciaKm` é só ida, da base dele ao trabalho; para tudo o que não é
 * mudança conta-se ida e volta. Numa mudança conta-se o percurso entre as
 * duas moradas, como o simulador faz.
 */
export function sugerirParaOProfissional(
  pedido: PedidoParaSugestao,
  distanciaKm: number | null,
  parametros: ParametrosDeCusto,
  custos?: CustosDoProfissional | null,
): SugestaoParaOProfissional {
  const custoKm = numero(custos?.custoKm) ?? parametros.custoKm;
  const custoHoraPessoa = numero(custos?.custoHoraPessoa) ?? parametros.custoHoraPessoa;
  const pessoas = Math.max(1, Math.round(numero(custos?.pessoasNaEquipa) ?? parametros.numPessoas));
  const fixosDele = custosFixosPorTrabalho(custos);
  const margemDele = numero(custos?.margemPercent);
  const margem = margemDele != null && margemDele >= 0 ? margemDele / 100 : parametros.margem;
  const horasDele = numero(custos?.horasPorTrabalho);
  const comOsSeusCustos =
    numero(custos?.custoKm) != null ||
    numero(custos?.custoHoraPessoa) != null ||
    numero(custos?.pessoasNaEquipa) != null ||
    fixosDele != null ||
    margemDele != null ||
    (horasDele != null && horasDele > 0) ||
    (numero(custos?.riscoPercent) ?? 0) > 0;

  const mudanca = pedido.serviceType === "mudanca";
  const percurso = numero(pedido.percursoKm);

  const entrada: FastEstimateInput = {
    serviceType: pedido.serviceType ?? undefined,
    entulhoState: pedido.entulhoEstado ?? undefined,
    entulhoQuantidade: pedido.entulhoQuantidade ?? undefined,
    floor: pedido.floor ?? undefined,
    hasElevator: pedido.hasElevator ?? undefined,
    parkingDistance: pedido.parkingDistance ?? undefined,
    description: pedido.description ?? undefined,
    distanceFromBase: distanciaKm != null ? { distanceKm: distanciaKm } : undefined,
    movingDistance: percurso != null ? { distanceKm: percurso } : undefined,
    originAccess: {
      floor: pedido.floor ?? undefined,
      hasElevator: pedido.hasElevator ?? undefined,
      parkingDistance: pedido.parkingDistance ?? undefined,
    },
    destinationAccess: {
      floor: pedido.andarDestino ?? undefined,
      hasElevator: pedido.elevadorDestino ?? undefined,
      parkingDistance: pedido.estacionamentoDestino ?? undefined,
    },
  };

  // As horas são as DELE quando as definiu — o tempo médio de um trabalho,
  // deslocação e recolha incluídas. Só sem isso entra a regra do simulador:
  // itens, sacos, andares, elevador.
  const horas = horasDele != null && horasDele > 0 ? horasDele : estimateLaborHours(entrada);
  const horasSaoDele = horasDele != null && horasDele > 0;

  const kmDeCarro = mudanca ? percurso : distanciaKm != null ? distanciaKm * 2 : null;
  const semDistancia = kmDeCarro == null;
  const custoCombustivel = kmDeCarro != null ? aosCentimos(kmDeCarro * custoKm) : 0;
  const custoPessoal = aosCentimos(horas * pessoas * custoHoraPessoa);
  const custosFixos = aosCentimos(fixosDele ?? parametros.overhead);
  // O seguro de risco: uma percentagem do que este trabalho custa a fazer
  // (combustível e pessoal), posta de lado antes da margem.
  const riscoPercent = Math.max(0, numero(custos?.riscoPercent) ?? 0);
  const seguroDeRisco = aosCentimos((custoCombustivel + custoPessoal) * (riscoPercent / 100));
  const custoMinimo = aosCentimos(custoCombustivel + custoPessoal + custosFixos + seguroDeRisco);
  const precoSugerido = aosCentimos(custoMinimo * (1 + margem));
  const recebeSePropuser = quantoOProfissionalRecebe(precoSugerido);
  const lucroEstimado = aosCentimos(recebeSePropuser - custoMinimo);

  const anual = totalDosCustosFixosAnuais(custos?.custosFixosAnuais);
  const porMes = numero(custos?.trabalhosPorMes);
  const pressupostos = [
    kmDeCarro != null
      ? `Combustível: ${km(kmDeCarro)} ${mudanca ? "de percurso" : "ida e volta"} × ${euros(custoKm)}/km = ${euros(custoCombustivel)}`
      : "Combustível: sem distância conhecida — ficou a 0 €, por isso a conta é por baixo",
    `Pessoal: ${horasPorExtenso(horas)} × ${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} × ${euros(custoHoraPessoa)}/h = ${euros(custoPessoal)}${horasSaoDele ? " (o seu tempo médio, deslocação e recolha)" : " (tempo estimado pela CLYON)"}`,
    fixosDele != null && anual != null && porMes != null
      ? `Custos fixos: ${euros(anual)}/ano ÷ ${porMes * 12} trabalhos (${porMes} por mês) = ${euros(custosFixos)} por trabalho`
      : `Custos fixos por serviço: ${euros(custosFixos)} (referência CLYON)`,
    ...(riscoPercent > 0
      ? [`Seguro de risco: ${riscoPercent} % de ${euros(aosCentimos(custoCombustivel + custoPessoal))} = ${euros(seguroDeRisco)}`]
      : []),
    `Margem: ${Math.round(margem * 100)} % sobre o custo${margemDele != null ? " — a sua" : " — referência CLYON"}`,
    comOsSeusCustos
      ? "Com os custos que definiu no seu perfil."
      : "Com os custos de referência da CLYON — pode pôr os seus em Perfil › Serviços e raio.",
  ];

  return {
    horas,
    pessoas,
    custoHoraPessoa,
    custoKm,
    kmDeCarro: kmDeCarro != null ? Math.round(kmDeCarro * 10) / 10 : null,
    custoCombustivel,
    custoPessoal,
    custosFixos,
    seguroDeRisco,
    riscoPercent,
    custoMinimo,
    margem,
    precoSugerido,
    recebeSePropuser,
    lucroEstimado,
    porCarga: pedido.baseDoPreco === "carga",
    comOsSeusCustos,
    semDistancia,
    pressupostos,
  };
}
