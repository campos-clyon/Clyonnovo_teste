/**
 * O PRAZO DA d112, sozinho — para o painel o poder ler sem trazer as regras.
 * Ver `volta-a-vitoria.ts`.
 */

/** As horas sem a equipa escrever ao fim das quais a conversa respondida à mão volta à Vitória. */
export const HORAS_PARA_VOLTAR_A_VITORIA = 24;

/** O motivo que a ponte grava quando alguém da equipa responde à mão no telemóvel. */
export const MOTIVO_DA_RESPOSTA_A_MAO = "Respondeu à mão no WhatsApp";

/** O que a Mesa mostra, em vez de «Entregue», numa conversa que voltou. */
export const VOLTOU_A_VITORIA = `Voltou à Vitória (${HORAS_PARA_VOLTAR_A_VITORIA} h sem a equipa)`;
