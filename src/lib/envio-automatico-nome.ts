/**
 * Os nomes dos interruptores das Configs do envio automático, num ficheiro sem
 * dependências: o painel das Configs (no browser) importa-os sem trazer as
 * regras do envio automático, que dependem das da Vitória.
 *
 * d87 (22-11-2026): o interruptor de emergência. d88 (23-11-2026): passa a
 * valer para todas as origens (simulador, formulário, WhatsApp, registado na
 * Mesa), e a segunda chave volta ao comportamento da d87 — só os da Vitória.
 */
export const NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO = "Envio automático aos parceiros (todas as origens)";

/** A segunda chave (d88): DESLIGADA por omissão — ligada, só seguem sozinhos os que a Vitória completa. */
export const NOME_DO_INTERRUPTOR_SO_DA_VITORIA = "Só os da Vitória";
