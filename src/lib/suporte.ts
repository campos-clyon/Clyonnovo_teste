/**
 * Centro de suporte — vocabulário partilhado com a app.
 *
 * A app mostra o `status` EM BRUTO, em maiúsculas, dentro de uma pílula. É
 * por isso que o cliente vê "OPEN". Se escrevermos aqui um valor que a app
 * não conheça, ele aparece tal e qual no ecrã do cliente — "IN_PROGRESS" — e
 * não há nada do nosso lado que o esconda.
 *
 * Por isso este ficheiro é a lista fechada do que o backoffice pode escrever.
 * A tradução para português é do lado da app; o que sai daqui são os valores
 * combinados, nada mais.
 */

/** Os quatro estados combinados. `open` é o que a app escreve ao criar. */
export const ESTADOS_TICKET = ["open", "in_progress", "waiting_customer", "closed"] as const;
export type EstadoTicket = (typeof ESTADOS_TICKET)[number];

/** Estados que ainda pedem trabalho nosso — o que conta para o aviso no menu. */
export const ESTADOS_POR_TRATAR: EstadoTicket[] = ["open", "in_progress", "waiting_customer"];

/**
 * Fechar é o único estado que marca `resolved_at`. Reabrir limpa-o — sem
 * isso, um ticket reaberto ficava com data de resolução e a contagem de
 * "quanto tempo demorou" passava a mentir.
 */
export function resolvedAtPara(estado: EstadoTicket, agoraISO: string): string | null {
  return estado === "closed" ? agoraISO : null;
}

export function ehEstadoValido(valor: unknown): valor is EstadoTicket {
  return typeof valor === "string" && (ESTADOS_TICKET as readonly string[]).includes(valor);
}

/** Rótulos para o backoffice. Não vão para a app — ela traduz do lado dela. */
export const ROTULO_ESTADO: Record<EstadoTicket, string> = {
  open:             "Por ler",
  in_progress:      "Em curso",
  waiting_customer: "À espera do cliente",
  closed:           "Fechado",
};

/**
 * Categorias que a app escreve. `partner` não é um assunto — é o que a app
 * põe quando quem escreve é um profissional. Fica na lista porque aparece
 * mesmo nos dados, e um valor que não esteja aqui é mostrado como está.
 */
export const ROTULO_CATEGORIA: Record<string, string> = {
  general: "Geral",
  payment: "Pagamentos",
  service: "Serviço",
  account: "Conta",
  other:   "Outro",
  partner: "Profissional",
};

export function rotuloCategoria(valor: string | null | undefined): string {
  if (!valor) return "—";
  return ROTULO_CATEGORIA[valor] ?? valor;
}

export function rotuloQuemEscreve(userRole: string | null | undefined): string {
  if (userRole === "partner") return "Profissional";
  if (userRole === "customer") return "Cliente";
  return userRole ?? "—";
}

/**
 * Há quanto tempo está aberto, em texto curto.
 *
 * O que interessa a quem abre a lista é "isto está à espera há muito?", não
 * a data exacta — que já está noutra coluna. Dois tickets de 13 e 25 de
 * julho por ler são um número que se lê de relance.
 */
export function haQuantoTempo(criadoEm: string | Date, agora: Date = new Date()): string {
  const inicio = criadoEm instanceof Date ? criadoEm : new Date(criadoEm);
  const ms = agora.getTime() - inicio.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";

  const minutos = Math.floor(ms / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias < 30) return dias === 1 ? "há 1 dia" : `há ${dias} dias`;

  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

/**
 * Quem respondeu, para gravar em texto.
 *
 * `author_id` é um uuid do Supabase e o colaborador do painel é um inteiro do
 * MySQL — não há uuid nenhum para pôr lá. É o mesmo problema que já
 * resolvemos em payment_references.confirmed_by_label, e a solução é a mesma:
 * uma coluna de texto com o nome e o id à frente.
 */
export function etiquetaAutor(colab: { id: number; nome: string }): string {
  return `${colab.nome} (#${colab.id})`;
}
