/*
 * «EM MOITA» DENUNCIA TEXTO AUTOMÁTICO — 14-10-2026.
 *
 * As páginas de cidade escreviam «em» antes de qualquer nome: «Recolha de
 * Móveis em Moita», «Mudanças em Barreiro», «em Seixal». Quem é de lá diz na
 * Moita, no Barreiro, no Seixal — e lê o resto da página como escrito por
 * uma máquina. Estas terras levam artigo; as outras ficam com «em» e «de».
 *
 * Uma terra nova com artigo entra aqui. As que não estão levam «em».
 */
const ARTIGO: Record<string, "o" | "a" | "os" | "as"> = {
  Lumiar: "o",
  Olivais: "os",
  Amadora: "a",
  "Costa da Caparica": "a",
  Seixal: "o",
  Barreiro: "o",
  Moita: "a",
  Montijo: "o",
  // As regiões que as páginas de cidade nomeiam («noutras zonas da Margem Sul»).
  "Margem Sul": "a",
  "Grande Lisboa": "a",
};

const EM = { o: "no", a: "na", os: "nos", as: "nas" } as const;
const DE = { o: "do", a: "da", os: "dos", as: "das" } as const;

/** «na Moita», «no Barreiro», «em Lisboa». */
export function emTerra(nome: string): string {
  const artigo = ARTIGO[nome];
  return artigo ? `${EM[artigo]} ${nome}` : `em ${nome}`;
}

/** «da Moita», «do Barreiro», «de Lisboa». */
export function deTerra(nome: string): string {
  const artigo = ARTIGO[nome];
  return artigo ? `${DE[artigo]} ${nome}` : `de ${nome}`;
}

/** Para o começo de uma frase: «Na Moita», «Em Lisboa». */
export function emTerraNoInicio(nome: string): string {
  const texto = emTerra(nome);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
