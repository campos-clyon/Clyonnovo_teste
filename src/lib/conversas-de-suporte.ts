/**
 * TODAS AS MENSAGENS NUM SÍTIO SÓ — a caixa de entrada do suporte.
 *
 * "Abra um chat directo para o suporte falar com os clientes e pros por aqui.
 * Hoje recebi uma mensagem vinda de uma cliente com dúvida no seu pedido, mas
 * ela ficou presa ao pedido e agora não sei qual era. Faça com que todas as
 * mensagens venham parar aqui, devidamente separadas como no WhatsApp."
 * — 13-09-2026.
 *
 * O problema não é o desenho do ecrã: é que uma mensagem de um cliente podia
 * cair em QUATRO SÍTIOS diferentes, e um deles não tinha ecrã nenhum.
 *
 *   · o centro de ajuda da app  → `support_tickets`, no Supabase;
 *   · a ajuda da plataforma     → `pedidosDeAjuda`, no MySQL;
 *   · uma resposta DENTRO de um pedido → uma linha no `historyJson` desse
 *     pedido, visível só para quem abrisse esse pedido;
 *   · o WhatsApp               → `whatsappMensagens`, com painel próprio.
 *
 * O terceiro é o que o perdeu. Uma cliente respondeu a um pedido de informação,
 * a mensagem ficou dentro do pedido #qualquer-coisa, e não havia lista nenhuma
 * onde ela aparecesse. Para a encontrar era preciso abrir os pedidos um a um.
 *
 * Este ficheiro é a parte PURA do remédio: pega no que cada fonte guarda — que
 * são quatro formas diferentes — e devolve UMA conversa, com as mensagens por
 * ordem, quem falou e quando. Sem base de dados, para poder ser interrogado
 * com um histórico estragado, um JSON meio escrito, ou uma mensagem sem autor.
 */

/** De onde veio a conversa. Decide o distintivo, e por onde a resposta sai. */
export type OrigemDaConversa = "pedido" | "plataforma" | "app" | "whatsapp";

export const ROTULO_DA_ORIGEM: Record<OrigemDaConversa, string> = {
  pedido: "No pedido",
  plataforma: "Plataforma",
  app: "App",
  whatsapp: "WhatsApp",
};

/**
 * As cores de cada origem, no escuro do painel.
 *
 * Véus e não manchas cheias: ao lado de um nome, uma mancha sólida lê-se como
 * um botão — a mesma lição da etiqueta da fase, nas Negociações.
 */
export const CORES_DA_ORIGEM: Record<OrigemDaConversa, string> = {
  pedido: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  plataforma: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  app: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  whatsapp: "border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]",
};

export type MensagemDaConversa = {
  /** Quem escreveu. É isto que decide o lado do balão. */
  de: "eles" | "clyon";
  texto: string;
  /** ISO, ou o que a base devolveu. O ecrã formata. */
  quando: string;
  /** O nome de quem escreveu, quando se sabe. */
  autor?: string | null;
};

export type ConversaDeSuporte = {
  /**
   * O endereço desta conversa: `pedido:283`, `plataforma:12`, `whatsapp:912…`.
   *
   * É por aqui que a resposta sabe por onde sair. Um id numérico sozinho não
   * chegava: o #12 da plataforma e o #12 de um pedido são conversas
   * diferentes com pessoas diferentes.
   */
  chave: string;
  origem: OrigemDaConversa;
  quem: string;
  /** Email ou telefone — o que houver, para se poder responder por fora. */
  contacto: string | null;
  /** O pedido a que isto diz respeito, quando há um. */
  pedidoId: number | null;
  assunto: string | null;
  mensagens: MensagemDaConversa[];
};

/** Uma entrada do `historyJson` de um pedido, como ela é gravada. */
export type EntradaDoHistorico = {
  type?: unknown;
  message?: unknown;
  createdAt?: unknown;
  by?: { nome?: unknown; role?: unknown } | null;
};

/**
 * As entradas do histórico que são CONVERSA, e não registo de operação.
 *
 * O histórico de um pedido guarda tudo — atribuições, mudanças de estado,
 * valores corrigidos. Destas três é que se fala com uma pessoa.
 */
export const TIPOS_DE_CONVERSA = ["client_reply", "info_requested", "message_to_client"];

export function eConversa(tipo: unknown): boolean {
  return typeof tipo === "string" && TIPOS_DE_CONVERSA.includes(tipo);
}

/**
 * A gordura com que o pedido de informação foi gravado.
 *
 * `pedir-info` escreve no histórico «Pedido de informação enviado ao cliente:
 * "..."» — uma frase escrita para um registo de operações, não para um balão
 * de conversa. Num fio ao lado da resposta dela, aquilo lê-se como se o
 * suporte falasse de si próprio na terceira pessoa.
 *
 * Tira-se o embrulho e fica o que foi mesmo dito. Se o formato mudar, fica o
 * texto inteiro — feio, mas nunca vazio.
 */
export function semOEmbrulho(texto: string): string {
  const m = texto.match(/^Pedido de informação enviado ao cliente:\s*"([\s\S]*)"$/);
  if (m) return m[1].replace(/…$/, "").trim();
  return texto.trim();
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * A conversa que está dentro do histórico de um pedido.
 *
 * Devolve as mensagens por ordem de escrita. Uma entrada sem texto não entra:
 * um balão vazio num fio é pior do que uma mensagem a menos.
 */
export function conversaDoHistorico(historyJson: unknown): MensagemDaConversa[] {
  if (typeof historyJson !== "string" || !historyJson.trim()) return [];
  let lista: unknown;
  try {
    lista = JSON.parse(historyJson);
  } catch {
    // Um histórico estragado não pode calar o ecrã inteiro.
    return [];
  }
  if (!Array.isArray(lista)) return [];

  const mensagens: MensagemDaConversa[] = [];
  for (const bruta of lista as EntradaDoHistorico[]) {
    if (!bruta || typeof bruta !== "object") continue;
    if (!eConversa(bruta.type)) continue;
    const corpo = semOEmbrulho(texto(bruta.message));
    if (!corpo) continue;
    mensagens.push({
      de: bruta.type === "client_reply" ? "eles" : "clyon",
      texto: corpo,
      quando: texto(bruta.createdAt),
      autor: texto(bruta.by?.nome) || null,
    });
  }
  return mensagens;
}

/** O instante da última mensagem — é por ele que a lista se ordena. */
export function ultimaEm(c: ConversaDeSuporte): number {
  const ultima = c.mensagens[c.mensagens.length - 1];
  if (!ultima) return 0;
  const t = new Date(String(ultima.quando).replace(" ", "T")).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * A BOLA ESTÁ DO LADO DE CÁ?
 *
 * A última mensagem é deles, e ninguém respondeu. É o único critério que
 * interessa a quem abre este ecrã de manhã — e é o que põe a conversa em cima
 * e com marca.
 */
export function porResponder(c: ConversaDeSuporte): boolean {
  const ultima = c.mensagens[c.mensagens.length - 1];
  return ultima?.de === "eles";
}

/**
 * A ordem da lista: primeiro quem espera por nós, depois o resto — e dentro de
 * cada grupo, a mais recente à frente.
 *
 * Não é a ordem dos tickets («mais antigo primeiro»), e é de propósito: ali a
 * lista é uma fila de trabalho; aqui é uma caixa de entrada, e numa caixa de
 * entrada o que acabou de chegar é o que se lê primeiro. Quem espera há mais
 * tempo continua a distinguir-se — pela data, que está à vista em cada linha.
 */
export function ordenarConversas(cs: ConversaDeSuporte[]): ConversaDeSuporte[] {
  return [...cs].sort((a, b) => {
    const pa = porResponder(a) ? 1 : 0;
    const pb = porResponder(b) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return ultimaEm(b) - ultimaEm(a);
  });
}

/** O endereço de uma conversa, e a leitura dele. Um sítio só para os dois. */
export function chaveDaConversa(origem: OrigemDaConversa, id: string | number): string {
  return `${origem}:${id}`;
}

export function lerChave(chave: string): { origem: OrigemDaConversa; id: string } | null {
  const i = String(chave).indexOf(":");
  if (i <= 0) return null;
  const origem = chave.slice(0, i);
  const id = chave.slice(i + 1);
  if (!id) return null;
  if (origem !== "pedido" && origem !== "plataforma" && origem !== "app" && origem !== "whatsapp") {
    return null;
  }
  return { origem, id };
}
