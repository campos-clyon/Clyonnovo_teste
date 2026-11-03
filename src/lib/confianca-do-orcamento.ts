/**
 * A CONFIANÇA DO ORÇAMENTO — 03-11-2026.
 *
 * Antes, a rota punha «alta» sempre que não faltava nenhum campo, e «baixa»
 * só quando o estado era `onsite_required`/`needs_more_info`. Um pedido sem
 * fotografias, com o Gemini em timeout, saía «alta» desde que o formulário
 * viesse completo — e seguia direto aos profissionais.
 *
 * Agora a confiança sai de sinais que se podem verificar, e cada sinal deixa
 * uma razão escrita, para o backoffice saber PORQUE é que um pedido ficou
 * para rever:
 *
 *   · o estado do motor (sem preço ou a pedir visita → baixa, sempre);
 *   · quem leu o pedido (o Gemini, ou só o motor local por timeout/erro);
 *   · se havia fotografias;
 *   · quantos campos faltam;
 *   · se o Gemini, a olhar para as fotografias, discorda muito do motor.
 *
 * A última é a mais útil: o preço vem sempre do motor (ver
 * `analyze/route.ts`), mas quando o modelo vê nas fotografias um trabalho
 * bastante maior ou menor do que o formulário diz, isso é sinal de que o
 * formulário está errado — e esse pedido merece olhos humanos.
 *
 * Sem dependências de servidor: testa-se sozinho.
 */

export type Confianca = "high" | "medium" | "low";

export type QuemLeu = "gemini" | "timeout" | "erro" | "sem_chave";

export type SinaisDoOrcamento = {
  status: "estimated" | "onsite_required" | "needs_more_info";
  /** O preço final s/IVA que vai ao cliente (já o do motor). */
  precoSemIva: number | null | undefined;
  quemLeu: QuemLeu;
  /** Fotografias que chegaram mesmo ao modelo (não as que o cliente tentou enviar). */
  fotografias: number;
  camposEmFalta: number;
  /** O preço que o Gemini sugeriu, s/IVA — só para medir a discordância. */
  precoDoModelo?: number | null;
  /**
   * O preço saiu do motor (tabela, grelha ou fórmula)? Quando o motor não
   * conseguiu e o número é só o do modelo, a confiança é baixa, sempre.
   */
  precoEDoMotor: boolean;
};

/** A partir de quanto a discordância do modelo conta. 0,35 = 35 %. */
export const DISCORDANCIA_QUE_CONTA = 0.35;
/** A partir de quanto a discordância manda o pedido para rever. */
export const DISCORDANCIA_GRAVE = 0.6;

/** Quanto o modelo se afasta do motor, em fração do motor (0,5 = 50 %). */
export function discordancia(precoDoMotor: number, precoDoModelo: number | null | undefined): number | null {
  if (!precoDoModelo || precoDoModelo <= 0 || precoDoMotor <= 0) return null;
  return Math.abs(precoDoModelo - precoDoMotor) / precoDoMotor;
}

export type ConfiancaDoOrcamento = {
  confianca: Confianca;
  razoes: string[];
  /**
   * O modelo e o formulário contam histórias muito diferentes. É o único
   * sinal novo que esconde o número ao cliente: os outros (sem fotografias,
   * timeout) baixam a confiança no backoffice mas não tiram ao cliente a
   * estimativa que ele já via antes.
   */
  rever: boolean;
};

export function confiancaDoOrcamento(s: SinaisDoOrcamento): ConfiancaDoOrcamento {
  const razoes: string[] = [];

  // 1. Sem preço, ou a pedir visita/informação: não há confiança a dar.
  if (!s.precoSemIva || s.precoSemIva <= 0) {
    return { confianca: "low", razoes: ["Sem preço calculado pelo motor."], rever: false };
  }
  if (s.status !== "estimated") {
    return {
      confianca: "low",
      razoes: [s.status === "needs_more_info" ? "Faltam dados para fechar o preço." : "O trabalho pede visita ou fotografias."],
      rever: false,
    };
  }

  if (!s.precoEDoMotor) {
    return { confianca: "low", razoes: ["O preço é só o que o modelo sugeriu — o motor não o conseguiu calcular."], rever: false };
  }

  // 2. Pontos: começa em 3 (alta) e desce com cada sinal fraco.
  let pontos = 3;

  if (s.quemLeu !== "gemini") {
    pontos -= 1;
    razoes.push(
      s.quemLeu === "timeout"
        ? "O modelo não respondeu a tempo — só o motor local leu o pedido."
        : s.quemLeu === "sem_chave"
        ? "Sem modelo configurado — só o motor local leu o pedido."
        : "O modelo falhou — só o motor local leu o pedido.",
    );
  }

  if (s.fotografias === 0) {
    pontos -= 1;
    razoes.push("Sem fotografias: o volume vem só do que o cliente escreveu.");
  }

  if (s.camposEmFalta > 0) {
    pontos -= s.camposEmFalta >= 2 ? 2 : 1;
    razoes.push(`${s.camposEmFalta} campo(s) em falta.`);
  }

  const d = discordancia(s.precoSemIva, s.precoDoModelo);
  if (d != null && d >= DISCORDANCIA_QUE_CONTA) {
    const pct = Math.round(d * 100);
    const lado = (s.precoDoModelo ?? 0) > s.precoSemIva ? "acima" : "abaixo";
    if (d >= DISCORDANCIA_GRAVE) {
      // Discordância grave: o formulário e as fotografias contam histórias diferentes.
      return {
        confianca: "low",
        razoes: [...razoes, `O modelo viu um trabalho ${pct}% ${lado} do que o formulário indica — rever antes de enviar.`],
        rever: true,
      };
    }
    pontos -= 1;
    razoes.push(`O modelo viu um trabalho ${pct}% ${lado} do que o formulário indica.`);
  }

  const confianca: Confianca = pontos >= 3 ? "high" : pontos >= 2 ? "medium" : "low";
  if (razoes.length === 0) razoes.push("Formulário completo, fotografias lidas e modelo de acordo com o motor.");
  return { confianca, razoes, rever: false };
}
