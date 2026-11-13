import { ensureRegistoTable, getPool, registarNaTransaccao } from "./db";
import { agoraDoModelo } from "./relogio-do-modelo";
import { novoModeloEmVigor } from "./novo-modelo";
import { inicioDoFecho } from "./horario-de-atendimento";
import {
  decidirARespostaAoProfissional,
  jaRespondeuForaDeHorasEstaNoite,
  NOME_DO_INTERRUPTOR,
  precisaDosValores,
  qualPerguntaDeDinheiro,
  SEM_VALORES,
  type DecisaoParaOProfissional,
  type ValoresDaCarteira,
} from "./vitoria-aos-profissionais";

/**
 * A VITÓRIA AOS PROFISSIONAIS, NA BASE — d21 (13-11-2026). A regra está em
 * `vitoria-aos-profissionais.ts`; aqui lê-se o interruptor, a carteira e as
 * saídas da conversa. Não envia nada: quem envia é a conversa
 * (`whatsapp-negociacao.ts`), pelo portão de sempre (`enviarTextoWhatsApp`, que
 * não fala com números bloqueados nem entregues a uma pessoa).
 */

/* ── O interruptor (Configs) — DESLIGADO por omissão ─────────────────────── */

/*
 * Na mesma tabela dos interruptores da retenção e do email do fecho
 * (`retencaoInterruptores`), com outra chave. DESLIGADO NA DÚVIDA: sem linha,
 * sem tabela, ou com a base a falhar, a Vitória não responde sozinha aos
 * profissionais. Liga-o o administrador, escrevendo LIGAR, e só quando o dono o
 * confirmar na conversa com o CEO; a mudança fica no registo permanente na
 * mesma transacção. Mesmo ligado, nada muda antes de 15-11 (`novoModeloEmVigor`).
 */
export const CHAVE_DA_VITORIA_AOS_PROFISSIONAIS = "vitoria_profissionais_d21";

export type InterruptorDaVitoriaAosProfissionais = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

async function tabelaDosInterruptores() {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  return pool;
}

export async function interruptorDaVitoriaAosProfissionais(): Promise<InterruptorDaVitoriaAosProfissionais> {
  const desligado: InterruptorDaVitoriaAosProfissionais = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const pool = await tabelaDosInterruptores();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DA_VITORIA_AOS_PROFISSIONAIS],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return desligado;
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? new Date(l.mudadoEm).toISOString() : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[vitoria-aos-profissionais] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return desligado;
  }
}

export async function mudarInterruptorDaVitoriaAosProfissionais(
  ligar: boolean,
  porQuem: string,
): Promise<InterruptorDaVitoriaAosProfissionais> {
  const pool = await tabelaDosInterruptores();
  await ensureRegistoTable();
  const antes = await interruptorDaVitoriaAosProfissionais();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DA_VITORIA_AOS_PROFISSIONAIS, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "vitoria_profissionais_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d21).`,
    });
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* já houve rollback */
    }
    throw e;
  } finally {
    conn.release();
  }
  return interruptorDaVitoriaAosProfissionais();
}

/* ── A carteira dele, para os números ────────────────────────────────────── */

/** A taxa por pagar (por trabalho) e o valor em atraso — a mesma conta da carteira. Na dúvida, sem números. */
export async function valoresDaCarteiraDoProfissional(providerId: number, agora: Date): Promise<ValoresDaCarteira> {
  try {
    const { dividasDoProfissional } = await import("./cobrancas-na-base");
    const { standByDe } = await import("./valor-em-atraso");
    const doModeloNovo = (await dividasDoProfissional(providerId, agora)).filter((d) => d.novoModelo === true);
    const porPagar = doModeloNovo
      .filter((d) => !d.paga && d.total > 0)
      .map((d) => ({ pedidoId: d.pedidoId, taxa: d.comissao, ivaDaTaxa: d.iva, total: d.total }));
    const standBy = standByDe(
      doModeloNovo.map((d) => ({ negociacaoId: d.negociacaoId, pedidoId: d.pedidoId, total: d.total, nasceuEm: d.nasceuEm, paga: d.paga })),
      agora,
    );
    return { porPagar, emAtraso: standBy.total };
  } catch (e) {
    console.error("[vitoria-aos-profissionais] não li a carteira:", e instanceof Error ? e.message : e);
    return SEM_VALORES;
  }
}

/**
 * O QUE DIZER A ESTE PROFISSIONAL — ou «como_antes». Lê o interruptor só depois
 * da data (antes dela nem se pergunta à base), a carteira só quando a resposta
 * leva números, e as saídas só fora de horas.
 */
export async function oQueDizerAoProfissional(
  telefone: string,
  pro: { id: number; nome: string },
  texto: string,
  agora: Date = agoraDoModelo(),
): Promise<DecisaoParaOProfissional> {
  if (!novoModeloEmVigor(agora)) return { tipo: "como_antes" };
  const { ligado } = await interruptorDaVitoriaAosProfissionais();
  if (!ligado) return { tipo: "como_antes" };
  const pergunta = qualPerguntaDeDinheiro(texto);
  const valores = precisaDosValores(pergunta) ? await valoresDaCarteiraDoProfissional(pro.id, agora) : SEM_VALORES;
  let jaRespondeuEstaNoite = false;
  if (!pergunta) {
    const fecho = inicioDoFecho(agora);
    if (fecho) {
      const { saidasDoNumeroWhatsApp } = await import("./db");
      const saidas = await saidasDoNumeroWhatsApp(telefone, 30).catch(() => []);
      jaRespondeuEstaNoite = jaRespondeuForaDeHorasEstaNoite(saidas, agora, fecho);
    }
  }
  return decidirARespostaAoProfissional({ texto, agora, interruptorLigado: true, nome: pro.nome, valores, jaRespondeuEstaNoite });
}
