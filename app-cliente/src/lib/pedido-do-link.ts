/**
 * O LINK DE UM PEDIDO — R10 v3 (S16) e as regras do convidado que não
 * dependem do telemóvel (A9, preparado a 29-10-2026; regras da Segurança, D3).
 *
 * SEM CONTA, a app manda `{ token, codigoDoAparelho }` sem Bearer e a R10 v3
 * responde:
 *   convidado        → { id, sessaoDoPedido, expiraEm } — o pedido abre na app;
 *   temConta         → { emailMascarado } — entrar com essa conta;
 *   muitosAparelhos  → nada do pedido (nem id, nem serviço) — o 4.º telemóvel;
 *   404 / 410        → como hoje.
 * Enquanto a S16 não está no ar, a rota recusa sem sessão (401): a app mostra
 * o ecrã de hoje («Entre para acompanhar este pedido aqui»).
 *
 * COM CONTA, como hoje: seu, semEmail (juntar), outroEmail.
 *
 * Puro de propósito: os testes do site importam-no.
 */

export type SessaoDeConvidado = {
  pedidoId: number;
  sessao: string;
  expiraEm: string;
  servico: string | null;
  cidade: string | null;
  /** Quantas vezes se abriu este pedido na app (a folha D4.6 só na 2.ª). */
  aberturas?: number;
  /** Quando se mostrou a folha «Guarde este pedido na sua conta» (não volta antes de 7 dias). */
  folhaEm?: string | null;
};

export type RespostaSemConta =
  | { estado: "convidado"; sessao: SessaoDeConvidado }
  | { estado: "temConta"; emailMascarado: string | null }
  | { estado: "muitosAparelhos" }
  | { estado: "desconhecida" };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A resposta da R10 v3 sem conta, na forma da app. Uma sessão sem id ou sem chave não serve. */
export function lerRespostaSemConta(v: unknown, agora: Date = new Date()): RespostaSemConta {
  const o = (v ?? {}) as Record<string, unknown>;
  if (o.estado === "muitosAparelhos") return { estado: "muitosAparelhos" };
  if (o.estado === "temConta") return { estado: "temConta", emailMascarado: texto(o.emailMascarado) };
  if (o.estado === "convidado") {
    const id = typeof o.id === "number" ? o.id : Number(o.id);
    const sessao = texto(o.sessaoDoPedido);
    const expira = texto(o.expiraEm);
    // A sessão nunca dura mais do que o link: 30 dias (DIAS_DE_VALIDADE).
    const limite = new Date(agora.getTime() + 30 * 24 * 3600_000);
    const fim = expira && !Number.isNaN(Date.parse(expira)) ? new Date(Math.min(Date.parse(expira), limite.getTime())) : limite;
    if (Number.isInteger(id) && id > 0 && sessao) {
      return {
        estado: "convidado",
        sessao: { pedidoId: id, sessao, expiraEm: fim.toISOString(), servico: texto(o.servico), cidade: texto(o.cidade), aberturas: 0, folhaEm: null },
      };
    }
  }
  return { estado: "desconhecida" };
}

/** As sessões guardadas que ainda valem (bem formadas e por expirar). */
export function sessoesValidas(v: unknown, agora: Date = new Date()): SessaoDeConvidado[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (s): s is SessaoDeConvidado =>
      !!s &&
      typeof s === "object" &&
      Number.isInteger((s as SessaoDeConvidado).pedidoId) &&
      typeof (s as SessaoDeConvidado).sessao === "string" &&
      typeof (s as SessaoDeConvidado).expiraEm === "string" &&
      Date.parse((s as SessaoDeConvidado).expiraEm) > agora.getTime(),
  );
}

const SETE_DIAS_MS = 7 * 24 * 3600_000;

/** A folha D4.6: na 2.ª abertura (ou depois), no máximo uma vez a cada 7 dias. */
export function mostrarFolhaDeConta(s: Pick<SessaoDeConvidado, "aberturas" | "folhaEm">, agora: Date = new Date()): boolean {
  if ((s.aberturas ?? 0) < 2) return false;
  if (!s.folhaEm) return true;
  const antes = Date.parse(s.folhaEm);
  return Number.isNaN(antes) || agora.getTime() - antes >= SETE_DIAS_MS;
}

/* ─── Os textos do link sem conta (G7 e regras da Segurança) ────────────── */

export const LINK = {
  faixa: "Crie a conta para guardar este pedido e receber avisos.",
  criarConta: "Criar conta",
  depoisDeAgir: "Feito. Com conta, recebe um aviso no telemóvel quando houver novidades.",
  pagar: "Criar conta para pagar",
  folhaTitulo: "Guarde este pedido na sua conta",
  folhaTexto: "Com o Google, é um toque. Os avisos das propostas chegam a este telemóvel.",
  agoraNao: "Agora não",
  e2cTitulo: "Os pedidos abertos neste telemóvel",
  e2cEntrar: "Entre para ver todos os seus pedidos num só sítio.",
  e2cVazio: "Fez um pedido pelo WhatsApp? Abra o link que a CLYON lhe enviou e o pedido aparece aqui.",
  temContaTitulo: "Este pedido está numa conta CLYON",
  muitosTitulo: "Este link já foi aberto noutros telemóveis",
  muitosTexto: "Por segurança, cada link abre em poucos telemóveis. Para o abrir aqui, peça ajuda à CLYON pelo WhatsApp.",
  muitosWhatsapp: "Olá! O link do meu pedido não abre neste telemóvel. Podem ajudar?",
  depoisDeAvaliar: "Com conta, pede outra vez com a morada já preenchida.",
  juntado: (id: number) => `O pedido #${id} está agora na sua conta.`,
  temContaTexto: (mascarado: string | null) =>
    mascarado ? `Entre com ${mascarado} para o ver aqui.` : "Entre com o email desse pedido para o ver aqui.",
} as const;
