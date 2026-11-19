/**
 * AS CONTAS ONDE ENTRA UMA TRANSFERÊNCIA — d66 (CEO e dono, 18-11-2026).
 *
 * *«Rastrear cada pagamento — de onde veio e a prova.»* Uma transferência
 * registada à mão diz em que conta entrou. A lista é curta e escreve-se nas
 * Configs (`/api/admin/contas-de-destino`): só um nome e, se quiser, os
 * últimos 4 dígitos. NUNCA o IBAN inteiro — nem no ecrã, nem na base, nem no
 * repositório (é público): um nome com mais de 4 algarismos seguidos, ou com
 * a forma de um IBAN, é recusado.
 *
 * O que fica gravado em cada pagamento é o RÓTULO do momento
 * («Conta CLYON ·· 1234»): mudar ou tirar uma conta da lista não reescreve o
 * que já aconteceu. Puro, sem base.
 */

export type ContaDeDestino = {
  /** Curto e estável, tirado do nome na primeira vez. */
  id: string;
  nome: string;
  /** Os últimos 4 dígitos, ou nulo. */
  ultimos4: string | null;
};

/** A chave em `plataformaConfiguracoes`. */
export const CHAVE_DAS_CONTAS_DE_DESTINO = "contasDeDestino";

export const MAXIMO_DE_CONTAS_DE_DESTINO = 8;
export const TAMANHO_DO_NOME_DA_CONTA = 40;

/**
 * Com que a lista abre, enquanto o administrador não a escreve: só nomes,
 * sem dígitos. Ele junta os últimos 4 nas Configs.
 */
export const CONTAS_DE_DESTINO_DE_ORIGEM: ReadonlyArray<ContaDeDestino> = [
  { id: "conta-clyon", nome: "Conta CLYON", ultimos4: null },
  { id: "conta-pessoal-do-dono", nome: "Conta pessoal do dono", ultimos4: null },
  { id: "empresa-parceira", nome: "Empresa parceira", ultimos4: null },
];

/** «Conta CLYON ·· 1234», ou só o nome. É o que se grava no pagamento. */
export function rotuloDaConta(c: Pick<ContaDeDestino, "nome" | "ultimos4">): string {
  return c.ultimos4 ? `${c.nome} ·· ${c.ultimos4}` : c.nome;
}

/** Parece um IBAN, ou tem mais de 4 algarismos seguidos? Então não entra. */
export function pareceUmNumeroDeConta(texto: string): boolean {
  const semEspacos = texto.replace(/[\s.\-]/g, "");
  if (/[A-Za-z]{2}\d{2}[A-Za-z0-9]{8,}/.test(semEspacos)) return true;
  return /\d{5,}/.test(semEspacos);
}

function idDoNome(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "conta"
  );
}

export type ContasLidas = { ok: true; contas: ContaDeDestino[] } | { ok: false; erro: string };

/**
 * A lista que vem do ecrã das Configs, limpa e conferida. Recusa (com a
 * frase para o ecrã) em vez de corrigir às escondidas.
 */
export function lerContasDeDestino(entrada: unknown): ContasLidas {
  if (!Array.isArray(entrada)) return { ok: false, erro: "Envie a lista das contas." };
  if (entrada.length > MAXIMO_DE_CONTAS_DE_DESTINO) {
    return { ok: false, erro: `No máximo ${MAXIMO_DE_CONTAS_DE_DESTINO} contas.` };
  }
  const contas: ContaDeDestino[] = [];
  const ids = new Set<string>();
  for (const bruto of entrada) {
    const o = (bruto ?? {}) as Record<string, unknown>;
    const nome = String(o.nome ?? "").replace(/\s+/g, " ").trim();
    if (nome.length < 2) return { ok: false, erro: "Cada conta precisa de um nome." };
    if (nome.length > TAMANHO_DO_NOME_DA_CONTA) {
      return { ok: false, erro: `O nome «${nome.slice(0, 20)}…» passa de ${TAMANHO_DO_NOME_DA_CONTA} caracteres.` };
    }
    if (pareceUmNumeroDeConta(nome)) {
      return { ok: false, erro: "O nome não leva o IBAN nem o número da conta — só os últimos 4 dígitos, no campo deles." };
    }
    const u = String(o.ultimos4 ?? "").replace(/\s/g, "");
    if (u && !/^\d{4}$/.test(u)) return { ok: false, erro: "Os últimos dígitos são exatamente 4 algarismos (ou nada)." };
    let id = typeof o.id === "string" && /^[a-z0-9-]{1,30}$/.test(o.id) ? o.id : idDoNome(nome);
    let n = 2;
    const raiz = id;
    while (ids.has(id)) id = `${raiz}-${n++}`;
    ids.add(id);
    contas.push({ id, nome, ultimos4: u || null });
  }
  return { ok: true, contas };
}

/** O que está guardado na base (texto JSON), ou a lista de origem. Nunca lança. */
export function contasGuardadas(texto: unknown): ContaDeDestino[] {
  if (typeof texto !== "string" || !texto.trim()) return [...CONTAS_DE_DESTINO_DE_ORIGEM];
  try {
    const lido = lerContasDeDestino(JSON.parse(texto));
    return lido.ok ? lido.contas : [...CONTAS_DE_DESTINO_DE_ORIGEM];
  } catch {
    return [...CONTAS_DE_DESTINO_DE_ORIGEM];
  }
}

/** O rótulo a gravar para a conta escolhida, ou nulo se não está na lista. */
export function rotuloEscolhido(contas: ReadonlyArray<ContaDeDestino>, id: unknown): string | null {
  const c = contas.find((x) => x.id === id);
  return c ? rotuloDaConta(c).slice(0, 60) : null;
}
