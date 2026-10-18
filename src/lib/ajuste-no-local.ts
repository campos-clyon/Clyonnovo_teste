import { diaEmLisboa, instanteEmLisboa } from "./hora-de-lisboa";

/**
 * O AJUSTE NO LOCAL — 18-10-2026. O plano é `docs/plano-ajuste-no-local.md`.
 *
 * «O cliente disse que tinha 20 sacos de entulho mas chegou lá tinha 50. O pro
 * deve ter a opção de pedir a atualização do valor ou ajuste, e o cliente deve
 * fazer a aprovação desse ajuste.»
 *
 * Não é uma proposta (a negociação já acabou): é um objecto à parte, guardado
 * em `negociacoes.ajustesJson`, que quando é aprovado escreve `valorAcordado`
 * e mais nada. Quanto ele recebe, quanto o cliente paga, o IVA e a comissão
 * saem daí, como sempre.
 *
 * AS REGRAS, decididas pelo dono a 18-10-2026:
 *   · só com o trabalho dele e antes de o dar por feito (`a_executar`);
 *   · SUBIR precisa do «sim» do cliente, e de fotografias;
 *   · BAIXAR aplica logo — ninguém precisa de ser protegido de pagar menos;
 *   · um pedido aberto de cada vez, e no máximo DOIS por trabalho;
 *   · o pedido fica de pé ATÉ AO FIM DO DIA (23:59 em Lisboa) e depois expira;
 *   · NUNCA SE APROVA SOZINHO. Expirar ou recusar deixa o valor como estava.
 *
 * Puro: sem base de dados. As rotas chamam isto e gravam o resultado.
 */

export const MAXIMO_DE_AJUSTES = 2;
export const MAXIMO_DE_FOTOS_DO_AJUSTE = 8;
export const MOTIVO_MINIMO = 5;
export const MOTIVO_MAXIMO = 500;

export type EstadoDoAjuste =
  | "pendente" // subida à espera do cliente
  | "aprovado" // o cliente (ou a CLYON por ele) disse que sim
  | "recusado" // disse que não — o valor fica
  | "expirado" // ninguém respondeu até ao fim do dia — o valor fica
  | "cancelado" // o profissional retirou o pedido
  | "descida"; // baixou: aplicou-se logo, o cliente foi avisado

export type Ajuste = {
  pedidoEm: string;
  valorAntigo: number;
  valorNovo: number;
  motivo: string;
  fotos: string[];
  estado: EstadoDoAjuste;
  respondidoEm?: string | null;
  respondidoPor?: "cliente" | "clyon" | null;
  notaDaResposta?: string | null;
};

export function ajustesDe(json: string | null | undefined): Ajuste[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l.filter((a) => a && typeof a.valorNovo === "number") as Ajuste[]) : [];
  } catch {
    return [];
  }
}

/** O fim do dia, em Lisboa, em que o ajuste foi pedido. */
export function expiraEm(a: Pick<Ajuste, "pedidoEm">): Date {
  const pedido = new Date(a.pedidoEm);
  const fim = instanteEmLisboa(`${diaEmLisboa(pedido)}T23:59`);
  return new Date((fim ?? pedido).getTime() + 59_999);
}

/** Os pendentes que passaram do prazo passam a «expirado». Não muda nenhum valor. */
export function comPrazosVistos(ajustes: Ajuste[], agora: Date): Ajuste[] {
  return ajustes.map((a) =>
    a.estado === "pendente" && agora.getTime() > expiraEm(a).getTime()
      ? { ...a, estado: "expirado" as const, respondidoEm: expiraEm(a).toISOString(), respondidoPor: null }
      : a,
  );
}

export function ajustePendente(ajustes: Ajuste[], agora: Date): Ajuste | null {
  return comPrazosVistos(ajustes, agora).find((a) => a.estado === "pendente") ?? null;
}

/** Os que contam para o máximo: tudo menos os que ele próprio retirou. */
export function ajustesUsados(ajustes: Ajuste[]): number {
  return ajustes.filter((a) => a.estado !== "cancelado").length;
}

export type EstadoDoTrabalhoParaAjuste = {
  estado: string; // da negociação
  fase: string; // `faseDoTrabalho`
  valorAcordado: number | null;
  ajustes: Ajuste[];
};

/** Porque não pode pedir agora — ou `null` se pode. */
export function porqueNaoPodePedir(t: EstadoDoTrabalhoParaAjuste, agora: Date): string | null {
  if (t.estado !== "acordada" || t.fase !== "a_executar") {
    return "Só se ajusta o valor de um trabalho seu, antes de o dar por feito.";
  }
  if (t.valorAcordado == null) return "Este trabalho ainda não tem valor acordado. Fale com a CLYON.";
  if (ajustePendente(t.ajustes, agora)) return "Já tem um pedido de ajuste à espera do cliente.";
  if (ajustesUsados(t.ajustes) >= MAXIMO_DE_AJUSTES) {
    return `Já pediu ${MAXIMO_DE_AJUSTES} ajustes neste trabalho. A partir daqui é outro orçamento: fale com a CLYON.`;
  }
  return null;
}

export type PedidoDeAjuste = { valorNovo: unknown; motivo: unknown; fotos: unknown };

export type ResultadoDoAjuste =
  | { ok: true; ajustes: Ajuste[]; efeito: "pendente" | "descida"; valorAcordadoNovo: number | null; ajuste: Ajuste }
  | { ok: false; erro: string };

/**
 * O profissional pede. Subir fica pendente; baixar aplica-se logo.
 * `fotosValidas` já vem filtrada pela rota (só URLs do armazenamento da CLYON).
 */
export function pedirAjuste(
  t: EstadoDoTrabalhoParaAjuste,
  pedido: { valorNovo: number; motivo: string; fotos: string[] },
  agora: Date,
): ResultadoDoAjuste {
  const bloqueio = porqueNaoPodePedir(t, agora);
  if (bloqueio) return { ok: false, erro: bloqueio };
  const antigo = t.valorAcordado as number;

  if (!Number.isFinite(pedido.valorNovo) || pedido.valorNovo <= 0) {
    return { ok: false, erro: "Escreva o valor que vai ficar, acima de zero." };
  }
  const novo = Math.round(pedido.valorNovo * 100) / 100;
  if (Math.abs(novo - antigo) < 0.005) return { ok: false, erro: "O valor é o mesmo que estava combinado." };
  if (novo > Math.max(antigo * 10, antigo + 5000)) {
    return { ok: false, erro: "Esse valor está muito acima do combinado. Fale com a CLYON." };
  }

  const motivo = pedido.motivo.trim().slice(0, MOTIVO_MAXIMO);
  if (motivo.length < MOTIVO_MINIMO) {
    return { ok: false, erro: "Diga em poucas palavras o que mudou (ex.: «eram 50 sacos, não 20»)." };
  }

  const fotos = pedido.fotos.slice(0, MAXIMO_DE_FOTOS_DO_AJUSTE);
  const sobe = novo > antigo;
  if (sobe && fotos.length === 0) {
    return { ok: false, erro: "Para subir o valor, fotografe o que encontrou. É o que o cliente vê para decidir." };
  }

  const ajuste: Ajuste = {
    pedidoEm: agora.toISOString(),
    valorAntigo: antigo,
    valorNovo: novo,
    motivo,
    fotos,
    estado: sobe ? "pendente" : "descida",
    respondidoEm: sobe ? null : agora.toISOString(),
    respondidoPor: null,
  };
  return {
    ok: true,
    ajustes: [...comPrazosVistos(t.ajustes, agora), ajuste],
    efeito: sobe ? "pendente" : "descida",
    valorAcordadoNovo: sobe ? null : novo,
    ajuste,
  };
}

export function cancelarAjuste(
  ajustes: Ajuste[],
  agora: Date,
): { ok: true; ajustes: Ajuste[] } | { ok: false; erro: string } {
  const vistos = comPrazosVistos(ajustes, agora);
  const i = vistos.findIndex((a) => a.estado === "pendente");
  if (i < 0) return { ok: false, erro: "Não há nenhum pedido de ajuste à espera." };
  const copia = [...vistos];
  copia[i] = { ...copia[i], estado: "cancelado", respondidoEm: agora.toISOString() };
  return { ok: true, ajustes: copia };
}

/**
 * O cliente (ou a CLYON por ele) responde. Aprovar devolve o valor a gravar em
 * `valorAcordado`; recusar devolve `null` e o valor fica.
 */
export function responderAjuste(
  ajustes: Ajuste[],
  resposta: "aprovar" | "recusar",
  porQuem: "cliente" | "clyon",
  agora: Date,
  nota?: string | null,
):
  | { ok: true; ajustes: Ajuste[]; valorAcordadoNovo: number | null; ajuste: Ajuste }
  | { ok: false; erro: string } {
  const vistos = comPrazosVistos(ajustes, agora);
  const i = vistos.findIndex((a) => a.estado === "pendente");
  if (i < 0) {
    const ultimo = vistos[vistos.length - 1];
    return {
      ok: false,
      erro:
        ultimo?.estado === "expirado"
          ? "Este pedido de ajuste já expirou. O valor combinado mantém-se."
          : "Não há nenhum pedido de ajuste à espera de resposta.",
    };
  }
  const respondido: Ajuste = {
    ...vistos[i],
    estado: resposta === "aprovar" ? "aprovado" : "recusado",
    respondidoEm: agora.toISOString(),
    respondidoPor: porQuem,
    notaDaResposta: typeof nota === "string" && nota.trim() ? nota.trim().slice(0, 300) : null,
  };
  const copia = [...vistos];
  copia[i] = respondido;
  return {
    ok: true,
    ajustes: copia,
    valorAcordadoNovo: resposta === "aprovar" ? respondido.valorNovo : null,
    ajuste: respondido,
  };
}

/** O que a app e os ecrãs precisam de saber, já decidido no servidor. */
export type VistaDoAjuste = {
  pendente: (Ajuste & { expiraEm: string }) | null;
  ultimo: Ajuste | null;
  restantes: number;
  porqueNao: string | null;
};

export function vistaDoAjuste(t: EstadoDoTrabalhoParaAjuste, agora: Date): VistaDoAjuste {
  const vistos = comPrazosVistos(t.ajustes, agora);
  const pendente = vistos.find((a) => a.estado === "pendente") ?? null;
  return {
    pendente: pendente ? { ...pendente, expiraEm: expiraEm(pendente).toISOString() } : null,
    ultimo: vistos[vistos.length - 1] ?? null,
    restantes: Math.max(0, MAXIMO_DE_AJUSTES - ajustesUsados(vistos)),
    porqueNao: porqueNaoPodePedir({ ...t, ajustes: vistos }, agora),
  };
}
