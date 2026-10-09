/**
 * OS TIPOS DE MUDANÇA COM PÁGINA PRÓPRIA, E O CAMINHO PARA PEDIR UMA — 09-10-2026.
 *
 * *«Quero fortalecer a nossa presença nas mudanças tanto quanto nas recolhas.»*
 * Quem procura «transporte de móveis» ou «mudança de escritório» não escreve
 * «mudanças», e caía numa página que não falava do caso dele. Cada tipo tem a
 * sua página, e todas as páginas de mudanças ligam às três — por isso a lista
 * vive aqui, uma vez.
 *
 * NÃO IMPORTA NADA, de propósito: o rodapé é um componente de cliente e lê
 * daqui os endereços; não pode arrastar as cidades nem o resto do site para o
 * browser (ver «o que vai para o browser» em seo-tecnico.test.ts).
 */

/**
 * O simulador já aberto em «Mudança» — quem chega de uma página de mudanças
 * não tem de escolher o serviço outra vez (`servico-na-ligacao.ts`).
 */
export const PEDIR_MUDANCA = "/simulador?servico=mudanca";

export const TIPOS_DE_MUDANCA = [
  {
    href: "/transporte-de-moveis",
    titulo: "Transporte de móveis",
    resumo: "Um sofá, uma cama, um roupeiro ou poucos volumes, de uma morada para outra.",
  },
  {
    href: "/pequenas-mudancas",
    titulo: "Pequenas mudanças",
    resumo: "Um quarto, um estúdio ou um T0/T1 — quando não é preciso um camião grande.",
  },
  {
    href: "/mudancas-de-escritorio",
    titulo: "Mudanças de escritório",
    resumo: "Escritórios, lojas e consultórios, com factura e hora fora do expediente.",
  },
] as const;

/** Os endereços das três, para o middleware não os tratar como cidades. */
export const PAGINAS_DE_TIPO_DE_MUDANCA: readonly string[] = TIPOS_DE_MUDANCA.map((t) => t.href);
