import { anfitriaoDoNossoBlob, urlDeAnexoPermitido } from "./url-externo-seguro";

/**
 * AS FOTOGRAFIAS DA CARRINHA — 04-11-2026 (decisão d17).
 *
 * «Quero que os candidatos a pro enviem imagens dos veículos.» — o dono.
 *
 * O `tipoVeiculo` diz «carrinha média» e mais nada: não distingue a caixa
 * aberta da fechada, nem a carrinha arrumada da que já não fecha a porta de
 * trás. A fotografia diz numa vez o que a palavra nunca disse. A candidatura
 * passa a pedi-las (de 1 a 4), e quem já é parceiro junta-as no perfil, em
 * «A minha carrinha».
 *
 * SÃO SÓ PARA A EQUIPA. Nenhum ecrã do cliente, nem o perfil público, as lê
 * — `fotografias-da-carrinha.test.ts` chumba se uma rota pública passar a
 * fazê-lo.
 *
 * Um só ficheiro para os números e para as frases, e puro (sem base, sem
 * Blob): o formulário, a rota, o painel e os testes lêem daqui, e é por
 * serem um só que não divergem.
 */

/** Quantas, no mínimo, para a candidatura seguir. */
export const MINIMO_DE_FOTOGRAFIAS_DA_CARRINHA = 1;

/**
 * Quantas, no máximo — na candidatura e no perfil.
 *
 * O perfil deixava seis desde 19-09-2026; a ordem d17 fixou quatro para os
 * dois lados. Quem já tinha cinco ou seis não perde nenhuma (ver
 * `guardarFotosDaViatura`): só não acrescenta até ficar abaixo de quatro.
 */
export const MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA = 4;

/** O nome do campo no formulário da candidatura. */
export const ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA = "Fotografias da carrinha";

/** O texto por baixo do campo, à letra da ordem d17. */
export const AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA =
  "Por fora e a caixa de carga, para os clientes saberem o que leva.";

/** O sítio do Blob onde ficam as da candidatura — separado das dos pedidos. */
export const PREFIXO_DAS_FOTOGRAFIAS_DA_CANDIDATURA = "candidaturas/";

/** Sem fotografia nenhuma, a candidatura não segue. */
export const MENSAGEM_SEM_FOTOGRAFIA =
  "Junte pelo menos uma fotografia da carrinha, por fora ou da caixa de carga. Sem ela, a candidatura não segue.";

export const MENSAGEM_FOTOGRAFIAS_A_MAIS = `No máximo ${MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA} fotografias da carrinha. Tire as que estão a mais.`;

/** Um endereço que não veio do nosso envio: tirar e voltar a juntar resolve. */
export const MENSAGEM_FOTOGRAFIA_ESTRANHA =
  "Uma das fotografias não chegou bem. Tire-a e volte a juntá-la.";

/**
 * A app CLYON Pro ainda não tem o campo das fotografias (ordem d17: a app fica
 * para a Engenharia — Apps). Quem se candidata por lá recebia «falta preencher
 * o que está assinalado» sem nada assinalado; esta frase diz-lhe o que fazer.
 */
export const MENSAGEM_SEM_FOTOGRAFIA_NA_APP =
  "Falta a fotografia da carrinha, e nesta versão da app ainda não dá para a juntar. Candidate-se em clyon.pt/quero-ser-parceiro: leva dois minutos.";

const EXTENSOES_DE_IMAGEM = /\.(?:jpe?g|png|webp|heic|heif)$/i;

/**
 * Uma fotografia da candidatura, se for mesmo uma das nossas; senão null.
 *
 * A rota da candidatura é pública e grava o que o browser mandar. Um endereço
 * qualquer — uma imagem de outro servidor (que vê quem a abre e a troca
 * depois), a fotografia de um pedido de outra pessoa, um `javascript:` — ia
 * parar ao backoffice como «a carrinha dele». Só passa o que o nosso envio
 * devolve: https, o NOSSO store quando se sabe qual, a pasta das
 * candidaturas, e uma extensão de imagem.
 *
 * Sem o anfitrião do store (ambiente sem variáveis), aceita qualquer Blob
 * público desde que na pasta das candidaturas: adivinhá-lo mal deitava fora
 * todas as candidaturas.
 */
export function fotografiaDaCandidatura(
  valor: unknown,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (typeof valor === "string" && valor.trim().length > 500) return null;
  const href = urlDeAnexoPermitido(valor);
  if (!href) return null;
  const url = new URL(href);
  const nosso = anfitriaoDoNossoBlob(env);
  if (nosso && url.hostname.toLowerCase() !== nosso) return null;
  if (url.search || url.hash) return null;
  const caminho = decodeURIComponent(url.pathname);
  if (!caminho.startsWith(`/${PREFIXO_DAS_FOTOGRAFIAS_DA_CANDIDATURA}`)) return null;
  if (!EXTENSOES_DE_IMAGEM.test(caminho)) return null;
  return href.length > 500 ? null : href;
}

export type FotografiasLidas =
  | { ok: true; fotos: string[] }
  | { ok: false; mensagem: string; semNenhuma: boolean };

/**
 * As fotografias que vêm no corpo da candidatura, conferidas.
 *
 * Nenhuma → recusa (`semNenhuma`, para a rota escolher a frase). Mais de
 * quatro → recusa. Uma que não seja nossa → recusa: o formulário só manda o
 * que o envio lhe devolveu, por isso isto só acontece a quem mexeu no pedido.
 * Repetidas contam uma vez.
 */
export function lerFotografiasDaCandidatura(
  valor: unknown,
  env: Record<string, string | undefined> = process.env,
): FotografiasLidas {
  const brutas = Array.isArray(valor) ? valor : [];
  if (brutas.length === 0) {
    return { ok: false, mensagem: MENSAGEM_SEM_FOTOGRAFIA, semNenhuma: true };
  }
  const fotos: string[] = [];
  for (const b of brutas) {
    const f = fotografiaDaCandidatura(b, env);
    if (!f) return { ok: false, mensagem: MENSAGEM_FOTOGRAFIA_ESTRANHA, semNenhuma: false };
    if (!fotos.includes(f)) fotos.push(f);
  }
  if (fotos.length > MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA) {
    return { ok: false, mensagem: MENSAGEM_FOTOGRAFIAS_A_MAIS, semNenhuma: false };
  }
  return { ok: true, fotos };
}

/** A coluna `fotografiasDoVeiculoJson`, lida com cuidado: um JSON estragado não cala a candidatura. */
export function fotografiasGuardadas(json: unknown): string[] {
  if (typeof json !== "string" || !json.trim()) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? l.map(String).filter((u) => u.trim() !== "") : [];
  } catch {
    return [];
  }
}
