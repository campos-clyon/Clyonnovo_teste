import {
  IBAN_E_MBWAY_OBRIGATORIOS_ATE,
  IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO,
  NOVO_MODELO_DESDE,
  NOVO_MODELO_DESDE_POR_EXTENSO,
  REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO,
  REGIME_DE_IVA_OBRIGATORIO,
  novoModeloEmVigor,
  regimeDeIvaImpedeDesde,
} from "./novo-modelo";
import { dataPorExtensoEmLisboa } from "./hora-de-lisboa";
import { regimeConfirmado } from "./perfil-fiscal";

/**
 * O IBAN, O MB WAY E O REGIME DE IVA, OBRIGATÓRIOS PARA RECEBER TRABALHOS — d10,
 * desde 15-11-2026 (dono, 12-11-2026).
 *
 * No modelo novo o cliente paga ao parceiro: sem IBAN (com o titular) e sem MB
 * WAY no perfil, o cliente não tem para onde pagar. E sem o regime de IVA
 * confirmado, o cliente não sabe que fatura vai receber.
 *
 * DOIS PRAZOS desde a d1 (CEO e dono, 18-11-2026):
 *
 *   · O MEIO DE RECEBER — basta um: o IBAN com o titular, ou o MB WAY.
 *     Aprovados ANTES de 15-11: até 22-11 (inclusive) só um aviso; a partir de
 *     23-11, sem nenhum dos dois, não aceitam pedidos nem enviam propostas.
 *     Aprovados a partir de 15-11: precisam de um desde o primeiro dia.
 *   · O REGIME DE IVA — para todos, só aviso até 30-11 (inclusive); a partir de
 *     01-12, sem ele confirmado, não aceitam nem propõem.
 *   · Antes de 15-11: nada (o modelo ainda não vale).
 *
 * Quem tem o IBAN com o titular OU o MB WAY nunca fica impedido a 23-11.
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
  /**
   * d6 (23-11-2026): aceitou a versão em vigor dos Termos? Dela depende a data a
   * partir da qual o regime de IVA em falta impede (`regimeDeIvaImpedeDesde`).
   * Sem a leitura (`undefined`) conta como «não aceitou»: nunca se bloqueia por engano.
   */
  aceitouOsTermosAtuais?: boolean;
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

/** Tem o IBAN com o titular? */
export function temIbanComTitular(p: ProfissionalComDadosParaReceber): boolean {
  return preenchido(p.iban) && preenchido(p.ibanTitular);
}

/** Tem o número MB WAY? */
export function temMbway(p: ProfissionalComDadosParaReceber): boolean {
  return preenchido(p.mbway);
}

/** Tem por onde o cliente lhe pagar — o IBAN com o titular, ou o MB WAY (basta um; d1, 18-11-2026)? */
export function temPorOndeReceber(p: ProfissionalComDadosParaReceber): boolean {
  return temIbanComTitular(p) || temMbway(p);
}

/** Falta-lhe confirmar o regime de IVA (e o regime é obrigatório)? */
export function faltaORegime(p: ProfissionalComDadosParaReceber): boolean {
  return REGIME_DE_IVA_OBRIGATORIO && regimeConfirmado(p) == null;
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

/** O meio de receber, como as frases o dizem (basta um). */
export const O_MEIO_DE_RECEBER_EM_PALAVRAS = "o IBAN com o titular da conta, ou o número MB WAY";

/**
 * A FAIXA DOS PRAZOS — d18 (13-11-2026), revista na d1 (18-11-2026): os dois
 * prazos, o do meio de receber (basta um) e o do regime de IVA. O painel e a app
 * CLYON Pro mostram a mesma frase, que vem daqui pela rota
 * (`novoModelo.dadosParaReceber.frase`); o botão ao lado é «Completar o perfil».
 * Esta é a frase inteira (falta tudo, aprovado antes de 15-11, até 22-11).
 */
export const FAIXA_DOS_DADOS_PARA_RECEBER =
  `A partir de ${NOVO_MODELO_DESDE_POR_EXTENSO} recebe diretamente do cliente. Até ${IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO}, ` +
  `indique no perfil ${O_MEIO_DE_RECEBER_EM_PALAVRAS} (basta um). ` +
  `Confirme também o regime de IVA até ${REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO} (escolha e grave).`;
export const COMPLETAR_O_PERFIL = "Completar o perfil";

/** A frase do aviso, pelas partes que faltam. */
function fraseDoAviso(o: { meioEmAviso: boolean; regimeEmAviso: boolean; regimeAte?: string | null }): string {
  // d6: o prazo do regime é por parceiro; sem data (o aviso ainda não saiu), a frase não inventa uma.
  const semData = o.regimeAte === null;
  if (o.meioEmAviso && o.regimeEmAviso && !semData && o.regimeAte === REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO) return FAIXA_DOS_DADOS_PARA_RECEBER;
  if (o.meioEmAviso && o.regimeEmAviso) {
    return (
      `A partir de ${NOVO_MODELO_DESDE_POR_EXTENSO} recebe diretamente do cliente. Até ${IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO}, ` +
      `indique no perfil ${O_MEIO_DE_RECEBER_EM_PALAVRAS} (basta um). ` +
      (semData ? "Confirme também o regime de IVA (escolha e grave)." : `Confirme também o regime de IVA até ${o.regimeAte} (escolha e grave).`)
    );
  }
  if (o.meioEmAviso) {
    return (
      `A partir de ${NOVO_MODELO_DESDE_POR_EXTENSO} recebe diretamente do cliente. Até ${IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO}, ` +
      `indique no perfil ${O_MEIO_DE_RECEBER_EM_PALAVRAS} (basta um).`
    );
  }
  if (semData) {
    return "Confirme no perfil o regime de IVA (escolha e grave): é o que diz ao cliente que fatura vai receber. Avisamo-lo antes de passar a ser obrigatório.";
  }
  return (
    `Confirme no perfil o regime de IVA até ${o.regimeAte} (escolha e grave): ` +
    "é o que diz ao cliente que fatura vai receber. Depois dessa data, sem ele, não pode aceitar pedidos nem enviar propostas."
  );
}

/** A frase do impedimento, pelo que impede. */
function fraseDoImpedimento(o: { semMeio: boolean; semRegime: boolean }): string {
  if (o.semMeio && o.semRegime) {
    return `Para aceitar pedidos e enviar propostas, indique no seu perfil ${O_MEIO_DE_RECEBER_EM_PALAVRAS} (é para lá que o cliente lhe paga), e confirme o regime de IVA.`;
  }
  if (o.semMeio) {
    return `Para aceitar pedidos e enviar propostas, indique no seu perfil ${O_MEIO_DE_RECEBER_EM_PALAVRAS}: é para lá que o cliente lhe paga.`;
  }
  return "Para aceitar pedidos e enviar propostas, confirme no seu perfil o regime de IVA: é o que diz ao cliente que fatura vai receber.";
}

export function estadoDosDadosParaReceber(
  p: ProfissionalComDadosParaReceber,
  agora: Date = new Date(),
): EstadoDosDadosParaReceber {
  if (!novoModeloEmVigor(agora)) return { estado: "ainda_nao_vale" };
  const semMeio = !temPorOndeReceber(p);
  const semRegime = faltaORegime(p);
  if (!semMeio && !semRegime) return { estado: "completos" };

  // Do meio de receber, só conta o que falta quando não há nenhum dos dois: com
  // o IBAN e o titular, ou com o MB WAY, o outro não avisa nem impede.
  const faltaDoMeio: DadoParaReceber[] = semMeio ? dadosEmFalta(p).filter((d) => d !== "regime") : [];
  const meioEmTransicao = aprovadoAntesDoNovoModelo(p) && agora.getTime() <= IBAN_E_MBWAY_OBRIGATORIOS_ATE.getTime();
  const regimeImpedeDesde = regimeDeIvaImpedeDesde(p.aceitouOsTermosAtuais === true);
  const regimeEmAviso = regimeImpedeDesde === null || agora.getTime() < regimeImpedeDesde.getTime();
  const regimeAteTexto = regimeImpedeDesde ? dataPorExtensoEmLisboa(new Date(regimeImpedeDesde.getTime() - 1000)) : null;

  const meioImpede = semMeio && !meioEmTransicao;
  const regimeImpede = semRegime && !regimeEmAviso;
  if (meioImpede || regimeImpede) {
    const falta: DadoParaReceber[] = [...(meioImpede ? faltaDoMeio : []), ...(regimeImpede ? (["regime"] as const) : [])];
    return { estado: "impede", falta, frase: fraseDoImpedimento({ semMeio: meioImpede, semRegime: regimeImpede }) };
  }

  const falta: DadoParaReceber[] = [...faltaDoMeio, ...(semRegime ? (["regime"] as const) : [])];
  const ate = semMeio ? IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO : (regimeAteTexto ?? "");
  return {
    estado: "aviso",
    falta,
    ate,
    frase: fraseDoAviso({ meioEmAviso: semMeio, regimeEmAviso: semRegime, regimeAte: regimeAteTexto }),
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
