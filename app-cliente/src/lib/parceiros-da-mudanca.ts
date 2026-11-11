/**
 * OS PARCEIROS DA MUDANÇA, NA APP — 11-11-2026 (ordem do CEO com o sim do dono).
 *
 * Como no simulador do site (`ParceirosDaMudanca.tsx`): depois das moradas, do
 * acesso e do dia, e antes do contacto, o cliente vê os parceiros com preço
 * para a mudança dele (`POST /api/mudancas/parceiros`), escolhe a equipa (2 ou
 * 3 pessoas — 2 por omissão; trocar volta a pedir a lista) e até três
 * parceiros. O pedido leva `parceirosEscolhidos` (os ids opacos), `pessoas` e
 * `procurarMaisParceiros`, e vai logo aos escolhidos.
 *
 * Com a lista desligada (`ligado: false`), sem resposta, ou sem parceiros para
 * a zona, o pedido segue como sempre (a CLYON procura).
 *
 * A APP NÃO FAZ CONTAS NEM ESCREVE REGRAS: os números e os textos vêm todos da
 * rota. Puro de propósito: os testes do site importam-no.
 */

export const ROTA_DOS_PARCEIROS = "/api/mudancas/parceiros";
/** O que o site manda quando a rota não diz (é o `MAXIMO_DE_ESCOLHIDOS` da lib do site). */
export const MAXIMO_POR_OMISSAO = 3;

export type Pessoas = 2 | 3;

/** A escolha que fica no rascunho. */
export type EscolhaDosParceiros = {
  ids: string[];
  nomes: string[];
  pessoas: Pessoas;
  procurarMais: boolean;
};

/**
 * Um cartão como a rota o manda (`CartaoDoParceiro` em
 * src/lib/lista-de-parceiros-da-mudanca.ts), só com o que o ecrã mostra. O
 * tipo escreve-se aqui, e não se importa: a app não leva aquela lib no bundle.
 */
export type CartaoDaLista = {
  /** Opaco: é este que volta no `parceirosEscolhidos` do pedido. */
  id: string;
  nome: string;
  /** O selo, já escrito pela rota (ou null). */
  selo: string | null;
  nota: { media: number; avaliacoes: number; texto: string } | null;
  /** A nota do Google (ficha confirmada pela CLYON), já escrita pela rota, com a atribuição; nunca misturada com a da CLYON. */
  notaGoogle: { texto: string; atribuicao: string } | null;
  novo: string | null;
  fotografia: string | null;
  fazComTres: boolean;
  minimoTexto: string;
  horasTexto: string;
  precoHora: { 2: { texto: string } | null; 3: { texto: string } | null };
  materiais: Array<{ chave: string; nome: string; texto: string }>;
  kit: { texto: string; total: { texto: string } | null };
  estimativa: { texto: string };
  estimativaComKit: { texto: string };
};

export type TextosDaLista = {
  titulo: string;
  escolha: string;
  semParceirosSegue: string;
  procurarMais: string;
  botao: string;
  notaDaEstimativa: string;
  quemFaz: string;
};

export type ListaDosParceiros =
  | { ligado: false }
  | {
      ligado: true;
      pessoas: Pessoas;
      resumo: string | null;
      recomendaTres: string | null;
      maximo: number;
      parceiros: CartaoDaLista[];
      semParceiros: string | null;
      ordenacao: { titulo: string; frase: string } | null;
      textos: TextosDaLista;
    };

/** O que se manda à rota: lido do MESMO corpo que vai para o pedido, para a rota do pedido refazer a mesma lista. */
export function corpoDaLista(order: Record<string, unknown>, pessoas: Pessoas): Record<string, unknown> | null {
  type M = { lat?: unknown; lng?: unknown; formattedAddress?: unknown; city?: unknown } | undefined;
  const o = order.originAddress as M;
  const d = order.destinationAddress as M;
  if (!o || !d || typeof o.formattedAddress !== "string" || typeof d.formattedAddress !== "string") return null;
  const ao = order.originAccess as { difficultAccess?: unknown } | undefined;
  const ad = order.destinationAccess as { difficultAccess?: unknown } | undefined;
  const ponta = (m: NonNullable<M>) => ({
    lat: typeof m.lat === "number" ? m.lat : undefined,
    lng: typeof m.lng === "number" ? m.lng : undefined,
    morada: m.formattedAddress,
    cidade: typeof m.city === "string" ? m.city : undefined,
  });
  return {
    origem: ponta(o),
    destino: ponta(d),
    tipologia: typeof order.tipologia === "string" && order.tipologia ? order.tipologia : null,
    // A mesma leitura da rota do pedido (`pedidoDaListaDoPedido`).
    desmontagem: ao?.difficultAccess === true || ad?.difficultAccess === true || order.desmontagem === true,
    pessoas,
    data: typeof order.dataPreferida === "string" ? order.dataPreferida : undefined,
  };
}

const texto = (v: unknown, max = 600): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const comTexto = (v: unknown): { texto: string } | null => {
  const t = texto((v as { texto?: unknown } | null)?.texto);
  return t ? { texto: t } : null;
};

function cartaoValido(v: unknown): CartaoDaLista | null {
  const c = (v ?? {}) as Record<string, unknown>;
  const id = texto(c.id, 64);
  const nome = texto(c.nome, 120);
  const estimativa = comTexto(c.estimativa);
  const ph = (c.precoHora ?? {}) as Record<string, unknown>;
  const dois = comTexto(ph["2"]);
  if (!id || !nome || !estimativa || !dois) return null;
  const nota = c.nota as { media?: unknown; avaliacoes?: unknown; texto?: unknown } | null;
  const google = (c.notaGoogle ?? null) as { texto?: unknown; atribuicao?: unknown } | null;
  const textoDoGoogle = google ? texto(google.texto, 80) : null;
  const atribuicao = google ? texto(google.atribuicao, 40) : null;
  const kit = (c.kit ?? {}) as { texto?: unknown; total?: unknown };
  const foto = texto(c.fotografia, 600);
  return {
    id,
    nome,
    selo: texto(c.selo, 60),
    nota:
      nota && typeof nota.media === "number" && typeof nota.avaliacoes === "number" && texto(nota.texto)
        ? { media: nota.media, avaliacoes: nota.avaliacoes, texto: texto(nota.texto) as string }
        : null,
    // Sem a atribuição, não se mostra (os termos do Google pedem-na).
    notaGoogle: textoDoGoogle && atribuicao ? { texto: textoDoGoogle, atribuicao } : null,
    novo: texto(c.novo, 60),
    // Um endereço https, ou um caminho do site («/…», que o ecrã junta ao endereço do site).
    fotografia: foto && (/^https:\/\//.test(foto) || /^\/(?!\/)/.test(foto)) ? foto : null,
    fazComTres: c.fazComTres === true,
    minimoTexto: texto(c.minimoTexto, 80) ?? "",
    horasTexto: texto(c.horasTexto, 80) ?? "",
    precoHora: { 2: dois, 3: comTexto(ph["3"]) },
    materiais: Array.isArray(c.materiais)
      ? c.materiais
          .map((m) => {
            const x = (m ?? {}) as Record<string, unknown>;
            const chave = texto(x.chave, 40);
            const n = texto(x.nome, 60);
            const t = texto(x.texto, 200);
            return chave && n && t ? { chave, nome: n, texto: t } : null;
          })
          .filter((m): m is { chave: string; nome: string; texto: string } => !!m)
      : [],
    kit: { texto: texto(kit.texto) ?? "", total: comTexto(kit.total) },
    estimativa,
    estimativaComKit: comTexto(c.estimativaComKit) ?? estimativa,
  };
}

/**
 * A resposta da rota, ou `null` quando não serve (erro, forma estranha). Uma
 * lista desligada é `{ ligado: false }`. Um cartão sem preço com IVA fica de fora.
 */
export function listaValida(v: unknown): ListaDosParceiros | null {
  const o = (v ?? {}) as Record<string, unknown>;
  if (o.ok !== true) return null;
  if (o.ligado === false) return { ligado: false };
  const t = (o.textos ?? {}) as Record<string, unknown>;
  const textos: TextosDaLista = {
    titulo: texto(t.titulo) ?? "",
    escolha: texto(t.escolha) ?? "",
    semParceirosSegue: texto(t.semParceirosSegue) ?? "",
    procurarMais: texto(t.procurarMais) ?? "",
    botao: texto(t.botao) ?? "",
    notaDaEstimativa: texto(t.notaDaEstimativa) ?? "",
    quemFaz: texto(t.quemFaz) ?? "",
  };
  if (!textos.titulo || !textos.botao) return null;
  const parceiros = (Array.isArray(o.parceiros) ? o.parceiros : [])
    .map(cartaoValido)
    .filter((c): c is CartaoDaLista => !!c)
    // O preço ao cliente leva sempre o IVA à frente (a rota escreve-o assim).
    .filter((c) => /com\s+iva/i.test(c.estimativa.texto) && /com\s+iva/i.test(c.precoHora[2]?.texto ?? ""));
  const ord = (o.ordenacao ?? null) as { titulo?: unknown; frase?: unknown } | null;
  const maximo = typeof o.maximoDeEscolhidos === "number" && o.maximoDeEscolhidos >= 1 ? Math.floor(o.maximoDeEscolhidos) : MAXIMO_POR_OMISSAO;
  return {
    ligado: true,
    pessoas: o.pessoas === 3 ? 3 : 2,
    resumo: texto(o.resumo),
    recomendaTres: texto(o.recomendaTres),
    maximo: Math.min(maximo, MAXIMO_POR_OMISSAO),
    parceiros,
    semParceiros: texto(o.semParceiros),
    ordenacao: ord && texto(ord.titulo) && texto(ord.frase) ? { titulo: texto(ord.titulo) as string, frase: texto(ord.frase, 1000) as string } : null,
    textos,
  };
}

/** Sem lista para mostrar: desligada, ou sem parceiros — o pedido segue como sempre. */
export const semListaParaEscolher = (l: ListaDosParceiros | null): boolean => !l || !l.ligado || l.parceiros.length === 0;

/** Marcar ou desmarcar um parceiro, sem passar do máximo. */
export function alternarParceiro(ids: readonly string[], id: string, maximo: number): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return ids.length >= maximo ? [...ids] : [...ids, id];
}

/** Quem já não está na lista (mudou a equipa, ou a lista mudou) sai da escolha. */
export function soOsDaLista(ids: readonly string[], l: ListaDosParceiros | null): string[] {
  if (!l || !l.ligado) return [];
  return ids.filter((id) => l.parceiros.some((p) => p.id === id));
}

/** A escolha a guardar no rascunho: os nomes pela ordem da lista; «procurar mais» só com um parceiro na lista. */
export function escolhaFeita(ids: readonly string[], l: ListaDosParceiros, pessoas: Pessoas, procurarMais: boolean): EscolhaDosParceiros | null {
  if (!l.ligado) return null;
  const escolhidos = l.parceiros.filter((p) => ids.includes(p.id));
  if (escolhidos.length === 0) return null;
  return {
    ids: escolhidos.map((p) => p.id),
    nomes: escolhidos.map((p) => p.nome),
    pessoas,
    procurarMais: l.parceiros.length === 1 && procurarMais,
  };
}

/** O título do botão do ecrã: «Pedir orçamento (2)», da rota. */
export function botaoDaLista(l: ListaDosParceiros | null, quantos: number): string | null {
  if (!l || !l.ligado || l.parceiros.length === 0) return null;
  return quantos > 0 ? `${l.textos.botao} (${quantos})` : l.textos.botao;
}

/** Os campos que vão no pedido (a rota do pedido confere-os). */
export function camposDaEscolha(e: EscolhaDosParceiros | undefined | null): Record<string, unknown> {
  if (!e || e.ids.length === 0) return {};
  return { parceirosEscolhidos: [...e.ids], pessoas: e.pessoas, procurarMaisParceiros: e.procurarMais };
}

/** «Vai pedir orçamento a A e B (equipa de 2).» — a linha do resumo. */
export function linhaDaEscolha(e: EscolhaDosParceiros): string {
  const nomes = e.nomes.length <= 1 ? (e.nomes[0] ?? "") : `${e.nomes.slice(0, -1).join(", ")} e ${e.nomes[e.nomes.length - 1]}`;
  return `${nomes} (equipa de ${e.pessoas})`;
}

/** Os passos do «Pedido enviado» que a rota do pedido manda numa mudança enviada aos escolhidos. */
export function passosDaResposta(v: unknown): Array<{ titulo: string; texto: string }> | null {
  if (!Array.isArray(v)) return null;
  const l = v
    .map((p) => {
      const x = (p ?? {}) as Record<string, unknown>;
      const titulo = texto(x.titulo, 200);
      return titulo ? { titulo, texto: texto(x.texto, 400) ?? "" } : null;
    })
    .filter((p): p is { titulo: string; texto: string } => !!p);
  return l.length > 0 ? l : null;
}
