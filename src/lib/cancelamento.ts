/**
 * Cancelar um pedido é um direito, dos dois lados.
 *
 * "Eu quero cancelar o pedido do Rui. Essa opção deve ser absoluta: tanto a
 * CLYON quanto o Rui devem ter esse direito."
 *
 * A primeira versão recusava com 409 quando havia trabalho contratado ou
 * executado, e mandava desistir da negociação primeiro. O raciocínio não era
 * mau — do outro lado há alguém que contou com o trabalho — mas a conclusão
 * era: proteger o profissional impedindo o cliente de desistir. Isso não
 * protege ninguém. Um cliente que já foi noutro sítio não deixa de o ter feito
 * por o botão estar bloqueado; o pedido é que fica na mesa a fingir que ainda
 * está vivo, e o profissional continua à espera de uma resposta que não vem.
 *
 * O QUE MUDA, ENTÃO, EM VEZ DE BLOQUEAR
 *
 * O cancelamento passa sempre. O que muda é o PESO: quando há um compromisso
 * a desfazer, o motivo deixa de ser opcional e passa a obrigatório, e fica
 * escrito quem foi desfeito, por quanto, e em que ponto estava. Um pedido
 * cancelado sem motivo é indistinguível de um cancelado por engano — e quando
 * o profissional perguntar porque é que perdeu o trabalho, a resposta tem de
 * existir por escrito.
 */

/**
 * OS MOTIVOS, EM BOTÕES — e não numa caixa de texto vazia.
 *
 * "Esses clientes desistem e não há hora de cancelar. Em vez de ter que
 * colocar textos com o motivo, dê-me opções tipo cliente desistiu, ou não
 * deseja mais, já foi feito, etc." — 10-09-2026.
 *
 * Escrever à mão tem dois defeitos. O primeiro é o trabalho, precisamente na
 * hora em que se quer despachar; o segundo aparece um ano depois — cada
 * pessoa escreve a mesma coisa de maneira diferente («desistiu», «desistência
 * do cliente», «já não quer») e ninguém consegue contar quantos pedidos se
 * perderam por desistência. Com uma lista fechada, o registo passa a poder
 * ser somado.
 *
 * «Outro motivo» fica, e é o único que pede texto: uma lista fechada a que
 * falte a razão verdadeira obriga a escolher a mentira mais parecida.
 */
export const MOTIVOS_DE_CANCELAMENTO = [
  "O cliente desistiu",
  "O cliente já não precisa",
  "Já foi feito por outra pessoa",
  "Não conseguimos falar com o cliente",
  "O profissional não pode fazer",
  "Pedido repetido",
] as const;

export type MotivoDeCancelamento = (typeof MOTIVOS_DE_CANCELAMENTO)[number];

export type NegociacaoParaCancelar = {
  estado: string;
  valorAcordado: unknown;
  profissionalNome: string;
  execucaoEnviadaEm?: unknown;
  confirmadoEm?: unknown;
  pagoEm?: unknown;
};

export type OQueSeDesfaz = {
  /** Há um compromisso a sério a ser desfeito? */
  temCompromisso: boolean;
  /** O motivo passa a ser obrigatório? */
  motivoObrigatorio: boolean;
  /** O profissional afectado, quando há um. */
  profissional: string | null;
  /** O valor acordado, quando existe. */
  valor: number | null;
  /**
   * Em que ponto estava, em português, para o aviso e para o registo:
   * "contratado", "com o trabalho já feito", "com o pagamento já libertado".
   */
  ponto: string | null;
  /**
   * O dinheiro já saiu para a carteira dele? Se sim, cancelar o pedido NÃO o
   * traz de volta, e quem cancela tem de saber isso antes e não depois.
   */
  dinheiroJaLibertado: boolean;
};

const numero = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * O que é que este cancelamento desfaz, exactamente.
 *
 * A negociação que conta é a mais avançada de todas: se uma está acordada e
 * três estão mortas, o que se desfaz é a acordada.
 */
export function oQueSeDesfaz(negociacoes: NegociacaoParaCancelar[]): OQueSeDesfaz {
  const vivas = negociacoes.filter((n) => n.estado !== "morta" && n.estado !== "desistida");

  const paga = vivas.find((n) => n.pagoEm != null);
  const confirmada = paga ?? vivas.find((n) => n.confirmadoEm != null);
  const executada = confirmada ?? vivas.find((n) => n.execucaoEnviadaEm != null);
  const acordada = executada ?? vivas.find((n) => n.estado === "acordada");

  if (!acordada) {
    return {
      temCompromisso: false,
      motivoObrigatorio: false,
      profissional: null,
      valor: null,
      ponto: null,
      dinheiroJaLibertado: false,
    };
  }

  const ponto =
    acordada.pagoEm != null
      ? "com o pagamento já feito"
      : acordada.confirmadoEm != null
        ? "com o pagamento já libertado"
        : acordada.execucaoEnviadaEm != null
          ? "com o trabalho já feito e à espera de confirmação"
          : "contratado";

  return {
    temCompromisso: true,
    motivoObrigatorio: true,
    profissional: acordada.profissionalNome,
    valor: numero(acordada.valorAcordado),
    ponto,
    dinheiroJaLibertado: acordada.confirmadoEm != null || acordada.pagoEm != null,
  };
}

/** O aviso, por extenso, para quem está prestes a carregar no botão. */
export function avisoDoCancelamento(d: OQueSeDesfaz): string | null {
  if (!d.temCompromisso) return null;
  const valor = d.valor != null ? ` por ${d.valor.toFixed(2).replace(".", ",")} €` : "";
  return (
    `Este trabalho está ${d.ponto} com ${d.profissional}${valor}. ` +
    `Cancelar desfaz esse compromisso e ele deixa de contar com o trabalho.` +
    (d.dinheiroJaLibertado
      ? " O pagamento já foi libertado e cancelar o pedido NÃO o traz de volta."
      : " O valor que estava cativo deixa de estar.")
  );
}

/** A frase que fica no histórico e no registo permanente. */
export function resumoDoCancelamento(
  d: OQueSeDesfaz,
  porQuem: string,
  motivo: string | null,
): string {
  const base = `Pedido cancelado por ${porQuem}`;
  const oQue = d.temCompromisso
    ? ` — desfeito o compromisso ${d.ponto} com ${d.profissional}` +
      (d.valor != null ? ` por ${d.valor.toFixed(2).replace(".", ",")} €` : "") +
      (d.dinheiroJaLibertado ? ", com o pagamento já libertado (não revertido)" : "")
    : "";
  return `${base}${oQue}${motivo ? `. Motivo: ${motivo}` : ""}.`;
}

/**
 * DESFAZER UM CANCELAMENTO SEM MEMÓRIA DELE — 30-09-2026.
 *
 * «Esse pedido está nos cancelados por engano, como restauro ele?» — o #320.
 * Até hoje o cancelamento punha todas as negociações em «morta» sem deixar
 * escrito em que estado estava cada uma. Desde hoje deixa (ver
 * `reabrirPedidoCancelado` em db.ts); para os cancelados antes disso, o
 * estado lê-se do que ficou:
 *
 *   · uma RECUSA no registo permanente volta a ser recusa — reabri-la punha
 *     outra vez à frente do cliente uma proposta que ele já tinha dito que não;
 *   · sem valor acordado, estava a ser negociada: «aberta». As propostas nunca
 *     saíram do JSON, e as pendentes voltam pendentes;
 *   · com valor acordado e trabalho entregue, confirmado ou com dia marcado,
 *     estava fechada;
 *   · com valor acordado e mais nada, quem aceitou decide: o cliente a aceitar
 *     o valor do profissional FECHA (`aceitar`, em negociacao.ts); o
 *     profissional a aceitar o do cliente deixa-a à espera de o cliente
 *     contratar. Na dúvida fica à espera — pedir outra vez ao cliente que diga
 *     que sim custa uma mensagem; dar por fechado o que não estava custa um
 *     profissional à porta de quem não o chamou.
 */
export type NegociacaoParaReabrir = {
  id: number;
  valorAcordado: unknown;
  propostasJson: string | null;
  execucaoEnviadaEm?: unknown;
  confirmadoEm?: unknown;
  dataCombinada?: unknown;
  /** Há no registo permanente uma recusa desta negociação. */
  desistiu?: boolean;
};

export type EstadoReposto = "aberta" | "aguarda_contratacao" | "acordada" | "desistida";

export function estadoAntesDoCancelamento(n: NegociacaoParaReabrir): EstadoReposto {
  if (n.desistiu) return "desistida";
  if (n.valorAcordado == null || n.valorAcordado === "") return "aberta";
  if (n.execucaoEnviadaEm || n.confirmadoEm || n.dataCombinada) return "acordada";

  let propostas: Array<{ por?: unknown; estado?: unknown }> = [];
  try {
    const lidas = JSON.parse(n.propostasJson ?? "[]");
    if (Array.isArray(lidas)) propostas = lidas;
  } catch {
    // Um JSON estragado não se adivinha: fica à espera do cliente, que é o
    // lado seguro.
  }
  const aceite = [...propostas].reverse().find((p) => p?.estado === "aceite");
  return aceite?.por === "profissional" ? "acordada" : "aguarda_contratacao";
}

/**
 * Quais voltam, e a que estado.
 *
 * SE UMA ESTAVA FECHADA, SÓ ESSA VOLTA. Fechar um negócio mata as outras
 * negociações do pedido nesse instante (`encerrarOutrasNegociacoes`) — elas
 * já estavam mortas antes do cancelamento, e reabri-las punha à venda um
 * trabalho que já tinha dono.
 */
export function oQueReabrir(
  candidatas: NegociacaoParaReabrir[],
): Array<{ id: number; estado: EstadoReposto }> {
  const repostas = candidatas.map((n) => ({ id: n.id, estado: estadoAntesDoCancelamento(n) }));
  const fechada = repostas.find((r) => r.estado === "acordada");
  return fechada ? [fechada] : repostas;
}
