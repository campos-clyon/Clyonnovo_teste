import {
  DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO,
  IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO,
  PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO,
  VERSAO_DOS_TERMOS,
  VERSAO_DOS_TERMOS_POR_EXTENSO,
  novoModeloEmVigor,
} from "./novo-modelo";
import { EMPRESA_PARCEIRA_AO_PUBLICO } from "./identificacao-legal";

/**
 * A ACEITAÇÃO DOS TERMOS PELO PROFISSIONAL — d20 (CEO e dono, 13-11-2026).
 *
 * A partir de 15-11 pede-se ao profissional que aceite os Termos na versão em
 * vigor (`VERSAO_DOS_TERMOS`, que nasce da data do modelo): ao criar a
 * palavra-passe e no primeiro acesso ao painel ou à app CLYON Pro. A caixa nunca
 * vem marcada. Grava-se a versão, o instante (UTC; mostra-se em hora de Lisboa)
 * e a origem.
 *
 * ⚠️ NÃO BLOQUEIA. «Sem aceitar não propõe» está por confirmar pelo advogado
 * (Jurídico d20, §4 n.º 2 e 3): quem não aceita continua a poder propor e
 * aceitar; o ecrã volta a pedir no acesso seguinte. Ligar o bloqueio é uma
 * decisão nova do CEO e do dono.
 *
 * Puro e sem importações de servidor: o painel, a rota e a app Pro (pela rota
 * `/api/profissionais/termos`) lêem os mesmos textos daqui.
 */

export { VERSAO_DOS_TERMOS, VERSAO_DOS_TERMOS_POR_EXTENSO };

/** De onde veio a aceitação. */
export type OrigemDaAceitacao = "painel" | "app" | "definir-senha";

export const ORIGENS_DA_ACEITACAO: ReadonlyArray<OrigemDaAceitacao> = ["painel", "app", "definir-senha"];

export function lerOrigem(v: unknown): OrigemDaAceitacao | null {
  return typeof v === "string" && (ORIGENS_DA_ACEITACAO as ReadonlyArray<string>).includes(v)
    ? (v as OrigemDaAceitacao)
    : null;
}

/**
 * Este profissional tem de ver o ecrã? Só a partir da data, e só se ainda não
 * aceitou ESTA versão. Antes da data, nunca.
 */
export function precisaDeAceitar(versaoAceite: string | null | undefined, agora: Date): boolean {
  if (!novoModeloEmVigor(agora)) return false;
  return versaoAceite !== VERSAO_DOS_TERMOS;
}

/** A versão que veio no corpo é a que está em vigor? (Aceitar uma versão velha não vale.) */
export function eAVersaoEmVigor(v: unknown): boolean {
  return v === VERSAO_DOS_TERMOS;
}

/** Os textos do ecrã do primeiro acesso (Jurídico d20, §3). A app Pro recebe-os pela rota. */
export const TEXTOS_DA_ACEITACAO = {
  titulo: `As condições mudaram a ${PAGAMENTO_AO_PARCEIRO_DESDE_POR_EXTENSO}`,
  resumo:
    "Desde esse dia, o cliente paga-lhe diretamente — por transferência, MB WAY ou dinheiro no local — e passa " +
    "à CLYON a taxa da plataforma e o IVA dela, por referência do euPago, até " +
    `${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias depois de o trabalho ficar confirmado; passado esse prazo sem pagar, ` +
    "a conta fica em stand-by até pagar. Para receber trabalhos precisa do IBAN, do titular e do número MB WAY no " +
    `perfil (os aprovados antes dessa data têm até ${IBAN_E_MBWAY_OBRIGATORIOS_ATE_POR_EXTENSO}). Cada trabalho tem ` +
    `duas faturas: a da taxa, emitida pela ${EMPRESA_PARCEIRA_AO_PUBLICO}, e a do trabalho, emitida por si.`,
  ligacao: `Ler os Termos completos (versão de ${VERSAO_DOS_TERMOS_POR_EXTENSO})`,
  url: "/termos",
  caixa:
    `Li e aceito os Termos da CLYON, versão de ${VERSAO_DOS_TERMOS_POR_EXTENSO}, e aceito que se apliquem já, ` +
    "sem esperar pelo prazo de aviso.",
  /** A caixa do ecrã de criar a palavra-passe (só a caixa, por baixo da palavra-passe). */
  caixaDaPalavraPasse: `Li e aceito os Termos da CLYON, versão de ${VERSAO_DOS_TERMOS_POR_EXTENSO}.`,
  aceitar: "Aceitar e continuar",
  agoraNao: "Agora não",
} as const;
