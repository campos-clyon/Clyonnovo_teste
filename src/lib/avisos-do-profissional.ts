/**
 * OS AVISOS DO PROFISSIONAL — O SINO — 13-11-2026 (d13, ordem do CEO aprovada
 * pelo dono).
 *
 * «Pedido novo (…) — #604. Abra para propor.», dez vezes, no
 * topo do Feed, cada um com o seu ✕ — era o que encontrava quem ficava dias
 * sem abrir a app. Um aviso por pedido novo é uma pilha; e uma pilha que se
 * fecha um a um é trabalho, não informação.
 *
 * Agora:
 *  - um pedido novo NÃO é aviso: o cartão dele leva «Novo» até ser aberto, e
 *    no topo do Feed fica no máximo UMA linha («3 pedidos novos desde a
 *    última vez»), que some quando ele a fecha ou sai do Feed;
 *  - o resto («Foi contratado», «confirmado — X € …», «Transferência …
 *    processada») vai para o SINO do cabeçalho, com o número por ler, a lista
 *    do mais recente para o mais antigo (no máximo 30) e «Marcar tudo como
 *    lido»;
 *  - o que ficou lido, e a fotografia das fases para a próxima abertura,
 *    ficam guardados no aparelho (a app num ficheiro, o painel no
 *    localStorage) e apagam-se ao sair da conta.
 *
 * Este ficheiro é puro (sem `process.env`, sem React): a app Pro e o painel
 * importam-no os dois, e por isso dizem as mesmas frases pela mesma regra.
 */

export type AvisoDoProfissional = {
  /** `contratado-12`, `confirmado-12`, `pago-12` — o mesmo acontecimento é sempre o mesmo aviso. */
  id: string;
  texto: string;
  negociacaoId: number;
  /** Quando chegou (ISO). Mostra-se à hora de Lisboa. */
  em: string;
  lido: boolean;
};

/** O que cada leitura precisa de saber de um trabalho — o painel e a app têm os dois. */
export type TrabalhoParaOsAvisos = {
  negociacaoId: number;
  pedidoId: number;
  fase: string;
  recebeSeFechado?: number | null;
};

/** O sino guarda os últimos 30: o que passa disso já não é notícia, é histórico. */
export const LIMITE_DOS_AVISOS = 30;

export const TITULO_DOS_AVISOS = "Avisos";
export const MARCAR_TUDO_COMO_LIDO = "Marcar tudo como lido";
export const SEM_AVISOS = "Sem avisos por agora. Quando for contratado, ou um trabalho for confirmado ou pago, aparece aqui.";

/** «1 pedido novo desde a última vez» / «3 pedidos novos desde a última vez»; nada com zero. */
export function linhaDosPedidosNovos(quantos: number): string | null {
  if (!Number.isFinite(quantos) || quantos <= 0) return null;
  return quantos === 1 ? "1 pedido novo desde a última vez" : `${quantos} pedidos novos desde a última vez`;
}

/** O número do sino: «9+» a partir de dez, como os outros selos. */
export function numeroDoSino(porLer: number): string | null {
  if (porLer <= 0) return null;
  return porLer > 9 ? "9+" : String(porLer);
}

/**
 * O QUE MUDOU DESDE A ÚLTIMA LEITURA.
 *
 * `anterior` é a fase de cada negociação na leitura anterior; sem ela (a
 * primeira vez neste aparelho) não há nada — há passado, e o passado não é
 * notícia. Passar a «à espera da confirmação» foi ele a dar o trabalho por
 * feito: também não é notícia.
 *
 * Devolve os avisos para o sino e, à parte, os pedidos novos (que não são
 * aviso: contam para a linha do Feed e levam «Novo» no cartão).
 */
export function oQueMudou(
  anterior: ReadonlyMap<number, string> | null,
  novos: readonly TrabalhoParaOsAvisos[],
  agora: Date = new Date(),
): { avisos: AvisoDoProfissional[]; pedidosNovos: number[] } {
  const avisos: AvisoDoProfissional[] = [];
  const pedidosNovos: number[] = [];
  if (!anterior) return { avisos, pedidosNovos };
  const em = agora.toISOString();
  for (const pd of novos) {
    const faseAntiga = anterior.get(pd.negociacaoId);
    if (faseAntiga === undefined) {
      pedidosNovos.push(pd.negociacaoId);
      continue;
    }
    if (faseAntiga === pd.fase) continue;
    const base = { negociacaoId: pd.negociacaoId, em, lido: false };
    if (pd.fase === "a_executar") {
      avisos.push({
        ...base,
        id: `contratado-${pd.negociacaoId}`,
        texto: `Foi contratado — pedido #${pd.pedidoId}. A morada e o contacto já estão abertos.`,
      });
    } else if (pd.fase === "confirmado") {
      const liquido = pd.recebeSeFechado;
      avisos.push({
        ...base,
        id: `confirmado-${pd.negociacaoId}`,
        texto:
          `Trabalho #${pd.pedidoId} confirmado` +
          (liquido != null
            ? ` — ${liquido.toFixed(2).replace(".", ",")} € já estão disponíveis na carteira.`
            : " — o valor já está disponível na carteira."),
      });
    } else if (pd.fase === "pago") {
      avisos.push({
        ...base,
        id: `pago-${pd.negociacaoId}`,
        texto: `Transferência do trabalho #${pd.pedidoId} processada.`,
      });
    }
  }
  return { avisos, pedidosNovos };
}

/** A fotografia de cada leitura, para a seguinte: a fase de cada negociação. */
export function fasesDosTrabalhos(lista: readonly TrabalhoParaOsAvisos[]): Map<number, string> {
  return new Map(lista.map((t) => [t.negociacaoId, t.fase]));
}

/**
 * Junta sem repetir — o mesmo acontecimento não vira dois avisos, e um que já
 * estava lido continua lido — com o mais recente primeiro e no máximo 30.
 */
export function juntarAvisos(
  antes: readonly AvisoDoProfissional[],
  chegadas: readonly AvisoDoProfissional[],
  limite: number = LIMITE_DOS_AVISOS,
): AvisoDoProfissional[] {
  const ids = new Set(antes.map((a) => a.id));
  const novos = chegadas.filter((a) => !ids.has(a.id));
  return [...novos, ...antes]
    .sort((a, b) => (Date.parse(b.em) || 0) - (Date.parse(a.em) || 0))
    .slice(0, limite);
}

export function quantosPorLer(avisos: readonly AvisoDoProfissional[]): number {
  return avisos.filter((a) => !a.lido).length;
}

export function marcarTodosComoLidos(avisos: readonly AvisoDoProfissional[]): AvisoDoProfissional[] {
  return avisos.some((a) => !a.lido) ? avisos.map((a) => (a.lido ? a : { ...a, lido: true })) : [...avisos];
}

export function marcarComoLido(avisos: readonly AvisoDoProfissional[], id: string): AvisoDoProfissional[] {
  return avisos.map((a) => (a.id === id && !a.lido ? { ...a, lido: true } : a));
}

// ── Guardar no aparelho ──────────────────────────────────────────────────────

export type AvisosGuardados = {
  /** A fase de cada negociação na última leitura do site. */
  fases: Map<number, string>;
  avisos: AvisoDoProfissional[];
};

const VERSAO = 1;

/** O texto a guardar: só números de pedido, fases e as frases — nada do cliente. */
export function textoDosAvisos(fases: ReadonlyMap<number, string>, avisos: readonly AvisoDoProfissional[]): string {
  return JSON.stringify({
    versao: VERSAO,
    fases: [...fases.entries()],
    avisos: avisos.slice(0, LIMITE_DOS_AVISOS),
  });
}

function avisoValido(a: unknown): a is AvisoDoProfissional {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    typeof x.texto === "string" &&
    typeof x.negociacaoId === "number" &&
    typeof x.em === "string" &&
    typeof x.lido === "boolean"
  );
}

/** Lê o que ficou guardado; um texto estragado ou de outra versão conta como nada. */
export function lerAvisosGuardados(texto: string | null | undefined): AvisosGuardados | null {
  if (!texto) return null;
  try {
    const d = JSON.parse(texto) as { versao?: unknown; fases?: unknown; avisos?: unknown };
    if (d.versao !== VERSAO || !Array.isArray(d.fases) || !Array.isArray(d.avisos)) return null;
    const fases = new Map<number, string>();
    for (const par of d.fases) {
      if (Array.isArray(par) && typeof par[0] === "number" && typeof par[1] === "string") fases.set(par[0], par[1]);
    }
    return { fases, avisos: d.avisos.filter(avisoValido).slice(0, LIMITE_DOS_AVISOS) };
  } catch {
    return null;
  }
}

/**
 * SÓ SE RETOMA O QUE É DESTA CONTA.
 *
 * As negociações são de um profissional só: se a fotografia guardada não tem
 * nenhuma das que o site acabou de devolver, é de outra conta (ou de há tanto
 * tempo que já nada é comparável) — e então não se mostra nada dela, nem se
 * tiram notícias da diferença. Uma fotografia vazia também não serve: com ela,
 * todos os pedidos pareceriam novos.
 */
export function retomarSeForDestaConta(
  guardado: AvisosGuardados | null,
  lista: readonly TrabalhoParaOsAvisos[],
): AvisosGuardados | null {
  if (!guardado || guardado.fases.size === 0) return null;
  return lista.some((t) => guardado.fases.has(t.negociacaoId)) ? guardado : null;
}
