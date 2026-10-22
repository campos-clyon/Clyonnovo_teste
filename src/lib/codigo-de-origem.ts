import type { OrigemDaVisita } from "@/lib/origem-da-visita";

/*
 * DE ONDE VEIO QUEM ESCREVEU NO WHATSAPP — 22-10-2026.
 *
 * «Só de todos esses exemplos, só uma diz que veio do Google. Vamos tentar
 * colocar uma forma bem subtil de dizer a origem, nem que seja em números»
 * — o dono. Os botões do site abriam o WhatsApp com «Olá! Gostava de pedir
 * um orçamento à CLYON.», igual em todo o lado.
 *
 * Agora a mensagem leva no fim um código curto, «(A1)»: a LETRA diz por onde
 * a pessoa chegou ao site, o NÚMERO diz em que página carregou no WhatsApp.
 * A Vitória tira-o antes de ler (`separarCodigoDeOrigem`), para não o tomar
 * por um andar ou uma quantidade; na conversa guardada fica, para se ver.
 */

export const CANAIS = {
  A: "Anúncio do Google",
  G: "Pesquisa no Google (sem anúncio)",
  F: "Facebook",
  I: "Instagram",
  O: "Outro site",
  D: "Direto (escreveu clyon.pt ou já conhecia)",
} as const;
export type LetraDoCanal = keyof typeof CANAIS;

export const PAGINAS: Record<number, string> = {
  1: "Página do anúncio (orçamento de recolha em Lisboa)",
  2: "Página inicial",
  3: "Simulador",
  4: "Preços",
  5: "Contactos",
  6: "Página de um serviço (móveis, sofás, entulho, mudanças…)",
  7: "Página de uma cidade (ex.: recolha de móveis em Almada)",
  8: "Guias, blog e perguntas",
  9: "Avaliações, como funciona, sobre nós",
  0: "Outra página",
};

/** As pastas do site que são páginas de serviço. O resto de fora destas listas é cidade. */
const SERVICOS = new Set([
  "servicos",
  "recolha-de-armarios",
  "recolha-de-camas",
  "recolha-de-eletrodomesticos",
  "recolha-de-entulho",
  "recolha-de-monos",
  "recolha-de-monos-amadora",
  "recolha-de-moveis",
  "recolha-de-moveis-urgente",
  "recolha-de-sofas",
  "recolha-gratuita-de-moveis-usados",
  "retirar-moveis-velhos",
  "esvaziamento-casas",
  "esvaziamento-de-casas",
  "esvaziamento-de-casas-amadora",
  "limpeza-de-quintais",
  "mudancas",
  "mudancas-de-escritorio",
  "pequenas-mudancas",
  "transporte-de-moveis",
  "empresas",
]);
const GUIAS = new Set(["blog", "faq", "quanto-custa"]);
const SOBRE = new Set(["avaliacoes", "como-funciona", "sobre-nos", "trabalhos", "regioes"]);
/** Pastas que não são de serviço nem de cidade. */
const OUTRAS = new Set([
  "admin", "api", "auth", "conta", "cookies", "en", "entrar", "orcamento", "pedido", "plataforma",
  "privacidade", "profissionais", "quero-ser-parceiro", "termos",
]);

export function numeroDaPagina(caminho: string): number {
  const primeira = caminho.split(/[?#]/)[0].split("/").filter(Boolean)[0] ?? "";
  if (primeira === "") return 2;
  if (primeira === "orcamento-recolha-lisboa") return 1;
  if (primeira === "simulador") return 3;
  if (primeira === "precos") return 4;
  if (primeira === "contactos") return 5;
  if (SERVICOS.has(primeira)) return 6;
  if (GUIAS.has(primeira) || primeira.startsWith("quanto-custa")) return 8;
  if (SOBRE.has(primeira)) return 9;
  if (OUTRAS.has(primeira)) return 0;
  // O que sobra cai no [...slug]: as páginas de serviço por cidade.
  return 7;
}

export function letraDoCanal(origem: OrigemDaVisita | null): LetraDoCanal {
  if (!origem) return "D";
  const fonte = (origem.utm_source ?? "").toLowerCase();
  const meio = (origem.utm_medium ?? "").toLowerCase();
  if (origem.gclid || /^(cpc|ppc|paid|paidsearch|ads?)$/.test(meio)) {
    if (/facebook|fb|meta/.test(fonte)) return "F";
    if (/instagram|ig/.test(fonte)) return "I";
    return "A";
  }
  if (/instagram/.test(fonte) || fonte === "ig") return "I";
  if (/facebook/.test(fonte) || fonte === "fb") return "F";
  if (/google/.test(fonte)) return "G";
  if (fonte) return "O";
  return "D";
}

export function codigoDeOrigem(origem: OrigemDaVisita | null, caminho: string): string {
  return `${letraDoCanal(origem)}${numeroDaPagina(caminho)}`;
}

const CODIGO = /\s*\(([AGFIOD])(\d)\)/;

/** O texto com o código no fim — trocando o que lá estiver, se já houver um. */
export function comCodigoDeOrigem(texto: string, codigo: string): string {
  return `${texto.replace(CODIGO, "").trimEnd()} (${codigo})`;
}

/** Tira o código do texto, para a Vitória ler só o que a pessoa escreveu. */
export function separarCodigoDeOrigem(texto: string): { texto: string; codigo: string | null } {
  const m = texto.match(CODIGO);
  if (!m) return { texto, codigo: null };
  return { texto: texto.replace(CODIGO, "").trim(), codigo: `${m[1]}${m[2]}` };
}

/**
 * A origem de uma conversa: o código da primeira mensagem do cliente que o
 * traga. Sem nenhum, a pessoa escreveu à mão — não veio de um botão do site.
 */
export function origemDaConversa(mensagens: Array<{ direccao: string; texto: string }>): string | null {
  for (const m of mensagens) {
    if (m.direccao !== "in") continue;
    const { codigo } = separarCodigoDeOrigem(m.texto);
    if (codigo) return codigo;
  }
  return null;
}

/** «A1» → «Anúncio do Google · Página do anúncio (…)». */
export function lerCodigoDeOrigem(codigo: string): string | null {
  const m = codigo.match(/^([AGFIOD])(\d)$/);
  if (!m) return null;
  return `${CANAIS[m[1] as LetraDoCanal]} · ${PAGINAS[Number(m[2])]}`;
}
