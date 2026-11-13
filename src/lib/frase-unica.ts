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

/*
 * O QUE A CLYON FAZ, A MEIO DE UMA FRASE — d16 (I&D, 13-11-2026). Para os avisos
 * aos modelos da Vitória (a leitura das conversas, as lições, o orçamentista, o
 * resumo operacional, a compreensão): todos diziam «a CLYON organiza, guarda o
 * acordo e o pagamento», cada um à sua mão. Desde 15-11 o pagamento do trabalho
 * já não passa pela CLYON; os avisos lêem daqui, pela data.
 */
export const O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO = "a CLYON organiza, guarda o acordo e o pagamento";
export const O_QUE_A_CLYON_FAZ_NO_NOVO_MODELO =
  "a CLYON organiza e guarda o acordo, e o cliente paga o trabalho diretamente ao parceiro que contratou";

/** «a CLYON organiza…», para meio de frase, pela data do modelo. */
export function oQueAClyonFaz(agora: Date = new Date()): string {
  return novoModeloEmVigor(agora) ? O_QUE_A_CLYON_FAZ_NO_NOVO_MODELO : O_QUE_A_CLYON_FAZ_NO_MODELO_ANTIGO;
}

/**
 * A frase do topo, para o primeiro ecrã da app (E0) dizer o mesmo que o
 * início de um pedido: quem responde, com que preço, e quem escolhe.
 */
export const SUBTITULO_INICIAL =
  "Descreva o que precisa. Parceiros da sua zona respondem com o preço deles, e escolhe quem vai.";
