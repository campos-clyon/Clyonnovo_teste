/**
 * OS PARCEIROS QUE ESCOLHEU AINDA NÃO RESPONDERAM, NA APP — 11-11-2026 (d6).
 *
 * Como no ecrã do pedido do site (`EscolhidosSemResposta.tsx`): numa mudança
 * com a lista de parceiros, enquanto o prazo corre lê-se «têm até às HH:MM
 * para responder»; quando passa sem resposta, o cartão com as três saídas —
 * esperar, escolher outro parceiro da lista ou pedir à CLYON que procure. Só o
 * pedido do cliente abre o pedido a mais parceiros.
 *
 * A APP NÃO ESCREVE FRASES NEM DECIDE NADA: o cartão, os botões (com a acção
 * e o texto de cada um), a lista e as frases de erro vêm da rota das acções
 * (R8, `agirComoCliente`). Sem resposta nenhuma, as frases são as de sempre da
 * app (`erros.ts`). Não se importa a lib do site: os textos chegam pela rota,
 * e assim mudam no site sem a app ter de ser publicada outra vez.
 *
 * Puro (sem Expo nem React Native): os testes do site importam-no, com um
 * site de mentira que cumpre o contrato.
 */
import { ErroDaApi, mensagemDe, NAO_FOI_POSSIVEL, type Pedir } from "./erros";
import { cartoesValidos, MAXIMO_POR_OMISSAO, type CartaoDaLista, type Pessoas } from "./parceiros-da-mudanca";

/**
 * Os nomes das acções na rota — os de `ACCOES_DOS_ESCOLHIDOS` da lib do site
 * (o teste compara-os). Os botões do cartão trazem a sua; estes são os que a
 * app tem de saber sozinha: ler ao abrir, reconhecer a lista e enviar a escolha.
 */
export const ACCOES_DOS_ESCOLHIDOS = Object.freeze({
  ver: "ver_escolhidos",
  listaParaEscolherOutro: "lista_para_escolher_outro",
  escolherOutro: "escolher_outros_parceiros",
  pedirAClyon: "pedir_a_clyon_que_procure",
});

/** A rota das acções do cliente (R8), a mesma do resto do pedido. */
const ROTA = "/api/users/me/negociacao";

/** O tipo do aviso no telemóvel (`dados.tipo`), que abre o pedido pelo `pedidoId`. */
export const TIPO_DO_AVISO = "escolhidos_sem_resposta";

export type BotaoDoCartao = { accao: string; texto: string; principal: boolean };

/** O cartão como a rota o manda (`CartaoDoCliente` na lib do site). */
export type CartaoDosEscolhidos = {
  caso: string;
  titulo: string | null;
  linha: string | null;
  /** A frase de depois de escolher uma saída (em vez do título e da linha). */
  depois: string | null;
  /** «A CLYON já está a procurar mais parceiros, como pediu.» */
  nota: string | null;
  botoes: BotaoDoCartao[];
  /** As ligações por baixo da frase de depois de «Esperar». */
  ligacoes: BotaoDoCartao[];
};

export type VistaDosEscolhidos = { cartao: CartaoDosEscolhidos | null; prazoTexto: string | null };

export type ListaParaEscolherOutro = {
  titulo: string;
  linha: string;
  botao: string;
  maximo: number;
  pessoas: Pessoas;
  parceiros: CartaoDaLista[];
  semMaisNinguem: string | null;
};

const texto = (v: unknown, max = 600): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function botoesValidos(v: unknown): BotaoDoCartao[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((b) => {
      const x = (b ?? {}) as Record<string, unknown>;
      const accao = texto(x.accao, 60);
      const t = texto(x.texto, 80);
      // Um botão sem acção ou sem texto não se desenha: a app não inventa nenhum dos dois.
      return accao && t ? { accao, texto: t, principal: x.principal === true } : null;
    })
    .filter((b): b is BotaoDoCartao => !!b);
}

function cartaoDosEscolhidos(v: unknown): CartaoDosEscolhidos | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  const cartao: CartaoDosEscolhidos = {
    caso: texto(c.caso, 40) ?? "",
    titulo: texto(c.titulo, 200),
    linha: texto(c.linha, 300),
    depois: texto(c.depois, 400),
    nota: texto(c.nota, 300),
    botoes: botoesValidos(c.botoes),
    ligacoes: botoesValidos(c.ligacoes),
  };
  // Sem nada que se leia, não há cartão.
  return cartao.titulo || cartao.linha || cartao.depois || cartao.nota || cartao.botoes.length > 0 ? cartao : null;
}

/** O que a rota manda em `ver_escolhidos`, `esperar_pelos_escolhidos` e `pedir_a_clyon_que_procure`. */
export function vistaValida(v: unknown): VistaDosEscolhidos {
  const o = (v ?? {}) as Record<string, unknown>;
  return { cartao: cartaoDosEscolhidos(o.cartao), prazoTexto: texto(o.prazoTexto, 200) };
}

/** A lista de `lista_para_escolher_outro`, ou null quando não serve. Os cartões são os da lista das mudanças. */
export function listaParaEscolherValida(v: unknown): ListaParaEscolherOutro | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const titulo = texto(o.titulo, 120);
  if (o.ok !== true || !titulo) return null;
  const maximo = typeof o.maximoDeEscolhidos === "number" && o.maximoDeEscolhidos >= 1 ? Math.floor(o.maximoDeEscolhidos) : MAXIMO_POR_OMISSAO;
  const parceiros = cartoesValidos(o.parceiros);
  return {
    titulo,
    linha: texto(o.linha, 300) ?? "",
    botao: texto(o.botao, 60) ?? "",
    maximo: Math.min(maximo, MAXIMO_POR_OMISSAO),
    pessoas: o.pessoas === 3 ? 3 : 2,
    parceiros,
    semMaisNinguem: texto(o.semMaisNinguem, 300),
  };
}

/**
 * Sem mais ninguém na lista: fica a frase da rota e a saída de pedir à CLYON —
 * o botão que o cartão já trazia (com o texto dele). Se o cartão não o traz, é
 * porque o cliente já o pediu: aí fica só a frase.
 */
export function saidaSemMaisNinguem(l: ListaParaEscolherOutro, cartao: CartaoDosEscolhidos | null): BotaoDoCartao | null {
  if (l.parceiros.length > 0 || !cartao) return null;
  const b = [...cartao.botoes, ...cartao.ligacoes].find((x) => x.accao === ACCOES_DOS_ESCOLHIDOS.pedirAClyon);
  return b ? { ...b, principal: true } : null;
}

/** «Pedir orçamento (2)» — o texto do botão é o da rota. */
export function botaoDeEscolherOutros(l: ListaParaEscolherOutro, quantos: number): string {
  return quantos > 0 ? `${l.botao} (${quantos})` : l.botao;
}

/** O corpo de «Pedir orçamento» aos que marcou: os ids e a assinatura do preço que viu em cada um. */
export function corpoDeEscolherOutros(pedidoId: number, l: ListaParaEscolherOutro, marcados: readonly string[]): Record<string, unknown> | null {
  const escolhidos = l.parceiros.filter((p) => marcados.includes(p.id)).slice(0, l.maximo);
  if (escolhidos.length === 0) return null;
  return {
    pedidoId,
    accao: ACCOES_DOS_ESCOLHIDOS.escolherOutro,
    parceiros: escolhidos.map((p) => p.id),
    assinaturas: Object.fromEntries(escolhidos.filter((p) => p.assinatura).map((p) => [p.id, p.assinatura as string])),
  };
}

export type ErroDosEscolhidos = {
  texto: string;
  /** «Já não é preciso»: um parceiro já respondeu, ou o pedido fechou. O botão (da rota) relê o pedido. */
  botao: string | null;
  /** O preço de um dos que marcou mudou: a lista volta a pedir-se. */
  precoMudou: boolean;
};

/** A recusa da rota, como o cartão a mostra. Sem resposta nenhuma, a frase de sempre da app (`erros.ts`). */
export function erroDosEscolhidos(e: unknown): ErroDosEscolhidos {
  const corpo = e instanceof ErroDaApi ? e.corpo : {};
  const jaNaoEPreciso = corpo.jaNaoEPreciso === true;
  return {
    texto: mensagemDe(e),
    // «Ver o pedido»: o texto do botão é o da rota; sem ele, não há botão.
    botao: jaNaoEPreciso ? texto(corpo.botao, 60) : null,
    precoMudou: corpo.precoMudou === true,
  };
}

export type ResultadoDaSaida =
  | { ok: true; vista: VistaDosEscolhidos; lista: ListaParaEscolherOutro | null; enviado: string | null }
  | { ok: false; erro: ErroDosEscolhidos };

/** Lê o cartão (ou a linha do prazo) de um pedido. Nunca lança: sem resposta, não há nada a mostrar. */
export async function lerOsEscolhidos(pedir: Pedir, pedidoId: number): Promise<VistaDosEscolhidos | null> {
  try {
    return vistaValida(await pedir<unknown>(ROTA, { metodo: "POST", corpo: { pedidoId, accao: ACCOES_DOS_ESCOLHIDOS.ver } }));
  } catch {
    return null;
  }
}

/**
 * UMA SAÍDA DO CLIENTE — o botão diz a acção (vem da rota), a app só a manda.
 * «Escolher outro parceiro» devolve a lista; as outras, o cartão como ficou;
 * «Pedir orçamento» aos que marcou devolve também a frase «Pedido enviado a…».
 * Nunca lança.
 */
export async function agirSobreOsEscolhidos(pedir: Pedir, corpo: Record<string, unknown>): Promise<ResultadoDaSaida> {
  try {
    const dados = await pedir<Record<string, unknown>>(ROTA, { metodo: "POST", corpo });
    if (corpo.accao === ACCOES_DOS_ESCOLHIDOS.listaParaEscolherOutro) {
      const lista = listaParaEscolherValida(dados);
      if (!lista) return { ok: false, erro: { texto: NAO_FOI_POSSIVEL, botao: null, precoMudou: false } };
      return { ok: true, vista: { cartao: null, prazoTexto: null }, lista, enviado: null };
    }
    return { ok: true, vista: vistaValida(dados), lista: null, enviado: texto(dados?.enviado, 400) };
  } catch (e) {
    return { ok: false, erro: erroDosEscolhidos(e) };
  }
}

/** O que o cartão mostra, por esta ordem: a lista, a frase «Pedido enviado a…», o cartão, ou só a linha do prazo. */
export function oQueMostrar(
  vista: VistaDosEscolhidos | null,
  lista: ListaParaEscolherOutro | null,
  enviado: string | null,
): "lista" | "enviado" | "cartao" | "prazo" | null {
  if (lista) return "lista";
  if (enviado) return "enviado";
  if (vista?.cartao) return "cartao";
  if (vista?.prazoTexto) return "prazo";
  return null;
}

/** De quanto em quanto tempo se volta a perguntar por um pedido que não tinha nada a mostrar. */
export const ESPERA_DEPOIS_DE_VAZIO_MS = 5 * 60_000;

/**
 * O cartão relê-se com o pedido (que se relê sozinho de minuto a minuto). Com
 * o prazo a correr ou o cartão à vista, relê sempre; se a última leitura veio
 * vazia (um pedido sem parceiros escolhidos, ou um deles já respondeu), só
 * volta a perguntar passados 5 minutos — a rota das acções tem limite de pedidos.
 */
export function podeReler(ultima: { vazia: boolean; em: number } | null, agora: number): boolean {
  if (!ultima || !ultima.vazia) return true;
  return agora - ultima.em >= ESPERA_DEPOIS_DE_VAZIO_MS;
}

/**
 * Vale a pena perguntar pelos escolhidos? Só enquanto se espera por eles: um
 * Trabalho CLYON, um pedido já contratado e um pedido fechado não perguntam.
 */
export function valeAPenaLer(p: { trabalhoClyon: boolean; contratado: boolean; fechado: boolean }): boolean {
  return !p.trabalhoClyon && !p.contratado && !p.fechado;
}
