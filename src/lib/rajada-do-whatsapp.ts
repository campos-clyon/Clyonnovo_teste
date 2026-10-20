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

/**
 * QUEM SÓ MANDOU IMAGENS ESPERA MAIS UM BOCADO — 20-10-2026.
 *
 * Quem manda fotografias costuma escrever logo a seguir: a do Paço de Arcos
 * mandou a fotografia dos big bags às 13:49 e a morada às 13:50. Uma rajada
 * só de imagens espera isto a mais, para a resposta agradecer as imagens e a
 * morada de uma vez, em vez de perguntar o que ela estava a acabar de
 * escrever.
 */
export const ESPERA_DAS_IMAGENS_MS = 15_000;

/** O que a ponte grava no lugar de uma imagem. Não é texto que se leia. */
export const MARCA_DE_FOTOGRAFIA = "[fotografia]";

/**
 * O que a ponte grava no lugar de um vídeo — 20-10-2026. O cliente do saco de
 * roupa mandou um de cinco segundos e ficou sem resposta: a ponte nem o
 * passava ao site. O vídeo não se descarrega (é grande e ninguém o vê aqui);
 * fica a marca, que conta como uma imagem.
 */
export const MARCA_DE_VIDEO = "[vídeo]";

/** Uma fotografia ou um vídeo — o que a Vitória agradece como «imagens». */
export function eMarcaDeImagem(texto: string): boolean {
  const t = texto.trim();
  return t === MARCA_DE_FOTOGRAFIA || t === MARCA_DE_VIDEO;
}

/**
 * O que a ponte grava à frente de um áudio — 06-10-2026. Sozinha, é um áudio
 * que não se conseguiu ouvir, e conta como a fotografia: não é texto que se
 * leia. Com o que o Gemini ouviu a seguir, é uma mensagem como as outras, e
 * a marca sai antes de o cérebro a ler — ver `whatsapp-audio.ts`.
 */
export const MARCA_DE_AUDIO = "[áudio]";

/** As marcas que, sozinhas, não são nada que se leia. */
function soUmaMarca(texto: string): boolean {
  return eMarcaDeImagem(texto) || texto.trim() === MARCA_DE_AUDIO;
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
 * As IMAGENS CONTAM desde 20-10-2026. Até aí uma fotografia sem legenda não
 * punha o assistente a correr — só se guardava no pedido —, e por isso não
 * podia contar: o texto que chegou antes dela calava-se à espera de uma
 * resposta que ninguém ia dar. Agora cada imagem corre a rajada como o texto
 * (ver a rota da ponte), e a mais nova responde por todas — também pelo texto
 * que veio antes, que `textoDaRajada` junta.
 *
 * O áudio que não se ouviu continua de fora: já levou o seu «escreva, por
 * favor» no instante, e não espera por mais nada.
 */
export function eAUltimaDaRajada(minhaId: number, mensagens: MensagemComId[]): boolean {
  let ultima = 0;
  for (const m of mensagens) {
    if (m.direccao !== "in") continue;
    if (m.texto.trim() === MARCA_DE_AUDIO) continue;
    if (m.id > ultima) ultima = m.id;
  }
  return ultima === 0 || ultima <= minhaId;
}

/**
 * Quantas imagens chegaram desde a nossa última resposta — 20-10-2026.
 *
 * *«No mínimo a gente gostaria que ela soubesse que foram enviadas imagens e
 * agradecesse — "obrigada pelas imagens"»* — o dono. É este número que diz à
 * Vitória que há o que agradecer nesta resposta.
 */
export function imagensDaRajada(mensagens: MensagemComId[]): number {
  let desde = -1;
  mensagens.forEach((m, i) => {
    if (m.direccao === "out") desde = i;
  });
  return mensagens.slice(desde + 1).filter((m) => m.direccao === "in" && eMarcaDeImagem(m.texto)).length;
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
