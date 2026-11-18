import {
  IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO,
  REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO,
  VERSAO_DOS_TERMOS,
  VERSAO_DOS_TERMOS_POR_EXTENSO,
  novoModeloEmVigor,
} from "./novo-modelo";
import {
  estadoDosDadosParaReceber,
  temIbanComTitular,
  temMbway,
  type DadoParaReceber,
  type ProfissionalComDadosParaReceber,
} from "./dados-para-receber";
import { guiaVerificada } from "./guia-antes-de-contratar";

/**
 * «PRONTO PARA RECEBER PEDIDOS» — d1 (CEO e dono, 18-11-2026).
 *
 * Um só cartão no Início do painel do profissional, com o que falta a cada um,
 * linha a linha, cada uma com o seu caminho: os Termos, o IBAN e o titular, o
 * MB WAY, o regime de IVA e — só a quem faz entulho — a guia de resíduos.
 *
 * A LISTA É DO SERVIDOR. A rota da carteira manda-a pronta
 * (`novoModelo.prontoParaReceber`), e o painel e a app CLYON Pro desenham o que
 * ela diz: nenhum ecrã decide sozinho o que falta nem o que impede. O que
 * impede é o mesmo de `estadoDosDadosParaReceber` (os dois prazos da d1):
 *
 *   · o meio de receber — basta um (o IBAN com o titular, ou o MB WAY);
 *   · o regime de IVA — aviso até 30-11, depois impede.
 *
 * Os Termos e a guia não impedem de propor: os Termos estão à espera do
 * advogado (`aceitacao-dos-termos.ts`), e a guia por verificar impede ser
 * CONTRATADO em entulho, não propor (`guia-antes-de-contratar.ts`).
 *
 * Pura e sem importações de servidor: os testes e a app lêem-na.
 */

export const TITULO_DO_PRONTO_PARA_RECEBER = "Pronto para receber pedidos";

export type IdDaLinha = "termos" | "iban" | "mbway" | "regime" | "guia";

/** Para onde leva o botão: a secção do painel, e o ecrã da app (`null` = o ecrã dos Termos da app). */
export type CaminhoDaLinha = "termos" | "banco" | "faturacao";

export const CAMINHO_NA_APP: Record<CaminhoDaLinha, "/conta/banco" | "/conta/faturacao" | null> = {
  termos: null,
  banco: "/conta/banco",
  faturacao: "/conta/faturacao",
};

export type LinhaDoProntoParaReceber = {
  id: IdDaLinha;
  rotulo: string;
  /** feito; falta; opcional (o outro meio de receber já lá está); por_verificar (a guia enviada). */
  estado: "feito" | "falta" | "opcional" | "por_verificar";
  /** Uma frase curta, a dizer o que falta ou porquê. */
  detalhe: string;
  /** Esta linha impede, agora, de aceitar pedidos e enviar propostas? */
  impede: boolean;
  /** O texto do botão (`null` quando está feito). */
  botao: string | null;
  caminho: CaminhoDaLinha;
  app: "/conta/banco" | "/conta/faturacao" | null;
};

export type ProntoParaReceber = {
  titulo: string;
  /** Tudo feito (o opcional não conta). */
  pronto: boolean;
  /** Pode aceitar pedidos e enviar propostas agora? */
  podePropor: boolean;
  /** A frase por baixo do título. */
  resumo: string;
  linhas: LinhaDoProntoParaReceber[];
};

export type EntradaDoProntoParaReceber = ProfissionalComDadosParaReceber & {
  /** `providers.categorias` (JSON ou lista separada por vírgulas) ou a lista já lida. */
  categorias?: unknown;
  emiteGuiaTransporte?: unknown;
  guiaVerificadaEm?: unknown;
  /** A versão dos Termos que aceitou (`aceitacoesDosTermos.versao`); `null` = nenhuma; `undefined` = não se leu. */
  versaoDosTermosAceite?: string | null;
};

/** As categorias gravadas, em lista (JSON, ou o formato antigo separado por vírgulas). */
function categoriasEmLista(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const l = JSON.parse(v);
    if (Array.isArray(l)) return l.filter((x): x is string => typeof x === "string");
  } catch {
    /* não é JSON — o formato antigo */
  }
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

/** Faz entulho (a guia só se pede a quem faz)? */
export function fazEntulho(categorias: unknown): boolean {
  return categoriasEmLista(categorias).some((c) => /entulho/i.test(c));
}

function verdadeiro(v: unknown): boolean {
  return v === true || Number(v) === 1;
}

/**
 * O cartão, ou `null` antes de 15-11 (o modelo ainda não vale: nada a mostrar).
 */
export function prontoParaReceber(p: EntradaDoProntoParaReceber, agora: Date = new Date()): ProntoParaReceber | null {
  if (!novoModeloEmVigor(agora)) return null;

  const dados = estadoDosDadosParaReceber(p, agora);
  const impedem = new Set<DadoParaReceber>(dados.estado === "impede" ? dados.falta : []);
  const linhas: LinhaDoProntoParaReceber[] = [];

  const linha = (l: Omit<LinhaDoProntoParaReceber, "app">): void => {
    linhas.push({ ...l, app: CAMINHO_NA_APP[l.caminho] });
  };

  // ── Os Termos (sem a leitura da aceitação — `undefined` —, a linha não se mostra) ──
  const aceitou = p.versaoDosTermosAceite === VERSAO_DOS_TERMOS;
  if (p.versaoDosTermosAceite !== undefined) linha({
    id: "termos",
    rotulo: "Termos",
    estado: aceitou ? "feito" : "falta",
    detalhe: aceitou
      ? `Aceites, versão de ${VERSAO_DOS_TERMOS_POR_EXTENSO}.`
      : `Leia e aceite os Termos de ${VERSAO_DOS_TERMOS_POR_EXTENSO}.`,
    impede: false,
    botao: aceitou ? null : "Ler e aceitar",
    caminho: "termos",
  });

  // ── O meio de receber: basta um ──
  const ibanOk = temIbanComTitular(p);
  const mbwayOk = temMbway(p);
  const semMeio = !ibanOk && !mbwayOk;
  const meioImpede = impedem.has("iban") || impedem.has("titular") || impedem.has("mbway");
  const doMeio = meioImpede
    ? "Sem o IBAN nem o MB WAY não pode aceitar pedidos nem enviar propostas. Basta um dos dois."
    : `Indique o IBAN com o titular, ou o MB WAY, até ${IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO}. Basta um dos dois.`;

  const ibanSemTitular = typeof p.iban === "string" && p.iban.trim() !== "" && !ibanOk;
  linha({
    id: "iban",
    rotulo: "IBAN e titular",
    estado: ibanOk ? "feito" : mbwayOk ? "opcional" : "falta",
    detalhe: ibanOk
      ? "É para aqui que o cliente lhe pode transferir."
      : mbwayOk
        ? ibanSemTitular
          ? "Falta o titular da conta. Não é obrigatório: já tem o MB WAY."
          : "Não é obrigatório: já tem o MB WAY."
        : ibanSemTitular
          ? `Falta o titular da conta. ${doMeio}`
          : doMeio,
    impede: semMeio && meioImpede,
    botao: ibanOk ? null : ibanSemTitular ? "Indicar o titular" : "Indicar o IBAN",
    caminho: "banco",
  });

  linha({
    id: "mbway",
    rotulo: "MB WAY",
    estado: mbwayOk ? "feito" : ibanOk ? "opcional" : "falta",
    detalhe: mbwayOk
      ? "O cliente também lhe pode pagar por MB WAY."
      : ibanOk
        ? "Não é obrigatório: já tem o IBAN com o titular."
        : doMeio,
    impede: semMeio && meioImpede,
    botao: mbwayOk ? null : "Indicar o MB WAY",
    caminho: "banco",
  });

  // ── O regime de IVA ──
  const regimeEmFalta =
    (dados.estado === "aviso" || dados.estado === "impede") && dados.falta.includes("regime");
  const regimeImpede = impedem.has("regime");
  linha({
    id: "regime",
    rotulo: "Regime de IVA",
    estado: regimeEmFalta ? "falta" : "feito",
    detalhe: !regimeEmFalta
      ? "Confirmado: o cliente sabe que fatura vai receber."
      : regimeImpede
        ? "Sem o regime de IVA confirmado não pode aceitar pedidos nem enviar propostas."
        : `Escolha e grave até ${REGIME_DE_IVA_EM_AVISO_ATE_POR_EXTENSO}. Depois dessa data, sem ele, não pode aceitar pedidos nem enviar propostas.`,
    impede: regimeImpede,
    botao: regimeEmFalta ? "Confirmar o regime" : null,
    caminho: "faturacao",
  });

  // ── A guia de resíduos, só a quem faz entulho ──
  if (fazEntulho(p.categorias)) {
    const verificada = guiaVerificada({ emiteGuiaTransporte: p.emiteGuiaTransporte, guiaVerificadaEm: p.guiaVerificadaEm });
    const enviada = !verificada && verdadeiro(p.emiteGuiaTransporte);
    linha({
      id: "guia",
      rotulo: "Guia de resíduos",
      estado: verificada ? "feito" : enviada ? "por_verificar" : "falta",
      detalhe: verificada
        ? "A guia de resíduos verificada pela CLYON."
        : enviada
          ? "Enviada: a CLYON está a verificá-la. Até lá pode propor, mas não pode ser contratado em trabalhos com entulho."
          : "Sem a guia verificada pode propor, mas não pode ser contratado em trabalhos com entulho.",
      impede: false,
      botao: verificada ? null : enviada ? "Ver a guia" : "Completar a guia",
      caminho: "faturacao",
    });
  }

  const pronto = linhas.every((l) => l.estado === "feito" || l.estado === "opcional");
  const podePropor = dados.estado !== "impede";
  const resumo = pronto
    ? "Tem tudo o que é preciso para receber pedidos."
    : podePropor
      ? "Já pode aceitar pedidos e enviar propostas. Complete o que falta antes dos prazos."
      : "Por agora não pode aceitar pedidos nem enviar propostas. Complete o que está assinalado.";

  return { titulo: TITULO_DO_PRONTO_PARA_RECEBER, pronto, podePropor, resumo, linhas };
}
