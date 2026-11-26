/**
 * A RAJADA — quem escreve em cinco mensagens disse UMA coisa.
 *
 * *«Quero que corrija esse assistente para ser mais assertivo, inteligente, e
 * saiba o contexto da conversa, não repita pergunta.»* — 29-09-2026.
 *
 * As pessoas não escrevem num bloco. A Berta mandou, num minuto:
 *
 *     «Olá! Falámos agora mesmo. O meu nome é Berta Sobreirinho e aqui estão as fotos»
 *     [fotografia] [fotografia] [fotografia] «E esta escada da cama»
 *     «Rua das Camélias Brancas, 31. 4o andar. Lisboa. Sem elevador»
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

import { PEDIR_PARA_REENVIAR_A_FOTOGRAFIA } from "./voz-da-vitoria";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";

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

/**
 * A FOTOGRAFIA QUE NÃO DESCARREGOU — 15-11-2026 (decisão d34).
 *
 * Uma fotografia chegou ao telemóvel, a ponte não a conseguiu descarregar, e
 * a Vitória respondeu «Obrigada pelas imagens!»: o parceiro recebeu o pedido
 * sem a fotografia e o cliente ficou a achar que ela tinha sido vista. Esta
 * marca não é uma imagem — não se agradece, não conta como fotografia (no fim
 * pede-se na mesma) e não corre a rajada: leva o pedido para a reenviar
 * (`PEDIR_PARA_REENVIAR_A_FOTOGRAFIA`, em voz-da-vitoria.ts) — desde a d57
 * depois de `ESPERA_ANTES_DE_PEDIR_A_FOTOGRAFIA_MS`, e sem cortar a rajada.
 */
/*
 * E A EQUIPA VÊ-A NO TELEMÓVEL — 18-11-2026 (continuação da d57). O pedido
 * para a reenviar saía em todas as conversas com fotografia: a ponte deixou
 * de as descarregar, e o cliente reenviava a mesma fotografia, que voltava a
 * falhar. A Vitória já não pede nada ao cliente: a marca diz à equipa que a
 * fotografia está no telemóvel, e a conversa fica guardada com essa nota
 * (`NOTA_DA_FOTOGRAFIA_NO_TELEMOVEL`). A marca antiga lê-se na mesma.
 */
export const MARCA_DE_FOTOGRAFIA_FALHADA = "[fotografia — ver no telemóvel]";
/** A marca de 15-11 a 18-11-2026 — ainda está nos fios desses dias. */
export const MARCA_DE_FOTOGRAFIA_FALHADA_ANTIGA = "[fotografia não descarregada]";

/** A nota da conversa guardada para a equipa ver as fotografias no telemóvel (18-11-2026). */
export const NOTA_DA_FOTOGRAFIA_NO_TELEMOVEL = "📷 Fotografia por ver no telemóvel — não abriu no site";

/**
 * ESPERA-SE ANTES DE PEDIR PARA A REENVIAR — 17-11-2026 (decisão d57).
 *
 * O cliente escreveu o que era para levar e mandou as fotografias; uma não
 * descarregou, e o pedido para a reenviar saiu NO INSTANTE, entre o texto
 * dele e a resposta — e cortou a rajada: o texto ficou para trás, e a
 * Vitória respondeu como se ele não tivesse dito nada. Agora espera-se isto,
 * e não se pede se entretanto chegou uma fotografia com os bytes (ele já a
 * reenviou).
 */
export const ESPERA_ANTES_DE_PEDIR_A_FOTOGRAFIA_MS = 20_000;

/**
 * O PEDIDO DE REENVIO NÃO É UMA RESPOSTA — 17-11-2026 (d57). Não corta a
 * rajada, como as mensagens da equipa não cortam a pergunta da Vitória: o
 * texto que veio antes dele continua por responder, e lê-se. Vale em
 * português e nas traduções fixas (a frase pode ter saído traduzida).
 */
export function ePedidoDeReenvio(texto: string): boolean {
  const t = texto.trim();
  if (t === PEDIR_PARA_REENVIAR_A_FOTOGRAFIA) return true;
  return (["en", "fr", "es"] as const).some((l) => traducaoFixa(PEDIR_PARA_REENVIAR_A_FOTOGRAFIA, l)?.trim() === t);
}

/**
 * Onde começa a rajada: a seguir à nossa última resposta — e o pedido de
 * reenvio não conta como resposta (d57).
 */
function inicioDaRajada(mensagens: MensagemComId[]): number {
  let desde = -1;
  mensagens.forEach((m, i) => {
    if (m.direccao === "out" && !ePedidoDeReenvio(m.texto)) desde = i;
  });
  return desde;
}

/**
 * CHEGOU UMA FOTOGRAFIA COM BYTES DEPOIS DA QUE FALHOU? — d57. Então não se
 * pede para a reenviar: já chegou.
 */
export function chegouFotografiaDepois(mensagens: MensagemComId[], idDaFalhada: number): boolean {
  return mensagens.some((m) => m.direccao === "in" && m.id > idDaFalhada && eMarcaDeImagem(m.texto));
}

/**
 * HÁ UMA FALHADA MAIS NOVA? — d57. Três seguidas levam um pedido: pede a mais
 * nova, depois da espera; as outras calam-se.
 */
export function haFalhadaMaisNova(mensagens: MensagemComId[], idDaFalhada: number): boolean {
  return mensagens.some((m) => m.direccao === "in" && m.id > idDaFalhada && eFotografiaFalhada(m.texto));
}

/** Uma fotografia que chegou sem os bytes — ver `MARCA_DE_FOTOGRAFIA_FALHADA`. */
export function eFotografiaFalhada(texto: string): boolean {
  const t = texto.trim();
  return t === MARCA_DE_FOTOGRAFIA_FALHADA || t === MARCA_DE_FOTOGRAFIA_FALHADA_ANTIGA;
}

/**
 * O QUE A EQUIPA ESCREVEU À MÃO — 21-10-2026.
 *
 * *«Estamos perdidos entre quais pedidos já foram respondidos e quais ainda
 * falta responder.»* — o dono. A ponte só avisava que alguém tinha respondido
 * à mão, sem o texto: o site não sabia se a conversa tinha resposta. Agora a
 * mensagem fica no fio, como saída, com esta marca à frente — para se saber
 * que foi uma pessoa, e não a Vitória.
 */
export const MARCA_DE_MAO = "[à mão]";

/** A mensagem foi escrita à mão por alguém da equipa? */
export function eDaEquipa(texto: string): boolean {
  return texto.trim().startsWith(MARCA_DE_MAO);
}

/** O texto sem a marca de «à mão». */
export function semMarcaDeMao(texto: string): string {
  const t = texto.trim();
  return t.startsWith(MARCA_DE_MAO) ? t.slice(MARCA_DE_MAO.length).trim() : t;
}

/**
 * Uma fotografia ou um vídeo — o que a Vitória agradece como «imagens». A
 * fotografia pode trazer, desde 21-10-2026, o que se viu nela a seguir à
 * marca («[fotografia] cerca de 30 sacos de entulho») — continua a ser uma
 * imagem, e não palavras do cliente.
 */
export function eMarcaDeImagem(texto: string): boolean {
  const t = texto.trim();
  return t === MARCA_DE_FOTOGRAFIA || t.startsWith(`${MARCA_DE_FOTOGRAFIA} `) || t === MARCA_DE_VIDEO;
}

/** O que se viu numa fotografia — o que vem depois da marca — ou `null`. */
export function oQueSeViuNaFotografia(texto: string): string | null {
  const t = texto.trim();
  if (!t.startsWith(`${MARCA_DE_FOTOGRAFIA} `)) return null;
  const visto = t.slice(MARCA_DE_FOTOGRAFIA.length).trim();
  return visto || null;
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
  return eMarcaDeImagem(texto) || texto.trim() === MARCA_DE_AUDIO || eFotografiaFalhada(texto);
}

/**
 * O que já levou a sua resposta no instante e não corre a rajada: o áudio que
 * não se ouviu e a fotografia que não descarregou (15-11-2026, d34).
 */
function jaRespondidaNoInstante(texto: string): boolean {
  return texto.trim() === MARCA_DE_AUDIO || eFotografiaFalhada(texto);
}

/**
 * JÁ SE PEDIU PARA REENVIAR? — 15-11-2026 (d34). Três fotografias falhadas
 * seguidas levam UM pedido, não três: a contar do fim, só as fotografias
 * falhadas e as nossas mensagens até ao pedido; uma palavra do cliente pelo
 * meio e pede-se outra vez.
 */
export function jaPediuParaReenviar(mensagens: MensagemComId[], frase: string): boolean {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i];
    if (m.direccao === "out") {
      if (m.texto.trim() === frase.trim()) return true;
      continue;
    }
    if (m.direccao === "in" && eFotografiaFalhada(m.texto)) continue;
    return false;
  }
  return false;
}

/** Quantas fotografias falhadas chegaram desde a nossa última resposta (d34). */
export function fotografiasFalhadasDaRajada(mensagens: MensagemComId[]): number {
  const desde = inicioDaRajada(mensagens);
  return mensagens.slice(desde + 1).filter((m) => m.direccao === "in" && eFotografiaFalhada(m.texto)).length;
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
    if (jaRespondidaNoInstante(m.texto)) continue;
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
  const desde = inicioDaRajada(mensagens);
  return mensagens.slice(desde + 1).filter((m) => m.direccao === "in" && eMarcaDeImagem(m.texto)).length;
}

/**
 * O que se viu nas fotografias desta rajada — 21-10-2026. Uma frase por
 * fotografia vista, pela ordem em que chegaram, sem repetidas (três
 * fotografias do mesmo monte dizem três vezes o mesmo).
 */
export function oQueSeViuNaRajada(mensagens: MensagemComId[]): string[] {
  const desde = inicioDaRajada(mensagens);
  const vistos: string[] = [];
  for (const m of mensagens.slice(desde + 1)) {
    if (m.direccao !== "in") continue;
    const visto = oQueSeViuNaFotografia(m.texto);
    if (visto && !vistos.includes(visto)) vistos.push(visto);
  }
  return vistos;
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
  const desde = inicioDaRajada(mensagens);
  return mensagens
    .slice(desde + 1)
    .filter((m) => m.direccao === "in")
    .filter((m) => !soUmaMarca(m.texto))
    .map((m) => semMarcaDeAudio(m.texto))
    .filter(Boolean)
    .join("\n");
}

/**
 * QUEM ESCREVE EM PARTES ESPERA MAIS UM BOCADO — 27-10-2026 (decisão d2).
 *
 * A cliente do #853 mandou «1495-123» e, no mesmo minuto, «Algés»; e a rua
 * numa mensagem e o andar noutra. Com a resposta a meio (o código postal sem
 * a localidade, a rua sem o código postal), espera-se isto a mais antes de
 * responder, para a segunda metade chegar a tempo.
 *
 * Seis segundos: com os oito da janela são catorze, e a ponte espera trinta
 * pelo site — sobra para o modelo e para a base. Nunca se soma à espera das
 * imagens: essa é só para quem não escreveu nada.
 */
export const ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS = 6_000;

/** Sem acentos e em minúsculas — para ler as nossas perguntas. */
function semAcentosAqui(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** A última pergunta da Vitória (a da equipa à mão não conta), ou "". */
function ultimaDaVitoria(mensagens: MensagemComId[]): string {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i];
    if (m.direccao === "out" && !eDaEquipa(m.texto) && !ePedidoDeReenvio(m.texto)) return m.texto;
  }
  return "";
}

/**
 * A RESPOSTA FICOU A MEIO? Quanto esperar a mais por quem escreve em partes —
 * `ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS`, ou zero.
 *
 * Só para as perguntas que se respondem em várias peças: a morada (rua,
 * número, andar e código postal) e o código postal com a localidade.
 */
export function esperaPorQuemEscreveEmPartes(mensagens: MensagemComId[]): number {
  const pergunta = semAcentosAqui(ultimaDaVitoria(mensagens));
  const dito = textoDaRajada(mensagens).trim();
  if (!pergunta || !dito) return 0;
  const temCodigo = /(?<!\d)\d{4}\s*-?\s*\d{3}(?!\d)/.test(dito);
  const semCodigo = dito.replace(/(?<!\d)\d{4}\s*-?\s*\d{3}(?!\d)/g, " ");
  const temPalavras = /[a-zà-ÿ]{2,}/i.test(semCodigo);
  if (/qual e a morada/.test(pergunta)) return temCodigo ? 0 : ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS;
  if (/codigo postal, com a localidade/.test(pergunta)) {
    return temCodigo && temPalavras ? 0 : ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS;
  }
  if (/e o codigo postal\?/.test(pergunta)) return temCodigo ? 0 : ESPERA_DE_QUEM_ESCREVE_EM_PARTES_MS;
  return 0;
}

/**
 * CHEGOU OUTRA MENSAGEM ENQUANTO SE PENSAVA NA RESPOSTA? — 27-10-2026 (d2).
 *
 * *«Nunca duas perguntas seguidas sem resposta entre elas.»* A cliente do
 * #853 respondeu «Consegue se tiver vaga» enquanto a Vitória ainda pensava na
 * mensagem de antes: saiu a pergunta da carrinha outra vez e, logo a seguir,
 * «Para quando precisa?». A pergunta que ia sair já não serve — ele disse
 * mais entretanto. Cala-se; a execução da mensagem nova (que espera pela
 * tranca) lê tudo, as duas mensagens juntas, e pergunta o que faltar.
 *
 * Só as PERGUNTAS se calam (o texto acaba em «?»): o «Pedido registado», a
 * passagem a uma pessoa ou uma resposta não se perdem. O áudio que não se
 * ouviu não conta — não corre a rajada (ver `eAUltimaDaRajada`).
 */
export function calarAPerguntaPorChegarOutra(texto: string, ultimaLida: number, mensagens: MensagemComId[]): boolean {
  if (!eUmaPerguntaNossa(texto)) return false;
  return mensagens.some((m) => m.direccao === "in" && m.id > ultimaLida && !jaRespondidaNoInstante(m.texto));
}

/**
 * Uma mensagem nossa que acaba numa pergunta — a última linha tem um «?».
 * «Deseja fatura? (aplica-se IVA de 23%)» acaba num parêntese, e é pergunta.
 */
export function eUmaPerguntaNossa(texto: string): boolean {
  const linhas = texto.trim().split(/\n+/);
  return linhas[linhas.length - 1].includes("?");
}

/** A mensagem do cliente mais recente que esta execução leu — ver `calarAPerguntaPorChegarOutra`. */
export function ultimaMensagemLida(mensagens: MensagemComId[]): number {
  let ultima = 0;
  for (const m of mensagens) if (m.direccao === "in" && m.id > ultima) ultima = m.id;
  return ultima;
}

/** Quantos vídeos chegaram desde a nossa última resposta — vão para a nota do pedido (27-10-2026). */
export function videosDaRajada(mensagens: MensagemComId[]): number {
  const desde = inicioDaRajada(mensagens);
  return mensagens.slice(desde + 1).filter((m) => m.direccao === "in" && m.texto.trim() === MARCA_DE_VIDEO).length;
}

/**
 * AS FOTOGRAFIAS DELE NA CONVERSA — d129 (26-11-2026). As vistas (a marca da
 * fotografia ou do vídeo) e as que não abriram mas estão no telemóvel. Antes do
 * pedido também contam: foi o caso do #688, que a mandou antes da 1.ª mensagem.
 */
export function fotografiasNaConversa(fio: ReadonlyArray<{ direccao?: string; texto?: string }> | null | undefined): number {
  if (!Array.isArray(fio)) return 0;
  return fio.filter((m) => m?.direccao === "in" && (eMarcaDeImagem(m.texto ?? "") || eFotografiaFalhada(m.texto ?? ""))).length;
}
