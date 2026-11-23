/**
 * O QUE CADA SERVIÇO INCLUI — d97 (23-11-2026). PURO.
 *
 * O caso #664: a cliente escolheu o parceiro, a Vitória propôs o fecho
 * («Reservo … Responda SIM.»), a cliente pediu para «validar que o serviço
 * inclui o transporte» — e a Vitória respondeu «vou confirmar com o
 * parceiro». O pedido ficou parado à espera de uma pessoa, por uma pergunta
 * que as regras já respondem: uma recolha inclui SEMPRE a descida, a carga e
 * o transporte (a própria Vitória o tinha dito na mensagem anterior).
 *
 * Aqui fica o que cada serviço inclui, nas palavras do site (as perguntas
 * frequentes, `perguntas-frequentes.ts`, e o que o parceiro faz por serviço da
 * d66, `oQueGanha` em `extra-no-local.ts`), e o que DEPENDE do parceiro (a
 * data, a hora, só uma parte do serviço, o que não está no pedido). A
 * ferramenta `o_que_o_servico_inclui` devolve isto ao modelo; e
 * `condicaoJaIncluida` impede, no código, que uma «condição» que o serviço já
 * inclui vire uma pergunta ao parceiro.
 *
 * d100 (23-11-2026), o #664 outra vez: antes da d97 a Vitória afirmou a sério
 * que «as duas propostas incluem a descida pelas escadas, a recolha e o
 * transporte», tirado das regras gerais do site — e dois minutos depois foi
 * perguntar ao parceiro. Agora: (b) a revisão recusa uma resposta que afirme
 * o que uma proposta inclui sem o_que_o_servico_inclui nessa volta
 * (`motivoParaAfirmarOQueInclui`); (c) o que essa ferramenta devolveu fica no
 * estado da volta e `condicaoJaIncluida` não deixa perguntá-lo ao parceiro (e
 * conhece as escadas, o andar e o elevador).
 */

import { extraNoLocal, oQueGanha } from "../extra-no-local";
import { lerBase } from "../base-do-preco";

export type OQueOServicoInclui = {
  servico: string | null;
  /** O que o serviço inclui sempre — responde-se logo, sem perguntar ao parceiro. */
  inclui: string[];
  /** A frase do site sobre o que o parceiro faz (d66), ou vazia. */
  oQueOParceiroFaz: string;
  /** Se no dia houver mais (a regra de cada serviço, com o preço quando há tabela). */
  seHouverMais: string;
  /** O que só o parceiro pode dizer — isso pergunta-se ao parceiro. */
  dependeDoParceiro: string[];
};

/** O destino, como as perguntas frequentes o dizem (quem transporta decide o destino legal). */
export const O_DESTINO =
  "o parceiro leva tudo e trata do destino: o que ainda serve pode ser reaproveitado, o resto vai para um destino legal (como a reciclagem)";

const DEPENDE_DO_PARCEIRO = [
  "a data e a hora (ou um prazo: «até quinta», «só de manhã»)",
  "fazer só uma parte do serviço (por exemplo, só descer sem levar)",
  "o que não está na descrição nem nas fotografias do pedido",
  "uma condição especial do cliente (acesso, horário do prédio, outra coisa)",
];

/** O QUE O SERVIÇO INCLUI. Sem serviço conhecido, o geral (o que está no pedido). */
export function oQueOServicoInclui(servico: string | null | undefined, base?: string | null): OQueOServicoInclui {
  const s = servico ?? null;
  const comum = { servico: s, oQueOParceiroFaz: oQueGanha(s), seHouverMais: extraNoLocal(s, lerBase(base)), dependeDoParceiro: DEPENDE_DO_PARCEIRO };
  switch (s) {
    case "recolha_moveis":
    case "recolha_monos":
      return {
        ...comum,
        inclui: [
          "ir à morada e descer tudo até à viatura (com ou sem elevador: o andar já conta na proposta)",
          "a carga",
          "o transporte",
          O_DESTINO,
        ],
      };
    case "recolha_entulho":
      return {
        ...comum,
        inclui: [
          "ir à morada e descer o entulho até à viatura (o andar já conta na proposta)",
          "a carga",
          "o transporte",
          "levar o entulho a um destino legal",
        ],
      };
    case "mudanca":
      return {
        ...comum,
        inclui: ["a carga", "o transporte", "a descarga no destino"],
        dependeDoParceiro: [...DEPENDE_DO_PARCEIRO, "a embalagem e a montagem, se não estiverem no pedido (pedem-se à parte e entram na proposta)"],
      };
    case "manutencao_casa":
      return {
        ...comum,
        inclui: ["o trabalho que está descrito no pedido, com as ferramentas do parceiro"],
        dependeDoParceiro: [...DEPENDE_DO_PARCEIRO, "os materiais, se não estiverem combinados na proposta"],
      };
    default:
      if (s && s.startsWith("esvaziamento")) {
        return {
          ...comum,
          inclui: [
            "retirar tudo o que está indicado no pedido, desmontando o que for preciso para sair",
            "descer e carregar",
            "o transporte",
            O_DESTINO,
          ],
          dependeDoParceiro: [...DEPENDE_DO_PARCEIRO, "a limpeza no fim, se não estiver pedida (faz-se, e fica escrita na proposta, com o preço)"],
        };
      }
      return { ...comum, inclui: ["o que está na descrição e nas fotografias do pedido"] };
  }
}

const normal = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Só uma parte, um prazo, uma hora, um dia: isto depende do parceiro, mesmo que fale de descer ou de levar. */
const DEPENDE =
  /\b(so|apenas|somente|sem levar|nao (?:e )?preciso|nao precisa|ate (?:a |ao )?(?:segunda|terca|quarta|quinta|sexta|sabado|domingo|dia|amanha|fim)|segunda|terca|quarta|quinta|sexta|sabado|domingo|amanha|hoje|manha|tarde|noite|hora|horas|dia \d|\d{1,2}[/.-]\d{1,2}|\d{1,2} ?h\b|\d{1,2}:\d{2}|urgente|frigorifico|maquina|piano|cofre|outro|outra|tambem|mais)\b/;

const RECOLHA_OU_ESVAZIAMENTO = (s: string | null | undefined) =>
  s === "recolha_moveis" || s === "recolha_monos" || s === "recolha_entulho" || Boolean(s && s.startsWith("esvaziamento"));

/**
 * A «CONDIÇÃO» QUE O SERVIÇO JÁ INCLUI? Devolve a resposta em palavras (para o
 * modelo a dar ao cliente) ou null — e com null, sim, pergunta-se ao parceiro.
 *
 *   · «validar que o serviço inclui o transporte» numa recolha → já inclui;
 *   · «inclui a descida?», «levam para o lixo / a reciclagem?» → já inclui;
 *   · «só a descida», «até quinta», «se levar também o frigorífico» → depende.
 */
export function condicaoJaIncluida(
  condicao: string | null | undefined,
  servico: string | null | undefined,
  jaAfirmado: readonly string[] = [],
): string | null {
  const t = normal(String(condicao ?? ""));
  if (!t || DEPENDE.test(t)) return null;
  if (RECOLHA_OU_ESVAZIAMENTO(servico)) {
    // d100: «a descida pelas escadas», «sem elevador», «o andar» — o andar já conta na proposta de uma recolha.
    const fala =
      /transport|\bdesc(?:er|ida|em|e)\b|\bescadas?\b|\bandar(?:es)?\b|\belevador\b|\bcarreg|\bcarga\b|\b(?:lev(?:a|ar|am|em)|deit(?:a|ar|am)|deposit)\b.*\b(?:lixo|recicl|ecocentro|embora|destino|aterro)|\b(?:lixo|recicl\w*|ecocentro|destino|aterro)\b|\bretir(?:a|ar|am)\b|\btir(?:a|ar|am)\b de casa/;
    if (fala.test(t)) {
      const i = oQueOServicoInclui(servico);
      return `Sim, já está incluído: ${i.inclui.join("; ")}.`;
    }
  }
  if (servico === "mudanca" && /transport|\bcarreg|\bcarga\b|\bdescarreg|\bdescarga\b/.test(t)) {
    return "Sim, já está incluído: a carga, o transporte e a descarga no destino.";
  }
  // d100: o que o_que_o_servico_inclui já devolveu nesta volta (e se disse ao cliente) não se pergunta ao parceiro.
  const ditos = jaAfirmado.map(normal).filter(Boolean);
  if (ditos.length > 0) {
    const tema = TEMAS_DO_QUE_INCLUI.find((x) => x.condicao.test(t) && ditos.some((d) => x.item.test(d)));
    if (tema) {
      const doTema = jaAfirmado.filter((d) => tema.item.test(normal(d)));
      return `Sim, já está incluído (já o disseste nesta conversa): ${doTema.join("; ")}.`;
    }
  }
  return null;
}

/** Os temas do que um serviço inclui: o item como o_que_o_servico_inclui o diz, e como o cliente o pergunta. */
const TEMAS_DO_QUE_INCLUI: ReadonlyArray<{ item: RegExp; condicao: RegExp }> = [
  { item: /transport/, condicao: /transport/ },
  { item: /\bdesc(?:er|ida)\b/, condicao: /\bdesc(?:er|ida|em|e)\b|\bescadas?\b|\bandar(?:es)?\b|\belevador\b/ },
  { item: /\bcarga\b|\bcarreg/, condicao: /\bcarga\b|\bcarreg/ },
  { item: /\bdescarga\b/, condicao: /\bdescarga\b|\bdescarreg/ },
  { item: /destino legal|recicl/, condicao: /\b(?:lixo|recicl\w*|ecocentro|destino|aterro)\b/ },
  { item: /desmont/, condicao: /desmont/ },
  { item: /\bretirar\b/, condicao: /\bretir(?:a|ar|am)\b/ },
];

/* ── d100: só se afirma o que uma proposta inclui com o_que_o_servico_inclui nesta volta ── */

/** «inclui», «incluem», «está incluído», «já conta com» — e o mesmo em inglês, francês e espanhol (sem acentos, em minúsculas). */
const AFIRMA_QUE_INCLUI =
  /\binclu(?:i|em|ido|ida|idos|idas)\b|\bja contam? com\b|\binclud(?:e|es|ed|ing)\b|\binclu(?:t|s|se|ses|ent)\b|\by compris\b|\bincluyen?\b|\bya cuentan? con\b/;

/** Dito como regra geral («normalmente a proposta já conta com…»): pode dizer-se. */
const REGRA_GERAL =
  /\b(?:normalmente|em regra|regra geral|geralmente|habitualmente|costumam?|em geral|por norma|usually|normally|generally|as a rule|normalement|en general|generalmente|por lo general)\b/;

/** «vou confirmar com o parceiro se a proposta inclui…»: é perguntar, não afirmar. */
const PERGUNTAR_SE =
  /\b(?:confirm\w*|pergunt\w*|verific\w*|saber|ver|ask\w*|check\w*|verifi\w*|demand\w*|pregunt\w*)\b(?:\s+\S+){0,4}?\s+(?:se|if|whether|si)\s/;

/** Do que se fala: o IVA e a taxa vêm da conta de propostas_vivas; o resto é o serviço. */
const DO_IVA_OU_DA_TAXA = /\b(?:iva|vat|tva|taxa|taxes?|tax|imposto|impuesto|frais)\b/;
const DO_SERVICO =
  /transport|\bdesc(?:er|ida|em|e)\b|escada|\bandar|elevador|\bcarg|\bcarreg|destino|lixo|recicl|ecocentro|montag|desmont|embal|limpez|material|desloca|\bkm\b|quilomet|\btudo\b|everything|\btout\b|\btodo\b|stairs|loading|disposal/;

/**
 * A RESPOSTA AFIRMA O QUE UMA PROPOSTA INCLUI SEM O TER LIDO NESTA VOLTA? (o
 * caso #664: «as duas propostas incluem a descida pelas escadas, a recolha e o
 * transporte», tirado das regras gerais.) Devolve o motivo para a revisão
 * recusar, ou null. Passa: com o_que_o_servico_inclui nesta volta; o IVA e a
 * taxa (vêm da conta); dito como regra geral; uma pergunta; «confirmo se…».
 */
export function motivoParaAfirmarOQueInclui(textoDaResposta: string, oQueOServicoIncluiNestaVolta: boolean): string | null {
  if (oQueOServicoIncluiNestaVolta) return null;
  const frases = String(textoDaResposta ?? "")
    .split(/(?<=[.!?\n])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);
  for (const frase of frases) {
    const f = normal(frase);
    const m = AFIRMA_QUE_INCLUI.exec(f);
    if (!m) continue;
    if (f.endsWith("?")) continue;
    if (REGRA_GERAL.test(f)) continue;
    if (PERGUNTAR_SE.test(f.slice(0, m.index + 1))) continue;
    if (DO_IVA_OU_DA_TAXA.test(f) && !DO_SERVICO.test(f)) continue;
    return (
      `Afirma o que uma proposta inclui («${frase.slice(0, 120)}») sem o_que_o_servico_inclui nesta volta. ` +
      "Sobre uma proposta concreta só afirmas o que propostas_vivas ou o_que_o_servico_inclui devolveram nesta volta: chama o_que_o_servico_inclui, " +
      "ou di-lo como regra geral («normalmente a proposta já conta com…»), ou confirma com o parceiro (perguntar_ao_parceiro)."
    );
  }
  return null;
}
