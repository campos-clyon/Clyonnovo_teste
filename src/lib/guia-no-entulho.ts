/**
 * O ENTULHO SEM GUIA DE RESÍDUOS — 25-11-2026 (decisão d118). PURO.
 *
 * A regra da guia (d10/d16) travava todo o entulho: a Vitória entregava à
 * equipa com «Guia por verificar - quis fechar». O dono: a maioria dos
 * parceiros não emite guia — leva o entulho aos centros de resíduos,
 * normalmente públicos. Agora:
 *
 *   · a proposta de entulho de um parceiro sem guia verificada fecha como as
 *     outras, desde que o cliente tenha sido avisado ANTES de aceitar — a
 *     linha do Jurídico (`AVISO_DA_GUIA_NO_ENTULHO`) vai na mensagem das
 *     propostas (d114), junto a cada uma dessas;
 *   · sem o aviso no fio (propostas de antes), a Vitória diz a linha primeiro
 *     e só fecha quando o cliente confirmar (`perguntaDaGuiaAntesDeFechar`);
 *   · quem precisa de guia (diz que precisa, que é uma empresa ou uma obra
 *     com licença, ou exige certificado ou comprovativo de entrega) passa a
 *     uma pessoa, com o motivo «Precisa de guia de resíduos»;
 *   · móveis e monos ficam como estão; a verificação da guia no backoffice e
 *     no perfil do parceiro também.
 */

/** A frase do Jurídico (25-11-2026), tal e qual. */
export const AVISO_DA_GUIA_NO_ENTULHO =
  "Este parceiro compromete-se a entregar o entulho num centro de resíduos autorizado, mas não emite guia de resíduos (e-GAR). " +
  "Se precisar de guia, por exemplo para uma empresa ou uma obra com licença, diga-me e passo a uma pessoa da equipa.";

/** O motivo da entrega à equipa — e o que a Mesa mostra. */
export const MOTIVO_DA_GUIA = "Precisa de guia de resíduos";

/** O que a Vitória diz ao passar. */
export const PASSO_A_GUIA_A_UMA_PESSOA = "Combinado: passo a uma pessoa da equipa, que trata da guia consigo.";

/** Quantos dias vale o aviso que está no fio. */
export const DIAS_DO_AVISO = 14;

const plano = (t: string) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * O CLIENTE PRECISA DE GUIA? — fala da guia ou da e-GAR; é uma empresa; é
 * uma obra com licença; ou exige um certificado ou um comprovativo de
 * entrega. Pura. O «entulho de obras», sozinho, não conta.
 */
export function precisaDeGuia(texto: string | null | undefined): boolean {
  const t = plano(texto ?? "");
  if (!t) return false;
  if (/\be-?gar\b|\bguias? de (?:residuos|transporte|acompanhamento)\b|\b(?:passam|emitem|tem|dao|da|passa|emite|preciso|precisamos|necessito|quero|queremos|com) (?:a |uma )?guia\b/.test(t)) return true;
  if (/\b(?:sou|somos) (?:uma )?empresa\b|\b(?:e|para) (?:uma|a nossa|a minha) empresa\b|\bem nome (?:da|de uma) empresa\b/.test(t)) return true;
  if (/\b(?:e|para) uma obra\b|\bobra (?:com|de) licenca\b|\bobra licenciada\b|\bobra publica\b|\bempreiteir\w*/.test(t)) return true;
  if (/\b(?:preciso|precisamos|necessito|necessitamos|exijo|exigimos|exigem|exige|tenho de ter|temos de ter|tem de haver|quero|queremos|obrigatori\w*)\b.*\b(?:certificad\w*|comprovativ\w*|certidao)\b/.test(t)) return true;
  return false;
}

type MensagemDoFio = { direccao?: string; texto?: string; haSegundos?: number | null };

/** O aviso está numa mensagem que saiu ao cliente (da Vitória ou da equipa) nos últimos dias? Pura. */
export function jaFoiAvisadoDaGuia(fio: ReadonlyArray<MensagemDoFio> | null | undefined, dias: number = DIAS_DO_AVISO): boolean {
  const alvo = plano(AVISO_DA_GUIA_NO_ENTULHO.split(". ")[0]);
  return (Array.isArray(fio) ? fio : []).some(
    (m) =>
      m?.direccao === "out" &&
      typeof m.texto === "string" &&
      plano(m.texto).includes(alvo) &&
      (m.haSegundos == null || m.haSegundos <= dias * 86400),
  );
}

/** A pergunta antes de fechar, a quem ainda não leu o aviso — o «1» fecha (a d111 lê-a). */
export function perguntaDaGuiaAntesDeFechar(parceiro: string, pedidoId: number): string {
  const nome = String(parceiro ?? "").replace(/\s+/g, " ").trim().replace(/\.+$/, "") || "escolhido";
  return `${AVISO_DA_GUIA_NO_ENTULHO} Quer avançar com o parceiro ${nome} no pedido #${pedidoId}? É só responder 1.`;
}

/** A pergunta de antes, lida do texto que saiu — o pedido e o parceiro; ou null. */
export function lerAPerguntaDaGuia(texto: string | null | undefined): { pedidoId: number; parceiro: string } | null {
  const m = /Quer avançar com o parceiro (.+?) no pedido #(\d+)\? É só responder 1\./.exec(String(texto ?? ""));
  return m ? { pedidoId: Number(m[2]), parceiro: m[1].trim() } : null;
}
