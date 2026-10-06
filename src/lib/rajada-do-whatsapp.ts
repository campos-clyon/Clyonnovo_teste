/**
 * A RAJADA — quem escreve em cinco mensagens disse UMA coisa.
 *
 * *«Quero que corrija esse assistente para ser mais assertivo, inteligente, e
 * saiba o contexto da conversa, não repita pergunta.»* — 29-09-2026.
 *
 * As pessoas não escrevem num bloco. A Ana mandou, num minuto:
 *
 *     «Olá! Falámos agora mesmo. O meu nome é Ana Ferreira e aqui estão as fotos»
 *     [fotografia] [fotografia] [fotografia] «E esta escada da cama»
 *     «Rua Cidade da Horta, 26. 4o andar. Lisboa. Sem elevador»
 *     «Sofá e estrutura de cama desmontada»
 *
 * O assistente tratava cada mensagem SOZINHA e NO INSTANTE. A ponte entrega-as
 * todas ao mesmo tempo, cada uma punha uma execução a correr, e nenhuma via as
 * outras: saíram duas saudações iguais, «Com quem estou a falar?» a quem tinha
 * acabado de dizer o nome, e «Lisboa» + «1000-102», escritos em duas
 * mensagens, foram lidos como duas respostas incompletas — «Desculpe, não
 * apanhei».
 *
 * A regra nova é a de uma pessoa ao telefone: DEIXA-SE ACABAR DE FALAR.
 * Cada mensagem espera `JANELA_DA_RAJADA_MS`; se entretanto chegou outra, cala-
 * se — a mais nova responde por todas. A que fica lê tudo o que entrou desde a
 * nossa última resposta como uma mensagem só.
 *
 * É uma janela que DESLIZA: cinco mensagens com seis segundos entre cada uma
 * dão uma resposta, oito segundos depois da última. Ninguém espera mais do que
 * isso por ter escrito muito.
 *
 * ESTE FICHEIRO É PURO. A espera, a base e a tranca estão na rota da ponte.
 */

/**
 * Oito segundos depois da ÚLTIMA mensagem.
 *
 * Menos do que isto e a segunda mensagem de quem escreve depressa ainda não
 * chegou; muito mais e a resposta parece não vir. A ponte espera 30 s pelo
 * site, e o resto da resposta (o modelo, a base) cabe com folga no que sobra.
 */
export const JANELA_DA_RAJADA_MS = 8_000;

/** O que a ponte grava no lugar de uma imagem. Não é texto que se leia. */
export const MARCA_DE_FOTOGRAFIA = "[fotografia]";

/**
 * O que a ponte grava à frente de um áudio — 06-10-2026. Sozinha, é um áudio
 * que não se conseguiu ouvir, e conta como a fotografia: não é texto que se
 * leia. Com o que o Gemini ouviu a seguir, é uma mensagem como as outras, e
 * a marca sai antes de o cérebro a ler — ver `whatsapp-audio.ts`.
 */
export const MARCA_DE_AUDIO = "[áudio]";

/** As marcas que, sozinhas, não são nada que se leia. */
function soUmaMarca(texto: string): boolean {
  const t = texto.trim();
  return t === MARCA_DE_FOTOGRAFIA || t === MARCA_DE_AUDIO;
}

/** O texto sem a marca do áudio à frente. */
function semMarcaDeAudio(texto: string): string {
  const t = texto.trim();
  return t.startsWith(MARCA_DE_AUDIO) ? t.slice(MARCA_DE_AUDIO.length).trim() : t;
}

export type MensagemComId = { id: number; direccao: string; texto: string };

/**
 * Esta mensagem é a última da rajada?
 *
 * As fotografias sem legenda NÃO contam como mais nova. Não põem o assistente
 * a correr — só a guardam no pedido —, e se contassem, a mensagem de texto
 * que chegou antes delas calava-se à espera de uma resposta que ninguém ia dar.
 */
export function eAUltimaDaRajada(minhaId: number, mensagens: MensagemComId[]): boolean {
  let ultima = 0;
  for (const m of mensagens) {
    if (m.direccao !== "in") continue;
    if (soUmaMarca(m.texto)) continue;
    if (m.id > ultima) ultima = m.id;
  }
  return ultima === 0 || ultima <= minhaId;
}

/**
 * O que ELE disse desde a nossa última resposta, numa mensagem só.
 *
 * Cada mensagem numa linha, pela ordem em que chegaram — «Lisboa» e
 * «1000-102» passam a ser «Lisboa\n1000-102», que se lê como código postal e
 * localidade. As fotografias saem do texto: o modelo já as vê no fio, e uma
 * expressão regular a ler «[fotografia]» só se engana.
 *
 * Vazio quando não há nada novo — por exemplo, quando outra execução já
 * respondeu a tudo enquanto esta esperava pela tranca.
 */
export function textoDaRajada(mensagens: MensagemComId[]): string {
  let desde = -1;
  mensagens.forEach((m, i) => {
    if (m.direccao === "out") desde = i;
  });
  return mensagens
    .slice(desde + 1)
    .filter((m) => m.direccao === "in")
    .filter((m) => !soUmaMarca(m.texto))
    .map((m) => semMarcaDeAudio(m.texto))
    .filter(Boolean)
    .join("\n");
}
