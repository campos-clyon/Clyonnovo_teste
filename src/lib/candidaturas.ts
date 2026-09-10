import { getPool } from "./db";

/**
 * QUEM SE OFERECE PARA TRABALHAR CONNOSCO.
 *
 * O botão "Tornar-me parceiro" da página inicial mandava para o WhatsApp. Quem
 * carregava saía do site, caía numa conversa por escrever, e do outro lado
 * ficava uma mensagem entre dezenas — sem nome, sem zona, sem serviços, e sem
 * ficar registada em lado nenhum. Quem não escrevesse nessa hora, perdia-se.
 *
 * Agora preenche um formulário curto e a candidatura fica AQUI, à espera de
 * aprovação no backoffice. Não cria profissional nenhum: cria um pedido para
 * ser convidado.
 *
 * PORQUE É QUE NÃO É UMA INSCRIÇÃO DIRECTA. A entrada continua a ser por
 * convite, e é isso que permite dizer ao cliente que quem lhe aparece foi
 * verificado. A candidatura é o passo antes: alguém levanta a mão, e é uma
 * pessoa da CLYON que decide se lhe abre a porta. Aprovar cria o convite de
 * sempre, com o mesmo email e o mesmo link de 14 dias.
 */

export type EstadoDaCandidatura = "nova" | "convidada" | "recusada";

export type Candidatura = {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  cidade: string | null;
  tipoVeiculo: string | null;
  /** Os serviços que diz fazer, pelos ids de SERVICE_CATEGORIES. */
  servicos: string[];
  mensagem: string | null;
  estado: EstadoDaCandidatura;
  notaInterna: string | null;
  conviteId: number | null;
  criadoEm: string;
  tratadoEm: string | null;
  tratadoPor: string | null;
};

let pronta = false;

export async function ensureCandidaturasTable(): Promise<void> {
  if (pronta) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS candidaturasProfissionais (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome        VARCHAR(120) NOT NULL,
      email       VARCHAR(200) NOT NULL,
      telefone    VARCHAR(30) NULL,
      cidade      VARCHAR(120) NULL,
      tipoVeiculo VARCHAR(60) NULL,
      servicosJson TEXT NULL,
      mensagem    VARCHAR(1000) NULL,
      estado      VARCHAR(20) NOT NULL DEFAULT 'nova',
      notaInterna VARCHAR(500) NULL,
      conviteId   INT UNSIGNED NULL DEFAULT NULL,
      criadoEm    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      tratadoEm   DATETIME NULL DEFAULT NULL,
      tratadoPor  VARCHAR(120) NULL,
      KEY candidaturas_estado (estado),
      KEY candidaturas_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  pronta = true;
}

function daLinha(l: Record<string, unknown>): Candidatura {
  let servicos: string[] = [];
  try {
    const lidos = JSON.parse(String(l.servicosJson ?? "[]"));
    if (Array.isArray(lidos)) servicos = lidos.filter((x): x is string => typeof x === "string");
  } catch {
    /* JSON estragado não pode esconder a candidatura toda */
  }
  return {
    id: Number(l.id),
    nome: String(l.nome ?? ""),
    email: String(l.email ?? ""),
    telefone: l.telefone ? String(l.telefone) : null,
    cidade: l.cidade ? String(l.cidade) : null,
    tipoVeiculo: l.tipoVeiculo ? String(l.tipoVeiculo) : null,
    servicos,
    mensagem: l.mensagem ? String(l.mensagem) : null,
    estado: (String(l.estado ?? "nova") as EstadoDaCandidatura),
    notaInterna: l.notaInterna ? String(l.notaInterna) : null,
    conviteId: l.conviteId != null ? Number(l.conviteId) : null,
    criadoEm: String(l.criadoEm ?? ""),
    tratadoEm: l.tratadoEm ? String(l.tratadoEm) : null,
    tratadoPor: l.tratadoPor ? String(l.tratadoPor) : null,
  };
}

/**
 * Guarda uma candidatura nova.
 *
 * Se já houver uma DO MESMO EMAIL por tratar, actualiza-a em vez de criar
 * outra: quem carrega duas vezes no botão não deve encher a fila de quem tem
 * de a ler. Devolve o id, e se era repetida.
 */
export async function guardarCandidatura(dados: {
  nome: string;
  email: string;
  telefone: string | null;
  cidade: string | null;
  tipoVeiculo: string | null;
  servicos: string[];
  mensagem: string | null;
}): Promise<{ id: number; repetida: boolean }> {
  await ensureCandidaturasTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const [existentes] = (await pool.execute(
    "SELECT id FROM candidaturasProfissionais WHERE email = ? AND estado = 'nova' LIMIT 1",
    [dados.email],
  )) as [Array<{ id: number }>, unknown];

  const servicosJson = JSON.stringify(dados.servicos.slice(0, 12));

  if (existentes[0]) {
    const id = Number(existentes[0].id);
    await pool.execute(
      `UPDATE candidaturasProfissionais
          SET nome = ?, telefone = ?, cidade = ?, tipoVeiculo = ?,
              servicosJson = ?, mensagem = ?, criadoEm = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        dados.nome,
        dados.telefone,
        dados.cidade,
        dados.tipoVeiculo,
        servicosJson,
        dados.mensagem,
        id,
      ],
    );
    return { id, repetida: true };
  }

  const [res] = (await pool.execute(
    `INSERT INTO candidaturasProfissionais
       (nome, email, telefone, cidade, tipoVeiculo, servicosJson, mensagem)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.nome,
      dados.email,
      dados.telefone,
      dados.cidade,
      dados.tipoVeiculo,
      servicosJson,
      dados.mensagem,
    ],
  )) as [{ insertId: number }, unknown];

  return { id: Number(res.insertId), repetida: false };
}

/** As candidaturas para o painel — as por tratar primeiro, e as mais novas à frente. */
export async function listarCandidaturas(limite = 60): Promise<Candidatura[]> {
  await ensureCandidaturasTable();
  const pool = await getPool();
  if (!pool) return [];
  const n = Math.max(1, Math.min(200, Math.floor(limite)));
  const [linhas] = (await pool.execute(
    `SELECT * FROM candidaturasProfissionais
      ORDER BY (estado = 'nova') DESC, criadoEm DESC
      LIMIT ${n}`,
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map(daLinha);
}

export async function candidaturaPorId(id: number): Promise<Candidatura | null> {
  await ensureCandidaturasTable();
  const pool = await getPool();
  if (!pool) return null;
  const [linhas] = (await pool.execute(
    "SELECT * FROM candidaturasProfissionais WHERE id = ? LIMIT 1",
    [id],
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas[0] ? daLinha(linhas[0]) : null;
}

/** Marca o que se decidiu, e por quem. */
export async function marcarCandidatura(
  id: number,
  estado: EstadoDaCandidatura,
  por: string | null,
  conviteId?: number | null,
  nota?: string | null,
): Promise<void> {
  await ensureCandidaturasTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `UPDATE candidaturasProfissionais
        SET estado = ?, tratadoEm = CURRENT_TIMESTAMP, tratadoPor = ?,
            conviteId = COALESCE(?, conviteId),
            notaInterna = COALESCE(?, notaInterna)
      WHERE id = ?`,
    [estado, por, conviteId ?? null, nota ?? null, id],
  );
}

/** Quantas estão por ler — para o distintivo do menu. */
export async function candidaturasPorTratar(): Promise<number> {
  await ensureCandidaturasTable();
  const pool = await getPool();
  if (!pool) return 0;
  const [linhas] = (await pool.execute(
    "SELECT COUNT(*) AS n FROM candidaturasProfissionais WHERE estado = 'nova'",
  )) as [Array<{ n: number }>, unknown];
  return Number(linhas[0]?.n ?? 0);
}
