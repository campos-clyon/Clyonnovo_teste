/**
 * JSON para dentro de <script type="application/ld+json">.
 *
 * PORQUE ISTO EXISTE
 *
 * `JSON.stringify` não escapa `<`. Um valor que contenha `</script>` fecha a
 * etiqueta a meio do JSON, e o que vier a seguir passa a ser HTML da página —
 * a partir daí escreve-se o que se quiser, incluindo um `<script>` nosso, no
 * nosso domínio.
 *
 * Durante muito tempo isto não tinha por onde entrar: os dados estruturados
 * eram todos escritos por nós. Deixou de ser assim com a página de cada
 * profissional, cujo nome e cidade são escritos pelo próprio no painel e vão
 * direitos para o JSON-LD. Um nome com `</script><script>…` era um script a
 * correr na página pública de um profissional.
 *
 * Usa-se em TODOS os `application/ld+json` do site, mesmo nos de conteúdo
 * estático: uma regra com excepções é uma regra que alguém copia do sítio
 * errado.
 *
 * O resultado continua a ser JSON válido e igual ao original depois de lido:
 * a sequência de escape `u003c` (com a barra à frente) é o próprio `<` escrito
 * de outra maneira. O U+2028 e o U+2029 vão também, porque são fins de linha
 * para o JavaScript antigo e partem o script em quem o leia como tal.
 */

/*
 * Os dois separadores escritos pelo código do carácter, e não à letra: um
 * U+2028 literal dentro de uma expressão regular é um fim de linha, e o
 * ficheiro deixa de compilar.
 */
const SEPARADOR_DE_LINHA = new RegExp(String.fromCharCode(0x2028), "g");
const SEPARADOR_DE_PARAGRAFO = new RegExp(String.fromCharCode(0x2029), "g");

export function jsonLd(dados: unknown): string {
  return (JSON.stringify(dados) ?? "null")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(SEPARADOR_DE_LINHA, "\\u2028")
    .replace(SEPARADOR_DE_PARAGRAFO, "\\u2029");
}
