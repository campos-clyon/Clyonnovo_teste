/**
 * O QUE SE VÊ, SEM FALAR DA IMAGEM — 27-11-2026 (d141, pedida e aprovada pelo
 * dono).
 *
 * A descrição arrumada dizia «na imagem 1, um frigorífico…», «a fotografia
 * mostra…». O profissional lê o que há para levar ou fazer, não a ordem das
 * fotografias: «1 frigorífico vertical com porta de vidro; prateleiras com
 * caixas de cartão». Isto tira a muleta, onde quer que venha na frase, e
 * devolve a frase com a primeira letra como estava. Puro.
 */

const NUM = String.raw`\d+`;
const OBJ = String.raw`(?:imagem|imagens|fotografias?|fotos?)`;
const QUAL = String.raw`(?:\s*(?:n\.?\s*[º°]?\s*)?${NUM}(?:\s+(?:e|a)\s+${NUM})*)?`; // «2 e 3», «1 a 3» — sem a vírgula: «na imagem 1, 1 frigorífico»

const MULETAS: RegExp[] = [
  // «Na imagem 1,», «Nas fotografias 2 e 3:», «Nesta foto», «Em ambas as imagens»
  new RegExp(String.raw`\b(?:n[ao]s?|nest[ae]s?|nessas?|em\s+(?:ambas\s+as|todas\s+as|algumas|cada)|pel[ao]s?)\s+(?:primeira\s+|segunda\s+|terceira\s+|[uú]ltima\s+)?${OBJ}${QUAL}\b\s*(?:enviad[ao]s?\s*)?[,:;-]?\s*`, "gi"),
  // «A imagem 2 mostra», «As fotografias mostram», «a foto revela»
  new RegExp(String.raw`\b(?:a|as|esta|estas)\s+${OBJ}${QUAL}\s+(?:mostra[m]?|revela[m]?|apresenta[m]?|exibe[m]?)\s*(?:que\s+)?(?:h[aá]\s+)?`, "gi"),
  // «(imagem 1)», «(fotos 2 e 3)»
  new RegExp(String.raw`\(\s*${OBJ}${QUAL}\s*\)\s*`, "gi"),
  // «Imagem 1:», «Foto 2 -» no começo
  new RegExp(String.raw`^\s*${OBJ}\s*${NUM}\s*[:\-–]\s*`, "gi"),
  // «vê-se», «pode ver-se», «é possível ver», «observa-se», «vejo»
  /\b(?:pode\s+ver-se|v[eê]-se|observa-se|nota-se|[eé]\s+poss[ií]vel\s+ver|consegue-se\s+ver|vejo)\s+(?:que\s+)?/gi,
];

export function semFalarDaImagem(texto: string): string {
  const original = String(texto ?? "");
  let t = original;
  for (const re of MULETAS) t = t.replace(re, " ");
  t = t
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])\s*([,;:.])/g, "$2")
    .replace(/^[\s,;:.\-–]+/, "")
    .trim();
  if (!t) return "";
  // A primeira letra como a frase original a tinha (maiúscula numa frase, minúscula num item).
  const maiuscula = /^\s*\p{Lu}/u.test(original);
  return (maiuscula ? t.charAt(0).toUpperCase() : t.charAt(0).toLowerCase()) + t.slice(1);
}

/** Fala da imagem? — para os testes e para validar a resposta do modelo. */
export function falaDaImagem(texto: string): boolean {
  const t = String(texto ?? "");
  return MULETAS.some((re) => new RegExp(re.source, re.flags.replace("g", "")).test(t));
}
