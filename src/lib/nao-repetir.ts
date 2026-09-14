/**
 * JÁ DISSE ISTO A ESTA PESSOA, HÁ POUCO?
 *
 * Todas as mensagens do WhatsApp ficam gravadas em `whatsappMensagens` — as
 * que entram e as que saem — e há um leitor pronto, `mensagensDoNumeroWhatsApp`.
 * Só que o cérebro nunca o abria: escrevia a quem quer que fosse sem saber o
 * que já lhe tinha dito, nem quando, nem quantas vezes. A memória estava no
 * disco e ninguém a consultava.
 *
 * "Também não deve repetir informação." — 13-09-2026.
 *
 * ISTO É A REDE, NÃO O CHÃO. O que impede o assistente de se repetir é ele
 * responder a cada coisa com a resposta dela — e é isso que foi arranjado
 * primeiro. Esta guarda existe para as repetições que não se previram: seja
 * qual for o caminho que leve ao ponto de situação, se ele sair igualzinho ao
 * que saiu de manhã, não volta a sair.
 *
 * SÓ PARA O QUE SE PODE CALAR. Um ponto de situação repetido é ruído; uma
 * proposta nova, um fecho ou um aviso de data não são — esses têm as suas
 * próprias chaves de duplicação (`podeContarPelaPrimeiraVez`), que travam a
 * MESMA novidade e deixam passar uma novidade diferente com o mesmo aspecto.
 * Não se troca uma coisa pela outra.
 */

/** Quanto tempo uma mesma mensagem continua a ser uma repetição. */
export const HORAS_SEM_REPETIR = 6;

/**
 * E o mesmo, para TUDO o que o assistente escreve.
 *
 * "O assistente continua a fazer perguntas repetidas." — 14-09-2026, sobre
 * isto, numa conversa só:
 *
 *   19:54  Qual é a morada? Rua e número - é por aí que o profissional...
 *   19:54  Qual é a morada? Rua e número - é por aí que o profissional...
 *   19:54  Desculpe, não apanhei. Com quem estou a falar?
 *   19:56  Com quem estou a falar?
 *   19:58  Com quem estou a falar?
 *
 * Dez minutos e não seis horas: uma pergunta por responder pode ser repetida
 * mais tarde — isso é insistir, e é legítimo. O que não é legítimo é dizê-la
 * outra vez enquanto a anterior ainda está no ecrã dele.
 *
 * SE NÃO HÁ NADA DE NOVO A DIZER, é melhor não dizer nada: a mensagem do
 * cliente continua a ser lida na mesma, e o silêncio de dois minutos custa
 * menos do que a terceira cópia da mesma pergunta.
 */
export const MINUTOS_SEM_REPETIR_A_MESMA = 10;

export type SaidaGravada = {
  direccao: string;
  texto: string;
  criadoEm: string;
};

/** Espaços a mais, maiúsculas e pontuação não fazem de duas mensagens uma nova. */
function assinatura(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * O mesmo texto já saiu para este número dentro da janela?
 *
 * É pura de propósito: a decisão de calar o assistente merece um teste que a
 * interrogue com horas concretas, e não uma base de dados.
 */
export function jaFoiDito(
  texto: string,
  gravadas: SaidaGravada[],
  agora: Date,
  horas: number = HORAS_SEM_REPETIR,
): boolean {
  const alvo = assinatura(texto);
  if (!alvo) return false;
  const limite = agora.getTime() - horas * 3600_000;

  return gravadas.some((m) => {
    if (m.direccao !== "out") return false;
    const quando = new Date(m.criadoEm).getTime();
    // Uma data ilegível não pode fazer calar o assistente: na dúvida, fala.
    if (Number.isNaN(quando) || quando < limite) return false;
    return assinatura(m.texto) === alvo;
  });
}
