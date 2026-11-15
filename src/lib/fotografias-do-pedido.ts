/**
 * AS FOTOGRAFIAS DE UM PEDIDO, NO FORMULÁRIO DO BACKOFFICE — d37, 15-11-2026.
 *
 * "Editar pedido" mostrava as miniaturas e um «+» que, enquanto uma fotografia
 * subia, virava uma rodinha: não se sabia qual estava a subir, qual tinha
 * falhado, e quem gravasse a meio gravava o pedido sem as que ainda vinham a
 * caminho.
 *
 * Aqui vive a conta, sem ecrã à volta, para se poder testar: quantas cabem,
 * quais seguem no pedido, e se ainda há alguma a caminho.
 */

/**
 * Doze no máximo — o mesmo número que as rotas de criar e de editar já
 * cortavam em silêncio. Agora o ecrã di-lo junto ao «+», e as rotas lêem-no
 * daqui, para o ecrã e o servidor nunca contarem diferente.
 */
export const MAXIMO_DE_FOTOS_DO_PEDIDO = 12;

export type FicheiroDoPedido = { url: string; name: string; size: number; type?: string };

export type EstadoDaFotografia = "a-carregar" | "falhou" | "pronta";

export type FotografiaNoFormulario = {
  /** Única no formulário — a url só existe depois de subir. */
  chave: string;
  estado: EstadoDaFotografia;
  nome: string;
  /** Só nas prontas. */
  ficheiro?: FicheiroDoPedido;
  /** O ficheiro escolhido, para «Tentar outra vez» sem voltar a escolher. */
  original?: File;
  /** Pré-visualização local enquanto sobe (URL.createObjectURL). */
  previa?: string;
  /** Porque falhou, por extenso. */
  motivo?: string;
};

/** As que seguem no pedido: só as que já subiram, pela ordem em que estão. */
export function fotografiasProntas(itens: FotografiaNoFormulario[]): FicheiroDoPedido[] {
  return itens.filter((i) => i.estado === "pronta" && i.ficheiro).map((i) => i.ficheiro as FicheiroDoPedido);
}

export function haFotografiasACarregar(itens: FotografiaNoFormulario[]): boolean {
  return itens.some((i) => i.estado === "a-carregar");
}

/**
 * De `escolhidas`, quantas entram e quantas ficam de fora. Contam todas as que
 * já estão no formulário — também as que falharam, porque «Tentar outra vez»
 * ainda as pode fazer entrar; quem quiser o lugar tira-a no ✕.
 */
export function quantasCabem(
  jaNoFormulario: number,
  escolhidas: number,
  maximo: number = MAXIMO_DE_FOTOS_DO_PEDIDO,
): { entram: number; ficamDeFora: number } {
  const livres = Math.max(0, maximo - jaNoFormulario);
  const entram = Math.min(livres, Math.max(0, escolhidas));
  return { entram, ficamDeFora: Math.max(0, escolhidas - entram) };
}
