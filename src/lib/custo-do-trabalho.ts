import type { SimulatorSettingsMap } from "./simulator-settings";
import { acordadoParaReceber, servicoMaisTaxa, TAXAS_DE_ORIGEM, type Taxas } from "./taxas-plataforma";
import { euros } from "./sugestao-ajustada";

/**
 * O CUSTO REAL DE UM TRABALHO, POR DENTRO — d61 fase (a), 16-11-2026.
 *
 * Uma só conta para o custo de ir buscar, carregar e levar ao destino certo:
 * os km de cada perna (base → cliente → deposição → base, e cada carga a mais),
 * o gasóleo e o desgaste, as portagens, as pessoas × as horas (peça a peça, com
 * as escadas e o elevador), a deposição por concelho e a saída. Daí sai o preço
 * do motor (custo × (1 + margem) ÷ (1 − taxa), aos 5 € para cima), que se
 * compara com a grelha publicada: o chão e o tecto.
 *
 * MODO SOMBRA: o resultado só se grava no pedido (`custoJson`) e aparece na
 * Mesa quando sai da grelha. O cliente continua a ver a grelha e a «Estimativa».
 *
 * É pura de propósito: recebe números, devolve números — testável sem base. A
 * rota vai buscar as distâncias, as bases e as Configs (ver
 * custo-do-trabalho-no-servidor.ts). Nenhum outro ficheiro calcula este custo
 * (o teste da orquestra guarda-o).
 */

/* ── Os tempos e as medidas (mudam só pela calibração, com o sim do dono) ── */

export type TamanhoDaPeca = "pequena" | "media" | "grande";
type ClasseDaPeca = TamanhoDaPeca | "pesada";

/** Os minutos do motor (2 pessoas, rés-do-chão). Não estão nas Configs: mudam pela calibração (fase d). */
export const TEMPOS_DO_MOTOR = Object.freeze({
  /** Por peça: levar à carrinha e arrumar. */
  porPeca: { pequena: 3, media: 6, grande: 11, pesada: 15 } as Readonly<Record<ClasseDaPeca, number>>,
  /** Por peça e por andar de escada (sem elevador, ou a peça não cabe nele). */
  escadasPorAndar: { pequena: 3, media: 5, grande: 8, pesada: 10 } as Readonly<Record<ClasseDaPeca, number>>,
  /** Elevador onde a peça cabe: por peça, e uma vez por trabalho (esperar o elevador). */
  elevadorPorPeca: 2,
  elevadorPorTrabalho: 5,
  /** Mais de 30 m entre a carrinha e a porta: por peça. */
  portaLongePorPeca: 2,
  /** Desmontar, pelo tipo de peça; sem tipo, o valor `semTipo`. Montar (só mudanças) = 1,3 × desmontar. */
  desmontar: {
    cama_casal: 15,
    roupeiro_2_portas: 25,
    roupeiro_3_portas: 35,
    beliche: 20,
    secretaria: 10,
    mesa_grande: 5,
    semTipo: 10,
  } as Readonly<Record<string, number>>,
  montarFator: 1.3,
  /** Sacos: por saco no rés-do-chão, e a mais por saco e por andar de escada. */
  porSaco: 1,
  porSacoPorAndar: 0.5,
  /** Recheio solto: por m³, e a mais por m³ e por andar de escada. */
  recheioPorM3: 12,
  recheioPorM3PorAndar: 4,
  /** O tempo do local multiplica-se por isto, pelo tamanho da equipa. */
  fatorDaEquipa: { 1: 1.6, 2: 1, 3: 0.75 } as Readonly<Record<1 | 2 | 3, number>>,
});

/** Peso por omissão (kg) e o que faz uma peça «pesada» para o tempo. */
export const PESOS_DO_MOTOR = Object.freeze({
  porTamanho: { pequena: 10, media: 25, grande: 60 } as Readonly<Record<TamanhoDaPeca, number>>,
  pesada: 90,
  /** A partir daqui a peça conta como pesada nos minutos. */
  classePesadaDesde: 70,
  /** A partir daqui conta como grande ou pesada para a regra das 2 pessoas. */
  duasPessoasDesde: 30,
  /** Com escadas de 2 andares ou mais, a partir daqui pede 3 pessoas. */
  tresPessoasDesde: 100,
  sacoDeRecheio: 8,
  sacoDeEntulho: 25,
  recheioPorM3: 120,
});

/** Volumes por omissão (m³) e a capacidade das carrinhas (etiquetas da candidatura). */
export const VOLUMES_DO_MOTOR = Object.freeze({
  porTamanho: { pequena: 0.15, media: 0.5, grande: 1.5 } as Readonly<Record<TamanhoDaPeca, number>>,
  saco: 0.08,
  capacidade: { pequena: 3, media: 7, grande: 12 } as Readonly<Record<"pequena" | "media" | "grande", number>>,
  /** A carrinha de referência (a grande): 1,5 cargas dela pedem 3 pessoas; 60 % dela é carga cheia na grelha. */
  referencia: 12,
  cargaCheiaFracao: 0.6,
  cargaCheiaGrandesEquivalentes: 8,
  grandesEquivalentes: { pequena: 0.15, media: 0.4, grande: 1 } as Readonly<Record<TamanhoDaPeca, number>>,
  /**
   * O recheio de um esvaziamento sem m³ dado, pela tipologia ou pelo volume
   * escolhido (garagem, sótão, cave). Estimativas de partida, para medir.
   */
  recheioPorTipologia: { "T0/T1": 12, T2: 20, T3: 30, T4: 40, moradia: 50 } as Readonly<Record<string, number>>,
  recheioPorVolume: { carrinha: 7, camiao_caixa: 15, camiao_lixo: 25 } as Readonly<Record<string, number>>,
});

/**
 * Os tipos de peça que o motor conhece: peso, volume (montada / desmontada),
 * REEE (vai ao ponto de retoma, não pesa na deposição) e a classe para o tempo.
 */
export type TipoConhecido = {
  tamanho: TamanhoDaPeca;
  pesoKg?: number;
  volume?: number;
  volumeDesmontada?: number;
  reee?: boolean;
  pesada?: boolean;
};

export const TIPOS_DE_PECA: Readonly<Record<string, TipoConhecido>> = Object.freeze({
  frigorifico: { tamanho: "grande", pesoKg: 80, volume: 0.8, reee: true },
  frigorifico_americano: { tamanho: "grande", pesoKg: 120, volume: 1.2, reee: true, pesada: true },
  arca: { tamanho: "grande", pesoKg: 50, volume: 0.6, reee: true },
  maquina: { tamanho: "grande", pesoKg: 70, volume: 0.4, reee: true },
  fogao: { tamanho: "media", pesoKg: 40, volume: 0.4, reee: true },
  forno: { tamanho: "media", pesoKg: 30, volume: 0.2, reee: true },
  micro_ondas: { tamanho: "pequena", pesoKg: 12, volume: 0.1, reee: true },
  esquentador: { tamanho: "pequena", pesoKg: 15, volume: 0.1, reee: true },
  tv: { tamanho: "media", pesoKg: 15, volume: 0.2, reee: true },
  ar_condicionado: { tamanho: "media", pesoKg: 30, volume: 0.3, reee: true },
  sofa_cama_ferro: { tamanho: "grande", pesoKg: 90, volume: 1.8, pesada: true },
  sofa: { tamanho: "grande", pesoKg: 50, volume: 1.8 },
  cama_casal: { tamanho: "grande", pesoKg: 50, volume: 1.8, volumeDesmontada: 0.8 },
  roupeiro_2_portas: { tamanho: "grande", pesoKg: 60, volume: 1.3, volumeDesmontada: 0.6 },
  roupeiro_3_portas: { tamanho: "grande", pesoKg: 80, volume: 1.8, volumeDesmontada: 0.8 },
  beliche: { tamanho: "grande", pesoKg: 60, volume: 1.5, volumeDesmontada: 0.6 },
  secretaria: { tamanho: "media", pesoKg: 25, volume: 0.5, volumeDesmontada: 0.3 },
  mesa_grande: { tamanho: "grande", pesoKg: 40, volume: 1, volumeDesmontada: 0.5 },
  colchao: { tamanho: "grande", pesoKg: 30, volume: 0.4 },
});

/* Do texto para o tipo — a ordem conta (o mais específico primeiro). */
const TIPOS_PELO_TEXTO: ReadonlyArray<[RegExp, string]> = [
  [/frigor\w*\s+americ|americano/i, "frigorifico_americano"],
  [/sof[aá][\s-]*cama/i, "sofa_cama_ferro"],
  [/frigor|congelador/i, "frigorifico"],
  [/\barca\b/i, "arca"],
  [/m[aá]quina|lava[\s-]*(lou[cç]a|roupa)|secador|secar/i, "maquina"],
  [/micro[\s-]*ondas/i, "micro_ondas"],
  [/fog[aã]o/i, "fogao"],
  [/\bforno\b/i, "forno"],
  [/esquentador|termoacumulador/i, "esquentador"],
  [/\btv\b|televis|televisor/i, "tv"],
  [/ar[\s-]*condicionado/i, "ar_condicionado"],
  [/beliche/i, "beliche"],
  [/roupeiro|guarda[\s-]*roupa|arm[aá]rio/i, "roupeiro_2_portas"],
  [/cama\s+de\s+casal|cama\s+casal/i, "cama_casal"],
  [/colch[aã]o/i, "colchao"],
  [/secret[aá]ria/i, "secretaria"],
  [/\bmesa\b/i, "mesa_grande"],
  [/sof[aá]/i, "sofa"],
];

/** O tipo de uma peça escrita à mão («Frigorífico», «sofá-cama de ferro»), ou null. */
export function tipoDaPeca(texto: unknown): string | null {
  if (typeof texto !== "string" || !texto.trim()) return null;
  for (const [re, tipo] of TIPOS_PELO_TEXTO) if (re.test(texto)) return tipo;
  return null;
}

/* ── A deposição e as portagens ─────────────────────────────────────────── */

/** Onde o motor leva o que se recolhe, pelo concelho do cliente (coordenadas aproximadas). */
export type DestinoDaDeposicao = {
  nome: string;
  chave: "valorsul" | "amarsul" | "provisoria";
  concelho: string;
  ponto: { lat: number; lng: number };
  aConfirmar: boolean;
};

const VALORSUL: DestinoDaDeposicao = { nome: "Valorsul", chave: "valorsul", concelho: "loures", ponto: { lat: 38.8297, lng: -9.0928 }, aConfirmar: false };
const AMARSUL_SEIXAL: DestinoDaDeposicao = { nome: "Amarsul (Seixal)", chave: "amarsul", concelho: "seixal", ponto: { lat: 38.6185, lng: -9.082 }, aConfirmar: false };
const AMARSUL_PALMELA: DestinoDaDeposicao = { nome: "Amarsul (Palmela)", chave: "amarsul", concelho: "palmela", ponto: { lat: 38.587, lng: -8.85 }, aConfirmar: false };
const OESTE_PROVISORIO: DestinoDaDeposicao = { nome: "Trajouce (a confirmar)", chave: "provisoria", concelho: "cascais", ponto: { lat: 38.733, lng: -9.322 }, aConfirmar: true };

/** Concelho → destino. Os de Cascais, Oeiras, Sintra e Mafra estão marcados «a confirmar». */
export const DEPOSICAO_POR_CONCELHO: Readonly<Record<string, DestinoDaDeposicao>> = Object.freeze({
  lisboa: VALORSUL,
  amadora: VALORSUL,
  loures: VALORSUL,
  odivelas: VALORSUL,
  "vila-franca-de-xira": VALORSUL,
  almada: AMARSUL_SEIXAL,
  seixal: AMARSUL_SEIXAL,
  sesimbra: AMARSUL_SEIXAL,
  barreiro: AMARSUL_SEIXAL,
  moita: AMARSUL_SEIXAL,
  montijo: AMARSUL_PALMELA,
  alcochete: AMARSUL_PALMELA,
  palmela: AMARSUL_PALMELA,
  setubal: AMARSUL_PALMELA,
  cascais: OESTE_PROVISORIO,
  oeiras: OESTE_PROVISORIO,
  sintra: OESTE_PROVISORIO,
  mafra: OESTE_PROVISORIO,
});

/** O destino do concelho; sem concelho conhecido, a Valorsul (e diz-se na explicação). */
export function destinoDaDeposicao(concelho: string | null | undefined): DestinoDaDeposicao {
  return (concelho && DEPOSICAO_POR_CONCELHO[concelho]) || VALORSUL;
}

/** Os concelhos da margem sul, e por que ponte se vai para norte. */
const PELA_25_DE_ABRIL = new Set(["almada", "seixal", "sesimbra", "setubal"]);
const PELA_VASCO_DA_GAMA = new Set(["barreiro", "moita", "montijo", "alcochete", "palmela"]);
export const MARGEM_SUL: ReadonlySet<string> = new Set([...PELA_25_DE_ABRIL, ...PELA_VASCO_DA_GAMA]);

export type Portagem = { nome: string; valor: number; perna: string };

/**
 * A portagem de uma perna, pela regra por margem (sem traçado do Routes): de
 * sul para norte paga-se a ponte do concelho de partida; de norte para sul, 0.
 * Concelho desconhecido numa das pontas: sem portagem (fica na explicação).
 */
export function portagemDaPerna(
  de: string | null | undefined,
  para: string | null | undefined,
  p: Pick<ParametrosDoMotor, "portagens">,
  perna: string,
): Portagem | null {
  if (!de || !para) return null;
  if (!MARGEM_SUL.has(de) || MARGEM_SUL.has(para)) return null;
  if (PELA_25_DE_ABRIL.has(de)) return { nome: "Ponte 25 de Abril", valor: p.portagens.ponte25Abril, perna };
  return { nome: "Ponte Vasco da Gama", valor: p.portagens.vascoDaGama, perna };
}

/* ── Os parâmetros (Configs, categoria «motor») ─────────────────────────── */

export type ParametrosDoMotor = {
  dieselPreco: number;
  consumoL100km: number;
  desgastePorKm: number;
  custoHoraEquipa: Readonly<Record<1 | 2 | 3, number>>;
  custoPorSaida: number;
  margemParceiro: number;
  velocidadeSemMedida: number;
  minutosFixosNoLocal: number;
  minutosNaDeposicao: number;
  minutosPorPecaNaDeposicao: number;
  enchimentoUtil: number;
  tectoFator: number;
  chaoFator: number;
  cargaAdicionalFator: number;
  /** O preço de uma carga cheia na grelha (0 = ainda sem valor: a carga cheia não limita). */
  precoDeUmaCarga: number;
  deposicao: { valorsul: number; amarsul: number; provisoria: number; minimoPorEntrega: number };
  portagens: { ponte25Abril: number; vascoDaGama: number };
  taxas: Taxas;
};

/** Os parâmetros lidos do mesmo mapa das Configs; cada chave em falta cai no valor inicial do código. */
export function parametrosDoMotor(mapa: Partial<SimulatorSettingsMap>, taxas: Taxas = TAXAS_DE_ORIGEM): ParametrosDoMotor {
  const n = (v: unknown, omissao: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : omissao);
  return {
    dieselPreco: n(mapa.diesel_preco, 2.135),
    consumoL100km: n(mapa.consumo_l_100km, 10),
    desgastePorKm: n(mapa.desgaste_por_km, 0.29),
    custoHoraEquipa: { 1: n(mapa.custo_hora_equipa_1, 15), 2: n(mapa.custo_hora_equipa_2, 27), 3: n(mapa.custo_hora_equipa_3, 39) },
    custoPorSaida: n(mapa.motor_custo_por_saida, 15),
    margemParceiro: n(mapa.motor_margem_parceiro, 0.25),
    velocidadeSemMedida: Math.max(5, n(mapa.motor_velocidade_sem_medida, 35)),
    minutosFixosNoLocal: n(mapa.motor_minutos_fixos_no_local, 10),
    minutosNaDeposicao: n(mapa.motor_minutos_na_deposicao, 15),
    minutosPorPecaNaDeposicao: n(mapa.motor_minutos_por_peca_na_deposicao, 1),
    enchimentoUtil: Math.min(1, Math.max(0.1, n(mapa.motor_enchimento_util, 0.85))),
    tectoFator: n(mapa.motor_tecto_fator, 1.3),
    chaoFator: n(mapa.motor_chao_fator, 0.9),
    cargaAdicionalFator: n(mapa.moveis_carga_adicional_fator, 0.7),
    precoDeUmaCarga: n(mapa.motor_preco_de_uma_carga, 0),
    deposicao: {
      valorsul: n(mapa.deposicao_valorsul_eur_t, 85.64),
      amarsul: n(mapa.deposicao_amarsul_eur_t, 85),
      provisoria: n(mapa.deposicao_provisoria_eur_t, 85),
      minimoPorEntrega: n(mapa.deposicao_minimo_por_entrega, 0),
    },
    portagens: {
      ponte25Abril: n(mapa.portagem_ponte_25_abril, 4.85),
      vascoDaGama: n(mapa.portagem_ponte_vasco_da_gama, 7.55),
    },
    taxas,
  };
}

/* ── A entrada ──────────────────────────────────────────────────────────── */

export type PecaDoPedido = {
  /** Um id de `TIPOS_DE_PECA`, ou null. */
  tipo?: string | null;
  tamanho: TamanhoDaPeca;
  pesada?: boolean;
  pesoKg?: number | null;
  quantidade: number;
  desmontar?: boolean;
  cabeNoElevador?: "sim" | "nao" | "nao_sei";
};

export type Perna = { km: number; minutos: number | null; origem: "estrada" | "estimativa" };

/** O que o parceiro pôs no perfil (os mesmos campos da sugestão de hoje). */
export type CustosDoParceiroNoMotor = {
  custoKm?: number | null;
  custoHoraPessoa?: number | null;
  margemPercent?: number | null;
  custosFixosPorTrabalho?: number | null;
  riscoPercent?: number | null;
};

export type BaseDoCalculo = {
  /** O id do profissional; null na base CLYON. */
  id: number | null;
  /** O concelho da base, para as portagens. */
  concelho: string | null;
  tamanhoDaCarrinha: "pequena" | "media" | "grande" | null;
  pessoasNaEquipa?: number | null;
  /** base → cliente, cliente → deposição, deposição → base. */
  pernas: { ida: Perna | null; aDeposicao: Perna | null; volta: Perna | null };
  /** Só com o parceiro escolhido: os custos dele substituem os da CLYON. */
  custos?: CustosDoParceiroNoMotor | null;
};

export type GrelhaDoPedido =
  | { tipo: "valor"; valor: number }
  | { tipo: "faixa"; de: number; ate: number }
  | { tipo: "desde"; de: number };

export type EntradaDoCusto = {
  servico: string;
  pecas?: PecaDoPedido[];
  sacos?: Array<{ quantidade: number; tipo: "recheio" | "entulho" }>;
  recheio?: { m3De: number; m3Ate: number } | null;
  /** Esvaziamento: «T0/T1», «T2», «T3», «T4», «moradia»; garagem, sótão, cave: o serviço basta. */
  tipologia?: string | null;
  /** O recheio pela tipologia × isto (pouco 0,7, muito 1,3). */
  fatorDoRecheio?: number;
  acesso: { andar: number; elevador: "sim" | "nao"; distanciaAPorta: "normal" | "longe" };
  /** O concelho do cliente (id de concelhos-da-cobertura). */
  concelho: string | null;
  /** «parceiro» (o escolhido), «candidatos» (os 3 mais perto: a mediana), «clyon» (ninguém cobre). */
  tipoDaBase: "parceiro" | "candidatos" | "clyon";
  bases: BaseDoCalculo[];
  /** A conta pública da d60 para este pedido (`estimativaDaGrelha`), ou null. */
  grelha: GrelhaDoPedido | null;
};

/* ── A saída ────────────────────────────────────────────────────────────── */

export type CustoDoTrabalho = {
  versao: "motor-a1";
  custo: {
    km: number;
    combustivel: number;
    desgaste: number;
    portagens: number;
    maoDeObra: number;
    deposicao: number;
    saida: number;
    fixos: number;
    total: number;
  };
  pessoas: 1 | 2 | 3;
  horas: { local: number; conducao: number; total: number };
  km: { ida: number; deposicao: number; volta: number; total: number; origem: "google" | "estimativa" };
  portagens: Portagem[];
  cargas: number;
  volumeM3: number;
  pesoKg: number;
  base: { tipo: "parceiro" | "mediana3" | "clyon"; ids: number[]; custos: Array<{ id: number | null; total: number }> };
  deposicaoEm: { nome: string; aConfirmar: boolean };
  precoMotor: number;
  grelha: { chao: number | null; tecto: number | null; valorGrelha: number | null };
  precoAoCliente: number;
  foraDaFaixa: null | "acima_do_tecto" | "abaixo_do_chao";
  explicacao: string[];
};

/* ── A conta ────────────────────────────────────────────────────────────── */

const cent = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const aos5ParaCima = (n: number) => Math.ceil(cent(n) / 5) * 5;
const aoQuartoParaCima = (h: number) => Math.ceil(h * 4 - 1e-9) / 4;
const inteiro = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

type PecaResolvida = {
  classe: ClasseDaPeca;
  tamanho: TamanhoDaPeca;
  pesoKg: number;
  volume: number;
  reee: boolean;
  tipo: string | null;
  quantidade: number;
  desmontar: boolean;
  andaresDeEscada: number;
  usaElevador: boolean;
};

function resolverPeca(p: PecaDoPedido, acesso: EntradaDoCusto["acesso"]): PecaResolvida {
  const conhecido = p.tipo ? TIPOS_DE_PECA[p.tipo] : undefined;
  const tamanho = p.tamanho ?? conhecido?.tamanho ?? "media";
  const pesada = p.pesada === true || conhecido?.pesada === true;
  const pesoKg =
    typeof p.pesoKg === "number" && p.pesoKg > 0
      ? p.pesoKg
      : conhecido?.pesoKg ?? (pesada ? PESOS_DO_MOTOR.pesada : PESOS_DO_MOTOR.porTamanho[tamanho]);
  const desmontar = p.desmontar === true;
  const volume =
    (desmontar ? conhecido?.volumeDesmontada : undefined) ?? conhecido?.volume ?? VOLUMES_DO_MOTOR.porTamanho[tamanho];
  const classe: ClasseDaPeca = pesada || pesoKg >= PESOS_DO_MOTOR.classePesadaDesde ? "pesada" : tamanho;
  const naoCabe = p.cabeNoElevador === "nao";
  const andar = Math.max(0, Math.floor(acesso.andar || 0));
  const andaresDeEscada = andar > 0 && (acesso.elevador === "nao" || naoCabe) ? andar : 0;
  const usaElevador = andar > 0 && acesso.elevador === "sim" && !naoCabe;
  return {
    classe,
    tamanho,
    pesoKg,
    volume,
    reee: conhecido?.reee === true,
    tipo: p.tipo ?? null,
    quantidade: Math.max(0, Math.floor(p.quantidade || 0)),
    desmontar,
    andaresDeEscada,
    usaElevador,
  };
}

/** O recheio solto em m³ (o meio do intervalo dado; sem ele, pela tipologia ou pelo volume escolhido). */
function recheioEmM3(e: EntradaDoCusto): number {
  if (e.recheio && Number.isFinite(e.recheio.m3De) && Number.isFinite(e.recheio.m3Ate)) {
    return Math.max(0, (e.recheio.m3De + e.recheio.m3Ate) / 2);
  }
  const t = e.tipologia ?? "";
  const fator = typeof e.fatorDoRecheio === "number" && e.fatorDoRecheio > 0 ? e.fatorDoRecheio : 1;
  return (VOLUMES_DO_MOTOR.recheioPorTipologia[t] ?? VOLUMES_DO_MOTOR.recheioPorVolume[t] ?? 0) * fator;
}

/**
 * A REGRA DAS PESSOAS (a.4) — a primeira que se aplicar, de cima para baixo.
 * Exportada para o teste da regra e para a Pro mostrar «Este trabalho pede N pessoas».
 */
export function pessoasDoTrabalho(
  e: Pick<EntradaDoCusto, "servico" | "tipologia" | "acesso">,
  pecas: ReadonlyArray<Pick<PecaResolvida, "pesoKg" | "tamanho" | "classe" | "andaresDeEscada" | "quantidade" | "usaElevador">>,
  volumeM3: number,
  enchimentoUtil: number,
  sacos = 0,
  recheioM3 = 0,
): { pessoas: 1 | 2 | 3; porque: string } {
  const tip = e.tipologia ?? "";
  const esvaziamentoDeCasa = e.servico === "esvaziamento_casa" || e.servico === "esvaziamento_apartamento";
  const umaCargaDeReferencia = VOLUMES_DO_MOTOR.referencia * enchimentoUtil;
  if (pecas.some((p) => p.quantidade > 0 && p.pesoKg >= PESOS_DO_MOTOR.tresPessoasDesde && p.andaresDeEscada >= 2)) {
    return { pessoas: 3, porque: "peça de 100 kg ou mais com 2 ou mais andares de escada" };
  }
  if (volumeM3 >= 1.5 * umaCargaDeReferencia) return { pessoas: 3, porque: "volume de 1,5 cargas ou mais" };
  if (esvaziamentoDeCasa && ["T3", "T4", "moradia"].includes(tip)) return { pessoas: 3, porque: `esvaziamento ${tip}` };

  if (pecas.some((p) => p.quantidade > 0 && (p.tamanho === "grande" || p.classe === "pesada" || p.pesoKg >= PESOS_DO_MOTOR.duasPessoasDesde))) {
    return { pessoas: 2, porque: "peça grande ou pesada" };
  }
  const mediasNasEscadas = pecas.filter((p) => p.tamanho === "media" && p.andaresDeEscada > 0).reduce((s, p) => s + p.quantidade, 0);
  if (mediasNasEscadas > 10) return { pessoas: 2, porque: "mais de 10 peças médias pelas escadas" };
  if (esvaziamentoDeCasa || ["esvaziamento_garagem", "esvaziamento_sotao", "esvaziamento_cave"].includes(e.servico)) {
    return { pessoas: 2, porque: "esvaziamento" };
  }
  const quantas = pecas.reduce((s, p) => s + p.quantidade, 0) + sacos;
  const semEscadas = pecas.every((p) => p.andaresDeEscada === 0);
  if (quantas <= 8 && semEscadas && recheioM3 === 0) return { pessoas: 1, porque: "só peças pequenas e médias, até 8, sem escadas" };
  return { pessoas: 2, porque: "mais de 8 volumes, escadas ou recheio" };
}

/** Os minutos no local de uma peça (já × quantidade), sem os fixos. */
export function minutosDaPeca(p: PecaResolvida, servico: string, portaLonge: boolean): number {
  let m = TEMPOS_DO_MOTOR.porPeca[p.classe];
  if (p.desmontar) {
    const d = TEMPOS_DO_MOTOR.desmontar[p.tipo ?? ""] ?? TEMPOS_DO_MOTOR.desmontar.semTipo;
    m += servico === "mudanca" ? d * (1 + TEMPOS_DO_MOTOR.montarFator) : d;
  }
  m += p.andaresDeEscada * TEMPOS_DO_MOTOR.escadasPorAndar[p.classe];
  if (p.usaElevador) m += TEMPOS_DO_MOTOR.elevadorPorPeca;
  if (portaLonge) m += TEMPOS_DO_MOTOR.portaLongePorPeca;
  return m * p.quantidade;
}

type ContaDeUmaBase = Omit<CustoDoTrabalho, "base" | "grelha" | "precoAoCliente" | "foraDaFaixa" | "versao" | "deposicaoEm">;

function minutosDaPerna(perna: Perna | null, p: ParametrosDoMotor): number {
  if (!perna) return 0;
  return perna.minutos != null && perna.minutos >= 0 ? perna.minutos : (perna.km / p.velocidadeSemMedida) * 60;
}

function contaParaUmaBase(e: EntradaDoCusto, base: BaseDoCalculo, p: ParametrosDoMotor): ContaDeUmaBase {
  const explicacao: string[] = [];
  const pecas = (e.pecas ?? []).map((x) => resolverPeca(x, e.acesso)).filter((x) => x.quantidade > 0);
  const sacos = (e.sacos ?? []).filter((s) => inteiro(s.quantidade) > 0);
  const nSacos = sacos.reduce((s, x) => s + inteiro(x.quantidade), 0);
  const recheioM3 = recheioEmM3(e);
  const andar = Math.max(0, Math.floor(e.acesso.andar || 0));
  const escadasParaSoltos = andar > 0 && e.acesso.elevador === "nao" ? andar : 0;
  const portaLonge = e.acesso.distanciaAPorta === "longe";

  // Volume e peso.
  const volumeM3 = cent(pecas.reduce((s, x) => s + x.volume * x.quantidade, 0) + nSacos * VOLUMES_DO_MOTOR.saco + recheioM3);
  const pesoPecas = pecas.reduce((s, x) => s + x.pesoKg * x.quantidade, 0);
  const pesoSacos = sacos.reduce((s, x) => s + inteiro(x.quantidade) * (x.tipo === "entulho" ? PESOS_DO_MOTOR.sacoDeEntulho : PESOS_DO_MOTOR.sacoDeRecheio), 0);
  const pesoKg = Math.round(pesoPecas + pesoSacos + recheioM3 * PESOS_DO_MOTOR.recheioPorM3);

  // Cargas, pela carrinha da base (sem carrinha conhecida, a de referência).
  const capacidade = VOLUMES_DO_MOTOR.capacidade[base.tamanhoDaCarrinha ?? "grande"] * p.enchimentoUtil;
  const cargas = Math.max(1, Math.ceil(volumeM3 / capacidade - 1e-9));

  // Pessoas.
  const regra = pessoasDoTrabalho(e, pecas, volumeM3, p.enchimentoUtil, nSacos, recheioM3);
  const pessoas = regra.pessoas;
  explicacao.push(`${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"}: ${regra.porque}.`);
  if (base.pessoasNaEquipa != null && base.pessoasNaEquipa > 0 && base.pessoasNaEquipa < pessoas) {
    explicacao.push(`Este trabalho pede ${pessoas} pessoas; a equipa da base tem ${base.pessoasNaEquipa}. O preço não desce por isso.`);
  }

  // Minutos no local.
  const nPecas = pecas.reduce((s, x) => s + x.quantidade, 0);
  let local = pecas.reduce((s, x) => s + minutosDaPeca(x, e.servico, portaLonge), 0);
  if (pecas.some((x) => x.usaElevador)) local += TEMPOS_DO_MOTOR.elevadorPorTrabalho;
  local += nSacos * (TEMPOS_DO_MOTOR.porSaco + TEMPOS_DO_MOTOR.porSacoPorAndar * escadasParaSoltos);
  local += recheioM3 * (TEMPOS_DO_MOTOR.recheioPorM3 + TEMPOS_DO_MOTOR.recheioPorM3PorAndar * escadasParaSoltos);
  local += p.minutosFixosNoLocal + p.minutosNaDeposicao * cargas + p.minutosPorPecaNaDeposicao * nPecas;
  const localComEquipa = local * TEMPOS_DO_MOTOR.fatorDaEquipa[pessoas];

  // Km e condução. Cada carga a mais: a perna cliente ⇄ deposição, ida e volta.
  const { ida, aDeposicao, volta } = base.pernas;
  const mais = cargas - 1;
  const kmIda = ida?.km ?? 0;
  const kmDep = (aDeposicao?.km ?? 0) * (1 + 2 * mais);
  const kmVolta = volta?.km ?? 0;
  const kmTotal = cent(kmIda + kmDep + kmVolta);
  const conducao = minutosDaPerna(ida, p) + minutosDaPerna(aDeposicao, p) * (1 + 2 * mais) + minutosDaPerna(volta, p);
  const todasMedidas = [ida, aDeposicao, volta].every((x) => x && x.origem === "estrada");
  if (!ida) explicacao.push("Sem distância da base ao cliente: os km dessa perna ficaram a 0.");
  if (!todasMedidas) explicacao.push("Km estimados em parte (linha recta com folga ou velocidade média), sem consulta nova ao Google.");

  const horasTotal = Math.max(1, aoQuartoParaCima((localComEquipa + conducao) / 60));

  // Os custos. O custo por km do parceiro, se o tiver, substitui gasóleo + desgaste.
  const c = base.custos ?? null;
  const custoKmDele = c?.custoKm != null && c.custoKm > 0 ? c.custoKm : null;
  const combustivel = cent(custoKmDele != null ? kmTotal * custoKmDele : kmTotal * p.dieselPreco * (p.consumoL100km / 100));
  const desgaste = cent(custoKmDele != null ? 0 : kmTotal * p.desgastePorKm);
  const custoHora = c?.custoHoraPessoa != null && c.custoHoraPessoa > 0 ? c.custoHoraPessoa * pessoas : p.custoHoraEquipa[pessoas];
  const maoDeObra = cent(horasTotal * custoHora);

  // Portagens, pela margem (de sul para norte). Cada carga a mais repete a da perna cliente ⇄ deposição.
  const destino = destinoDaDeposicao(e.concelho);
  const portagens: Portagem[] = [];
  const somar = (x: Portagem | null) => {
    if (x) portagens.push(x);
  };
  somar(portagemDaPerna(base.concelho, e.concelho, p, "base → cliente"));
  for (let i = 0; i <= mais; i++) {
    somar(portagemDaPerna(e.concelho, destino.concelho, p, i === 0 ? "cliente → deposição" : `carga ${i + 1}: cliente → deposição`));
    if (i > 0) somar(portagemDaPerna(destino.concelho, e.concelho, p, `carga ${i + 1}: deposição → cliente`));
  }
  somar(portagemDaPerna(destino.concelho, base.concelho, p, "deposição → base"));
  if (!base.concelho || !e.concelho) explicacao.push("Concelho por saber numa das pontas: portagens não contadas nessa perna.");
  const totalPortagens = cent(portagens.reduce((s, x) => s + x.valor, 0));

  // Deposição: o peso que paga (sem REEE, sem entulho), por carga, nunca abaixo do mínimo por entrega.
  const kgQuePaga =
    pecas.filter((x) => !x.reee).reduce((s, x) => s + x.pesoKg * x.quantidade, 0) +
    sacos.filter((x) => x.tipo === "recheio").reduce((s, x) => s + inteiro(x.quantidade) * PESOS_DO_MOTOR.sacoDeRecheio, 0) +
    recheioM3 * PESOS_DO_MOTOR.recheioPorM3;
  const eurPorT = p.deposicao[destino.chave];
  const deposicao = kgQuePaga > 0 ? cent(cargas * Math.max(p.deposicao.minimoPorEntrega, (kgQuePaga / cargas / 1000) * eurPorT)) : 0;
  if (pecas.some((x) => x.reee)) explicacao.push("Eletrodomésticos (REEE) ao ponto de retoma: 0 € na deposição.");
  if (sacos.some((x) => x.tipo === "entulho")) explicacao.push("Entulho: 0 € de deposição no motor até haver o preço por tonelada.");
  if (destino.aConfirmar) explicacao.push(`Deposição em ${destino.nome}: tarifa provisória.`);

  // Saída e fixos.
  const saida = cent(p.custoPorSaida + (c?.custosFixosPorTrabalho != null && c.custosFixosPorTrabalho > 0 ? c.custosFixosPorTrabalho : 0));
  const risco = c?.riscoPercent != null && c.riscoPercent > 0 ? c.riscoPercent / 100 : 0;
  const fixos = cent((combustivel + desgaste + maoDeObra) * risco);

  const km = cent(combustivel + desgaste);
  const total = cent(km + totalPortagens + maoDeObra + deposicao + saida + fixos);
  const margem = c?.margemPercent != null && c.margemPercent >= 0 ? c.margemPercent / 100 : p.margemParceiro;
  const precoMotor = aos5ParaCima(servicoMaisTaxa(acordadoParaReceber(total * (1 + margem), p.taxas), p.taxas));

  return {
    custo: { km, combustivel, desgaste, portagens: totalPortagens, maoDeObra, deposicao, saida, fixos, total },
    pessoas,
    horas: { local: cent(localComEquipa / 60), conducao: cent(conducao / 60), total: horasTotal },
    km: { ida: cent(kmIda), deposicao: cent(kmDep), volta: cent(kmVolta), total: kmTotal, origem: todasMedidas ? "google" : "estimativa" },
    portagens,
    cargas,
    volumeM3,
    pesoKg,
    precoMotor,
    explicacao,
  };
}

/** A média de duas contas, campo a campo (os degraus continuam a somar o total). */
function mediaDeDuas(a: ContaDeUmaBase, b: ContaDeUmaBase): ContaDeUmaBase {
  const m = (x: number, y: number) => cent((x + y) / 2);
  const custo = Object.fromEntries(Object.keys(a.custo).map((k) => [k, m(a.custo[k as keyof typeof a.custo], b.custo[k as keyof typeof b.custo])])) as ContaDeUmaBase["custo"];
  return {
    ...a,
    custo,
    horas: { local: m(a.horas.local, b.horas.local), conducao: m(a.horas.conducao, b.horas.conducao), total: m(a.horas.total, b.horas.total) },
    km: { ...a.km, ida: m(a.km.ida, b.km.ida), deposicao: m(a.km.deposicao, b.km.deposicao), volta: m(a.km.volta, b.km.volta), total: m(a.km.total, b.km.total) },
    precoMotor: aos5ParaCima((a.precoMotor + b.precoMotor) / 2),
    explicacao: [...a.explicacao, "Média das duas bases mais perto."],
  };
}

/** O chão e o tecto da grelha (a.8), já com a carga cheia (a.7) quando há preço de uma carga. */
export function chaoETecto(
  grelha: GrelhaDoPedido | null,
  p: Pick<ParametrosDoMotor, "chaoFator" | "tectoFator">,
): { chao: number | null; tecto: number | null; valorGrelha: number | null } {
  if (!grelha) return { chao: null, tecto: null, valorGrelha: null };
  if (grelha.tipo === "valor") return { chao: cent(grelha.valor * p.chaoFator), tecto: cent(grelha.valor * p.tectoFator), valorGrelha: grelha.valor };
  if (grelha.tipo === "faixa") return { chao: grelha.de, tecto: grelha.ate, valorGrelha: grelha.de };
  return { chao: grelha.de, tecto: null, valorGrelha: grelha.de };
}

/**
 * A DILUIÇÃO NA GRELHA (a.7): a partir de uma carga cheia (8 grandes-equivalentes
 * ou 60 % da carrinha de referência), a soma por peça fica limitada ao preço de
 * uma carga, e cada carga a mais a `cargaAdicionalFator` dela. Sem preço de uma
 * carga nas Configs (0), não limita.
 */
export function grelhaComACargaCheia(
  grelha: GrelhaDoPedido | null,
  pecas: ReadonlyArray<PecaDoPedido>,
  volumeM3: number,
  cargas: number,
  p: Pick<ParametrosDoMotor, "precoDeUmaCarga" | "cargaAdicionalFator">,
): { grelha: GrelhaDoPedido | null; cargaCheia: boolean } {
  const equivalentes = pecas.reduce((s, x) => s + VOLUMES_DO_MOTOR.grandesEquivalentes[x.tamanho] * Math.max(0, x.quantidade || 0), 0);
  const cargaCheia =
    equivalentes >= VOLUMES_DO_MOTOR.cargaCheiaGrandesEquivalentes ||
    volumeM3 >= VOLUMES_DO_MOTOR.cargaCheiaFracao * VOLUMES_DO_MOTOR.referencia;
  if (!cargaCheia || !grelha || grelha.tipo !== "valor" || p.precoDeUmaCarga <= 0) return { grelha, cargaCheia };
  const limite = p.precoDeUmaCarga * (1 + Math.max(0, cargas - 1) * p.cargaAdicionalFator);
  return { grelha: { tipo: "valor", valor: cent(Math.min(grelha.valor, limite)) }, cargaCheia };
}

/**
 * A CONTA DO MOTOR. Com o parceiro escolhido, a base dele e os custos dele; com
 * candidatos, a mediana dos custos dos 3 mais perto (com 2, a média; com 1, esse);
 * sem ninguém, a base CLYON.
 */
export function custoDoTrabalho(e: EntradaDoCusto, p: ParametrosDoMotor): CustoDoTrabalho {
  const bases = e.bases.length > 0 ? e.bases : [{ id: null, concelho: null, tamanhoDaCarrinha: null, pernas: { ida: null, aDeposicao: null, volta: null } } as BaseDoCalculo];
  const contas = bases.map((b) => ({ b, c: contaParaUmaBase(e, b, p) }));
  let escolhida: ContaDeUmaBase;
  let tipo: CustoDoTrabalho["base"]["tipo"];
  const explicacaoDaBase: string[] = [];
  if (e.tipoDaBase === "parceiro") {
    escolhida = contas[0].c;
    tipo = "parceiro";
    explicacaoDaBase.push("Base: o parceiro escolhido, com os custos do perfil dele.");
  } else if (e.tipoDaBase === "candidatos" && contas.length >= 3) {
    const ordenadas = [...contas].sort((a, b) => a.c.custo.total - b.c.custo.total);
    escolhida = ordenadas[Math.floor(ordenadas.length / 2)].c;
    tipo = "mediana3";
    explicacaoDaBase.push(`Base: a mediana dos ${contas.length} parceiros mais perto.`);
  } else if (e.tipoDaBase === "candidatos" && contas.length === 2) {
    escolhida = mediaDeDuas(contas[0].c, contas[1].c);
    tipo = "mediana3";
    explicacaoDaBase.push("Base: a média dos 2 parceiros mais perto.");
  } else if (e.tipoDaBase === "candidatos") {
    escolhida = contas[0].c;
    tipo = "mediana3";
    explicacaoDaBase.push("Base: o único parceiro que cobre o pedido.");
  } else {
    escolhida = contas[0].c;
    tipo = "clyon";
    explicacaoDaBase.push("Base: a da CLYON — sem parceiro na zona.");
  }

  const pecas = e.pecas ?? [];
  const diluida = grelhaComACargaCheia(e.grelha, pecas, escolhida.volumeM3, escolhida.cargas, p);
  const grelha = chaoETecto(diluida.grelha, p);
  if (diluida.cargaCheia) {
    explicacaoDaBase.push(p.precoDeUmaCarga > 0 ? "Carga cheia: a grelha fica limitada ao preço de uma carga." : "Carga cheia: sem preço de uma carga nas Configs, a grelha não foi limitada.");
  }
  let precoAoCliente = escolhida.precoMotor;
  if (grelha.chao != null) precoAoCliente = Math.max(precoAoCliente, grelha.chao);
  if (grelha.tecto != null) precoAoCliente = Math.min(precoAoCliente, grelha.tecto);
  const foraDaFaixa =
    grelha.tecto != null && escolhida.precoMotor > grelha.tecto
      ? "acima_do_tecto"
      : grelha.chao != null && escolhida.precoMotor < grelha.chao
        ? "abaixo_do_chao"
        : null;
  if (!e.grelha) explicacaoDaBase.push("Sem grelha para este pedido: sem chão nem tecto.");
  const destino = destinoDaDeposicao(e.concelho);

  return {
    versao: "motor-a1",
    ...escolhida,
    base: {
      tipo,
      ids: bases.map((b) => b.id).filter((x): x is number => x != null),
      custos: contas.map((x) => ({ id: x.b.id, total: x.c.custo.total })),
    },
    deposicaoEm: { nome: destino.nome, aConfirmar: destino.aConfirmar },
    grelha,
    precoAoCliente: cent(precoAoCliente),
    foraDaFaixa,
    explicacao: [...explicacaoDaBase, ...escolhida.explicacao],
  };
}

/* ── Para a Mesa: a etiqueta «Fora da grelha» com o custo em degraus ────── */

export type ForaDaGrelhaNaMesa = {
  sentido: "acima_do_tecto" | "abaixo_do_chao";
  precoMotor: number;
  chao: number | null;
  tecto: number | null;
  degraus: Array<{ rotulo: string; valor: number }>;
  custo: number;
};

/** A etiqueta e os degraus (km, portagens, pessoas × horas, deposição, saída), ou null dentro da grelha. */
export function foraDaGrelhaParaAMesa(c: unknown): ForaDaGrelhaNaMesa | null {
  if (!c || typeof c !== "object") return null;
  const x = c as Partial<CustoDoTrabalho>;
  if (x.foraDaFaixa !== "acima_do_tecto" && x.foraDaFaixa !== "abaixo_do_chao") return null;
  if (!x.custo || typeof x.precoMotor !== "number") return null;
  const horas = x.horas?.total ?? 0;
  const km = x.km?.total ?? 0;
  const degraus = [
    { rotulo: `Km (${String(km).replace(".", ",")} km)`, valor: x.custo.km },
    { rotulo: "Portagens", valor: x.custo.portagens },
    { rotulo: `Pessoas × horas (${x.pessoas ?? "?"} × ${String(horas).replace(".", ",")} h)`, valor: x.custo.maoDeObra },
    { rotulo: "Deposição", valor: x.custo.deposicao },
    { rotulo: "Saída", valor: cent((x.custo.saida ?? 0) + (x.custo.fixos ?? 0)) },
  ];
  return {
    sentido: x.foraDaFaixa,
    precoMotor: x.precoMotor,
    chao: x.grelha?.chao ?? null,
    tecto: x.grelha?.tecto ?? null,
    degraus,
    custo: x.custo.total,
  };
}

/** «Motor 130,00 € · tecto 84,50 €» — a linha curta da etiqueta (valores do motor, sem IVA, só para a equipa). */
export function linhaDoForaDaGrelha(f: ForaDaGrelhaNaMesa): string {
  return f.sentido === "acima_do_tecto"
    ? `Motor ${euros(f.precoMotor)} acima do tecto ${f.tecto != null ? euros(f.tecto) : "—"}`
    : `Motor ${euros(f.precoMotor)} abaixo do chão ${f.chao != null ? euros(f.chao) : "—"}`;
}
