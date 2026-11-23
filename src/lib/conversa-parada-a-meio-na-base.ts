/**
 * A CONVERSA PARADA A MEIO, NA BASE — d93, ponto 1 (CEO e dono, 23-11-2026).
 *
 * As regras puras estão em `conversa-parada-a-meio.ts`. Aqui: a tabela
 * `conversasParadas` (uma linha por número, com quando saiu a pergunta sem
 * resposta e quando saiu cada lembrete — é por ela que os lembretes contam na
 * uma-por-dia comum, `FONTES_DAS_MENSAGENS_AUTOMATICAS`), e o passo de cada
 * conversa, chamado pela passagem das recolhas paradas (`recolhas-paradas.ts`,
 * de 10 em 10 minutos) quando não há a mensagem gentil nem o salto a fazer.
 *
 * Uma resposta do cliente recomeça o ciclo (a pergunta seguinte é outra); o
 * fecho apaga o rascunho. As linhas com mais de 8 dias saem sozinhas.
 */

import type { Pool } from "mysql2/promise";
import { getPool } from "./db";
import { mesmoTelefoneEstrito } from "./validade-do-orcamento";
import {
  proximoPassoDaConversaParada,
  ROTULO_DO_PASSO,
  textoDaConversaParada,
  type CicloDaConversaParada,
  type PassoDaConversaParada,
} from "./conversa-parada-a-meio";
import type { DadosDaRecolha, PassoDaRecolha } from "./whatsapp-recolha";

export const SQL_DA_TABELA_DAS_CONVERSAS_PARADAS = `CREATE TABLE IF NOT EXISTS conversasParadas (
    telefone     VARCHAR(32) NOT NULL PRIMARY KEY,
    desde        DATETIME NOT NULL,
    lembrete1Em  DATETIME NULL DEFAULT NULL,
    lembrete2Em  DATETIME NULL DEFAULT NULL,
    lembrete3Em  DATETIME NULL DEFAULT NULL,
    fechadoEm    DATETIME NULL DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let pronta = false;

async function tabela(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[conversa-parada] base de dados indisponível");
  if (!pronta) {
    await pool.execute(SQL_DA_TABELA_DAS_CONVERSAS_PARADAS);
    pronta = true;
  }
  return pool;
}

const COLUNA: Record<PassoDaConversaParada, string> = {
  lembrete1: "lembrete1Em",
  lembrete2: "lembrete2Em",
  lembrete3: "lembrete3Em",
  fechar: "fechadoEm",
};

type MensagemDoFio = { direccao: string; texto: string; haSegundos: number | null };

const soDigitos = (t: string) => t.replace(/\D/g, "");

/** Quando foi, pelo «há quantos segundos» da base. */
const quando = (m: MensagemDoFio, agora: Date) => new Date(agora.getTime() - (m.haSegundos ?? 0) * 1000);

/**
 * O PASSO DESTA CONVERSA, se o houver: envia o lembrete (ou o fecho) e devolve
 * a linha para o registo da passagem; null quando não há nada a fazer. Só a
 * meio da recolha (nem no serviço, nem no resumo — esse regista-se aos 30
 * minutos), com a última mensagem da Vitória (nunca da equipa) e o cliente
 * calado desde então.
 */
export async function lembrarAConversaParada(
  telefone: string,
  estado: { passo: PassoDaRecolha; dados: DadosDaRecolha },
  fio: ReadonlyArray<MensagemDoFio>,
  agora: Date = new Date(),
): Promise<string | null> {
  if (estado.passo === "servico" || estado.passo === "confirmar") return null;
  if (fio.length === 0) return null;
  const ultima = fio[fio.length - 1];
  const { eDaEquipa } = await import("./rajada-do-whatsapp");
  if (ultima.direccao !== "out" || ultima.haSegundos == null || eDaEquipa(ultima.texto)) return null;

  const pool = await tabela();
  await pool.execute("DELETE FROM conversasParadas WHERE COALESCE(fechadoEm, desde) < UTC_TIMESTAMP() - INTERVAL 8 DAY").catch(() => {});
  const digitos = soDigitos(telefone);
  const [rows] = (await pool.execute(
    "SELECT telefone, desde, lembrete1Em, lembrete2Em, lembrete3Em, fechadoEm FROM conversasParadas WHERE RIGHT(telefone, 9) = RIGHT(?, 9) LIMIT 5",
    [digitos],
  )) as [Array<Record<string, unknown>>, unknown];
  const { instanteDaBase } = await import("./hora-de-lisboa");
  const linha = rows.find((r) => mesmoTelefoneEstrito(String(r.telefone ?? ""), telefone));
  const d = (v: unknown) => instanteDaBase(v as string | Date | null);
  let ciclo: CicloDaConversaParada | null = linha
    ? {
        desde: d(linha.desde) ?? agora,
        lembrete1Em: d(linha.lembrete1Em),
        lembrete2Em: d(linha.lembrete2Em),
        lembrete3Em: d(linha.lembrete3Em),
        fechadoEm: d(linha.fechadoEm),
      }
    : null;

  // O cliente escreveu depois do início deste ciclo: a pergunta de agora é outra — ciclo novo, a partir dela.
  const ultimaDele = [...fio].reverse().find((m) => m.direccao === "in");
  const respondeuDepois = ciclo != null && ultimaDele != null && quando(ultimaDele, agora).getTime() > ciclo.desde.getTime();
  if (!ciclo || respondeuDepois) {
    const desde = quando(ultima, agora);
    await pool.execute(
      `INSERT INTO conversasParadas (telefone, desde) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE desde = VALUES(desde), lembrete1Em = NULL, lembrete2Em = NULL, lembrete3Em = NULL, fechadoEm = NULL`,
      [String(linha?.telefone ?? digitos), desde],
    );
    ciclo = { desde };
  }
  const passo = proximoPassoDaConversaParada(ciclo, agora);
  if (!passo) return null;

  // A uma-por-dia comum (d85) — e o «não contactar» (d93). Sem saber, não se envia.
  const { jaSaiuHojeUmaMensagemAutomatica } = await import("./uma-mensagem-automatica-por-dia");
  if (await jaSaiuHojeUmaMensagemAutomatica({ telefone }, agora, { pool }).catch(() => true)) return null;

  const coluna = COLUNA[passo];
  const chave = String(linha?.telefone ?? digitos);
  const [reserva] = (await pool.execute(
    `UPDATE conversasParadas SET ${coluna} = UTC_TIMESTAMP() WHERE telefone = ? AND ${coluna} IS NULL AND fechadoEm IS NULL`,
    [chave],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return null;

  const { oQueJaEstaAnotado, perguntaParaContinuar } = await import("./whatsapp-recolha");
  const { primeiroNome } = await import("./mensagem-whatsapp");
  const { servicoEmPalavras } = await import("./servico-em-palavras");
  const servico = estado.dados.serviceType ? servicoEmPalavras(estado.dados.serviceType).toLowerCase() : null;
  const texto = textoDaConversaParada(passo, {
    nome: primeiroNome(estado.dados.contactName ?? null),
    servico: servico && servico !== "serviço" ? servico : null,
    anotado: oQueJaEstaAnotado(estado.dados),
    pergunta: perguntaParaContinuar(estado.passo, estado.dados),
  });
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
  const saiu = await enviarTextoWhatsApp(telefone, texto).catch(() => false);
  if (!saiu) {
    await pool.execute(`UPDATE conversasParadas SET ${coluna} = NULL WHERE telefone = ?`, [chave]).catch(() => {});
    return null;
  }
  if (passo === "fechar") {
    // O rascunho sai: a conversa fechou sem pedido, e não se guarda a morada de ninguém sem razão.
    const { apagarRecolhaWhatsApp } = await import("./db");
    await apagarRecolhaWhatsApp(telefone).catch(() => {});
  }
  return `${telefone}: ${ROTULO_DO_PASSO[passo]} (d93)`;
}
