#!/usr/bin/env node
/**
 * O pente fino de SEO: lê o sitemap publicado, visita cada página (e as que
 * elas ligam e o sitemap não tem) e aponta o que está mal em cada uma.
 *
 *   npm run seo:pente                      → escreve pente-fino.json e mostra o resumo
 *   npm run seo:pente -- saida.json
 *   SITE_URL=https://outro npm run seo:pente
 *
 * O QUE VÊ: ligações partidas ou para redirects; títulos, descrições e H1
 * duplicados, em falta ou compridos de mais; canonical; imagens sem alt;
 * JSON-LD inválido; perguntas do FAQPage que não estão à vista na página (o
 * Google exige que estejam); páginas sem og:image; páginas finas; terras com
 * a preposição seca («em Barreiro»); páginas do sitemap com menos de três
 * ligações a chegar; títulos de secção em minúscula; e a semelhança média
 * entre as páginas do mesmo modelo (as de cidade).
 *
 * DE ONDE VEIO: o pente fino de 15-10-2026, que encontrou 54 páginas com
 * preposições erradas, 16 quase sem ligações e as perguntas das páginas de
 * região só no JSON-LD. Corre contra o site publicado, não contra o código —
 * é o que o Google vê.
 */
import { writeFileSync } from "node:fs";

const BASE = process.env.SITE_URL ?? "https://clyon.pt";
const UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const LIMITE_DE_PAGINAS = 400;

const um = (re, h) => {
  const m = h.match(re);
  return m ? m[1] : null;
};
const ent = (s) =>
  s == null
    ? s
    : s
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;|&#160;/g, " ");
function textoDe(html) {
  return ent(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}
function principal(html) {
  return (html.match(/<main[\s\S]*<\/main>/i) || [html])[0];
}
function shingles(t, n = 5) {
  const p = t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const s = new Set();
  for (let i = 0; i + n <= p.length; i++) s.add(p.slice(i, i + n).join(" "));
  return s;
}
/** Os FAQPage de um bloco de JSON-LD, onde quer que estejam. */
function faqsDe(no) {
  const fora = [];
  const visitar = (x) => {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(visitar);
    if (x["@type"] === "FAQPage") fora.push(x);
    for (const v of Object.values(x)) visitar(v);
  };
  visitar(no);
  return fora;
}

// As terras que levam artigo: «no Barreiro», «na Moita», «da Amadora».
const COM_ARTIGO = ["Barreiro", "Moita", "Seixal", "Montijo", "Amadora", "Lumiar", "Olivais", "Costa da Caparica", "Margem Sul", "Grande Lisboa"];
const PREP_ERRADA = new RegExp(`\\b(em|de|para) (${COM_ARTIGO.join("|")})\\b`, "g");
// Nomes oficiais que se escrevem assim.
const OFICIAIS = ["União de Freguesias de Montijo"];
// Áreas privadas: não se seguem.
const PRIVADAS = /^\/(api|_next|admin|conta|pedido|orcamento\/|profissionais\/(painel|pedidos|definir-senha|inscricao)|entrar|auth|plataforma)/;

const sm = await (await fetch(BASE + "/sitemap.xml", { headers: { "user-agent": UA } })).text();
const doSitemap = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(BASE, "") || "/");
const fila = [...doSitemap];
const vistos = new Set(fila);
const paginas = {};
const ligacoes = []; // [de, para]

async function ler(caminho) {
  let res;
  try {
    res = await fetch(BASE + caminho, { redirect: "manual", headers: { "user-agent": UA } });
  } catch (e) {
    return { caminho, erro: String(e) };
  }
  const estado = res.status;
  if (estado >= 300 && estado < 400) return { caminho, estado, destino: res.headers.get("location") };
  const html = await res.text();
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [""])[0];
  const main = principal(html);
  const textoPrincipal = textoDe(main);
  const textoTodo = textoDe(html).toLowerCase();
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const blocos = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return "INVALIDO";
    }
  });
  const faqEscondida = [];
  for (const b of blocos) {
    if (b === "INVALIDO") continue;
    for (const f of faqsDe(b))
      for (const q of f.mainEntity || []) {
        const pergunta = ent(q.name || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (pergunta && !textoTodo.includes(pergunta)) faqEscondida.push(q.name);
      }
  }
  const todasInternas = [...new Set([...html.matchAll(/<a[^>]+href="(\/[^"#?]*)[^"]*"/gi)].map((m) => m[1] || "/"))];
  for (const l of todasInternas) ligacoes.push([caminho, l]);
  let paraPreposicoes = textoPrincipal;
  for (const oficial of OFICIAIS) paraPreposicoes = paraPreposicoes.split(oficial).join("");
  return {
    caminho,
    estado,
    titulo: ent(um(/<title[^>]*>([\s\S]*?)<\/title>/i, head)),
    descricao: ent(um(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i, head)),
    canonical: um(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i, head),
    robots: um(/<meta[^>]+name="robots"[^>]+content="([^"]*)"/i, head),
    ogImagem: um(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i, head),
    h1: [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => textoDe(m[1])),
    h2: [...main.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => textoDe(m[1])).slice(0, 40),
    semAlt: imgs.filter((i) => !/\balt="[^"]+"/i.test(i)).map((i) => um(/src="([^"]+)"/, i) || i.slice(0, 80)),
    ldInvalido: blocos.includes("INVALIDO"),
    faqEscondida,
    palavras: textoPrincipal.split(" ").filter((w) => /[a-zà-ÿ]/i.test(w)).length,
    preposicoes: [...new Set(paraPreposicoes.match(PREP_ERRADA) || [])],
    noSitemap: doSitemap.includes(caminho),
    texto: textoPrincipal.slice(0, 20000),
  };
}

async function trabalhador() {
  while (fila.length) {
    const c = fila.shift();
    paginas[c] = await ler(c);
    // Descobre as páginas ligadas que o sitemap não tem.
    for (const [de, para] of ligacoes.filter(([d]) => d === c)) {
      if (!vistos.has(para) && !PRIVADAS.test(para) && vistos.size < LIMITE_DE_PAGINAS) {
        vistos.add(para);
        fila.push(para);
      }
    }
  }
}
await Promise.all(Array.from({ length: 6 }, trabalhador));

const lista = Object.values(paginas);
const ok = lista.filter((p) => p.estado === 200);
const indexaveis = ok.filter((p) => !(p.robots || "").includes("noindex"));
const dup = (campo) => {
  const m = {};
  for (const p of ok) {
    const v = Array.isArray(p[campo]) ? p[campo][0] : p[campo];
    if (v) (m[v] = m[v] || []).push(p.caminho);
  }
  return Object.entries(m).filter(([, cs]) => cs.length > 1);
};
const destinos = Object.fromEntries(lista.filter((p) => p.estado >= 300 && p.estado < 400).map((p) => [p.caminho, p.destino]));
const quebrados = new Set(lista.filter((p) => p.estado >= 400 || p.erro).map((p) => p.caminho));
const entrada = {};
for (const [de, para] of ligacoes) if (de !== para) (entrada[para] = entrada[para] || new Set()).add(de);
const semBarra = (u) => u.replace(BASE, "").replace(/\/$/, "");

const relatorio = {
  totais: { paginas: lista.length, ok: ok.length, redirects: Object.keys(destinos).length, erros: quebrados.size },
  erros: [...quebrados],
  ligacoesParaRedirect: [...new Set(ligacoes.filter(([, p]) => destinos[p]).map(([d, p]) => `${p} ← ${d}`))].slice(0, 200),
  ligacoesParaQuebrado: [...new Set(ligacoes.filter(([, p]) => quebrados.has(p)).map(([d, p]) => `${p} ← ${d}`))],
  foraDoSitemapMasIndexaveis: indexaveis.filter((p) => !p.noSitemap).map((p) => p.caminho),
  noindexNoSitemap: ok.filter((p) => p.noSitemap && (p.robots || "").includes("noindex")).map((p) => p.caminho),
  titulosDuplicados: dup("titulo"),
  descricoesDuplicadas: dup("descricao"),
  h1Duplicados: dup("h1"),
  semTitulo: ok.filter((p) => !p.titulo).map((p) => p.caminho),
  tituloLongo: ok.filter((p) => p.titulo && p.titulo.length > 60).map((p) => `${p.titulo.length} ${p.caminho}`),
  semDescricao: ok.filter((p) => !p.descricao).map((p) => p.caminho),
  descricaoLonga: ok.filter((p) => p.descricao && p.descricao.length > 160).map((p) => `${p.descricao.length} ${p.caminho}`),
  descricaoCurta: indexaveis.filter((p) => p.descricao && p.descricao.length < 70).map((p) => `${p.descricao.length} ${p.caminho}`),
  h1Contagem: ok.filter((p) => p.h1.length !== 1).map((p) => `${p.h1.length} ${p.caminho}`),
  canonicalDiferente: indexaveis
    .filter((p) => p.canonical && semBarra(p.canonical) !== semBarra(p.caminho))
    .map((p) => `${p.caminho} → ${p.canonical}`),
  semCanonical: indexaveis.filter((p) => !p.canonical).map((p) => p.caminho),
  semImagemDePartilha: indexaveis.filter((p) => !p.ogImagem).map((p) => p.caminho),
  imagensSemAlt: ok.filter((p) => p.semAlt.length).map((p) => `${p.caminho}: ${p.semAlt.slice(0, 3).join(", ")}`),
  jsonLdInvalido: ok.filter((p) => p.ldInvalido).map((p) => p.caminho),
  faqQueNaoSeVe: ok.filter((p) => p.faqEscondida.length).map((p) => `${p.caminho}: ${p.faqEscondida.slice(0, 2).join(" · ")}`),
  poucasPalavras: indexaveis.filter((p) => p.palavras < 300).map((p) => `${p.palavras} ${p.caminho}`),
  preposicoesErradas: ok.filter((p) => p.preposicoes.length).map((p) => `${p.caminho}: ${p.preposicoes.join(" · ")}`),
  poucasLigacoesDeEntrada: ok.filter((p) => p.noSitemap && (entrada[p.caminho]?.size ?? 0) < 3).map((p) => `${entrada[p.caminho]?.size ?? 0} ${p.caminho}`),
  h2Minusculo: ok.flatMap((p) => p.h2.filter((h) => /^[a-zà-ÿ]/.test(h)).map((h) => `${p.caminho}: ${h}`)),
};

// Semelhança entre as páginas do mesmo modelo (as de cidade).
const CIDADE = /-(lisboa|benfica|lumiar|alvalade|olivais|sintra|cascais|oeiras|amadora|loures|odivelas|carnaxide|monte-abraao|queluz|almada|costa-da-caparica|seixal|amora|corroios|barreiro|moita|montijo|alcochete|setubal|palmela|sesimbra)$/;
const grupos = {};
for (const p of ok) {
  const chave = p.caminho.replace(CIDADE, "-*").replace(/^\/mudancas\/[a-z-]+$/, "/mudancas/*");
  if (chave !== p.caminho) (grupos[chave] = grupos[chave] || []).push(p);
}
relatorio.semelhanca = {};
for (const [chave, ps] of Object.entries(grupos)) {
  if (ps.length < 2) continue;
  const sh = ps.map((p) => shingles(p.texto));
  let soma = 0;
  let n = 0;
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      let c = 0;
      for (const x of sh[i]) if (sh[j].has(x)) c++;
      soma += c / (sh[i].size + sh[j].size - c || 1);
      n++;
    }
  relatorio.semelhanca[chave] = {
    paginas: ps.length,
    jaccardMedio: `${Math.round((soma / n) * 100)}%`,
    palavrasMedias: Math.round(ps.reduce((a, p) => a + p.palavras, 0) / ps.length),
  };
}

const saida = process.argv[2] || "pente-fino.json";
writeFileSync(saida, JSON.stringify({ relatorio, paginas }, null, 1));
console.log(JSON.stringify(relatorio.totais));
for (const [k, v] of Object.entries(relatorio)) {
  if (k === "totais" || k === "semelhanca") continue;
  const n = Array.isArray(v) ? v.length : Object.keys(v).length;
  console.log(`${n ? "✗" : "✓"} ${k}: ${n}${n ? `  ${(Array.isArray(v) ? v : Object.keys(v)).slice(0, 3).join(" | ")}` : ""}`);
}
console.log("semelhança:", JSON.stringify(relatorio.semelhanca));
console.log(`\nRelatório completo em ${saida}.`);
