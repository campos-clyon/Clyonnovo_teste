/**
 * «AVISAR NO WHATSAPP» QUEM NÃO USA A CLYON PRO, NA BASE — d134 (26-11-2026).
 * As regras puras estão em `aviso-da-app-pro.ts`.
 *
 * SÓ SAI QUANDO O ADMINISTRADOR CARREGA EM «ENVIAR» (POST de
 * /api/admin/quem-conta-para-os-12/avisar, com o texto que ele viu): nunca
 * num deploy, nunca numa rotina. Sai pelo mesmo caminho dos outros avisos do
 * backoffice (`enviarAvisoWhatsApp`: Meta, ponte ou fila manual, com as
 * guardas de quem pediu para não ser contactado) e fica no histórico do
 * profissional (`registoPermanente`, por providerId: quem e quando).
 *
 * UM POR DIA: a linha (providerId, dia de Lisboa) de `avisosDaAppPro`
 * reserva-se ANTES de enviar (chave primária: dois cliques ou duas pessoas ao
 * mesmo tempo não enviam duas vezes) e desfaz-se se não saiu.
 */

import type { Pool } from "mysql2/promise";
import { getPool, registarSemFalhar, type LinhaDoRegisto } from "./db";
import { diaEmLisboa, instanteDaBase } from "./hora-de-lisboa";
import { enviarAvisoWhatsApp, telemovelParaWhatsApp } from "./whatsapp-cloud";
import { estadoQueSeAvisa, textoParaEnviar, type EstadoQueSeAvisa } from "./aviso-da-app-pro";
import { montarQuadro, ROTULOS_DO_USO, type EstadoDeUso, type PessoaDoTeste } from "./quem-conta-para-os-12";

export const SQL_DOS_AVISOS_DA_APP_PRO = `
    CREATE TABLE IF NOT EXISTS avisosDaAppPro (
      providerId   INT UNSIGNED NOT NULL,
      dia          CHAR(10)     NOT NULL,
      estado       VARCHAR(12)  NOT NULL DEFAULT 'a_enviar',
      reservadoEm  DATETIME     NOT NULL,
      enviadoEm    DATETIME     NULL DEFAULT NULL,
      porQuem      VARCHAR(120) NULL DEFAULT NULL,
      estadoDeUso  VARCHAR(8)   NULL DEFAULT NULL,
      PRIMARY KEY (providerId, dia),
      KEY idx_enviado (estado, enviadoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

let tabelaPronta = false;

async function pool(): Promise<Pool> {
  const p = await getPool();
  if (!p) throw new Error("[aviso-da-app-pro] base de dados indisponível");
  if (!tabelaPronta) {
    await p.execute(SQL_DOS_AVISOS_DA_APP_PRO);
    tabelaPronta = true;
  }
  return p as Pool;
}

/** O último aviso que saiu a cada profissional (ISO), para o quadro. */
export async function ultimosAvisosDaAppPro(): Promise<Map<number, string>> {
  const p = await pool();
  const [linhas] = (await p.query(
    `SELECT providerId, MAX(enviadoEm) AS em FROM avisosDaAppPro
      WHERE estado = 'enviado' AND enviadoEm IS NOT NULL GROUP BY providerId`,
  )) as [Array<{ providerId: number; em: Date | string | null }>, unknown];
  const saida = new Map<number, string>();
  for (const l of linhas) {
    const d = instanteDaBase(l.em ?? null);
    if (d) saida.set(Number(l.providerId), d.toISOString());
  }
  return saida;
}

/* ─── O envio de um aviso ───────────────────────────────────────────────── */

export type ResultadoDoAviso =
  | { ok: true; avisadoEm: string }
  | { ok: false; status: number; error: string; avisadoEm?: string | null };

/** O que o envio precisa do mundo — separado para se testar sem base nem WhatsApp. */
export type CaminhosDoAviso = {
  /** A pessoa como o quadro a vê (estado, telefone, email da Play), ou null. */
  lerPessoa(providerId: number): Promise<{ pessoa: PessoaDoTeste; estado: EstadoDeUso } | null>;
  /** Reserva o dia; false se já há aviso (ou um a sair) hoje. */
  reservar(providerId: number, dia: string, porQuem: string, estado: EstadoQueSeAvisa): Promise<boolean>;
  /** O aviso que já saiu hoje (ISO), para o dizer. */
  avisadoNoDia(providerId: number, dia: string): Promise<string | null>;
  confirmar(providerId: number, dia: string): Promise<string>;
  desfazer(providerId: number, dia: string): Promise<void>;
  telemovel(telefone: string | null): string | null;
  enviar(telefone: string, texto: string): Promise<boolean>;
  registar(linha: LinhaDoRegisto): Promise<void>;
};

export type PedidoDeAviso = {
  providerId: number;
  texto: unknown;
  porQuem: string;
  porId?: number | null;
  agora?: Date;
};

export async function avisarNaAppProCom(c: CaminhosDoAviso, pedido: PedidoDeAviso): Promise<ResultadoDoAviso> {
  const texto = textoParaEnviar(pedido.texto);
  if (!texto) return { ok: false, status: 400, error: "O texto está vazio ou é demasiado comprido." };
  const lida = await c.lerPessoa(pedido.providerId);
  if (!lida) return { ok: false, status: 404, error: "Esta pessoa não está no quadro da CLYON Pro." };
  const { pessoa, estado } = lida;
  if (!estadoQueSeAvisa(estado)) {
    return { ok: false, status: 409, error: "Esta pessoa já usa a app: não há nada a avisar." };
  }
  const telefone = c.telemovel(pessoa.telefone);
  if (!telefone) return { ok: false, status: 409, error: "Sem telemóvel português para o WhatsApp." };

  const dia = diaEmLisboa(pedido.agora ?? new Date());
  if (!(await c.reservar(pedido.providerId, dia, pedido.porQuem, estado))) {
    const ja = await c.avisadoNoDia(pedido.providerId, dia);
    return { ok: false, status: 409, error: "Já foi avisado hoje.", avisadoEm: ja };
  }

  let saiu = false;
  try {
    saiu = await c.enviar(telefone, texto);
  } catch {
    saiu = false;
  }
  if (!saiu) {
    await c.desfazer(pedido.providerId, dia);
    return { ok: false, status: 502, error: "O WhatsApp não saiu. Tente mais tarde." };
  }

  const avisadoEm = await c.confirmar(pedido.providerId, dia);
  await c.registar({
    acontecimento: "aviso_da_app_pro",
    providerId: pedido.providerId,
    providerNome: pessoa.nome.slice(0, 160),
    autorTipo: "clyon",
    autorNome: pedido.porQuem,
    estadoAntes: estado,
    resumo: `Aviso da app CLYON Pro («${ROTULOS_DO_USO[estado]}») enviado pelo WhatsApp por ${pedido.porQuem} (d134).`,
    detalhe: { porId: pedido.porId ?? null, estado, texto },
  });
  return { ok: true, avisadoEm };
}

/** Os caminhos de verdade: a base, o quadro e o WhatsApp da plataforma. */
export function caminhosDaBase(): CaminhosDoAviso {
  return {
    async lerPessoa(providerId) {
      const { pessoasDaAppPro } = await import("./quem-conta-para-os-12-na-base");
      const pessoa = (await pessoasDaAppPro()).find((x) => x.id === `p${providerId}`);
      if (!pessoa) return null;
      const linha = montarQuadro([pessoa], null, new Date()).linhas[0];
      return linha ? { pessoa: linha, estado: linha.estado } : null;
    },
    async reservar(providerId, dia, porQuem, estado) {
      const p = await pool();
      // Uma reserva que ficou a meio (o servidor caiu a enviar) não prende o dia.
      await p.execute(
        `DELETE FROM avisosDaAppPro WHERE providerId = ? AND dia = ? AND estado = 'a_enviar'
            AND reservadoEm < UTC_TIMESTAMP() - INTERVAL 10 MINUTE`,
        [providerId, dia],
      );
      const [r] = (await p.execute(
        `INSERT IGNORE INTO avisosDaAppPro (providerId, dia, estado, reservadoEm, porQuem, estadoDeUso)
         VALUES (?, ?, 'a_enviar', UTC_TIMESTAMP(), ?, ?)`,
        [providerId, dia, porQuem.slice(0, 120), estado],
      )) as [{ affectedRows?: number }, unknown];
      return Number(r.affectedRows ?? 0) > 0;
    },
    async avisadoNoDia(providerId, dia) {
      const p = await pool();
      const [linhas] = (await p.execute(
        "SELECT enviadoEm FROM avisosDaAppPro WHERE providerId = ? AND dia = ? AND estado = 'enviado' LIMIT 1",
        [providerId, dia],
      )) as [Array<{ enviadoEm: Date | string | null }>, unknown];
      const d = instanteDaBase(linhas[0]?.enviadoEm ?? null);
      return d ? d.toISOString() : null;
    },
    async confirmar(providerId, dia) {
      const p = await pool();
      await p.execute(
        "UPDATE avisosDaAppPro SET estado = 'enviado', enviadoEm = UTC_TIMESTAMP() WHERE providerId = ? AND dia = ?",
        [providerId, dia],
      );
      return new Date().toISOString();
    },
    async desfazer(providerId, dia) {
      const p = await pool();
      await p.execute("DELETE FROM avisosDaAppPro WHERE providerId = ? AND dia = ? AND estado = 'a_enviar'", [
        providerId,
        dia,
      ]);
    },
    telemovel: telemovelParaWhatsApp,
    async enviar(telefone, texto) {
      return enviarAvisoWhatsApp(telefone, texto);
    },
    registar: registarSemFalhar,
  };
}

export function avisarNaAppPro(pedido: PedidoDeAviso): Promise<ResultadoDoAviso> {
  return avisarNaAppProCom(caminhosDaBase(), pedido);
}
