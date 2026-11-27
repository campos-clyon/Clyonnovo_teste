/**
 * O TRABALHO SEM DIA, NA BASE E NOS CANAIS — d138 (27-11-2026). As portas de
 * `trabalho-sem-dia.ts`:
 *
 *  - `trabalhosSemDia`: uma linha por negociação + o que falta (o dia, ou só a
 *    hora), com a data de cada etapa — o aviso, o lembrete, a equipa e a
 *    pergunta ao cliente. A reserva de cada etapa é um UPDATE «… IS NULL»: a
 *    mesma etapa nunca sai duas vezes, nem com duas passagens ao mesmo tempo;
 *  - `correrOsTrabalhosSemDia` (a passagem do assistente, de 10 em 10 min);
 *  - `respostaDoParceiroAoSemDia` (a ponte e o webhook, pela porta da d97): o
 *    parceiro respondeu ao aviso que não consegue contactar o cliente — a
 *    Vitória pergunta-lhe o dia e a hora;
 *  - `trabalhosSemDiaParaAMesa` (o «Precisa de si»).
 *
 * O parceiro recebe pelo canal dos avisos (o WhatsApp dos avisos, com o
 * interruptor «Avisar o profissional» e a vontade dele, e a app Pro).
 */

import type { Pool } from "mysql2/promise";
import { appendOrderHistory, assistentePode, ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool, interromperNumeroWhatsApp, saidasDoNumeroWhatsApp } from "./db";
import { eParaNaoContactar } from "./nao-contactar";
import { naJanelaDeContacto } from "./janela-de-contacto";
import {
  chaveDoSemDia,
  correrOSemDia,
  doMaisAntigo,
  naoConsegueContactar,
  obrigadoAoParceiroComAEquipa,
  obrigadoAoParceiroSemContacto,
  pedidosDoAvisoSemDia,
  semDiaDoTrabalho,
  type EtapaDoSemDia,
  type EtapasDoSemDia,
  type FaltaMarcar,
  type SemDia,
  type TrabalhoParaOSemDia,
} from "./trabalho-sem-dia";

export const SQL_DA_TABELA_DO_SEM_DIA = `CREATE TABLE IF NOT EXISTS trabalhosSemDia (
    negociacaoId        INT NOT NULL,
    falta               VARCHAR(5) NOT NULL,
    pedidoId            INT NOT NULL,
    providerId          INT NULL DEFAULT NULL,
    avisoEm             DATETIME NULL DEFAULT NULL,
    lembreteEm          DATETIME NULL DEFAULT NULL,
    equipaEm            DATETIME NULL DEFAULT NULL,
    clientePedidoEm     DATETIME NULL DEFAULT NULL,
    clientePerguntadoEm DATETIME NULL DEFAULT NULL,
    criadoEm            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (negociacaoId, falta),
    KEY idxPedido (pedidoId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let pronta = false;

async function base(): Promise<Pool> {
  const p = await getPool();
  if (!p) throw new Error("[trabalho-sem-dia] base de dados indisponível");
  if (!pronta) {
    await ensureNegociacoesTable();
    await ensureSimulatorOrdersTable();
    await p.execute(SQL_DA_TABELA_DO_SEM_DIA);
    pronta = true;
  }
  return p;
}

/** As colunas de cada etapa. */
const COLUNA: Record<EtapaDoSemDia, string> = {
  aviso: "avisoEm",
  lembrete: "lembreteEm",
  equipa: "equipaEm",
  cliente: "clientePerguntadoEm",
};

/** Os contratados por fazer, de pedidos vivos. */
async function contratadosPorFazer(pool: Pool): Promise<TrabalhoParaOSemDia[]> {
  const [rows] = (await pool.execute(
    `SELECT n.id AS negociacaoId, n.pedidoId, n.providerId, n.dataCombinada, n.contratadaEm, n.atribuidaEm, n.createdAt AS criadaEm,
            p.name AS parceiro, p.phone AS telefoneParceiro, p.email AS emailParceiro, p.whatsappAvisos,
            o.contactPhone AS telefoneCliente
       FROM negociacoes n
       JOIN providers p ON p.id = n.providerId
       JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.estado = 'acordada'
        AND n.execucaoEnviadaEm IS NULL AND n.confirmadoEm IS NULL AND n.pagoEm IS NULL AND n.feitoEm IS NULL
        AND (o.status IS NULL OR o.status NOT IN ('cancelado', 'concluido', 'arquivado', 'rejeitado'))
        AND o.anonimizadoEm IS NULL
      ORDER BY n.id ASC
      LIMIT 300`,
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.map((r) => ({
    negociacaoId: Number(r.negociacaoId),
    pedidoId: Number(r.pedidoId),
    providerId: Number(r.providerId),
    parceiro: String(r.parceiro ?? "o parceiro"),
    telefoneParceiro: (r.telefoneParceiro as string | null) ?? null,
    emailParceiro: (r.emailParceiro as string | null) ?? null,
    querWhatsApp: Number(r.whatsappAvisos ?? 0) === 1,
    telefoneCliente: (r.telefoneCliente as string | null) ?? null,
    dataCombinada: (r.dataCombinada as Date | string | null) ?? null,
    contratadaEm: (r.contratadaEm as Date | string | null) ?? null,
    atribuidaEm: (r.atribuidaEm as Date | string | null) ?? null,
    criadaEm: (r.criadaEm as Date | string | null) ?? null,
  }));
}

async function etapasDe(pool: Pool, chaves: string[]): Promise<Map<string, EtapasDoSemDia>> {
  const m = new Map<string, EtapasDoSemDia>();
  const ids = [...new Set(chaves.map((c) => Number(c.split(":")[0])).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return m;
  const [rows] = (await pool.execute(
    `SELECT * FROM trabalhosSemDia WHERE negociacaoId IN (${ids.map(() => "?").join(",")})`,
    ids,
  )) as [Array<Record<string, unknown>>, unknown];
  for (const r of rows) {
    m.set(chaveDoSemDia(Number(r.negociacaoId), String(r.falta) as FaltaMarcar), {
      avisoEm: (r.avisoEm as Date | null) ?? null,
      lembreteEm: (r.lembreteEm as Date | null) ?? null,
      equipaEm: (r.equipaEm as Date | null) ?? null,
      clientePedidoEm: (r.clientePedidoEm as Date | null) ?? null,
      clientePerguntadoEm: (r.clientePerguntadoEm as Date | null) ?? null,
    });
  }
  return m;
}

async function reservar(pool: Pool, t: TrabalhoParaOSemDia, falta: FaltaMarcar, etapa: EtapaDoSemDia): Promise<boolean> {
  await pool.execute("INSERT IGNORE INTO trabalhosSemDia (negociacaoId, falta, pedidoId, providerId) VALUES (?, ?, ?, ?)", [
    t.negociacaoId,
    falta,
    t.pedidoId,
    t.providerId,
  ]);
  const col = COLUNA[etapa];
  const [u] = (await pool.execute(
    `UPDATE trabalhosSemDia SET ${col} = UTC_TIMESTAMP() WHERE negociacaoId = ? AND falta = ? AND ${col} IS NULL`,
    [t.negociacaoId, falta],
  )) as [{ affectedRows?: number }, unknown];
  return Number(u.affectedRows ?? 0) === 1;
}

/** Ao parceiro: o WhatsApp dos avisos (o interruptor e a vontade dele) e a app Pro. Os canais por onde saiu. */
async function enviarAoParceiro(t: TrabalhoParaOSemDia, texto: string, titulo: string, pedidos: number[]): Promise<string[]> {
  const canais: string[] = [];
  const { enviarAvisoWhatsApp, telemovelParaWhatsApp } = await import("./whatsapp-cloud");
  const telemovel = telemovelParaWhatsApp(t.telefoneParceiro);
  if (telemovel && t.querWhatsApp && (await assistentePode("avisar_profissional").catch(() => false))) {
    if (await enviarAvisoWhatsApp(telemovel, texto).catch(() => false)) canais.push("whatsapp");
  }
  if (t.emailParceiro) {
    const { sendPushToUser } = await import("./webpush");
    const { urlDeAccao } = await import("./url-do-site");
    const n = await sendPushToUser(
      t.emailParceiro,
      {
        title: titulo,
        body: texto.replace(/^CLYON · /, ""),
        url: `${urlDeAccao().replace(/\/+$/, "")}/profissionais/painel`,
        tag: `marcar-o-dia-${pedidos.join("-")}`,
        pedidoId: pedidos[0],
        ...(pedidos.length === 1 ? { negociacaoId: t.negociacaoId } : {}),
        tipo: "marcar_o_dia",
      },
      "pro",
    ).catch(() => 0);
    if (n > 0) canais.push("app");
  }
  return canais;
}

/**
 * A PASSAGEM (de 10 em 10 minutos, na do assistente): os avisos, os lembretes,
 * a equipa ao 4.º dia e a pergunta ao cliente que o parceiro pediu. Nunca lança.
 */
export async function correrOsTrabalhosSemDia(agora: Date = new Date()): Promise<{ linhas: string[] }> {
  try {
    const pool = await base();
    return await correrOSemDia({
      agora,
      trabalhos: () => contratadosPorFazer(pool),
      etapas: (chaves) => etapasDe(pool, chaves),
      reservar: (t, falta, etapa) => reservar(pool, t, falta, etapa),
      enviarAoParceiro,
      passarAEquipa: async (t, motivo) => {
        if (String(t.telefoneCliente ?? "").replace(/\D/g, "").length >= 9) await interromperNumeroWhatsApp(String(t.telefoneCliente), motivo.slice(0, 480));
      },
      naoContactar: (tel) => eParaNaoContactar(tel, { pool }),
      enviarAoCliente: async (tel, texto) => (await import("./whatsapp-cloud")).enviarTextoWhatsApp(tel, texto),
      historico: async (pedidoId, linha) => {
        await appendOrderHistory(pedidoId, { type: "note", by: null, message: linha });
      },
    });
  } catch (e) {
    console.error("[trabalho-sem-dia] a passagem falhou:", e instanceof Error ? e.message : e);
    return { linhas: [] };
  }
}

/**
 * O PARCEIRO RESPONDEU AO AVISO: não consegue contactar o cliente? Só quando a
 * última mensagem que lhe saiu é o aviso (ou o lembrete) do dia. Marca a
 * pergunta ao cliente, que sai já (na janela) ou às 9h, pela passagem.
 * Devolve true se tratou. Nunca lança.
 */
export async function respostaDoParceiroAoSemDia(telefone: string, texto: string, opcoes: { interrompido?: boolean } = {}): Promise<boolean> {
  try {
    if (!naoConsegueContactar(texto)) return false;
    const [ultima] = (await saidasDoNumeroWhatsApp(telefone, 1)).slice(-1);
    const pedidos = pedidosDoAvisoSemDia(ultima?.texto);
    if (pedidos.length === 0) return false;
    const pool = await base();
    const [rows] = (await pool.execute(
      `SELECT t.negociacaoId, t.falta, t.pedidoId, t.equipaEm, t.clientePedidoEm, p.phone
         FROM trabalhosSemDia t
         JOIN negociacoes n ON n.id = t.negociacaoId
         JOIN providers p ON p.id = n.providerId
        WHERE t.pedidoId IN (${pedidos.map(() => "?").join(",")}) AND n.estado = 'acordada'`,
      pedidos,
    )) as [Array<Record<string, unknown>>, unknown];
    const noves = (x: unknown) => String(x ?? "").replace(/\D/g, "").slice(-9);
    // Só os trabalhos DESTE parceiro: o aviso foi-lhe a ele.
    const dele = rows.filter((r) => noves(r.phone) === noves(telefone) && noves(telefone).length === 9);
    if (dele.length === 0) return false;
    const comAEquipa = dele.filter((r) => r.equipaEm != null).map((r) => Number(r.pedidoId));
    const paraOCliente = dele.filter((r) => r.equipaEm == null && r.clientePedidoEm == null);
    for (const r of paraOCliente) {
      await pool.execute("UPDATE trabalhosSemDia SET clientePedidoEm = UTC_TIMESTAMP() WHERE negociacaoId = ? AND falta = ? AND clientePedidoEm IS NULL", [
        Number(r.negociacaoId),
        String(r.falta),
      ]);
    }
    const idsDoCliente = [...new Set(paraOCliente.map((r) => Number(r.pedidoId)))];
    const idsDaEquipa = [...new Set(comAEquipa)].filter((id) => !idsDoCliente.includes(id));
    for (const id of idsDoCliente) {
      await appendOrderHistory(id, { type: "note", by: null, message: "O parceiro respondeu que não consegue contactar o cliente: a Vitória pergunta-lhe o dia e a hora." }).catch(() => {});
    }
    for (const id of idsDaEquipa) {
      await appendOrderHistory(id, { type: "note", by: null, message: "O parceiro respondeu que não consegue contactar o cliente (a conversa já está com a equipa)." }).catch(() => {});
    }
    if (!opcoes.interrompido) {
      const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
      const texto =
        idsDaEquipa.length > 0 && idsDoCliente.length === 0
          ? obrigadoAoParceiroComAEquipa(idsDaEquipa)
          : obrigadoAoParceiroSemContacto(idsDoCliente.length > 0 ? idsDoCliente : [...new Set(dele.map((r) => Number(r.pedidoId)))]);
      await enviarAvisoWhatsApp(telefone, texto).catch(() => false);
    }
    // Na janela, a pergunta sai já; fora dela, a passagem manda-a às 9h.
    if (idsDoCliente.length > 0 && naJanelaDeContacto(new Date())) await correrOsTrabalhosSemDia().catch(() => {});
    return true;
  } catch (e) {
    console.error("[trabalho-sem-dia] não li a resposta do parceiro:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Os trabalhos sem dia, para a Mesa: só números (nada de pessoas), do mais antigo para o mais recente. */
export async function trabalhosSemDiaParaAMesa(agora: Date = new Date()): Promise<Array<{ pedidoId: number; negociacaoId: number; semDia: SemDia }>> {
  const pool = await base();
  const saida: Array<{ pedidoId: number; negociacaoId: number; semDia: SemDia }> = [];
  for (const t of await contratadosPorFazer(pool)) {
    const semDia = semDiaDoTrabalho(t, agora);
    if (semDia) saida.push({ pedidoId: t.pedidoId, negociacaoId: t.negociacaoId, semDia });
  }
  return saida.sort(doMaisAntigo);
}
