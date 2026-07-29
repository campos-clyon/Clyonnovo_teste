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
  ],
  mudancasCidade: [
    "src/lib/mudancas-cidades.ts",
    "src/app/mudancas/[cidade]/page.tsx",
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
    "src/app/mudancas/page.tsx",
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
