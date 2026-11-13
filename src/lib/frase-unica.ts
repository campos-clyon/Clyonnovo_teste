import { novoModeloEmVigor } from "./novo-modelo";

/**
 * A FRASE ÚNICA DA CLYON — voz de plataforma (regra do dono, 27-10-2026).
 *
 * Igual carácter a carácter em todo o lado onde aparece: a CLYON é uma
 * plataforma — profissionais fazem o trabalho, a CLYON organiza,
 * guarda o acordo e o pagamento. A app de cliente não a escreve: lê-a do
 * catálogo (`GET /api/cliente/catalogo`, R7), que a lê daqui.
 */
const FRASE_UNICA_DO_MODELO_ANTIGO =
  "Parceiros fazem o trabalho; a CLYON organiza, guarda o acordo e o pagamento.";
/** A de sempre (antes de 15-11-2026). */
export const FRASE_UNICA = FRASE_UNICA_DO_MODELO_ANTIGO;

/**
 * DESDE 15-11-2026 (d16): o cliente paga ao parceiro — a CLYON organiza e guarda o
 * acordo, e o pagamento do trabalho já não passa por ela.
 */
export const FRASE_UNICA_NO_NOVO_MODELO =
  "Parceiros fazem o trabalho e recebem o pagamento; a CLYON organiza e guarda o acordo.";

/** A frase única, pela data do modelo (`novo-modelo.ts`). */
export function fraseUnica(agora: Date = new Date()): string {
  return novoModeloEmVigor(agora) ? FRASE_UNICA_NO_NOVO_MODELO : FRASE_UNICA_DO_MODELO_ANTIGO;
}

/**
 * A frase do topo, para o primeiro ecrã da app (E0) dizer o mesmo que o
 * início de um pedido: quem responde, com que preço, e quem escolhe.
 */
export const SUBTITULO_INICIAL =
  "Descreva o que precisa. Parceiros da sua zona respondem com o preço deles, e escolhe quem vai.";
