/**
 * O SELO VERMELHO, EM TODAS AS SECÇÕES — e não só no Suporte.
 *
 * "Coloque todas as categorias — Pedidos, Profissionais, Agenda, WhatsApp,
 * Carteiras — para terem notificações como no supp, mas devem sumir ao abrir
 * ou visualizar." — 17-09-2026.
 *
 * O Suporte já tinha o seu, e funcionava: um número ao lado do nome, que diz
 * quanto há para ver. As outras secções não tinham nada — para saber se
 * entrou um pedido era preciso abrir Pedidos e comparar de cabeça com o que lá
 * estava da última vez.
 *
 * ESTE FICHEIRO É A PARTE PURA: que secções avisam, e a partir de que instante
 * é que uma coisa conta como nova. Sem base de dados, para se poder interrogar
 * com um relógio à mão.
 *
 * ⚠️ NÃO É A MESMA COISA QUE O SELO DO SUPORTE, e é de propósito. Ali o número
 * é «quantos esperam por resposta» — uma fila de trabalho, que só se esvazia
 * respondendo. Aqui é «o que aconteceu desde que olhaste», que se esvazia por
 * se olhar. As duas fazem falta e nenhuma substitui a outra.
 */

import { instanteDaBase } from "./hora-de-lisboa";

/*
 * E MAIS QUATRO — 17-10-2026. *«Deve ter sempre notificações.»* — o dono, que
 * escolheu Negociações, Trabalhos CLYON, Pagamentos e Contas. O que cada uma
 * conta está em `contarNovidades` (db.ts).
 */
export const SECCOES_COM_AVISO = [
  "pedidos",
  "profissionais",
  "agenda",
  "whatsapp",
  "carteiras",
  "levantamentos",
  "negociacoes_clyon",
  "trabalhos_clyon",
  "pagamentos",
  "contas",
] as const;

export type SeccaoComAviso = (typeof SECCOES_COM_AVISO)[number];

export function eSeccaoComAviso(v: unknown): v is SeccaoComAviso {
  return typeof v === "string" && (SECCOES_COM_AVISO as readonly string[]).includes(v);
}

/**
 * QUANTO SE MOSTRA A QUEM NUNCA ABRIU AQUILO.
 *
 * Sem marca de leitura há duas saídas, e ambas más se levadas ao extremo:
 * contar tudo desde sempre põe «107» ao lado de Pedidos no primeiro dia — um
 * número que não é notícia nenhuma e que ensina a ignorar o selo; contar zero
 * esconde o que entrou esta manhã a quem entra pela primeira vez.
 *
 * Um dia é o meio-termo honesto: é o que uma pessoa esperaria ver ao chegar de
 * manhã, e ao primeiro clique a marca fica gravada e a partir daí a contagem é
 * exacta.
 */
export const JANELA_SEM_MARCA_MS = 24 * 60 * 60 * 1000;

/**
 * A partir de que instante é que se conta, para uma secção.
 *
 * Aceita o que a base devolve — `'2026-09-17 18:35:02'` ou um ISO — e trata
 * uma data ilegível como se não houvesse marca nenhuma: mostrar a mais é o
 * lado seguro do engano, porque esconder novidades não se vê.
 */
export function desdeQuando(vistoEm: string | null | undefined, agora: number): Date {
  // `'2026-09-17 18:35:02'` vem de `toMySQLDateTime`, que escreve em UTC —
  // lido sem fuso, no servidor em Lisboa, ficava uma hora atrás no Verão.
  const d = instanteDaBase(vistoEm);
  if (d) return d;
  return new Date(agora - JANELA_SEM_MARCA_MS);
}

/** Uma negociação, como a base a devolve para o selo das Negociações. */
export type NegociacaoParaOSelo = {
  pedidoId: number;
  estado: string;
  propostasJson: string | null;
  updatedAt: Date | string | null;
  execucaoEnviadaEm: Date | string | null;
  confirmadoEm: Date | string | null;
};

/**
 * O SELO DAS NEGOCIAÇÕES — 17-10-2026: os pedidos em que um PROFISSIONAL
 * mexeu desde que se olhou. São as três coisas que a mesa põe em «Precisa de
 * si» (`precisaDeSi` no painel), com a data a dizer que é de agora:
 *
 *   · aceitou o valor e espera que o contratem (`aguarda_contratacao`);
 *   · fez uma proposta, e ela está pendente;
 *   · disse que o trabalho está feito, e falta confirmar.
 *
 * A proposta do cliente pendente não conta: espera pelo profissional, não
 * por nós. As negociações que nós próprios enviamos também não — o que se
 * acabou de fazer não é aviso. Conta pedidos, e não negociações: é um
 * cartão por pedido, e o selo não pode ser maior do que a mesa.
 */
export function pedidosComRespostaDoProfissional(linhas: NegociacaoParaOSelo[], desde: Date): number {
  return quaisPedidosComRespostaDoProfissional(linhas, desde).length;
}

/** Os mesmos pedidos, pelo número, do mais recente para o mais antigo (19-10-2026). */
export function quaisPedidosComRespostaDoProfissional(linhas: NegociacaoParaOSelo[], desde: Date): number[] {  const depois = (v: Date | string | null) => {
    const d = instanteDaBase(v);
    return d != null && d.getTime() > desde.getTime();
  };
  const pedidos = new Set<number>();
  for (const n of linhas) {
    if (n.estado === "desistida" || n.estado === "morta") continue;
    const feito = n.execucaoEnviadaEm != null && n.confirmadoEm == null && depois(n.execucaoEnviadaEm);
    const aceitou = n.estado === "aguarda_contratacao" && depois(n.updatedAt);
    const propos = n.estado === "aberta" && depois(n.updatedAt) && temPropostaDoProfissional(n.propostasJson);
    if (feito || aceitou || propos) pedidos.add(Number(n.pedidoId));
  }
  return [...pedidos].sort((a, b) => b - a);
}

function temPropostaDoProfissional(json: string | null): boolean {
  if (!json) return false;
  try {
    const l = JSON.parse(json);
    return (
      Array.isArray(l) &&
      l.some((p) => p && (p as { por?: unknown }).por === "profissional" && (p as { estado?: unknown }).estado === "pendente")
    );
  } catch {
    return false;
  }
}

/** Zero em todas — o ponto de partida, e o que se devolve quando falha. */
export function nenhumaNovidade(): Record<SeccaoComAviso, number> {
  const saida = {} as Record<SeccaoComAviso, number>;
  for (const s of SECCOES_COM_AVISO) saida[s] = 0;
  return saida;
}
