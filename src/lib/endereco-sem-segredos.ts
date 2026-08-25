/**
 * O endereço de uma página, sem aquilo que nele é credencial.
 *
 * O PROBLEMA
 *
 * Seis rotas deste site trazem um TOKEN dentro do próprio endereço — é assim
 * que o cliente sem conta abre o pedido dele, e que o profissional responde a
 * uma proposta pelo link do email:
 *
 *   /pedido/<token>            /profissionais/pedidos/<token>
 *   /orcamento/<token>         /profissionais/definir-senha/<token>
 *   /admin/aprovar/<token>     /profissionais/inscricao/<token>
 *
 * Esses tokens são credenciais completas: quem os tem, entra. E o `gtag`
 * manda para o Google o endereço da página onde corre — o endereço INTEIRO.
 * Sem isto, cada visita a um pedido escrevia a chave desse pedido num
 * relatório do Analytics, onde fica legível para toda a gente que tenha
 * acesso à conta, e clicável.
 *
 * O QUE ISTO FAZ
 *
 * Troca o token pela palavra TOKEN e deixa o resto do caminho em paz. A
 * contagem continua a servir para o que serve — saber quantas pessoas abrem
 * pedidos — e deixa de carregar o segredo. O mesmo para o `?chave=` do portão
 * do MVP e para qualquer `?token=`.
 *
 * Um endereço que não se consegue ler devolve vazio, e não o original: se não
 * se percebe o endereço, também não se percebe o que nele é segredo, e perder
 * um número de estatística é sempre melhor do que revelar uma chave.
 */

/** Rotas cujo último pedaço do caminho é uma credencial. */
export const ROTAS_COM_SEGREDO = [
  "/pedido/",
  "/orcamento/",
  "/admin/aprovar/",
  "/profissionais/pedidos/",
  "/profissionais/definir-senha/",
  "/profissionais/inscricao/",
] as const;

/** Parâmetros que nunca devem viajar para fora, tenham o valor que tiverem. */
const PARAMETROS_SECRETOS = ["chave", "token"] as const;

/**
 * Esta página TEM um segredo no endereço?
 *
 * Serve para a decisão mais forte: nestas páginas não se carrega medição
 * nenhuma. Redigir o `page_location` do `gtag` não chegava — provado no
 * browser: o tag do Google Ads manda na mesma o endereço verdadeiro no seu
 * próprio pedido (`ccm/collect?dl=…`), porque lê o `location` do browser e
 * não o que lhe demos. Contra isso não há redacção que valha; o que vale é
 * não pôr lá o script.
 *
 * O que se perde: saber quantas pessoas abrem o pedido delas. O que se
 * ganha: a chave desse pedido nunca sai de casa. Não é troca difícil.
 */
export function temSegredoNoEndereco(caminho: string): boolean {
  return ROTAS_COM_SEGREDO.some(
    (r) => caminho.startsWith(r) && caminho.length > r.length,
  );
}

export function enderecoSemSegredos(endereco: string): string {
  if (!endereco) return "";

  let url: URL;
  try {
    url = new URL(endereco);
  } catch {
    return "";
  }

  const rota = ROTAS_COM_SEGREDO.find(
    (r) => url.pathname.startsWith(r) && url.pathname.length > r.length,
  );
  if (rota) url.pathname = `${rota}TOKEN`;

  for (const p of PARAMETROS_SECRETOS) url.searchParams.delete(p);

  return url.toString();
}
