/**
 * O QUE O CLIENTE VÊ DO HISTÓRICO DO PEDIDO — 26-10-2026 (d33).
 *
 * O `historyJson` de um pedido é o diário da equipa: quem registou o pedido e
 * com que valor de partida, o que se pediu ao cliente e por onde, o preço e o
 * lucro escritos à mão, quem marcou o quê, o que se pagou ao profissional. A
 * área do cliente mostrava tudo o que não era conversa — e a API entregava o
 * diário inteiro ao browser, onde qualquer pessoa o lia no separador da rede.
 *
 * Agora é uma LISTA FECHADA: só os tipos abaixo saem do servidor para o
 * cliente. Tudo o resto — e qualquer tipo que nasça amanhã — fica de fora por
 * omissão.
 *
 * PORQUE É QUE O "created" NÃO ENTRA
 *
 * É o tipo de serviço de quase todas as rotas: escreve tanto «Negociação
 * fechada» como «Pagamento ao profissional marcado como feito» ou «Valor de
 * partida: 120 €». O tipo não separa o que é do cliente do que é da equipa, e
 * uma lista que deixasse passar um tipo assim já não era fechada. Uma entrada
 * nova para o cliente nasce com um tipo próprio e entra aqui de propósito, com
 * um teste.
 *
 * O "note", o "agenda", o "assigned", o "accepted", o "approved", o
 * "archived" e o "valor_corrigido" também ficam de fora: levam o nome de quem
 * da equipa fez, valores sem IVA soltos, ou avisos internos.
 *
 * Puro: corre no servidor (a API da conta, a resposta do cliente e o SSR da
 * conta) e no browser — o ecrã volta a filtrar, para que um histórico que lhe
 * chegue por outro caminho também não mostre o que não deve.
 */

/** A conversa entre a equipa e o cliente — a secção «Mensagens». */
export const TIPOS_DA_CONVERSA_COM_O_CLIENTE = [
  "info_requested",
  "message_to_client",
  "client_reply",
] as const;

/** A lista fechada: a conversa e o que o próprio cliente fez. */
export const TIPOS_QUE_O_CLIENTE_VE = [
  ...TIPOS_DA_CONVERSA_COM_O_CLIENTE,
  "client_confirmed",
  "client_cancelled",
  "client_rating",
  // As alterações que ele próprio fez ou pediu (S17, 29-10-2026).
  "alteracao_do_cliente",
] as const;

export type EntradaParaOCliente = {
  type: string;
  message: string;
  createdAt: string;
  /** Só o nome — nunca o id nem o papel de quem escreveu. */
  by: { nome: string } | null;
};

export function oClienteVeEsteTipo(tipo: unknown): boolean {
  return typeof tipo === "string" && (TIPOS_QUE_O_CLIENTE_VE as readonly string[]).includes(tipo);
}

export function eDaConversaComOCliente(tipo: unknown): boolean {
  return (
    typeof tipo === "string" && (TIPOS_DA_CONVERSA_COM_O_CLIENTE as readonly string[]).includes(tipo)
  );
}

function lista(historyJson: unknown): unknown[] {
  if (Array.isArray(historyJson)) return historyJson;
  if (typeof historyJson !== "string" || !historyJson.trim()) return [];
  try {
    const l = JSON.parse(historyJson);
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

function quando(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  return "";
}

/**
 * As entradas que o cliente pode ver, pela ordem em que foram gravadas, e só
 * com o que o ecrã precisa: o tipo, a mensagem, a data e o nome de quem
 * escreveu. Tolerante: um histórico partido não rebenta a conta, fica vazio.
 */
export function entradasParaOCliente(historyJson: unknown): EntradaParaOCliente[] {
  const saida: EntradaParaOCliente[] = [];
  for (const e of lista(historyJson)) {
    if (!e || typeof e !== "object") continue;
    const o = e as { type?: unknown; message?: unknown; createdAt?: unknown; by?: unknown };
    if (!oClienteVeEsteTipo(o.type)) continue;
    const message = typeof o.message === "string" ? o.message : "";
    if (!message.trim()) continue;
    const nome =
      o.by && typeof o.by === "object" && typeof (o.by as { nome?: unknown }).nome === "string"
        ? ((o.by as { nome: string }).nome.trim() || null)
        : null;
    saida.push({
      type: o.type as string,
      message,
      createdAt: quando(o.createdAt),
      by: nome ? { nome } : null,
    });
  }
  return saida;
}

/**
 * O `historyJson` que sai do servidor para o cliente: só a lista fechada, ou
 * nada.
 *
 * Um Trabalho CLYON de valor fixo não leva histórico nenhum (02-10-2026, ver
 * `oferta-clyon.ts`): fica aqui, e não em cada rota, para que as três portas
 * — a lista da conta, a resposta do cliente e o SSR da conta — digam o mesmo.
 */
export function historicoParaOCliente(
  historyJson: unknown,
  opcoes: { trabalhoClyon?: unknown } = {},
): string | null {
  const t = opcoes.trabalhoClyon;
  if (t === true || Number(t) === 1) return null;
  const entradas = entradasParaOCliente(historyJson);
  return entradas.length > 0 ? JSON.stringify(entradas) : null;
}

/*
 * A CONVERSA COM A CLYON, PARA O ECRÃ — 29-10-2026 (S18).
 *
 * O «Pedir info» grava no histórico «Pedido de informação enviado ao cliente:
 * "…"» — a frase é da equipa. Ao cliente mostra-se só a mensagem, e quem
 * escreveu é sempre «CLYON» (nunca o nome da pessoa da equipa) ou «Eu».
 */
export const PREFIXO_DO_PEDIDO_DE_DETALHES = "Pedido de informação enviado ao cliente: ";

/** O texto de uma entrada da conversa como o cliente o lê. */
export function textoParaOCliente(e: { type: string; message: string }): string {
  if (e.type === "info_requested" && e.message.startsWith(PREFIXO_DO_PEDIDO_DE_DETALHES)) {
    const resto = e.message.slice(PREFIXO_DO_PEDIDO_DE_DETALHES.length).trim();
    return resto.replace(/^"([\s\S]*?)"?(…)?$/, "$1$2").trim();
  }
  return e.message;
}

export type MensagemDoPedido = {
  de: "CLYON" | "Eu";
  /** `detalhes` quando a CLYON pediu mais detalhes. */
  tipo: "detalhes" | "mensagem" | "resposta";
  texto: string;
  em: string;
};

/** A conversa do pedido, pela ordem em que foi escrita. */
export function mensagensDoPedido(historyJson: unknown): MensagemDoPedido[] {
  return entradasParaOCliente(historyJson)
    .filter((e) => eDaConversaComOCliente(e.type))
    .map((e) => ({
      de: e.type === "client_reply" ? ("Eu" as const) : ("CLYON" as const),
      tipo: e.type === "info_requested" ? ("detalhes" as const) : e.type === "client_reply" ? ("resposta" as const) : ("mensagem" as const),
      texto: textoParaOCliente(e),
      em: e.createdAt,
    }));
}

/**
 * A CLYON ESTÁ À ESPERA DELE? — o pedido está em «precisa info» e a última
 * palavra da conversa não é dele.
 */
export function aClyonPrecisaDeSi(status: unknown, historyJson: unknown): boolean {
  if (String(status ?? "") !== "precisa_info") return false;
  const conversa = mensagensDoPedido(historyJson);
  const ultima = conversa[conversa.length - 1];
  return !ultima || ultima.de !== "Eu";
}
