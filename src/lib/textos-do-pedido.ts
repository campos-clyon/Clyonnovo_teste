import { PRAZO_DE_RESPOSTA } from "./seo-data";
import { novoModeloEmVigor } from "./novo-modelo";

/**
 * OS TEXTOS DO PEDIDO QUE O SITE E A APP DIZEM IGUAL — 29-10-2026 (S12).
 *
 * Estavam escritos dentro do simulador do site; o catálogo da app de cliente
 * (R7) serve-os daqui, e o simulador também os lê daqui.
 */

/** Os três passos do «Pedido enviado» (G4) — os de antes de 15-11-2026. */
const TRES_PASSOS_DO_MODELO_ANTIGO: ReadonlyArray<{ titulo: string; texto: string }> = [
  {
    titulo: "A CLYON confere o pedido e envia-o aos parceiros da sua zona",
    texto: "Com nota dada por quem já os contratou.",
  },
  {
    titulo: `Recebe propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`,
    texto: "Cada uma com preço fechado, com IVA incluído, antes de haver trabalho nenhum.",
  },
  {
    titulo: "Escolhe uma — ou nenhuma",
    texto:
      "Depois de aceitar, recebe a referência para pagar; o parceiro só recebe " +
      "depois de confirmar que ficou feito. Recusar não custa nada.",
  },
];
/** O de sempre — a app de cliente lê-o pelo catálogo (`tresPassosDepoisDeEnviar` escolhe pela data). */
export const TRES_PASSOS_DEPOIS_DE_ENVIAR = TRES_PASSOS_DO_MODELO_ANTIGO;

/**
 * DESDE 15-11-2026 (d16): o cliente paga diretamente ao parceiro, pelos dados que
 * aparecem no pedido — não recebe referência nenhuma. Sem «quando» se paga.
 */
const PASSO_DE_ESCOLHER_NO_NOVO_MODELO = {
  titulo: "Escolhe uma — ou nenhuma",
  texto:
    "Depois de aceitar, paga diretamente ao parceiro — por transferência, MB WAY ou dinheiro —, " +
    "pelos dados que aparecem no seu pedido. Recusar não custa nada.",
};
const TRES_PASSOS_NO_NOVO_MODELO: ReadonlyArray<{ titulo: string; texto: string }> = [
  TRES_PASSOS_DO_MODELO_ANTIGO[0],
  TRES_PASSOS_DO_MODELO_ANTIGO[1],
  PASSO_DE_ESCOLHER_NO_NOVO_MODELO,
];

/** Os três passos do «Pedido enviado», pela data do modelo (`novo-modelo.ts`). */
export function tresPassosDepoisDeEnviar(agora: Date = new Date()): ReadonlyArray<{ titulo: string; texto: string }> {
  return novoModeloEmVigor(agora) ? TRES_PASSOS_NO_NOVO_MODELO : TRES_PASSOS_DO_MODELO_ANTIGO;
}

/**
 * Os três passos do «Pedido enviado» numa MUDANÇA COM A LISTA DE PARCEIROS
 * (10-11-2026): o pedido não espera pela CLYON, já foi aos escolhidos.
 */
export const PASSOS_DA_MUDANCA_COM_ESCOLHA: ReadonlyArray<{ titulo: string; texto: string }> = [
  {
    titulo: "O pedido já seguiu para os parceiros que escolheu",
    texto: "Cada um recebe-o com os preços que viu na lista, que ficam guardados para este pedido.",
  },
  {
    titulo: "Cada parceiro responde com a data e o orçamento",
    texto:
      "A estimativa conta as horas habituais numa casa como a sua; o valor final conta as horas feitas, " +
      "os quilómetros e o material, com IVA incluído.",
  },
  TRES_PASSOS_DO_MODELO_ANTIGO[2],
];

/**
 * Os mesmos três passos, a dizer a quantos parceiros o pedido foi (11-11-2026):
 * «O pedido já seguiu para os 2 parceiros que escolheu». O simulador do site e
 * a app de cliente (pela resposta do `POST /api/simulador/pedido`) dizem isto.
 */
export function passosDaMudancaComEscolha(
  quantos: number,
  agora: Date = new Date(),
): ReadonlyArray<{ titulo: string; texto: string }> {
  const n = Math.max(1, Math.floor(quantos));
  const titulo =
    n === 1 ? "O pedido já seguiu para o parceiro que escolheu" : `O pedido já seguiu para os ${n} parceiros que escolheu`;
  return [{ ...PASSOS_DA_MUDANCA_COM_ESCOLHA[0], titulo }, PASSOS_DA_MUDANCA_COM_ESCOLHA[1], tresPassosDepoisDeEnviar(agora)[2]];
}

/** «Podem mostrar as minhas fotos…» — a caixa do simulador, numa só frase. */
export const AUTORIZA_FOTOS =
  "Podem mostrar as minhas fotos no site e nas redes da CLYON (opcional), sem nada que me identifique — nem pessoas, nem morada.";

/** Quem faz o trabalho — o rodapé do pedido. */
export const QUEM_FAZ_O_TRABALHO = "O trabalho é feito pelo parceiro que escolher.";
