import type { PapelDoPainel } from "@/lib/papel-do-painel";
import { ROTULO_DA_ORIGEM, termoQueProcura, type ResultadoDaProcura } from "@/lib/procurar-em-todo-o-lado";
import { servicoEmPalavras } from "@/lib/servico-em-palavras";

/**
 * A BARRA ÚNICA DO BACKOFFICE — d79 (20-11-2026), CEO e dono.
 *
 * Uma só barra de pesquisa, no topo de todas as secções. Primeiro filtra o que
 * a secção aberta já mostra (cada secção com a sua lógica); por baixo, o bloco
 * «Em todo o backoffice» com tudo o que tem a ver com o que se escreveu: o
 * pedido, o cliente, o profissional, os pagamentos e as referências, a conversa
 * do WhatsApp, a agenda e as faturas/comprovativos. Cada linha abre o sítio
 * certo, já procurado.
 *
 * Este ficheiro é puro (vai para o browser): os grupos, quem vê cada um, e as
 * linhas que se desenham. A leitura da base está em
 * `procura-do-backoffice-na-base.ts`; a rota é `/api/admin/procurar`.
 *
 * OS LEADS FICAM DE FORA (dono): não há grupo deles, nem se lê a tabela.
 */

export type GrupoDaProcura =
  | "pedidos"
  | "clientes"
  | "profissionais"
  | "pagamentos"
  | "whatsapp"
  | "agenda"
  | "documentos";

/**
 * Cada grupo e as secções que o abrem. Um assistente vê um grupo só se tiver
 * uma destas secções — e o servidor confere (`gruposQuePodeVer` na rota, e
 * `soOQuePodeVer` à saída). O administrador vê todos.
 */
// Os títulos de cada grupo estão no ecrã (`NoutrosSitios.tsx`): são palavras do backoffice.
export const GRUPOS_DA_PROCURA: ReadonlyArray<{ id: GrupoDaProcura; seccoes: readonly string[] }> = [
  { id: "pedidos", seccoes: ["pedidos", "negociacoes_clyon", "trabalhos_clyon"] },
  { id: "clientes", seccoes: ["contas"] },
  { id: "profissionais", seccoes: ["profissionais"] },
  { id: "pagamentos", seccoes: ["pagamentos", "carteiras"] },
  { id: "whatsapp", seccoes: ["whatsapp"] },
  { id: "agenda", seccoes: ["agenda"] },
  { id: "documentos", seccoes: ["pagamentos", "carteiras", "negociacoes_clyon", "trabalhos_clyon"] },
];

/** O máximo de linhas de cada grupo — a rota não traz mais do que isto. */
export const MAXIMO_POR_GRUPO: Record<GrupoDaProcura, number> = {
  pedidos: 10,
  clientes: 6,
  profissionais: 6,
  pagamentos: 6,
  whatsapp: 6,
  agenda: 6,
  documentos: 6,
};

/** Os grupos que esta conta pode ver. `seccoes` é a lista do assistente (o administrador vê todos). */
export function gruposQuePodeVer(papel: PapelDoPainel, seccoes: readonly string[] | null | undefined): GrupoDaProcura[] {
  if (papel === "admin") return GRUPOS_DA_PROCURA.map((g) => g.id);
  const tem = new Set(seccoes ?? []);
  return GRUPOS_DA_PROCURA.filter((g) => g.seccoes.some((s) => tem.has(s))).map((g) => g.id);
}

/** Onde uma linha abre: a secção (e as de recurso, por ordem) e o que lá se procura. */
export type AbrirEm = { seccoes: string[]; procura: string; estado?: string | null };

export type LinhaDaProcura = {
  chave: string;
  titulo: string;
  detalhe: string | null;
  etiqueta: string | null;
  abrir: AbrirEm | null;
  /** O pedido desta linha, para o «Ver o pedido» do administrador. */
  pedidoId: number | null;
};

export type GruposDaProcura = Partial<Record<GrupoDaProcura, LinhaDaProcura[]>>;

/** A dupla tranca: à saída da rota só ficam os grupos que esta conta pode ver, e no máximo de cada um. */
export function soOQuePodeVer(grupos: GruposDaProcura, podeVer: readonly GrupoDaProcura[]): GruposDaProcura {
  const fora: GruposDaProcura = {};
  for (const g of podeVer) {
    const linhas = grupos[g];
    if (linhas && linhas.length > 0) fora[g] = linhas.slice(0, MAXIMO_POR_GRUPO[g]);
  }
  return fora;
}

/** Há o que procurar? A regra de sempre (`termoQueProcura`): duas letras ou um número. */
export const haOQueProcurar = termoQueProcura;

const juntar = (...partes: Array<string | null | undefined | false>) => partes.filter(Boolean).join(" · ") || null;

/* ── As linhas de cada grupo ─────────────────────────────────────────────── */

export function linhaDoPedido(r: ResultadoDaProcura): LinhaDaProcura {
  return {
    chave: `pedido-${r.pedidoId}`,
    titulo: juntar(`#${r.pedidoId}`, servicoEmPalavras(r.servico), r.cidade) ?? `#${r.pedidoId}`,
    detalhe: juntar(r.cliente, r.telefone, r.profissional ? `com ${r.profissional}` : null),
    etiqueta: juntar(ROTULO_DA_ORIGEM[r.origem], r.estado ? r.estado.replace(/_/g, " ") : null),
    // Na Mesa os de valor fixo e as negociações; sem a Mesa, a lista de todos os pedidos.
    abrir: { seccoes: r.seccao === "pedidos" ? ["pedidos"] : [r.seccao, "pedidos"], procura: `#${r.pedidoId}`, estado: r.estado },
    pedidoId: r.pedidoId,
  };
}

export function linhaDoCliente(c: { id: number; nome: string | null; email: string | null; telefone: string | null; cidade: string | null }): LinhaDaProcura {
  return {
    chave: `cliente-${c.id}`,
    titulo: c.nome?.trim() || c.email || `Conta ${c.id}`,
    detalhe: juntar(c.email, c.telefone, c.cidade),
    etiqueta: "Conta de cliente",
    abrir: { seccoes: ["contas"], procura: c.email || c.nome || "" },
    pedidoId: null,
  };
}

export function linhaDoProfissional(p: { id: number; nome: string; email: string | null; telefone: string | null; cidade: string | null }): LinhaDaProcura {
  return {
    chave: `profissional-${p.id}`,
    titulo: p.nome,
    detalhe: juntar(p.email, p.telefone, p.cidade),
    etiqueta: null,
    abrir: { seccoes: ["profissionais"], procura: p.email || p.nome },
    pedidoId: null,
  };
}

const ROTULO_DO_METODO: Record<string, string> = {
  multibanco: "Multibanco",
  mbway: "MB WAY",
  cartao: "Cartão",
  transferencia: "Transferência",
  numerario: "Numerário",
  ao_profissional: "Pago ao profissional",
  pro_transferencia: "Transferência do profissional",
  pro_mbway: "MB WAY do profissional",
  abatimento: "Abatimento",
};

export function linhaDoPagamento(p: {
  id: number;
  pedidoId: number;
  metodo: string | null;
  estado: string | null;
  valor: number | null;
  referencia: string | null;
  entidade: string | null;
  profissional: string | null;
}): LinhaDaProcura {
  const valor = p.valor != null && Number.isFinite(p.valor) ? `${p.valor.toFixed(2).replace(".", ",")} €` : null;
  const ref = p.referencia ? (p.entidade ? `Ent. ${p.entidade} · Ref. ${p.referencia}` : `Ref. ${p.referencia}`) : null;
  return {
    chave: `pagamento-${p.id}`,
    titulo: juntar(`#${p.pedidoId}`, ROTULO_DO_METODO[p.metodo ?? ""] ?? p.metodo, valor) ?? `#${p.pedidoId}`,
    detalhe: juntar(ref, p.profissional),
    etiqueta: p.estado ? p.estado.replace(/_/g, " ") : null,
    abrir: { seccoes: ["pagamentos", "carteiras"], procura: `#${p.pedidoId}` },
    pedidoId: p.pedidoId,
  };
}

export function linhaDaConversa(c: { telefone: string; ultimaEm: string | null; mensagens: number; nome: string | null }): LinhaDaProcura {
  const nacional = c.telefone.replace(/\D/g, "").replace(/^351(?=\d{9}$)/, "");
  return {
    chave: `whatsapp-${c.telefone}`,
    titulo: juntar(c.nome, `+${c.telefone.replace(/\D/g, "")}`) ?? c.telefone,
    detalhe: `${c.mensagens} mensage${c.mensagens === 1 ? "m" : "ns"}`,
    etiqueta: "WhatsApp",
    abrir: { seccoes: ["whatsapp"], procura: nacional },
    pedidoId: null,
  };
}

export function linhaDaAgenda(a: { pedidoId: number; quando: string | null; profissional: string | null; servico: string | null }): LinhaDaProcura {
  return {
    chave: `agenda-${a.pedidoId}`,
    titulo: juntar(`#${a.pedidoId}`, servicoEmPalavras(a.servico)) ?? `#${a.pedidoId}`,
    detalhe: juntar(a.quando ?? "sem data marcada", a.profissional ? `com ${a.profissional}` : null),
    etiqueta: "Agenda",
    abrir: { seccoes: ["agenda"], procura: `#${a.pedidoId}` },
    pedidoId: a.pedidoId,
  };
}

export function linhaDoDocumento(d: { tipo: "fatura" | "comprovativo"; id: number; pedidoId: number; nome: string | null; deQuem?: string | null }): LinhaDaProcura {
  const fatura = d.tipo === "fatura";
  const de = d.deQuem === "clyon" ? "da CLYON" : d.deQuem ? "do profissional" : null;
  return {
    chave: `${d.tipo}-${d.id}`,
    titulo: juntar(`#${d.pedidoId}`, fatura ? `Fatura ${de ?? ""}`.trim() : "Comprovativo do pagamento") ?? `#${d.pedidoId}`,
    detalhe: d.nome,
    etiqueta: fatura ? "Fatura" : "Comprovativo",
    // A fatura vê-se no cartão do pedido (Mesa); o comprovativo, no rasto do pagamento.
    abrir: fatura
      ? { seccoes: ["negociacoes_clyon", "pagamentos", "carteiras"], procura: `#${d.pedidoId}` }
      : { seccoes: ["pagamentos", "carteiras", "negociacoes_clyon"], procura: `#${d.pedidoId}` },
    pedidoId: d.pedidoId,
  };
}

/** A primeira secção da linha que esta conta vê — ou null (fica o «Ver o pedido» do administrador). */
export function seccaoQueAbre(abrir: AbrirEm | null, podeVer: (s: string) => boolean): string | null {
  if (!abrir) return null;
  return abrir.seccoes.find((s) => podeVer(s)) ?? null;
}
