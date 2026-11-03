import { diaEmLisboa, pecasEmLisboa, somarDiasAoDia } from "../../../src/lib/hora-de-lisboa";
import { precoEmTresLinhasValido, type PrecoEmTresLinhas } from "../../../src/lib/preco-em-tres-linhas";
import { informacaoDoCatalogo, texto, textosDaV3, type InformacaoDoCatalogo, type LinhaDePreco, type TextosDaV3 } from "./catalogo";
import {
  numeroDaResposta,
  perguntaAparece,
  perguntasValidas,
  respostaEscrita,
  respostaServe,
  type PerguntaDaApp,
  type Respostas,
  type ValorDaResposta,
} from "./perguntas-do-pedido";

/**
 * O NOVO PEDIDO (E3 v3, 29-10-2026) — o simulador do site, na app.
 *
 * Três passos com os nomes do site («Que serviço precisa?», «Morada e
 * condições de acesso» — na mudança «Local e acesso da mudança» — e
 * «Contacto e revisão»), os oito serviços do simulador (com Manutenção da
 * casa e Outro serviço), e os mesmos campos que o simulador manda ao
 * `POST /api/simulador/pedido`: a quantidade exacta, o entulho em sacos ou
 * por volume, a desmontagem, o acesso difícil e a nota em cada lado da
 * mudança, o percurso, a repetição, «Podem mostrar as minhas fotos» e os
 * vídeos. Mais os da app: `origemPedido: "app_cliente"`, `dataPreferida` e
 * `rascunhosAntes`.
 *
 * O PREÇO: a app não tem números. A «Estimativa» vem só da R12
 * (`POST /api/cliente/referencia`, S13), para o que ele escolheu, com a conta
 * no porquê e o IVA ao lado, porque a API já o escreve assim. Sem resposta da
 * R12 (nada escolhido, ou sem rede), não há bloco nenhum: o «Preço de
 * referência» geral do serviço saiu do Pedir (d4/d6, 03-11-2026).
 *
 * A CONTA SÓ SE PEDE PARA ENVIAR (S14): o rascunho preenche-se e guarda-se sem
 * conta; ao tocar em «Enviar pedido» sem sessão, sobe a folha «Para enviar o
 * pedido, entre na CLYON» (E3.F), e o rascunho fica inteiro.
 *
 * «Hoje», como no simulador (d8, 31-10-2026): vai como pedido urgente
 * (`urgency: "today"`), sem prometer o dia — a frase vem da R7
 * (`textos.pedidoUrgente`). O calendário continua a começar amanhã EM LISBOA.
 * Sem big bags nem contentores.
 *
 * Puro de propósito: os testes do site importam-no.
 */

export const ROTA_DO_CATALOGO = "/api/cliente/catalogo";
export const ROTA_DO_ENVIO = "/api/simulador/pedido";
export const ROTA_DA_REFERENCIA = "/api/cliente/referencia";
export const ROTA_DO_PERCURSO = "/api/maps/route";
export const ROTA_DA_EMPRESA = "/api/pedido-de-empresa";
export const ORIGEM_DA_APP = "app_cliente";
export const MINIMO_DA_DESCRICAO = 10;
export const MAXIMO_DE_FOTOGRAFIAS = 20;
export const DIAS_NO_CALENDARIO = 90;
export const PASSOS = 3;

/* ─── O catálogo (R7 v2) ──────────────────────────────────────────────────── */

export type Detalhes = "moveis" | "monos" | "entulho" | "esvaziamento" | "mudanca" | "manutencao" | "outro";
export type Opcao = { id: string; nome: string };
export type Quando = "hoje" | "amanha" | "esta_semana" | "data" | "flexivel";

/** Uma resposta das perguntas do espaço, com a linha que deixa na descrição (R7, d5). */
export type OpcaoDoEspaco = { id: string; nome: string; linha: string };
export type CoisaDoEspaco = { id: string; nome: string; emLinha: string; aviso: string | null };

/**
 * GARAGEM, SÓTÃO E CAVE — d5, 31-10-2026. As perguntas do simulador do site
 * (`src/lib/perguntas-do-espaco.ts`), servidas já escritas pela R7: a
 * quantidade com os nomes das faixas do site, o acesso e, na garagem e na
 * cave, o que lá está. Sem elas (R7 antiga), o serviço pergunta como um
 * esvaziamento qualquer.
 */
export type EspacoDoServico = {
  quantidade: { titulo: string; opcoes: OpcaoDoEspaco[] };
  acesso: { titulo: string; opcoes: OpcaoDoEspaco[] };
  coisas: { titulo: string; ajuda: string | null; opcoes: CoisaDoEspaco[]; nenhuma: string; prefixo: string; linhaNenhuma: string } | null;
  perguntaOAndar: boolean;
  dicaDasFotos: string | null;
};

export type ServicoDoCatalogo = {
  id: string;
  nome: string;
  detalhes: Detalhes;
  /** Uma linha do que inclui (R7 v2). */
  inclui: string | null;
  /** «40 – 120 € + IVA (49,20 – 147,60 € com IVA)», já escrito pela API (R7 v2). */
  precoReferencia: string | null;
  /** Garagem, sótão e cave: as perguntas do simulador do site (R7, d5). */
  espaco: EspacoDoServico | null;
  /** As perguntas da categoria (R7, d1 de 03-11-2026), pela ordem; `null` numa R7 antiga (o pedido de sempre). */
  perguntas: PerguntaDaApp[] | null;
};

export type Catalogo = {
  servicos: ServicoDoCatalogo[];
  entulho: Opcao[];
  tipologias: Opcao[];
  quando: Quando[];
  textos: {
    fraseUnica: string;
    subtituloInicial: string | null;
    valorDesejadoEtiqueta: string | null;
    valorDesejadoAjuda: string | null;
    semFotos: string | null;
  } & TextosDaV3;
  ficheiros: { maximo: number; tipos: string[] };
  whatsapp: string | null;
  info: InformacaoDoCatalogo;
};

const DETALHES: readonly Detalhes[] = ["moveis", "monos", "entulho", "esvaziamento", "mudanca", "manutencao", "outro"];
const QUANDO: readonly Quando[] = ["hoje", "amanha", "esta_semana", "data", "flexivel"];
/** O que nunca se oferece, venha de onde vier (regra 4). */
const PROIBIDO = /big[\s_-]?bag|contentor|\bhoje\b|today|pr[óo]prio dia/i;

function opcoes(v: unknown): Opcao[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((o): Opcao | null => {
      if (typeof o === "string" && o.trim()) return { id: o.trim(), nome: o.trim() };
      const r = (o ?? {}) as { id?: unknown; nome?: unknown; valor?: unknown; texto?: unknown };
      const id = texto(r.id) ?? texto(r.valor);
      const nome = texto(r.nome) ?? texto(r.texto) ?? id;
      return id && nome ? { id, nome } : null;
    })
    .filter((o): o is Opcao => !!o && !PROIBIDO.test(`${o.id} ${o.nome}`));
}

function opcoesDoEspaco(v: unknown): OpcaoDoEspaco[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((o): OpcaoDoEspaco | null => {
      const r = (o ?? {}) as Record<string, unknown>;
      const id = texto(r.id);
      const nome = texto(r.nome);
      const linha = texto(r.linha);
      return id && nome && linha ? { id, nome, linha } : null;
    })
    .filter((o): o is OpcaoDoEspaco => !!o && !PROIBIDO.test(`${o.nome} ${o.linha}`));
}

/** As perguntas do espaço da R7, ou `null` (sem quantidade ou sem acesso, não servem). */
export function espacoValido(v: unknown): EspacoDoServico | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const q = (e.quantidade ?? {}) as Record<string, unknown>;
  const a = (e.acesso ?? {}) as Record<string, unknown>;
  const quantidade = { titulo: texto(q.titulo) ?? "", opcoes: opcoesDoEspaco(q.opcoes) };
  const acesso = { titulo: texto(a.titulo) ?? "", opcoes: opcoesDoEspaco(a.opcoes) };
  if (!quantidade.titulo || quantidade.opcoes.length === 0 || !acesso.titulo || acesso.opcoes.length === 0) return null;
  let coisas: EspacoDoServico["coisas"] = null;
  const c = e.coisas as Record<string, unknown> | null | undefined;
  if (c && typeof c === "object" && Array.isArray(c.opcoes)) {
    const opcoes = c.opcoes
      .map((o): CoisaDoEspaco | null => {
        const r = (o ?? {}) as Record<string, unknown>;
        const id = texto(r.id);
        const nome = texto(r.nome);
        const emLinha = texto(r.emLinha);
        return id && nome && emLinha ? { id, nome, emLinha, aviso: texto(r.aviso) } : null;
      })
      .filter((o): o is CoisaDoEspaco => !!o);
    const titulo = texto(c.titulo);
    const prefixo = typeof c.prefixo === "string" && c.prefixo.trim() ? c.prefixo : null;
    const linhaNenhuma = texto(c.linhaNenhuma);
    if (titulo && prefixo && linhaNenhuma && opcoes.length > 0) {
      coisas = { titulo, ajuda: texto(c.ajuda), opcoes, nenhuma: texto(c.nenhuma) ?? "nenhuma", prefixo, linhaNenhuma };
    }
  }
  return { quantidade, acesso, coisas, perguntaOAndar: e.perguntaOAndar !== false, dicaDasFotos: texto(e.dicaDasFotos) };
}

/** O catálogo da R7, com a forma certa, ou `null` (a app não pede sem ele). */
export function catalogoValido(v: unknown): Catalogo | null {
  const c = (v ?? {}) as Record<string, unknown>;
  const t = (c.textos ?? {}) as Record<string, unknown>;
  const fraseUnica = texto(t.fraseUnica);
  if (!Array.isArray(c.servicos) || !fraseUnica) return null;
  const servicos = c.servicos
    .map((s): ServicoDoCatalogo | null => {
      const r = (s ?? {}) as Record<string, unknown>;
      const id = texto(r.id);
      const nome = texto(r.nome);
      const detalhes = DETALHES.find((d) => d === r.detalhes);
      if (!id || !nome || !detalhes) return null;
      const preco = texto(r.precoReferencia);
      return {
        id,
        nome,
        detalhes,
        inclui: texto(r.inclui),
        precoReferencia: preco && !PROIBIDO.test(preco) ? preco : null,
        espaco: espacoValido(r.espaco),
        perguntas: perguntasValidas(r.perguntas),
      };
    })
    .filter((s): s is ServicoDoCatalogo => !!s && !PROIBIDO.test(`${s.nome} ${s.inclui ?? ""}`));
  if (servicos.length === 0) return null;
  const quando = Array.isArray(c.quando) ? QUANDO.filter((q) => (c.quando as unknown[]).includes(q)) : [...QUANDO];
  const f = (c.ficheiros ?? {}) as { maximo?: unknown; tipos?: unknown };
  return {
    servicos,
    entulho: opcoes(c.entulho),
    tipologias: opcoes(c.tipologias),
    quando: quando.length > 0 ? quando : [...QUANDO],
    textos: {
      fraseUnica,
      subtituloInicial: texto(t.subtituloInicial),
      valorDesejadoEtiqueta: texto(t.valorDesejadoEtiqueta),
      valorDesejadoAjuda: texto(t.valorDesejadoAjuda),
      semFotos: texto(t.semFotos),
      ...textosDaV3(c),
    },
    ficheiros: {
      maximo: typeof f.maximo === "number" && f.maximo > 0 ? Math.min(f.maximo, MAXIMO_DE_FOTOGRAFIAS) : MAXIMO_DE_FOTOGRAFIAS,
      tipos: Array.isArray(f.tipos) ? f.tipos.filter((x): x is string => typeof x === "string") : [],
    },
    whatsapp: texto(c.whatsapp),
    info: informacaoDoCatalogo(c),
  };
}

/* ─── As opções fixas do formulário (as do simulador) ─────────────────────── */

export const TEXTO_DO_QUANDO: Readonly<Record<Quando, string>> = {
  hoje: "Hoje",
  amanha: "Amanhã",
  esta_semana: "Esta semana",
  data: "Numa data à escolha",
  flexivel: "Sou flexível",
};

/** O `urgency` que o simulador grava. Numa data à escolha, vai a `dataPreferida` e não o `urgency`. */
const URGENCIA: Readonly<Record<Quando, string | undefined>> = {
  hoje: "today",
  amanha: "tomorrow",
  esta_semana: "this_week",
  data: undefined,
  flexivel: "flexible",
};

export const ANDARES: readonly Opcao[] = [
  { id: "rés-do-chão", nome: "R/C" },
  { id: "1º", nome: "1.º" },
  { id: "2º", nome: "2.º" },
  { id: "3º", nome: "3.º" },
  { id: "4º+", nome: "4.º ou acima" },
];

export const ELEVADOR: readonly Opcao[] = [
  { id: "yes", nome: "Sim" },
  { id: "small", nome: "Pequeno" },
  { id: "no", nome: "Não" },
  { id: "unknown", nome: "Não sei" },
];

export const ESTACIONAMENTO: readonly Opcao[] = [
  { id: "door", nome: "À porta" },
  { id: "under_20m", nome: "Até 20 metros" },
  { id: "over_30m", nome: "Mais de 30 metros" },
  { id: "difficult", nome: "Difícil" },
];

export const VOLUMES: readonly Opcao[] = [
  { id: "carrinha", nome: "Enche uma carrinha" },
  { id: "camiao_caixa", nome: "Enche a caixa de um camião" },
  { id: "camiao_lixo", nome: "Enche um camião" },
  { id: "incerto", nome: "Não tenho a certeza" },
];

export const TAMANHOS_DOS_ITENS: ReadonlyArray<{ id: "pequeno" | "medio" | "grande"; nome: string; exemplos: string }> = [
  { id: "pequeno", nome: "Pequenos", exemplos: "Micro-ondas, forno, mesinha de cabeceira" },
  { id: "medio", nome: "Médios", exemplos: "Fogão, frigorífico bar, cadeirão" },
  { id: "grande", nome: "Grandes", exemplos: "Sofá, armário, frigorífico, máquina de lavar" },
];

export type Repeticao = "pontual" | "semanal" | "quinzenal";
export const REPETICAO: ReadonlyArray<{ id: Repeticao; nome: string }> = [
  { id: "pontual", nome: "Só desta vez" },
  { id: "semanal", nome: "Semanal" },
  { id: "quinzenal", nome: "Quinzenal" },
];

export type ModoDoEntulho = "sacos" | "volume" | "incerto";

/* ─── O rascunho ──────────────────────────────────────────────────────────── */

export type Morada = {
  formattedAddress: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  /** Escrita à mão (as sugestões não responderam, ou ele preferiu). */
  aMao?: boolean;
};

export type Acesso = {
  floor?: string;
  hasElevator?: string;
  parkingDistance?: string;
  /** Na mudança, em cada lado: «Acesso difícil» e uma nota. */
  difficultAccess?: boolean;
  accessNotes?: string;
};

export type FotografiaDoPedido = {
  uri: string;
  estado: "a-enviar" | "enviada" | "falhou";
  url?: string;
  nome?: string;
  tamanho?: number;
  tipo?: string;
};

export type Rascunho = {
  passo: 1 | 2 | 3;
  /** O ecrã do Pedir (uma pergunta por ecrã, 02-11-2026); sem ele, a primeira pergunta do passo. */
  ecra?: EcraDoPedir;
  servico?: string;
  movelModo?: "item" | "carga";
  itens?: { pequeno: number; medio: number; grande: number };
  volume?: string;
  /** Garagem, sótão e cave (d5): a resposta do acesso e o que lá está (`acessoDoEspaco`, `coisasDoEspaco`). */
  acessoDoEspaco?: string;
  coisasDoEspaco?: string[];
  /** O número exacto, se o souber (`quantityExact`). */
  quantidadeExacta: string;
  entulho?: string;
  entulhoModo?: ModoDoEntulho;
  sacos: string;
  ensacados: string;
  porEnsacar: string;
  entulhoVolume?: string;
  tipologia?: string;
  descricao: string;
  morada?: Morada;
  acesso: Acesso;
  destino?: Morada;
  acessoDestino: Acesso;
  distanciaKm?: number;
  desmontagem?: boolean;
  fotos: FotografiaDoPedido[];
  /** Já disse que segue sem fotografias. */
  semFotosAceite?: boolean;
  quando?: Quando;
  data?: string;
  /** A hora escolhida no calendário, «HH:MM» de Lisboa (02-11-2026); vai na descrição, não muda o preço. */
  hora?: string;
  repeticao?: Repeticao;
  valorDesejado: string;
  querNif: boolean;
  nif: string;
  nome: string;
  telefone: string;
  /** Da v2 (sem conta): já não se usa — o email é sempre o da sessão. */
  email: string;
  autorizaFotos: boolean;
  /**
   * As respostas às perguntas da categoria (d1), pelos ids da R7 — as que não
   * têm já um campo de sempre (o andar, o elevador e o estacionamento ficam em
   * `acesso`; os itens, o volume, a tipologia, o entulho, a desmontagem e a
   * repetição nos campos deles). Ver `valorDaResposta`.
   */
  respostas?: Record<string, ValorDaResposta>;
  /** As sugestões do leitor que ele recusou («campo=valor»): não voltam. */
  sugestoesRecusadas?: string[];
  /** Quando mudou pela última vez (ISO), para a caixa do pedido a meio (d5, 03-11-2026). */
  guardadoEm?: string;
};

export function rascunhoVazio(): Rascunho {
  return {
    passo: 1,
    quantidadeExacta: "",
    sacos: "",
    ensacados: "",
    porEnsacar: "",
    descricao: "",
    acesso: {},
    acessoDestino: {},
    fotos: [],
    valorDesejado: "",
    querNif: false,
    nif: "",
    nome: "",
    telefone: "",
    email: "",
    autorizaFotos: false,
  };
}

/**
 * Um rascunho guardado que ainda tem a forma certa (as fotografias por enviar
 * não voltam: o envio parou). Um rascunho da v2 (quatro passos) volta ao fim.
 */
export function rascunhoValido(v: unknown): Rascunho | null {
  const r = v as (Partial<Rascunho> & { passo?: number }) | null;
  if (!r || typeof r !== "object" || typeof r.descricao !== "string" || ![1, 2, 3, 4].includes(r.passo as number)) return null;
  const base = rascunhoVazio();
  return {
    ...base,
    ...r,
    passo: Math.min(PASSOS, r.passo as number) as Rascunho["passo"],
    acesso: { ...(r.acesso ?? {}) },
    acessoDestino: { ...(r.acessoDestino ?? {}) },
    fotos: Array.isArray(r.fotos) ? r.fotos.filter((f) => f && f.estado === "enviada" && typeof f.url === "string") : [],
    hora: horaValida(r.hora) ? r.hora : undefined,
    guardadoEm: typeof r.guardadoEm === "string" && Number.isFinite(Date.parse(r.guardadoEm)) ? r.guardadoEm : undefined,
  } as Rascunho;
}

export function servicoDe(r: Pick<Rascunho, "servico">, c: Catalogo): ServicoDoCatalogo | null {
  return c.servicos.find((s) => s.id === r.servico) ?? null;
}
export function detalhesDe(r: Pick<Rascunho, "servico">, c: Catalogo): Detalhes | null {
  return servicoDe(r, c)?.detalhes ?? null;
}
/** As perguntas do espaço do serviço escolhido (garagem, sótão e cave), ou `null`. */
export function espacoDe(r: Pick<Rascunho, "servico">, c: Catalogo): EspacoDoServico | null {
  return servicoDe(r, c)?.espaco ?? null;
}

/** A linha «No espaço há: …» — a mesma de `linhaDasCoisas` no site. */
export function linhaDasCoisasDoEspaco(e: EspacoDoServico, coisas: readonly string[] | undefined): string | null {
  if (!e.coisas || !coisas || coisas.length === 0) return null;
  const escolhidas = e.coisas.opcoes.filter((o) => coisas.includes(o.id));
  if (escolhidas.length === 0) return null;
  if (escolhidas.some((o) => o.id === e.coisas!.nenhuma)) return e.coisas.linhaNenhuma;
  return `${e.coisas.prefixo}${escolhidas.map((o) => o.emLinha).join(", ")}.`;
}

/** Escolher (ou tirar) uma coisa do espaço: «Nenhuma» exclui as outras, como no simulador. */
export function mudarCoisasDoEspaco(e: EspacoDoServico, antes: readonly string[] | undefined, id: string): string[] {
  const coisas = antes ?? [];
  const nenhuma = e.coisas?.nenhuma ?? "nenhuma";
  const activa = coisas.includes(id);
  if (id === nenhuma) return activa ? [] : [nenhuma];
  const sem = coisas.filter((c) => c !== nenhuma && c !== id);
  return activa ? sem : [...sem, id];
}

/** Os avisos das coisas escolhidas (químicos, pneus), como no simulador. */
export function avisosDoEspaco(e: EspacoDoServico, coisas: readonly string[] | undefined): string[] {
  return (e.coisas?.opcoes ?? []).filter((o) => coisas?.includes(o.id) && o.aviso).map((o) => o.aviso as string);
}

/* ─── As perguntas da categoria (R7, d1 de 03-11-2026) ─────────────────────── */

/** As perguntas do serviço escolhido, ou `null` (R7 antiga, ou ainda sem serviço). */
export function perguntasDe(r: Pick<Rascunho, "servico">, c: Catalogo): PerguntaDaApp[] | null {
  return servicoDe(r, c)?.perguntas ?? null;
}

const TAMANHOS = ["pequeno", "medio", "grande"] as const;
type Tamanho = (typeof TAMANHOS)[number];
const eTamanho = (t: string): t is Tamanho => (TAMANHOS as readonly string[]).includes(t);

/** Onde vive cada resposta: o acesso de cada lado, ou o campo de sempre. */
function acessoDoId(id: string): { lado: "acesso" | "acessoDestino"; campo: keyof Acesso } | null {
  const [a, b] = id.includes(".") ? id.split(".") : ["", id];
  const lado = a === "" || a === "origem" ? "acesso" : a === "destino" ? "acessoDestino" : null;
  if (!lado) return null;
  if (b === "floor" || b === "hasElevator" || b === "parkingDistance" || b === "difficultAccess" || b === "accessNotes") return { lado, campo: b };
  return null;
}

/** A resposta a uma pergunta, lida de onde vive. */
export function valorDaResposta(r: Rascunho, id: string): ValorDaResposta | undefined {
  const ac = acessoDoId(id);
  if (ac) {
    const v = r[ac.lado][ac.campo];
    if (ac.campo === "difficultAccess") return v === true ? "sim" : v === false ? "nao" : undefined;
    return typeof v === "string" && v ? v : undefined;
  }
  if (id.startsWith("itens.")) {
    const t = id.slice(6);
    return eTamanho(t) && r.itens ? String(r.itens[t] ?? 0) : undefined;
  }
  switch (id) {
    case "movelModo":
      return r.movelModo;
    case "volume":
      return r.volume;
    case "quantidadeExacta":
      return r.quantidadeExacta || undefined;
    case "acessoDoEspaco":
      return r.acessoDoEspaco;
    case "coisasDoEspaco":
      return r.coisasDoEspaco && r.coisasDoEspaco.length > 0 ? [...r.coisasDoEspaco] : undefined;
    case "tipologia":
      return r.tipologia;
    case "entulho":
      return r.entulho;
    case "desmontagem":
      return r.desmontagem === undefined ? undefined : r.desmontagem ? "sim" : "nao";
    case "repeticao":
      return r.repeticao;
    default:
      return r.respostas?.[id];
  }
}

/** O que muda no rascunho ao responder a uma pergunta (no campo onde ela vive). */
export function comResposta(r: Rascunho, id: string, v: ValorDaResposta | undefined): Partial<Rascunho> {
  const um = typeof v === "string" ? v : undefined;
  const ac = acessoDoId(id);
  if (ac) {
    const antes = r[ac.lado];
    const novo: Acesso =
      ac.campo === "difficultAccess"
        ? { ...antes, difficultAccess: um === "sim" }
        : ac.campo === "floor"
          ? { ...antes, floor: um, hasElevator: um === "rés-do-chão" ? undefined : antes.hasElevator }
          : { ...antes, [ac.campo]: um };
    return { [ac.lado]: novo } as Partial<Rascunho>;
  }
  if (id.startsWith("itens.")) {
    const t = id.slice(6);
    if (!eTamanho(t)) return {};
    return { itens: { pequeno: 0, medio: 0, grande: 0, ...r.itens, [t]: numeroDaResposta(um) ?? 0 } };
  }
  switch (id) {
    case "movelModo":
      return { movelModo: um === "item" || um === "carga" ? um : undefined };
    case "volume":
      return { volume: um };
    case "quantidadeExacta":
      return { quantidadeExacta: um ?? "" };
    case "acessoDoEspaco":
      return { acessoDoEspaco: um };
    case "coisasDoEspaco":
      return { coisasDoEspaco: Array.isArray(v) ? [...v] : undefined };
    case "tipologia":
      return { tipologia: um };
    case "entulho":
      return { entulho: um };
    case "desmontagem":
      return { desmontagem: um === "sim" ? true : um === "nao" ? false : undefined };
    case "repeticao":
      return { repeticao: um === "pontual" || um === "semanal" || um === "quinzenal" ? um : undefined };
    default: {
      const respostas = { ...(r.respostas ?? {}) };
      if (v === undefined || (typeof v === "string" && v === "")) delete respostas[id];
      else respostas[id] = Array.isArray(v) ? [...v] : v;
      return { respostas };
    }
  }
}

/** Todas as respostas deste pedido, pelos ids das perguntas. */
export function respostasDoRascunho(r: Rascunho, perguntas: readonly PerguntaDaApp[]): Respostas {
  const out: Record<string, ValorDaResposta> = {};
  for (const p of perguntas) {
    const v = valorDaResposta(r, p.id);
    if (v !== undefined) out[p.id] = v;
  }
  return out;
}

/** As perguntas que aparecem agora (as condições de `quando`), num ecrã ou em todos. */
export function perguntasVisiveis(r: Rascunho, perguntas: readonly PerguntaDaApp[], ecra?: "oque" | "acesso"): PerguntaDaApp[] {
  const respostas = respostasDoRascunho(r, perguntas);
  return perguntas.filter((p) => (!ecra || p.ecra === ecra) && perguntaAparece(p, respostas));
}

/** Trocar de serviço: as respostas da categoria de antes não seguem (o acesso, a morada e os contactos sim). */
export function semAsRespostasDoServico(): Partial<Rascunho> {
  return {
    movelModo: undefined,
    itens: undefined,
    volume: undefined,
    quantidadeExacta: "",
    entulho: undefined,
    entulhoModo: undefined,
    entulhoVolume: undefined,
    tipologia: undefined,
    acessoDoEspaco: undefined,
    coisasDoEspaco: undefined,
    desmontagem: undefined,
    repeticao: undefined,
    respostas: undefined,
    sugestoesRecusadas: undefined,
  };
}

/** O que falta nas perguntas da categoria deste ecrã, pela ordem. */
function emFaltaNasPerguntas(r: Rascunho, perguntas: readonly PerguntaDaApp[], ecra: "oque" | "acesso"): CampoEmFalta[] {
  const respostas = respostasDoRascunho(r, perguntas);
  const visiveis = perguntas.filter((p) => p.ecra === ecra && perguntaAparece(p, respostas));
  const l: CampoEmFalta[] = [];
  const itens = visiveis.filter((p) => p.id.startsWith("itens."));
  let itensVistos = false;
  for (const p of visiveis) {
    if (p.id.startsWith("itens.")) {
      if (itensVistos) continue;
      itensVistos = true;
      if (itens.every((x) => (numeroDaResposta(respostas[x.id]) ?? 0) === 0)) l.push({ campo: "itens", texto: "Indique pelo menos um item." });
      continue;
    }
    const v = respostas[p.id];
    if (v === undefined || (typeof v === "string" && v.trim() === "")) {
      if (p.obrigatoria) l.push({ campo: p.id, texto: `Responda a «${p.titulo}»` });
      continue;
    }
    if (!respostaServe(p, v)) l.push({ campo: p.id, texto: p.tipo === "numero" ? `Escreva um número em «${p.titulo}»` : `Responda a «${p.titulo}»` });
  }
  // No entulho em parte e parte, pelo menos um saco ao todo.
  const ens = visiveis.find((p) => p.id === "ensacados");
  const por = visiveis.find((p) => p.id === "porEnsacar");
  if (ens && por && (numeroDaResposta(respostas.ensacados) ?? 0) + (numeroDaResposta(respostas.porEnsacar) ?? 0) === 0 && !l.some((x) => x.campo === "ensacados" || x.campo === "porEnsacar")) {
    l.push({ campo: "ensacados", texto: "Diga quantos sacos são." });
  }
  return l;
}

/** O título do passo, o do simulador do site. */
export function tituloDoPasso(passo: Rascunho["passo"], d: Detalhes | null): string {
  if (passo === 1) return "Que serviço precisa?";
  if (passo === 2) return d === "mudanca" ? "Local e acesso da mudança" : "Morada e condições de acesso";
  return "Contacto e revisão";
}

const inteiro = (s: string) => {
  const n = Number.parseInt(s.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const totalDeItens = (r: Rascunho) => (r.itens?.pequeno ?? 0) + (r.itens?.medio ?? 0) + (r.itens?.grande ?? 0);
const acessoCompleto = (a: Acesso) => !!a.floor && (a.floor === "rés-do-chão" || !!a.hasElevator) && !!a.parkingDistance;
const pedeVolume = (d: Detalhes | null, r: Rascunho) => d === "monos" || d === "esvaziamento" || (d === "moveis" && r.movelModo === "carga");
/** A garagem e a cave não perguntam o andar (ficam no rés-do-chão), como no simulador. */
export const semAndar = (e: EspacoDoServico | null) => !!e && !e.perguntaOAndar;

/** Os sacos de entulho que ele disse (em sacos e por ensacar, no misto). */
export function sacosDoEntulho(r: Rascunho): number {
  return r.entulho === "misto" ? inteiro(r.ensacados) + inteiro(r.porEnsacar) : inteiro(r.sacos);
}

/** O que falta para passar deste passo — a frase, ou `null`. */
export type CampoEmFalta = { campo: string; texto: string };

/**
 * Todos os campos que faltam no passo, pela ordem do ecrã (30-10-2026): o
 * primeiro é para onde o ecrã desce e onde fica o foco; cada um sai do vermelho
 * quando fica bem preenchido. `campo` é o nome que o ecrã dá ao campo.
 */
export function camposEmFalta(r: Rascunho, passo: Rascunho["passo"], c: Catalogo, agora: Date = new Date()): CampoEmFalta[] {
  const d = detalhesDe(r, c);
  const e = espacoDe(r, c);
  const l: CampoEmFalta[] = [];
  const falta = (campo: string, texto: string) => l.push({ campo, texto });
  const perguntas = perguntasDe(r, c);
  if (passo === 1 && d && perguntas) {
    l.push(...emFaltaNasPerguntas(r, perguntas, "oque"));
    if (r.descricao.trim().length < MINIMO_DA_DESCRICAO) falta("descricao", "Descreva o que precisa (pelo menos 10 letras).");
    if (r.fotos.some((f) => f.estado === "a-enviar")) falta("fotos", "Espere que as fotografias acabem de seguir.");
    return l;
  }
  if (passo === 2 && d && perguntas) {
    const mudanca = d === "mudanca";
    if (!r.morada?.formattedAddress?.trim()) falta("morada", mudanca ? "Falta a morada de origem." : "Falta a morada.");
    if (mudanca && !r.destino?.formattedAddress?.trim()) falta("destino", "Falta a morada de destino.");
    l.push(...emFaltaNasPerguntas(r, perguntas, "acesso"));
    return l;
  }
  if (passo === 1) {
    if (!d) return [{ campo: "servico", texto: "Escolha o que precisa." }];
    if (d === "moveis" && !r.movelModo) falta("movelModo", "Diga como prefere indicar os móveis.");
    if (d === "moveis" && r.movelModo === "item" && totalDeItens(r) === 0) falta("itens", "Indique pelo menos um item.");
    if (pedeVolume(d, r) && !r.volume) falta("volume", "Diga quanto há para levar.");
    if (e && !r.acessoDoEspaco) falta("acessoDoEspaco", `Responda a «${e.acesso.titulo}»`);
    if (d === "entulho" && !r.entulho) falta("entulho", "Diga como está o entulho.");
    if (d === "entulho" && !r.entulhoModo) falta("entulhoModo", "Diga quanto entulho há, ou «Não tenho a certeza».");
    if (d === "entulho" && r.entulhoModo === "sacos" && sacosDoEntulho(r) === 0) falta("sacos", "Diga quantos sacos são.");
    if (d === "entulho" && r.entulhoModo === "volume" && !r.entulhoVolume) falta("entulhoVolume", "Diga quanto enche.");
    if (d === "mudanca" && !r.tipologia) falta("tipologia", "Diga o tamanho da casa.");
    if (r.descricao.trim().length < MINIMO_DA_DESCRICAO) falta("descricao", "Descreva o que precisa (pelo menos 10 letras).");
    if (r.fotos.some((f) => f.estado === "a-enviar")) falta("fotos", "Espere que as fotografias acabem de seguir.");
    return l;
  }
  if (passo === 2) {
    const mudanca = d === "mudanca";
    if (!r.morada?.formattedAddress?.trim()) falta("morada", mudanca ? "Falta a morada de origem." : "Falta a morada.");
    if (semAndar(e) ? !r.acesso.parkingDistance : !acessoCompleto(r.acesso)) {
      falta("acesso", semAndar(e) ? "Diga como é o estacionamento." : "Diga o andar, o elevador e o estacionamento.");
    }
    if (mudanca && !r.destino?.formattedAddress?.trim()) falta("destino", "Falta a morada de destino.");
    if (mudanca && !acessoCompleto(r.acessoDestino)) falta("acessoDestino", "Diga o andar, o elevador e o estacionamento no destino.");
    return l;
  }
  if (!r.quando) falta("quando", "Diga quando precisa.");
  if (r.quando === "data" && !r.data) falta("data", "Escolha o dia.");
  if (r.quando === "data" && r.data && r.data < primeiroDiaPossivel(agora)) falta("data", "Escolha um dia a partir de amanhã.");
  if (r.querNif && !/^\d{9}$/.test(r.nif.replace(/\s/g, ""))) falta("nif", "O NIF tem 9 algarismos.");
  if (!r.nome.trim()) falta("nome", "Falta o seu nome.");
  if (!r.telefone.trim()) falta("telefone", "Falta o seu telemóvel.");
  return l;
}

/** A primeira frase do que falta no passo, ou null. */
export function faltaNoPasso(r: Rascunho, passo: Rascunho["passo"], c: Catalogo, agora: Date = new Date()): string | null {
  return camposEmFalta(r, passo, c, agora)[0]?.texto ?? null;
}

/* ─── Uma pergunta por ecrã (02-11-2026) ──────────────────────────────────── */

/**
 * OS ECRÃS DO PEDIR — ordem do CEO com o sim do dono (02-11-2026): «uma
 * pergunta por ecrã», como a Vinted. Onde é → o que é e quanto → fotografias
 * → andar e elevador (e a carrinha perto) → quando → contacto → resumo e
 * enviar. Na mudança, «Para onde vai?» entra depois do «o que é».
 *
 * Os campos e as regras são os mesmos dos três passos de antes (os do
 * simulador do site): cada ecrã só valida a sua parte (`camposEmFalta` do
 * passo, filtrado), e o resumo valida tudo antes de enviar. O `passo` do
 * rascunho continua a dizer em que parte do simulador se está.
 */
export type EcraDoPedir = "onde" | "oque" | "destino" | "fotos" | "acesso" | "quando" | "contacto" | "resumo";

const PARTE_DO_ECRA: Record<EcraDoPedir, { passo: Rascunho["passo"]; campos: readonly string[] | null }> = {
  onde: { passo: 2, campos: ["morada"] },
  oque: { passo: 1, campos: ["servico", "movelModo", "itens", "volume", "acessoDoEspaco", "entulho", "entulhoModo", "sacos", "entulhoVolume", "tipologia", "descricao"] },
  destino: { passo: 2, campos: ["destino"] },
  fotos: { passo: 1, campos: ["fotos"] },
  acesso: { passo: 2, campos: ["acesso", "acessoDestino"] },
  quando: { passo: 3, campos: ["quando", "data"] },
  contacto: { passo: 3, campos: ["nif", "nome", "telefone"] },
  resumo: { passo: 3, campos: null },
};

export const ECRAS_DO_PEDIR: readonly EcraDoPedir[] = ["onde", "oque", "destino", "fotos", "acesso", "quando", "contacto", "resumo"];
const eEcra = (v: unknown): v is EcraDoPedir => typeof v === "string" && (ECRAS_DO_PEDIR as readonly string[]).includes(v);

/** Os ecrãs deste pedido, pela ordem: «Para onde vai?» só na mudança. */
export function ecrasDoPedir(r: Pick<Rascunho, "servico">, c: Catalogo): EcraDoPedir[] {
  const mudanca = detalhesDe(r, c) === "mudanca";
  return ECRAS_DO_PEDIR.filter((e) => e !== "destino" || mudanca);
}

/** O ecrã onde está (um rascunho dos três passos começa na primeira pergunta do passo). */
export function ecraDe(r: Pick<Rascunho, "ecra" | "passo" | "servico">, c: Catalogo): EcraDoPedir {
  const lista = ecrasDoPedir(r, c);
  if (eEcra(r.ecra) && lista.includes(r.ecra)) return r.ecra;
  return r.passo === 3 ? "quando" : "onde";
}

/** O passo do simulador a que o ecrã pertence (para o rascunho). */
export const passoDoEcra = (e: EcraDoPedir): Rascunho["passo"] => PARTE_DO_ECRA[e].passo;

/** O que falta neste ecrã. No resumo, tudo (os três passos). */
export function camposEmFaltaNoEcra(r: Rascunho, e: EcraDoPedir, c: Catalogo, agora: Date = new Date()): CampoEmFalta[] {
  const parte = PARTE_DO_ECRA[e];
  if (!parte.campos) return ([1, 2, 3] as const).flatMap((p) => camposEmFalta(r, p, c, agora));
  const campos = parte.campos;
  // Os ids das perguntas da categoria (d1) não estão nas listas: ficam no ecrã do passo deles («oque» ou «acesso»).
  const conhecidos = new Set(Object.values(PARTE_DO_ECRA).flatMap((x) => x.campos ?? []));
  const aqui = (campo: string) => campos.includes(campo) || (!conhecidos.has(campo) && (e === "oque" || e === "acesso"));
  return camposEmFalta(r, parte.passo, c, agora).filter((x) => aqui(x.campo));
}

/** A pergunta de cada ecrã — curta. */
export function perguntaDoEcra(e: EcraDoPedir, d: Detalhes | null, semAndarAqui = false): string {
  switch (e) {
    case "onde":
      return d === "mudanca" ? "De onde sai a mudança?" : "Onde é?";
    case "oque":
      return "O que precisa?";
    case "destino":
      return "Para onde vai?";
    case "fotos":
      return "Fotografias";
    case "acesso":
      return semAndarAqui ? "A carrinha fica perto?" : "Andar e elevador";
    case "quando":
      return "Quando precisa?";
    case "contacto":
      return "Os seus contactos";
    case "resumo":
      return "Confirme o pedido";
  }
}

/** O ecrã onde se altera uma linha do resumo. */
export function ecraDaLinha(l: { rotulo: string; passo: Rascunho["passo"] }): EcraDoPedir {
  if (l.rotulo === "Fotografias") return "fotos";
  if (l.rotulo === "Para" || l.rotulo === "Percurso") return "destino";
  if (l.rotulo === "Acesso" || l.rotulo === "Acesso no destino") return "acesso";
  if (l.rotulo === "De" || l.rotulo === "Morada") return "onde";
  if (l.rotulo === "Desmontagem" || l.passo === 1) return "oque";
  return "quando";
}

/* ─── O calendário, em Lisboa ─────────────────────────────────────────────── */

const DIAS_DA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Amanhã, em Lisboa — o primeiro dia que se pode escolher. */
export const primeiroDiaPossivel = (agora: Date): string => somarDiasAoDia(diaEmLisboa(agora), 1);

/** «sexta-feira, 30 de outubro» para um dia «AAAA-MM-DD» (ao meio-dia de Lisboa, para não escorregar). */
export function diaPorExtenso(dia: string): string {
  const p = pecasEmLisboa(new Date(`${dia}T12:00:00Z`));
  return `${DIAS_DA_SEMANA[p.diaDaSemana]}, ${p.dia} de ${MESES[p.mes - 1]}`;
}

/** Os dias que o calendário mostra: de amanhã (em Lisboa) em diante. Nunca hoje. */
export function diasParaEscolher(agora: Date, quantos: number = DIAS_NO_CALENDARIO): Array<{ dia: string; texto: string }> {
  const primeiro = primeiroDiaPossivel(agora);
  return Array.from({ length: quantos }, (_, i) => {
    const dia = somarDiasAoDia(primeiro, i);
    return { dia, texto: diaPorExtenso(dia) };
  });
}

/*
 * ─── O calendário do mês (02-11-2026, ordem do CEO com o sim do dono) ──────
 * «Escolher no calendário» é só outra forma de escolher o dia dos botões
 * rápidos: os mesmos limites (de amanhã, em Lisboa, a `DIAS_NO_CALENDARIO`
 * dias), a mesma `dataPreferida` para o site, o mesmo preço. Depois do dia, a
 * hora, de 30 em 30 minutos entre as 8h00 e as 20h00 de Lisboa.
 */

/** As horas que se podem escolher: «08:00», «08:30», … «20:00» (hora de Lisboa). */
export const HORAS_DO_CALENDARIO: readonly string[] = Array.from({ length: 25 }, (_, i) => {
  const minutos = 8 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
});

export const horaValida = (h: unknown): h is string => typeof h === "string" && HORAS_DO_CALENDARIO.includes(h);

/** «08:30» → «8h30», como se diz em Portugal. */
export function horaPorExtenso(h: string): string {
  const [hh, mm] = h.split(":");
  return `${Number(hh)}h${mm}`;
}

/** O último dia que se pode escolher (o mesmo dos botões rápidos). */
export const ultimoDiaPossivel = (agora: Date, quantos: number = DIAS_NO_CALENDARIO): string => somarDiasAoDia(primeiroDiaPossivel(agora), quantos - 1);

/** Pode-se escolher este dia? De amanhã (em Lisboa) ao último dia do calendário. */
export function diaPossivel(dia: string, agora: Date, quantos: number = DIAS_NO_CALENDARIO): boolean {
  return dia >= primeiroDiaPossivel(agora) && dia <= ultimoDiaPossivel(agora, quantos);
}

/** Os meses do calendário, «AAAA-MM»: do mês de amanhã ao mês do último dia possível. */
export function mesesDoCalendario(agora: Date, quantos: number = DIAS_NO_CALENDARIO): string[] {
  const primeiro = primeiroDiaPossivel(agora).slice(0, 7);
  const ultimo = ultimoDiaPossivel(agora, quantos).slice(0, 7);
  const meses: string[] = [];
  let [a, m] = primeiro.split("-").map(Number);
  for (;;) {
    const mes = `${a}-${String(m).padStart(2, "0")}`;
    meses.push(mes);
    if (mes >= ultimo || meses.length > 24) break;
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return meses;
}

/** «novembro de 2026» para «2026-11». */
export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** As iniciais dos dias, a começar à segunda-feira. */
export const DIAS_DA_SEMANA_DO_CALENDARIO = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

export type DiaDoCalendario = { dia: string; numero: number; possivel: boolean };

/**
 * As semanas do mês «AAAA-MM», de segunda a domingo, com `null` nos lugares
 * vazios. Contas de calendário (UTC ao meio-dia), sem relógio do telemóvel.
 */
export function semanasDoMes(mes: string, agora: Date, quantos: number = DIAS_NO_CALENDARIO): Array<Array<DiaDoCalendario | null>> {
  const [a, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const primeiroDaSemana = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7; // 0 = segunda
  const lugares: Array<DiaDoCalendario | null> = Array.from({ length: primeiroDaSemana }, () => null);
  for (let n = 1; n <= diasNoMes; n++) {
    const dia = `${mes}-${String(n).padStart(2, "0")}`;
    lugares.push({ dia, numero: n, possivel: diaPossivel(dia, agora, quantos) });
  }
  while (lugares.length % 7 !== 0) lugares.push(null);
  return Array.from({ length: lugares.length / 7 }, (_, i) => lugares.slice(i * 7, i * 7 + 7));
}

/**
 * A hora que vai ao site em `horaPreferida` («HH:MM» de Lisboa), ao lado da
 * `dataPreferida` — só numa data à escolha (02-11-2026). O site grava o dia e
 * a hora no mesmo campo que o backoffice mostra; antes ia uma linha na descrição.
 */
export function horaPreferidaDoPedido(r: Pick<Rascunho, "quando" | "data" | "hora">): string | undefined {
  return r.quando === "data" && r.data && horaValida(r.hora) ? r.hora : undefined;
}

/* ─── O resumo (passo 3) ──────────────────────────────────────────────────── */

const nomeDe = (lista: readonly Opcao[], id: string | undefined) => lista.find((o) => o.id === id)?.nome ?? null;

/** «3.º andar, elevador pequeno, estacionamento à porta» — como a maqueta do resumo. */
export function textoDoAcesso(a: Acesso): string | null {
  if (!a.floor) return null;
  const andar = a.floor === "rés-do-chão" ? "rés-do-chão" : `${nomeDe(ANDARES, a.floor)} andar`;
  const elevador =
    a.floor === "rés-do-chão" || !a.hasElevator
      ? null
      : a.hasElevator === "yes"
        ? "com elevador"
        : a.hasElevator === "small"
          ? "elevador pequeno"
          : a.hasElevator === "no"
            ? "sem elevador"
            : null;
  const est = a.parkingDistance ? `estacionamento ${(nomeDe(ESTACIONAMENTO, a.parkingDistance) ?? "").toLowerCase()}` : null;
  return [andar, elevador, est, a.difficultAccess ? "acesso difícil" : null].filter(Boolean).join(", ");
}

function linhasDosDetalhes(r: Rascunho, c: Catalogo): string[] {
  const d = detalhesDe(r, c);
  const linhas: string[] = [];
  // Garagem, sótão e cave (d5): as linhas que o simulador do site escreve, servidas pela R7.
  const e = espacoDe(r, c);
  if (e) {
    const q = e.quantidade.opcoes.find((o) => o.id === r.volume);
    const a = e.acesso.opcoes.find((o) => o.id === r.acessoDoEspaco);
    const coisas = linhaDasCoisasDoEspaco(e, r.coisasDoEspaco);
    return [q?.linha, a?.linha, coisas].filter((x): x is string => !!x);
  }
  if (d === "moveis" && r.movelModo === "item") {
    const partes = TAMANHOS_DOS_ITENS.filter((t) => (r.itens?.[t.id] ?? 0) > 0).map((t) => `${r.itens?.[t.id]} ${t.nome.toLowerCase()}`);
    if (partes.length > 0) linhas.push(`Itens: ${partes.join(", ")}.`);
  }
  if (pedeVolume(d, r) && r.volume) {
    const v = nomeDe(VOLUMES, r.volume);
    if (v) linhas.push(`Quantidade estimada: ${v}.`);
    if (inteiro(r.quantidadeExacta) > 0) linhas.push(`Quantidade exacta: ${inteiro(r.quantidadeExacta)}.`);
  }
  // Com as perguntas da categoria (d1), a linha do entulho escreve-a o site (`pedido-por-categoria.ts`).
  if (d === "entulho" && r.entulho && !perguntasDe(r, c)) {
    const e = nomeDe(c.entulho, r.entulho);
    if (e) linhas.push(`Entulho: ${e}.`);
    if (r.entulhoModo === "sacos" && sacosDoEntulho(r) > 0) {
      linhas.push(
        r.entulho === "misto"
          ? `Sacos: ${inteiro(r.ensacados)} em sacos e ${inteiro(r.porEnsacar)} por ensacar.`
          : `Sacos: ${sacosDoEntulho(r)}.`,
      );
    }
    if (r.entulhoModo === "volume" && r.entulhoVolume) linhas.push(`Volume: ${nomeDe(VOLUMES, r.entulhoVolume) ?? ""}.`);
    if (r.entulhoModo === "incerto") linhas.push("Quantidade: não tem a certeza.");
  }
  if (d === "mudanca" && r.tipologia) {
    const t = nomeDe(c.tipologias, r.tipologia);
    if (t) linhas.push(`Casa: ${t}.`);
  }
  return linhas;
}

export function textoDoQuando(r: Pick<Rascunho, "quando" | "data" | "hora">): string | null {
  if (r.quando === "data" && r.data) return horaValida(r.hora) ? `${diaPorExtenso(r.data)}, às ${horaPorExtenso(r.hora)}` : diaPorExtenso(r.data);
  return r.quando ? TEXTO_DO_QUANDO[r.quando] : null;
}

/** As respostas da categoria do ecrã «oque», escritas para o resumo (sem a desmontagem, que tem a linha dela). */
function respostasNoResumo(r: Rascunho, perguntas: readonly PerguntaDaApp[]): string[] {
  const respostas = respostasDoRascunho(r, perguntas);
  const l: string[] = [];
  for (const p of perguntasVisiveis(r, perguntas, "oque")) {
    if (p.id === "desmontagem" || p.id === "repeticao") continue;
    if (p.id.startsWith("itens.") && (numeroDaResposta(respostas[p.id]) ?? 0) === 0) continue;
    const t = respostaEscrita(p, respostas);
    if (t) l.push(p.id.startsWith("itens.") ? `${numeroDaResposta(respostas[p.id])} ${p.titulo.toLowerCase()}.` : `${t}.`);
  }
  return l;
}

/** As linhas do resumo, cada uma com o passo onde se altera. */
export function linhasDoResumo(r: Rascunho, c: Catalogo): Array<{ rotulo: string; texto: string; passo: Rascunho["passo"] }> {
  const d = detalhesDe(r, c);
  const mudanca = d === "mudanca";
  const fotos = r.fotos.filter((f) => f.estado === "enviada");
  const nFotos = fotos.filter((f) => !f.tipo?.startsWith("video/")).length;
  const nVideos = fotos.length - nFotos;
  const linhas: Array<{ rotulo: string; texto: string; passo: Rascunho["passo"] }> = [];
  const servico = servicoDe(r, c);
  if (servico) {
    const det = (servico.perguntas ? respostasNoResumo(r, servico.perguntas) : linhasDosDetalhes(r, c)).join(" ");
    linhas.push({ rotulo: "Serviço", texto: [servico.nome, det].filter(Boolean).join(" · "), passo: 1 });
  }
  const ficheiros = [
    nFotos > 0 ? `${nFotos} ${nFotos === 1 ? "fotografia" : "fotografias"}` : null,
    nVideos > 0 ? `${nVideos} ${nVideos === 1 ? "vídeo" : "vídeos"}` : null,
  ].filter(Boolean);
  linhas.push({ rotulo: "Fotografias", texto: ficheiros.length > 0 ? ficheiros.join(" e ") : "Nenhuma", passo: 1 });
  if (r.morada?.formattedAddress) linhas.push({ rotulo: mudanca ? "De" : "Morada", texto: r.morada.formattedAddress, passo: 2 });
  const acesso = textoDoAcesso(r.acesso);
  if (acesso) linhas.push({ rotulo: "Acesso", texto: acesso, passo: 2 });
  if (mudanca && r.destino?.formattedAddress) {
    linhas.push({ rotulo: "Para", texto: r.destino.formattedAddress, passo: 2 });
    const noDestino = textoDoAcesso(r.acessoDestino);
    if (noDestino) linhas.push({ rotulo: "Acesso no destino", texto: noDestino, passo: 2 });
    if (r.distanciaKm) linhas.push({ rotulo: "Percurso", texto: `${String(r.distanciaKm).replace(".", ",")} km`, passo: 2 });
  }
  if (r.desmontagem !== undefined) linhas.push({ rotulo: "Desmontagem", texto: r.desmontagem ? "Sim" : "Não", passo: 2 });
  const quando = textoDoQuando(r);
  if (quando) linhas.push({ rotulo: "Quando", texto: quando, passo: 3 });
  if (d === "manutencao" && r.repeticao && r.repeticao !== "pontual") {
    linhas.push({ rotulo: "Repetir", texto: nomeDe(REPETICAO, r.repeticao) ?? "", passo: 3 });
  }
  return linhas;
}

/* ─── O que vai para o site ───────────────────────────────────────────────── */

function moradaParaOSite(m: Morada | undefined) {
  if (!m) return undefined;
  return {
    formattedAddress: m.formattedAddress.trim(),
    street: m.street,
    streetNumber: m.streetNumber,
    city: m.city,
    postalCode: m.postalCode,
    lat: m.lat,
    lng: m.lng,
    placeId: m.placeId,
  };
}

function acessoParaOSite(a: Acesso) {
  return {
    floor: a.floor,
    hasElevator: a.floor === "rés-do-chão" ? undefined : a.hasElevator,
    parkingDistance: a.parkingDistance,
    difficultAccess: a.difficultAccess === true ? true : undefined,
    accessNotes: a.difficultAccess && a.accessNotes?.trim() ? a.accessNotes.trim().slice(0, 300) : undefined,
  };
}

/** O corpo do `POST /api/simulador/pedido`: os campos do simulador e os da app (S5, S14). */
export function corpoDoPedido(
  r: Rascunho,
  c: Catalogo,
  p: { emailDaSessao: string | null; rascunhosAntes: number },
): { order: Record<string, unknown> } {
  const d = detalhesDe(r, c);
  const e = espacoDe(r, c);
  const mudanca = d === "mudanca";
  const descricao = [...linhasDosDetalhes(r, c), r.descricao.trim()].filter(Boolean).join("\n");
  const ficheiros = r.fotos.filter((f) => f.estado === "enviada" && f.url);
  const valor = r.valorDesejado.trim();
  const order: Record<string, unknown> = {
    serviceType: r.servico,
    description: descricao,
    files: ficheiros.map((f, i) => {
      const tipo = f.tipo ?? "image/jpeg";
      return {
        id: String(i),
        url: f.url,
        name: f.nome ?? `${tipo.startsWith("video/") ? "video" : "fotografia"}-${i + 1}.${tipo.startsWith("video/") ? "mp4" : "jpg"}`,
        size: f.tamanho ?? 0,
        type: tipo.startsWith("video/") ? "video" : "image",
        mimeType: tipo,
      };
    }),
    urgency: r.quando ? URGENCIA[r.quando] : undefined,
    dataPreferida: r.quando === "data" ? r.data : undefined,
    horaPreferida: horaPreferidaDoPedido(r),
    receiver: {
      name: r.nome.trim(),
      phone: r.telefone.trim(),
      email: (p.emailDaSessao ?? "").trim().toLowerCase(),
    },
    valorDesejadoCliente: valor || undefined,
    precisaFatura: r.querNif,
    nifFactura: r.querNif ? r.nif.replace(/\s/g, "") : undefined,
    origemPedido: ORIGEM_DA_APP,
    rascunhosAntes: Math.max(0, Math.min(50, Math.floor(p.rascunhosAntes))),
  };
  if (d === "moveis") {
    order.movelMode = r.movelModo;
    if (r.movelModo === "item") {
      order.movelItemsPequeno = r.itens?.pequeno ?? 0;
      order.movelItemsMedio = r.itens?.medio ?? 0;
      order.movelItemsGrande = r.itens?.grande ?? 0;
    }
  }
  if (e) {
    // Os campos do simulador do site para a garagem, o sótão e a cave.
    if (r.volume) order.volumeTier = r.volume;
    if (r.acessoDoEspaco) order.acessoDoEspaco = r.acessoDoEspaco;
    if (r.coisasDoEspaco && r.coisasDoEspaco.length > 0) order.coisasDoEspaco = [...r.coisasDoEspaco];
  } else if (pedeVolume(d, r) && r.volume) {
    order.volumeTier = r.volume;
    if (inteiro(r.quantidadeExacta) > 0) order.quantityExact = String(inteiro(r.quantidadeExacta));
  }
  if (d === "entulho") {
    order.entulhoState = r.entulho;
    if (r.entulhoModo === "sacos") {
      order.entulhoQuantidade = String(sacosDoEntulho(r));
      if (r.entulho === "misto") {
        order.entulhoQuantidadeEnsacados = String(inteiro(r.ensacados));
        order.entulhoQuantidadePorEnsacar = String(inteiro(r.porEnsacar));
      }
    }
    if (r.entulhoModo === "volume") order.entulhoVolume = r.entulhoVolume;
    if (r.entulhoModo === "incerto") order.entulhoQuantidadeIncerta = true;
  }
  // Na garagem, no sótão e na cave a desmontagem não se pergunta (o simulador também não).
  if (r.desmontagem !== undefined && !e) order.needsDismantling = r.desmontagem ? "simple" : "no";
  if (d === "manutencao") order.recurrenceFrequency = r.repeticao === "semanal" || r.repeticao === "quinzenal" ? r.repeticao : null;
  if (mudanca) {
    order.tipologia = r.tipologia;
    order.originAddress = moradaParaOSite(r.morada);
    order.originAccess = acessoParaOSite(r.acesso);
    order.destinationAddress = moradaParaOSite(r.destino);
    order.destinationAccess = acessoParaOSite(r.acessoDestino);
    if (r.distanciaKm) order.movingDistance = { distanceKm: r.distanciaKm };
  } else {
    order.address = moradaParaOSite(r.morada);
    order.floor = semAndar(e) ? "rés-do-chão" : r.acesso.floor;
    order.hasElevator = semAndar(e) || r.acesso.floor === "rés-do-chão" ? undefined : r.acesso.hasElevator;
    order.parkingDistance = r.acesso.parkingDistance;
  }
  const perguntas = perguntasDe(r, c);
  if (perguntas) Object.assign(order, camposDasPerguntas(r, perguntas, d));
  if (ficheiros.length > 0) order.autorizaFotos = r.autorizaFotos === true;
  if (r.fotos.some((f) => f.estado === "falhou")) {
    order.fotosNaoEnviadas = r.fotos.filter((f) => f.estado === "falhou").length;
  }
  return { order };
}

/**
 * AS RESPOSTAS DA CATEGORIA NO PEDIDO (d1): pelos ids da R7, só as que
 * aparecem. O site faz delas os campos de sempre e as linhas da descrição
 * (`pedido-por-categoria.ts`) — por isso a app não as repete na descrição.
 */
function camposDasPerguntas(r: Rascunho, perguntas: readonly PerguntaDaApp[], d: Detalhes | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const respostas = respostasDoRascunho(r, perguntas);
  const visiveis = perguntasVisiveis(r, perguntas);
  const ids = new Set(visiveis.map((p) => p.id));
  for (const id of ["entulho", "tipoDeSaco", "quantidade", "ensacados", "porEnsacar", "entulhoVolume", "tipologia", "recheio", "tipoDeTrabalho", "quantoTrabalho", "materiais", "repeticao", "desmontagem"]) {
    if (!ids.has(id)) continue;
    const p = visiveis.find((x) => x.id === id)!;
    const v = respostas[id];
    if (!respostaServe(p, v)) continue;
    out[id] = p.tipo === "numero" ? numeroDaResposta(v) : v;
  }
  // A desmontagem só onde a R7 a pergunta.
  if (!ids.has("desmontagem")) out.needsDismantling = undefined;
  // O estado do entulho no campo de sempre (o site também lê `entulho`).
  if (d === "entulho" && typeof out.entulho === "string") out.entulhoState = out.entulho;
  return out;
}

/** «{n} fotografias não foram enviadas…» — só se alguma falhou. */
export function avisoDasFotografias(r: Rascunho): string | null {
  const n = r.fotos.filter((f) => f.estado === "falhou").length;
  if (n === 0) return null;
  return `${n} ${n === 1 ? "fotografia não foi enviada" : "fotografias não foram enviadas"}. O pedido segue sem ${
    n === 1 ? "ela" : "elas"
  }; pode juntá-${n === 1 ? "la" : "las"} depois pelo WhatsApp.`;
}

/* ─── A referência (R12, S13) ─────────────────────────────────────────────── */

/** `conta`: «Serviço / IVA / Total» da R12 (02-11-2026); sem ela, ficam as linhas. */
export type Referencia = {
  linhas: LinhaDePreco[];
  nota: string | null;
  conta?: PrecoEmTresLinhas | null;
  /** Porque é esta a estimativa (R12): linhas curtas, com a conta à vista (d4/d6, 03-11-2026). */
  porque?: string[];
};

/** O corpo da R12: só o que muda a referência — nada de contactos nem moradas. */
export function corpoDaReferencia(r: Rascunho, c: Catalogo): Record<string, unknown> | null {
  const d = detalhesDe(r, c);
  if (!d) return null;
  const perguntas = perguntasDe(r, c);
  if (perguntas) return corpoDaReferenciaPelasPerguntas(r, perguntas, d);
  const e = espacoDe(r, c);
  return {
    servico: r.servico,
    movelModo: d === "moveis" ? r.movelModo : undefined,
    itens: d === "moveis" && r.movelModo === "item" ? { ...r.itens } : undefined,
    // Garagem, sótão e cave (d5): o volume, o acesso e o estacionamento — a R12 decide o «acesso difícil».
    volume: e ? r.volume : undefined,
    acessoDoEspaco: e ? r.acessoDoEspaco : undefined,
    estacionamento: e ? r.acesso.parkingDistance : undefined,
    entulho:
      d === "entulho"
        ? { estado: r.entulho, modo: r.entulhoModo, sacos: r.entulhoModo === "sacos" ? sacosDoEntulho(r) : undefined, volume: r.entulhoVolume }
        : undefined,
    tipologia: d === "mudanca" ? r.tipologia : undefined,
    kmPercurso: d === "mudanca" && r.distanciaKm ? r.distanciaKm : undefined,
    origem: d === "mudanca" ? acessoParaOSite(r.acesso) : undefined,
    destino: d === "mudanca" ? acessoParaOSite(r.acessoDestino) : undefined,
    desmontagem: r.desmontagem,
  };
}

/**
 * O CORPO DA R12 PELAS PERGUNTAS (d1): as respostas que aparecem, pelos ids da
 * R7 (`itens.pequeno` → `itens: { pequeno }`, `origem.floor` → `origem: { floor }`),
 * a localidade, a descrição e quantas fotografias. A R12 lê tudo e diz porquê.
 */
function corpoDaReferenciaPelasPerguntas(r: Rascunho, perguntas: readonly PerguntaDaApp[], d: Detalhes): Record<string, unknown> {
  const respostas = respostasDoRascunho(r, perguntas);
  const corpo: Record<string, unknown> = { servico: r.servico };
  for (const p of perguntasVisiveis(r, perguntas)) {
    const v = respostas[p.id];
    if (!respostaServe(p, v)) continue;
    const valor = p.tipo === "numero" ? numeroDaResposta(v) : v;
    if (p.id.includes(".")) {
      const [grupo, campo] = p.id.split(".");
      const antes = (corpo[grupo] ?? {}) as Record<string, unknown>;
      corpo[grupo] = { ...antes, [campo]: valor };
    } else corpo[p.id] = valor;
  }
  if (d === "mudanca" && r.distanciaKm) corpo.kmPercurso = r.distanciaKm;
  if (r.morada?.city?.trim()) corpo.localidade = r.morada.city.trim();
  if (r.descricao.trim()) corpo.descricao = r.descricao.trim();
  const fotos = r.fotos.filter((f) => f.estado === "enviada").length;
  if (fotos > 0) corpo.fotografias = fotos;
  return corpo;
}

/** A resposta da R12, ou `null`. Uma linha sem o valor com IVA não serve (critério 35). */
export function referenciaValida(v: unknown): Referencia | null {
  const o = (v ?? {}) as { linhas?: unknown; nota?: unknown; conta?: unknown; porque?: unknown };
  if (!Array.isArray(o.linhas)) return null;
  const linhas = o.linhas
    .map((l) => {
      const x = (l ?? {}) as Record<string, unknown>;
      const t = texto(x.texto);
      return t ? { rotulo: texto(x.rotulo) ?? "", texto: t } : null;
    })
    .filter((l): l is LinhaDePreco => !!l && /com\s+iva/i.test(l.texto));
  /*
   * O porquê: todas as linhas da R12, também as da conta com euros («50 sacos ×
   * 4,00–4,80 € = 200–240 € + IVA», «2.º andar com elevador: +10 € + IVA») —
   * d4/d6, 03-11-2026, como o simulador do site. Fora só o que nunca se oferece.
   */
  const porque = Array.isArray(o.porque)
    ? o.porque.map((x) => texto(x)).filter((x): x is string => !!x && x.length <= 200 && !/contentor|pr[óo]prio dia/i.test(x)).slice(0, MAXIMO_DO_PORQUE)
    : [];
  return linhas.length > 0 ? { linhas, nota: texto(o.nota), conta: precoEmTresLinhasValido(o.conta), ...(porque.length > 0 ? { porque } : {}) } : null;
}

/** Quantas linhas do porquê se mostram, no máximo (uma por tamanho de peça, a quantidade, o andar, o estacionamento…). */
export const MAXIMO_DO_PORQUE = 10;

/** O corpo do pedido de empresa (o mesmo cartão do simulador do site). */
export function corpoDaEmpresa(e: { empresa: string; email: string; telefone: string; mensagem: string }) {
  return {
    empresa: e.empresa.trim(),
    email: e.email.trim().toLowerCase(),
    telefone: e.telefone.trim() || undefined,
    mensagem: e.mensagem.trim(),
    pagePath: "app-cliente",
  };
}
