import {
  anunciarAEntrega,
  avisoDaEntrega,
  correrOsAvisosDaEquipa,
  eUmaEsperaNova,
  type AvisoAEquipa,
  type DependenciasDosAvisos,
  type PedidoPorDecidir,
  type ResultadoDosAvisos,
  type SeccaoDoAviso,
  type TipoDoAviso,
} from "./avisos-a-equipa";
import { doNossoLado, type ConversaParaOLado, type LinhaDoNossoLado } from "./do-nosso-lado";
import { instanteDaBase } from "./hora-de-lisboa";
import { modoDaOferta, resumoDaOferta } from "./oferta-clyon";
import { SECCOES_DA_MESA, seccoesGuardadas } from "./papel-do-painel";
import { urlDeAccao } from "./url-do-site";

/**
 * OS AVISOS À EQUIPA, NA BASE — d23, 10-11-2026. As regras estão em
 * `avisos-a-equipa.ts`; aqui vivem as leituras (as mesmas da Mesa), a tabela
 * que impede repetir, quem recebe, e o envio.
 *
 * QUEM RECEBE: o administrador, e as assistentes activas com a secção — a Mesa
 * para os pedidos, o WhatsApp para as conversas. Só quem ligou os avisos no
 * backoffice («Avisos no telemóvel»): a subscrição fica guardada com a chave
 * `equipa:<id da conta>`, e não pelo email, para nunca se misturar com a de
 * um cliente ou de um profissional com o mesmo endereço.
 */

/** A chave da subscrição de uma conta do backoffice. */
export const chaveDaEquipa = (colabId: number) => `equipa:${colabId}`;

let tabelaPronta = false;
async function pool() {
  const { getPool } = await import("./db");
  const p = await getPool();
  if (!p) throw new Error("DB not available");
  if (!tabelaPronta) {
    await p.execute(`
      CREATE TABLE IF NOT EXISTS avisosDaEquipa (
        id        INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        chave     VARCHAR(120) NOT NULL,
        tipo      VARCHAR(20)  NOT NULL,
        pedidoId  INT UNSIGNED NULL,
        telefone  VARCHAR(32)  NULL,
        seccao    VARCHAR(20)  NOT NULL,
        titulo    VARCHAR(200) NOT NULL,
        corpo     VARCHAR(500) NOT NULL,
        url       VARCHAR(300) NOT NULL,
        desdeMs   BIGINT       NOT NULL,
        enviadoMs BIGINT       NULL,
        comoFicou VARCHAR(12)  NULL,
        criadoEm  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_chave (chave),
        KEY idx_por_enviar (tipo, enviadoMs)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    tabelaPronta = true;
  }
  return p;
}

/* ── Quem recebe ────────────────────────────────────────────────────────── */

export type ContaDaEquipa = {
  id: number;
  isAdmin: number | null;
  funcao: string | null;
  active: number | null;
  seccoesJson: string | null;
};

/** O administrador recebe tudo; a assistente activa, o da secção que tem. */
export function recebeOAviso(c: ContaDaEquipa, seccao: SeccaoDoAviso): boolean {
  if (Number(c.active ?? 0) !== 1) return false;
  if (Number(c.isAdmin ?? 0) === 1) return true;
  if (c.funcao !== "assistente") return false;
  const tem = seccoesGuardadas(c.seccoesJson);
  return seccao === "whatsapp" ? tem.includes("whatsapp") : tem.some((s) => SECCOES_DA_MESA.includes(s));
}

/** As chaves `equipa:<id>` com avisos ligados que recebem esta secção. */
async function destinatarios(seccao: SeccaoDoAviso): Promise<string[]> {
  const p = await pool();
  let chaves: string[];
  try {
    const [linhas] = (await p.execute(
      "SELECT DISTINCT userEmail FROM pushSubscriptions WHERE userEmail LIKE 'equipa:%'",
    )) as [Array<{ userEmail: string }>, unknown];
    chaves = linhas.map((l) => l.userEmail);
  } catch {
    return []; // sem a tabela das subscrições, ninguém ligou os avisos
  }
  const ids = chaves.map((c) => Number(c.slice("equipa:".length))).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return [];
  const [contas] = (await p.execute(
    `SELECT id, isAdmin, funcao, active, seccoesJson FROM colaboradores WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  )) as [ContaDaEquipa[], unknown];
  return contas.filter((c) => recebeOAviso(c, seccao)).map((c) => chaveDaEquipa(Number(c.id)));
}

async function enviar(aviso: AvisoAEquipa): Promise<number> {
  const { sendPushToUser } = await import("./webpush");
  const para = await destinatarios(aviso.seccao);
  let url = aviso.url;
  try {
    url = new URL(aviso.url, urlDeAccao()).toString();
  } catch {
    /* fica o caminho */
  }
  await Promise.all(
    para.map((chave) =>
      sendPushToUser(
        chave,
        {
          title: aviso.titulo,
          body: aviso.corpo,
          url,
          // Um por pedido no ecrã de bloqueio: o mais recente substitui o anterior.
          tag: `equipa-${aviso.chave}`,
          pedidoId: aviso.pedidoId ?? undefined,
          tipo: `equipa_${aviso.tipo}`,
        },
        // As contas da equipa só têm navegadores; a app de nenhuma toca.
        "pro",
      ),
    ),
  );
  return para.length;
}

/* ── A tabela que impede repetir ────────────────────────────────────────── */

async function reservar(aviso: AvisoAEquipa, enviado: boolean): Promise<boolean> {
  const p = await pool();
  const [linhas] = (await p.execute("SELECT desdeMs FROM avisosDaEquipa WHERE chave = ? LIMIT 1", [aviso.chave])) as [
    Array<{ desdeMs: number | string }>,
    unknown,
  ];
  const agoraMs = Date.now();
  const valores = [
    aviso.tipo,
    aviso.pedidoId,
    aviso.telefone,
    aviso.seccao,
    aviso.titulo.slice(0, 200),
    aviso.corpo.slice(0, 500),
    aviso.url.slice(0, 300),
    aviso.desde.getTime(),
    enviado ? agoraMs : null,
    enviado ? "enviado" : null,
  ];
  if (linhas.length === 0) {
    try {
      await p.execute(
        `INSERT INTO avisosDaEquipa (chave, tipo, pedidoId, telefone, seccao, titulo, corpo, url, desdeMs, enviadoMs, comoFicou)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [aviso.chave, ...valores],
      );
      return true;
    } catch (e) {
      // Outra passagem guardou-o no mesmo instante: é dela.
      if ((e as { code?: string })?.code === "ER_DUP_ENTRY") return false;
      throw e;
    }
  }
  if (!eUmaEsperaNova(new Date(Number(linhas[0].desdeMs)), aviso.desde)) return false;
  const [r] = (await p.execute(
    `UPDATE avisosDaEquipa
        SET tipo = ?, pedidoId = ?, telefone = ?, seccao = ?, titulo = ?, corpo = ?, url = ?, desdeMs = ?, enviadoMs = ?, comoFicou = ?
      WHERE chave = ? AND desdeMs = ?`,
    [...valores, aviso.chave, Number(linhas[0].desdeMs)],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}

async function entregasPorEnviar(): Promise<AvisoAEquipa[]> {
  const p = await pool();
  const [linhas] = (await p.execute(
    `SELECT chave, tipo, pedidoId, telefone, seccao, titulo, corpo, url, desdeMs
       FROM avisosDaEquipa WHERE tipo = 'entregue' AND enviadoMs IS NULL AND comoFicou IS NULL
      ORDER BY desdeMs ASC LIMIT 50`,
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => ({
    chave: String(l.chave),
    tipo: String(l.tipo) as TipoDoAviso,
    pedidoId: l.pedidoId == null ? null : Number(l.pedidoId),
    telefone: l.telefone == null ? null : String(l.telefone),
    seccao: String(l.seccao) as SeccaoDoAviso,
    titulo: String(l.titulo),
    corpo: String(l.corpo),
    url: String(l.url),
    desde: new Date(Number(l.desdeMs)),
  }));
}

async function marcarEnviado(chave: string, como: "enviado" | "dispensado"): Promise<void> {
  const p = await pool();
  await p.execute("UPDATE avisosDaEquipa SET enviadoMs = ?, comoFicou = ? WHERE chave = ?", [
    como === "enviado" ? Date.now() : null,
    como,
    chave,
  ]);
}

/* ── As leituras: as mesmas da Mesa ─────────────────────────────────────── */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * O «Do nosso lado» pela conta do cartão da Mesa (`doNossoLado`), com as
 * mesmas três leituras que o cartão recebe: as negociações da Mesa (as 60
 * mais recentes, como o ecrã normal), os Trabalhos CLYON (os 150 mais
 * recentes) e a mesa das conversas. Passa tudo por JSON, como o painel o
 * recebe: as datas chegam-lhe em texto, e é com texto que a conta é feita.
 */
async function lerDoNossoLado(agora: Date): Promise<LinhaDoNossoLado[]> {
  const db = await import("./db");
  const { mesaComOTelemovelWhatsApp } = await import("./mesa-das-conversas-na-base");
  const [pedidos, ofertas, conversas] = await Promise.all([
    db.pedidosComNegociacoes(60),
    db.ofertasClyon(150),
    mesaComOTelemovelWhatsApp()
      .then((m) =>
        m.linhas.map(
          (l): ConversaParaOLado => ({
            telefone: l.telefone,
            estado: l.estado,
            haSegundos: l.haSegundos,
            pedido: l.pedido ? { id: l.pedido.id, fechado: l.pedido.fechado } : null,
          }),
        ),
      )
      // Sem a mesa das conversas, o grupo delas fica vazio — como no cartão.
      .catch((e) => {
        console.error("[avisos-a-equipa] a mesa das conversas não se leu:", e instanceof Error ? e.message : e);
        return null;
      }),
  ]);
  const trabalhosClyon = ofertas.map((o) => {
    const negociacoes = o.negociacoes.map((n) => ({
      negociacaoId: n.negociacaoId,
      providerId: n.providerId,
      profissional: n.profissional,
      estado: n.estado,
      modo: modoDaOferta(n.modo),
      dataCombinada: iso(n.dataCombinada),
      atribuidaEm: iso(n.atribuidaEm),
      actualizadaEm: iso(n.actualizadaEm),
      execucaoEnviadaEm: iso(n.execucaoEnviadaEm),
      confirmadoEm: iso(n.confirmadoEm),
      pagoEm: iso(n.pagoEm),
    }));
    return {
      pedidoId: o.pedidoId,
      estadoDoPedido: o.estadoDoPedido,
      dataAgendada: iso(o.dataAgendada),
      propostaEnviadaEm: iso(o.propostaEnviadaEm),
      negociacoes,
      resumo: resumoDaOferta(negociacoes, o.estadoDoPedido),
    };
  });
  const grupos = doNossoLado({
    conversas,
    pedidos: JSON.parse(JSON.stringify(pedidos)),
    trabalhosClyon,
    agora,
  });
  return grupos.flatMap((g) => g.linhas);
}

/** O «Por decidir»: os pedidos sem negociações e por fechar — a lista da Mesa (`pedidosPorPromover`). */
async function lerPorDecidir(): Promise<PedidoPorDecidir[]> {
  const db = await import("./db");
  const pedidos = await db.pedidosPorPromover(100);
  return pedidos.map((p) => ({ id: Number(p.id), criadoEm: instanteDaBase(p.createdAt as unknown as string | Date) }));
}

function dependencias(agora: Date): DependenciasDosAvisos {
  return {
    lerDoNossoLado: () => lerDoNossoLado(agora),
    lerPorDecidir,
    reservar,
    entregasPorEnviar,
    aindaEntregue: async (telefone) => (await import("./db")).numeroInterrompidoWhatsApp(telefone),
    marcarEnviado,
    enviar,
  };
}

/** A passagem do cron. Nunca lança. */
export async function correrOsAvisosDaEquipaNaBase(agora: Date = new Date()): Promise<ResultadoDosAvisos> {
  return correrOsAvisosDaEquipa(dependencias(agora), agora);
}

/**
 * A VITÓRIA ENTREGOU A CONVERSA A UMA PESSOA — avisa a equipa do WhatsApp,
 * com o n.º do pedido em curso desse número, ou o contacto. Nunca lança: a
 * entrega já está feita, e um aviso que falhe não a pode desfazer.
 */
export async function avisarAEquipaDaEntrega(telefone: string, motivo: string | null): Promise<void> {
  try {
    // O pedido em curso mais recente deste número (os fechados não contam).
    const { pedidosDoTelefone } = await import("./whatsapp-negociacao");
    const pedidos = await pedidosDoTelefone(telefone).catch(() => [] as number[]);
    const agora = new Date();
    await anunciarAEntrega(
      { reservar, enviar },
      avisoDaEntrega({ telefone, pedidoId: pedidos[0] ?? null, motivo, agora }),
      agora,
    );
  } catch (e) {
    console.error("[avisos-a-equipa] entrega:", e instanceof Error ? e.message : e);
  }
}
