/**
 * Escapar texto antes de o pôr dentro de HTML.
 *
 * PORQUE ISTO EXISTE
 *
 * Os emails da CLYON são montados com template strings: `<p>${nome}</p>`. O
 * `nome`, a `mensagem` e a morada vêm de formulários públicos — qualquer
 * pessoa os escreve, sem conta e sem autenticação.
 *
 * Sem escapar, quem preenchesse o formulário de contacto com
 *
 *     <a href="https://sitio-falso">Confirmar pagamento</a>
 *
 * conseguia que a CLYON lhe enviasse esse botão, num email enviado de
 * noreply@clyon.pt, com o aspecto dos nossos. Quem o abre do lado de cá vê um
 * email legítimo da empresa. É phishing feito com o nosso domínio e a nossa
 * marca, e nós é que o mandámos.
 *
 * Não é XSS no sentido clássico — os clientes de email não correm script — e
 * é precisamente por isso que passa despercebido. O dano é o conteúdo, não o
 * código.
 */

const SUBSTITUICOES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Texto seguro para ir dentro de um elemento ou de um atributo entre aspas.
 *
 * Aceita null/undefined e devolve string vazia: quem chama isto está a montar
 * HTML e não quer "undefined" no meio da frase.
 */
export function escaparHtml(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/[&<>"']/g, (c) => SUBSTITUICOES[c]);
}

/** Atalho de leitura para os templates: `${e(nome)}`. */
export const e = escaparHtml;

/**
 * JSON para dentro de <script type="application/ld+json">.
 *
 * `JSON.stringify` não escapa `<`, por isso um valor que contenha
 * `</script>` fecha a etiqueta e o resto passa a ser HTML — a partir daí
 * escreve-se o que se quiser na página.
 *
 * Hoje todos os nossos schemas usam conteúdo local e as rotas dinâmicas
 * respondem 404 a slugs desconhecidos, por isso não há por onde entrar. Isto
 * é para o dia em que alguém acrescentar ali uma avaliação vinda da base de
 * dados e não se lembrar deste detalhe.
 */
export function jsonParaScript(dados: unknown): string {
  return JSON.stringify(dados)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
