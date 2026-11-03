import { ENTULHO_POR_VOLUME, ESVAZIAMENTO_POR_TIPOLOGIA } from "./precos-publicos";
import { PESO_DO_SACO, SACOS_POR_BIG_BAG, SACOS_POR_CARGA, SACOS_POR_METRO_CUBICO } from "./sacos-de-entulho";
import { CITIES, REGIONS } from "./seo-data";
import { kmPorCidade } from "./distancia-estimada";

/**
 * AS RESPOSTAS DO SIMULADOR, LIDAS DE UMA SÓ MANEIRA — 03-11-2026 (decisão d1).
 *
 * *«Cada categoria tem o seu simulador, todo preparado para ela.»* — o dono,
 * 03-11-2026, depois de ver a app de cliente perguntar a desmontagem no
 * entulho, perguntar duas vezes se o entulho estava em sacos e mostrar
 * «10 sacos 40–50 €» com 50 sacos escolhidos.
 *
 * Aqui vivem as RESPOSTAS (os ids e os nomes de cada opção) e a leitura delas,
 * sem confiar em nada do que chega: a R12 (`/api/cliente/referencia`), o
 * pedido (`/api/simulador/pedido`) e o simulador do site lêem pelas mesmas
 * funções. As PERGUNTAS de cada serviço, pela ordem, estão em
 * `simulador-por-categoria.ts`; a conta, em `preco-de-referencia.ts`.
 *
 * Os ids são os da ordem d1 — o leitor da descrição do I&D sugere valores com
 * eles. Nenhum número se escreve aqui: os volumes saem de `ENTULHO_POR_VOLUME`,
 * as tipologias de `ESVAZIAMENTO_POR_TIPOLOGIA`, as conversões de
 * `sacos-de-entulho.ts`.
 *
 * Puro: sem base nem React (o simulador do site usa-o no browser).
 */

export type OpcaoDaResposta = { id: string; nome: string; ajuda?: string };

const texto = (v: unknown, max = 40): string | null =>
  typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;

/** Um número inteiro ≥ 0 (também escrito: «50», «50 sacos»; «1,5» conta 1), ou `null`. */
export function inteiroDaResposta(v: unknown, maximo = 9999): number | null {
  const escrito = typeof v === "string" ? v.match(/\d+(?:[.,]\d+)?/) : null;
  const n = typeof v === "number" ? v : escrito ? Number(escrito[0].replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(maximo, Math.floor(n));
}

const umaDe = <T extends string>(lista: readonly { id: string }[], v: unknown): T | null => {
  const t = texto(v);
  return t && lista.some((o) => o.id === t) ? (t as T) : null;
};

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/* ── O acesso (os campos que já existiam) ───────────────────────────────── */

export const ANDARES: readonly OpcaoDaResposta[] = [
  { id: "rés-do-chão", nome: "Rés-do-chão" },
  { id: "1º", nome: "1.º andar" },
  { id: "2º", nome: "2.º andar" },
  { id: "3º", nome: "3.º andar" },
  { id: "4º+", nome: "4.º andar ou acima" },
];

export const ELEVADORES: readonly OpcaoDaResposta[] = [
  { id: "yes", nome: "Sim, funciona" },
  { id: "small", nome: "Sim, mas é pequeno" },
  { id: "no", nome: "Não tem" },
  { id: "unknown", nome: "Não sei" },
];

export const ESTACIONAMENTOS: readonly OpcaoDaResposta[] = [
  { id: "door", nome: "Sim, mesmo à porta" },
  { id: "under_20m", nome: "Sim, até 20 metros" },
  { id: "over_30m", nome: "Mais de 30 metros" },
  { id: "difficult", nome: "Estacionamento difícil" },
];

export type AcessoDoPedido = { floor: string | null; hasElevator: string | null; parkingDistance: string | null };

/** O andar, o elevador e o estacionamento, sem confiar na forma. */
export function lerAcesso(v: { floor?: unknown; hasElevator?: unknown; parkingDistance?: unknown }): AcessoDoPedido {
  const andar = typeof v.floor === "number" && Number.isFinite(v.floor) ? String(Math.max(0, Math.floor(v.floor))) : texto(v.floor, 20);
  return { floor: andar, hasElevator: texto(v.hasElevator, 20), parkingDistance: texto(v.parkingDistance, 20) };
}

/** O número do andar — 0 no rés-do-chão, 4 em «4º+» —, ou `null` se não o disse. */
export function numeroDoAndar(floor: string | number | null | undefined): number | null {
  if (floor == null || floor === "") return null;
  if (typeof floor === "number") return Number.isFinite(floor) ? Math.max(0, Math.floor(floor)) : null;
  if (/r[ée]s|r\/c|^0$/i.test(floor)) return 0;
  const n = Number.parseInt(floor.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function andarEscrito(floor: string | number, n: number): string {
  const daLista = ANDARES.find((a) => a.id === floor);
  return daLista ? daLista.nome : `${n}.º andar`;
}

/** «3.º andar», «4.º andar ou acima» — `null` sem andar ou no rés-do-chão. */
export function nomeDoAndar(floor: string | number | null | undefined): string | null {
  const n = numeroDoAndar(floor);
  return floor != null && n != null && n >= 1 ? andarEscrito(floor, n) : null;
}

/**
 * O ACESSO QUE LEVA A REFERÊNCIA AO TOPO DA FAIXA, por palavras — a regra da
 * garagem (`acessoDificilDoEspaco`) para todos (d1, 03-11-2026): do 1.º andar
 * para cima sem elevador (ou sem saber se há), e o estacionamento a mais de
 * 30 metros ou difícil. Vazio quando o acesso é normal ou ainda não o disse.
 */
export function razoesDoAcessoDificil(a: AcessoDoPedido | null | undefined): string[] {
  if (!a) return [];
  const r: string[] = [];
  const n = numeroDoAndar(a.floor);
  if (a.floor != null && n != null && n >= 1) {
    const andar = andarEscrito(a.floor, n);
    if (a.hasElevator === "no") r.push(`${andar} sem elevador`);
    else if (a.hasElevator === "unknown") r.push(`${andar}, sem saber se há elevador`);
  }
  if (a.parkingDistance === "over_30m") r.push("Estacionamento a mais de 30 metros");
  if (a.parkingDistance === "difficult") r.push("Estacionamento difícil");
  return r;
}

/* ── O entulho ─────────────────────────────────────────────────────────── */

export type EstadoDoEntulho = "ensacado" | "chao" | "misto" | "unknown";

export const ESTADOS_DO_ENTULHO: ReadonlyArray<{ id: EstadoDoEntulho; nome: string }> = [
  { id: "ensacado", nome: "Já está em sacos" },
  { id: "chao", nome: "Está no chão (a granel)" },
  { id: "misto", nome: "Uma parte em sacos e outra no chão" },
  { id: "unknown", nome: "Não sei" },
];

/*
 * O BIG BAG É SÓ A MEDIDA DO QUE O CLIENTE JÁ TEM — decisão do dono, 03-11-2026.
 * A CLYON não fornece nem aluga big bags nem contentores (`sacos-de-entulho.ts`):
 * quem já encheu big bags diz quantos, e cada um conta como `SACOS_POR_BIG_BAG`
 * sacos (a regra de 06-10-2026). O que se recolhe continua a ser carregado à mão.
 */
export type TipoDeSaco = "pequeno" | "bigbag";

export const TIPOS_DE_SACO: ReadonlyArray<{ id: TipoDeSaco; nome: string; ajuda: string }> = [
  { id: "pequeno", nome: `Sacos pequenos (${PESO_DO_SACO}, como os do Leroy Merlin)`, ajuda: "Cada um conta como um saco da grelha." },
  {
    id: "bigbag",
    nome: "Big bags (cerca de 1 m³)",
    ajuda: `Cada um conta como ${SACOS_POR_BIG_BAG} sacos. É só a medida dos que já tem: a CLYON não fornece nem aluga big bags nem contentores.`,
  },
];

/** «casa de banho ou cozinha» — o exemplo de cada linha da grelha, como o dono o disse (03-11-2026). */
const EXEMPLO_DO_VOLUME: Readonly<Record<number, string>> = {
  1: "Casa de banho ou cozinha",
  3: "Obra de um T1/T2",
  5: "Demolições",
};

const MAIOR_VOLUME = ENTULHO_POR_VOLUME[ENTULHO_POR_VOLUME.length - 1].m3;

/** O entulho a granel, pelas linhas da grelha (`ENTULHO_POR_VOLUME`): ate1, ate3, ate5, mais, incerto. */
export const VOLUMES_DO_ENTULHO: ReadonlyArray<{ id: string; nome: string; ajuda?: string; m3?: number }> = [
  ...ENTULHO_POR_VOLUME.map((v) => ({
    id: `ate${v.m3}`,
    nome: `Até ${v.m3} m³`,
    ...(EXEMPLO_DO_VOLUME[v.m3] ? { ajuda: EXEMPLO_DO_VOLUME[v.m3] } : {}),
    m3: v.m3,
  })),
  { id: "mais", nome: `Mais de ${MAIOR_VOLUME} m³`, ajuda: "Proposta com fotografias" },
  { id: "incerto", nome: "Não sei" },
];

/** As cargas antigas («Enche uma carrinha»), com os nomes do simulador do site. */
export const CARGAS_DO_ENTULHO: ReadonlyArray<{ id: keyof typeof SACOS_POR_CARGA; nome: string }> = [
  { id: "carrinha", nome: "Enche uma carrinha" },
  { id: "camiao_caixa", nome: "Enche a caixa de um camião" },
  { id: "camiao_lixo", nome: "Enche um camião" },
];

/** Como ele disse a quantidade — e é a partir daqui que se conta. */
export type MedidaDoEntulho =
  | { tipo: "sacos"; sacos: number }
  | { tipo: "bigbags"; bigBags: number }
  | { tipo: "volume"; id: string; m3: number }
  | { tipo: "acima"; m3: number }
  | { tipo: "carga"; id: keyof typeof SACOS_POR_CARGA; sacos: number }
  | { tipo: "misto"; ensacados: number; porEnsacar: number };

export type EntulhoDoPedido = { estado: EstadoDoEntulho | null; medida: MedidaDoEntulho | null };

/**
 * O ENTULHO DE UM CORPO — da R12 ou do pedido, novo ou antigo:
 *
 *   · novo (d1): `entulho` (o estado), `tipoDeSaco` + `quantidade`, no misto
 *     `ensacados` + `porEnsacar`, a granel `entulhoVolume` (ate1…mais);
 *   · a app de hoje na R12: `entulho: { estado, modo, sacos, volume }`;
 *   · o simulador do site e o pedido de sempre: `entulhoState`,
 *     `entulhoQuantidade` (sacos), `entulhoQuantidadeBigBags`, as cargas
 *     antigas em `entulhoVolume` (carrinha…).
 *
 * `null` quando não há nada do entulho.
 */
export function lerEntulho(c: Record<string, unknown>): EntulhoDoPedido | null {
  const antigo = c.entulho && typeof c.entulho === "object" ? (c.entulho as Record<string, unknown>) : null;
  const estado =
    umaDe<EstadoDoEntulho>(ESTADOS_DO_ENTULHO, typeof c.entulho === "string" ? c.entulho : null) ??
    umaDe<EstadoDoEntulho>(ESTADOS_DO_ENTULHO, c.entulhoState) ??
    umaDe<EstadoDoEntulho>(ESTADOS_DO_ENTULHO, antigo?.estado);
  // Pedidos antigos com «em big bags» como estado: o que conta é a quantidade.
  const bigBagsNoEstado = c.entulhoState === "bigbags";

  const medida = ((): MedidaDoEntulho | null => {
    const ensacados = inteiroDaResposta(c.ensacados ?? c.entulhoQuantidadeEnsacados) ?? 0;
    const porEnsacar = inteiroDaResposta(c.porEnsacar ?? c.entulhoQuantidadePorEnsacar) ?? 0;
    if (estado === "misto" && ensacados + porEnsacar > 0) return { tipo: "misto", ensacados, porEnsacar };

    const tipoDeSaco = umaDe<TipoDeSaco>(TIPOS_DE_SACO, c.tipoDeSaco);
    const quantidade = inteiroDaResposta(c.quantidade);
    if (quantidade != null && quantidade > 0) {
      return tipoDeSaco === "bigbag" ? { tipo: "bigbags", bigBags: quantidade } : { tipo: "sacos", sacos: quantidade };
    }

    const volume = texto(c.entulhoVolume, 20) ?? texto(antigo?.volume, 20);
    const daGrelha = VOLUMES_DO_ENTULHO.find((v) => v.id === volume && v.m3 != null);
    if (daGrelha) return { tipo: "volume", id: daGrelha.id, m3: daGrelha.m3 as number };
    if (volume === "mais") return { tipo: "acima", m3: MAIOR_VOLUME };

    if (antigo && antigo.modo === "sacos") {
      const s = inteiroDaResposta(antigo.sacos);
      if (s != null && s > 0) return { tipo: "sacos", sacos: s };
    }

    const bigBags = inteiroDaResposta(c.entulhoQuantidadeBigBags);
    if (bigBags != null && bigBags > 0) return { tipo: "bigbags", bigBags };
    const sacos = inteiroDaResposta(c.entulhoQuantidade);
    if (sacos != null && sacos > 0) return { tipo: "sacos", sacos };

    const carga = CARGAS_DO_ENTULHO.find((x) => x.id === volume);
    if (carga && (!antigo || antigo.modo === "volume" || antigo.modo == null)) return { tipo: "carga", id: carga.id, sacos: SACOS_POR_CARGA[carga.id] };
    return null;
  })();

  if (!estado && !medida && !bigBagsNoEstado) return null;
  return { estado: estado ?? (bigBagsNoEstado ? "ensacado" : null), medida };
}

/** Quantos sacos de 25 a 30 kg são, pelas regras da casa — ou `null` sem quantidade (e acima da grelha). */
export function sacosDaMedida(m: MedidaDoEntulho | null | undefined): number | null {
  if (!m) return null;
  switch (m.tipo) {
    case "sacos":
      return m.sacos;
    case "bigbags":
      return Math.round(m.bigBags * SACOS_POR_BIG_BAG);
    case "volume":
      return Math.round(m.m3 * SACOS_POR_METRO_CUBICO);
    case "carga":
      return m.sacos;
    case "misto":
      return m.ensacados + m.porEnsacar;
    case "acima":
      return null;
  }
}

/** «2 big bags», «até 3 m³, a granel» — como ele o disse, para quem faz o trabalho (`entulhoQuantidadeDita`). */
export function medidaDita(m: MedidaDoEntulho): string | null {
  switch (m.tipo) {
    case "bigbags":
      return `${m.bigBags} ${m.bigBags === 1 ? "big bag" : "big bags"}`;
    case "volume":
      return `até ${m.m3} m³, a granel`;
    case "acima":
      return `mais de ${m.m3} m³, a granel`;
    case "carga":
      return minuscula(CARGAS_DO_ENTULHO.find((c) => c.id === m.id)?.nome ?? m.id);
    default:
      return null;
  }
}

/* ── O esvaziamento de casa e de apartamento ───────────────────────────── */

/** As tipologias da grelha publicada: as do apartamento, e a moradia só no esvaziamento de casa. */
export function tipologiasDoEsvaziamento(servico: string): ReadonlyArray<{ id: string; nome: string }> {
  if (servico !== "esvaziamento_casa" && servico !== "esvaziamento_apartamento") return [];
  return ESVAZIAMENTO_POR_TIPOLOGIA.filter((t) => servico === "esvaziamento_casa" || t.maximo != null).map((t) => ({ id: t.chave, nome: t.tipo }));
}

export type Recheio = "pouco" | "mobilada" | "muito";

/** Quão cheia está — posiciona a referência dentro da faixa, sem números novos. */
export const RECHEIOS: ReadonlyArray<{ id: Recheio; nome: string }> = [
  { id: "pouco", nome: "Pouca coisa" },
  { id: "mobilada", nome: "Mobilada, como uma casa habitada" },
  { id: "muito", nome: "Muito cheia (arrecadações, coisas acumuladas)" },
];

export function lerTipologiaDoEsvaziamento(servico: string, v: unknown): string | null {
  const t = texto(v, 20);
  return t && tipologiasDoEsvaziamento(servico).some((x) => x.id === t) ? t : null;
}

export const lerRecheio = (v: unknown): Recheio | null => umaDe<Recheio>(RECHEIOS, v);

/* ── A manutenção da casa (reparações e remodelações) ──────────────────── */

export const TIPOS_DE_TRABALHO: readonly OpcaoDaResposta[] = [
  { id: "canalizacao", nome: "Canalização" },
  { id: "electricidade", nome: "Eletricidade" },
  { id: "pintura", nome: "Pintura" },
  { id: "carpintaria", nome: "Carpintaria" },
  { id: "pequenas_reparacoes", nome: "Pequenas reparações" },
  { id: "remodelacao", nome: "Remodelação (casa de banho, cozinha…)" },
  { id: "outro", nome: "Outro trabalho" },
];

export const QUANTO_TRABALHO: readonly OpcaoDaResposta[] = [
  { id: "uma_pequena", nome: "Uma reparação pequena" },
  { id: "varias_pequenas", nome: "Várias reparações pequenas" },
  { id: "uma_divisao", nome: "Uma divisão inteira" },
  { id: "remodelacao", nome: "Uma remodelação" },
];

export const MATERIAIS: readonly OpcaoDaResposta[] = [
  { id: "tenho", nome: "Já tenho os materiais" },
  { id: "parceiro", nome: "O parceiro traz os materiais" },
  { id: "nao_sei", nome: "Ainda não sei" },
];

/** A repetição, que já existia (`recurrenceFrequency` no pedido). */
export const REPETICOES: readonly OpcaoDaResposta[] = [
  { id: "pontual", nome: "Só desta vez" },
  { id: "semanal", nome: "Semanal" },
  { id: "quinzenal", nome: "Quinzenal" },
];

export type RespostasDaManutencao = {
  tipoDeTrabalho: string | null;
  quantoTrabalho: string | null;
  materiais: string | null;
  repeticao: string | null;
};

export function lerManutencao(c: Record<string, unknown>): RespostasDaManutencao {
  return {
    tipoDeTrabalho: umaDe(TIPOS_DE_TRABALHO, c.tipoDeTrabalho),
    quantoTrabalho: umaDe(QUANTO_TRABALHO, c.quantoTrabalho),
    materiais: umaDe(MATERIAIS, c.materiais),
    repeticao: umaDe(REPETICOES, c.repeticao) ?? umaDe(REPETICOES, c.recurrenceFrequency),
  };
}

export const nomeDaOpcao = (lista: readonly { id: string; nome: string }[], id: string | null | undefined): string | null =>
  lista.find((o) => o.id === id)?.nome ?? null;

/* ── A desmontagem ─────────────────────────────────────────────────────── */

/** `true`/`false` ou «sim»/«nao» (a escolha da R7); `undefined` se não respondeu. */
export function lerDesmontagem(v: unknown): boolean | undefined {
  if (v === true || v === "sim") return true;
  if (v === false || v === "nao" || v === "não") return false;
  return undefined;
}

/* ── A localidade ──────────────────────────────────────────────────────── */

const semAcentos = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** «Lisboa, Margem Sul e Setúbal» — as zonas de `REGIONS`. */
export const ZONAS_EM_FRASE = (() => {
  const nomes = REGIONS.map((r) => r.name);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes.join("");
})();

/**
 * A localidade é de uma das zonas com parceiros? Pelas terras e regiões de
 * `seo-data.ts` e pelas da tabela de distâncias (`kmPorCidade`). `null` sem
 * localidade. Não há suplemento de zona: fora delas só se diz que a proposta
 * depende da zona.
 */
export function localidadeServida(localidade: string | null | undefined): boolean | null {
  const t = semAcentos(localidade ?? "").trim();
  if (!t) return null;
  const nomes = [...CITIES.map((c) => c.name), ...REGIONS.map((r) => r.name)].map(semAcentos);
  return nomes.some((n) => t.includes(n)) || kmPorCidade(localidade) != null;
}
