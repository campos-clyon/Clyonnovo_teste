import {
  accaoDoRespondido,
  contactosParaOAviso,
  entradaDoFormulario,
  entradaDoSuporte,
  entradaDoWhatsApp,
  ESTADO_DO_LEAD_RESPONDIDO,
  medirACaixa,
  nove,
  quemPrecisaDePrimeiraResposta,
  juntarContactos,
  type Contacto,
  type ContactoParaOAviso,
  type EntradaDoContacto,
  type FormularioParaACaixa,
  type MarcaDeRespondido,
  type MedidaDaCaixa,
  type PrecisaDePrimeiraResposta,
  type SuporteParaACaixa,
} from "./caixa-dos-contactos";
import { diaEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { nomeDeTeste } from "./aviso-aos-profissionais";

/**
 * A CAIXA DOS CONTACTOS, A PARTIR DA BASE — d85, fase 1 (22-11-2026).
 *
 * Lê o que cada canal já guarda — a mesa das conversas do WhatsApp (com o
 * telemóvel e os «Já respondi»), os formulários (`leads`) e as «Suporte
 * CLYON» da app — e passa tudo pelas regras de `caixa-dos-contactos.ts`.
 *
 * Duas tabelas pequenas, novas, que nunca se apagam:
 *   · `contactosRespondidos` — quem marcou «Respondido» na caixa, e quando
 *     (uma linha por entrada: «wa:…», «lead:…», «sup:…»);
 *   · `contactosPorDia` — os números do topo, um registo por dia de Lisboa,
 *     para se comparar daqui a 14 dias (o último valor do dia e o pico).
 *
 * NADA SE APAGA AQUI: nem as conversas, nem os leads, nem as marcas. A purga e
 * a retenção de sempre continuam a ser quem decide o que sai.
 */

type Linha = Record<string, unknown>;

let tabelasProntas = false;
async function pool() {
  const { getPool } = await import("./db");
  const p = await getPool();
  if (!p) throw new Error("DB not available");
  if (!tabelasProntas) {
    await p.execute(`
      CREATE TABLE IF NOT EXISTS contactosRespondidos (
        ref      VARCHAR(40)  NOT NULL PRIMARY KEY,
        porQuem  VARCHAR(120) NULL,
        em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_em (em)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await p.execute(`
      CREATE TABLE IF NOT EXISTS contactosPorDia (
        dia             DATE     NOT NULL PRIMARY KEY,
        porResponder    INT      NOT NULL DEFAULT 0,
        maisDeDuasHoras INT      NOT NULL DEFAULT 0,
        maisDeTresDias  INT      NOT NULL DEFAULT 0,
        total           INT      NOT NULL DEFAULT 0,
        picoDuasHoras   INT      NOT NULL DEFAULT 0,
        picoPorResponder INT     NOT NULL DEFAULT 0,
        actualizadoEm   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    tabelasProntas = true;
  }
  return p;
}

const numero = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const texto = (v: unknown): string | null => (v == null ? null : String(v));

/* ── As leituras ────────────────────────────────────────────────────────── */

/** As marcas «Respondido» da caixa, pela ref. */
async function lerAsMarcas(): Promise<Map<string, MarcaDeRespondido>> {
  const p = await pool();
  const [l] = (await p.execute(
    `SELECT ref, porQuem, TIMESTAMPDIFF(SECOND, em, NOW()) AS haS
       FROM contactosRespondidos WHERE em > NOW() - INTERVAL 180 DAY`,
  )) as [Linha[], unknown];
  const mapa = new Map<string, MarcaDeRespondido>();
  for (const x of l) mapa.set(String(x.ref), { porQuem: texto(x.porQuem), haSegundos: numero(x.haS) });
  return mapa;
}

/** Os telefones das contas de teste dos profissionais (`contaDeTeste`), pelos 9 dígitos. */
async function telefonesDeTeste(): Promise<Set<string>> {
  const { getPool, ensureProvidersSchema } = await import("./db");
  await ensureProvidersSchema();
  const p = await getPool();
  if (!p) return new Set();
  const [l] = (await p.execute(
    `SELECT RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', ''), 9) AS chave
       FROM providers WHERE COALESCE(contaDeTeste, 0) = 1 AND phone IS NOT NULL AND phone <> ''`,
  )) as [Linha[], unknown];
  return new Set(l.map((x) => String(x.chave ?? "")).filter((c) => c.length === 9));
}

/** Os formulários: os por responder, e os dos últimos 60 dias. */
async function lerOsFormularios(): Promise<FormularioParaACaixa[]> {
  const { getPool, ensureLeadsExtended } = await import("./db");
  await ensureLeadsExtended();
  const p = await getPool();
  if (!p) return [];
  const [l] = (await p.execute(
    `SELECT id, nome, telefone, email, status, tipoServico, mensagem, origem,
            TIMESTAMPDIFF(SECOND, createdAt, NOW()) AS haS,
            TIMESTAMPDIFF(SECOND, updatedAt, NOW()) AS mudadoHaS
       FROM leads
      WHERE status = 'novo' OR createdAt > NOW() - INTERVAL 60 DAY
      ORDER BY id DESC LIMIT 600`,
  )) as [Linha[], unknown];
  return l.map((x) => ({
    id: Number(x.id),
    nome: texto(x.nome),
    telefone: texto(x.telefone),
    email: texto(x.email),
    status: texto(x.status),
    tipoServico: texto(x.tipoServico),
    mensagem: texto(x.mensagem),
    origem: texto(x.origem),
    haSegundos: numero(x.haS),
    mudadoHaSegundos: numero(x.mudadoHaS),
  }));
}

/** As «Suporte CLYON» com mensagens, com quem escreveu por último e desde quando o cliente espera. */
async function lerOsSuportes(): Promise<SuporteParaACaixa[]> {
  const { getPool, ensureUsersSchema } = await import("./db");
  await ensureUsersSchema();
  const p = await getPool();
  if (!p) return [];
  try {
    const [l] = (await p.execute(
      `SELECT c.id, c.estado, c.atendidaPor,
              TIMESTAMPDIFF(SECOND, c.ultimaMensagemEm, NOW()) AS ultimaHaS,
              (SELECT m.autor FROM mensagensDaConversa m WHERE m.conversaId = c.id ORDER BY m.id DESC LIMIT 1) AS ultimoAutor,
              (SELECT m.texto FROM mensagensDaConversa m WHERE m.conversaId = c.id ORDER BY m.id DESC LIMIT 1) AS ultimaMensagem,
              (SELECT TIMESTAMPDIFF(SECOND, MIN(m.criadaEm), NOW()) FROM mensagensDaConversa m
                WHERE m.conversaId = c.id AND m.autor = 'cliente'
                  AND m.id > COALESCE((SELECT MAX(m2.id) FROM mensagensDaConversa m2
                                        WHERE m2.conversaId = c.id AND m2.autor <> 'cliente'), 0)) AS esperaHaS,
              u.name AS nome, u.email AS email, u.phone AS telefone, (u.id IS NULL OR u.deletedAt IS NOT NULL) AS apagada
         FROM conversas c
         LEFT JOIN users u ON u.id = c.clienteContaId
        WHERE c.tipo = 'suporte_cliente' AND c.ultimaMensagemEm IS NOT NULL
        ORDER BY c.ultimaMensagemEm DESC
        LIMIT 300`,
    )) as [Linha[], unknown];
    return l.map((x) => ({
      id: Number(x.id),
      estado: texto(x.estado),
      atendidaPor: texto(x.atendidaPor),
      ultimoAutor: texto(x.ultimoAutor),
      ultimaMensagem: texto(x.ultimaMensagem),
      ultimaHaSegundos: numero(x.ultimaHaS),
      esperaHaSegundos: numero(x.esperaHaS),
      nome: texto(x.nome),
      email: texto(x.email),
      telefone: texto(x.telefone),
      contaApagada: Number(x.apagada) === 1,
    }));
  } catch (e) {
    // Antes da primeira conversa as tabelas ainda não existem: não há suportes.
    if ((e as { code?: string })?.code === "ER_NO_SUCH_TABLE") return [];
    throw e;
  }
}

/**
 * O EMAIL GERAL@ — por ligar (`EMAIL_GERAL_LIGADO`). Ligá-lo é uma decisão do
 * CEO e do dono (precisa das credenciais da caixa, ou de um encaminhamento
 * para um endereço de entrada). Quando houver, as mensagens entram aqui como
 * entradas do canal «email», com as mesmas regras da Suporte CLYON.
 */
async function lerOsEmailsDoGeral(): Promise<EntradaDoContacto[]> {
  return [];
}

/** Todas as entradas de todos os canais. Um canal que falhe fica vazio e não cala os outros. */
async function lerAsEntradas(agora: Date): Promise<{ entradas: EntradaDoContacto[]; falhas: string[] }> {
  const db = await import("./db");
  const { mesaComOTelemovelWhatsApp } = await import("./mesa-das-conversas-na-base");
  const falhas: string[] = [];
  const falhou = (onde: string) => (e: unknown) => {
    falhas.push(onde);
    console.error(`[caixa-dos-contactos] ${onde}:`, e instanceof Error ? e.message : e);
    return null;
  };
  const [mesa, respondidas, teste, formularios, suportes, marcas, emails] = await Promise.all([
    mesaComOTelemovelWhatsApp().catch(falhou("WhatsApp")),
    db.respondidasWhatsApp().catch(() => new Map<string, { haSegundos: number | null; quando: string }>()),
    telefonesDeTeste().catch(() => new Set<string>()),
    lerOsFormularios().catch(falhou("formulários")),
    lerOsSuportes().catch(falhou("Suporte da app")),
    lerAsMarcas().catch(() => new Map<string, MarcaDeRespondido>()),
    lerOsEmailsDoGeral().catch(() => []),
  ]);
  const entradas: EntradaDoContacto[] = [];
  for (const l of mesa?.linhas ?? []) {
    const chave = nove(l.telefone);
    entradas.push(
      entradaDoWhatsApp(l, agora, {
        deTeste: teste.has(chave) || (l.profissional != null && nomeDeTeste(l.profissional.nome)),
        respondidaHaS: respondidas.get(chave)?.haSegundos ?? null,
        marca: marcas.get(`wa:${String(l.telefone).replace(/\D/g, "")}`) ?? null,
      }),
    );
  }
  for (const f of formularios ?? []) entradas.push(entradaDoFormulario(f, agora, { marca: marcas.get(`lead:${f.id}`) ?? null }));
  for (const s of suportes ?? []) entradas.push(entradaDoSuporte(s, agora, { marca: marcas.get(`sup:${s.id}`) ?? null }));
  entradas.push(...emails);
  return { entradas, falhas };
}

/* ── A caixa ────────────────────────────────────────────────────────────── */

export type CaixaDosContactos = {
  contactos: Contacto[];
  medida: MedidaDaCaixa;
  /** Os canais que não se leram desta vez. */
  falhas: string[];
  lidaEm: Date;
};

let emCache: CaixaDosContactos | null = null;

/**
 * A caixa inteira. `gravarODia` grava os números do topo no registo do dia
 * (o cron dos avisos, de 10 em 10 min, e quem abre a secção). `maxIdadeMs`
 * aceita a última leitura se for recente — para o selo do menu, que pergunta
 * de dois em dois minutos por cada pessoa com o backoffice aberto.
 */
export async function caixaDosContactos(
  opcoes: { agora?: Date; gravarODia?: boolean; maxIdadeMs?: number } = {},
): Promise<CaixaDosContactos> {
  const agora = opcoes.agora ?? new Date();
  if (opcoes.maxIdadeMs && emCache && agora.getTime() - emCache.lidaEm.getTime() < opcoes.maxIdadeMs) return emCache;
  const { entradas, falhas } = await lerAsEntradas(agora);
  const contactos = juntarContactos(entradas, agora);
  const medida = medirACaixa(contactos);
  const caixa = { contactos, medida, falhas, lidaEm: agora };
  emCache = caixa;
  // Só se grava o dia com todos os canais lidos: um canal em falta dava um número falso.
  if (opcoes.gravarODia && falhas.length === 0) {
    await gravarODia(medida, agora).catch((e) =>
      console.error("[caixa-dos-contactos] o dia não se gravou:", e instanceof Error ? e.message : e),
    );
  }
  return caixa;
}

/** Os contactos por responder — o selo do menu. Pela leitura dos últimos 2 minutos. */
export async function contactosPorResponderParaOSelo(): Promise<number> {
  return (await caixaDosContactos({ maxIdadeMs: 120_000 })).medida.porResponder;
}

/** Os da caixa que entram nos avisos à equipa (os do WhatsApp ficam no «Do nosso lado»). */
export function contactosParaOAvisoNaBase(caixa: CaixaDosContactos, agora: Date): ContactoParaOAviso[] {
  return contactosParaOAviso(caixa.contactos, agora);
}

/**
 * O PONTO DE ENCAIXE DO ACOLHIMENTO (para o I&D, depois da fase 0): quem
 * precisa de uma primeira resposta agora. Só lê.
 */
export async function quemPrecisaDePrimeiraRespostaNaBase(agora: Date = new Date()): Promise<PrecisaDePrimeiraResposta[]> {
  return quemPrecisaDePrimeiraResposta((await caixaDosContactos({ agora, maxIdadeMs: 60_000 })).contactos, agora);
}

/* ── O registo do dia ───────────────────────────────────────────────────── */

async function gravarODia(m: MedidaDaCaixa, agora: Date): Promise<void> {
  const p = await pool();
  await p.execute(
    `INSERT INTO contactosPorDia (dia, porResponder, maisDeDuasHoras, maisDeTresDias, total, picoDuasHoras, picoPorResponder)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE porResponder = VALUES(porResponder), maisDeDuasHoras = VALUES(maisDeDuasHoras),
       maisDeTresDias = VALUES(maisDeTresDias), total = VALUES(total),
       picoDuasHoras = GREATEST(picoDuasHoras, VALUES(picoDuasHoras)),
       picoPorResponder = GREATEST(picoPorResponder, VALUES(picoPorResponder))`,
    [diaEmLisboa(agora), m.porResponder, m.maisDeDuasHoras, m.maisDeTresDias, m.total, m.maisDeDuasHoras, m.porResponder],
  );
}

export type DiaDaCaixa = {
  dia: string;
  porResponder: number;
  maisDeDuasHoras: number;
  maisDeTresDias: number;
  picoDuasHoras: number;
  picoPorResponder: number;
};

/** Os últimos `dias` dias registados, do mais recente para o mais antigo. */
export async function diasDaCaixa(dias = 14, agora: Date = new Date()): Promise<DiaDaCaixa[]> {
  const p = await pool();
  const desde = somarDiasAoDia(diaEmLisboa(agora), -Math.max(1, Math.min(90, Math.floor(dias))));
  const [l] = (await p.execute(
    `SELECT DATE_FORMAT(dia, '%Y-%m-%d') AS dia, porResponder, maisDeDuasHoras, maisDeTresDias, picoDuasHoras, picoPorResponder
       FROM contactosPorDia WHERE dia > ? ORDER BY dia DESC`,
    [desde],
  )) as [Linha[], unknown];
  return l.map((x) => ({
    dia: String(x.dia),
    porResponder: Number(x.porResponder ?? 0),
    maisDeDuasHoras: Number(x.maisDeDuasHoras ?? 0),
    maisDeTresDias: Number(x.maisDeTresDias ?? 0),
    picoDuasHoras: Number(x.picoDuasHoras ?? 0),
    picoPorResponder: Number(x.picoPorResponder ?? 0),
  }));
}

/* ── «Respondido» ───────────────────────────────────────────────────────── */

/**
 * MARCAR «RESPONDIDO» — em cada canal, e na caixa. A pessoa respondeu pelo
 * WhatsApp, pelo telefone ou pelo email, e diz aqui que respondeu:
 *   · WhatsApp → o «Já respondi» da mesa (a Vitória não responde por cima nas
 *     12 h seguintes, como no botão da mesa);
 *   · formulário → o lead passa a «contactado» (`updateLeadStatus`), se ainda
 *     estava «novo» — um fechado ou perdido fica como está;
 *   · Suporte da app → lido pela equipa.
 * E grava-se quem e quando (`contactosRespondidos`). Devolve as refs mudadas.
 */
export async function marcarRespondido(refs: readonly string[], porQuem: string | null): Promise<string[]> {
  const db = await import("./db");
  const p = await pool();
  const feitas: string[] = [];
  for (const ref of [...new Set(refs)].slice(0, 20)) {
    const accao = accaoDoRespondido(ref);
    if (!accao) continue;
    if (accao.canal === "whatsapp") {
      await db.marcarRespondidaWhatsApp(accao.telefone, true);
    } else if (accao.canal === "formulario") {
      const [l] = (await p.execute("SELECT status FROM leads WHERE id = ? LIMIT 1", [accao.leadId])) as [Linha[], unknown];
      if (!l[0]) continue;
      if (String(l[0].status ?? "novo") === "novo") await db.updateLeadStatus(accao.leadId, ESTADO_DO_LEAD_RESPONDIDO);
    } else {
      const { marcarLida } = await import("./conversas-na-base");
      await marcarLida(accao.conversaId, "equipa");
    }
    await p.execute(
      `INSERT INTO contactosRespondidos (ref, porQuem, em) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE porQuem = VALUES(porQuem), em = NOW()`,
      [ref, porQuem ? porQuem.slice(0, 120) : null],
    );
    feitas.push(ref);
  }
  emCache = null;
  return feitas;
}
