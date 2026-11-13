import {
  DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO,
  IBAN_E_MBWAY_OBRIGATORIOS_ATE,
  NOVO_MODELO_DESDE,
  novoModeloEmVigor,
} from "./novo-modelo";
import { PAGAR_O_VALOR_EM_ATRASO } from "./valor-em-atraso";
import { ATENDIMENTO_ABRE_AS, ATENDIMENTO_FECHA_AS, emHorarioDeAtendimento, quandoSeResponde } from "./horario-de-atendimento";
import { pecasEmLisboa } from "./hora-de-lisboa";

/**
 * A VITÓRIA RESPONDE AOS PROFISSIONAIS — d21 (CEO e dono, 13-11-2026). Puro.
 *
 * Com o modelo de 15-11 (o cliente paga ao profissional, o profissional passa à
 * CLYON a taxa da plataforma e o IVA dela) as perguntas de dinheiro dos
 * profissionais repetem-se: a quem pago, a taxa, a referência, o stand-by, o
 * IBAN, o regime de IVA. Duas coisas, as duas só a quem tem ficha de
 * profissional (o telefone da ficha, o mesmo critério do separador
 * «Profissionais» da mesa):
 *
 *   1. AS 9 PERGUNTAS DE DINHEIRO — as respostas revistas pelo CEO
 *      (relatório ceo-d21-respostas-revistas, 13-11-2026), com o valor lido da
 *      carteira dele (a taxa, o IVA dela, o total e o valor em atraso). A voz é
 *      a da equipa («diga-nos», «geramos»); «valor em atraso», nunca «dívida».
 *      A Vitória nunca dá nem muda dados bancários: diz onde se mudam, e mais
 *      nada. O que não reconhece passa à equipa, como hoje.
 *   2. FORA DE HORAS — quem escreve fora do horário de atendimento
 *      (`horario-de-atendimento.ts`) fica a saber quando lhe respondem. Uma vez
 *      por conversa e por noite.
 *
 * ⚠️ SÓ ACTUA COM AS DUAS CHAVES: a data do modelo (15-11-2026,
 * `novoModeloEmVigor`) E o interruptor «Vitória: respostas automáticas aos
 * profissionais» nas Configs, DESLIGADO por omissão — são respostas
 * automáticas a pessoas reais, e o dono confirma-as na conversa com o CEO.
 * Sem as duas, tudo fica como estava (`decidirARespostaAoProfissional` devolve
 * «como_antes»).
 */

export type PerguntaDeDinheiro =
  | "quem_me_paga"
  | "pagar_a_taxa"
  | "referencia_nao_da"
  | "stand_by"
  | "iban_e_mbway"
  | "regime_de_iva"
  | "pagou_em_dinheiro"
  | "cliente_nao_pagou"
  | "como_sao_escolhidos";

export const PERGUNTAS_DE_DINHEIRO: readonly PerguntaDeDinheiro[] = [
  "quem_me_paga",
  "pagar_a_taxa",
  "referencia_nao_da",
  "stand_by",
  "iban_e_mbway",
  "regime_de_iva",
  "pagou_em_dinheiro",
  "cliente_nao_pagou",
  "como_sao_escolhidos",
];

/** O título do interruptor nas Configs — o nome que o dono confirma. */
export const NOME_DO_INTERRUPTOR = "Vitória: respostas automáticas aos profissionais";

/** O que se lê da carteira dele para dizer os valores. */
export type ValoresDaCarteira = {
  /** Os valores da taxa por pagar, um por trabalho (modelo de 15-11). */
  porPagar: Array<{ pedidoId: number | null; taxa: number; ivaDaTaxa: number; total: number }>;
  /** A soma do que está em atraso (mais de 4 dias) — o que põe a conta em stand-by. */
  emAtraso: number;
};

export const SEM_VALORES: ValoresDaCarteira = { porPagar: [], emAtraso: 0 };

const semAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** «30,75 €» */
function euros(v: number): string {
  return `${(Math.round(v * 100) / 100).toFixed(2).replace(".", ",")} €`;
}

/** «15/11» — o dia e o mês em Lisboa. */
function diaEMes(d: Date): string {
  const p = pecasEmLisboa(d);
  return `${p.dia}/${p.mes}`;
}

/** Um IBAN escrito na mensagem (PT50 e os dígitos, com ou sem espaços). */
const UM_IBAN = /\b[A-Z]{2}\d{2}(?:[ .-]?\d{4}){4,7}(?:[ .-]?\d{1,4})?\b/i;

/**
 * QUAL DAS 9 É — ou `null`. Lê-se a mensagem inteira sem acentos; a ordem
 * conta: «a referência não dá» antes de «como pago a taxa», e «pagou-me em
 * dinheiro sem IVA» antes de «quem me paga».
 */
export function qualPerguntaDeDinheiro(texto: string): PerguntaDeDinheiro | null {
  const t = semAcentos(texto);
  if (!t) return null;

  // 3. A referência não dá.
  if (
    /\b(referencia|ref\.?|multibanco)\b/.test(t) &&
    /\b(nao (da|deu|funciona|funcionou|passa|passou|aceita|aceitou|entra|entrou|consigo|consegui)|erro|invalida|expirou|expirada|caducou|rejeitad)/.test(t)
  )
    return "referencia_nao_da";

  // 4. O stand-by / a conta bloqueada.
  if (
    /\bstand ?-?by\b|\bstandby\b/.test(t) ||
    /\bconta\b.*\b(bloquead|suspens|parad|congelad)/.test(t) ||
    /\b(bloquead[oa]s?|bloquearam|suspenderam)\b/.test(t) ||
    /\b(nao|ja nao) (consigo|posso|me deixa) (aceitar|enviar|mandar|propor|fazer) (a |as |uma |nenhuma )?(oferta|proposta|pedido|trabalho)/.test(t) ||
    /\bvalor em atraso\b/.test(t)
  )
    return "stand_by";

  // 7. O cliente pagou-me em dinheiro (e sem IVA, ou outro valor).
  if (
    /\b(cliente|ele|ela|me)\b.*\bpag(ou|aram)(-me)?\b.*\b(dinheiro|numerario|em mao|sem iva|menos|outro valor)\b/.test(t) ||
    /\bpag(ou|aram)-me\b.*\b(dinheiro|sem iva|menos)\b/.test(t)
  )
    return "pagou_em_dinheiro";

  // 8. O cliente ainda não me pagou.
  if (
    /\b(cliente|ele|ela)\b.*\b(ainda )?nao (me )?(pagou|paga|quer pagar|pagaram|transferiu)\b/.test(t) ||
    /\bnao (me )?(pagaram|pagou)\b/.test(t) ||
    /\b(ainda )?nao recebi (o pagamento|o dinheiro|nada)( do cliente)?\b/.test(t)
  )
    return "cliente_nao_pagou";

  // 6. O regime de IVA.
  if (/\bregime (de )?iva\b|\bisent[oa]s?\b|\bart(igo|\.)? ?53\b|\b(porque|para que) (e que )?(me )?pedem o iva\b|\bregime do iva\b/.test(t))
    return "regime_de_iva";

  // 5. O IBAN, o titular, o MB WAY (e um IBAN escrito na mensagem).
  if (UM_IBAN.test(texto) || /\b(iban|nib|titular( da conta)?|dados bancarios|dados para receber)\b/.test(t) || /\bmb ?way\b/.test(t))
    return "iban_e_mbway";

  // 2. Como pago a taxa (e quanto é).
  if (
    /\b(taxa|comissao|iva da taxa|taxa da plataforma)\b/.test(t) &&
    /\b(como|onde|quando|quanto|qual|pagar|pago|pagamos|pagos?|paga-se|devo|tenho de)\b/.test(t)
  )
    return "pagar_a_taxa";
  if (/\b(quanto|o que) (e que )?(devo|tenho (de|que) pagar)( a clyon)?\b/.test(t)) return "pagar_a_taxa";

  // 1. Quem me paga.
  if (
    /\bquem (e que )?(me )?paga\b/.test(t) ||
    /\ba quem (e que )?(pago|se paga|devo pagar)\b/.test(t) ||
    /\bcomo (e que )?(vou )?(recebo|receber|sou pago|me pagam)\b/.test(t) ||
    /\b(quem|como) (e que )?paga (o|os) (trabalho|trabalhos|servico|servicos)\b/.test(t) ||
    /\b(o cliente )?paga-me (a mim|diretamente|directamente)\b/.test(t) ||
    /\b(recebo|receber) (do|pelo|directamente do|diretamente do) cliente\b/.test(t)
  )
    return "quem_me_paga";

  // 9. Como são escolhidos os profissionais.
  if (
    /\bcomo (e que )?(sao|e) (escolhid|selecionad|seleccionad|atribuid|distribuid)/.test(t) ||
    /\b(quem|como) (e que )?(escolhe|decide)\b.*\b(profissional|proposta|pedido|trabalho)/.test(t) ||
    /\b(porque|porque e que) (nao )?(fico|ganho|recebo|consigo)( com)? (os |nenhum |mais )?(trabalhos?|pedidos?)\b/.test(t) ||
    /\bcomo (e que )?(ganho|consigo|fico com|recebo) (mais )?(trabalhos|pedidos)\b/.test(t)
  )
    return "como_sao_escolhidos";

  return null;
}

/** O valor exacto da referência de cada trabalho, como a carteira o tem. */
function valoresDaReferencia(v: ValoresDaCarteira): string {
  if (v.porPagar.length === 0) {
    return "com o valor exacto: a taxa da plataforma + o IVA da taxa. Neste momento não tem nenhum valor por pagar.";
  }
  const cada = v.porPagar
    .map((p) => {
      const conta = `${euros(p.taxa)} + IVA da taxa ${euros(p.ivaDaTaxa)} = ${euros(p.total)}`;
      return p.pedidoId != null ? `no trabalho #${p.pedidoId}, ${conta}` : conta;
    })
    .join("; ");
  return `com o valor exacto: ${cada}.`;
}

/**
 * A RESPOSTA — o texto do CEO, com os números da carteira no lugar das
 * chaves. As datas e os prazos lêem-se das constantes do modelo.
 */
export function respostaAoProfissional(
  pergunta: PerguntaDeDinheiro,
  valores: ValoresDaCarteira = SEM_VALORES,
  /** A mensagem trazia um IBAN — não se repete, nem se grava. */
  comIbanNaMensagem = false,
): string {
  const desde = diaEMes(NOVO_MODELO_DESDE);
  const ate = diaEMes(IBAN_E_MBWAY_OBRIGATORIOS_ATE);
  const depois = diaEMes(new Date(IBAN_E_MBWAY_OBRIGATORIOS_ATE.getTime() + 1000));
  switch (pergunta) {
    case "quem_me_paga":
      return (
        "Nos pedidos novos, o cliente paga-lhe directamente, por transferência, MB WAY ou em dinheiro. " +
        "Depois passa à CLYON a taxa da plataforma e o IVA dessa taxa. " +
        `Os trabalhos já pagos à CLYON, ou com a referência emitida ao cliente antes de ${desde}, seguem como estavam.`
      );
    case "pagar_a_taxa":
      return (
        `Na carteira (app CLYON Pro ou painel) aparece uma referência por trabalho, ${valoresDaReferencia(valores)} ` +
        "Pode pagar por Multibanco (entidade e referência) ou por MB WAY. " +
        "Quando o pagamento é confirmado, a carteira actualiza sozinha; não precisa de nos mandar o comprovativo."
      );
    case "referencia_nao_da":
      return (
        "Veja se o valor está exactamente igual ao da carteira e se a referência ainda está dentro do prazo. " +
        "Se não der, escolha MB WAY na mesma carteira: chega-lhe um pedido no telemóvel para aprovar. " +
        "Se nenhuma das duas der, diga-nos o n.º do trabalho e geramos outra."
      );
    case "stand_by": {
      const agora =
        valores.emAtraso > 0
          ? ` Neste momento tem ${euros(valores.emAtraso)} em atraso.`
          : valores.porPagar.length > 0
            ? " Neste momento não tem nenhum valor em atraso."
            : "";
      return (
        `Se um valor da taxa ficar por pagar mais de ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias, fica em atraso e a conta entra em stand-by. ` +
        `Continua a ver os pedidos, mas para aceitar ou enviar uma oferta tem primeiro de «${PAGAR_O_VALOR_EM_ATRASO}». ` +
        `Assim que o pagamento é confirmado, a conta desbloqueia sozinha.${agora}`
      );
    }
    case "iban_e_mbway":
      return (
        (comIbanNaMensagem
          ? "Por segurança, não registo nem mudo dados bancários por mensagem: grave-os na sua conta, no painel ou na app CLYON Pro. "
          : "") +
        "Porque são os dados que o cliente vê para lhe pagar. São 4: IBAN, nome do titular da conta, MB WAY e o regime de IVA confirmado. " +
        `Quem já está aprovado tem até ${ate}; a partir de ${depois}, sem os 4, não pode aceitar nem enviar ofertas. ` +
        "Mudar estes dados pede a sua palavra-passe."
      );
    case "regime_de_iva":
      return (
        "Para o cliente ver o total certo antes de o escolher: com IVA, se fatura com IVA, ou sem IVA, se está isento (art. 53.º). " +
        "Escolha-o e grave em A minha conta › Faturação, mesmo que já lá esteja. " +
        "Se estiver errado, o cliente paga-lhe um valor diferente do que viu."
      );
    case "pagou_em_dinheiro":
      return (
        "O cliente deve pagar-lhe o valor que aparece no pedido, que já conta com o seu regime de IVA. " +
        "Se pagou outro valor, diga-nos o n.º do trabalho. " +
        "A taxa da plataforma é sempre a do pedido, seja qual for a forma de pagamento."
      );
    case "cliente_nao_pagou":
      return (
        "Nos pedidos novos, o pagamento é entre si e o cliente. Lembre-o com educação dos dados que estão no pedido. " +
        "Se não pagar, diga-nos o n.º do trabalho e falamos com ele: o acordo está guardado na plataforma."
      );
    case "como_sao_escolhidos":
      return (
        "O pedido vai aos profissionais da zona e é o cliente que escolhe entre as propostas. " +
        "Pesam o preço, a rapidez da resposta e as avaliações. " +
        "Nos Trabalhos CLYON o valor é fixo: só tem de aceitar ou recusar. " +
        "Responder depressa é o que mais ajuda a ficar com o trabalho."
      );
  }
}

/** O nome a seguir ao «Obrigada» — só o primeiro, e só se parecer um nome. */
function comONome(nome: string | null | undefined): string {
  const primeiro = String(nome ?? "").trim().split(/\s+/)[0] ?? "";
  return /^\p{L}[\p{L}'-]{1,30}$/u.test(primeiro) ? `, ${primeiro}` : "";
}

/** A RESPOSTA FORA DE HORAS — diz quando lhe respondem. */
export function respostaForaDeHoras(nome: string | null | undefined, agora: Date): string {
  return (
    `Obrigada pela sua mensagem${comONome(nome)}. ` +
    `Neste momento estamos fora do horário de atendimento (de segunda a sábado, das ${ATENDIMENTO_ABRE_AS}h às ${ATENDIMENTO_FECHA_AS}h). ` +
    `Uma pessoa da equipa responde-lhe ${quandoSeResponde(agora)}, por aqui.`
  );
}

/** O começo da resposta fora de horas — é por ele que se sabe se já saiu esta noite. */
export const COMECO_DA_RESPOSTA_FORA_DE_HORAS = "Obrigada pela sua mensagem";
export const MARCA_DA_RESPOSTA_FORA_DE_HORAS = "Neste momento estamos fora do horário de atendimento";

/**
 * JÁ SAIU ESTA NOITE? — as saídas da conversa (o que a CLYON disse, com há
 * quantos segundos) e o instante em que o atendimento fechou. Uma por noite.
 */
export function jaRespondeuForaDeHorasEstaNoite(
  saidas: ReadonlyArray<{ texto: string; haSegundos: number | null }>,
  agora: Date,
  inicioDoFecho: Date | null,
): boolean {
  if (!inicioDoFecho) return false;
  const desde = (agora.getTime() - inicioDoFecho.getTime()) / 1000;
  return saidas.some(
    (s) => s.haSegundos != null && s.haSegundos <= desde + 60 && String(s.texto ?? "").includes(MARCA_DA_RESPOSTA_FORA_DE_HORAS),
  );
}

export type DecisaoParaOProfissional =
  /** As duas chaves não estão dadas: tudo como antes (a passagem a uma pessoa de sempre). */
  | { tipo: "como_antes" }
  /** Uma das 9: responde e não passa à equipa (a resposta diz o que fazer a seguir). */
  | { tipo: "resposta"; pergunta: PerguntaDeDinheiro; texto: string }
  /** Fora de horas: diz quando lhe respondem e passa à equipa — ou só passa, se já o disse esta noite. */
  | { tipo: "fora_de_horas"; texto: string | null }
  /** Em horário, uma pergunta que não sabe: passa à equipa, como hoje. */
  | { tipo: "equipa" };

/**
 * A DECISÃO, toda aqui e pura: o servidor só lê o interruptor, a carteira e as
 * saídas, e faz o que isto disser.
 */
export function decidirARespostaAoProfissional(e: {
  texto: string;
  agora: Date;
  interruptorLigado: boolean;
  nome?: string | null;
  valores?: ValoresDaCarteira;
  /** Já saiu a resposta fora de horas nesta noite? */
  jaRespondeuEstaNoite?: boolean;
}): DecisaoParaOProfissional {
  if (!e.interruptorLigado || !novoModeloEmVigor(e.agora)) return { tipo: "como_antes" };
  const pergunta = qualPerguntaDeDinheiro(e.texto);
  if (pergunta) {
    return { tipo: "resposta", pergunta, texto: respostaAoProfissional(pergunta, e.valores ?? SEM_VALORES, UM_IBAN.test(e.texto)) };
  }
  if (!emHorarioDeAtendimento(e.agora)) {
    return { tipo: "fora_de_horas", texto: e.jaRespondeuEstaNoite ? null : respostaForaDeHoras(e.nome, e.agora) };
  }
  return { tipo: "equipa" };
}

/** Precisa de ler a carteira para responder a isto? (Só a taxa e o stand-by levam números.) */
export function precisaDosValores(pergunta: PerguntaDeDinheiro | null): boolean {
  return pergunta === "pagar_a_taxa" || pergunta === "stand_by";
}
