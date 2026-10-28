/**
 * Helpers server-side para carregar os dados da conta do cliente em SSR.
 * Usado por app/conta/page.tsx para pre-carregar user + pedidos e eliminar
 * o estado vazio de 7s que aparecia enquanto o cliente-side fazia fetch.
 */
import { ensureUsersSchema, ensureSimulatorOrdersTable, getPool, withConnection } from "@/lib/db";
import { pedidoDaContaParaOEcra, porPedido, sqlDasNegociacoesDaConta } from "@/lib/pedidos-da-conta";

let _schemaReady = false;
async function ensureReady() {
  if (_schemaReady) return;
  await Promise.all([ensureUsersSchema(), ensureSimulatorOrdersTable()]);
  _schemaReady = true;
}

/**
 * Regista que este cliente existe.
 *
 * A linha na tabela `users` nascia dentro do `loadContaData`, que só corre
 * quando alguém abre /conta. Quem entrava com Google e ia para outro lado —
 * voltar ao simulador, fechar o separador — ficava com sessão iniciada e sem
 * conta nenhuma na base.
 *
 * Era isso que tinha o contador do backoffice parado: doze contas em Julho,
 * uma em Agosto, com pedidos a entrar todos os dias. O número estava certo;
 * é que contava quem tinha aberto uma página, não quem se tinha autenticado.
 *
 * NUNCA lança. Isto é chamado de dentro do login: uma base indisponível não
 * pode impedir alguém de entrar. Se falhar, o /conta grava na mesma à
 * primeira visita, que é o que já acontecia antes.
 */
export async function registarCliente(email: string, name: string | null): Promise<void> {
  try {
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) return;
    await ensureReady();
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO users (email, name, openId, loginMethod, role, lastSignedIn, createdAt, updatedAt)
         VALUES (?, ?, NULL, 'google', 'user', NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = IF(name IS NULL OR name = '', VALUES(name), name),
           loginMethod = IF(loginMethod = '${CONTA_DO_PEDIDO}', VALUES(loginMethod), loginMethod),
           lastSignedIn = NOW(),
           updatedAt = NOW()`,
        [emailNorm, name ?? emailNorm.split("@")[0]],
      );
    });
  } catch (err) {
    console.error("[registarCliente] não gravou a conta:", err);
  }
}

/**
 * «GUARDAR OS MEUS DADOS» — 17-10-2026.
 *
 * *«50 contas me parece pouco para um ano de site.»* — o dono, que escolheu,
 * entre outras, uma caixa opcional no fim do pedido. Ninguém precisa de conta
 * para pedir, e o «Entrar» só aparecia depois de enviado. Com a caixa marcada
 * (e só com ela — é o consentimento), a conta nasce com o pedido: o email, o
 * nome, o telefone e a localidade que a pessoa escreveu.
 *
 * Nasce com `loginMethod = 'pedido'` e sem `lastSignedIn`: ainda ninguém
 * entrou nela. Entra-se como sempre — Google, ou o link por email em /entrar —
 * e aí `registarCliente` passa-a ao método normal. Numa conta que já existe só
 * se preenche o que estiver em branco: não se escreve por cima do que a pessoa
 * pôs no perfil.
 *
 * Devolve se gravou. Uma falha aqui não pode estragar o pedido, que já está
 * gravado: fica no registo de erros.
 */
export const CONTA_DO_PEDIDO = "pedido";

export async function guardarDadosDoCliente(d: {
  email: string;
  nome: string | null;
  telefone: string | null;
  cidade: string | null;
}): Promise<boolean> {
  try {
    const emailNorm = d.email.trim().toLowerCase();
    if (!emailNorm.includes("@")) return false;
    await ensureReady();
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO users (email, name, phone, addressCity, openId, loginMethod, role, lastSignedIn, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, NULL, '${CONTA_DO_PEDIDO}', 'user', NULL, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = IF(name IS NULL OR name = '', VALUES(name), name),
           phone = IF(phone IS NULL OR phone = '', VALUES(phone), phone),
           addressCity = IF(addressCity IS NULL OR addressCity = '', VALUES(addressCity), addressCity),
           updatedAt = NOW()`,
        [
          emailNorm,
          (d.nome ?? "").trim() || emailNorm.split("@")[0],
          (d.telefone ?? "").trim() || null,
          (d.cidade ?? "").trim() || null,
        ],
      );
    });
    return true;
  } catch (err) {
    console.error("[guardarDadosDoCliente] não gravou a conta:", err);
    return false;
  }
}

/**
 * A CONTA DO CLIENTE PARA A PRIMEIRA CARGA DE /conta.
 *
 * ⚠️ SÓ LÊ — 28-10-2026 (d10). Gravava a conta (`INSERT … ON DUPLICATE KEY
 * UPDATE`) a cada visita, e por isso uma conta APAGADA renascia: apagar
 * baralha o email da linha, e o cookie do site (que dura 30 dias e não se
 * revoga) trazia o email antigo de volta a /conta, que criava uma conta nova
 * com ele. Entrar já cria a conta (`registarCliente`, no login); aqui só se
 * lê. Sem conta, `contaApagada: true` — a página diz «A sua sessão
 * terminou — entre outra vez» e não volta a criar nada.
 *
 * O segundo argumento ficou por compatibilidade (era o nome para o INSERT).
 */
export async function loadContaData(email: string, _nome?: string | null) {
  await ensureReady();
  const emailNorm = email.trim().toLowerCase();

  const [user, ordersData] = await Promise.all([
    withConnection(async (conn) => {
      const [rows] = await conn.execute(
        "SELECT * FROM users WHERE email = ? AND deletedAt IS NULL LIMIT 1",
        [emailNorm],
      ) as [Array<Record<string, unknown>>, unknown];
      return rows[0] ?? null;
    }),
    // Últimos pedidos + resumo — mesma query que /api/users/me/orders
    (async () => {
      const pool = await getPool();
      if (!pool) return { orders: [], summary: null };

      // Estas duas eram sequenciais: o resumo ia e voltava, e só depois é
      // que os pedidos partiam. Numa base remota é uma ida e volta inteira
      // de espera por nada — uma não depende da outra.
      const [[summaryRows], [rows]] = await Promise.all([
        pool.execute(
          `SELECT
           COUNT(*) AS totalOrders,
           SUM(CASE WHEN status NOT IN ('concluido','cancelado','rejeitado') THEN 1 ELSE 0 END) AS activeOrders,
           MAX(createdAt) AS lastOrderDate
         FROM simulatorOrders
         WHERE LOWER(TRIM(contactEmail)) = ?`,
          [emailNorm],
        ) as Promise<[Array<{ totalOrders: number; activeOrders: number | null; lastOrderDate: string | null }>, unknown]>,
        pool.execute(
          `SELECT
           o.id, o.serviceType, o.address, o.city, o.postalCode, o.status,
           o.estimateMin, o.estimateMax, o.estimateTotal,
           o.precoFinal, o.precoFinalIva,
           o.mensagemCliente, o.description, o.historyJson,
           o.urgency, o.floor, o.hasElevator, o.parkingDistance,
           o.distanceKm, o.distanceText, o.filesJson,
           o.scheduledDate, o.scheduledStartTime,
           o.createdAt, o.updatedAt, o.confirmadoPeloCliente,
           o.canceladoPeloCliente,
           o.recurrenceFrequency, o.recurringDiscountPercent,
           o.clientRating, o.clientRatingComment,
           o.providerId, o.assignedToId, o.assignedToName,
           -- Só a marca, para o histórico (d33): o valor nunca sai daqui.
           (o.valorFixoClyon IS NOT NULL) AS trabalhoClyon,
           o.baseDoPreco,
           p.name AS providerName, p.phone AS providerPhone
         FROM simulatorOrders o
         LEFT JOIN providers p ON p.id = o.providerId
         WHERE LOWER(TRIM(o.contactEmail)) = ?
         ORDER BY o.createdAt DESC
         LIMIT 10`,
          [emailNorm],
        ) as Promise<[Array<Record<string, unknown>>, unknown]>,
      ]);

      const summary = {
        totalOrders:   Number(summaryRows[0]?.totalOrders ?? 0),
        activeOrders:  Number(summaryRows[0]?.activeOrders ?? 0),
        lastOrderDate: summaryRows[0]?.lastOrderDate ?? null,
      };

      /*
       * As negociações de cada pedido — as mesmas que a API devolve.
       *
       * Faltavam aqui, e o efeito era subtil: a Visão Geral, que é servida
       * por esta consulta, abria o pedido sem propostas nenhumas; a lista
       * "Os meus pedidos", que vai à API, abria o mesmo pedido com elas. O
       * cliente via duas versões do mesmo ecrã conforme o caminho por onde
       * lá chegou.
       */
      const ids = rows.map((r) => Number(r.id)).filter((n) => Number.isInteger(n));
      let porPedidoDaConta = new Map<number, Array<Record<string, unknown> & { estado: string }>>();
      if (ids.length > 0) {
        const [negs] = (await pool.execute(sqlDasNegociacoesDaConta(ids.length), ids)) as [
          Array<Record<string, unknown> & { estado: string }>,
          unknown,
        ];
        porPedidoDaConta = porPedido(negs);
      }

      const agora = new Date();
      return {
        /*
         * A MESMA CONVERSÃO DA API — 28-10-2026 (d10). As negociações saem
         * prontas para o ecrã (o preço do cliente e os textos), pela regra de
         * todas as portas (d33); o histórico pela lista fechada. Nada do
         * profissional nem da plataforma chega ao browser. Ver
         * `pedidos-da-conta.ts`.
         */
        orders: rows.map((r) => pedidoDaContaParaOEcra(r, porPedidoDaConta.get(Number(r.id)), agora)),
        summary,
      };
    })(),
  ]);

  // Sem conta na base, nada do que se leu sai daqui.
  if (!user) return { user: null, orders: [], summary: null, contaApagada: true as const };

  return {
    user,
    orders: ordersData.orders,
    summary: ordersData.summary,
    contaApagada: false as const,
  };
}
