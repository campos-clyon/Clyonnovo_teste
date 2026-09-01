import { MINIMO_PARA_LEVANTAR } from "./carteira";
import { TAXA_PROFISSIONAL } from "./taxas-plataforma";

/**
 * A MENSAGEM QUE SE MANDA A UM PROFISSIONAL PARA ELE SE CANDIDATAR.
 *
 * PORQUE É QUE ISTO PRECISA DE EXISTIR
 *
 * Porque o convite acontece quase sempre pelo WhatsApp, e escrito à pressa. A
 * mensagem que sai à pressa diz «olha, entra aqui» e um link — e do outro lado
 * está alguém que nunca ouviu falar da CLYON, a quem se está a pedir o NIF.
 * Metade não abre, e de quem abre, metade escreve a perguntar o que já lá
 * devia estar: quanto é que vocês levam, tenho de pagar alguma coisa, quando é
 * que recebo.
 *
 * Escrita à mão, a resposta a essas perguntas muda de mensagem para mensagem —
 * e uma comissão dita de cabeça com um número a mais é uma promessa que
 * alguém vai cobrar. Os números daqui saem das mesmas constantes que o motor
 * usa. Se a comissão mudar, a mensagem muda sozinha.
 *
 * O QUE ELA NÃO FAZ: não vende, não elogia, não promete volume de trabalho que
 * não controlamos. Diz o que é, o que custa, e o que acontece a seguir. Quem
 * decide é quem a recebe.
 *
 * REGRA DE VOZ: quem faz o trabalho é ele. A CLYON liga as duas pontas e
 * garante o pagamento — nunca diz que recolhe, transporta ou esvazia seja o
 * que for.
 */

export type ConviteEmMensagem = {
  /** O primeiro nome, quando se sabe. Sem ele a mensagem cumprimenta na mesma. */
  nome?: string | null;
  /** O endereço para onde ele vai. Pessoal (com token) ou o aberto. */
  link: string;
  /**
   * Quando o link é de um convite pessoal, os dias que ele dura.
   *
   * Um link que morre sem aviso é um profissional que tenta na semana
   * seguinte, encontra uma página morta e conclui que desistimos dele. Sem
   * isto, não se escreve prazo nenhum — e não se inventa um.
   */
  diasDeValidade?: number | null;
  /** Quem convida, para a mensagem não chegar anónima. */
  deQuem?: string | null;
};

/**
 * O primeiro nome, que é como se trata alguém numa mensagem.
 *
 * «Olá, Transportes Silva Lda» não é uma pessoa a falar com outra.
 */
export function primeiroNome(nome: string | null | undefined): string | null {
  const limpo = (nome ?? "").trim();
  if (!limpo) return null;
  const primeiro = limpo.split(/\s+/)[0];
  /*
   * CONTAM-SE LETRAS, e não caracteres.
   *
   * «J. Silva» dá «J.», que tem dois caracteres e passava por um nome — a
   * mensagem saía «Olá, J.!», que lê pior do que não saudar ninguém. Um ponto
   * não é meia letra.
   */
  const letras = primeiro.replace(/[^\p{L}]/gu, "");
  return letras.length > 1 ? primeiro : null;
}

export function mensagemDeConvite(c: ConviteEmMensagem): string {
  const nome = primeiroNome(c.nome);
  const comissao = Math.round(TAXA_PROFISSIONAL * 100);

  const linhas: string[] = [];

  linhas.push(nome ? `Olá, ${nome}!` : "Olá!");
  linhas.push("");

  /*
   * O QUE É, numa frase, e do ponto de vista dele.
   *
   * Não «somos uma plataforma que liga clientes a profissionais» — isso
   * descreve-nos a nós. O que lhe interessa é que chegam pedidos e que já vêm
   * decididos.
   */
  linhas.push(
    "Sou da CLYON. Chegam-nos pedidos de recolha, transporte e esvaziamento em " +
      "Lisboa, Margem Sul e Setúbal, e procuramos profissionais para os fazer.",
  );
  linhas.push("");

  linhas.push("Como funciona, sem rodeios:");
  linhas.push("");
  linhas.push(
    "• O cliente descreve o trabalho com fotografias e diz quanto quer pagar. Você responde com um valor.",
  );
  linhas.push(
    `• Candidatar-se é gratuito. Não paga por contacto nem por proposta — a comissão é de ${comissao} % e só existe quando fecha um trabalho.`,
  );
  linhas.push(
    "• O cliente paga à CLYON quando o contrata e o valor fica cativo até estar feito. Não anda atrás de ninguém para receber.",
  );
  linhas.push(
    `• Levanta o saldo para a sua conta quando quiser, a partir de ${MINIMO_PARA_LEVANTAR} €.`,
  );
  linhas.push(
    "• Só recebe pedidos dos serviços que fizer e de trabalhos dentro dos quilómetros que indicar, a contar da sua base. É você que escolhe.",
  );
  linhas.push("");

  /*
   * A ANÁLISE, dita antes de ele carregar.
   *
   * Se souber só depois de preencher tudo, lê-se como um travão que ninguém
   * anunciou. Dita aqui, é um critério — e é o mesmo critério que faz o
   * cliente confiar em quem lhe aparece.
   */
  linhas.push(
    "Preencha a candidatura e nós analisamos. Se faltar alguma coisa, falo consigo. " +
      "Depois de aprovada, recebe por email o link para criar a palavra-passe e passa " +
      "a ver os pedidos da sua zona.",
  );
  linhas.push("");

  linhas.push(c.link);

  if (typeof c.diasDeValidade === "number" && c.diasDeValidade > 0) {
    linhas.push("");
    linhas.push(
      c.diasDeValidade === 1
        ? "O link é seu e dura 1 dia. Se expirar, diga-me e mando outro."
        : `O link é seu e dura ${c.diasDeValidade} dias. Se expirar, diga-me e mando outro.`,
    );
  }

  if (c.deQuem && c.deQuem.trim()) {
    linhas.push("");
    linhas.push(`— ${c.deQuem.trim()}, CLYON`);
  }

  return linhas.join("\n");
}
