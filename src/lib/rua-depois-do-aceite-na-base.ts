import { appendOrderHistory, ensureNegociacoesTable, ensureSimulatorOrdersTable, getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import {
  faltaARua,
  lerARua,
  oQueFazerComARua,
  PEDE_A_RUA_DESDE,
  ruaAnotada,
  ruaJaDitaNaConversa,
  type RuaLida,
} from "./rua-depois-do-aceite";

/*
 * A RUA DEPOIS DO ACEITE, NA BASE — 17-11-2026 (decisão d69). As portas de
 * `rua-depois-do-aceite.ts`: as colunas do pedido, a marca «falta a rua», a
 * pergunta uma vez, a resposta gravada e a passagem à equipa às 2 h.
 *
 * Colunas novas no pedido, só a acrescentar (nada se apaga):
 *   · `ruaEmFalta`   — 1 quando o pedido foi registado sem a rua; 0 quando chegou;
 *   · `ruaPedidaEm`  — quando a Vitória a pediu (uma vez só);
 *   · `ruaRecebidaEm`— quando a resposta entrou no pedido;
 *   · `ruaPassadaEm` — quando passou à equipa (sem resposta, ou sem poder perguntar).
 *
 * A rua entra em `address` (e o andar em `floor`): é o campo que a API já manda
 * ao parceiro contratado (`vistaParaOEstado`), por isso chega-lhe sem mexer na app.
 */

const ABERTO = "(o.status IS NULL OR o.status NOT IN ('cancelado', 'concluido', 'arquivado', 'rejeitado'))";

let colunasDaRua = false;

export async function ensureColunasDaRua(): Promise<void> {
  if (colunasDaRua) return;
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return;
  let criou = false;
  for (const sql of [
    "ALTER TABLE simulatorOrders ADD COLUMN ruaEmFalta TINYINT(1) NULL DEFAULT NULL",
    "ALTER TABLE simulatorOrders ADD COLUMN ruaPedidaEm DATETIME NULL DEFAULT NULL",
    "ALTER TABLE simulatorOrders ADD COLUMN ruaRecebidaEm DATETIME NULL DEFAULT NULL",
    "ALTER TABLE simulatorOrders ADD COLUMN ruaPassadaEm DATETIME NULL DEFAULT NULL",
  ]) {
    try {
      await pool.execute(sql);
      criou = true;
    } catch (e) {
      // Já existe: é o caso de todos os arranques menos o primeiro.
      if (!/Duplicate column/i.test(e instanceof Error ? e.message : String(e))) throw e;
    }
  }
  /*
   * Os pedidos abertos que já existem e ficaram só com a zona ganham a marca,
   * UMA vez (quando as colunas nascem): o selo mostra-os à equipa. A pergunta
   * ao cliente só sai para os aceites a partir de `PEDE_A_RUA_DESDE`.
   * `updatedAt = updatedAt` não mexe na data do pedido.
   */
  if (criou) {
    await pool
      .execute(
        `UPDATE simulatorOrders o
            SET o.ruaEmFalta = 1, o.updatedAt = o.updatedAt
          WHERE o.ruaEmFalta IS NULL AND ${ABERTO}
            AND (o.address IS NULL OR TRIM(o.address) = '' OR o.address LIKE '%rua por confirmar%')`,
      )
      .catch((e) => console.error("[ensureColunasDaRua] marcar os de antes:", e instanceof Error ? e.message : e));
  }
  colunasDaRua = true;
}

/** No registo: o pedido ficou sem a rua? Marca-o. Nunca atira. */
export async function marcarSeFaltarARua(pedidoId: number, address: string | null | undefined): Promise<boolean> {
  if (!faltaARua(address)) return false;
  try {
    await ensureColunasDaRua();
    const pool = await getPool();
    if (!pool) return false;
    await pool.execute("UPDATE simulatorOrders SET ruaEmFalta = 1, updatedAt = updatedAt WHERE id = ?", [pedidoId]);
    return true;
  } catch (e) {
    console.error("[marcarSeFaltarARua]", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Grava a rua no pedido: a morada, o andar (se o disse), o código postal (se faltava). */
export async function gravarARua(pedidoId: number, rua: RuaLida, onde: string): Promise<boolean> {
  await ensureColunasDaRua();
  const pool = await getPool();
  if (!pool) return false;
  const [r] = (await pool.execute(
    `UPDATE simulatorOrders
        SET address = ?, floor = COALESCE(?, floor),
            postalCode = COALESCE(NULLIF(TRIM(postalCode), ''), ?),
            ruaEmFalta = 0, ruaRecebidaEm = NOW()
      WHERE id = ? AND ruaEmFalta = 1`,
    [rua.morada, rua.andar, rua.codigoPostal, pedidoId],
  )) as unknown as [{ affectedRows?: number }, unknown];
  const gravou = Number(r?.affectedRows ?? 0) > 0;
  if (gravou) {
    await appendOrderHistory(pedidoId, {
      type: "rua_recebida",
      by: null,
      message: `A rua chegou ${onde}: ${rua.morada}${rua.andar ? `, andar ${rua.andar}` : ""}. Ficou na morada do pedido (o parceiro vê-a).`,
    }).catch(() => {});
    await avisarOContratadoDaRua(pedidoId);
  }
  return gravou;
}

/*
 * O PARCEIRO CONTRATADO FICA A SABER — 17-11-2026 (d71, o CEO e o dono). A rua
 * entrava na morada do trabalho em silêncio. Agora, quando o pedido passa de
 * «falta a rua» a completo (a passagem `ruaEmFalta` 1 → 0, que só acontece uma
 * vez por pedido), o contratado recebe um aviso na app Pro — pelo servidor, sem
 * WhatsApp. Só ao contratado (a negociação acordada, com o trabalho por fazer);
 * antes do aceite não há a quem avisar. Nunca atira: a rua já está gravada.
 */
export async function avisarOContratadoDaRua(pedidoId: number): Promise<boolean> {
  try {
    const pool = await getPool();
    if (!pool) return false;
    const [rows] = (await pool.execute(
      `SELECT n.id, p.email
         FROM negociacoes n JOIN providers p ON p.id = n.providerId
        WHERE n.pedidoId = ? AND n.estado = 'acordada'
          AND n.execucaoEnviadaEm IS NULL AND n.confirmadoEm IS NULL AND n.pagoEm IS NULL
        ORDER BY n.id DESC LIMIT 1`,
      [pedidoId],
    )) as unknown as [Array<{ id: number; email: string | null }>, unknown];
    const linha = rows[0];
    const email = typeof linha?.email === "string" ? linha.email.trim() : "";
    if (!linha || !email) return false;
    const { avisarProfissionalDaRuaPorPush } = await import("./avisar-por-push");
    await avisarProfissionalDaRuaPorPush({ email, pedidoId, negociacaoId: Number(linha.id) });
    await appendOrderHistory(pedidoId, {
      type: "rua_avisada",
      by: null,
      message: "O parceiro contratado foi avisado na app Pro de que a rua chegou.",
    }).catch(() => {});
    return true;
  } catch (e) {
    console.error("[avisarOContratadoDaRua]", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * A RUA QUE CHEGOU POR OUTRO CAMINHO — a equipa a editar o pedido no
 * backoffice. Se a morada nova já tem a rua e o pedido estava «falta a rua»,
 * fecha a marca (uma vez: só passa de 1 a 0 se ainda era 1) e avisa o
 * contratado. Devolve se fechou. Nunca atira.
 */
export async function fecharARuaQueChegou(pedidoId: number, address: string | null | undefined, onde: string): Promise<boolean> {
  if (faltaARua(address)) return false;
  try {
    await ensureColunasDaRua();
    const pool = await getPool();
    if (!pool) return false;
    const [r] = (await pool.execute(
      "UPDATE simulatorOrders SET ruaEmFalta = 0, ruaRecebidaEm = NOW(), updatedAt = updatedAt WHERE id = ? AND ruaEmFalta = 1 AND ruaRecebidaEm IS NULL",
      [pedidoId],
    )) as unknown as [{ affectedRows?: number }, unknown];
    if (Number(r?.affectedRows ?? 0) === 0) return false;
    await appendOrderHistory(pedidoId, {
      type: "rua_recebida",
      by: null,
      message: `A rua chegou ${onde}. Ficou na morada do pedido (o parceiro vê-a).`,
    }).catch(() => {});
    await avisarOContratadoDaRua(pedidoId);
    return true;
  } catch (e) {
    console.error("[fecharARuaQueChegou]", e instanceof Error ? e.message : e);
    return false;
  }
}

const dig9 = (t: string) => t.replace(/\D/g, "").slice(-9);

/**
 * A RESPOSTA À PERGUNTA DA RUA. Se este número tem um pedido com a rua pedida
 * e por receber, e a mensagem é uma morada, grava-a e devolve o pedido e o
 * agradecimento. Também corre com a conversa entregue a uma pessoa (a ponte):
 * aí grava em silêncio — quem tem a conversa vê-a no fio e no pedido.
 */
export async function lerARespostaDaRua(
  telefone: string,
  texto: string,
): Promise<{ pedidoId: number; rua: RuaLida; agradecimento: string } | null> {
  const rua = lerARua(texto);
  if (!rua) return null;
  const digitos = dig9(telefone);
  if (digitos.length < 9) return null;
  try {
    await ensureColunasDaRua();
    const pool = await getPool();
    if (!pool) return null;
    const [rows] = (await pool.execute(
      `SELECT o.id FROM simulatorOrders o
        WHERE RIGHT(REGEXP_REPLACE(COALESCE(o.contactPhone, ''), '[^0-9]', ''), 9) = ?
          AND o.ruaEmFalta = 1 AND o.ruaPedidaEm IS NOT NULL AND o.ruaRecebidaEm IS NULL
          AND o.ruaPedidaEm >= NOW() - INTERVAL 3 DAY AND ${ABERTO}
        ORDER BY o.ruaPedidaEm DESC LIMIT 1`,
      [digitos],
    )) as [Array<{ id: number }>, unknown];
    const id = rows[0] ? Number(rows[0].id) : null;
    if (!id) return null;
    if (!(await gravarARua(id, rua, "pelo WhatsApp, em resposta à Vitória"))) return null;
    return { pedidoId: id, rua, agradecimento: ruaAnotada(id, [rua.morada, rua.andar].filter(Boolean).join(", ")) };
  } catch (e) {
    console.error("[lerARespostaDaRua]", e instanceof Error ? e.message : e);
    return null;
  }
}

type LinhaDaRua = {
  id: number;
  contactPhone: string | null;
  address: string | null;
  floor: string | null;
  valorFixoClyon: unknown;
  createdAt: unknown;
  ruaPedidaEm: unknown;
  ruaRecebidaEm: unknown;
  ruaPassadaEm: unknown;
  contratadaEm: unknown;
  valorUnicoAceiteEm: unknown;
  valorUnicoEm: unknown;
};

async function linhasDaRua(ids: number[] | null): Promise<LinhaDaRua[]> {
  await ensureColunasDaRua();
  await ensureNegociacoesTable();
  const { ensureColunasDoAceite } = await import("./valor-unico-no-whatsapp-na-base");
  await ensureColunasDoAceite();
  const pool = await getPool();
  if (!pool) return [];
  const filtro = ids && ids.length > 0 ? `AND o.id IN (${ids.map(() => "?").join(",")})` : "";
  /*
   * O aceite: a negociação contratada (`contratadaEm`, gravada desde 15-11 em
   * todos os fechos, por qualquer caminho), ou o valor único aceite (que vale
   * para o valor enviado). Sem nenhum dos dois, o pedido ainda não foi aceite.
   */
  const [rows] = (await pool.execute(
    `SELECT o.id, o.contactPhone, o.address, o.floor, o.valorFixoClyon, o.createdAt,
            o.ruaPedidaEm, o.ruaRecebidaEm, o.ruaPassadaEm, o.valorUnicoAceiteEm, o.valorUnicoEm,
            (SELECT MAX(n.contratadaEm) FROM negociacoes n WHERE n.pedidoId = o.id AND n.estado = 'acordada') AS contratadaEm
       FROM simulatorOrders o
      WHERE o.ruaEmFalta = 1 AND o.ruaRecebidaEm IS NULL AND ${ABERTO} ${filtro}
      ORDER BY o.id DESC LIMIT 200`,
    ids && ids.length > 0 ? ids : [],
  )) as unknown as [LinhaDaRua[], unknown];
  // A rua que entrou por outro caminho (a equipa no backoffice, o pedido completado na conversa) já não falta.
  return rows.filter((l) => faltaARua(l.address));
}

function aceiteDe(l: LinhaDaRua): Date | null {
  const contratada = instanteDaBase(l.contratadaEm as string | Date | null);
  const vu = instanteDaBase(l.valorUnicoAceiteEm as string | Date | null);
  const enviado = instanteDaBase(l.valorUnicoEm as string | Date | null);
  const vuVale = vu && (!enviado || vu.getTime() >= enviado.getTime()) ? vu : null;
  const todos = [contratada, vuVale].filter((d): d is Date => d != null);
  return todos.length ? new Date(Math.max(...todos.map((d) => d.getTime()))) : null;
}

/** Os pedidos com a rua em falta, para o cartão da Mesa: se já foi aceite, pedida, passada. */
export async function ruaEmFaltaDosPedidos(
  ids: number[],
): Promise<Map<number, { aceite: boolean; pedidaEm: string | null; passadaEm: string | null }>> {
  const mapa = new Map<number, { aceite: boolean; pedidaEm: string | null; passadaEm: string | null }>();
  const limpos = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return mapa;
  for (const l of await linhasDaRua(limpos)) {
    mapa.set(Number(l.id), {
      aceite: aceiteDe(l) != null,
      pedidaEm: instanteDaBase(l.ruaPedidaEm as string | Date | null)?.toISOString() ?? null,
      passadaEm: instanteDaBase(l.ruaPassadaEm as string | Date | null)?.toISOString() ?? null,
    });
  }
  return mapa;
}

/** Quantos pedidos abertos foram aceites e continuam sem a rua — o Início. */
export async function contarAceitesSemRua(): Promise<number | null> {
  try {
    return (await linhasDaRua(null)).filter((l) => aceiteDe(l) != null).length;
  } catch (e) {
    console.error("[contarAceitesSemRua]", e instanceof Error ? e.message : e);
    return null;
  }
}

type Portas = {
  enviar: (telefone: string, texto: string) => Promise<unknown>;
  podeFalar: (telefone: string) => Promise<boolean>;
  interrompido: (telefone: string) => Promise<boolean>;
  interromper: (telefone: string, motivo: string) => Promise<unknown>;
  mensagens: (telefone: string) => Promise<Array<{ direccao: string; texto: string; haSegundos: number | null }>>;
};

async function portasDeSempre(): Promise<Portas> {
  const db = await import("./db");
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
  return {
    enviar: (t, x) => enviarTextoWhatsApp(t, x),
    podeFalar: (t) => db.podeOWhatsAppFalarCom(t),
    interrompido: (t) => db.numeroInterrompidoWhatsApp(t),
    interromper: (t, m) => db.interromperNumeroWhatsApp(t, m),
    mensagens: (t) => db.mensagensDoNumeroWhatsApp(t, 60),
  };
}

/**
 * UM PEDIDO, AGORA: grava a rua que ele já escreveu, ou pede-a (uma vez), ou
 * passa à equipa. Devolve o que fez. A marca vem ANTES da mensagem: se o envio
 * falhar, não se pergunta outra vez — a passagem das 2 h apanha-o.
 */
async function tratarUm(l: LinhaDaRua, agora: Date, p: Portas, aceiteJa?: Date, podePerguntar = true): Promise<string | null> {
  const pool = await getPool();
  if (!pool) return null;
  const telefone = (l.contactPhone ?? "").trim();
  const aceiteEm = aceiteJa ?? aceiteDe(l);
  const ruaPedidaEm = instanteDaBase(l.ruaPedidaEm as string | Date | null);
  const semTelefone = dig9(telefone).length < 9;
  const criadoEm = instanteDaBase(l.createdAt as string | Date | null);
  const ruaNaConversa =
    !ruaPedidaEm && aceiteEm && aceiteEm.getTime() >= PEDE_A_RUA_DESDE.getTime() && !semTelefone
      ? ruaJaDitaNaConversa(await p.mensagens(telefone).catch(() => []), criadoEm, agora)
      : null;
  const decisao = oQueFazerComARua(
    {
      pedidoId: Number(l.id),
      aceiteEm,
      ruaPedidaEm,
      ruaRecebidaEm: instanteDaBase(l.ruaRecebidaEm as string | Date | null),
      ruaPassadaEm: instanteDaBase(l.ruaPassadaEm as string | Date | null),
      podeFalar: !semTelefone && (await p.podeFalar(telefone).catch(() => false)),
      trabalhoClyon: l.valorFixoClyon != null,
      ruaNaConversa,
    },
    Boolean((l.floor ?? "").trim()),
    agora,
  );
  if (!decisao) return null;
  const id = Number(l.id);
  if (decisao.tipo === "gravar") {
    return (await gravarARua(id, decisao.rua, "na conversa do WhatsApp (já a tinha escrito)")) ? `#${id}: rua lida na conversa` : null;
  }
  if (decisao.tipo === "pedir") {
    // De noite não se pergunta: a passagem seguinte, de manhã, pergunta (`horaDeFalar`).
    if (!podePerguntar) return null;
    const [r] = (await pool.execute(
      "UPDATE simulatorOrders SET ruaPedidaEm = NOW(), updatedAt = updatedAt WHERE id = ? AND ruaPedidaEm IS NULL AND ruaRecebidaEm IS NULL",
      [id],
    )) as unknown as [{ affectedRows?: number }, unknown];
    if (Number(r?.affectedRows ?? 0) === 0) return null;
    await p.enviar(telefone, decisao.pergunta).catch((e) => console.error("[rua] a pergunta não saiu:", e));
    await appendOrderHistory(id, { type: "rua_pedida", by: null, message: "A Vitória pediu a rua, o número e o andar ao cliente, pelo WhatsApp." }).catch(() => {});
    return `#${id}: rua pedida`;
  }
  const [r] = (await pool.execute(
    "UPDATE simulatorOrders SET ruaPassadaEm = NOW(), updatedAt = updatedAt WHERE id = ? AND ruaPassadaEm IS NULL AND ruaRecebidaEm IS NULL",
    [id],
  )) as unknown as [{ affectedRows?: number }, unknown];
  if (Number(r?.affectedRows ?? 0) === 0) return null;
  /*
   * Uma conversa já entregue a uma pessoa fica com o motivo que tinha (o do
   * valor único, «escolher o parceiro», por exemplo): a falta da rua vai para o
   * histórico do pedido e para o selo da Mesa.
   */
  if (!semTelefone && decisao.interromper && !(await p.interrompido(telefone).catch(() => true))) {
    await p.interromper(telefone, decisao.motivo).catch(() => {});
  }
  await appendOrderHistory(id, { type: "rua_a_equipa", by: null, message: decisao.motivo }).catch(() => {});
  return `#${id}: passou à equipa`;
}

/**
 * LOGO A SEGUIR AO ACEITE, NA CONVERSA — o fecho pelo WhatsApp e o valor único
 * aceite. Nunca atira: o aceite já está feito.
 */
export async function pedirARuaDepoisDoAceite(pedidoId: number, portas?: Partial<Portas>): Promise<string | null> {
  try {
    const [l] = await linhasDaRua([pedidoId]);
    if (!l) return null;
    return await tratarUm(l, new Date(), { ...(await portasDeSempre()), ...portas }, new Date());
  } catch (e) {
    console.error("[pedirARuaDepoisDoAceite]", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * A PASSAGEM DE 10 EM 10 MINUTOS: os aceites por outro caminho (o link, a app
 * de cliente, a Mesa) levam a pergunta; os pedidos com a pergunta sem resposta
 * há 2 h passam à equipa.
 */
export async function correrARuaDepoisDoAceite(agora = new Date()): Promise<{ linhas: string[] }> {
  const linhas: string[] = [];
  const portas = await portasDeSempre();
  const { horaDeFalar } = await import("./assistente-interruptores");
  const podePerguntar = horaDeFalar(agora);
  for (const l of await linhasDaRua(null)) {
    const feito = await tratarUm(l, agora, portas, undefined, podePerguntar).catch((e) => {
      console.error("[correrARuaDepoisDoAceite]", e instanceof Error ? e.message : e);
      return null;
    });
    if (feito) linhas.push(feito);
  }
  return { linhas };
}
