/**
 * A FOTOGRAFIA NO TAMANHO EM QUE SE MOSTRA — 07-10-2026.
 *
 * *«Melhore os números para Portugal.»* No Speed Insights do Vercel, o painel
 * do profissional e a página de um pedido eram as rotas que puxavam a nota
 * para baixo — e mostram fotografias dos clientes.
 *
 * Cada quadradinho de 112 px da lista de trabalhos descarregava a fotografia
 * inteira: até 1920 px, que é o que `reduzir-imagem.ts` deixa passar, e muitas
 * vezes perto de 1 MB. Numa lista de cinquenta pedidos eram dezenas de
 * megabytes pelos dados móveis do profissional, a disputar a rede com o que o
 * ecrã precisa para abrir.
 *
 * O optimizador do Next (o mesmo das imagens do site, configurado no
 * `next.config.ts`) devolve-a no tamanho pedido e em AVIF/WebP. Só serve para
 * as fotografias do nosso armazenamento — é o único destino que o
 * `remotePatterns` autoriza. Tudo o resto (uma pré-visualização local, um
 * endereço de outro sítio) mostra-se como vem.
 */

/** O armazenamento das fotografias — o mesmo padrão do `remotePatterns`. */
const DO_ARMAZENAMENTO = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

/** Esta fotografia pode passar pelo optimizador? */
export function podeOptimizar(url: string | null | undefined): boolean {
  return typeof url === "string" && DO_ARMAZENAMENTO.test(url);
}
