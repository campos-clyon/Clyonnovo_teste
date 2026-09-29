import { getPool } from "@/lib/db";
import type { PapelDoPainel } from "@/lib/papel-do-painel";

/**
 * A CONTA DO BACKOFFICE, CONFIRMADA NA BASE EM CADA CHAMADA.
 *
 * O token do backoffice vale oito horas (trinta dias com «manter sessão»), e
 * até aqui só o do ASSISTENTE voltava a ser confirmado na base. O do
 * administrador valia até caducar, dissesse a base o que dissesse: uma conta
 * desactivada, despromovida ou apagada continuava a entrar, e mudar a
 * palavra-passe não fechava as sessões abertas — quem tivesse apanhado o
 * token continuava lá dentro.
 *
 * Duas coisas passam a ser confirmadas, com uma consulta pela chave:
 *
 *   · a conta existe, é de administrador pelo MESMO critério do login
 *     (`isAdmin = 1` ou `funcao = 'admin'`, ver /api/colaboradores/login) e
 *     não está desactivada;
 *   · o token não é anterior à última troca de palavra-passe
 *     (`senhaAlteradaEm`, gravada por /api/admin/seguranca/alterar-senha).
 *
 * Isto importa a base de dados: nunca pode chegar ao middleware, que corre no
 * edge. O middleware continua a olhar só para a assinatura; a segunda tranca
 * é esta, nas rotas.
 */

export type ContaDoPainelNaBase = {
  isAdmin: number | null;
  funcao: string | null;
  active: number | null;
  senhaAlteradaEm: Date | string | null;
};

/**
 * Segundos de folga entre a troca e um token emitido logo a seguir.
 *
 * O `senhaAlteradaEm` é um DATETIME, que o MySQL arredonda ao segundo — uma
 * troca às 12:00:00,6 fica gravada às 12:00:01 — e o `iat` do token novo é
 * truncado ao segundo, noutra instância, com outro relógio. Sem folga, quem
 * entrasse no mesmo segundo em que mudou a palavra-passe era posto fora pela
 * própria mudança.
 */
export const FOLGA_DA_TROCA_DE_SENHA_SEGUNDOS = 5;

/** Administrador na base — o mesmo critério do login. */
export function eAdministradorNaBase(conta: Pick<ContaDoPainelNaBase, "isAdmin" | "funcao">): boolean {
  return Number(conta.isAdmin) === 1 || conta.funcao === "admin";
}

/** Só um 0 escrito desactiva. A coluna nasceu com 1 por omissão para todos. */
export function contaActiva(conta: Pick<ContaDoPainelNaBase, "active">): boolean {
  return conta.active == null || Number(conta.active) !== 0;
}

/**
 * Este token foi emitido antes da última troca de palavra-passe?
 *
 * Um token sem `iat` é dos que foram emitidos antes de os tokens o levarem —
 * portanto antes de esta coluna ser escrita pela primeira vez. Se houve troca
 * depois, é anterior a ela.
 */
export function tokenAnteriorATrocaDeSenha(
  senhaAlteradaEm: Date | string | null | undefined,
  iat: number | undefined,
): boolean {
  if (!senhaAlteradaEm) return false;
  const mudou = new Date(senhaAlteradaEm).getTime();
  if (!Number.isFinite(mudou)) return false;
  if (typeof iat !== "number" || !Number.isFinite(iat)) return true;
  return iat * 1000 < mudou - FOLGA_DA_TROCA_DE_SENHA_SEGUNDOS * 1000;
}

/**
 * Porque é que esta sessão já não vale — ou null, se vale.
 *
 * Para o assistente só se olha para a existência e para a troca de
 * palavra-passe: o resto (activo, secções) já é decidido por `assistentePorId`
 * em `requireAdmin`, e duas regras para a mesma coisa acabavam por divergir.
 */
export function motivoParaRecusarSessao(
  conta: ContaDoPainelNaBase | undefined,
  papel: PapelDoPainel,
  iat: number | undefined,
): string | null {
  if (!conta) return "Esta conta já não existe.";
  if (papel === "admin") {
    if (!eAdministradorNaBase(conta)) return "Esta conta já não é de administrador.";
    if (!contaActiva(conta)) return "Esta conta foi desactivada.";
  }
  if (tokenAnteriorATrocaDeSenha(conta.senhaAlteradaEm, iat)) {
    return "A palavra-passe foi alterada. Inicie sessão novamente.";
  }
  return null;
}

/*
 * A COLUNA, GARANTIDA UMA VEZ POR INSTÂNCIA.
 *
 * Está também na lista do `ensureColaboradoresSchema`, com as outras. Mas
 * esse corre um ALTER ... MODIFY e dezenas de consultas ao information_schema
 * de cada vez que é chamado — é para o arranque, não para cada pedido. Aqui
 * pergunta-se só por esta coluna, e só na primeira chamada.
 *
 * Se a pergunta falhar, esta chamada segue sem a troca de palavra-passe (e a
 * seguinte volta a tentar): recusar tudo por não se saber se uma coluna
 * existe era fechar o backoffice por um soluço da base.
 */
let colunaDaTroca: Promise<boolean> | null = null;

export function garantirColunaDaTrocaDeSenha(): Promise<boolean> {
  if (!colunaDaTroca) {
    colunaDaTroca = (async () => {
      const pool = await getPool();
      if (!pool) return false;
      const [linhas] = (await pool.execute(
        `SELECT COUNT(*) AS n FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'colaboradores'
            AND column_name = 'senhaAlteradaEm'`,
      )) as [Array<{ n: number }>, unknown];
      if (Number(linhas[0]?.n ?? 0) > 0) return true;
      await pool.execute(
        "ALTER TABLE colaboradores ADD COLUMN senhaAlteradaEm DATETIME NULL DEFAULT NULL",
      );
      return true;
    })().catch((e) => {
      colunaDaTroca = null;
      console.error("[conta-do-painel] coluna senhaAlteradaEm:", String(e).slice(0, 160));
      return false;
    });
  }
  return colunaDaTroca;
}

/**
 * A conta, pela chave. Undefined se não existir.
 *
 * Pela pool e não por `withConnection`: esta consulta corre em TODAS as
 * chamadas do backoffice, e abrir uma ligação nova (com TLS) de cada vez era
 * pagar o preço de um arranque em cada clique.
 *
 * Lança se a base falhar — quem chama decide o que isso quer dizer.
 */
export async function contaDoPainelPorId(id: number): Promise<ContaDoPainelNaBase | undefined> {
  const pool = await getPool();
  if (!pool) throw new Error("Base de dados indisponível");
  const temColuna = await garantirColunaDaTrocaDeSenha();
  const [linhas] = (await pool.execute(
    `SELECT isAdmin, funcao, active${temColuna ? ", senhaAlteradaEm" : ""}
       FROM colaboradores WHERE id = ? LIMIT 1`,
    [id],
  )) as [Array<Record<string, unknown>>, unknown];
  const l = linhas[0];
  if (!l) return undefined;
  return {
    isAdmin: l.isAdmin == null ? null : Number(l.isAdmin),
    funcao: typeof l.funcao === "string" ? l.funcao : null,
    active: l.active == null ? null : Number(l.active),
    senhaAlteradaEm: temColuna ? ((l.senhaAlteradaEm as Date | string | null) ?? null) : null,
  };
}
