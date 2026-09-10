import { MAX_PROPOSTAS_POR_LADO, PRAZO_DA_PROPOSTA_HORAS } from "./negociacao";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";
import { TAXA_PROFISSIONAL } from "./taxas-plataforma";
import { PROMESSA } from "./pagamento-na-plataforma";
import type { SeccaoComFalta } from "./perfil-por-completar";

/**
 * COMO É QUE ISTO FUNCIONA, DO LADO DE QUEM FAZ O TRABALHO.
 *
 * Um profissional que entra por convite recebe um link, preenche seis campos e
 * fica à espera. Ninguém lhe disse como chegam os pedidos, de onde sai o valor
 * sugerido, quantas vezes pode contrapropor, quando é que vê a morada, nem
 * quem lhe paga. Ele descobre isso ao terceiro pedido — ou desiste ao
 * primeiro, convencido de que a plataforma não dá trabalho nenhum.
 *
 * Os passos vivem aqui, num sítio só, porque são lidos em dois: na página
 * pública, por quem está a decidir se se candidata, e dentro do painel, por
 * quem já entrou. Escritos duas vezes, começavam iguais e acabavam diferentes
 * — e a versão que o convence a inscrever-se não pode ser mais generosa do que
 * a que ele lê depois.
 *
 * OS NÚMEROS VÊM DAS CONSTANTES QUE OS PRODUZEM. A comissão, o prazo das
 * propostas, os dias até fechar sozinho: escritos à mão, ficavam desactualizados
 * no dia em que qualquer um mudasse, e a página passava a mentir com confiança.
 *
 * E O DINHEIRO VEM DA `PROMESSA`. Enquanto a CLYON não cobrar o cliente, o que
 * aqui se diz é o que acontece mesmo — não uma garantia que não existe. Ver
 * `pagamento-na-plataforma.ts`.
 */

export type PassoDoProfissional = {
  /** Identifica o passo em código e em testes. */
  chave: string;
  titulo: string;
  texto: string;
  /** A secção do perfil que este passo depende, quando depende de alguma. */
  seccao?: SeccaoComFalta;
};

const percent = (v: number) => `${Math.round(v * 100)} %`;

export const PASSOS_DO_PROFISSIONAL: PassoDoProfissional[] = [
  {
    chave: "chegam",
    titulo: "Os pedidos chegam-lhe sozinhos",
    texto:
      "Não há lista para percorrer nem contactos para comprar. Um pedido só lhe aparece se " +
      "for de um serviço que faz e se cair dentro do seu raio, contado a partir da sua base. " +
      "Chega com as fotografias do cliente, o andar, se há elevador e a zona — o suficiente " +
      "para dar um valor a sério em vez de um palpite ao telefone.",
    seccao: "servicos",
  },
  {
    chave: "sugestao",
    titulo: "A sugestão de valor é a sua conta, não a nossa tabela",
    texto:
      "Em cada pedido mostramos-lhe um valor sugerido. Os quilómetros são os daquele " +
      "trabalho, medidos a partir da sua base; o custo por km, o custo por hora e pessoa, o " +
      "tempo médio de um trabalho, os custos fixos do ano, a margem e o seguro de risco são " +
      "os que puser no perfil. Enquanto os deixar vazios, entra a referência da CLYON — que " +
      "é o custo de um profissional médio, e nenhum profissional é médio.",
    seccao: "servicos",
  },
  {
    chave: "propostas",
    titulo: "Propõe o seu valor, e o cliente responde",
    texto:
      `Cada lado tem ${MAX_PROPOSTAS_POR_LADO} propostas e ${PRAZO_DA_PROPOSTA_HORAS} horas ` +
      "para responder a cada uma. Só valores, sem mensagens — é isso que impede combinações " +
      "por fora e o que mantém tudo escrito. Se uma proposta expirar, não gasta nenhuma das " +
      "suas. E aceitar não fecha o trabalho: o cliente ainda tem de o contratar.",
  },
  {
    chave: "morada",
    titulo: "Só vê a morada depois de ser contratado",
    texto:
      "Até lá vê a zona, que é o que precisa para saber se lhe serve e quanto custa lá " +
      "chegar. Quando o cliente o contrata, recebe a morada exacta e o telefone dele. Não é " +
      "desconfiança: é o que impede que os pedidos sejam usados como lista de moradas — e " +
      "vale para si como vale para todos os outros.",
  },
  {
    chave: "prova",
    titulo: "Faz o trabalho e envia a fotografia",
    texto:
      "É com ela que o cliente dá o trabalho por feito, sem ter de estar lá a conferir nada. " +
      `Se não disser nada, o trabalho fecha sozinho ao fim de ${DIAS_ATE_LIBERTAR_SOZINHO} ` +
      "dias — o silêncio dele não o deixa pendurado.",
  },
  {
    chave: "recebe",
    titulo: "Recebe do cliente, e a comissão só existe se fechar",
    texto:
      PROMESSA.proComoRecebe +
      ` A comissão da CLYON é de ${percent(TAXA_PROFISSIONAL)} do valor acordado e já vem ` +
      "descontada em todos os números que lhe mostramos: o que aparece é o que fica para si. " +
      "Responder a pedidos não custa nada, e um orçamento que não dá em nada não lhe custa " +
      "um cêntimo. A fatura do serviço é sua.",
    seccao: "banco",
  },
];

/**
 * O QUE A CLYON NÃO FAZ.
 *
 * Escrito de propósito, e a seguir aos passos. Metade das perguntas que chegam
 * ao apoio são sobre coisas que a plataforma nunca prometeu — e a outra
 * metade é de quem assumiu que sim. Dizer o que não somos poupa as duas.
 */
export const O_QUE_A_CLYON_NAO_FAZ: string[] = [
  "Não faz o trabalho nem manda equipas: quem desmonta, carrega e transporta é você.",
  "Não muda o valor que combinou. Se o trabalho mudar à porta, corrige-se na plataforma, com registo.",
  "Não cobra mensalidade, não vende contactos e não desconta nada por responder a um pedido.",
  "Não escolhe por si: aceita os pedidos que quiser e ignora os outros, sem penalização.",
];

/** O passo que fala de uma secção do perfil — para ligar o aviso ao ecrã certo. */
export function passoDaSeccao(seccao: SeccaoComFalta): PassoDoProfissional | undefined {
  return PASSOS_DO_PROFISSIONAL.find((p) => p.seccao === seccao);
}
