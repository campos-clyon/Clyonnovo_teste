import { guiaVerificada } from "./guia-antes-de-contratar";
import { REGIME_DE_IVA_OBRIGATORIO } from "./novo-modelo";
import type { RegimeDoProfissional } from "./pagamento-directo";

/**
 * O PERFIL FISCAL DO PARCEIRO — o que o cliente vê ao escolher (d10, desde
 * 15-11-2026).
 *
 * No modelo novo cada parceiro fatura o seu trabalho. O cliente tem de saber,
 * antes de escolher, o tipo de fatura (com IVA, ou com a isenção do art. 53.º do
 * Código do IVA) e se o parceiro emite a guia de resíduos — e o preço que vê já
 * conta com isso.
 *
 * Não há opção «não emite fatura»: quem presta serviços com atividade aberta
 * emite sempre fatura, também na isenção (Jurídico, 12-11-2026, risco 3).
 *
 * O regime só conta como CONFIRMADO quando o parceiro o confirmou no perfil
 * (`providers.regimeIvaConfirmadoEm`, que nasce a 12-11-2026) ou na inscrição.
 * Sem isso, e com `REGIME_DE_IVA_OBRIGATORIO`, o cliente lê «a confirmar» e a
 * conta faz-se como com IVA: entre dizer um preço a mais e um a menos, o
 * primeiro nunca obriga o cliente a pagar mais do que viu.
 *
 * Pura: o cliente e o backoffice importam isto.
 */

export type TipoDeFatura = "com_iva" | "isento" | "a_confirmar";

export type PerfilFiscal = {
  tipoDeFatura: TipoDeFatura;
  /** A frase ao cliente: «Fatura com IVA», «Fatura com isenção de IVA (art. 53.º)», «Tipo de fatura a confirmar». */
  fatura: string;
  /** Emite a guia de resíduos (verificada pela CLYON). */
  emiteGuia: boolean;
  /** «Emite guia de resíduos» — ou `null`. */
  guia: string | null;
  /** O regime com que se faz a conta (a confirmar → como com IVA). */
  regimeParaAConta: RegimeDoProfissional;
};

export const FRASES_DA_FATURA: Record<TipoDeFatura, string> = {
  com_iva: "Fatura com IVA",
  isento: "Fatura com isenção de IVA (art. 53.º)",
  a_confirmar: "Tipo de fatura a confirmar",
};

export const FRASE_DA_GUIA = "Emite guia de resíduos";

export type ProfissionalParaOPerfil = {
  regimeIva?: unknown;
  regimeIvaConfirmadoEm?: unknown;
  emiteGuiaTransporte?: unknown;
  guiaVerificadaEm?: unknown;
};

/** O regime confirmado — ou `null` quando ainda não está confirmado. */
export function regimeConfirmado(p: ProfissionalParaOPerfil): RegimeDoProfissional | null {
  const r = p.regimeIva === "normal" ? "normal" : p.regimeIva === "isento" ? "isento" : null;
  if (r == null) return null;
  if (!REGIME_DE_IVA_OBRIGATORIO) return r;
  const em = p.regimeIvaConfirmadoEm;
  if (em == null || em === "") return null;
  const d = em instanceof Date ? em : new Date(String(em));
  return Number.isNaN(d.getTime()) ? null : r;
}

/**
 * O regime que o ecrã do perfil mostra marcado — d19, 13-11-2026: só o
 * confirmado. Vazio = por confirmar, e o ecrã começa sem nenhum marcado (a
 * coluna nasce com «isento» por omissão, que não é uma resposta dele).
 */
export function regimeParaOEcra(p: ProfissionalParaOPerfil): "" | RegimeDoProfissional {
  return regimeConfirmado(p) ?? "";
}

export function perfilFiscalDoParceiro(p: ProfissionalParaOPerfil): PerfilFiscal {
  const r = regimeConfirmado(p);
  const tipo: TipoDeFatura = r === "normal" ? "com_iva" : r === "isento" ? "isento" : "a_confirmar";
  const emiteGuia = guiaVerificada({ emiteGuiaTransporte: p.emiteGuiaTransporte, guiaVerificadaEm: p.guiaVerificadaEm });
  return {
    tipoDeFatura: tipo,
    fatura: FRASES_DA_FATURA[tipo],
    emiteGuia,
    guia: emiteGuia ? FRASE_DA_GUIA : null,
    regimeParaAConta: r ?? "normal",
  };
}
