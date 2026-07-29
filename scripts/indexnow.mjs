#!/usr/bin/env node
/**
 * Avisa o IndexNow das páginas que mudaram.
 *
 *   npm run seo:indexnow            → páginas alteradas nos últimos 7 dias
 *   npm run seo:indexnow -- --dias 30
 *   npm run seo:indexnow -- --tudo  → todas as do sitemap
 *   npm run seo:indexnow -- --seco  → mostra o que enviaria, não envia
 *
 * O QUE ISTO É: um protocolo em que o site diz aos motores de busca quais os
 * URLs que mudaram, em vez de esperar que eles descubram. É suportado pelo
 * Bing, pelo Yandex, pelo Seznam e pelo Naver. **Não pelo Google** — o Google
 * anunciou testes e nunca o adoptou. Quem procura no Google não é afectado
 * por nada disto.
 *
 * A CHAVE É PÚBLICA DE PROPÓSITO. Fica em public/<chave>.txt e é assim que se
 * prova que quem submete controla o domínio: o motor vai lá buscá-la. Não é
 * um segredo, e não há nada a esconder no repositório.
 *
 * PORQUE FILTRA POR DATA: o IndexNow serve para dizer "isto mudou". Submeter
 * as 157 páginas a cada publicação é ruído, e os motores penalizam quem grita
 * sempre — tal como um lastmod que muda todos os dias. O filtro usa o lastmod
 * do sitemap, que desde 29-07-2026 diz a verdade.
 */

const CHAVE = "60f9133c6af411c5fb9ea1b4a744480c";
const SITE = process.env.SITE_URL ?? "https://clyon.pt";
const ENDPOINT = "https://api.indexnow.org/indexnow";

const args = process.argv.slice(2);
const seco = args.includes("--seco");
const tudo = args.includes("--tudo");
const dias = (() => {
  const i = args.indexOf("--dias");
  const n = i >= 0 ? Number(args[i + 1]) : 7;
  return Number.isFinite(n) && n > 0 ? n : 7;
})();

/** URLs do sitemap publicado, com a data que ele declara. */
async function lerSitemap() {
  const res = await fetch(`${SITE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap devolveu ${res.status}`);
  const xml = await res.text();

  const entradas = [];
  const blocos = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const bloco of blocos) {
    const loc = bloco.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmod = bloco.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null;
    entradas.push({ loc, lastmod });
  }
  return entradas;
}

/** Confirma que a chave está publicada antes de submeter. */
async function chavePublicada() {
  try {
    const res = await fetch(`${SITE}/${CHAVE}.txt`);
    if (!res.ok) return false;
    return (await res.text()).trim() === CHAVE;
  } catch {
    return false;
  }
}

const entradas = await lerSitemap();
const corte = Date.now() - dias * 86_400_000;

const alvo = tudo
  ? entradas
  : entradas.filter((e) => {
      if (!e.lastmod) return false;
      const t = new Date(e.lastmod).getTime();
      return Number.isFinite(t) && t >= corte;
    });

console.log(`sitemap: ${entradas.length} URLs`);
console.log(tudo ? "a enviar: todas" : `alterados nos últimos ${dias} dias: ${alvo.length}`);

if (alvo.length === 0) {
  console.log("Nada mudou no período — nada a submeter.");
  process.exit(0);
}

if (seco) {
  for (const e of alvo.slice(0, 20)) console.log(`  ${e.loc}  (${e.lastmod?.slice(0, 10)})`);
  if (alvo.length > 20) console.log(`  … e mais ${alvo.length - 20}`);
  console.log("\n--seco: nada foi enviado.");
  process.exit(0);
}

if (!(await chavePublicada())) {
  console.error(`A chave não está acessível em ${SITE}/${CHAVE}.txt`);
  console.error("Sem ela o IndexNow recusa a submissão. Publica o site primeiro.");
  process.exit(1);
}

// O protocolo aceita até 10 000 URLs por pedido; nunca lá chegamos, mas o
// lote evita um corpo gigante se o site crescer.
const LOTE = 5000;
for (let i = 0; i < alvo.length; i += LOTE) {
  const urlList = alvo.slice(i, i + LOTE).map((e) => e.loc);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(SITE).host,
      key: CHAVE,
      keyLocation: `${SITE}/${CHAVE}.txt`,
      urlList,
    }),
  });

  // 200 = aceite, 202 = aceite e a chave será validada depois
  if (res.status === 200 || res.status === 202) {
    console.log(`${urlList.length} URLs submetidos (HTTP ${res.status}).`);
  } else {
    console.error(`Recusado com HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
}

console.log("\nBing, Yandex, Seznam e Naver ficam avisados. O Google não usa IndexNow.");
