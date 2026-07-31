/**
 * Taxa de agendamento — o que a CLYON cobra por guardar um dia na agenda.
 *
 * NÃO É PREÇO DO TRABALHO. É esta a diferença que interessa:
 *
 *   O preço do trabalho é do profissional. Se a taxa entrar lá dentro, o
 *   profissional passa a ganhar mais por um trabalho de hoje do que pelo
 *   mesmo trabalho daqui a duas semanas — e não é isso que se quer. A taxa é
 *   100% da CLYON e o profissional recebe o mesmo em qualquer dia.
 *
 *   Dentro do preço, a taxa levava IVA: 29,99 € chegavam ao cliente como
 *   36,89 €. A taxa não leva IVA e não se arredonda — são valores exactos ao
 *   cêntimo, pagos à CLYON por MB WAY ou transferência, junto com a reserva
 *   de 5%.
 *
 * Isto substitui os +40 € / +20 € que o simulador somava ao preço. Esses
 * valores deixaram de existir: o site estava a anunciar uma taxa que a CLYON
 * já não cobra.
 *
 * A fonte de verdade dos pedidos da app é o Supabase —
 * `service_requests.scheduling_fee` guarda o valor e `valor_a_cobrar(request_id)`
 * devolve reserva + taxa. Se o simulador vier a criar pedidos por lá, é essa
 * função que dá o total; isto serve para MOSTRAR o valor a quem está a pedir
 * orçamento no site, antes de existir pedido nenhum.
 */

/** Escalões, por dias de distância até ao dia do serviço. */
export const ESCALOES_TAXA = [
  { ateDias: 0,  valor: 29.99, rotulo: "Hoje" },
  { ateDias: 1,  valor: 14.99, rotulo: "Amanhã" },
  { ateDias: 7,  valor: 0,     rotulo: "Dentro de uma semana" },
  { ateDias: 30, valor: 9.99,  rotulo: "Entre 8 e 30 dias" },
] as const;

/** A agenda acaba aos 30 dias — não se marca para lá disso. */
export const DIAS_MAXIMOS_AGENDA = 30;

/**
 * A taxa para um serviço daqui a `dias`.
 *
 * `null` quer dizer "fora da agenda", não "grátis" — quem chamar isto tem de
 * distinguir as duas coisas. Devolver 0 para um dia impossível seria dizer
 * que se pode marcar, de graça.
 */
export function taxaPorDias(dias: number): number | null {
  if (!Number.isFinite(dias) || dias < 0) return null;
  if (dias > DIAS_MAXIMOS_AGENDA) return null;

  for (const escalao of ESCALOES_TAXA) {
    if (dias <= escalao.ateDias) return escalao.valor;
  }
  return null;
}

/**
 * Quantos dias de calendário faltam até `data`.
 *
 * Conta DIAS DE CALENDÁRIO, não períodos de 24 horas: um serviço às 9h de
 * amanhã pedido às 23h de hoje está a 10 horas de distância, mas é "amanhã" e
 * paga 14,99 € — não "hoje" a 29,99 €. Contar horas punha o cliente a pagar
 * o dobro por causa da hora a que abriu o site.
 */
export function diasAteData(data: Date, agora: Date = new Date()): number {
  const meiaNoite = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((meiaNoite(data) - meiaNoite(agora)) / 86_400_000);
}

/**
 * O simulador do site não pergunta um dia — pergunta "quando precisa?", com
 * categorias. Enquanto for assim, é preciso traduzir.
 *
 * `this_week` e `flexible` caem no escalão sem taxa: é o que a pessoa está a
 * dizer quando escolhe uma delas, e cobrar 9,99 € por um "flexível" seria
 * cobrar por uma escolha que ela não fez. O escalão dos 8–30 dias só se
 * aplica quando há mesmo um dia escolhido — na app, onde a faixa dos dias
 * mostra a taxa de cada um.
 */
export function taxaPorUrgencia(urgencia: string | null | undefined): number {
  switch (urgencia) {
    case "today":    return 29.99;
    case "tomorrow": return 14.99;
    default:         return 0;
  }
}

/** Em cêntimos, para quem precisa de inteiros e não de vírgula flutuante. */
export function taxaEmCentimos(valor: number): number {
  return Math.round(valor * 100);
}

/**
 * Formata para o ecrã. Exacto ao cêntimo, sem arredondar — 29,99 € é 29,99 €,
 * nunca 30 €.
 */
export function formatarTaxa(valor: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

/**
 * ⚠️ TRADUÇÃO OBRIGATÓRIA para a app. Nunca enviar a urgência do site em cru.
 *
 * A palavra `flexivel` quer dizer coisas DIFERENTES nos dois lados:
 *
 *   no site  → "sem pressa", e vale 0 €
 *   na app   → "marcou entre 8 e 30 dias", e vale 9,99 €
 *
 * Enquanto o simulador só mostra números, a diferença não faz mal. No dia em
 * que criar um service_request, faz: o estimate-request escreve
 * `scheduling_fee` a partir de `facts.quando.urgencia`, e um `flexivel` vindo
 * daqui sai de lá com 9,99 € cobrados a alguém a quem mostrámos zero.
 *
 * "Sem pressa" traduz-se para `esta_semana`, que vale 0 € nos dois sistemas —
 * é a única combinação segura enquanto o site perguntar categorias em vez de
 * um dia. Quando o simulador tiver a faixa de dias, isto deixa de ser preciso:
 * o dia determina a taxa e há uma regra só.
 */
export type UrgenciaApp = "hoje" | "amanha" | "esta_semana" | "flexivel";

export function urgenciaDoSiteParaApp(urgenciaDoSite: string | null | undefined): UrgenciaApp {
  switch (urgenciaDoSite) {
    case "today":     return "hoje";
    case "tomorrow":  return "amanha";
    // "this_week", "flexible", "no", vazio — tudo o que no site significa
    // "não tenho pressa" vai como esta_semana. NUNCA como flexivel.
    default:          return "esta_semana";
  }
}

/**
 * A taxa que a app vai cobrar pela urgência que lhe mandarmos.
 *
 * Serve para uma coisa só: garantir que o valor mostrado no site é o mesmo
 * que o cliente acaba por pagar. Se estes dois números divergirem, mostrámos
 * um preço e cobrámos outro.
 */
export function taxaQueAppVaiCobrar(urgencia: UrgenciaApp): number {
  switch (urgencia) {
    case "hoje":        return 29.99;
    case "amanha":      return 14.99;
    case "esta_semana": return 0;
    case "flexivel":    return 9.99;
  }
}
