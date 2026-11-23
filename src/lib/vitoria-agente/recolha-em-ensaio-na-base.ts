/**
 * A RECOLHA EM ENSAIO NA BASE — d99 (23-11-2026), fase 1.
 *
 * Liga a orquestra (`recolha-em-ensaio.ts`) à base: o interruptor
 * «Vitória agente — recolha (ensaio)» (DESLIGADO por omissão e na dúvida), o
 * rascunho-sombra (`vitoriaRascunhoSombra`), a linha do ensaio ao lado da
 * resposta real (`vitoriaEnsaios`, o painel «Ensaio da Vitória»), a
 * comparação (`vitoriaRecolhaEnsaios`) e os números dos critérios.
 *
 * O rascunho real (`whatsappRecolhas`) só se LÊ. Daqui não sai nada para o
 * cliente, nada se grava no rascunho real e nenhum pedido nasce.
 */

import { instanteDaBase } from "../hora-de-lisboa";
import { HORAS_DO_RASCUNHO } from "../conversa-parada-a-meio";
import type { DadosDaRecolha } from "../whatsapp-recolha";
import { clienteDoClaude, type ClienteDoClaude } from "./cliente";
import { tectoQueValeNaRecolha, type EsforcoDoAgente } from "./custo";
import {
  ferramentasDeVerdade,
  gastoDaRecolhaHojeUsd,
  gastoDeHojeUsd,
  garantirTabelas,
  lerInterruptor,
  quemEscreveNoNumero,
  registarAccao,
  tectoDaRecolhaUsd,
  tectoDiarioUsd,
} from "./na-base";
import { recolhaEmEnsaio, type ResultadoDaRecolhaEmEnsaio, type SombraDaRecolha } from "./recolha-em-ensaio";
import { CRITERIOS_DA_RECOLHA, metricasDaRecolha, type LinhaDaRecolhaEmEnsaio, type MetricasDaRecolha } from "./recolha-pelo-agente";

const digitos = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "").slice(-20);
const json = (v: unknown, max: number) => {
  try {
    return JSON.stringify(v).slice(0, max);
  } catch {
    return null;
  }
};

/** O rascunho-sombra do número; passados os 7 dias do rascunho, recomeça (como o real). */
async function lerSombra(telefone: string): Promise<SombraDaRecolha | null> {
  const pool = await garantirTabelas();
  const [rows] = (await pool.execute(
    "SELECT dadosJson, resumoPropostoEm, registadoEm, actualizadoEm FROM vitoriaRascunhoSombra WHERE telefone = ? LIMIT 1",
    [digitos(telefone)],
  )) as [Array<{ dadosJson: string | null; resumoPropostoEm: string | null; registadoEm: string | null; actualizadoEm: Date | string | null }>, unknown];
  const r = rows[0];
  if (!r) return null;
  const em = instanteDaBase(r.actualizadoEm);
  if (em && Date.now() - em.getTime() > HORAS_DO_RASCUNHO * 3600_000) return null;
  let dados: DadosDaRecolha = {};
  try {
    const v = JSON.parse(String(r.dadosJson ?? "{}"));
    if (v && typeof v === "object") dados = v as DadosDaRecolha;
  } catch {
    dados = {};
  }
  return { dados, resumoPropostoEm: r.resumoPropostoEm ?? null, registadoEm: r.registadoEm ?? null };
}

async function gravarSombra(telefone: string, s: SombraDaRecolha): Promise<void> {
  const pool = await garantirTabelas();
  await pool.execute(
    `INSERT INTO vitoriaRascunhoSombra (telefone, dadosJson, resumoPropostoEm, registadoEm) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE dadosJson = VALUES(dadosJson), resumoPropostoEm = VALUES(resumoPropostoEm), registadoEm = VALUES(registadoEm)`,
    [digitos(telefone), json(s.dados, 60000), s.resumoPropostoEm, s.registadoEm],
  );
}

/**
 * O ENSAIO DA RECOLHA DE UMA MENSAGEM, na ponte, DEPOIS da resposta real.
 * Desligado, com pedido, sem chave ou com o tecto passado, não chama nada.
 * Nunca lança.
 */
export async function recolhaEmEnsaioNaBase(
  telefone: string,
  opcoes: { agora?: Date; cliente?: ClienteDoClaude | null; esforco?: EsforcoDoAgente } = {},
): Promise<ResultadoDaRecolhaEmEnsaio> {
  try {
    if (!(await lerInterruptor("recolha")).ligado) return { feito: false, porque: "recolha em ensaio desligada" };
    const agora = opcoes.agora ?? new Date();
    const db = await import("../db");
    const neg = await import("../whatsapp-negociacao");
    const pool = await garantirTabelas();
    let quemDoNumero: Awaited<ReturnType<typeof quemEscreveNoNumero>> | null = null;
    const doNumero = async () => (quemDoNumero ??= await quemEscreveNoNumero(telefone));
    return await recolhaEmEnsaio({
      agora,
      interruptor: async () => true,
      cliente: opcoes.cliente !== undefined ? opcoes.cliente : clienteDoClaude(),
      esforco: opcoes.esforco,
      pedidosDoTelefone: () => neg.pedidosDoTelefone(telefone),
      interrompida: () => db.numeroInterrompidoWhatsApp(telefone).catch(() => true),
      // SÓ LEITURA: o rascunho da Vitória de sempre.
      rascunhoReal: async () => {
        const g = await db.recolhaWhatsApp(telefone).catch(() => null);
        return g ? { passo: g.passo, dados: (g.dados ?? {}) as DadosDaRecolha, pedidoId: g.pedidoId } : null;
      },
      fio: () => db.mensagensDoNumeroWhatsApp(telefone, 40),
      quem: async () => (await doNumero()).quem,
      lerSombra: () => lerSombra(telefone),
      gravarSombra: (s) => gravarSombra(telefone, s),
      gastos: async () => {
        const [gastoUsd, tectoUsd, gastoDaRecolhaUsd, tectoDaRecolha] = await Promise.all([
          gastoDeHojeUsd(agora),
          tectoDiarioUsd(),
          gastoDaRecolhaHojeUsd(agora),
          tectoDaRecolhaUsd(),
        ]);
        return { gastoUsd, tectoUsd, gastoDaRecolhaUsd, tectoDaRecolhaUsd: tectoQueValeNaRecolha(tectoDaRecolha, tectoUsd) };
      },
      ferramentas: () => ferramentasDeVerdade(telefone, agora, []),
      novoEnsaio: async (e) => {
        const [novo] = (await pool.execute(
          "INSERT INTO vitoriaEnsaios (telefone, pedidoId, mensagemDoCliente, respostaReal, estado) VALUES (?, NULL, ?, ?, 'recolha_a_correr')",
          [digitos(telefone), e.mensagemDoCliente, e.respostaReal],
        )) as [{ insertId: number }, unknown];
        return Number(novo.insertId);
      },
      fecharEnsaio: async (id, e) => {
        const r = e.resultado;
        await pool.execute(
          `UPDATE vitoriaEnsaios SET respostaDoAgente = ?, teriaFeitoJson = ?, estado = ?, motivo = ?, modelo = ?,
             tokensEntrada = ?, tokensSaida = ?, tokensCacheLidos = ?, tokensCacheEscritos = ?, custoUsd = ?
           WHERE id = ?`,
          [
            e.respostaDoAgente ? e.respostaDoAgente.slice(0, 4000) : null,
            json(e.teriaFeito, 4000),
            e.estado.slice(0, 20),
            e.motivo ? e.motivo.slice(0, 255) : null,
            r?.modelo ?? null,
            r?.uso.entrada ?? 0,
            r?.uso.saida ?? 0,
            r?.uso.cacheLidos ?? 0,
            r?.uso.cacheEscritos ?? 0,
            r?.custoUsd ?? 0,
            id,
          ],
        );
      },
      guardarComparacao: async (c) => {
        await pool.execute(
          `INSERT INTO vitoriaRecolhaEnsaios (ensaioId, telefone, camposIguais, camposComparados, ambosNoResumo, camposJson,
             fugasEvitadas, fugasNoModelo, chamouOModelo, duracaoMs, custoUsd, resumoProposto)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            c.ensaioId,
            digitos(telefone),
            c.iguais,
            c.comparados,
            c.ambosNoResumo ? 1 : 0,
            json(c.campos, 8000),
            c.fugasEvitadas,
            c.fugasNoModelo,
            c.chamouOModelo ? 1 : 0,
            Math.max(0, Math.min(2_000_000_000, Math.round(c.duracaoMs))),
            c.custoUsd,
            c.resumoProposto ? 1 : 0,
          ],
        );
      },
      registarAccao: (ensaioId, l) => registarAccao({ ...l, ensaioId, telefone, pedidoId: null, ensaio: true }),
    });
  } catch (e) {
    console.error("[vitoria-agente] a recolha em ensaio falhou:", e instanceof Error ? e.message : e);
    return { feito: false, porque: "erro" };
  }
}

/* ── O resumo dos números, para o painel e a rota ────────────────────────── */

export type ResumoDaRecolhaEmEnsaio = {
  ligado: boolean;
  tectoUsd: number;
  gastoHojeUsd: number;
  criterios: typeof CRITERIOS_DA_RECOLHA;
  metricas: MetricasDaRecolha;
};

/** Os critérios da d99 sobre os ensaios dos últimos `dias` dias (só leitura). */
export async function resumoDaRecolhaEmEnsaio(dias = 30, agora: Date = new Date()): Promise<ResumoDaRecolhaEmEnsaio> {
  const n = Math.max(1, Math.min(60, Math.floor(dias)));
  const [interruptor, tectoDaRecolha, tectoGeral] = await Promise.all([lerInterruptor("recolha"), tectoDaRecolhaUsd(), tectoDiarioUsd()]);
  const pool = await garantirTabelas();
  const [rows] = (await pool.execute(
    `SELECT r.telefone, r.criadoEm, r.camposIguais, r.camposComparados, r.ambosNoResumo, r.fugasEvitadas, r.fugasNoModelo,
            r.chamouOModelo, r.duracaoMs, r.custoUsd, e.avaliacao
       FROM vitoriaRecolhaEnsaios r LEFT JOIN vitoriaEnsaios e ON e.id = r.ensaioId
      WHERE r.criadoEm >= UTC_TIMESTAMP() - INTERVAL ${n} DAY
      ORDER BY r.id DESC LIMIT 20000`,
  )) as [Array<Record<string, unknown>>, unknown];
  const linhas: LinhaDaRecolhaEmEnsaio[] = rows.map((r) => ({
    telefone: String(r.telefone ?? ""),
    criadoEm: instanteDaBase(r.criadoEm as string | Date | null) ?? new Date(0),
    camposIguais: Number(r.camposIguais) || 0,
    camposComparados: Number(r.camposComparados) || 0,
    ambosNoResumo: Number(r.ambosNoResumo) === 1,
    fugasEvitadas: Number(r.fugasEvitadas) || 0,
    fugasNoModelo: Number(r.fugasNoModelo) || 0,
    chamouOModelo: Number(r.chamouOModelo) === 1,
    duracaoMs: Number(r.duracaoMs) || 0,
    custoUsd: Number(r.custoUsd) || 0,
    avaliacao: (r.avaliacao as string | null) ?? null,
  }));
  return {
    ligado: interruptor.ligado,
    tectoUsd: tectoQueValeNaRecolha(tectoDaRecolha, tectoGeral),
    gastoHojeUsd: await gastoDaRecolhaHojeUsd(agora).catch(() => 0),
    criterios: CRITERIOS_DA_RECOLHA,
    metricas: metricasDaRecolha(linhas),
  };
}

/* ── A purga ─────────────────────────────────────────────────────────────── */

/**
 * O RASCUNHO-SOMBRA SAI AOS 7 DIAS (o prazo do rascunho real,
 * `HORAS_DO_RASCUNHO`); a comparação (sem dados de pessoas, mas com o
 * telefone) aos `dias` do registo da Vitória agente. A seco só conta.
 */
export async function purgarARecolhaEmEnsaio(dias: number, opcoes: { aSerio?: boolean } = {}): Promise<number> {
  const aSerio = opcoes.aSerio !== false;
  const pool = await garantirTabelas();
  const ondes = [
    `vitoriaRascunhoSombra WHERE actualizadoEm < NOW() - INTERVAL ${Math.round(HORAS_DO_RASCUNHO / 24)} DAY`,
    `vitoriaRecolhaEnsaios WHERE criadoEm < NOW() - INTERVAL ${Math.max(32, Math.floor(dias))} DAY`,
  ];
  let total = 0;
  for (const onde of ondes) {
    if (!aSerio) {
      const [l] = (await pool.execute(`SELECT COUNT(*) AS n FROM ${onde}`)) as [Array<{ n: number | string }>, unknown];
      total += Number(l[0]?.n ?? 0);
      continue;
    }
    const [r] = (await pool.execute(`DELETE FROM ${onde} LIMIT 5000`)) as [{ affectedRows?: number }, unknown];
    total += Number(r?.affectedRows ?? 0);
  }
  return total;
}
