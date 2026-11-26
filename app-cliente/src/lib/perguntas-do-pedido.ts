import { texto } from "./catalogo";

/**
 * AS PERGUNTAS DE CADA CATEGORIA, NA APP — 03-11-2026 (decisão d1, aprovada
 * pelo dono: «cada categoria tem o seu simulador, todo preparado para ela»).
 *
 * A R7 (`GET /api/cliente/catalogo`) manda em cada serviço `perguntas`: a
 * lista DESSA categoria, pela ordem, com o id do campo, o título, o tipo, as
 * opções, quando aparece e em que ecrã (`src/lib/simulador-por-categoria.ts`).
 * A app desenha os ecrãs «oque» e «acesso» por cima dela: a desmontagem só
 * onde a R7 a põe, o entulho em três perguntas (como está → que sacos → quantos).
 *
 * O filtro de sempre (sem big bags, sem contentores, sem «hoje») vale para
 * tudo, com UMA excepção: a opção «bigbag» de «Que sacos são?» — é só a medida
 * do que o cliente já tem (a CLYON não fornece nem aluga big bags nem
 * contentores), e o texto dela di-lo.
 *
 * Puro: sem React, para os testes do site o importarem.
 */

export type TipoDaPergunta = "escolha" | "numero" | "texto";
export type OpcaoDaPergunta = { id: string; nome: string; ajuda?: string };

export type PerguntaDaApp = {
  id: string;
  titulo: string;
  tipo: TipoDaPergunta;
  obrigatoria: boolean;
  ecra: "oque" | "acesso";
  opcoes: OpcaoDaPergunta[];
  varias: boolean;
  quando: Record<string, string[]> | null;
  ajuda: string | null;
  unidade: string | null;
  unidadePor: { campo: string; unidades: Record<string, string> } | null;
  minimo: number | null;
  maximo: number | null;
};

/** O que nunca se oferece, venha de onde vier (regra 4). */
export const PROIBIDO_NAS_PERGUNTAS = /big[\s_-]?bag|contentor|\bhoje\b|today|pr[óo]prio dia/i;
/** Na opção «bigbag» de «Que sacos são?» só o «hoje» e o «próprio dia» ficam de fora. */
const PROIBIDO_NO_BIGBAG = /\bhoje\b|today|pr[óo]prio dia/i;

/** A excepção ao filtro: só esta opção desta pergunta. */
export const eOBigBagDosSacos = (pergunta: string, opcao: string) => pergunta === "tipoDeSaco" && opcao === "bigbag";

const numeroOuNulo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function opcoesDaPergunta(id: string, v: unknown): OpcaoDaPergunta[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((o): OpcaoDaPergunta | null => {
      const r = (o ?? {}) as Record<string, unknown>;
      const oid = texto(r.id);
      const nome = texto(r.nome);
      if (!oid || !nome) return null;
      const ajuda = texto(r.ajuda);
      return { id: oid, nome, ...(ajuda ? { ajuda } : {}) };
    })
    .filter((o): o is OpcaoDaPergunta => {
      if (!o) return false;
      const tudo = `${o.id} ${o.nome} ${o.ajuda ?? ""}`;
      return eOBigBagDosSacos(id, o.id) ? !PROIBIDO_NO_BIGBAG.test(tudo) : !PROIBIDO_NAS_PERGUNTAS.test(tudo);
    });
}

function quandoDaPergunta(v: unknown): Record<string, string[]> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string[]> = {};
  for (const [campo, aceites] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(aceites)) continue;
    out[campo] = aceites.filter((x): x is string => typeof x === "string");
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** O id de uma pergunta: começa por uma letra; depois letras, algarismos, «_» e «.»; até 40. */
export const ID_DA_PERGUNTA = /^[A-Za-z][A-Za-z0-9_.]{0,39}$/;

/** As perguntas da R7 de um serviço, com a forma certa — `null` sem elas (R7 antiga: o pedido de sempre). */
export function perguntasValidas(v: unknown): PerguntaDaApp[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const l = v
    .map((p): PerguntaDaApp | null => {
      const r = (p ?? {}) as Record<string, unknown>;
      const id = texto(r.id);
      const titulo = texto(r.titulo);
      const tipo = r.tipo === "escolha" || r.tipo === "numero" || r.tipo === "texto" ? r.tipo : null;
      const ecra = r.ecra === "oque" || r.ecra === "acesso" ? r.ecra : null;
      // Letras, algarismos, «_» e «.» (as peças da montagem, d132: `pecasDaMontagem.roupeiro_3`).
      if (!id || !ID_DA_PERGUNTA.test(id) || !titulo || !tipo || !ecra) return null;
      if (PROIBIDO_NAS_PERGUNTAS.test(titulo)) return null;
      const opcoes = opcoesDaPergunta(id, r.opcoes);
      if (tipo === "escolha" && opcoes.length === 0) return null;
      const ajuda = texto(r.ajuda);
      const up = (r.unidadePor ?? null) as { campo?: unknown; unidades?: unknown } | null;
      const unidades =
        up && typeof up.unidades === "object" && up.unidades
          ? Object.fromEntries(Object.entries(up.unidades as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"))
          : null;
      return {
        id,
        titulo,
        tipo,
        obrigatoria: r.obrigatoria === true,
        ecra,
        opcoes,
        varias: r.varias === true,
        quando: quandoDaPergunta(r.quando),
        ajuda: ajuda && !PROIBIDO_NAS_PERGUNTAS.test(ajuda) ? ajuda : null,
        unidade: texto(r.unidade),
        unidadePor: up && typeof up.campo === "string" && unidades ? { campo: up.campo, unidades } : null,
        minimo: numeroOuNulo(r.minimo),
        maximo: numeroOuNulo(r.maximo),
      };
    })
    .filter((p): p is PerguntaDaApp => !!p);
  return l.length > 0 ? l : null;
}

/** As respostas, pelos ids das perguntas: a escolha (o id), o número (em algarismos), o texto, ou várias. */
export type ValorDaResposta = string | string[];
export type Respostas = Readonly<Record<string, ValorDaResposta | undefined>>;

/** A pergunta aparece com estas respostas? (as condições de `quando`, todas — como `perguntaAparece` no site) */
export function perguntaAparece(p: Pick<PerguntaDaApp, "quando">, respostas: Respostas): boolean {
  if (!p.quando) return true;
  return Object.entries(p.quando).every(([campo, aceites]) => {
    const v = respostas[campo];
    return typeof v === "string" && aceites.includes(v);
  });
}

/** A unidade que se escreve ao lado do número («sacos» ou «big bags», pela resposta de «Que sacos são?»). */
export function unidadeDaPergunta(p: PerguntaDaApp, respostas: Respostas): string | null {
  if (p.unidadePor) {
    const v = respostas[p.unidadePor.campo];
    if (typeof v === "string" && p.unidadePor.unidades[v]) return p.unidadePor.unidades[v];
  }
  return p.unidade;
}

/** O número de uma resposta (em algarismos), ou `null`. */
export function numeroDaResposta(v: ValorDaResposta | undefined): number | null {
  if (typeof v !== "string" || !/^\d{1,5}$/.test(v)) return null;
  return Number(v);
}

/** A resposta já serve? (a escolha é uma das opções; o número fica entre o mínimo e o máximo; o texto não vem vazio) */
export function respostaServe(p: PerguntaDaApp, v: ValorDaResposta | undefined): boolean {
  if (v == null) return false;
  if (p.tipo === "escolha") {
    if (p.varias) return Array.isArray(v) && v.length > 0 && v.every((x) => p.opcoes.some((o) => o.id === x));
    return typeof v === "string" && p.opcoes.some((o) => o.id === v);
  }
  if (p.tipo === "numero") {
    const n = numeroDaResposta(v);
    if (n == null) return false;
    return n >= (p.minimo ?? 0) && (p.maximo == null || n <= p.maximo);
  }
  return typeof v === "string" && v.trim().length > 0;
}

/** O texto de uma resposta, para o resumo: o nome da opção, ou «20 sacos». */
export function respostaEscrita(p: PerguntaDaApp, respostas: Respostas): string | null {
  const v = respostas[p.id];
  if (!respostaServe(p, v)) return null;
  if (p.tipo === "escolha") {
    const ids = Array.isArray(v) ? v : [v as string];
    return ids.map((id) => p.opcoes.find((o) => o.id === id)?.nome ?? id).join(", ");
  }
  if (p.tipo === "numero") {
    const n = numeroDaResposta(v) as number;
    const u = unidadeDaPergunta(p, respostas);
    return u ? `${n} ${u}` : String(n);
  }
  return (v as string).trim();
}

/*
 * AS PEÇAS DA MONTAGEM — d132, 26-11-2026 (a montagem e desmontagem de móveis
 * volta). A R7 manda uma pergunta de número por linha da tabela da montagem:
 * `pecasDaMontagem.<peça>` no serviço «Montagem e desmontagem de móveis», e
 * `desmontarPecas.<peça>` nas recolhas («Desmontar antes de levar») e na
 * mudança («Desmontar e montar no destino»), com o rótulo do extra no título
 * da primeira («Desmontar antes de levar — Peça pequena»). A app desenha cada
 * grupo como os itens dos móveis — contadores, um por peça — e manda cada um
 * ao site como um objecto `{ pequena: 2, roupeiro_3: 1 }`. Os preços vêm
 * escritos na ajuda de cada pergunta (a R7); a app não tem números.
 */

/** Os grupos de peças, pelo prefixo do id (o nome do campo do pedido). */
export const GRUPOS_DE_PECAS = ["pecasDaMontagem", "desmontarPecas"] as const;
export type GrupoDePecas = (typeof GRUPOS_DE_PECAS)[number];

/** O grupo de peças de uma pergunta, ou `null`. */
export function grupoDePecas(id: string): GrupoDePecas | null {
  return GRUPOS_DE_PECAS.find((g) => id.startsWith(`${g}.`)) ?? null;
}

const SEPARADOR_DO_ROTULO = " — ";

/** «Desmontar antes de levar — Peça pequena» → «Peça pequena». */
export function nomeDaPeca(titulo: string): string {
  const i = titulo.indexOf(SEPARADOR_DO_ROTULO);
  return i >= 0 ? titulo.slice(i + SEPARADOR_DO_ROTULO.length) : titulo;
}

/** O rótulo do extra, tirado do título da primeira peça («Desmontar antes de levar»), ou `null`. */
export function rotuloDoGrupoDePecas(grupo: GrupoDePecas, perguntas: readonly Pick<PerguntaDaApp, "id" | "titulo">[]): string | null {
  const primeira = perguntas.find((p) => grupoDePecas(p.id) === grupo);
  if (!primeira) return null;
  const i = primeira.titulo.indexOf(SEPARADOR_DO_ROTULO);
  return i > 0 ? primeira.titulo.slice(0, i) : null;
}

/** O título por cima dos contadores: o do simulador do site («Quantas peças?»), ou o do extra, opcional. */
export function tituloDoGrupoDePecas(grupo: GrupoDePecas, perguntas: readonly Pick<PerguntaDaApp, "id" | "titulo">[]): string {
  if (grupo === "pecasDaMontagem") return "Quantas peças?";
  const rotulo = rotuloDoGrupoDePecas(grupo, perguntas);
  return rotulo ? `${rotulo} (opcional)` : "Peças a desmontar (opcional)";
}

/** As peças contadas de um grupo, só as de 1 para cima: `{ pequena: 2, roupeiro_3: 1 }`. */
export function pecasDoGrupo(grupo: GrupoDePecas, perguntas: readonly PerguntaDaApp[], respostas: Respostas): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of perguntas) {
    if (grupoDePecas(p.id) !== grupo || !respostaServe(p, respostas[p.id])) continue;
    const n = numeroDaResposta(respostas[p.id]) ?? 0;
    if (n > 0) out[p.id.slice(grupo.length + 1)] = n;
  }
  return out;
}

/** «2 × Peça pequena, 1 × Roupeiro de 3 portas» — como `pecasEmTexto` do site; `null` sem peças. */
export function pecasEmTextoDaApp(grupo: GrupoDePecas, perguntas: readonly PerguntaDaApp[], respostas: Respostas): string | null {
  const partes = perguntas
    .filter((p) => grupoDePecas(p.id) === grupo && respostaServe(p, respostas[p.id]) && (numeroDaResposta(respostas[p.id]) ?? 0) > 0)
    .map((p) => `${numeroDaResposta(respostas[p.id])} × ${nomeDaPeca(p.titulo)}`);
  return partes.length > 0 ? partes.join(", ") : null;
}
