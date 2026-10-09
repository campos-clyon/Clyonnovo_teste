#!/usr/bin/env node
/**
 * Escreve src/lib/conteudo-datas.generated.ts com a data em que o conteúdo de
 * cada grupo de páginas mudou pela última vez, lida do histórico do git.
 *
 *   npm run seo:datas
 *
 * PORQUÊ: o sitemap carimbava `new Date()` em todas as páginas. Cada deploy
 * dizia ao Google que as 157 tinham mudado nesse dia — o que é falso, e o
 * Google aprende depressa a ignorar um `lastmod` que grita sempre. Sem ele,
 * perde-se o único sinal que temos para dizer "esta vale a pena revisitar".
 *
 * PORQUÊ GERADO E COMMITADO, em vez de calculado no build: a Vercel clona o
 * repositório sem histórico completo, e `git log` de um ficheiro daria a data
 * errada — ou nenhuma. Aqui corre-se com o repositório inteiro à mão, o
 * resultado fica no controlo de versões e vê-se no diff. O build não precisa
 * de git nenhum.
 *
 * COMO MANTER: corre-se antes de publicar uma alteração de conteúdo. Se ficar
 * por correr, as datas ficam velhas — o que é honesto e inofensivo. O que não
 * pode acontecer é o contrário: dizer que mudou quando não mudou.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Que ficheiros determinam o conteúdo de cada grupo de páginas.
 * Muda um destes → as páginas desse grupo mudaram de facto.
 */
const GRUPOS = {
  cidadeServico: [
    "src/lib/cidades-local.ts",
    "src/lib/city-content.ts",
    "src/lib/seo-data.ts",
    "src/app/[...slug]/page.tsx",
    // O título, a descrição, o preço e as promessas destas páginas vivem
    // nestes desde Setembro de 2026 — e a 30-09 mudaram sem mexer na data,
    // porque não estavam aqui (07-10-2026).
    "src/lib/titulos-seo.ts",
    "src/lib/descricoes-seo.ts",
    "src/lib/precos-publicos.ts",
    "src/lib/promessas-publicas.ts",
    "src/components/FurnitureSeoLinks.tsx",
    // A recolha do município nas páginas de monos e de entulho (07-10-2026).
    "src/lib/recolha-da-camara.ts",
  ],
  mudancasCidade: [
    "src/lib/mudancas-cidades.ts",
    "src/app/mudancas/[cidade]/page.tsx",
    // Desde 09-10-2026 a página lê também estes: o estacionamento da zona, as
    // promessas das perguntas gerais e os tipos de mudança.
    "src/lib/cidades-local.ts",
    "src/lib/promessas-publicas.ts",
    "src/lib/tipos-de-mudanca.ts",
  ],
  regioes: [
    "src/app/regioes/page.tsx",
    "src/app/regioes/[region]/page.tsx",
  ],
  estaticas: [
    "src/app/page.tsx",
    "src/app/servicos",
    "src/app/precos",
    "src/app/faq",
    "src/app/sobre-nos",
    "src/app/contactos",
    "src/app/avaliacoes",
    "src/app/trabalhos",
    "src/app/simulador",
    "src/app/recolha-de-moveis",
    "src/app/recolha-de-entulho",
    // Entraram no sitemap e faltavam aqui: sem estarem nesta lista, uma
    // correcção nelas não mexia no lastmod, e o Google não tinha razão para
    // voltar a olhar — que é exactamente o problema que isto resolve.
    "src/app/recolha-de-monos",
    "src/app/areas-de-atuacao",
    "src/app/mudancas/page.tsx",
    // Os tipos de mudança (09-10-2026).
    "src/app/transporte-de-moveis",
    "src/app/pequenas-mudancas",
    "src/app/mudancas-de-escritorio",
    "src/components/mudancas/PaginaDeTipoDeMudanca.tsx",
    // As de serviço do sitemap que ainda faltavam (07-10-2026) — várias
    // mudaram a 30-09 e o sitemap continuava a dizer Agosto.
    "src/app/recolha-de-sofas",
    "src/app/recolha-de-camas",
    "src/app/recolha-de-armarios",
    "src/app/recolha-de-eletrodomesticos",
    "src/app/recolha-gratuita-de-moveis-usados",
    "src/app/recolha-de-moveis-urgente",
    "src/app/retirar-moveis-velhos",
    "src/app/esvaziamento-de-casas",
    "src/app/esvaziamento-de-casas-amadora",
    "src/app/recolha-de-monos-amadora",
    "src/app/blog/page.tsx",
    "src/app/termos",
    "src/app/quero-ser-parceiro",
    "src/app/como-funciona",
    "src/app/limpeza-de-quintais",
    "src/app/orcamento-recolha-lisboa",
  ],
};

/** Data do commit mais recente que tocou em algum destes caminhos. */
function ultimaAlteracao(caminhos) {
  let maisRecente = null;
  for (const caminho of caminhos) {
    try {
      const saida = execFileSync(
        "git",
        ["log", "-1", "--format=%cI", "--", caminho],
        { cwd: raiz, encoding: "utf8" },
      ).trim();
      if (!saida) continue;
      if (!maisRecente || saida > maisRecente) maisRecente = saida;
    } catch {
      // Um caminho que ainda não existe no histórico não invalida o grupo
    }
  }
  return maisRecente;
}

const datas = {};
const semHistorico = [];
for (const [grupo, caminhos] of Object.entries(GRUPOS)) {
  const data = ultimaAlteracao(caminhos);
  if (data) datas[grupo] = data;
  else semHistorico.push(grupo);
}

if (semHistorico.length > 0) {
  console.error(`Sem data no git para: ${semHistorico.join(", ")}`);
  console.error("O sitemap vai usar a data do build para esses grupos.");
}

const linhas = Object.entries(datas)
  .map(([k, v]) => `  ${k}: "${v}",`)
  .join("\n");

const conteudo = `// GERADO por scripts/gerar-datas-conteudo.mjs — não editar à mão.
// Correr \`npm run seo:datas\` depois de alterar conteúdo, antes de publicar.
//
// Datas do último commit que tocou nos ficheiros de cada grupo de páginas.
// O sitemap usa-as como lastmod. Um lastmod que muda em todos os deploys
// ensina o Google a ignorá-lo; este só muda quando o conteúdo muda.

export const CONTEUDO_DATAS = {
${linhas}
} as const satisfies Record<string, string>;

export type GrupoConteudo = keyof typeof CONTEUDO_DATAS;

/** Data do grupo como Date, ou a de agora quando o grupo não tem histórico. */
export function dataDoConteudo(grupo: GrupoConteudo): Date {
  const iso = CONTEUDO_DATAS[grupo];
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
`;

const destino = join(raiz, "src", "lib", "conteudo-datas.generated.ts");
writeFileSync(destino, conteudo, "utf8");

for (const [grupo, data] of Object.entries(datas)) {
  console.log(`${grupo.padEnd(16)} ${data.slice(0, 10)}`);
}
console.log(`\nEscrito: src/lib/conteudo-datas.generated.ts`);
