/**
 * PARA ONDE SE PODE MANDAR ALGUÉM DEPOIS DE ENTRAR.
 *
 * As três entradas do site — a do cliente (NextAuth), a do backoffice e a do
 * ambiente de testes — aceitam um destino vindo do endereço («?proximo=»,
 * «callbackUrl»). É o que leva a pessoa de volta à página onde estava. É
 * também, se não se verificar, a forma clássica de fazer um link com o nosso
 * domínio que acaba noutro sítio: a pessoa vê clyon.pt, entra com a
 * palavra-passe dela, e é largada numa cópia do site que lhe pede o resto.
 *
 * As verificações que lá estavam deixavam passar três formas:
 *
 *   · «https://clyon.pt.outro.com» e «https://clyon.pt@outro.com» — começam
 *     pelo nosso endereço, e é só isso que o `startsWith` olhava;
 *   · «/\outro.com» — o browser lê a barra invertida como barra, e isto é
 *     «//outro.com», que é outro site;
 *   · «//outro.com», na entrada de testes, que só exigia a primeira barra.
 *
 * Este módulo não importa nada de propósito: corre no browser e no servidor.
 */

/** É um caminho do próprio site, escrito como caminho? */
export function eCaminhoInterno(destino: unknown): destino is string {
  if (typeof destino !== "string" || !destino.startsWith("/")) return false;
  // «//x» e «/\x» são, para o browser, o endereço de OUTRO site.
  if (destino.startsWith("//") || destino.startsWith("/\\")) return false;
  /*
   * Caracteres de controlo: o browser apaga-os do meio de um endereço antes
   * de o ler, e «/<TAB>/outro.com» passa a ser «//outro.com» depois de a
   * verificação de cima já ter dito que sim.
   */
  for (let i = 0; i < destino.length; i++) {
    const c = destino.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return false;
  }
  return true;
}

/**
 * O destino, se for do próprio site; senão o de omissão. Para o browser.
 *
 * A segunda prova é a do próprio browser: resolve-se o destino contra a
 * origem da página e confirma-se que a origem continua a ser a mesma. O que
 * sai é só o caminho — nunca um endereço completo.
 */
export function destinoInterno(
  destino: string | null | undefined,
  origem: string,
  omissao: string,
): string {
  if (!eCaminhoInterno(destino)) return omissao;
  try {
    const url = new URL(destino, origem);
    if (url.origin !== new URL(origem).origin) return omissao;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return omissao;
  }
}

/**
 * O callback `redirect` do NextAuth.
 *
 * Um caminho do site vai para o site; um endereço completo só passa se for
 * da MESMA origem, comparada como origem e não como texto; o resto cai na
 * conta, que é para onde a entrada do cliente sempre levou.
 */
export function redireccionamentoDepoisDeEntrar(url: string, baseUrl: string): string {
  if (eCaminhoInterno(url)) return `${baseUrl}${url}`;
  try {
    if (new URL(url).origin === new URL(baseUrl).origin) return url;
  } catch {
    /* não é um endereço completo — cai no de omissão */
  }
  return `${baseUrl}/conta`;
}
