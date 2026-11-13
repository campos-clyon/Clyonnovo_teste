import {
  IBAN_E_MBWAY_OBRIGATORIOS_ATE,
  IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO,
  NOVO_MODELO_DESDE,
  REGIME_DE_IVA_OBRIGATORIO,
  novoModeloEmVigor,
} from "./novo-modelo";
import { regimeConfirmado } from "./perfil-fiscal";

/**
 * O IBAN, O MB WAY E O REGIME DE IVA, OBRIGATÓRIOS PARA RECEBER TRABALHOS — d10,
 * desde 15-11-2026 (dono, 12-11-2026).
 *
 * No modelo novo o cliente paga ao parceiro: sem IBAN (com o titular) e sem MB
 * WAY no perfil, o cliente não tem para onde pagar. E sem o regime de IVA
 * confirmado, o cliente não sabe que fatura vai receber.
 *
 *   · Aprovados ANTES de 15-11: até 22-11 (inclusive) só um aviso; depois, sem
 *     eles, não aceitam pedidos nem enviam propostas.
 *   · Aprovados a partir de 15-11: precisam deles desde o primeiro dia.
 *   · Antes de 15-11: nada (o modelo ainda não vale).
 *
 * Só se mostram ao cliente que o contratou, depois de contratar — ver
 * `dadosParaPagarAoParceiro`.
 *
 * Pura: o painel, a app e as rotas fazem a mesma pergunta.
 */

export type ProfissionalComDadosParaReceber = {
  iban?: unknown;
  ibanTitular?: unknown;
  mbway?: unknown;
  regimeIva?: unknown;
  regimeIvaConfirmadoEm?: unknown;
  /** `providers.estado` e `providers.aprovadoEm` — para a transição. */
  estado?: unknown;
  aprovadoEm?: unknown;
};

export type DadoParaReceber = "iban" | "titular" | "mbway" | "regime";

export const NOMES_DOS_DADOS: Record<DadoParaReceber, string> = {
  iban: "o IBAN",
  titular: "o titular da conta",
  mbway: "o número MB WAY",
  regime: "o regime de IVA",
};

function preenchido(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "";
}

/** O que lhe falta no perfil (vazio = nada). */
export function dadosEmFalta(p: ProfissionalComDadosParaReceber): DadoParaReceber[] {
  const falta: DadoParaReceber[] = [];
  if (!preenchido(p.iban)) falta.push("iban");
  if (!preenchido(p.ibanTitular)) falta.push("titular");
  if (!preenchido(p.mbway)) falta.push("mbway");
  if (REGIME_DE_IVA_OBRIGATORIO && regimeConfirmado(p) == null) falta.push("regime");
  return falta;
}

/**
 * «DADOS PARA RECEBER» NO BACKOFFICE — d19, 13-11-2026: quantos dos quatro tem
 * (IBAN, titular, MB WAY, regime de IVA confirmado) e quais faltam. Só de
 * leitura; a mesma pergunta de `dadosEmFalta`, que é a do impedimento.
 */
export function resumoDosDadosParaReceber(p: ProfissionalComDadosParaReceber): {
  tem: number;
  de: number;
  falta: DadoParaReceber[];
} {
  const falta = dadosEmFalta(p);
  const de = REGIME_DE_IVA_OBRIGATORIO ? 4 : 3;
  return { tem: de - falta.length, de, falta };
}

/** Foi aprovado antes de 15-11 (ganha os 7 dias de aviso)? Vazio = aprovado de antes. */
export function aprovadoAntesDoNovoModelo(p: ProfissionalComDadosParaReceber): boolean {
  if (p.aprovadoEm === undefined) return false;
  if (p.aprovadoEm === null || p.aprovadoEm === "") return p.estado === "aprovado";
  const d = p.aprovadoEm instanceof Date ? p.aprovadoEm : new Date(String(p.aprovadoEm));
  return !Number.isNaN(d.getTime()) && d.getTime() < NOVO_MODELO_DESDE.getTime();
}

export type EstadoDosDadosParaReceber =
  | { estado: "completos" }
  | { estado: "ainda_nao_vale" }
  | { estado: "aviso"; falta: DadoParaReceber[]; ate: string; frase: string }
  | { estado: "impede"; falta: DadoParaReceber[]; frase: string };

function lista(falta: DadoParaReceber[]): string {
  const nomes = falta.map((f) => NOMES_DOS_DADOS[f]);
  return nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** Os quatro, numa frase («o IBAN, o titular da conta, o número MB WAY e o regime de IVA») — d16. */
export const OS_DADOS_PARA_RECEBER_EM_PALAVRAS = lista(["iban", "titular", "mbway", "regime"]);

export function estadoDosDadosParaReceber(
  p: ProfissionalComDadosParaReceber,
  agora: Date = new Date(),
): EstadoDosDadosParaReceber {
  if (!novoModeloEmVigor(agora)) return { estado: "ainda_nao_vale" };
  const falta = dadosEmFalta(p);
  if (falta.length === 0) return { estado: "completos" };
  const naTransicao = aprovadoAntesDoNovoModelo(p) && agora.getTime() <= IBAN_E_MBWAY_OBRIGATORIOS_ATE.getTime();
  if (naTransicao) {
    return {
      estado: "aviso",
      falta,
      ate: IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO,
      frase:
        `Os clientes passam a pagar-lhe diretamente. Preencha no seu perfil ${lista(falta)} até ` +
        `${IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO}: a partir daí, sem eles, não pode aceitar pedidos nem enviar propostas.`,
    };
  }
  return {
    estado: "impede",
    falta,
    frase: `Para aceitar pedidos e enviar propostas, preencha no seu perfil ${lista(falta)}: é para lá que o cliente lhe paga.`,
  };
}

/** Aceitar e propor têm de parar aqui? */
export function dadosImpedemAceitar(p: ProfissionalComDadosParaReceber, agora: Date = new Date()): boolean {
  return estadoDosDadosParaReceber(p, agora).estado === "impede";
}

/**
 * O IBAN E O MB WAY DO PARCEIRO, PARA O CLIENTE LHE PAGAR — só ao cliente que o
 * contratou, só depois de contratar, só no modelo novo. Quem chama decide «é o
 * cliente deste pedido» (sessão, link com token); esta função decide o resto.
 */
export function dadosParaPagarAoParceiro(
  p: { iban?: unknown; ibanTitular?: unknown; mbway?: unknown },
  contexto: { contratado: boolean; doNovoModelo: boolean },
): { iban: string | null; titular: string | null; mbway: string | null } | null {
  if (!contexto.contratado || !contexto.doNovoModelo) return null;
  const s = (v: unknown) => (preenchido(v) ? String(v).trim() : null);
  return { iban: s(p.iban), titular: s(p.ibanTitular), mbway: s(p.mbway) };
}
