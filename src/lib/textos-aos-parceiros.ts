import { ATENDIMENTO_ABRE_AS, ATENDIMENTO_FECHA_AS } from "./horario-de-atendimento";

/**
 * OS TEXTOS DOS PARCEIROS QUE A VITÓRIA E A AJUDA DIZEM IGUAL — d10 (CEO e dono,
 * 27-11-2026). Puro. O que a Vitória responde no WhatsApp a quem tem ficha de
 * parceiro e o que a Ajuda do painel e da app CLYON Pro lê (`ajuda-plataforma.ts`)
 * vêm daqui: uma só redacção, para nunca divergirem (a mensagem do aviso d134
 * também usa as frases do iPhone e do Gmail).
 *
 * «Parceiro» ao cliente e ao público; sem «no próprio dia», sem garantias.
 */

/** «de segunda a sábado, das 8h às 20h» — o horário de atendimento (`ATENDIMENTO`, em horas). */
export const HORARIO_DE_RESPOSTA = `de segunda a sábado, das ${ATENDIMENTO_ABRE_AS}h às ${ATENDIMENTO_FECHA_AS}h`;

/** Quando respondem — a pergunta da Ajuda e a resposta da Vitória. */
export const QUANDO_RESPONDEM =
  `Respondemos ${HORARIO_DE_RESPOSTA}, por aqui e por email. ` +
  "Fora desse horário, respondemos quando voltarmos a abrir. Se for urgente, ligue-nos.";

/** A frase que a app mostra depois de enviar um pedido de ajuda. */
export const RESPOSTA_AO_PEDIDO_DE_AJUDA = `Respondemos ${HORARIO_DE_RESPOSTA}, por aqui e por email. Se for urgente, ligue-nos.`;
export const PEDIDO_DE_AJUDA_ENVIADO = `Recebemos o seu pedido. ${RESPOSTA_AO_PEDIDO_DE_AJUDA}`;

/**
 * «Não me aparecem pedidos» — serviços, raio, avisos, valor em atraso e a zona
 * de trabalho. `limiteKm` é o das Configs (`zona_km_maximo`); sem ele (a Ajuda
 * não o lê) diz-se a regra sem número, para nunca haver um 200 escrito à mão.
 */
export function textoSemPedidos(limiteKm: number | null): string {
  const zona =
    limiteKm != null && limiteKm > 0
      ? `A CLYON só trabalha até ${limiteKm} km de Lisboa (numa mudança conta a origem): um pedido mais longe não chega aos parceiros. `
      : "A CLYON só trabalha numa zona à volta de Lisboa (numa mudança conta a origem): um pedido muito longe não chega aos parceiros. ";
  return (
    "Um pedido só lhe aparece se for de um serviço que a CLYON tem ativo e que o parceiro escolheu fazer, e se a morada ficar dentro do seu raio. " +
    "Em Serviços e raio confirme as categorias e o raio: apertar o raio ou tirar uma categoria faz os pedidos desaparecerem sem aviso. " +
    "Confirme também que tem as notificações ligadas. " +
    "Se tem um valor em atraso, continua a ver os pedidos, mas não pode propor até o pagar. " +
    zona +
    "Se está tudo certo e passaram dias sem nenhum, diga-nos o seu raio e as categorias que escolheu."
  );
}

/** Entrar e a palavra-passe. */
export const ENTRAR_E_PALAVRA_PASSE =
  "Entre na app CLYON Pro ou no painel com o mesmo email e palavra-passe. " +
  "Se não se lembra da palavra-passe, carregue em «Esqueci-me da palavra-passe» no ecrã de entrada: chega-lhe um email para escolher outra. " +
  "Se continuar sem conseguir entrar, diga-nos o email com que se inscreveu.";

/** iPhone: o painel no browser. */
export const IPHONE_USA_O_PAINEL =
  "A app CLYON Pro está, por agora, em teste só para Android. No iPhone faz tudo no painel, no browser do telemóvel, com o mesmo email e palavra-passe.";

/** A linha do iPhone no aviso d134. */
export const FRASE_DO_IPHONE_NO_AVISO =
  "Se tem iPhone, a app ainda não está para si: use o painel no browser do telemóvel, com o mesmo email e palavra-passe.";

/** A Play pede o Gmail — a frase do aviso: responde-se à própria mensagem. */
export const RESPONDA_COM_O_GMAIL = "responda a esta mensagem com o Gmail do seu telemóvel e pomo-lo na lista.";

/** O Gmail do teste: já recebido (nunca o repete) — passa à equipa. */
export const GMAIL_RECEBIDO =
  "Obrigada. Já passei o seu Gmail à equipa para o pôr na lista de testadores; assim que estiver, avisamos por aqui.";

/** O Gmail do teste: falta dizê-lo. */
export const PEDIR_O_GMAIL =
  "Para a Play lhe mostrar a app, a equipa tem de pôr o seu Gmail na lista de testadores. Responda só com o Gmail que usa no telemóvel e passo-o à equipa.";

/** A etiqueta com que a conversa passa à equipa (o que há a fazer). */
export const ETIQUETA_DO_GMAIL_DO_TESTE = "Parceiro enviou o Gmail do teste — pôr na lista de testadores";

/** Parar e voltar a receber avisos. */
export const PARAR_E_VOLTAR_A_RECEBER_AVISOS =
  "Para deixar de receber os avisos de pedido novo por WhatsApp, responda PARAR a um deles. " +
  "Para voltar a recebê-los, ligue os avisos de pedido novo no WhatsApp em A minha conta, na app CLYON Pro ou no painel. " +
  "As notificações da app mudam-se nas definições do telemóvel.";
