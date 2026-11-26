/**
 * TIRAR A EMPRESA E PEDIR PROPOSTAS DE NOVO — d137 (dono e CEO, 26-11-2026; o #595).
 *
 * Um trabalho atribuído (ou um contratado da Mesa) que nunca foi feito, com o
 * dia passado, e o cliente ainda quer o serviço. Só havia «Trocar empresa»:
 * não havia forma de voltar a pedir propostas. Agora, enquanto não há
 * dinheiro em jogo (as guardas da d94: pago, confirmado, referências,
 * faturas, dívidas, carteira, comprovativos, comissões) e o trabalho não foi
 * dado por feito:
 *
 *   · a empresa é avisada numa linha curta (o estilo da d135b);
 *   · a negociação dela sai («morta», com `retiradaEm`) — não volta no «Voltar
 *     a oferecer a todos» nem na distribuição; volta só se a escolherem à mão;
 *   · a reserva da d130 (o «falta o sim»), se houver, sai;
 *   · num Trabalho CLYON o pedido volta a «à espera», onde estão «Voltar a
 *     oferecer a todos» (o mesmo valor fixo) e «Passar a negociação»; na Mesa,
 *     as propostas dos outros voltam a estar abertas (sem aviso a ninguém);
 *   · nada é reenviado nem «recomeçado do zero» antes de a pessoa escolher o
 *     caminho. Com o dia passado, o ecrã abre o Editar no campo do dia.
 *
 * Este ficheiro é puro (sem base): as frases e as regras, com testes. A parte
 * que escreve na base é `tirar-a-empresa-na-base.ts`.
 */

export type OndeEsta = "clyon" | "mesa";

/** O botão, num Trabalho CLYON e na Mesa. */
export const ROTULO_DE_TIRAR: Record<OndeEsta, string> = {
  clyon: "Tirar a empresa e pedir propostas de novo",
  mesa: "Tirar o contratado e reabrir as propostas",
};

/** A frase da confirmação, antes de gravar. */
export function confirmacaoDeTirar(empresa: string | null | undefined, onde: OndeEsta): string {
  const quem = (empresa ?? "").trim() || "A empresa";
  const artigo = quem === "A empresa" ? "" : "A ";
  const depois = onde === "clyon" ? "O pedido volta a «à espera»." : "O pedido volta às propostas.";
  return `${artigo}${quem} é avisada de que o trabalho saiu. ${depois}`;
}

/** O aviso à empresa (WhatsApp e app) — curto, como os da d135b. */
export function avisoATirada(pedidoId: number): { whatsapp: string; title: string; body: string } {
  const texto = `CLYON · O trabalho #${pedidoId} deixou de estar consigo. Obrigado.`;
  return { whatsapp: texto, title: `CLYON · Trabalho #${pedidoId}`, body: `O trabalho #${pedidoId} deixou de estar consigo. Obrigado.` };
}

/** O motivo escrito (opcional): uma linha, até 300 caracteres. */
export function motivoDeTirar(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.replace(/\s+/g, " ").trim();
  if (!m) return null;
  return m.length > 300 ? `${m.slice(0, 297).trimEnd()}…` : m;
}

/** O que a negociação atribuída tem de feito — qualquer um trava. */
export type MarcosDaAtribuida = {
  execucaoEnviadaEm?: unknown;
  confirmadoEm?: unknown;
  pagoEm?: unknown;
  clientePagouEm?: unknown;
};

/**
 * PORQUE É QUE NÃO SE TIRA — `null` quando se pode. Primeiro o trabalho (dado
 * por feito, confirmado, pago), depois o dinheiro do pedido (`oQuePrendeOPedido`
 * da d94, já em palavras).
 */
export function porQueNaoSeTira(a: MarcosDaAtribuida, razoesDoDinheiro: readonly string[]): string | null {
  const r: string[] = [];
  if (a.pagoEm != null) r.push("o trabalho já foi pago");
  if (a.confirmadoEm != null) r.push("o trabalho já foi confirmado");
  if (a.execucaoEnviadaEm != null) r.push("a empresa já o deu por feito");
  if (a.clientePagouEm != null) r.push("o cliente já pagou");
  for (const x of razoesDoDinheiro) if (!r.includes(x)) r.push(x);
  if (r.length === 0) return null;
  return `Não se tira a empresa: ${r.join(", ")}. Com dinheiro em jogo, use «Trocar empresa» ou fale com o administrador.`;
}

/** O dia do trabalho já passou? Sem dia, não. */
export function diaJaPassou(dia: Date | string | null | undefined, agora: Date): boolean {
  if (dia == null || dia === "") return false;
  const d = dia instanceof Date ? dia : new Date(dia);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < agora.getTime();
}

/** A linha do histórico do pedido: quem carregou, a quem saiu, porquê. */
export function historicoDeTirar(a: {
  empresa: string;
  quem: string;
  motivo: string | null;
  onde: OndeEsta;
  avisado: boolean;
  reabertas?: number;
  reservaSaiu?: boolean;
}): string {
  const empresa = a.empresa.trim() || "a empresa";
  const motivo = a.motivo ? ` — motivo: ${a.motivo}` : " — sem motivo escrito";
  const depois =
    a.onde === "clyon"
      ? " O pedido voltou a «à espera»: «Voltar a oferecer a todos» (o mesmo valor fixo) ou «Passar a negociação»."
      : ` As propostas voltaram a estar abertas${a.reabertas ? ` (${a.reabertas})` : ""}, sem aviso a ninguém.`;
  return (
    `Trabalho tirado a ${empresa} por ${a.quem}${motivo}.` +
    (a.avisado ? ` ${empresa} foi avisada.` : ` ${empresa} não foi avisada por WhatsApp (sem número ou envio falhado); vai na app.`) +
    (a.reservaSaiu ? " A marca «falta o sim» saiu." : "") +
    depois +
    " (d137)"
  );
}

/**
 * NA MESA, QUEM VOLTA A TER A PROPOSTA ABERTA: os que ficaram de fora quando
 * ele foi contratado — «morta», sem memória de um cancelamento, sem ter sido
 * tirada também, e com uma proposta dele em cima da mesa.
 */
export function quemVoltaAsPropostas<
  N extends { id: unknown; estado: unknown; estadoAntesDeCancelar?: unknown; retiradaEm?: unknown; propostasJson?: unknown },
>(negociacoes: readonly N[], excepto: number): N[] {
  return negociacoes.filter((n) => {
    if (Number(n.id) === excepto) return false;
    if (n.estado !== "morta") return false;
    if (n.estadoAntesDeCancelar != null && n.estadoAntesDeCancelar !== "") return false;
    if (n.retiradaEm != null) return false;
    return temPropostaDoProfissional(n.propostasJson);
  });
}

function temPropostaDoProfissional(propostasJson: unknown): boolean {
  if (typeof propostasJson !== "string" || !propostasJson.trim()) return false;
  try {
    const l = JSON.parse(propostasJson);
    return Array.isArray(l) && l.some((x: { por?: unknown }) => x?.por === "profissional");
  } catch {
    return false;
  }
}

/**
 * A EMPRESA SAIU E AINDA NINGUÉM O TEM EM ABERTO — o cartão mostra os dois
 * caminhos («Voltar a oferecer a todos», «Passar a negociação») e a frase de
 * onde está a bola.
 */
export function empresaTiradaSemOferta(t: {
  resumo: { atribuida: unknown };
  negociacoes: ReadonlyArray<{ estado: string; retiradaEm?: string | null }>;
}): boolean {
  return (
    t.resumo.atribuida == null &&
    t.negociacoes.some((n) => n.retiradaEm != null && n.retiradaEm !== "") &&
    !t.negociacoes.some((n) => n.estado === "aberta" || n.estado === "aguarda_contratacao")
  );
}
