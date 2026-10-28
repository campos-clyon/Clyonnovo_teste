import { diaEmLisboa, pecasEmLisboa, somarDiasAoDia } from "../../../src/lib/hora-de-lisboa";

/**
 * O NOVO PEDIDO (E3) — o que a app pergunta e o que manda ao site.
 *
 * O pedido segue pela mesma rota do simulador (`POST /api/simulador/pedido`),
 * com os mesmos campos, mais os da app (S5): `origemPedido: "app_cliente"`,
 * `dataPreferida` («AAAA-MM-DD», de amanhã em diante, em Lisboa) e
 * `rascunhosAntes` (só um número, para a medida do E3). Os serviços, as opções
 * do entulho e das casas, as etiquetas do valor e a frase única vêm do
 * catálogo (`GET /api/cliente/catalogo`, R7): a app não tem lista própria.
 *
 * Sem «Hoje» (regra 4): nem nas opções, nem no calendário — que começa amanhã
 * EM LISBOA, e não no relógio do telemóvel. Sem big bags nem contentores: se o
 * catálogo trouxesse uma opção dessas, a app deitava-a fora.
 *
 * Puro de propósito: os testes do site importam-no.
 */

export const ROTA_DO_CATALOGO = "/api/cliente/catalogo";
export const ROTA_DO_ENVIO = "/api/simulador/pedido";
export const ORIGEM_DA_APP = "app_cliente";
export const MINIMO_DA_DESCRICAO = 10;
export const MAXIMO_DE_FOTOGRAFIAS = 20;
export const DIAS_NO_CALENDARIO = 90;

/* ─── O catálogo (R7) ─────────────────────────────────────────────────────── */

export type Detalhes = "moveis" | "monos" | "entulho" | "esvaziamento" | "mudanca";
export type Opcao = { id: string; nome: string };
export type Quando = "amanha" | "esta_semana" | "data" | "flexivel";

export type Catalogo = {
  servicos: Array<{ id: string; nome: string; detalhes: Detalhes }>;
  entulho: Opcao[];
  tipologias: Opcao[];
  quando: Quando[];
  textos: {
    fraseUnica: string;
    subtituloInicial: string | null;
    valorDesejadoEtiqueta: string | null;
    valorDesejadoAjuda: string | null;
    semFotos: string | null;
  };
  ficheiros: { maximo: number; tipos: string[] };
  whatsapp: string | null;
};

const DETALHES: readonly Detalhes[] = ["moveis", "monos", "entulho", "esvaziamento", "mudanca"];
const QUANDO: readonly Quando[] = ["amanha", "esta_semana", "data", "flexivel"];
/** O que nunca se oferece, venha de onde vier (regra 4). */
const PROIBIDO = /big[\s_-]?bag|contentor|\bhoje\b|today|pr[óo]prio dia/i;

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

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

/** O catálogo da R7, com a forma certa, ou `null` (a app não pede sem ele). */
export function catalogoValido(v: unknown): Catalogo | null {
  const c = (v ?? {}) as Record<string, unknown>;
  const t = (c.textos ?? {}) as Record<string, unknown>;
  const fraseUnica = texto(t.fraseUnica);
  if (!Array.isArray(c.servicos) || !fraseUnica) return null;
  const servicos = c.servicos
    .map((s) => {
      const r = (s ?? {}) as { id?: unknown; nome?: unknown; detalhes?: unknown };
      const id = texto(r.id);
      const nome = texto(r.nome);
      const detalhes = DETALHES.find((d) => d === r.detalhes);
      return id && nome && detalhes ? { id, nome, detalhes } : null;
    })
    .filter((s): s is Catalogo["servicos"][number] => !!s && !PROIBIDO.test(s.nome));
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
    },
    ficheiros: {
      maximo: typeof f.maximo === "number" && f.maximo > 0 ? Math.min(f.maximo, MAXIMO_DE_FOTOGRAFIAS) : MAXIMO_DE_FOTOGRAFIAS,
      tipos: Array.isArray(f.tipos) ? f.tipos.filter((x): x is string => typeof x === "string") : [],
    },
    whatsapp: texto(c.whatsapp),
  };
}

/* ─── As opções fixas do formulário (as do simulador) ─────────────────────── */

export const TEXTO_DO_QUANDO: Readonly<Record<Quando, string>> = {
  amanha: "Amanhã",
  esta_semana: "Esta semana",
  data: "Numa data à escolha",
  flexivel: "Sou flexível",
};

/** O `urgency` que o simulador grava. Numa data à escolha, vai a `dataPreferida` e não o `urgency`. */
const URGENCIA: Readonly<Record<Quando, string | undefined>> = {
  amanha: "tomorrow",
  esta_semana: "this_week",
  data: undefined,
  flexivel: "flexible",
};

export const ANDARES: readonly Opcao[] = [
  { id: "rés-do-chão", nome: "Rés-do-chão" },
  { id: "1º", nome: "1.º andar" },
  { id: "2º", nome: "2.º andar" },
  { id: "3º", nome: "3.º andar" },
  { id: "4º+", nome: "4.º andar ou acima" },
];

export const ELEVADOR: readonly Opcao[] = [
  { id: "yes", nome: "Sim" },
  { id: "small", nome: "Pequeno" },
  { id: "no", nome: "Não" },
  { id: "unknown", nome: "Não sei" },
];

export const ESTACIONAMENTO: readonly Opcao[] = [
  { id: "door", nome: "À porta" },
  { id: "under_20m", nome: "A menos de 20 m" },
  { id: "over_30m", nome: "A mais de 30 m" },
  { id: "difficult", nome: "Difícil" },
  { id: "unknown", nome: "Não sei" },
];

export const VOLUMES: readonly Opcao[] = [
  { id: "carrinha", nome: "Enche uma carrinha" },
  { id: "camiao_caixa", nome: "Enche a caixa de um camião" },
  { id: "camiao_lixo", nome: "Enche um camião" },
  { id: "incerto", nome: "Não sei" },
];

export const TAMANHOS_DOS_ITENS: ReadonlyArray<{ id: "pequeno" | "medio" | "grande"; nome: string; exemplos: string }> = [
  { id: "pequeno", nome: "Pequenos", exemplos: "Micro-ondas, forno, mesinha de cabeceira" },
  { id: "medio", nome: "Médios", exemplos: "Fogão, frigorífico bar, cadeirão" },
  { id: "grande", nome: "Grandes", exemplos: "Sofá, armário, frigorífico, máquina de lavar" },
];

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

export type Acesso = { floor?: string; hasElevator?: string; parkingDistance?: string };

export type FotografiaDoPedido = {
  uri: string;
  estado: "a-enviar" | "enviada" | "falhou";
  url?: string;
  nome?: string;
  tamanho?: number;
  tipo?: string;
};

export type Rascunho = {
  passo: 1 | 2 | 3 | 4;
  servico?: string;
  movelModo?: "item" | "carga";
  itens?: { pequeno: number; medio: number; grande: number };
  volume?: string;
  entulho?: string;
  tipologia?: string;
  descricao: string;
  morada?: Morada;
  acesso: Acesso;
  destino?: Morada;
  acessoDestino: Acesso;
  distanciaKm?: number;
  fotos: FotografiaDoPedido[];
  /** Já disse que segue sem fotografias. */
  semFotosAceite?: boolean;
  quando?: Quando;
  data?: string;
  valorDesejado: string;
  querNif: boolean;
  nif: string;
  nome: string;
  telefone: string;
  email: string;
};

export function rascunhoVazio(): Rascunho {
  return { passo: 1, descricao: "", acesso: {}, acessoDestino: {}, fotos: [], valorDesejado: "", querNif: false, nif: "", nome: "", telefone: "", email: "" };
}

/** Um rascunho guardado que ainda tem a forma certa (as fotografias por enviar não voltam: o envio parou). */
export function rascunhoValido(v: unknown): Rascunho | null {
  const r = v as Partial<Rascunho> | null;
  if (!r || typeof r !== "object" || typeof r.descricao !== "string" || ![1, 2, 3, 4].includes(r.passo as number)) return null;
  const base = rascunhoVazio();
  return {
    ...base,
    ...r,
    acesso: { ...(r.acesso ?? {}) },
    acessoDestino: { ...(r.acessoDestino ?? {}) },
    fotos: Array.isArray(r.fotos) ? r.fotos.filter((f) => f && f.estado === "enviada" && typeof f.url === "string") : [],
  } as Rascunho;
}

export function detalhesDe(r: Rascunho, c: Catalogo): Detalhes | null {
  return c.servicos.find((s) => s.id === r.servico)?.detalhes ?? null;
}

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const totalDeItens = (r: Rascunho) => (r.itens?.pequeno ?? 0) + (r.itens?.medio ?? 0) + (r.itens?.grande ?? 0);
const acessoCompleto = (a: Acesso) =>
  !!a.floor && (a.floor === "rés-do-chão" || !!a.hasElevator) && !!a.parkingDistance;

/** O que falta para passar deste passo — a frase, ou `null`. */
export function faltaNoPasso(r: Rascunho, passo: 1 | 2 | 3 | 4, c: Catalogo, comSessao: boolean): string | null {
  if (passo === 1) {
    const d = detalhesDe(r, c);
    if (!d) return "Escolha o que precisa.";
    if (d === "moveis" && !r.movelModo) return "Diga como prefere indicar os móveis.";
    if (d === "moveis" && r.movelModo === "item" && totalDeItens(r) === 0) return "Indique pelo menos um item.";
    if ((d === "monos" || d === "esvaziamento" || (d === "moveis" && r.movelModo === "carga")) && !r.volume) {
      return "Diga quanto há para levar.";
    }
    if (d === "entulho" && !r.entulho) return "Diga como está o entulho.";
    if (d === "mudanca" && !r.tipologia) return "Diga o tamanho da casa.";
    if (r.descricao.trim().length < MINIMO_DA_DESCRICAO) return "Descreva o que há para levar (pelo menos 10 letras).";
    return null;
  }
  if (passo === 2) {
    const mudanca = detalhesDe(r, c) === "mudanca";
    if (!r.morada?.formattedAddress?.trim()) return mudanca ? "Escreva a morada de origem." : "Escreva a morada.";
    if (!acessoCompleto(r.acesso)) return "Diga o andar, o elevador e o estacionamento.";
    if (mudanca && !r.destino?.formattedAddress?.trim()) return "Escreva a morada de destino.";
    if (mudanca && !acessoCompleto(r.acessoDestino)) return "Diga o andar, o elevador e o estacionamento no destino.";
    return null;
  }
  if (passo === 3) {
    if (r.fotos.some((f) => f.estado === "a-enviar")) return "Espere que as fotografias acabem de seguir.";
    return null;
  }
  if (!r.quando) return "Diga quando precisa.";
  if (r.quando === "data" && !r.data) return "Escolha o dia.";
  if (r.quando === "data" && r.data && r.data < primeiroDiaPossivel(new Date())) return "Escolha um dia a partir de amanhã.";
  if (!r.nome.trim()) return "Escreva o seu nome.";
  if (!r.telefone.trim()) return "Escreva o seu telemóvel.";
  if (!comSessao && !emailValido(r.email)) return "Escreva o seu email.";
  if (r.querNif && !/^\d{9}$/.test(r.nif.replace(/\s/g, ""))) return "O NIF tem 9 algarismos.";
  return null;
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

/* ─── O que vai para o site ───────────────────────────────────────────────── */

function linhasDosDetalhes(r: Rascunho, c: Catalogo): string[] {
  const d = detalhesDe(r, c);
  const linhas: string[] = [];
  if (d === "moveis" && r.movelModo === "item") {
    const partes = TAMANHOS_DOS_ITENS.filter((t) => (r.itens?.[t.id] ?? 0) > 0).map(
      (t) => `${r.itens?.[t.id]} ${t.nome.toLowerCase()}`,
    );
    if (partes.length > 0) linhas.push(`Itens: ${partes.join(", ")}.`);
  }
  if (r.volume) {
    const v = VOLUMES.find((x) => x.id === r.volume);
    if (v) linhas.push(`Quantidade estimada: ${v.nome}.`);
  }
  if (d === "entulho" && r.entulho) {
    const e = c.entulho.find((x) => x.id === r.entulho);
    if (e) linhas.push(`Entulho: ${e.nome}.`);
  }
  if (d === "mudanca" && r.tipologia) {
    const t = c.tipologias.find((x) => x.id === r.tipologia);
    if (t) linhas.push(`Casa: ${t.nome}.`);
  }
  return linhas;
}

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

/** O corpo do `POST /api/simulador/pedido`: os campos do simulador e os da app (S5). */
export function corpoDoPedido(
  r: Rascunho,
  c: Catalogo,
  p: { emailDaSessao: string | null; rascunhosAntes: number },
): { order: Record<string, unknown> } {
  const d = detalhesDe(r, c);
  const mudanca = d === "mudanca";
  const descricao = [...linhasDosDetalhes(r, c), r.descricao.trim()].filter(Boolean).join("\n");
  const fotos = r.fotos.filter((f) => f.estado === "enviada" && f.url);
  const valor = r.valorDesejado.trim();
  const order: Record<string, unknown> = {
    serviceType: r.servico,
    description: descricao,
    files: fotos.map((f, i) => ({
      id: String(i),
      url: f.url,
      name: f.nome ?? `fotografia-${i + 1}.jpg`,
      size: f.tamanho ?? 0,
      type: f.tipo ?? "image/jpeg",
      mimeType: f.tipo ?? "image/jpeg",
    })),
    urgency: r.quando ? URGENCIA[r.quando] : undefined,
    dataPreferida: r.quando === "data" ? r.data : undefined,
    receiver: {
      name: r.nome.trim(),
      phone: r.telefone.trim(),
      email: (p.emailDaSessao ?? r.email).trim().toLowerCase(),
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
  if (r.volume && d !== "entulho" && d !== "mudanca") order.volumeTier = r.volume;
  if (d === "entulho") order.entulhoState = r.entulho;
  if (mudanca) {
    order.tipologia = r.tipologia;
    order.originAddress = moradaParaOSite(r.morada);
    order.originAccess = { ...r.acesso };
    order.destinationAddress = moradaParaOSite(r.destino);
    order.destinationAccess = { ...r.acessoDestino };
    if (r.distanciaKm) order.movingDistance = { distanceKm: r.distanciaKm };
  } else {
    order.address = moradaParaOSite(r.morada);
    order.floor = r.acesso.floor;
    order.hasElevator = r.acesso.floor === "rés-do-chão" ? undefined : r.acesso.hasElevator;
    order.parkingDistance = r.acesso.parkingDistance;
    if (r.distanciaKm) order.distanceFromBase = { distanceKm: r.distanciaKm };
  }
  if (r.fotos.some((f) => f.estado === "falhou")) {
    order.fotosNaoEnviadas = r.fotos.filter((f) => f.estado === "falhou").length;
  }
  return { order };
}

/** «{n} fotografias não foram enviadas…» — só se alguma falhou. */
export function avisoDasFotografias(r: Rascunho): string | null {
  const n = r.fotos.filter((f) => f.estado === "falhou").length;
  if (n === 0) return null;
  return `${n} ${n === 1 ? "fotografia não foi enviada" : "fotografias não foram enviadas"}. O pedido segue sem ${
    n === 1 ? "ela" : "elas"
  }; pode juntá-${n === 1 ? "la" : "las"} depois pelo WhatsApp.`;
}
