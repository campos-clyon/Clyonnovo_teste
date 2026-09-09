import { estimateLaborHours, type FastEstimateInput } from "@/lib/pricing-helper";
import type { SimulatorSettingsMap } from "@/lib/simulator-settings";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";

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
 * perfil, o custo por km, o custo por hora e pessoa e o tamanho da equipa
 * são os dele. Sem isso, entram os valores de referência da CLYON.
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

/** O que o profissional definiu no perfil. `null` = usa a referência da CLYON. */
export type CustosDoProfissional = {
  custoKm?: number | null;
  custoHoraPessoa?: number | null;
  pessoasNaEquipa?: number | null;
};

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
  const comOsSeusCustos =
    numero(custos?.custoKm) != null ||
    numero(custos?.custoHoraPessoa) != null ||
    numero(custos?.pessoasNaEquipa) != null;

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

  // As horas vêm da mesma regra do simulador: itens, sacos, andares, elevador.
  const horas = estimateLaborHours(entrada);

  const kmDeCarro = mudanca ? percurso : distanciaKm != null ? distanciaKm * 2 : null;
  const semDistancia = kmDeCarro == null;
  const custoCombustivel = kmDeCarro != null ? aosCentimos(kmDeCarro * custoKm) : 0;
  const custoPessoal = aosCentimos(horas * pessoas * custoHoraPessoa);
  const custosFixos = aosCentimos(parametros.overhead);
  const custoMinimo = aosCentimos(custoCombustivel + custoPessoal + custosFixos);
  const precoSugerido = aosCentimos(custoMinimo * (1 + parametros.margem));
  const recebeSePropuser = quantoOProfissionalRecebe(precoSugerido);
  const lucroEstimado = aosCentimos(recebeSePropuser - custoMinimo);

  const pressupostos = [
    kmDeCarro != null
      ? `Combustível: ${km(kmDeCarro)} ${mudanca ? "de percurso" : "ida e volta"} × ${euros(custoKm)}/km = ${euros(custoCombustivel)}`
      : "Combustível: sem distância conhecida — ficou a 0 €, por isso a conta é por baixo",
    `Pessoal: ${horas} h × ${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"} × ${euros(custoHoraPessoa)}/h = ${euros(custoPessoal)}`,
    `Custos fixos por serviço: ${euros(custosFixos)}`,
    `Margem: ${Math.round(parametros.margem * 100)} % sobre o custo`,
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
    custoMinimo,
    margem: parametros.margem,
    precoSugerido,
    recebeSePropuser,
    lucroEstimado,
    porCarga: pedido.baseDoPreco === "carga",
    comOsSeusCustos,
    semDistancia,
    pressupostos,
  };
}
