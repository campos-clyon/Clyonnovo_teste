import * as bcrypt from "bcryptjs";

import { ensureColaboradoresSchema, withConnection } from "@/lib/db";

/**
 * As contas de assistente, na tabela `colaboradores`.
 *
 * A tabela já tinha `funcao = 'assistente'` de uma vida anterior — assistentes
 * que aceitavam pedidos do simulador e viam só os seus. Essa vida acabou; a
 * coluna ficou. Reaproveita-se: um assistente é um colaborador com
 * `funcao = 'assistente'`, `isAdmin = 0` e `active = 1`. Desactivar é pôr
 * `active = 0` — não se apagam registos de pessoas que trabalharam connosco,
 * e um `active = 0` fecha a porta com a mesma eficácia.
 *
 * O login recusa quem não estiver activo, e o helper das rotas volta a
 * perguntar à base em cada chamada: um token de 8 horas não sobrevive a um
 * "desactivar" nem um minuto.
 */

export type Assistente = {
  id: number;
  nome: string;
  activo: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type LinhaDeAssistente = {
  id: number;
  nome: string;
  active: number | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

/**
 * Nome de utilizador: maiúsculas, sem espaços, 3 a 40 caracteres.
 *
 * O login já normaliza para maiúsculas e a coluna é única — dois nomes que
 * diferem só na caixa seriam um só aos olhos da entrada. Sem espaços porque é
 * um nome que se dita ao telefone e se escreve num campo pequeno.
 */
export function normalizarNomeDeAssistente(bruto: unknown): string {
  return typeof bruto === "string" ? bruto.trim().toUpperCase() : "";
}

export function erroDoNomeDeAssistente(nome: string): string | null {
  if (!/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(nome)) {
    return "Nome: 3 a 40 caracteres, letras, números, ponto, hífen ou sublinhado, sem espaços.";
  }
  return null;
}

/** As mesmas regras da palavra-passe do administrador. */
export function erroDaPalavraPasseDeAssistente(senha: unknown): string | null {
  if (typeof senha !== "string" || senha.length < 8) {
    return "A palavra-passe deve ter pelo menos 8 caracteres.";
  }
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    return "A palavra-passe deve incluir pelo menos uma letra e um número.";
  }
  return null;
}

export async function hashDaPalavraPasseDeAssistente(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

function paraIso(v: Date | string | null): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export async function listarAssistentes(): Promise<Assistente[]> {
  await ensureColaboradoresSchema();
  return withConnection(async (conn) => {
    const [linhas] = (await conn.execute(
      `SELECT id, nome, active, createdAt, updatedAt
         FROM colaboradores
        WHERE funcao = 'assistente' AND isAdmin = 0
        ORDER BY active DESC, nome ASC`,
    )) as [LinhaDeAssistente[], unknown];
    return linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      activo: Number(l.active ?? 0) === 1,
      createdAt: paraIso(l.createdAt),
      updatedAt: paraIso(l.updatedAt),
    }));
  });
}

/** Existe já um colaborador com este nome — de QUALQUER função? */
export async function existeColaboradorComNome(nome: string): Promise<boolean> {
  return withConnection(async (conn) => {
    const [linhas] = (await conn.execute(
      "SELECT id FROM colaboradores WHERE nome = ? LIMIT 1",
      [nome],
    )) as [Array<{ id: number }>, unknown];
    return linhas.length > 0;
  });
}

export async function criarAssistente(dados: { nome: string; senhaHash: string }): Promise<number> {
  await ensureColaboradoresSchema();
  return withConnection(async (conn) => {
    // valorHora e paymentModel: colunas herdadas da folha de pagamentos dos
    // motoristas. Um assistente não é pago por aqui — ficam a zero e "none".
    const [r] = (await conn.execute(
      `INSERT INTO colaboradores
         (nome, senha, funcao, isAdmin, valorHora, paymentModel,
          canReceiveSimulatorRequests, participatesInTimeTracking, active)
       VALUES (?, ?, 'assistente', 0, '0.00', 'none', 0, 0, 1)`,
      [dados.nome, dados.senhaHash],
    )) as [{ insertId?: number }, unknown];
    return Number(r.insertId ?? 0);
  });
}

/** Só toca em assistentes: um id de administrador aqui não muda nada. */
export async function definirEstadoDoAssistente(id: number, activo: boolean): Promise<boolean> {
  return withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `UPDATE colaboradores SET active = ?, updatedAt = NOW()
        WHERE id = ? AND funcao = 'assistente' AND isAdmin = 0`,
      [activo ? 1 : 0, id],
    )) as [{ affectedRows?: number }, unknown];
    return Number(r.affectedRows ?? 0) > 0;
  });
}

export async function definirPalavraPasseDoAssistente(id: number, senhaHash: string): Promise<boolean> {
  return withConnection(async (conn) => {
    const [r] = (await conn.execute(
      `UPDATE colaboradores SET senha = ?, updatedAt = NOW()
        WHERE id = ? AND funcao = 'assistente' AND isAdmin = 0`,
      [senhaHash, id],
    )) as [{ affectedRows?: number }, unknown];
    return Number(r.affectedRows ?? 0) > 0;
  });
}
