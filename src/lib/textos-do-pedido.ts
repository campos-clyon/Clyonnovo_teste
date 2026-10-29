import { PRAZO_DE_RESPOSTA } from "./seo-data";

/**
 * OS TEXTOS DO PEDIDO QUE O SITE E A APP DIZEM IGUAL — 29-10-2026 (S12).
 *
 * Estavam escritos dentro do simulador do site; o catálogo da app de cliente
 * (R7) serve-os daqui, e o simulador também os lê daqui.
 */

/** Os três passos do «Pedido enviado» (G4). */
export const TRES_PASSOS_DEPOIS_DE_ENVIAR: ReadonlyArray<{ titulo: string; texto: string }> = [
  {
    titulo: "A CLYON confere o pedido e envia-o aos profissionais da sua zona",
    texto: "Verificados, com nota dada por quem já os contratou.",
  },
  {
    titulo: `Recebe propostas em menos de ${PRAZO_DE_RESPOSTA.porExtenso}`,
    texto: "Cada uma com preço fechado, com IVA incluído, antes de haver trabalho nenhum.",
  },
  {
    titulo: "Escolhe uma — ou nenhuma",
    texto:
      "Depois de aceitar, recebe a referência para pagar; o profissional só recebe " +
      "depois de confirmar que ficou feito. Recusar não custa nada.",
  },
];

/** «Podem mostrar as minhas fotos…» — a caixa do simulador, numa só frase. */
export const AUTORIZA_FOTOS =
  "Podem mostrar as minhas fotos no site e nas redes da CLYON (opcional), sem nada que me identifique — nem pessoas, nem morada.";

/** Quem faz o trabalho — o rodapé do pedido. */
export const QUEM_FAZ_O_TRABALHO = "O trabalho é feito pelo profissional que escolher.";
