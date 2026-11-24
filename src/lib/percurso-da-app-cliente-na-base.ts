/**
 * O PERCURSO DO CONVITE DA APP DE CLIENTE, NA BASE — 24-11-2026 (d106). As
 * regras puras estão em `percurso-da-app-cliente.ts`.
 *
 * Uma tabela NOVA (`percursoDoConviteDaApp`), uma linha por EMAIL convidado:
 * o código do link (opaco, único, caduca), quando foi emitido, os cliques e a
 * classe do aparelho, o passo mais à frente a que chegou e o último «Não
 * consegui». Nunca o user-agent nem o IP. O código não se mostra a ninguém:
 * vai só no link do email/WhatsApp da própria pessoa.
 *
 * O MÍNIMO E POR POUCO TEMPO: a purga da noite apaga as linhas sem nada
 * novo há `DIAS_DO_PERCURSO_DO_CONVITE_DA_APP` dias (retencao.ts), e apagar a
 * conta apaga a linha (`apagarConviteNovoDosEmails`/`…DaConta`).
 *
 * As datas escrevem-se com UTC_TIMESTAMP() — a base é lida em UTC.
 */

import { randomBytes } from "node:crypto";
import type { Pool } from "mysql2/promise";
import { getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import { urlDeAccao } from "./url-do-site";
import {
  DIAS_DE_VALIDADE_DO_CODIGO,
  aparelhosDoTexto,
  eAparelho,
  eMotivo,
  ePasso,
  eResposta,
  linkDoConviteDaApp,
  motivoTiraDaApp,
  respostaTiraDaApp,
  type Aparelho,
  type Percurso,
  type RegistoDoPercurso,
} from "./percurso-da-app-cliente";

export const SQL_DA_TABELA_DO_PERCURSO = `CREATE TABLE IF NOT EXISTS percursoDoConviteDaApp (
    email             VARCHAR(255) NOT NULL PRIMARY KEY,
    codigo            VARCHAR(32)  NOT NULL,
    userId            INT UNSIGNED NULL DEFAULT NULL,
    emitidoEm         DATETIME NOT NULL,
    caducaEm          DATETIME NOT NULL,
    cliques           INT UNSIGNED NOT NULL DEFAULT 0,
    cliqueEm          DATETIME NULL DEFAULT NULL,
    ultimoCliqueEm    DATETIME NULL DEFAULT NULL,
    aparelho          VARCHAR(10) NULL DEFAULT NULL,
    aparelhos         VARCHAR(40) NULL DEFAULT NULL,
    passo             TINYINT UNSIGNED NULL DEFAULT NULL,
    passoEm           DATETIME NULL DEFAULT NULL,
    naoConseguiPasso  TINYINT UNSIGNED NULL DEFAULT NULL,
    naoConseguiMotivo VARCHAR(20) NULL DEFAULT NULL,
    naoConseguiTexto  VARCHAR(300) NULL DEFAULT NULL,
    naoConseguiEm     DATETIME NULL DEFAULT NULL,
    avisoDaListaEm    DATETIME NULL DEFAULT NULL,
    linhaDasPropostasEm DATETIME NULL DEFAULT NULL,
    resposta          TINYINT UNSIGNED NULL DEFAULT NULL,
    respostaEm        DATETIME NULL DEFAULT NULL,
    semAppEm          DATETIME NULL DEFAULT NULL,
    UNIQUE KEY uq_percurso_codigo (codigo),
    KEY idx_percurso_user (userId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let pronta = false;

async function base(): Promise<Pool> {
  const p = (await getPool()) as Pool | null;
  if (!p) throw new Error("[percurso-da-app] base de dados indisponível");
  if (!pronta) {
    await p.execute(SQL_DA_TABELA_DO_PERCURSO);
    pronta = true;
  }
  return p;
}

const minusculo = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/** Um código novo: 12 bytes aleatórios → 16 caracteres base64url. Impossível de adivinhar. */
export function codigoNovo(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * O código desta pessoa: o mesmo enquanto não caducar (o convite e o
 * lembrete levam o mesmo link); caducado, um novo, com mais 60 dias.
 */
export async function codigoDoConvite(email: string, userId: number | null = null): Promise<string | null> {
  const e = minusculo(email);
  if (!e.includes("@")) return null;
  const p = await base();
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      // A ordem das atribuições conta: o `codigo` decide pela data de antes, e só depois ela muda.
      await p.execute(
        `INSERT INTO percursoDoConviteDaApp (email, codigo, userId, emitidoEm, caducaEm)
         VALUES (?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP() + INTERVAL ${DIAS_DE_VALIDADE_DO_CODIGO} DAY)
         ON DUPLICATE KEY UPDATE
           codigo    = IF(caducaEm > UTC_TIMESTAMP(), codigo, VALUES(codigo)),
           emitidoEm = IF(caducaEm > UTC_TIMESTAMP(), emitidoEm, VALUES(emitidoEm)),
           caducaEm  = IF(caducaEm > UTC_TIMESTAMP(), caducaEm, VALUES(caducaEm)),
           userId    = COALESCE(userId, VALUES(userId))`,
        [e, codigoNovo(), userId],
      );
      break;
    } catch (err) {
      // Dois códigos iguais (praticamente impossível): outro.
      if ((err as { code?: string })?.code !== "ER_DUP_ENTRY" || tentativa === 2) throw err;
    }
  }
  const [linhas] = (await p.execute("SELECT codigo FROM percursoDoConviteDaApp WHERE email = ? LIMIT 1", [e])) as [
    Array<{ codigo: string }>,
    unknown,
  ];
  return linhas[0]?.codigo ?? null;
}

/**
 * O LINK NOSSO desta pessoa — o que o convite, o lembrete, o WhatsApp e o
 * aviso da lista levam no lugar do link da Play. Se a base falhar, o link sem
 * código (a mesma página, sem registo): o convite não deixa de sair por isso.
 */
export async function linkNossoDoConvite(email: string, userId: number | null = null): Promise<string> {
  let codigo: string | null = null;
  try {
    codigo = await codigoDoConvite(email, userId);
  } catch (e) {
    console.error("[percurso-da-app] código:", e instanceof Error ? e.message : e);
  }
  return linkDoConviteDaApp(urlDeAccao(), codigo);
}

/**
 * Grava o que a página mandou. Um código que não existe ou caducou não muda
 * nada — e quem chama responde igual (ninguém descobre códigos por tentativa).
 */
export async function registarNoPercurso(codigo: string, r: RegistoDoPercurso, aparelho: Aparelho): Promise<boolean> {
  const p = await base();
  const valido = "codigo = ? AND caducaEm > UTC_TIMESTAMP()";
  let res: unknown;
  if (r.accao === "abriu") {
    [res] = await p.execute(
      `UPDATE percursoDoConviteDaApp
          SET cliques = LEAST(cliques + 1, 1000),
              cliqueEm = COALESCE(cliqueEm, UTC_TIMESTAMP()),
              ultimoCliqueEm = UTC_TIMESTAMP(),
              aparelho = ?,
              aparelhos = IF(aparelhos IS NULL OR aparelhos = '', ?, IF(FIND_IN_SET(?, aparelhos) > 0, aparelhos, CONCAT(aparelhos, ',', ?)))
        WHERE ${valido}`,
      [aparelho, aparelho, aparelho, aparelho, codigo],
    );
  } else if (r.accao === "passo") {
    [res] = await p.execute(
      `UPDATE percursoDoConviteDaApp
          SET passo = GREATEST(COALESCE(passo, 0), ?), passoEm = UTC_TIMESTAMP()
        WHERE ${valido}`,
      [r.passo, codigo],
    );
  } else if (r.accao === "resposta") {
    [res] = await p.execute(
      `UPDATE percursoDoConviteDaApp SET resposta = ?, respostaEm = UTC_TIMESTAMP() WHERE ${valido}`,
      [r.r, codigo],
    );
  } else {
    [res] = await p.execute(
      `UPDATE percursoDoConviteDaApp
          SET passo = GREATEST(COALESCE(passo, 0), ?), passoEm = COALESCE(passoEm, UTC_TIMESTAMP()),
              naoConseguiPasso = ?, naoConseguiMotivo = ?, naoConseguiTexto = ?, naoConseguiEm = UTC_TIMESTAMP()
        WHERE ${valido}`,
      [r.passo, r.passo, r.motivo, r.texto, codigo],
    );
  }
  const mudou = Number((res as { affectedRows?: number })?.affectedRows ?? 0) > 0;

  /*
   * «Não lhe voltamos a falar da app» (v3): o r=2 e o r=3 do lembrete (e a
   * {LINK_RECUSA}), «Não tenho Android», e a página aberta num iPhone. A
   * recusa grava-se à parte (`marcarSemApp`, nao-contactar.ts), para não
   * caducar com a purga do percurso, e trava só o que é sobre a app.
   */
  const tira =
    (r.accao === "resposta" && respostaTiraDaApp(r.r)) ||
    (r.accao === "nao-consegui" && motivoTiraDaApp(r.motivo)) ||
    (r.accao === "abriu" && aparelho === "iphone");
  if (mudou && tira) {
    await p.execute(`UPDATE percursoDoConviteDaApp SET semAppEm = COALESCE(semAppEm, UTC_TIMESTAMP()) WHERE ${valido}`, [codigo]);
    const [linhas] = (await p.execute(`SELECT email FROM percursoDoConviteDaApp WHERE ${valido} LIMIT 1`, [codigo])) as [
      Array<{ email: string }>,
      unknown,
    ];
    const email = linhas[0]?.email;
    if (email) {
      const { marcarSemApp } = await import("./nao-contactar");
      const origem =
        r.accao === "resposta" ? `ligação do convite, r=${r.r}` : r.accao === "abriu" ? "ligação do convite, iPhone" : "não tenho Android";
      await marcarSemApp({ email }, `${origem} (d106)`);
    }
  }
  return mudou;
}

type Linha = {
  email: string;
  emitidoEm: Date | string | null;
  cliqueEm: Date | string | null;
  cliques: number | string | null;
  aparelho: string | null;
  aparelhos: string | null;
  passo: number | string | null;
  passoEm: Date | string | null;
  naoConseguiPasso: number | string | null;
  naoConseguiMotivo: string | null;
  naoConseguiTexto: string | null;
  naoConseguiEm: Date | string | null;
  resposta: number | string | null;
  semAppEm: Date | string | null;
};

const iso = (v: Date | string | null | undefined): string | null => {
  const d = instanteDaBase(v ?? null);
  return d ? d.toISOString() : null;
};

/** Todos os percursos (sem o código), para o backoffice. Uma tabela por nascer = lista vazia. */
export async function percursosDosConvites(): Promise<Percurso[]> {
  const p = await base();
  const [linhas] = (await p.query(
    `SELECT email, emitidoEm, cliqueEm, cliques, aparelho, aparelhos, passo, passoEm,
            naoConseguiPasso, naoConseguiMotivo, naoConseguiTexto, naoConseguiEm, resposta, semAppEm
       FROM percursoDoConviteDaApp ORDER BY emitidoEm DESC LIMIT 5000`,
  )) as [Linha[], unknown];
  return linhas.map((l) => {
    const passo = Number(l.passo);
    const npasso = Number(l.naoConseguiPasso);
    return {
      email: minusculo(l.email),
      criadoEm: iso(l.emitidoEm),
      cliqueEm: iso(l.cliqueEm),
      cliques: Number(l.cliques ?? 0),
      aparelho: eAparelho(l.aparelho) ? l.aparelho : null,
      aparelhos: aparelhosDoTexto(l.aparelhos),
      passo: ePasso(passo) ? passo : null,
      passoEm: iso(l.passoEm),
      naoConsegui:
        ePasso(npasso) && eMotivo(l.naoConseguiMotivo)
          ? { passo: npasso, motivo: l.naoConseguiMotivo, texto: l.naoConseguiTexto ?? null, em: iso(l.naoConseguiEm) }
          : null,
      resposta: eResposta(Number(l.resposta)) ? (Number(l.resposta) as 1 | 2 | 3) : null,
      semAppEm: iso(l.semAppEm),
    };
  });
}

/* ─── A linha da app no aviso de propostas (v3, secção 0) ─────────────── */

/**
 * Reserva a linha da app ANTES de enviar o aviso de propostas: uma vez por
 * pessoa (v3: «Uma mensagem por pessoa»). Cria a linha do percurso se não
 * houver. `true` = é a primeira, pode levar a linha.
 */
export async function reservarLinhaDasPropostas(email: string): Promise<boolean> {
  const e = minusculo(email);
  if (!e.includes("@")) return false;
  const p = await base();
  const [r] = (await p.execute(
    "UPDATE percursoDoConviteDaApp SET linhaDasPropostasEm = UTC_TIMESTAMP() WHERE email = ? AND linhaDasPropostasEm IS NULL",
    [e],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0) === 1;
}

/**
 * Recebeu o convite ou o lembrete de 17/11 (v3: a secção 0 não lhe sai), ou
 * já abriu a app. Na dúvida (a base falha), «sim»: a linha não sai.
 */
export async function jaTeveOConviteOuAApp(email: string): Promise<boolean> {
  const e = minusculo(email);
  const p = await base();
  const consultas: Array<[string, string[]]> = [
    ["SELECT 1 AS x FROM conviteNovoDaApp WHERE email = ? AND enviadoEm IS NOT NULL LIMIT 1", [e]],
    ["SELECT 1 AS x FROM convitesAppCliente WHERE email = ? AND enviadoEm IS NOT NULL LIMIT 1", [e]],
    ["SELECT 1 AS x FROM seguimentoDaApp WHERE email = ? AND lembreteEm IS NOT NULL LIMIT 1", [e]],
    ["SELECT 1 AS x FROM users WHERE LOWER(TRIM(email)) = ? AND appClienteAbertaEm IS NOT NULL LIMIT 1", [e]],
    ["SELECT 1 AS x FROM pushSubscriptions WHERE app = 'cliente' AND LOWER(TRIM(userEmail)) = ? LIMIT 1", [e]],
  ];
  for (const [sql, params] of consultas) {
    try {
      const [l] = (await p.execute(sql, params)) as [unknown[], unknown];
      if (l.length > 0) return true;
    } catch (err) {
      if ((err as { code?: string })?.code === "ER_NO_SUCH_TABLE") continue;
      throw err;
    }
  }
  return false;
}

/* ─── O aviso «Já pode entrar no teste» (P4) ───────────────────────────── */

/** Reserva o aviso da lista ANTES de enviar: só passa quem ainda não o tem. */
export async function reservarAvisoDaLista(email: string): Promise<boolean> {
  const p = await base();
  const [r] = (await p.execute(
    "UPDATE percursoDoConviteDaApp SET avisoDaListaEm = UTC_TIMESTAMP() WHERE email = ? AND avisoDaListaEm IS NULL",
    [minusculo(email)],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0) === 1;
}

/** Já recebeu o aviso da lista (para não o escolher outra vez). */
export async function emailsJaAvisadosDaLista(): Promise<Set<string>> {
  const p = await base();
  const [l] = (await p.query("SELECT email FROM percursoDoConviteDaApp WHERE avisoDaListaEm IS NOT NULL")) as [
    Array<{ email: string }>,
    unknown,
  ];
  return new Set(l.map((x) => minusculo(x.email)));
}

export async function desfazerAvisoDaLista(email: string): Promise<void> {
  const p = await base();
  await p.execute("UPDATE percursoDoConviteDaApp SET avisoDaListaEm = NULL WHERE email = ?", [minusculo(email)]);
}

/* ─── A purga ───────────────────────────────────────────────────────────── */

/**
 * As linhas sem nada de novo há mais de `dias` dias (nem emitido, nem clique,
 * nem passo, nem «Não consegui»). A seco (`aSerio: false`) só conta.
 */
export async function purgarPercursosDaApp(dias: number, opcoes: { aSerio?: boolean } = {}): Promise<number> {
  const aSerio = opcoes.aSerio !== false;
  const n = Math.max(1, Math.floor(dias));
  const p = await base();
  const onde = `GREATEST(emitidoEm, COALESCE(ultimoCliqueEm, emitidoEm), COALESCE(passoEm, emitidoEm), COALESCE(naoConseguiEm, emitidoEm))
                < UTC_TIMESTAMP() - INTERVAL ${n} DAY`;
  if (!aSerio) {
    const [l] = (await p.query(`SELECT COUNT(*) AS n FROM percursoDoConviteDaApp WHERE ${onde}`)) as [
      Array<{ n: number | string }>,
      unknown,
    ];
    return Number(l[0]?.n ?? 0);
  }
  const [r] = (await p.execute(`DELETE FROM percursoDoConviteDaApp WHERE ${onde} LIMIT 2000`)) as [
    { affectedRows?: number },
    unknown,
  ];
  return Number(r?.affectedRows ?? 0);
}
