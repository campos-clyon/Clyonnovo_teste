import { texto } from "./catalogo";
import { perguntasDe, respostasDoRascunho, valorDaResposta, type Catalogo, type Rascunho } from "./novo-pedido";
import { PROIBIDO_NAS_PERGUNTAS, perguntaAparece, respostaServe, type PerguntaDaApp, type ValorDaResposta } from "./perguntas-do-pedido";

/**
 * O QUE A CLYON PERCEBEU NA DESCRIÇÃO — 03-11-2026 (decisão d1).
 *
 * `POST /api/cliente/ler-pedido` lê a descrição e as fotografias e sugere
 * respostas às perguntas da categoria (nunca um preço; demora 7 a 11 s). A app
 * mostra-as num cartão «Percebemos na sua descrição: …», cada uma com «Usar
 * isto» e «Não». NUNCA preenche em silêncio: só a resposta que ele aceitar
 * entra no rascunho, e a que recusar não volta (`sugestoesRecusadas`).
 *
 * Puro: o ecrã chama a rota e desenha o cartão; aqui, o corpo, a leitura da
 * resposta (sem confiar nela) e o que muda ao aceitar.
 */

export const ROTA_DO_LEITOR = "/api/cliente/ler-pedido";
/** O leitor só abre com uma descrição que diga alguma coisa, ou com fotografias. */
export const MINIMO_PARA_LER = 10;
const MAXIMO_DE_FOTOGRAFIAS_AO_LEITOR = 6;

export type SugestaoDoPedido = {
  /** O id da pergunta (da R7) a que responde. */
  pergunta: string;
  titulo: string;
  valor: ValorDaResposta;
  /** «Big bags (cerca de 1 m³)», «20 sacos». */
  valorEscrito: string;
  porque: string | null;
  origem: "descricao" | "fotografias" | "ambas";
  /** Ele já tinha respondido outra coisa. */
  discorda: boolean;
  ecra: "oque" | "acesso";
  chave: string;
};

/** O corpo do leitor: o serviço, a descrição, as respostas já dadas e as fotografias (só imagens, até 6). */
export function corpoDoLeitor(r: Rascunho, c: Catalogo): Record<string, unknown> | null {
  const perguntas = perguntasDe(r, c);
  if (!r.servico || !perguntas) return null;
  const fotografias = r.fotos
    .filter((f) => f.estado === "enviada" && f.url && !f.tipo?.startsWith("video/"))
    .map((f) => f.url as string)
    .slice(0, MAXIMO_DE_FOTOGRAFIAS_AO_LEITOR);
  if (r.descricao.trim().length < MINIMO_PARA_LER && fotografias.length === 0) return null;
  const respostas: Record<string, unknown> = {};
  const itens: Record<string, number> = {};
  for (const [id, v] of Object.entries(respostasDoRascunho(r, perguntas))) {
    if (v === undefined || Array.isArray(v)) continue;
    if (id.startsWith("itens.")) itens[id.slice(6)] = Number(v) || 0;
    else if (id === "desmontagem") respostas.desmontagem = v === "sim";
    else if (id.startsWith("origem.")) respostas[id.slice(7)] = v;
    else if (!id.includes(".")) respostas[id] = /^\d+$/.test(v) ? Number(v) : v;
  }
  if (Object.keys(itens).length > 0) respostas.itens = { pequeno: 0, medio: 0, grande: 0, ...itens };
  return { servico: r.servico, descricao: r.descricao.trim(), respostas, fotografias };
}

/** A chave do pedido ao leitor: só muda com o serviço, a descrição e as fotografias (as respostas não pagam outra leitura). */
export function chaveDoLeitor(r: Rascunho, c: Catalogo): string {
  const corpo = corpoDoLeitor(r, c);
  return corpo ? JSON.stringify([corpo.servico, corpo.descricao, corpo.fotografias]) : "";
}

/** O id da pergunta a que o campo do leitor responde (na mudança, o acesso é o da origem). */
function perguntaDoCampo(campo: string, perguntas: readonly PerguntaDaApp[]): PerguntaDaApp | null {
  return perguntas.find((p) => p.id === campo) ?? perguntas.find((p) => p.id === `origem.${campo}`) ?? null;
}

function escrito(p: PerguntaDaApp, v: ValorDaResposta): string {
  if (p.tipo === "escolha" && typeof v === "string") return p.opcoes.find((o) => o.id === v)?.nome ?? v;
  return String(v);
}

/**
 * A resposta do leitor, lida sem confiar: só as sugestões que respondem a uma
 * pergunta desta categoria com um valor que ela aceita, diferentes do que ele
 * já respondeu, e que ele não recusou. Os itens viram uma sugestão por tamanho.
 */
export function sugestoesValidas(v: unknown, r: Rascunho, c: Catalogo): SugestaoDoPedido[] {
  const perguntas = perguntasDe(r, c);
  const o = (v ?? {}) as { sugestoes?: unknown };
  if (!perguntas || !Array.isArray(o.sugestoes)) return [];
  const recusadas = new Set(r.sugestoesRecusadas ?? []);
  const out: SugestaoDoPedido[] = [];
  const juntar = (p: PerguntaDaApp, valor: ValorDaResposta, porque: string | null, origem: SugestaoDoPedido["origem"], discorda: boolean) => {
    if (!respostaServe(p, valor)) return;
    if (valorDaResposta(r, p.id) === valor) return;
    const chave = `${p.id}=${Array.isArray(valor) ? valor.join(",") : valor}`;
    if (recusadas.has(chave) || out.some((x) => x.chave === chave || x.pergunta === p.id)) return;
    out.push({ pergunta: p.id, titulo: p.titulo, valor, valorEscrito: escrito(p, valor), porque, origem, discorda, ecra: p.ecra, chave });
  };
  for (const s of o.sugestoes.slice(0, 20)) {
    const x = (s ?? {}) as Record<string, unknown>;
    const campo = texto(x.campo);
    if (!campo) continue;
    const origem = x.origem === "fotografias" || x.origem === "ambas" ? x.origem : "descricao";
    const discorda = x.discorda === true;
    // O porquê nunca fala de contentores nem de «hoje»; o big bag só na pergunta dos sacos.
    const bruto = texto(x.porque);
    const daQuantidade = campo === "tipoDeSaco" || campo === "quantidade";
    const porque = bruto && bruto.length <= 240 && !(daQuantidade ? /contentor|\bhoje\b|pr[óo]prio dia/i : PROIBIDO_NAS_PERGUNTAS).test(bruto) ? bruto : null;
    if (campo === "itens" && x.valor && typeof x.valor === "object") {
      const i = x.valor as Record<string, unknown>;
      for (const t of ["pequeno", "medio", "grande"]) {
        const p = perguntas.find((q) => q.id === `itens.${t}`);
        const n = i[t];
        if (p && typeof n === "number" && Number.isInteger(n) && n > 0) juntar(p, String(n), porque, origem, discorda);
      }
      continue;
    }
    const p = perguntaDoCampo(campo, perguntas);
    if (!p) continue;
    const valor =
      typeof x.valor === "boolean" ? (x.valor ? "sim" : "nao") : typeof x.valor === "number" && Number.isInteger(x.valor) ? String(x.valor) : texto(x.valor);
    if (valor) juntar(p, valor, porque, origem, discorda);
  }
  return out;
}

/** As sugestões a mostrar neste ecrã: as de perguntas que aparecem (contando com as outras sugestões ainda por decidir). */
export function sugestoesDoEcra(lista: readonly SugestaoDoPedido[], r: Rascunho, c: Catalogo, ecra: string): SugestaoDoPedido[] {
  const perguntas = perguntasDe(r, c);
  if (!perguntas) return [];
  const respostas: Record<string, ValorDaResposta | undefined> = { ...respostasDoRascunho(r, perguntas) };
  for (const s of lista) if (respostas[s.pergunta] === undefined) respostas[s.pergunta] = s.valor;
  return lista.filter((s) => {
    if (s.ecra !== ecra) return false;
    const p = perguntas.find((q) => q.id === s.pergunta);
    return !!p && perguntaAparece(p, respostas) && valorDaResposta(r, s.pergunta) !== s.valor;
  });
}

/** «Percebemos na sua descrição:» — e nas fotografias, quando foi delas. */
export function tituloDasSugestoes(lista: readonly SugestaoDoPedido[]): string {
  const desc = lista.some((s) => s.origem !== "fotografias");
  const fotos = lista.some((s) => s.origem !== "descricao");
  if (desc && fotos) return "Percebemos na sua descrição e nas fotografias:";
  if (fotos) return "Percebemos nas suas fotografias:";
  return "Percebemos na sua descrição:";
}

/** Recusar: fica anotada e não volta. */
export function recusarSugestao(r: Rascunho, s: SugestaoDoPedido): Partial<Rascunho> {
  return { sugestoesRecusadas: [...new Set([...(r.sugestoesRecusadas ?? []), s.chave])].slice(-50) };
}
