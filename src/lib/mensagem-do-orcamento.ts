import { saudacao } from "./whatsapp-recolha";
import { primeiroNome } from "./mensagem-whatsapp";
import { type BaseDoPreco } from "./base-do-preco";
import { extraNoLocal, INCLUI, oQueGanha, valorComIva } from "./extra-no-local";
import { QUEM_FAZ_NO_VALOR_UNICO_CURTO } from "./valor-unico-ao-cliente";

export { eurosCurtos, extraComPreco, extraNoLocal, INCLUI, oQueGanha, TABELA_DAS_PECAS_CURTA, valorComIva } from "./extra-no-local";

/**
 * A MENSAGEM DO ORÇAMENTO, CURTA — 15-11-2026 (decisão d47).
 *
 * O #623 (cliente que fala inglês): o «Enviar pela CLYON» saiu duas vezes,
 * em português e em inglês, e longa. O dono: mensagens menores, precisas,
 * directas, sem ser grosseiro — e que digam SEMPRE o que o valor cobre e que
 * o que houver a mais no local se paga à parte. Quatro partes:
 *
 *   (a) o valor: «X € + IVA = Y €» (nunca o sem IVA sozinho);
 *   (b) o que cobre: «Inclui o que está nas fotografias e na descrição.»;
 *   (c) o extra, com preço: a tabela das peças, os sacos, as horas, a carga;
 *   (d) como se paga, conforme o modelo do trabalho, e o próximo passo.
 *
 * Exemplo (Trabalho CLYON, recolha de monos; texto do Vendas desde 17-11-2026, d66):
 *
 *   Boa noite, Jason! O orçamento para a recolha de monos em Campo de Ourique é 105 € + IVA = 129,15 €.
 *   Inclui o que está nas fotografias e na descrição. O parceiro carrega e leva tudo: não tem de mexer
 *   em nada. O que aparecer a mais combina-se consigo antes de carregar, pela tabela (peça pequena 15 €,
 *   média 30 €, grande 65 € a primeira e 50 € as seguintes, + IVA).
 *   Paga à CLYON depois do trabalho feito.
 *   Responda SIM e reservamos o parceiro; o dia combina-se consigo.
 *
 * SEM EMOJI (d66): o link do WhatsApp estragava os caracteres acima de U+FFFF
 * («�» no lugar do 😊). O teste chumba um que volte.
 *
 * Os números saem das fontes únicas (`precos-publicos.ts`), por `extra-no-local.ts`.
 * A mensagem nasce em português e sai na língua do cliente, UMA vez (o canal traduz).
 */

/** O tecto da mensagem, sem contar o nome, o serviço e a zona — o teste guarda-o. */
export const TAMANHO_MAXIMO_DO_ORCAMENTO = 480;

/** (d) Como se paga, conforme o modelo do trabalho. */
export type ModeloDoOrcamento = "clyon" | "parceiro" | "valor_unico";

/** Trabalho CLYON e modelo antigo: o cliente paga à CLYON (regra s da orquestra: o nome diz «antigo»). */
export const PAGA_A_CLYON_NO_MODELO_ANTIGO = "Paga à CLYON depois do trabalho feito.";
export const PAGA_AO_PARCEIRO = "Paga ao parceiro no dia.";
/** O valor único: quem faz, encurtado (o «verificado» vive em `valor-unico-ao-cliente.ts`). */
export const QUEM_FAZ_CURTO = QUEM_FAZ_NO_VALOR_UNICO_CURTO;

export function comoSePaga(modelo: ModeloDoOrcamento): string {
  if (modelo === "parceiro") return PAGA_AO_PARCEIRO;
  if (modelo === "valor_unico") return QUEM_FAZ_CURTO;
  return PAGA_A_CLYON_NO_MODELO_ANTIGO;
}

/** O próximo passo (d66: sem emoji). */
export const RESPONDA_SIM_CURTO = "Responda SIM e reservamos o parceiro; o dia combina-se consigo.";
export const RESPONDA_SIM_COM_QUEM = "Responda SIM e fica reservado.";

/** «Boa noite, Jason!» — ou «Boa noite!». */
export function saudacaoCurta(nome: string | null | undefined, agora: Date): string {
  const p = primeiroNome(nome);
  return p ? `${saudacao(agora)}, ${p}!` : `${saudacao(agora)}!`;
}

export type DadosDoOrcamento = {
  cliente: string | null | undefined;
  /** «a recolha de monos», já com o artigo; sem ele, «o seu pedido». */
  servicoComArtigo: string | null | undefined;
  /** O id do serviço, para a regra do extra. */
  servicoId: string | null | undefined;
  localidade?: string | null;
  semIva: number;
  total: number;
  base?: BaseDoPreco | null;
  modelo: ModeloDoOrcamento;
  /** «, para sábado, 21 de novembro» — já escrito, ou nada. */
  paraQuando?: string;
  /** O parceiro já está escolhido: o passo seguinte é só o dia. */
  comQuemJaEscolhido?: boolean;
  /** «Mudanças Exemplo, parceiro da CLYON» (`parceiroNaFrase`): quem faz, quando já se sabe (d12). */
  quemFaz?: string | null;
};

const unidade = (b: BaseDoPreco | null | undefined) => (b === "carga" ? " por carga" : b === "hora" ? " por hora" : "");

/** A localidade sem o «Lisboa» colado do simulador: «Campo de Ourique Lisboa» → «Campo de Ourique». */
export function zonaCurta(localidade: string | null | undefined): string | null {
  const l = (localidade ?? "").replace(/\s*,?\s*portugal\s*$/i, "").trim();
  if (!l) return null;
  const m = l.match(/^(.+?)\s*,?\s+(Lisboa|Porto)$/);
  return m && m[1].trim().length > 2 ? m[1].trim() : l;
}

/** As quatro partes, uma por linha. */
export function linhasDoOrcamento(d: DadosDoOrcamento, agora: Date): string[] {
  const zona = zonaCurta(d.localidade);
  const oQue = `${d.servicoComArtigo?.trim() || "o seu pedido"}${zona ? ` em ${zona}` : ""}`;
  return [
    `${saudacaoCurta(d.cliente, agora)} O orçamento para ${oQue}${d.paraQuando ? `${d.paraQuando},` : ""} é ${valorComIva(d.semIva, d.total)}${unidade(d.base)}.`,
    [INCLUI, oQueGanha(d.servicoId), extraNoLocal(d.servicoId, d.base ?? "total")].filter(Boolean).join(" "),
    comoSePaga(d.modelo),
    d.quemFaz?.trim()
      ? `O trabalho é feito por ${d.quemFaz.trim()}. ${RESPONDA_SIM_COM_QUEM}`
      : d.comQuemJaEscolhido
        ? RESPONDA_SIM_COM_QUEM
        : RESPONDA_SIM_CURTO,
  ];
}

export function mensagemDoOrcamento(d: DadosDoOrcamento, agora: Date): string {
  return linhasDoOrcamento(d, agora).join("\n");
}
