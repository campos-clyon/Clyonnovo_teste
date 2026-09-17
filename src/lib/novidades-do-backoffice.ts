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

export const SECCOES_COM_AVISO = [
  "pedidos",
  "profissionais",
  "agenda",
  "whatsapp",
  "carteiras",
  "levantamentos",
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
  if (vistoEm) {
    const t = new Date(String(vistoEm).replace(" ", "T")).getTime();
    if (Number.isFinite(t)) return new Date(t);
  }
  return new Date(agora - JANELA_SEM_MARCA_MS);
}

/** Zero em todas — o ponto de partida, e o que se devolve quando falha. */
export function nenhumaNovidade(): Record<SeccaoComAviso, number> {
  const saida = {} as Record<SeccaoComAviso, number>;
  for (const s of SECCOES_COM_AVISO) saida[s] = 0;
  return saida;
}
