/**
 * CONTINUAR UMA CONVERSA DAS PROPOSTAS, À MÃO.
 *
 * "Cliquei em Reler e continuar e ele me deu essa resposta." — 13-09-2026,
 * sobre uma conversa onde a cliente escreveu «Não» às 14:22 e o assistente não
 * respondeu nada. O botão recusou-se a agir: «Este número já tem o pedido #311
 * a andar. A conversa dele é a das propostas, não a da recolha.»
 *
 * A recusa estava certa e era inútil. «Reler e continuar» foi feito para a
 * RECOLHA — ler o fio, reconstruir os campos, perguntar o que falta — e numa
 * conversa de propostas não há campos nenhuns para reconstruir. Só que quem
 * carrega no botão não está a pedir uma releitura: está a pedir que o
 * assistente CONTINUE. E para isso havia zero caminhos no painel.
 *
 * O QUE ESTE MÓDULO DECIDE, e porque é puro: se há alguma coisa para responder,
 * e se o assistente está em condições de falar. O «porquê não» é a metade que
 * faltava — um botão que não faz nada e não diz porquê manda a pessoa procurar
 * uma avaria que não existe.
 */

export type EstadoDaFala = {
  /** O interruptor geral do WhatsApp. */
  ligado: boolean;
  bloqueado: boolean;
  /** A conversa foi entregue a uma pessoa. */
  entregue: boolean;
};

export type UltimaDoCliente = {
  texto: string;
  quando: string;
} | null;

export type Veredicto =
  | { pode: true; ultima: { texto: string; quando: string } }
  | { pode: false; porque: string; comoSeResolve: string };

/**
 * O assistente pode continuar esta conversa agora?
 *
 * A ordem das recusas é a ordem em que elas mandam: um número bloqueado não se
 * resolve ligando o interruptor geral, e o interruptor geral cala toda a gente
 * independentemente do resto.
 */
export function podeContinuar(estado: EstadoDaFala, ultima: UltimaDoCliente): Veredicto {
  if (estado.bloqueado) {
    return {
      pode: false,
      porque: "Este número está bloqueado — o assistente não lhe escreve nada.",
      comoSeResolve: "Desbloqueie a conversa nesta mesma lista e tente outra vez.",
    };
  }
  if (estado.entregue) {
    return {
      pode: false,
      porque: "Esta conversa está entregue a uma pessoa — foi assumida no painel.",
      comoSeResolve:
        "Carregue em «Devolver ao assistente» nesta conversa, e depois em «Continuar a conversa».",
    };
  }
  /*
   * O INTERRUPTOR GERAL É O QUE NÃO SE VÊ NA LINHA.
   *
   * A linha da conversa diz «assistente» e oferece «Assumir» mesmo com o
   * WhatsApp desligado — o estado da linha lê-se dos bloqueados, das
   * arquivadas e das entregues, e nunca do interruptor de cima. É por aqui que
   * uma conversa parece viva e está muda: a mensagem do cliente é gravada, o
   * cérebro é chamado, e cala-se à entrada sem deixar rasto.
   */
  if (!estado.ligado) {
    return {
      pode: false,
      porque:
        "O WhatsApp está DESLIGADO no interruptor geral — o assistente não escreve a ninguém, " +
        "mesmo com a conversa a dizer «assistente».",
      comoSeResolve: "Ligue-o no topo deste ecrã («Ligar outra vez») e tente de novo.",
    };
  }
  if (!ultima || !ultima.texto.trim()) {
    return {
      pode: false,
      porque: "A última palavra é nossa — não há nada dele por responder.",
      comoSeResolve:
        "Escreva-lhe na caixa aqui em baixo, ou espere que ele responda ao que já lhe foi dito.",
    };
  }
  return { pode: true, ultima: { texto: ultima.texto.trim(), quando: ultima.quando } };
}

/** A última coisa que o CLIENTE escreveu, de um fio já ordenado do mais antigo. */
export function ultimaDoCliente(
  fio: Array<{ direccao: string; texto: string; criadoEm: string }>,
): UltimaDoCliente {
  for (let i = fio.length - 1; i >= 0; i -= 1) {
    const m = fio[i];
    if (m.direccao === "in" && m.texto.trim()) {
      return { texto: m.texto, quando: m.criadoEm };
    }
  }
  return null;
}

/** O que vai acontecer, dito a quem carrega no botão antes de o cliente ouvir. */
export function oQueVaiFazer(pedidoId: number, ultima: string): string {
  return (
    `Volto a passar pelo assistente a última mensagem dele — «${ultima.trim()}» — ` +
    `como se tivesse acabado de chegar, no pedido #${pedidoId}.\n\n` +
    `Ele responde o que teria respondido na altura. Não inventa nada nem repete o que já disse.`
  );
}
