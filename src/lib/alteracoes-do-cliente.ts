import { quandoEmLisboa } from "./pedido-para-a-app";
import { lerDataPreferida } from "./pedido-da-app-de-cliente";
import { urlDeAnexoPermitido } from "./url-externo-seguro";

/**
 * AS ALTERAÇÕES DO CLIENTE — 29-10-2026 (S17; P11 (a); regras R14, R17–R19 da
 * Segurança). Puro: o que se pode mudar, em que fase, e a leitura do corpo.
 *
 *   · À espera da análise (ainda não foi aos profissionais): aplica-se logo.
 *   · Enviado, sem trabalho contratado: fica à espera da Mesa («Aplicar» /
 *     «Não aplicar»). Num Trabalho CLYON, até o preço ser aceite.
 *   · Contratado (ou o preço da CLYON aceite): não se altera pela app; fala com
 *     o profissional (ou com a CLYON).
 *   · Concluído ou cancelado: nada.
 *
 * Uma de cada vez. Lista FECHADA de campos: um campo que não esteja nela
 * recusa o pedido inteiro (422). Os pormenores juntam-se À PARTE — nunca
 * reescrevem a descrição e não entram no modelo que a escreve.
 */

export const CAMPOS_QUE_SE_ALTERAM = [
  "quando",
  "dataPreferida",
  "fotografias",
  "pormenores",
  "acesso",
  "acessoDestino",
  "desmontagem",
] as const;
export type CampoQueSeAltera = (typeof CAMPOS_QUE_SE_ALTERAM)[number];

export type FaseDaAlteracao = "analise" | "enviado" | "contratado" | "fechado";

export const TEXTOS_DA_ALTERACAO = {
  aplicada: "Alteração guardada. A CLYON revê o pedido antes de o enviar aos profissionais.",
  pedida:
    "Alteração enviada à CLYON. Os profissionais que já fizeram proposta podem ter de a rever; a CLYON diz-lhe quando estiver aplicada.",
  jaHaUma: "Já tem uma alteração à espera da CLYON.",
  fechado: "Este pedido já não se altera.",
  sempre: "Para mudar a morada, o serviço ou os seus contactos, fale com a CLYON pelo WhatsApp.",
  campoNaoPermitido: "Isso não se muda por aqui. Para mudar a morada, o serviço ou os seus contactos, fale com a CLYON pelo WhatsApp.",
} as const;

export function contratadoTexto(nome: string | null | undefined): string {
  const n = (nome ?? "").trim() || "o profissional";
  return `O trabalho já está combinado com ${n}. Para mudar o dia ou acrescentar alguma coisa, fale com ${n}.`;
}

export const aEsperaTexto = (em: Date | string | null | undefined) =>
  `A CLYON está a rever a alteração que pediu a ${quandoEmLisboa(em ?? null) ?? "pouco"}.`;

export function faseDaAlteracao(p: {
  status: unknown;
  canceladoPeloCliente?: unknown;
  trabalhoClyon: boolean;
  precoAceite: boolean;
  contratado: boolean;
  enviado: boolean;
}): FaseDaAlteracao {
  const s = String(p.status ?? "");
  if (["cancelado", "rejeitado", "arquivado", "concluido"].includes(s) || Number(p.canceladoPeloCliente) === 1) return "fechado";
  if (p.contratado || (p.trabalhoClyon && p.precoAceite)) return "contratado";
  if (p.enviado || p.trabalhoClyon) return "enviado";
  return "analise";
}

/** O bloco `alteracoes` da R5. */
export function alteracoesParaAApp(c: {
  fase: FaseDaAlteracao;
  mudanca: boolean;
  pendenteEm: Date | string | null | undefined;
  contratadoCom?: string | null;
}) {
  const pendente = c.pendenteEm ? { quandoTexto: quandoEmLisboa(c.pendenteEm) ?? "", texto: aEsperaTexto(c.pendenteEm) } : null;
  const pode = (c.fase === "analise" || c.fase === "enviado") && !pendente;
  return {
    pode,
    campos: pode ? CAMPOS_QUE_SE_ALTERAM.filter((k) => c.mudanca || k !== "acessoDestino") : [],
    pendente,
    texto: c.fase === "contratado" ? contratadoTexto(c.contratadoCom) : c.fase === "fechado" ? TEXTOS_DA_ALTERACAO.fechado : TEXTOS_DA_ALTERACAO.sempre,
  };
}

export type Acesso = { floor?: string; hasElevator?: string; parkingDistance?: string };
export type AlteracaoLida = {
  quando?: "tomorrow" | "this_week" | "flexible";
  dataPreferida?: string;
  fotografias?: string[];
  pormenores?: string;
  acesso?: Acesso;
  acessoDestino?: Acesso;
  desmontagem?: boolean;
};

const QUANDO: Record<string, AlteracaoLida["quando"]> = {
  amanha: "tomorrow",
  tomorrow: "tomorrow",
  esta_semana: "this_week",
  this_week: "this_week",
  flexivel: "flexible",
  flexible: "flexible",
};
const ANDAR = /^(r[ée]s-do-ch[ãa]o|moradia|cave|-?\d{1,2})$/i;
const ELEVADOR = new Set(["yes", "no", "small"]);
const ESTACIONAMENTO = /^[a-z0-9_-]{1,30}$/i;

function lerAcesso(v: unknown): Acesso | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!["floor", "hasElevator", "parkingDistance"].includes(k)) return null;
  const a: Acesso = {};
  if (o.floor !== undefined) {
    if (typeof o.floor !== "string" || !ANDAR.test(o.floor.trim())) return null;
    a.floor = o.floor.trim();
  }
  if (o.hasElevator !== undefined) {
    if (typeof o.hasElevator !== "string" || !ELEVADOR.has(o.hasElevator)) return null;
    a.hasElevator = o.hasElevator;
  }
  if (o.parkingDistance !== undefined) {
    if (typeof o.parkingDistance !== "string" || !ESTACIONAMENTO.test(o.parkingDistance)) return null;
    a.parkingDistance = o.parkingDistance;
  }
  return Object.keys(a).length ? a : null;
}

/** Tecto de ficheiros por pedido, a contar com os de origem (R18). */
export const MAXIMO_DE_FOTOGRAFIAS = 20;
export const MAXIMO_DE_VIDEOS = 3;

/**
 * Lê o corpo da R13. `{ erro: 422 }` se vier um campo fora da lista, um valor
 * mal formado ou nada para mudar (R14).
 */
export function lerAlteracao(corpo: unknown, agora: Date = new Date()): { ok: true; alteracao: AlteracaoLida } | { ok: false; erro: string } {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { ok: false, erro: TEXTOS_DA_ALTERACAO.campoNaoPermitido };
  const c = corpo as Record<string, unknown>;
  for (const k of Object.keys(c)) {
    // `token` e `pedidoId` dizem que pedido é (o site), não o que muda.
    if (k === "token" || k === "pedidoId") continue;
    if (!(CAMPOS_QUE_SE_ALTERAM as readonly string[]).includes(k)) return { ok: false, erro: TEXTOS_DA_ALTERACAO.campoNaoPermitido };
  }
  const a: AlteracaoLida = {};
  if (c.quando !== undefined) {
    const q = typeof c.quando === "string" ? QUANDO[c.quando] : undefined;
    if (!q) return { ok: false, erro: "Escolha quando: amanhã, esta semana ou com flexibilidade." };
    a.quando = q;
  }
  if (c.dataPreferida !== undefined) {
    const d = lerDataPreferida(c.dataPreferida, agora);
    if (!d.ok || !d.dia) return { ok: false, erro: d.ok ? "Escolha um dia." : d.erro };
    const dias = (Date.parse(`${d.dia}T12:00:00Z`) - agora.getTime()) / 86_400_000;
    if (dias > 180) return { ok: false, erro: "Escolha um dia nos próximos 6 meses." };
    a.dataPreferida = d.dia;
  }
  if (c.fotografias !== undefined) {
    if (!Array.isArray(c.fotografias) || c.fotografias.length === 0 || c.fotografias.length > 10) {
      return { ok: false, erro: "Fotografias inválidas." };
    }
    const urls: string[] = [];
    for (const f of c.fotografias) {
      const u = urlDeAnexoPermitido(typeof f === "string" ? f : (f as { url?: unknown } | null)?.url);
      if (!u) return { ok: false, erro: "Fotografias inválidas." };
      urls.push(u);
    }
    a.fotografias = urls;
  }
  if (c.pormenores !== undefined) {
    const t = typeof c.pormenores === "string" ? c.pormenores.replace(/\s+/g, " ").trim() : "";
    if (!t || t.length > 1000) return { ok: false, erro: "Escreva os pormenores (até 1000 letras)." };
    a.pormenores = t;
  }
  if (c.acesso !== undefined) {
    const v = lerAcesso(c.acesso);
    if (!v) return { ok: false, erro: "O acesso não está bem preenchido." };
    a.acesso = v;
  }
  if (c.acessoDestino !== undefined) {
    const v = lerAcesso(c.acessoDestino);
    if (!v) return { ok: false, erro: "O acesso do destino não está bem preenchido." };
    a.acessoDestino = v;
  }
  if (c.desmontagem !== undefined) {
    if (typeof c.desmontagem !== "boolean") return { ok: false, erro: "Diga se é preciso desmontar." };
    a.desmontagem = c.desmontagem;
  }
  if (Object.keys(a).length === 0) return { ok: false, erro: "Diga o que quer mudar." };
  return { ok: true, alteracao: a };
}

const ELEVADOR_EM_PALAVRAS: Record<string, string> = { yes: "com elevador", no: "sem elevador", small: "com elevador pequeno" };

/** O que mudou, numa frase — para o histórico, a Mesa e o aviso ao contacto. */
export function oQueMudou(a: AlteracaoLida): string {
  const partes: string[] = [];
  if (a.dataPreferida) partes.push(`o dia para ${a.dataPreferida.split("-").reverse().join("/")}`);
  else if (a.quando) partes.push(`quando: ${a.quando === "tomorrow" ? "amanhã" : a.quando === "this_week" ? "esta semana" : "com flexibilidade"}`);
  if (a.fotografias) partes.push(a.fotografias.length === 1 ? "1 fotografia nova" : `${a.fotografias.length} fotografias novas`);
  if (a.pormenores) partes.push("pormenores novos");
  const acesso = (x: Acesso | undefined, onde: string) => {
    if (!x) return;
    const t = [x.floor ? `andar ${x.floor}` : null, x.hasElevator ? ELEVADOR_EM_PALAVRAS[x.hasElevator] : null, x.parkingDistance ? "estacionamento" : null]
      .filter(Boolean)
      .join(", ");
    partes.push(`o acesso${onde} (${t})`);
  };
  acesso(a.acesso, "");
  acesso(a.acessoDestino, " do destino");
  if (a.desmontagem !== undefined) partes.push(a.desmontagem ? "é preciso desmontar" : "não é preciso desmontar");
  return partes.join("; ");
}

/** O aviso ao contacto do pedido quando a alteração foi feita pelo link (G5). */
export function avisoDaAlteracaoAoContacto(pedidoId: number, oQue: string): string {
  return `O pedido #${pedidoId} foi alterado: ${oQue}. Não reconhece esta alteração? Responda a esta mensagem.`;
}
