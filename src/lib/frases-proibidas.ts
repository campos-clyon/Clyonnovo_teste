/*
 * AS FRASES QUE A CLYON NÃO DIZ, NUM SÍTIO SÓ — 27-10-2026 (decisão d12).
 *
 * A Vitória tem de as conhecer para não as dizer: o aviso ao modelo cita-as
 * («nunca "no próprio dia"»), e a guarda das lições reconhece-as. Escritas à
 * mão em cada aviso, o teste da orquestra (orquestra.test.ts) não distinguia
 * a citação da promessa, e ficavam como excepções.
 *
 * Agora escrevem-se aqui UMA vez. Os avisos montam-se a partir destas
 * constantes, e o teste da orquestra lê este ficheiro como a fonte (não como
 * texto que alguém lê) e prova que cada uma é apanhada pela regra dela —
 * se uma regra deixar de apanhar a frase, o teste chumba.
 *
 * Sem imports de propósito.
 */

/** Regra c): a data é do profissional — nunca se promete. */
export const PROPRIO_DIA = "próprio dia";

/** Regra b): quem faz o trabalho é o profissional escolhido, não a CLYON. */
export const NOSSA_EQUIPA = "nossa equipa";

/**
 * Regra a): o «você» como o cliente o escreve no telemóvel, sem acento. Não é
 * para dizer: é para RECONHECER (palavra vazia nas perguntas repetidas).
 */
export const VOCE_SEM_ACENTO: readonly string[] = ["voces", "voce"];

/** Tudo, para o teste da orquestra provar que as regras as apanham. */
export const FRASES_PROIBIDAS = {
  promessa: [PROPRIO_DIA],
  voz: [NOSSA_EQUIPA],
  brasil: VOCE_SEM_ACENTO,
} as const;
