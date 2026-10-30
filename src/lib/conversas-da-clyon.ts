import { filtrarContactos } from "./filtro-de-contactos";

/**
 * AS CONVERSAS DA CLYON — a parte pura (30-10-2026, «Conversas» fase 1).
 *
 * Três tipos de conversa, numa só tabela (`conversas`):
 *   · `suporte_cliente` — o «Suporte CLYON» do cliente: uma por conta, nasce
 *     ao primeiro uso; responde a equipa (fase 1) e mais tarde a Vitória;
 *   · `suporte_profissional` — o mesmo, para o parceiro (fase 2);
 *   · `pedido` — cliente e parceiro de um pedido. Só abre DEPOIS DE
 *     CONTRATADO (decisão 1b) e os contactos ficam sempre tapados (2a).
 *     Criam-se na fase 2; as regras já estão aqui.
 *
 * Quem pede tem de pertencer à conversa: as rotas perguntam aqui
 * (`pertenceAConversa`) e respondem 404 a quem não pertence — o mesmo que a
 * uma conversa que não existe. E o que sai para o cliente ou o parceiro passa
 * por `vistaDaMensagem`: nunca o texto original de uma mensagem filtrada,
 * nunca quem da equipa a escreveu.
 */

export type TipoDeConversa = "suporte_cliente" | "suporte_profissional" | "pedido";
export type EstadoDaConversa = "aberta" | "so_leitura" | "fechada";
export type AtendidaPor = "vitoria" | "equipa";
export type AutorDaMensagem = "cliente" | "profissional" | "equipa" | "vitoria" | "sistema";

export const TIPOS_DE_CONVERSA: readonly TipoDeConversa[] = ["suporte_cliente", "suporte_profissional", "pedido"];

export type Conversa = {
  id: number;
  tipo: TipoDeConversa;
  pedidoId: number | null;
  negociacaoId: number | null;
  clienteContaId: number | null;
  profissionalId: number | null;
  estado: EstadoDaConversa;
  atendidaPor: AtendidaPor;
  criadaEm: string;
  ultimaMensagemEm: string | null;
};

export type MensagemGuardada = {
  id: number;
  conversaId: number;
  autor: AutorDaMensagem;
  autorId: number | null;
  texto: string;
  textoOriginal: string | null;
  filtrada: boolean;
  /** Sinal para a equipa (M1): palavras de contacto ou telefone partido. Só a equipa o vê. */
  alerta?: string | null;
  anexoUrl: string | null;
  criadaEm: string;
};

/** Quem está a pedir, já confirmado pela sessão. */
export type QuemPede =
  | { papel: "cliente"; contaId: number }
  | { papel: "profissional"; providerId: number };

/** A chave das leituras (`leiturasDaConversa.quem`). A equipa lê em conjunto. */
export function chaveDeLeitura(q: QuemPede | "equipa"): string {
  if (q === "equipa") return "equipa";
  return q.papel === "cliente" ? `cliente:${q.contaId}` : `profissional:${q.providerId}`;
}

/** Esta pessoa pertence a esta conversa? Sem excepções nem atalhos. */
export function pertenceAConversa(c: Pick<Conversa, "tipo" | "clienteContaId" | "profissionalId">, q: QuemPede): boolean {
  if (q.papel === "cliente") {
    if (c.tipo !== "suporte_cliente" && c.tipo !== "pedido") return false;
    return c.clienteContaId != null && Number(c.clienteContaId) === q.contaId && q.contaId > 0;
  }
  if (c.tipo !== "suporte_profissional" && c.tipo !== "pedido") return false;
  return c.profissionalId != null && Number(c.profissionalId) === q.providerId && q.providerId > 0;
}

/** Pode escrever? Só numa conversa aberta. */
export function podeEscrever(c: Pick<Conversa, "estado">): boolean {
  return c.estado === "aberta";
}

/** O autor de quem escreve, pelo papel. */
export function autorDe(q: QuemPede): AutorDaMensagem {
  return q.papel === "cliente" ? "cliente" : "profissional";
}

/**
 * O que se grava de uma mensagem nova. Nas conversas de pedido os contactos
 * tapam-se SEMPRE (2a); o original fica para a equipa. No suporte não: é à
 * CLYON que a pessoa escreve. O texto já vem lido por `lerMensagemNova`
 * (conversa-com-a-clyon.ts), a mesma regra da resposta R14.
 */
export function prepararMensagem(
  c: Pick<Conversa, "tipo">,
  lida: { texto: string; anexoUrl: string | null },
  /** As mensagens anteriores do mesmo autor nesta conversa (para o telefone partido). */
  anteriores: string[] = [],
): { texto: string; textoOriginal: string | null; filtrada: boolean; alerta: string | null; anexoUrl: string | null } {
  if (c.tipo === "pedido") {
    const f = filtrarContactos(lida.texto, anteriores);
    return {
      texto: f.texto,
      textoOriginal: f.filtrada ? f.original : null,
      filtrada: f.filtrada,
      alerta: f.alerta,
      anexoUrl: lida.anexoUrl,
    };
  }
  return { texto: lida.texto, textoOriginal: null, filtrada: false, alerta: null, anexoUrl: lida.anexoUrl };
}

/** Como se apresenta quem escreveu, a quem lê do lado do cliente ou do parceiro. */
export function rotuloDoAutor(autor: AutorDaMensagem, paraQuem: QuemPede["papel"]): string {
  switch (autor) {
    case "equipa":
      return "Equipa CLYON";
    case "vitoria":
      return "Vitória, assistente online";
    case "sistema":
      return "CLYON";
    case "cliente":
      return paraQuem === "cliente" ? "Eu" : "Cliente";
    case "profissional":
      // «Parceiro» no que o cliente lê (dono, 29-10-2026).
      return paraQuem === "profissional" ? "Eu" : "Parceiro";
  }
}

export type MensagemVista = {
  id: number;
  autor: AutorDaMensagem;
  rotulo: string;
  minha: boolean;
  texto: string;
  filtrada: boolean;
  anexoUrl: string | null;
  criadaEm: string;
};

/** O que sai para o cliente ou o parceiro: sem `textoOriginal`, sem `autorId`. */
export function vistaDaMensagem(m: MensagemGuardada, q: QuemPede): MensagemVista {
  return {
    id: m.id,
    autor: m.autor,
    rotulo: rotuloDoAutor(m.autor, q.papel),
    minha: m.autor === autorDe(q),
    texto: m.texto,
    filtrada: !!m.filtrada,
    anexoUrl: m.anexoUrl ?? null,
    criadaEm: m.criadaEm,
  };
}

/** O que sai da conversa para o cliente ou o parceiro (sem as contas do outro lado). */
export function vistaDaConversa(c: Conversa) {
  return {
    id: c.id,
    tipo: c.tipo,
    pedidoId: c.pedidoId,
    estado: c.estado,
    atendidaPor: c.atendidaPor,
    titulo: c.tipo === "pedido" ? `Pedido #${c.pedidoId}` : "Suporte CLYON",
    criadaEm: c.criadaEm,
    ultimaMensagemEm: c.ultimaMensagemEm,
  };
}

/** Lê o n.º de uma conversa de um parâmetro do endereço. */
export function idDaConversa(v: string | undefined | null): number | null {
  return v && /^\d{1,10}$/.test(v) && Number(v) > 0 ? Number(v) : null;
}

/* ── A purga (retenção) ─────────────────────────────────────────────────── */

/** O que a purga sabe de uma conversa — as idades contadas pelo relógio da base. */
export type ConversaParaAPurga = {
  id: number;
  tipo: string;
  estado: string;
  /** O pedido ainda existe na base (a purga dos pedidos já o pode ter levado). */
  pedidoExiste: boolean;
  /** Dias desde a última mensagem (ou desde que nasceu, sem mensagens). */
  diasSemMensagens: number;
  /** Meses completos desde que fechou (`fechadaEm`, ou a última mensagem). */
  mesesDesdeQueFechou: number;
};

/**
 * APAGA-SE ESTA CONVERSA? (decisão 3b do dono, 30-10-2026)
 *   · de pedido: 6 meses depois de o pedido fechar — fechada, só de leitura,
 *     ou o pedido já não existe. Uma conversa de pedido aberta nunca sai;
 *   · de suporte: 90 dias sem mensagens;
 *   · um tipo que não se conhece nunca sai.
 */
export function conversaParaApagar(
  c: ConversaParaAPurga,
  prazos: { mesesDoPedido: number; diasDoSuporte: number },
): boolean {
  if (c.tipo === "pedido") {
    const fechou = c.estado === "fechada" || c.estado === "so_leitura" || !c.pedidoExiste;
    return fechou && c.mesesDesdeQueFechou >= prazos.mesesDoPedido;
  }
  if (c.tipo === "suporte_cliente" || c.tipo === "suporte_profissional") {
    return c.diasSemMensagens >= prazos.diasDoSuporte;
  }
  return false;
}
