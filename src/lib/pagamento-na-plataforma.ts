import { FORMA_EM_PALAVRAS, lerForma, type FormaDePagamento } from "./forma-de-pagamento";

/**
 * O QUE SE DIZ SOBRE O DINHEIRO — e a quem.
 *
 * ESTE FICHEIRO JÁ TEVE OUTRA PREMISSA, e convém saber qual era para não a
 * trazer de volta.
 *
 * Nasceu (setembro de 2026) de uma coisa que estava errada: a carteira do
 * cliente dizia «o valor fica do lado da CLYON», a do profissional dizia «paga
 * logo à CLYON e o valor fica retido», e não havia forma nenhuma de o cliente
 * pagar à CLYON — nem processador, nem IBAN, nem referência. A resposta foi um
 * interruptor, `A_PLATAFORMA_COBRA`, a escolher entre duas versões de todos os
 * textos: a da caução (para quando existisse) e a de «paga ao profissional no
 * fim, a CLYON não recebe esse dinheiro» (para enquanto não existisse).
 *
 * A PREMISSA DEIXOU DE SER VERDADE A 17-09-2026. Desde esse dia os pagamentos
 * entram numa conta da CLYON pelo euPago — referência MB WAY ou Multibanco,
 * gerada no backoffice — e a CLYON paga ao profissional depois de o cliente
 * confirmar o trabalho. A 21-09-2026 o cliente passou a escolher no pedido COMO
 * paga: pela plataforma, ou em dinheiro ao profissional no fim (com a taxa da
 * CLYON à parte, por referência). E o interruptor ficou em `false` por decisão
 * do dono — mas por outra razão: o cliente não paga sozinho pelo link, é o
 * backoffice que gera as referências.
 *
 * Com o interruptor a escolher os textos, o mesmo ecrã passou a dizer duas
 * coisas contrárias. Ao lado do «Pagamento recebido — o valor fica connosco
 * até confirmar» do `PagarTrabalho`, e da «referência MB WAY ou Multibanco
 * depois de fechar» de `FORMA_EM_PALAVRAS`, aparecia «é a ele que o paga, no
 * fim; a CLYON não recebe esse dinheiro».
 *
 * DESDE 29-09-2026 OS TEXTOS NÃO DEPENDEM DO INTERRUPTOR. Dependem do que é
 * verdade para quem os lê:
 *
 *   · quando se sabe a forma de pagamento da negociação — o ecrã do trabalho,
 *     os emails, o WhatsApp, o backoffice — usa-se `promessaDaForma(forma)`;
 *   · quando não se sabe — as perguntas frequentes, o recrutamento, a
 *     carteira que junta trabalhos de várias formas — usa-se `PROMESSA`, que
 *     descreve as duas.
 *
 * E há uma regra que nenhum texto pode quebrar, guardada em
 * `promessa-do-dinheiro.test.ts`: a quem paga em dinheiro nunca se diz que o
 * valor fica com a CLYON; a quem paga pela plataforma nunca se diz que a CLYON
 * não recebe o dinheiro.
 */

/**
 * O CLIENTE PODE PAGAR SOZINHO, PELO LINK DO PEDIDO?
 *
 * É isto que o interruptor decide desde 29-09-2026, e mais nada no que se DIZ:
 * se a caixa de pagamento (`PagarTrabalho`) aparece ao cliente e se a rota
 * `/api/pagamentos` aceita criar uma referência que ele mesmo pediu. Em
 * `false`, as referências geram-se no backoffice e mandam-se por WhatsApp ou
 * email — «fica só o backoffice», decisão do dono a 21-09-2026. Não mudar sem
 * ele.
 *
 * ⚠️ AINDA DECIDE UMA COISA DE DINHEIRO, e não é texto: se a carteira do
 * profissional pergunta à base quem já pagou (ver `oClientePagou` em
 * `carteira.ts`). Isso ficou como estava de propósito — ligar essa pergunta
 * punha em «por cobrar» os trabalhos anteriores a 17-09-2026, que foram pagos
 * em mão sem deixar registo, e o que fazer com eles é uma decisão do dono.
 */
export const A_PLATAFORMA_COBRA = false;

/*
 * AS DUAS FORMAS, ESCRITAS UMA VEZ — é o texto canónico do pagamento.
 *
 * Vivem em pedaços para poderem ser ditas no infinitivo de quem ainda vai
 * escolher («No pedido escolhe como prefere pagar») e no de quem já escolheu
 * («Paga da forma que ficou escolhida no pedido»), sem duas redacções da mesma
 * regra a divergirem com o tempo.
 *
 * SEM A PERCENTAGEM DA COMISSÃO EM DINHEIRO — de propósito. Ela sai das taxas
 * de cada negociação (`taxasParaAForma`), e as taxas mudam no backoffice: a
 * que se escrevesse aqui ficava certa para uns pedidos e errada para os
 * seguintes. O número exacto está no ecrã e nas mensagens de cada trabalho.
 */
const PELA_PLATAFORMA =
  "pela plataforma — depois de aceitar a proposta recebe uma referência MB WAY ou " +
  "Multibanco, e o valor fica com a CLYON até confirmar que o trabalho está feito; só " +
  "então é entregue ao profissional";

const EM_DINHEIRO =
  "em dinheiro, ao profissional, no fim do trabalho; nesse caso paga à parte, por " +
  "referência, a comissão da CLYON, que é toda cobrada ao cliente";

/** O texto genérico do pagamento, para quem ainda não escolheu. */
export const COMO_SE_PAGA = `No pedido escolhe como prefere pagar: ${PELA_PLATAFORMA} — ou ${EM_DINHEIRO}.`;

/**
 * OS TEXTOS PARA QUANDO NÃO SE SABE A FORMA — descrevem as duas.
 *
 * São lidos por quem ainda não fez pedido nenhum (as perguntas frequentes, a
 * página de recrutamento) ou por quem tem trabalhos das duas formas ao mesmo
 * tempo (as carteiras). Dizer-lhes só uma das formas era voltar a acertar em
 * metade das pessoas.
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
  /** A explicação do prazo automático, sem o número de dias. */
  prazoAutomatico: string;
  /** Ao cliente, sobre o que acontece se ele não responder. `{DIAS}` no meio. */
  emailClientePrazo: string;
  /** A resposta pública a «é a CLYON que faz o trabalho?». */
  faqQuemFaz: string;
  /** O passo «escolhe, e só depois se paga» do «como funciona». */
  faqComoSePaga: string;
  /**
   * O passo «e depois recebo?» do «como funciona» do profissional.
   *
   * É a pergunta que ele faz antes de se inscrever, e a resposta tem de ser a
   * mesma que vai encontrar lá dentro. Ver `como-funciona-para-o-profissional.ts`.
   */
  proComoRecebe: string;
  /** O argumento de recrutamento — título e corpo do cartão. */
  recrutamentoTitulo: string;
  recrutamentoCorpo: string;
  /** A resposta pública a «quem responde por um trabalho mal feito?». */
  faqQuemResponde: string;
  /** O selo de confiança na página inicial, na parte dos profissionais. */
  seloDaPaginaInicial: string;
  /** A descrição da página de profissionais — é o que o Google mostra. */
  metaDosProfissionais: string;
};

export const PROMESSA: Promessa = {
  clienteTitulo: "Como é que o pagamento funciona",
  clienteCorpo:
    `Paga da forma que ficou escolhida no pedido: ${PELA_PLATAFORMA} — ou ${EM_DINHEIRO}. ` +
    "Em qualquer dos casos, é a sua confirmação que dá o trabalho por concluído dos dois lados.",
  /*
   * «Em curso», e não «Retido» nem «Combinado».
   *
   * O número junta trabalhos das duas formas: nuns o cliente já pagou à CLYON,
   * noutros vai pagar em notas ao profissional. «Retido» mentia aos segundos, e
   * a carteira não sabe quais dos primeiros já pagaram a referência. O que é
   * verdade para todos é que estão contratados e por concluir.
   */
  clienteRotuloDoTotal: "Em curso",
  clienteTotalComValor:
    "Trabalhos que contratou e ainda não deu por concluídos — já com a taxa da CLYON, sem IVA.",
  clienteTotalVazio: "Não tem trabalhos em curso de momento.",
  proTitulo: "Como recebe o que ganha",
  proCorpo:
    "Depende de como o cliente paga. Pela plataforma, o cliente paga à CLYON por referência " +
    "MB WAY ou Multibanco; «Por receber» é o valor desses trabalhos ainda por concluir, já " +
    "com a taxa da CLYON descontada — o que tem a receber, e não dinheiro que já possa " +
    "levantar. Passa a disponível depois de o cliente confirmar que o trabalho está feito e " +
    "de o pagamento dele ter entrado; aí pede a transferência, e o pedido de levantamento é " +
    "tratado em até 24 horas. Em dinheiro, o cliente paga-lhe no local o valor acordado por " +
    "inteiro: aparece em «Recebido em mão», e não há nada a transferir.",
  proRotuloDoCativo: "Por receber",
  /*
   * O PRAZO FICA COMO ESTAVA — decisão por tomar pelo dono (se os sete dias
   * sobrevivem). Estas duas frases falam do trabalho, não do dinheiro: dar
   * por concluído não põe saldo nenhum disponível sem o pagamento ter entrado.
   */
  prazoAutomatico:
    "Se não disser nada, o trabalho é dado por concluído sozinho daqui a {DIAS}. Se alguma coisa estiver mal, fale connosco antes disso.",
  emailClientePrazo:
    "Se não disser nada, o trabalho é dado por concluído sozinho daqui a {DIAS}. Se alguma coisa estiver mal, responda a este email antes disso — tratamos do assunto.",
  faqQuemFaz:
    "Não. A CLYON é a plataforma que liga o seu pedido a profissionais verificados da sua " +
    "zona. Quem desmonta, carrega e transporta é o profissional que escolher.",
  faqComoSePaga:
    "Quando aceita, o valor fica combinado por escrito e o profissional recebe os dados " +
    `para lá ir. ${COMO_SE_PAGA}`,
  proComoRecebe:
    "Depende de como o cliente escolheu pagar. Pela plataforma, ele paga à CLYON por " +
    "referência MB WAY ou Multibanco, e o valor — já sem a comissão — fica disponível na sua " +
    "carteira depois de ele confirmar que o trabalho está feito e de o pagamento ter entrado; " +
    "o pedido de levantamento é tratado em até 24 horas. Em dinheiro, recebe dele no local o " +
    "valor acordado por inteiro, e a CLYON cobra a taxa dela ao cliente.",
  recrutamentoTitulo: "Valor combinado por escrito",
  recrutamentoCorpo:
    "O preço fica acordado antes de sair de casa, escrito na plataforma, e nem o cliente " +
    "nem ninguém o muda sozinho — se o trabalho mudar à porta, corrige-se aqui, com " +
    "registo. Se o cliente pagar pela plataforma, recebe da CLYON depois de ele confirmar o " +
    "trabalho; se pagar em dinheiro, recebe dele no local, por inteiro.",
  faqQuemResponde:
    "O profissional que o executou. A CLYON guarda o acordo, as fotografias do trabalho " +
    "feito e a sua confirmação — e é a quem recorre se alguma coisa correr mal. Cada " +
    "profissional tem nota e historial avaliados por quem já o contratou.",
  seloDaPaginaInicial: "Valor acordado por escrito",
  metaDosProfissionais:
    "Inscreva-se e receba pedidos com fotografias, zona e o valor que o cliente quer pagar. " +
    "Responde com um valor e sabe o que recebe antes de aceitar — acordado por escrito antes de sair de casa.",
};

/**
 * OS TEXTOS PARA QUANDO SE SABE A FORMA — a do trabalho que está no ecrã.
 */
type PromessaDaForma = {
  /** Ao cliente, na ficha do trabalho em curso. `{PRO}` é o nome do profissional. */
  clienteEmCurso: string;
  /**
   * Ao cliente, depois de a referência ser paga (`PagarTrabalho`), a seguir a
   * «Recebemos X por MB WAY». Em dinheiro, o que ele pagou por referência foi
   * a comissão da CLYON — não há valor nenhum a guardar até à confirmação.
   */
  clienteDepoisDePagar: string;
  /** O botão com que o cliente dá o trabalho por feito. */
  botaoDeConfirmar: string;
  /** O que se lhe diz depois de carregar. */
  depoisDeConfirmar: string;
  /** Ao lado do valor que o profissional recebe: «já com a taxa…» ou «em mão». */
  proLegendaDoValor: string;
  /*
   * OS EMAILS, e são os que mais custam ter errados.
   *
   * O primeiro é a linha com que se diz a um profissional que o trabalho é
   * dele. É com ela na mão que ele decide se vai — e prometer-lhe dinheiro
   * que não vai passar por nós, ou esconder-lhe que vai, é pedir-lhe que
   * arrisque a manhã sobre uma coisa falsa.
   */
  /** Ao profissional, no email que lhe diz que foi contratado. */
  emailProAoContratar: string;
  /** Ao profissional, sobre para que serve a fotografia do trabalho feito. */
  emailProParaQueServeAProva: string;
  /** Ao cliente, no email que lhe pede para confirmar. */
  emailClienteAoPedirConfirmacao: string;
  /** Ao profissional, no ecrã em que ele acaba de ser contratado. */
  proAoFechar: string;
  /** A linha do WhatsApp que explica para que serve confirmar. */
  whatsappConfirmar: string;
  /**
   * No WhatsApp, a quem ainda vai aceitar: como e quando paga.
   *
   * Dizia-se a toda a gente «Só paga depois de o trabalho estar feito e
   * confirmado» — e a quem paga pela plataforma chega uma referência logo a
   * seguir a fechar.
   */
  whatsappAntesDeAceitar: string;
  /** No backoffice, o que falta acontecer a um trabalho com prova enviada. */
  backofficeAConfirmar: string;
};

const BOTAO_DE_CONFIRMAR = "Está bem feito, dar por concluído";
const MORADA_POR_EMAIL = "Vamos enviar-lhe a morada e o contacto por email.";

const NA_PLATAFORMA: PromessaDaForma = {
  clienteEmCurso:
    "Paga pela plataforma: recebe uma referência MB WAY ou Multibanco para pagar à CLYON. " +
    "O valor fica com a CLYON e só chega a {PRO} depois de confirmar aqui que o trabalho está feito.",
  clienteDepoisDePagar: "O valor fica connosco até confirmar que o trabalho está feito.",
  botaoDeConfirmar: BOTAO_DE_CONFIRMAR,
  depoisDeConfirmar:
    "Deu o trabalho por concluído. É esta confirmação que permite à CLYON entregar o valor ao profissional. Obrigado.",
  proLegendaDoValor: "já com a taxa CLYON descontada",
  emailProAoContratar:
    "O cliente paga à CLYON, pela plataforma. O valor fica disponível na sua carteira depois " +
    "de ele confirmar que o trabalho está feito e de o pagamento dele ter entrado.",
  emailProParaQueServeAProva:
    "É com ela que o cliente dá o trabalho por feito — e sem essa confirmação a CLYON não lhe pode entregar o valor.",
  emailClienteAoPedirConfirmacao:
    "Veja e confirme — é a sua confirmação que permite à CLYON entregar o valor ao profissional.",
  proAoFechar:
    "O cliente paga à CLYON, pela plataforma. O valor fica disponível na sua carteira depois " +
    `de ele confirmar que o trabalho está feito e de o pagamento dele ter entrado. ${MORADA_POR_EMAIL}`,
  whatsappConfirmar:
    "No link em baixo acompanha o trabalho e confirma-o quando estiver feito — o profissional só recebe depois dessa confirmação.",
  whatsappAntesDeAceitar:
    "Depois de aceitar, recebe a referência MB WAY ou Multibanco para pagar à CLYON; o " +
    "profissional só recebe depois de confirmar que o trabalho está feito.",
  backofficeAConfirmar:
    "Falta o cliente confirmar — é a confirmação que fecha o pedido. Pago pela plataforma: o " +
    "profissional só recebe da CLYON depois disso, e só se o pagamento do cliente tiver entrado.",
};

/*
 * EM DINHEIRO, AS FRASES DO DONO — `FORMA_EM_PALAVRAS` — sempre que servem.
 *
 * O serviço vai em notas do cliente para o profissional e nunca passa pela
 * CLYON: nada aqui pode dizer que o valor fica connosco, nem mandar o
 * profissional à carteira buscar o que já tem no bolso.
 */
const EM_NOTAS: PromessaDaForma = {
  clienteEmCurso:
    `${FORMA_EM_PALAVRAS.dinheiro.cliente} Confirme aqui quando o trabalho de {PRO} estiver feito.`,
  clienteDepoisDePagar:
    "É a comissão da CLYON. O valor do serviço paga-o ao profissional, em dinheiro, no fim do trabalho.",
  botaoDeConfirmar: BOTAO_DE_CONFIRMAR,
  depoisDeConfirmar: "Deu o trabalho por concluído. Obrigado.",
  proLegendaDoValor: "em dinheiro, no local — sem desconto da CLYON",
  emailProAoContratar: FORMA_EM_PALAVRAS.dinheiro.profissional,
  emailProParaQueServeAProva:
    "É com ela que o cliente dá o trabalho por feito — e é isso que o fecha dos dois lados.",
  emailClienteAoPedirConfirmacao: "Veja e confirme que está tudo bem antes de lhe pagar.",
  proAoFechar: `${FORMA_EM_PALAVRAS.dinheiro.profissional} ${MORADA_POR_EMAIL}`,
  whatsappConfirmar:
    "No link em baixo acompanha o trabalho e confirma-o quando estiver feito — é isso que o dá por concluído dos dois lados.",
  whatsappAntesDeAceitar: FORMA_EM_PALAVRAS.dinheiro.cliente,
  backofficeAConfirmar:
    "Falta o cliente confirmar — é a confirmação que fecha o pedido. Pago em dinheiro ao " +
    "profissional, no local: o serviço não passa pela CLYON, que só cobra a taxa por referência.",
};

/*
 * O PAGAR DEPOIS DA RECOLHA — escrito e desligado (`PAGAR_DEPOIS_LIGADO`).
 * `lerForma` nunca o devolve enquanto estiver desligado; está aqui para o
 * tipo ficar completo e para o dia em que se ligar não haver texto em falta.
 */
const DEPOIS_DA_RECOLHA: PromessaDaForma = {
  ...NA_PLATAFORMA,
  clienteEmCurso:
    `${FORMA_EM_PALAVRAS.pos_recolha.cliente} O valor só chega a {PRO} depois de o pagar à ` +
    "CLYON e de confirmar aqui que o trabalho está feito.",
  emailProAoContratar: FORMA_EM_PALAVRAS.pos_recolha.profissional,
  proAoFechar: `${FORMA_EM_PALAVRAS.pos_recolha.profissional} ${MORADA_POR_EMAIL}`,
  whatsappAntesDeAceitar: FORMA_EM_PALAVRAS.pos_recolha.cliente,
  backofficeAConfirmar:
    "Falta o cliente confirmar — é a confirmação que fecha o pedido. Pagar depois da recolha: " +
    "o profissional só recebe da CLYON quando o pagamento do cliente entrar.",
};

export const PROMESSA_POR_FORMA: Record<FormaDePagamento, PromessaDaForma> = {
  na_plataforma: NA_PLATAFORMA,
  dinheiro: EM_NOTAS,
  pos_recolha: DEPOIS_DA_RECOLHA,
};

/**
 * Os textos certos para ESTE trabalho, a partir da coluna como vem da base.
 *
 * Recebe o valor cru de propósito: `null`, vazio ou lixo lêem-se como a forma
 * de sempre (`lerForma`), e ninguém tem de se lembrar de o normalizar antes.
 */
export function promessaDaForma(forma: unknown): PromessaDaForma {
  return PROMESSA_POR_FORMA[lerForma(forma)];
}

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
