/**
 * O SITE INTEIRO À HORA DE LISBOA, ESTEJA ONDE ESTIVER QUEM OLHA.
 *
 * *«Tem um problema no fuso horário do site: ele deve estar sempre no horário
 * de Lisboa, independente de onde o admin esteja. Tudo deve ser num único
 * horário.»* — 01-10-2026.
 *
 * O servidor já está em Lisboa (`instrumentation.ts`). O browser não: cada
 * `toLocaleString()` e cada `Intl.DateTimeFormat` sem `timeZone` escreve a hora
 * no fuso do computador de quem abre a página. Do Brasil, um trabalho às 15h
 * aparecia às 11h — e eram mais de cem sítios a escrever datas assim.
 *
 * Em vez de corrigir cem chamadas (e esperar que a centésima primeira se
 * lembre), muda-se o que «sem fuso» quer dizer: este script corre no `<head>`,
 * antes de qualquer outro, e faz o `Intl.DateTimeFormat` e os três
 * `toLocale…String` usarem Lisboa quando quem chama não diz outro fuso. Quem
 * diz um fuso explícito continua a ter o seu.
 *
 * O QUE ISTO NÃO MUDA: `getHours()`, `getDate()`, `new Date(ano, mês, dia)` e
 * as strings sem fuso continuam no relógio do computador — isso não se muda
 * por fora sem reescrever o `Date` inteiro. Para essas há `hora-de-lisboa.ts`,
 * e cada ecrã que conta dias ou lê campos de data usa-o.
 *
 * É UMA STRING, E ESCRITA À MÃO EM JS SIMPLES, de propósito: vai tal e qual
 * para dentro de um `<script>`. Uma função TypeScript serializada com
 * `.toString()` levava com ela o que o compilador lhe acrescentasse.
 */
export const FUSO_DO_SITE = "Europe/Lisbon";

export const SCRIPT_DO_FUSO_DE_LISBOA = `(function () {
  var g = globalThis;
  if (!g.Intl || g.__fusoDeLisboa) return;
  g.__fusoDeLisboa = true;
  var FUSO = "${FUSO_DO_SITE}";
  function comFuso(opcoes) {
    if (opcoes != null && opcoes.timeZone) return opcoes;
    var o = {};
    if (opcoes != null) for (var k in opcoes) o[k] = opcoes[k];
    o.timeZone = FUSO;
    return o;
  }
  var Original = g.Intl.DateTimeFormat;
  function DateTimeFormat(locais, opcoes) {
    return new Original(locais, comFuso(opcoes));
  }
  DateTimeFormat.prototype = Original.prototype;
  DateTimeFormat.supportedLocalesOf = Original.supportedLocalesOf;
  g.Intl.DateTimeFormat = DateTimeFormat;
  var D = g.Date.prototype;
  ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"].forEach(function (nome) {
    var original = D[nome];
    D[nome] = function (locais, opcoes) {
      return original.call(this, locais, comFuso(opcoes));
    };
  });
})();`;
