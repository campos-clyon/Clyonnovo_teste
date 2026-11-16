import { ESVAZIAMENTO_DE_EMPRESA, comOEspacoDaEmpresa, comOsPedidosDaEmpresa } from "./esvaziamento-de-empresa";
import { PERGUNTA_DO_ESVAZIAMENTO, pareceUmEsvaziamento } from "./parece-um-esvaziamento";
import {
  perguntaDo,
  primeiroPassoEmFalta,
  simOuNao,
  type DadosDaRecolha,
  type EstadoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";

/*
 * O ESVAZIAMENTO NA RECOLHA DO WHATSAPP — 15-11-2026 (d43, a parte da Vitória).
 *
 * O simulador do site pergunta «Parece um esvaziamento — quer que os
 * parceiros orcem o espaço todo, com tudo incluído?» quando a lista de uma
 * recolha passa das 8 peças, fala de 3 divisões ou mais, ou diz «casa toda»,
 * «herança», «mudança», «arrendar», «armazém», «escritório» ou «loja»
 * (`parece-um-esvaziamento.ts`). A Vitória faz o mesmo, com as mesmas
 * palavras e a mesma regra:
 *
 *   · UMA VEZ por recolha (`esvaziamentoPerguntado`), e só numa recolha de
 *     móveis ou de monos;
 *   · relendo a conversa (d25): conta o que ele escreveu nesta recolha, e não
 *     só a mensagem de agora;
 *   · no lugar da pergunta seguinte, nunca por cima do resumo nem da
 *     apresentação — quando não há pergunta a trocar, fica para a próxima;
 *   · com sim, o pedido passa a esvaziamento de casa (ou de armazém,
 *     escritório ou loja); com não, fica a recolha; com outra coisa, a
 *     pergunta não se repete e a mensagem lê-se como sempre.
 *
 * E o esvaziamento de empresa grava o que o simulador grava: o espaço
 * (`espacoDaEmpresa`), o «fora de horas» quando ele o diz, e a fatura (sai
 * sempre, com o NIF que a empresa der — `FATURA_COM_NIF`), sem a perguntar.
 *
 * Puro: `recolherPedidoPorWhatsApp` chama-o à volta das duas leituras (a do
 * modelo e a das regras), e os testes também.
 */

const semAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A pergunta, com delicadeza: as palavras do simulador, e a saída para quem quer só a recolha. */
export const PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA =
  `Pelo que me conta, ${PERGUNTA_DO_ESVAZIAMENTO.charAt(0).toLowerCase()}${PERGUNTA_DO_ESVAZIAMENTO.slice(1)} ` +
  "Se preferir, fica como recolha só do que me disse.";

export const FICA_COMO_ESVAZIAMENTO = "Combinado: fica como esvaziamento, e os parceiros orçam o espaço todo, com tudo incluído.";
export const FICA_COMO_RECOLHA = "Com certeza: fica como recolha, só do que me disse.";

/** «armazém», «escritório», «loja» — o espaço da empresa que o texto diz, ou null. */
export function espacoDaEmpresaNoTexto(texto: string | null | undefined): "armazem" | "escritorio" | "loja" | null {
  const t = semAcentos(texto ?? "");
  if (/(^|[^a-z])armaze(m|ns)\b/.test(t)) return "armazem";
  if (/(^|[^a-z])escritorios?\b/.test(t)) return "escritorio";
  if (/(^|[^a-z])lojas?\b/.test(t)) return "loja";
  return null;
}

/** Pediu fora de horas — à noite, depois do fecho, ao fim de semana. */
export function foraDeHorasNoTexto(texto: string | null | undefined): boolean {
  const t = semAcentos(texto ?? "");
  return /\bfora\s+d[eo]\s+(horas|horario|expediente)\b|\b(a|de|durante\s+a)\s+noite\b|\bdepois\s+d[eao]s?\s+(fecho|fechar|encerramento|expediente)\b|\b(ao|no|num|durante\s+o)\s+fim[\s-]de[\s-]semana\b|\bao\s+(sabado|domingo)\b/.test(
    t,
  );
}

/** As peças que ele diz em número («10 móveis», «12 peças») — a maior. */
export function pecasNoTexto(texto: string | null | undefined): number {
  const t = semAcentos(texto ?? "");
  let maior = 0;
  for (const m of t.matchAll(/(\d{1,3})\s*(pecas|peca|moveis|movel|itens|artigos|objetos|objectos|volumes|monos)\b/g)) {
    maior = Math.max(maior, Number(m[1]));
  }
  return maior;
}

/**
 * O QUE O ESVAZIAMENTO DE EMPRESA PRECISA, pelo que ele escreveu: o espaço
 * (o primeiro que disse; «outro» quando não disse nenhum), o «fora de horas»
 * e a fatura. O que já lá está não se muda.
 */
export function completarAEmpresa(d: DadosDaRecolha, textos: readonly string[]): DadosDaRecolha {
  if (d.serviceType !== ESVAZIAMENTO_DE_EMPRESA) return d;
  const tudo = [...textos, d.description ?? ""].join("\n");
  const novo: DadosDaRecolha = { ...d };
  if (!novo.espacoDaEmpresa) novo.espacoDaEmpresa = espacoDaEmpresaNoTexto(tudo) ?? "outro";
  if (novo.foraDeHoras !== true && foraDeHorasNoTexto(tudo)) novo.foraDeHoras = true;
  if (novo.precisaFatura === undefined) novo.precisaFatura = true;
  return novo;
}

/** Tira a pergunta pendente — respondida ou não, não se volta a fazer. */
export function semAPerguntaDoEsvaziamento(estado: EstadoDaRecolha): EstadoDaRecolha {
  if (!estado.dados.aConfirmarEsvaziamento) return estado;
  const { aConfirmarEsvaziamento: _, ...dados } = estado.dados;
  return { passo: estado.passo, dados: { ...dados, esvaziamentoPerguntado: true } };
}

function respostaAoEsvaziamento(texto: string): "sim" | "nao" | null {
  const t = semAcentos(texto).replace(/[.!,]+$/, "").trim();
  // A pergunta do anúncio (d48): «só alguns móveis» fica recolha; «a casa toda» é o esvaziamento.
  if (/\b(so|apenas)\s+(alguns|algumas|uns|umas|parte)\b|^alguns\s+moveis\b|\bnao\s+(e\s+)?(para\s+esvaziar|a\s+casa\s+toda)\b/.test(t)) return "nao";
  if (/\b(a\s+)?casa\s+(toda|inteira)\b|^(e\s+)?(para\s+)?esvaziar\b|^(e\s+)?tudo\b/.test(t)) return "sim";
  if (/\b(so|apenas)\s+(a\s+)?recolha\b|\bmanter\s+(a\s+)?recolha\b|\bfica\s+(como\s+)?recolha\b|\bso\s+(essas|estas|esses|estes|isso|isto)\b/.test(t)) return "nao";
  if (/\b(espaco\s+todo|tudo\s+incluido|e\s+um\s+esvaziamento|esvaziamento\s+(sim|mesmo)|quero\s+o\s+esvaziamento)\b/.test(t)) return "sim";
  if (/^(sim|s|pode ser|quero|claro|isso|exato|exacto|de acordo|prefiro|prefiro assim|e isso|sim,? por favor|sim,? quero)\b/.test(t)) return "sim";
  return simOuNao(texto);
}

/**
 * A RESPOSTA À PERGUNTA, quando está pendente. `null` quando não há pergunta
 * pendente ou ele respondeu outra coisa — e então quem chama tira-a
 * (`semAPerguntaDoEsvaziamento`) e lê a mensagem como sempre.
 */
export function responderAoEsvaziamento(
  estado: EstadoDaRecolha,
  texto: string,
  agora: Date,
  textos: readonly string[] = [],
): RespostaDaRecolha | null {
  const alvo = estado.dados.aConfirmarEsvaziamento;
  if (!alvo) return null;
  const r = respostaAoEsvaziamento(texto);
  if (!r) return null;
  const limpo = semAPerguntaDoEsvaziamento(estado).dados;
  const dados = r === "sim" ? completarAEmpresa({ ...limpo, serviceType: alvo }, [...textos, texto]) : limpo;
  const passo = primeiroPassoEmFalta(dados);
  return {
    estado: { passo, dados },
    resposta: `${r === "sim" ? FICA_COMO_ESVAZIAMENTO : FICA_COMO_RECOLHA}\n\n${perguntaDo(passo, dados, false, agora)}`,
  };
}

/**
 * DEPOIS DA RESPOSTA DE SEMPRE: se a recolha parece um esvaziamento e ainda
 * não se perguntou, a pergunta seguinte dá lugar à do esvaziamento. A
 * pergunta trocada fica no passo, e sai a seguir à resposta dele.
 */
export function perguntarSeEUmEsvaziamento(
  r: RespostaDaRecolha,
  textos: readonly string[],
  agora: Date,
): RespostaDaRecolha {
  const d = r.estado.dados;
  if (r.registar || r.pedirPessoa || r.desistir || r.foraDoPlano || r.respondidaAntes || !r.resposta) return r;
  if (d.esvaziamentoPerguntado || d.aConfirmarEsvaziamento || d.pedidoAberto != null) return r;
  if (r.estado.passo === "servico" || r.estado.passo === "confirmar") return r;
  const texto = [...textos, d.description ?? "", d.volumeDito ?? ""].join("\n");
  const alvo = pareceUmEsvaziamento({ servico: d.serviceType, pecas: pecasNoTexto(texto), texto });
  if (!alvo) return r;
  const pergunta = [perguntaDo(r.estado.passo, d, false, agora), perguntaDo(r.estado.passo, d, true, agora)].find((p) =>
    r.resposta.trimEnd().endsWith(p),
  );
  if (!pergunta) return r;
  const antes = r.resposta.trimEnd().slice(0, -pergunta.length);
  return {
    ...r,
    estado: { passo: r.estado.passo, dados: { ...d, aConfirmarEsvaziamento: alvo, esvaziamentoPerguntado: true } },
    resposta: `${antes}${PERGUNTA_DO_ESVAZIAMENTO_NA_CONVERSA}`,
  };
}

/** Depois de cada resposta, o esvaziamento de empresa fica com o que precisa (sem tocar na pergunta da fatura em curso). */
export function comOQueAEmpresaPrecisa(r: RespostaDaRecolha, textos: readonly string[]): RespostaDaRecolha {
  if (r.estado.dados.serviceType !== ESVAZIAMENTO_DE_EMPRESA || r.estado.passo === "fatura") return r;
  const dados = completarAEmpresa(r.estado.dados, textos);
  return dados === r.estado.dados ? r : { ...r, estado: { passo: r.estado.passo, dados } };
}

/**
 * O QUE O PEDIDO DA VITÓRIA GRAVA NUM ESVAZIAMENTO DE EMPRESA — os mesmos
 * campos e as mesmas linhas da descrição do simulador do site
 * (`espacoDaEmpresa`, `foraDeHoras` «sim»/«nao»; «Espaço da empresa: …» e
 * «Pedidos da empresa: …»). Noutro serviço, nada.
 */
export function oPedidoDaEmpresa(
  d: DadosDaRecolha,
  descricao: string | null,
): { json: Record<string, string>; descricao: string | null } {
  if (d.serviceType !== ESVAZIAMENTO_DE_EMPRESA) return { json: {}, descricao };
  const espaco = d.espacoDaEmpresa ?? "outro";
  const fora = d.foraDeHoras === true;
  return {
    json: { espacoDaEmpresa: espaco, foraDeHoras: fora ? "sim" : "nao" },
    descricao: comOsPedidosDaEmpresa(comOEspacoDaEmpresa(descricao ?? undefined, espaco), { foraDeHoras: fora }) || null,
  };
}
