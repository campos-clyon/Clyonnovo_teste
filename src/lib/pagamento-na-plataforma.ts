import {
  FORMA_EM_PALAVRAS,
  FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO,
  lerForma,
  type FormaDePagamento,
} from "./forma-de-pagamento";
import type { ModeloDoPreco } from "./iva-incluido";
import { ROTULOS_DA_CARTEIRA } from "./rotulos-da-carteira";
import { NOVO_MODELO_DESDE_POR_EXTENSO, novoModeloEmVigor } from "./novo-modelo";
import { AS_DUAS_FATURAS, PAGA_DIRETAMENTE_AO_PARCEIRO, SO_PARA_OS_DADOS_DO_PEDIDO } from "./pagar-ao-parceiro";

/*
 * O MODELO DE 15-11-2026 — d10 (`novo-modelo.ts`). O cliente paga ao parceiro, e
 * o parceiro passa à CLYON a taxa da plataforma e o IVA dela («A pagar à CLYON»,
 * o valor em atraso). Os textos de baixo com «ANTIGO» no nome continuam certos
 * para os trabalhos já pagos à CLYON antes da data e para os Trabalhos CLYON; os
 * do modelo novo escolhem-se pela data (`promessaGeral`, `comoSePagaNoSite`) e,
 * num trabalho, pelo servidor (`promessaDaForma(…, novoModelo)`). A regra s do
 * teste da orquestra só deixa as palavras do modelo antigo nos nomes «ANTIGO».
 */

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
 * O CLIENTE PODE PAGAR SOZINHO, PELO LINK DO PEDIDO? — SIM, desde 30-10-2026.
 *
 * Até 30-10-2026 havia um só interruptor, `A_PLATAFORMA_COBRA`, a decidir
 * duas coisas: a porta do cliente e a carteira do profissional. Separou-se em
 * dois (CEO e dono, 30-10-2026, «Sim, abrir»): abrir a porta ao cliente NÃO
 * muda a carteira. O MB WAY e a referência Multibanco pelo euPago passam a
 * poder ser pedidos pelo próprio cliente (site e app); o backoffice continua
 * a poder gerá-los.
 *
 * HISTÓRICO — o que se escrevia aqui até 30-10-2026:
 *
 * É isto que o interruptor decide desde 29-09-2026, e mais nada no que se DIZ:
 * se a caixa de pagamento (`PagarTrabalho`) aparece ao cliente e se a rota
 * `/api/pagamentos` aceita criar uma referência que ele mesmo pediu. Em
 * `false`, as referências geram-se no backoffice e mandam-se por WhatsApp ou
 * email — «fica só o backoffice», decisão do dono a 21-09-2026. Não mudar sem
 * ele.
 *
 * ⚠️ AINDA DECIDE UMA COISA DE DINHEIRO, e não é texto: ligado, a carteira do
 * profissional pergunta à base se o cliente pagou TODOS os trabalhos (ver
 * `verificaOPagamento` em `carteira.ts`). Desligado, pergunta só pelos NOVOS —
 * *«Ligar, só para trabalhos novos»*, decisão do dono a 01-10-2026: os das
 * negociações abertas a partir de `VERIFICAR_PAGAMENTO_DESDE`. Os anteriores,
 * entre eles os de antes de 17-09-2026 pagos em mão sem deixar registo, ficam
 * como sempre estiveram.
 */
export const O_CLIENTE_PAGA_SOZINHO = true;

/**
 * A CARTEIRA DO PROFISSIONAL PERGUNTA PELO PAGAMENTO DE TODOS OS TRABALHOS?
 *
 * NÃO — e não muda com a porta do cliente. É o comportamento de sempre:
 * `verificaOPagamento` (`carteira.ts`) só pergunta pelos trabalhos novos,
 * os das negociações abertas a partir de `VERIFICAR_PAGAMENTO_DESDE`
 * (decisão do dono a 01-10-2026). Ligar isto era exigir registo de pagamento
 * aos trabalhos antigos pagos em mão — e eles ficavam presos. Não mudar sem
 * o dono.
 */
export const A_CARTEIRA_VERIFICA_TODOS_OS_TRABALHOS = false;

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
const PELA_PLATAFORMA_NO_MODELO_ANTIGO =
  "pela plataforma — depois de aceitar a proposta recebe uma referência MB WAY ou " +
  "Multibanco, e o valor fica com a CLYON até confirmar que o trabalho está feito; só " +
  "então é entregue ao parceiro";

/*
 * EM DINHEIRO, DESDE O IVA INCLUÍDO — 01-10-2026. O cliente paga ao
 * profissional o preço inteiro, com IVA, e não paga nada à parte; é o
 * profissional que entrega depois à CLYON o IVA e a comissão. Dizia «paga à
 * parte, por referência, a comissão da CLYON, que é toda cobrada ao cliente» —
 * o modelo de 21-09-2026, que só vale para as negociações abertas antes do
 * corte (essas lêem `promessaDaForma(forma, "sem_iva")`).
 */
const EM_DINHEIRO =
  "em dinheiro, ao parceiro, no fim do trabalho — o mesmo preço, com IVA, sem nada " +
  "a pagar à parte";

/** O texto genérico do pagamento, para quem ainda não escolheu. */
const COMO_SE_PAGA_NO_MODELO_ANTIGO = `No pedido escolhe como prefere pagar: ${PELA_PLATAFORMA_NO_MODELO_ANTIGO} — ou ${EM_DINHEIRO}.`;
export const COMO_SE_PAGA = COMO_SE_PAGA_NO_MODELO_ANTIGO;

/** Desde 15-11-2026 (d10): paga-se ao parceiro, e há duas faturas. */
export const COMO_SE_PAGA_NO_NOVO_MODELO = `${PAGA_DIRETAMENTE_AO_PARCEIRO} ${SO_PARA_OS_DADOS_DO_PEDIDO} ${AS_DUAS_FATURAS}`;

/** O texto genérico do pagamento, pela data. */
export function comoSePagaNoSite(agora: Date = new Date()): string {
  return novoModeloEmVigor(agora) ? COMO_SE_PAGA_NO_NOVO_MODELO : COMO_SE_PAGA_NO_MODELO_ANTIGO;
}

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

const PROMESSA_DO_MODELO_ANTIGO: Promessa = {
  clienteTitulo: "Como é que o pagamento funciona",
  clienteCorpo:
    `Paga da forma que ficou escolhida no pedido: ${PELA_PLATAFORMA_NO_MODELO_ANTIGO} — ou ${EM_DINHEIRO}. ` +
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
    "Trabalhos que contratou e ainda não deu por concluídos — no preço que lhe foi dito em cada um, já com a taxa da plataforma.",
  clienteTotalVazio: "Não tem trabalhos em curso de momento.",
  proTitulo: "Como recebe o que ganha",
  proCorpo:
    "Depende de como o cliente paga. Pela plataforma, o cliente paga à CLYON por referência " +
    `MB WAY ou Multibanco; «${ROTULOS_DA_CARTEIRA.aEsperaDaConfirmacao.rotulo}» é o valor desses trabalhos ainda por concluir, já ` +
    "com a taxa da plataforma descontada — o que tem a receber, e não dinheiro que já possa " +
    `levantar. Passa a «${ROTULOS_DA_CARTEIRA.porReceber.rotulo}» depois de o cliente confirmar que o trabalho está feito e ` +
    "de o pagamento dele ter entrado; aí pede a transferência, e o pedido de levantamento é " +
    "tratado em menos de 24 horas. Em dinheiro, o cliente paga-lhe no local o preço com IVA: o " +
    `seu líquido aparece em «${ROTULOS_DA_CARTEIRA.recebidoEmMao.rotulo}», e o IVA e a taxa da plataforma entrega-os à CLYON por ` +
    `referência MB WAY ou Multibanco, em «${ROTULOS_DA_CARTEIRA.aPagarAClyon.rotulo}».`,
  // O nome do cativo em todo o lado (painel e app) — ver `rotulos-da-carteira.ts` (28-10-2026).
  proRotuloDoCativo: ROTULOS_DA_CARTEIRA.aEsperaDaConfirmacao.rotulo,
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
    "Não. A CLYON é a plataforma que liga o seu pedido a parceiros da sua " +
    "zona. Quem desmonta, carrega e transporta é o parceiro que escolher: uma empresa parceira, com a sua equipa.",
  faqComoSePaga:
    "Quando aceita, o valor fica combinado por escrito e o parceiro recebe os dados " +
    `para lá ir. ${COMO_SE_PAGA}`,
  proComoRecebe:
    "Depende de como o cliente escolheu pagar. Pela plataforma, ele paga à CLYON por " +
    "referência MB WAY ou Multibanco, e o valor — já sem a taxa da plataforma — fica disponível na sua " +
    "carteira depois de ele confirmar que o trabalho está feito e de o pagamento ter entrado; " +
    "o pedido de levantamento é tratado em menos de 24 horas. Em dinheiro, recebe dele no local o " +
    "preço com IVA, e entrega depois à CLYON o IVA e a taxa da plataforma, por referência MB WAY ou " +
    "Multibanco — fica-lhe o mesmo líquido.",
  recrutamentoTitulo: "Valor combinado por escrito",
  recrutamentoCorpo:
    "O preço fica acordado antes de sair de casa, escrito na plataforma, e nem o cliente " +
    "nem ninguém o muda sozinho — se o trabalho mudar à porta, corrige-se aqui, com " +
    "registo. Se o cliente pagar pela plataforma, recebe da CLYON depois de ele confirmar o " +
    "trabalho; se pagar em dinheiro, recebe dele no local e entrega depois à CLYON o IVA e a taxa da plataforma.",
  // As fotografias do trabalho feito são opcionais desde 26-10-2026 (d22).
  faqQuemResponde:
    "O parceiro que o executou. A CLYON guarda o acordo, as fotografias do trabalho " +
    "feito, quando as há, e a sua confirmação — e é a quem recorre se alguma coisa correr mal. Cada " +
    "parceiro tem nota e historial avaliados por quem já o contratou.",
  seloDaPaginaInicial: "Valor acordado por escrito",
  metaDosProfissionais:
    "Inscreva-se e receba pedidos com fotografias, zona e o valor que o cliente quer pagar. " +
    "Responde com um valor e sabe o que recebe antes de aceitar — acordado por escrito antes de sair de casa.",
};

/** Os textos de sempre — para quem ainda os lê antes de 15-11 (e a app, até mudar). */
export const PROMESSA: Promessa = PROMESSA_DO_MODELO_ANTIGO;

/**
 * OS MESMOS TEXTOS NO MODELO DE 15-11-2026 (d10). Mudam só os que falam do
 * dinheiro; os trabalhos já pagos à CLYON antes da data seguem como foram
 * combinados, e as carteiras dizem-no.
 */
export const PROMESSA_DO_NOVO_MODELO: Promessa = {
  ...PROMESSA_DO_MODELO_ANTIGO,
  clienteCorpo:
    `${PAGA_DIRETAMENTE_AO_PARCEIRO} ${AS_DUAS_FATURAS} Os trabalhos que já tinha pago antes de ` +
    `${NOVO_MODELO_DESDE_POR_EXTENSO} seguem como foram combinados. Em qualquer caso, é a sua confirmação ` +
    "que dá o trabalho por concluído dos dois lados.",
  proCorpo:
    "Nos trabalhos novos, o cliente paga-lhe diretamente — por transferência para o seu IBAN, por MB WAY " +
    "ou em dinheiro no local — o preço com IVA, que já inclui a taxa da plataforma e o IVA dela. Quando o " +
    `trabalho fecha, essa parte fica em «${ROTULOS_DA_CARTEIRA.aPagarAClyon.rotulo}» como valor em atraso, ` +
    "com a referência Multibanco ou MB WAY para a pagar. Nos trabalhos que o cliente já tinha pago antes de " +
    `${NOVO_MODELO_DESDE_POR_EXTENSO}, recebe como antes: passam a «${ROTULOS_DA_CARTEIRA.porReceber.rotulo}» ` +
    "depois de o cliente confirmar, e aí pede a transferência.",
  faqComoSePaga:
    "Quando aceita, o valor fica combinado por escrito e o parceiro recebe os dados " +
    `para lá ir. ${PAGA_DIRETAMENTE_AO_PARCEIRO}`,
  proComoRecebe:
    "O cliente paga-lhe diretamente — por transferência para o seu IBAN, por MB WAY ou em dinheiro no " +
    "local — o preço com IVA. Fica com a sua parte; a taxa da plataforma e o IVA dela passa-os depois à " +
    "CLYON, por referência Multibanco ou MB WAY, uma por trabalho.",
  recrutamentoCorpo:
    "O preço fica acordado antes de sair de casa, escrito na plataforma, e nem o cliente " +
    "nem ninguém o muda sozinho — se o trabalho mudar à porta, corrige-se aqui, com " +
    "registo. O cliente paga-lhe diretamente, e passa depois à CLYON só a taxa da plataforma e o IVA dela.",
};

/** Os textos gerais do dinheiro, pela data (d10). */
export function promessaGeral(agora: Date = new Date()): Promessa {
  return novoModeloEmVigor(agora) ? PROMESSA_DO_NOVO_MODELO : PROMESSA_DO_MODELO_ANTIGO;
}

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
  /**
   * Ao profissional, o que a confirmação faz ao dinheiro — vai a seguir à
   * frase de quem confirma e do prazo (`quemConfirmaAntesDeMarcar`, de
   * trabalho.ts), que é a mesma do painel e da app.
   *
   * 10-11-2026 (d28). Dizia «sem fotografias, é um colega da CLYON que
   * confirma com ele — e sem essa confirmação a CLYON não lhe pode entregar o
   * valor». Desde 30-10-2026 o prazo corre para todos a contar do «Está
   * feito»: o trabalho fecha sozinho ao fim de `DIAS_ATE_LIBERTAR_SOZINHO`
   * dias, e o email contradizia a confirmação automática.
   */
  emailProParaQueServeAProva: string;
  /** Ao cliente, no email que lhe pede para confirmar. */
  emailClienteAoPedirConfirmacao: string;
  /** Ao profissional, no ecrã em que ele acaba de ser contratado. */
  proAoFechar: string;
  /**
   * A linha do WhatsApp que explica para que serve confirmar.
   *
   * Sem «no link em baixo» desde 03-10-2026: a mensagem deixou de levar o
   * link — *«vamos fazer manualmente»* —, e a frase diz o que falta sem
   * apontar para onde.
   */
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

const NA_PLATAFORMA_NO_MODELO_ANTIGO: PromessaDaForma = {
  clienteEmCurso:
    "Paga pela plataforma: recebe uma referência MB WAY ou Multibanco para pagar à CLYON. " +
    "O valor fica com a CLYON e só chega a {PRO} depois de confirmar aqui que o trabalho está feito.",
  clienteDepoisDePagar: "O valor fica connosco até confirmar que o trabalho está feito.",
  botaoDeConfirmar: BOTAO_DE_CONFIRMAR,
  depoisDeConfirmar:
    "Deu o trabalho por concluído. É esta confirmação que permite à CLYON entregar o valor ao parceiro. Obrigado.",
  proLegendaDoValor: "já com a taxa da plataforma descontada",
  emailProAoContratar:
    "O cliente paga à CLYON, pela plataforma. O valor fica disponível na sua carteira depois " +
    "de ele confirmar que o trabalho está feito e de o pagamento dele ter entrado.",
  emailProParaQueServeAProva:
    "Com o trabalho confirmado e o pagamento do cliente entrado, o valor fica disponível na sua carteira.",
  emailClienteAoPedirConfirmacao:
    "Veja e confirme — é a sua confirmação que permite à CLYON entregar o valor ao parceiro.",
  proAoFechar:
    "O cliente paga à CLYON, pela plataforma. O valor fica disponível na sua carteira depois " +
    `de ele confirmar que o trabalho está feito e de o pagamento dele ter entrado. ${MORADA_POR_EMAIL}`,
  whatsappConfirmar:
    "Quando o trabalho estiver feito, é só confirmá-lo — o parceiro só recebe depois dessa confirmação.",
  whatsappAntesDeAceitar:
    "Depois de aceitar, recebe a referência MB WAY ou Multibanco para pagar à CLYON; o " +
    "parceiro só recebe depois de confirmar que o trabalho está feito.",
  backofficeAConfirmar:
    "Falta o cliente confirmar — é a confirmação que fecha o pedido. Pago pela plataforma: o " +
    "parceiro só recebe da CLYON depois disso, e só se o pagamento do cliente tiver entrado.",
};

/*
 * EM DINHEIRO, AS FRASES DO DONO — `FORMA_EM_PALAVRAS` — sempre que servem.
 *
 * O serviço vai em notas do cliente para o profissional e nunca passa pela
 * CLYON: nada aqui pode dizer que o valor fica connosco, nem mandar o
 * profissional à carteira buscar o que já tem no bolso.
 */
const EM_NOTAS_ANTES_DO_IVA_INCLUIDO: PromessaDaForma = {
  clienteEmCurso:
    `${FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO.dinheiro.cliente} Confirme aqui quando o trabalho de {PRO} estiver feito.`,
  clienteDepoisDePagar:
    "É a taxa da plataforma. O valor do serviço paga-o ao parceiro, em dinheiro, no fim do trabalho.",
  botaoDeConfirmar: BOTAO_DE_CONFIRMAR,
  depoisDeConfirmar: "Deu o trabalho por concluído. Obrigado.",
  proLegendaDoValor: "em dinheiro, no local — sem desconto da CLYON",
  emailProAoContratar: FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO.dinheiro.profissional,
  emailProParaQueServeAProva: "É a confirmação que o fecha dos dois lados.",
  emailClienteAoPedirConfirmacao: "Veja e confirme que está tudo bem antes de lhe pagar.",
  proAoFechar: `${FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO.dinheiro.profissional} ${MORADA_POR_EMAIL}`,
  whatsappConfirmar:
    "Quando o trabalho estiver feito, é só confirmá-lo — é isso que o dá por concluído dos dois lados.",
  whatsappAntesDeAceitar: FORMA_EM_PALAVRAS_ANTES_DO_IVA_INCLUIDO.dinheiro.cliente,
  backofficeAConfirmar:
    "Falta o cliente confirmar — é a confirmação que fecha o pedido. Pago em dinheiro ao " +
    "parceiro, no local: o serviço não passa pela CLYON, que só cobra a taxa por referência.",
};

/*
 * EM DINHEIRO, COM IVA INCLUÍDO — 01-10-2026.
 *
 * "O cliente paga ao profissional, no local, o preço COM IVA; o profissional
 *  fica a DEVER à CLYON o IVA + a comissão, e paga essa dívida por referência
 *  MB WAY/Multibanco, gerada quando o trabalho em dinheiro é confirmado." —
 *  decisão do dono.
 *
 * A regra da casa continua: a quem paga em dinheiro nada diz que o valor fica
 * com a CLYON. O que muda é do lado do profissional — a confirmação é também
 * o momento em que nasce a referência do que ele deve.
 */
const EM_NOTAS: PromessaDaForma = {
  clienteEmCurso:
    `${FORMA_EM_PALAVRAS.dinheiro.cliente} Confirme aqui quando o trabalho de {PRO} estiver feito.`,
  // O cliente em dinheiro não paga nada à CLYON. Se uma referência dele
  // chegar a ser paga (um engano do backoffice), é isto que lê.
  clienteDepoisDePagar:
    "O preço do serviço paga-o ao parceiro, em dinheiro, no fim do trabalho. Se pagou isto por engano, fale connosco.",
  botaoDeConfirmar: BOTAO_DE_CONFIRMAR,
  depoisDeConfirmar: "Deu o trabalho por concluído. Obrigado.",
  proLegendaDoValor: "o seu líquido — recebe o preço com IVA em mão e entrega à CLYON o IVA e a taxa da plataforma",
  emailProAoContratar: FORMA_EM_PALAVRAS.dinheiro.profissional,
  emailProParaQueServeAProva:
    "Com o trabalho confirmado, recebe a referência para entregar à CLYON o IVA e a taxa da plataforma.",
  emailClienteAoPedirConfirmacao: "Veja e confirme que está tudo bem antes de lhe pagar.",
  proAoFechar: `${FORMA_EM_PALAVRAS.dinheiro.profissional} ${MORADA_POR_EMAIL}`,
  whatsappConfirmar:
    "Quando o trabalho estiver feito, é só confirmá-lo — é isso que o dá por concluído dos dois lados.",
  whatsappAntesDeAceitar: FORMA_EM_PALAVRAS.dinheiro.cliente,
  backofficeAConfirmar:
    "Falta o cliente confirmar — é a confirmação que fecha o pedido. Pago em dinheiro ao " +
    "parceiro, com IVA: ao confirmar, o parceiro passa a dever à CLYON o IVA e a taxa da plataforma, por referência.",
};

/*
 * O PAGAR DEPOIS DA RECOLHA — escrito e desligado (`PAGAR_DEPOIS_LIGADO`).
 * `lerForma` nunca o devolve enquanto estiver desligado; está aqui para o
 * tipo ficar completo e para o dia em que se ligar não haver texto em falta.
 */
const DEPOIS_DA_RECOLHA_NO_MODELO_ANTIGO: PromessaDaForma = {
  ...NA_PLATAFORMA_NO_MODELO_ANTIGO,
  clienteEmCurso:
    `${FORMA_EM_PALAVRAS.pos_recolha.cliente} O valor só chega a {PRO} depois de o pagar à ` +
    "CLYON e de confirmar aqui que o trabalho está feito.",
  emailProAoContratar: FORMA_EM_PALAVRAS.pos_recolha.profissional,
  proAoFechar: `${FORMA_EM_PALAVRAS.pos_recolha.profissional} ${MORADA_POR_EMAIL}`,
  whatsappAntesDeAceitar: FORMA_EM_PALAVRAS.pos_recolha.cliente,
  backofficeAConfirmar:
    "Falta o cliente confirmar — é a confirmação que fecha o pedido. Pagar depois da recolha: " +
    "o parceiro só recebe da CLYON quando o pagamento do cliente entrar.",
};

export const PROMESSA_POR_FORMA: Record<FormaDePagamento, PromessaDaForma> = {
  na_plataforma: NA_PLATAFORMA_NO_MODELO_ANTIGO,
  dinheiro: EM_NOTAS,
  pos_recolha: DEPOIS_DA_RECOLHA_NO_MODELO_ANTIGO,
};

/*
 * UM TRABALHO DO MODELO DE 15-11-2026 (d10) — seja qual for a forma: o cliente
 * paga ao parceiro (transferência, MB WAY ou dinheiro, `pagarAoParceiroPor`), e o
 * parceiro passa à CLYON a taxa da plataforma e o IVA dela quando o trabalho
 * fecha. Quem diz se um trabalho é deste modelo é o servidor (`eDoNovoModelo`).
 */
const PASSA_A_TAXA =
  "A taxa da plataforma e o IVA dela passa-os à CLYON por referência Multibanco ou MB WAY, quando o trabalho fechar.";
export const NO_NOVO_MODELO: PromessaDaForma = {
  clienteEmCurso:
    "Paga diretamente a {PRO} — por transferência, MB WAY ou dinheiro, como escolher no pedido. " +
    "Confirme aqui quando o trabalho estiver feito.",
  clienteDepoisDePagar:
    "O trabalho paga-se diretamente ao parceiro. Se pagou isto por engano, fale connosco.",
  botaoDeConfirmar: BOTAO_DE_CONFIRMAR,
  depoisDeConfirmar: "Deu o trabalho por concluído. Obrigado.",
  proLegendaDoValor: "sem IVA e já sem a taxa da plataforma — o cliente paga-lhe o preço com IVA, e a taxa e o IVA dela passam à CLYON",
  emailProAoContratar: `O cliente paga-lhe diretamente, por transferência, MB WAY ou dinheiro. ${PASSA_A_TAXA}`,
  emailProParaQueServeAProva:
    "Com o trabalho fechado, recebe a referência para passar à CLYON a taxa da plataforma e o IVA dela.",
  emailClienteAoPedirConfirmacao: "Veja e confirme que está tudo bem.",
  proAoFechar: `O cliente paga-lhe diretamente, por transferência, MB WAY ou dinheiro. ${PASSA_A_TAXA} ${MORADA_POR_EMAIL}`,
  whatsappConfirmar:
    "Quando o trabalho estiver feito, é só confirmá-lo — é isso que o dá por concluído dos dois lados.",
  whatsappAntesDeAceitar: PAGA_DIRETAMENTE_AO_PARCEIRO,
  backofficeAConfirmar:
    "Falta o cliente confirmar — é a confirmação que fecha o pedido. Modelo de 15/11: o cliente paga ao " +
    "parceiro; ao fechar, o parceiro passa à CLYON a taxa e o IVA dela (valor em atraso).",
};

/**
 * Os textos certos para ESTE trabalho, a partir da coluna como vem da base.
 *
 * Recebe o valor cru de propósito: `null`, vazio ou lixo lêem-se como a forma
 * de sempre (`lerForma`), e ninguém tem de se lembrar de o normalizar antes.
 */
export function promessaDaForma(forma: unknown, modelo: ModeloDoPreco, novoModelo = false): PromessaDaForma {
  // d10: um trabalho do modelo de 15-11 (o servidor decide) lê os textos do modelo novo.
  if (novoModelo) return NO_NOVO_MODELO;
  const f = lerForma(forma);
  /*
   * ANTES DO IVA INCLUÍDO, O DINHEIRO DE SEMPRE — 01-10-2026. As negociações
   * abertas antes de `IVA_INCLUIDO_DESDE` em dinheiro continuam no modelo de
   * 21-09-2026: o cliente dá o serviço em notas e paga a taxa por referência.
   * As outras formas não mudaram de texto com o IVA.
   */
  if (f === "dinheiro" && modelo === "sem_iva") return EM_NOTAS_ANTES_DO_IVA_INCLUIDO;
  return PROMESSA_POR_FORMA[f];
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
