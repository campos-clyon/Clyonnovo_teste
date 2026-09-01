/**
 * A CLYON JÁ COBRA O CLIENTE? — e o que se lhe diz enquanto não cobra.
 *
 * ISTO NASCEU DE UMA COISA QUE ESTAVA ERRADA E NÃO ERA UMA FUNCIONALIDADE EM
 * FALTA.
 *
 * A carteira do cliente dizia: «Quando aceita uma proposta, o valor fica do
 * lado da CLYON e não chega ao profissional.» A do profissional dizia: «Quando
 * o cliente o contrata, paga logo à CLYON — e o valor fica retido.» E o site
 * público dizia a mesma coisa a quem ainda nem tinha conta.
 *
 * Nenhuma das três era verdade. Não há — hoje — nenhuma forma de o cliente
 * pagar à CLYON: nem um processador de pagamentos, nem um IBAN mostrado, nem
 * uma referência gerada. Não é uma peça por acabar; é uma peça que nunca foi
 * começada, e à volta dela construiu-se um discurso inteiro que a dava por
 * feita. Um saldo «cativo» que ninguém cativou, uma confirmação que «liberta»
 * dinheiro que nunca entrou, e um profissional a decidir se vai a um trabalho
 * com base numa garantia que não existe.
 *
 * PORQUE É QUE ISTO É UM FICHEIRO E NÃO FORAM QUATRO EDIÇÕES DE TEXTO
 *
 * Porque a cobrança VAI existir, e no dia em que existir todas essas frases
 * voltam a ser verdadeiras — palavra por palavra. Corrigir os quatro sítios à
 * mão significava reescrevê-los agora e reescrevê-los outra vez a seguir, com
 * a certeza de que um deles ficava para trás.
 *
 * Aqui há um interruptor só. Enquanto `A_PLATAFORMA_COBRA` for `false`, todo o
 * produto descreve o que acontece mesmo. No dia em que a fase 1 aterrar, passa
 * a `true` e o produto volta a descrever a caução — e nessa altura estará a
 * dizer a verdade.
 *
 * E HÁ UM TESTE A GUARDAR ISTO. `promessa-do-dinheiro.test.ts` procura as
 * frases antigas no código e falha se alguma voltar enquanto o interruptor
 * estiver em `false`. Não é zelo a mais: a frase que se apagou hoje é
 * exactamente a que alguém volta a escrever daqui a três meses, de boa-fé, por
 * lhe parecer que descreve o modelo.
 */

/**
 * A plataforma cobra o cliente e guarda o dinheiro até à confirmação?
 *
 * Passa a `true` quando — e SÓ quando — existir cobrança a sério: o cliente
 * paga na plataforma, o valor fica retido, e a confirmação liberta-o. Ver a
 * fase 1 do plano. Mexer nisto antes disso é voltar a prometer o que não se
 * cumpre.
 */
export const A_PLATAFORMA_COBRA = false;

/**
 * O QUE SE DIZ SOBRE O DINHEIRO, NOS DOIS ESTADOS.
 *
 * As duas versões vivem lado a lado de propósito. Ler as duas ao mesmo tempo é
 * a forma mais rápida de perceber o que muda quando a cobrança entrar — e de
 * ver que a versão de hoje não é uma desculpa, é uma descrição.
 */
type Promessa = {
  /** O título da nota na carteira do cliente. */
  clienteTitulo: string;
  /** O corpo dessa nota. */
  clienteCorpo: string;
  /** O rótulo do número grande da carteira do cliente. */
  clienteRotuloDoTotal: string;
  /** A linha por baixo do número, quando há valor em jogo. */
  clienteTotalComValor: string;
  /** A mesma linha, quando não há nada em jogo. */
  clienteTotalVazio: string;
  /** O título da nota na carteira do profissional. */
  proTitulo: string;
  /** O corpo dessa nota. */
  proCorpo: string;
  /** O rótulo do saldo que ainda não pode levantar. */
  proRotuloDoCativo: string;
  /** O botão com que o cliente dá o trabalho por feito. */
  botaoDeConfirmar: string;
  /** O que se lhe diz depois de carregar. */
  depoisDeConfirmar: string;
  /** A explicação do prazo automático, sem o número de dias. */
  prazoAutomatico: string;
  /** A resposta pública a «é a CLYON que faz o trabalho?». */
  faqQuemFaz: string;
  /** O passo «escolhe, e só depois se paga» do «como funciona». */
  faqComoSePaga: string;
  /*
   * OS EMAILS, e são os que mais custam ter errados.
   *
   * O primeiro é a linha com que se diz a um profissional que o trabalho é
   * dele. É com ela na mão que ele decide se vai — e prometer-lhe uma garantia
   * que não existe é pedir-lhe que arrisque a manhã sobre uma coisa falsa.
   */
  /** Ao profissional, no email que lhe diz que foi contratado. */
  emailProAoContratar: string;
  /** Ao profissional, sobre para que serve a fotografia do trabalho feito. */
  emailProParaQueServeAProva: string;
  /** Ao cliente, no email que lhe pede para confirmar. */
  emailClienteAoPedirConfirmacao: string;
  /** Ao cliente, sobre o que acontece se ele não responder. `{DIAS}` no meio. */
  emailClientePrazo: string;
  /** Ao cliente, na ficha do trabalho em curso. `{PRO}` é o nome do profissional. */
  clienteEmCurso: string;
  /** Ao profissional, no ecrã em que ele acaba de ser contratado. */
  proAoFechar: string;
  /** O argumento de recrutamento — título e corpo do cartão. */
  recrutamentoTitulo: string;
  recrutamentoCorpo: string;
  /** A resposta pública a «quem responde por um trabalho mal feito?». */
  faqQuemResponde: string;
  /** A linha do WhatsApp que explica para que serve confirmar. */
  whatsappConfirmar: string;
  /** O selo de confiança na página inicial, na parte dos profissionais. */
  seloDaPaginaInicial: string;
  /** A descrição da página de profissionais — é o que o Google mostra. */
  metaDosProfissionais: string;
  /** No backoffice, o que falta acontecer a um trabalho com prova enviada. */
  backofficeAConfirmar: string;
};

/** Com cobrança: a caução é real, e diz-se. */
const COM_COBRANCA: Promessa = {
  clienteTitulo: "Porque é que o valor fica retido",
  clienteCorpo:
    "Quando aceita uma proposta, o valor fica do lado da CLYON e não chega ao " +
    "profissional. Só sai depois de confirmar que o trabalho está feito — e é " +
    "por isso que a confirmação é sua e de mais ninguém. Se alguma coisa correr " +
    "mal antes disso, o dinheiro ainda está cá.",
  clienteRotuloDoTotal: "Retido",
  clienteTotalComValor:
    "Está guardado connosco e ainda não chegou a ninguém. Só sai quando confirmar que o trabalho está feito.",
  clienteTotalVazio: "Não tem nada retido de momento.",
  proTitulo: "Porque é que há dinheiro cativo",
  proCorpo:
    "Quando o cliente o contrata, paga logo à CLYON — e o valor fica retido. É a " +
    "garantia dele de que o trabalho é feito, e a sua de que o dinheiro existe e " +
    "não depende de ninguém se lembrar de pagar. Assim que ele confirmar, ou ao " +
    "fim de sete dias sem resposta, o valor passa a disponível.",
  proRotuloDoCativo: "Valor cativo",
  botaoDeConfirmar: "Está bem feito, libertar o pagamento",
  depoisDeConfirmar: "Confirmou que está feito e o pagamento foi libertado. Obrigado.",
  prazoAutomatico:
    "Se não disser nada, o valor é libertado sozinho daqui a {DIAS}. Se alguma coisa estiver mal, fale connosco antes disso.",
  faqQuemFaz:
    "Não. A CLYON é a plataforma que liga o seu pedido a profissionais verificados da sua " +
    "zona. Quem desmonta, carrega e transporta é o profissional que escolher — e o " +
    "pagamento só é libertado depois de o trabalho estar confirmado.",
  faqComoSePaga:
    "Quando aceita, o valor fica retido e o profissional recebe os dados para lá ir. O " +
    "dinheiro só é libertado depois de o trabalho estar feito e confirmado.",
  emailProAoContratar:
    "O valor está retido na CLYON e é libertado assim que ele confirmar que está feito.",
  emailProParaQueServeAProva:
    "É a fotografia que permite ao cliente confirmar — e é a confirmação que liberta o pagamento.",
  emailClienteAoPedirConfirmacao: "Veja e confirme — é a confirmação que liberta o pagamento.",
  emailClientePrazo:
    "Se não disser nada, o pagamento é libertado sozinho daqui a {DIAS}. Se alguma coisa estiver mal, responda a este email antes disso — tratamos do assunto.",
  clienteEmCurso:
    "O valor fica retido na CLYON e só chega a {PRO} depois de o trabalho estar feito e de si o confirmar aqui.",
  proAoFechar:
    "O valor fica retido e é libertado quando o cliente confirmar que está feito. Vamos enviar-lhe a morada e o contacto por email.",
  recrutamentoTitulo: "Pagamento garantido",
  recrutamentoCorpo:
    "O cliente paga à plataforma quando o contrata. O valor fica retido e é seu assim que " +
    "ele confirmar que o trabalho está feito — não anda atrás de ninguém para receber.",
  faqQuemResponde:
    "O profissional que o executou, e a CLYON só liberta o pagamento depois de o cliente " +
    "confirmar. Cada profissional tem nota e historial avaliados por quem já o contratou.",
  whatsappConfirmar:
    "No link em baixo acompanha o trabalho e confirma-o quando estiver feito — é isso que liberta o pagamento ao profissional.",
  seloDaPaginaInicial: "Pagamento garantido",
  metaDosProfissionais:
    "Inscreva-se e receba pedidos com fotografias, zona e o valor que o cliente quer pagar. " +
    "Responde com um valor e sabe o que recebe antes de aceitar. Pagamento garantido pela plataforma.",
  backofficeAConfirmar:
    "O valor fica cativo até alguém confirmar — e é a confirmação que fecha o pedido e liberta o pagamento dele.",
};

/**
 * Sem cobrança: o que acontece mesmo.
 *
 * O tom não é de desculpa e não devia ser. O que a plataforma faz hoje —
 * encontrar o profissional, pôr as duas partes a acordar um valor por escrito,
 * guardar o acordo, e ficar como sítio a quem se recorre se correr mal — é
 * exactamente o que a Fixando faz, e a Fixando escreve-o no site sem qualquer
 * embaraço: «Quando o serviço estiver concluído, efetue o pagamento
 * diretamente ao especialista.»
 *
 * A palavra que desaparece daqui é «retido», e desaparece em todo o lado. Fica
 * «combinado» — que é o que o número é: o que as duas partes disseram que ia
 * ser pago, escrito num sítio onde nenhuma delas o pode mudar sozinha.
 */
const SEM_COBRANCA: Promessa = {
  clienteTitulo: "Como é que o pagamento funciona",
  clienteCorpo:
    "O valor que vê aqui é o que combinou com o profissional, e é a ele que o " +
    "paga — no fim do trabalho, quando estiver satisfeito. A CLYON não recebe " +
    "esse dinheiro nem lho cobra: guarda o acordo, para que nenhum dos dois o " +
    "possa mudar sozinho, e fica como sítio a quem recorrer se alguma coisa " +
    "correr mal. Dar o trabalho por feito aqui é o que fecha o acordo dos dois " +
    "lados.",
  clienteRotuloDoTotal: "Combinado",
  clienteTotalComValor:
    "É o que acordou e ainda não pagou. Paga ao profissional quando o trabalho estiver feito.",
  clienteTotalVazio: "Não tem nada combinado de momento.",
  proTitulo: "Porque é que há valor por receber",
  proCorpo:
    "É o que ficou combinado com o cliente e ainda não foi dado por feito — já " +
    "com a taxa da CLYON descontada, para não ver aqui um número que não é seu. " +
    "Quem lhe paga é o cliente, no fim do trabalho, e não a CLYON: este saldo " +
    "diz o que tem a receber, não dinheiro que esteja guardado. Assim que o " +
    "cliente confirmar, ou ao fim de sete dias sem resposta, o trabalho passa a " +
    "fechado.",
  proRotuloDoCativo: "Por receber",
  botaoDeConfirmar: "Está bem feito, dar por concluído",
  depoisDeConfirmar: "Deu o trabalho por concluído. Obrigado.",
  prazoAutomatico:
    "Se não disser nada, o trabalho é dado por concluído sozinho daqui a {DIAS}. Se alguma coisa estiver mal, fale connosco antes disso.",
  faqQuemFaz:
    "Não. A CLYON é a plataforma que liga o seu pedido a profissionais verificados da sua " +
    "zona. Quem desmonta, carrega e transporta é o profissional que escolher — e é a ele " +
    "que paga, no fim do trabalho.",
  faqComoSePaga:
    "Quando aceita, o valor fica combinado por escrito e o profissional recebe os dados " +
    "para lá ir. Paga-lhe diretamente no fim, quando o trabalho estiver feito.",
  emailProAoContratar:
    "O valor ficou combinado por escrito na CLYON e é o cliente que lho paga, no fim do trabalho.",
  emailProParaQueServeAProva:
    "É a fotografia que permite ao cliente dar o trabalho por feito — e é isso que fecha o acordo dos dois lados.",
  emailClienteAoPedirConfirmacao:
    "Veja e confirme que está tudo bem antes de lhe pagar.",
  emailClientePrazo:
    "Se não disser nada, o trabalho é dado por concluído sozinho daqui a {DIAS}. Se alguma coisa estiver mal, responda a este email antes disso — tratamos do assunto.",
  clienteEmCurso:
    "O valor que combinou com {PRO} paga-o a {PRO} no fim, quando o trabalho estiver feito e depois de o confirmar aqui.",
  proAoFechar:
    "O valor ficou combinado por escrito e é o cliente que lho paga, no fim do trabalho. Vamos enviar-lhe a morada e o contacto por email.",
  /*
   * O CARTÃO DE RECRUTAMENTO É O QUE MAIS CUSTAVA TER ERRADO.
   *
   * Dizia «Pagamento garantido» a quem estava a decidir inscrever-se, e a
   * garantia não existia. O que existe — e é verdade, e continua a ser um bom
   * argumento — é que o valor é acordado por escrito antes de ele sair de casa,
   * e que a plataforma fica com o acordo. É menos do que uma garantia e é muito
   * mais do que um telefonema.
   */
  recrutamentoTitulo: "Valor combinado por escrito",
  recrutamentoCorpo:
    "O preço fica acordado antes de sair de casa, escrito na plataforma, e nem o cliente " +
    "nem ninguém o muda sozinho — se o trabalho mudar à porta, corrige-se aqui, com " +
    "registo. Recebe do cliente no fim, e a CLYON fica como testemunha do que ficou " +
    "combinado.",
  faqQuemResponde:
    "O profissional que o executou. A CLYON guarda o acordo, as fotografias do trabalho " +
    "feito e a sua confirmação — e é a quem recorre se alguma coisa correr mal. Cada " +
    "profissional tem nota e historial avaliados por quem já o contratou.",
  whatsappConfirmar:
    "No link em baixo acompanha o trabalho e confirma-o quando estiver feito — é isso que fecha o acordo dos dois lados.",
  seloDaPaginaInicial: "Valor acordado por escrito",
  metaDosProfissionais:
    "Inscreva-se e receba pedidos com fotografias, zona e o valor que o cliente quer pagar. " +
    "Responde com um valor e sabe o que recebe antes de aceitar — acordado por escrito antes de sair de casa.",
  /*
   * O BACKOFFICE TAMBÉM LÊ, e a equipa que atende o telefone é quem mais
   * precisa de saber a verdade: é ela que responde quando um profissional
   * pergunta onde está o dinheiro dele.
   */
  backofficeAConfirmar:
    "Falta o cliente confirmar — é a confirmação que fecha o pedido. O valor é pago pelo cliente ao profissional; a CLYON não o tem.",
};

/** O que dizer sobre o dinheiro, conforme a plataforma já o cobra ou não. */
export const PROMESSA: Promessa = A_PLATAFORMA_COBRA ? COM_COBRANCA : SEM_COBRANCA;

/**
 * O prazo automático, com os dias já escritos por extenso.
 *
 * A frase vive aqui inteira e não em pedaços colados no ecrã: partida em três
 * bocados, metade dela escapava a este ficheiro e continuava a falar de
 * libertar dinheiro.
 */
export function prazoAutomaticoPorExtenso(dias: number): string {
  const n = Math.ceil(dias);
  return PROMESSA.prazoAutomatico.replace("{DIAS}", `${n} dia${n === 1 ? "" : "s"}`);
}

/** O mesmo prazo, na versão que vai por email. */
export function prazoDoEmailPorExtenso(dias: number): string {
  const n = Math.ceil(dias);
  return PROMESSA.emailClientePrazo.replace("{DIAS}", `${n} dia${n === 1 ? "" : "s"}`);
}
