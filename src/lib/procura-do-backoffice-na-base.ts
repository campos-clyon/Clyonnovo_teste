import { ensureNegociacoesTable, ensureSimulatorOrdersTable, withConnection } from "@/lib/db";
import { diaMesEHoraEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";
import {
  linhaDaAgenda,
  linhaDaConversa,
  linhaDoCliente,
  linhaDoDocumento,
  linhaDoPagamento,
  linhaDoPedido,
  linhaDoProfissional,
  MAXIMO_POR_GRUPO,
  haOQueProcurar,
  type GrupoDaProcura,
  type GruposDaProcura,
  type LinhaDaProcura,
} from "@/lib/procura-do-backoffice";
import { procurarNasLinhas, type LinhaParaProcurar } from "@/lib/procurar-em-todo-o-lado";
import { combinaComOsCampos, digitosDoTermo, juntarNumeros } from "@/lib/procurar-pedido";

/**
 * A leitura da base para «Em todo o backoffice» — d79 (20-11-2026). Só no
 * servidor, só leitura (as tabelas dos pagamentos, das faturas e do WhatsApp
 * não se criam aqui: uma que falte dá um grupo vazio). Só se lê o que está em
 * `grupos` — a rota passa os que a conta pode
 * ver —, e cada grupo traz no máximo `MAXIMO_POR_GRUPO`.
 */

type Conn = Parameters<Parameters<typeof withConnection>[0]>[0];

/** Uma consulta que, se falhar (tabela que ainda não existe), dá vazio em vez de partir a procura toda. */
async function ler<T>(conn: Conn, sql: string, params: unknown[]): Promise<T[]> {
  try {
    const [r] = (await conn.execute(sql, params as never)) as [T[], unknown];
    return r;
  } catch (e) {
    console.error("[procura-do-backoffice]", e instanceof Error ? e.message : e);
    return [];
  }
}

const SO_DIGITOS_SQL = (col: string) => `REPLACE(REPLACE(REPLACE(REPLACE(${col}, ' ', ''), '.', ''), '-', ''), '+', '')`;

const quando = (v: unknown): string | null => {
  const d = instanteDaBase((v as Date | string | null) ?? null);
  return d ? diaMesEHoraEmLisboa(d) : null;
};

export async function procurarNoBackoffice(termoBruto: string, grupos: readonly GrupoDaProcura[]): Promise<GruposDaProcura> {
  const termo = termoBruto.trim().slice(0, 120);
  if (!haOQueProcurar(termo) || grupos.length === 0) return {};
  const quer = (g: GrupoDaProcura) => grupos.includes(g);

  // O que o termo é: dígitos (telefone, NIF, referência), um trid, ou texto.
  const digitos = digitosDoTermo(termo) ?? (/^[\d\s.-]{6,}$/.test(termo) ? termo.replace(/\D/g, "") : null);
  const umaPalavra = /^[A-Za-z0-9_-]{6,80}$/.test(termo) ? termo : null; // um trid / id da transacção
  // Na base procura-se pela palavra mais comprida; as outras apertam a rede depois (`combinaComOsCampos`).
  const maisComprida = juntarNumeros(termo).split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? termo;
  const textoLike = `%${maisComprida.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();

  return withConnection(async (conn) => {
    const fora: GruposDaProcura = {};

    /*
     * OS PEDIDOS — a procura de sempre (`procurarNasLinhas`, a mesma das listas),
     * agora também pelo email e pelo NIF da fatura. Lêem-se sempre, mesmo sem o
     * grupo: são eles que levam aos pagamentos, à agenda, às faturas e à
     * conversa. Só saem na resposta se a conta tiver o grupo.
     */
    const linhas = await ler<LinhaParaProcurar>(
      conn,
      `SELECT o.id, o.status, o.contactName, o.contactPhone, o.contactEmail, o.address, o.city, o.postalCode,
              o.nifFactura AS nif, o.serviceType, o.valorFixoClyon, o.createdAt,
              (SELECT COUNT(*) FROM negociacoes x WHERE x.pedidoId = o.id) AS negociacoes,
              pn.name AS profissional
         FROM simulatorOrders o
         LEFT JOIN (
           SELECT pedidoId, MAX(id) AS negociacaoId
             FROM negociacoes
            WHERE estado = 'acordada'
            GROUP BY pedidoId
         ) a ON a.pedidoId = o.id
         LEFT JOIN negociacoes n ON n.id = a.negociacaoId
         LEFT JOIN providers pn ON pn.id = n.providerId
        ORDER BY o.id DESC
        LIMIT 5000`,
      [],
    );
    const pedidos = procurarNasLinhas(linhas, termo);
    const idsDosPedidos = pedidos.map((p) => p.pedidoId);
    if (quer("pedidos")) fora.pedidos = pedidos.slice(0, MAXIMO_POR_GRUPO.pedidos).map(linhaDoPedido);

    /* OS PROFISSIONAIS — pelo nome, email, cidade, telefone ou NIF. Também levam à agenda e à conversa. */
    const pros = await ler<{ id: number; name: string; email: string | null; phone: string | null; nif: string | null; city: string | null }>(
      conn,
      digitos
        ? `SELECT id, name, email, phone, nif, city FROM providers
            WHERE ${SO_DIGITOS_SQL("phone")} LIKE ? OR nif LIKE ? ORDER BY id DESC LIMIT 30`
        : `SELECT id, name, email, phone, nif, city FROM providers
            WHERE name LIKE ? OR email LIKE ? OR city LIKE ? ORDER BY id DESC LIMIT 60`,
      digitos ? [`%${digitos}%`, `%${digitos}%`] : [textoLike, textoLike, textoLike],
    );
    // Várias palavras («silva almada») apertam a rede, como nas listas.
    const prosQueBatem = pros.filter((p) =>
      combinaComOsCampos({ textos: [p.name, p.email, p.city], digitos: [p.phone, p.nif] }, termo),
    );
    if (quer("profissionais")) {
      fora.profissionais = prosQueBatem
        .slice(0, MAXIMO_POR_GRUPO.profissionais)
        .map((p) => linhaDoProfissional({ id: p.id, nome: p.name, email: p.email, telefone: p.phone, cidade: p.city }));
    }

    /* OS CLIENTES COM CONTA — pelo nome, email, cidade, telefone ou NIF. */
    if (quer("clientes")) {
      const contas = await ler<{ id: number; name: string | null; email: string; phone: string | null; nif: string | null; addressCity: string | null }>(
        conn,
        digitos
          ? `SELECT id, name, email, phone, nif, addressCity FROM users
              WHERE deletedAt IS NULL AND (${SO_DIGITOS_SQL("phone")} LIKE ? OR nif LIKE ? OR billingNif LIKE ?)
              ORDER BY id DESC LIMIT 30`
          : `SELECT id, name, email, phone, nif, addressCity FROM users
              WHERE deletedAt IS NULL AND (name LIKE ? OR email LIKE ? OR addressCity LIKE ?)
              ORDER BY id DESC LIMIT 60`,
        digitos ? [`%${digitos}%`, `%${digitos}%`, `%${digitos}%`] : [textoLike, textoLike, textoLike],
      );
      fora.clientes = contas
        .filter((c) => combinaComOsCampos({ textos: [c.name, c.email, c.addressCity], digitos: [c.phone, c.nif] }, termo))
        .slice(0, MAXIMO_POR_GRUPO.clientes)
        .map((c) => linhaDoCliente({ id: c.id, nome: c.name, email: c.email, telefone: c.phone, cidade: c.addressCity }));
    }

    /*
     * OS PAGAMENTOS E AS REFERÊNCIAS — os dos pedidos encontrados, e os que o
     * termo diz directamente: a referência Multibanco, o telemóvel do MB WAY,
     * o trid ou o id da transacção do euPago.
     */
    if (quer("pagamentos")) {
      const condicoes: string[] = [];
      const params: unknown[] = [];
      if (idsDosPedidos.length > 0) {
        condicoes.push(`pg.pedidoId IN (${idsDosPedidos.map(() => "?").join(",")})`);
        params.push(...idsDosPedidos);
      }
      if (digitos) {
        condicoes.push(`${SO_DIGITOS_SQL("pg.referencia")} LIKE ?`, `${SO_DIGITOS_SQL("pg.telemovel")} LIKE ?`);
        params.push(`%${digitos}%`, `%${digitos}%`);
      }
      if (umaPalavra) {
        condicoes.push("pg.trid = ?", "pg.transacaoId = ?");
        params.push(umaPalavra, umaPalavra);
      }
      if (condicoes.length > 0) {
        const pagamentos = await ler<{
          id: number;
          pedidoId: number;
          metodo: string | null;
          estado: string | null;
          valor: number | string | null;
          referencia: string | null;
          entidade: string | null;
          profissional: string | null;
        }>(
          conn,
          `SELECT pg.id, pg.pedidoId, pg.metodo, pg.estado, pg.valor, pg.referencia, pg.entidade, pr.name AS profissional
             FROM pagamentos pg LEFT JOIN providers pr ON pr.id = pg.providerId
            WHERE ${condicoes.join(" OR ")}
            ORDER BY pg.id DESC LIMIT ${MAXIMO_POR_GRUPO.pagamentos}`,
          params,
        );
        fora.pagamentos = pagamentos.map((p) =>
          linhaDoPagamento({ ...p, pedidoId: Number(p.pedidoId), valor: p.valor == null ? null : Number(p.valor) }),
        );
      }
    }

    /* A CONVERSA DO WHATSAPP — pelo número escrito, ou pelos telefones dos pedidos e profissionais encontrados. */
    if (quer("whatsapp")) {
      const nomes = new Map<string, string>();
      const telefones = new Set<string>();
      const nove = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "").slice(-9);
      if (digitos && digitos.length >= 9) telefones.add(digitos.slice(-9));
      for (const p of pedidos.slice(0, 10)) {
        const t = nove(p.telefone);
        if (t.length === 9) {
          telefones.add(t);
          if (p.cliente && !nomes.has(t)) nomes.set(t, p.cliente);
        }
      }
      for (const p of prosQueBatem.slice(0, 5)) {
        const t = nove(p.phone);
        if (t.length === 9) {
          telefones.add(t);
          if (!nomes.has(t)) nomes.set(t, p.name);
        }
      }
      const lista = [...telefones].slice(0, 12);
      if (lista.length > 0) {
        const conversas = await ler<{ telefone: string; ultimaEm: Date | string | null; mensagens: number | string }>(
          conn,
          `SELECT telefone, MAX(criadoEm) AS ultimaEm, COUNT(*) AS mensagens
             FROM whatsappMensagens
            WHERE ${lista.map(() => "telefone LIKE ?").join(" OR ")}
            GROUP BY telefone
            ORDER BY ultimaEm DESC
            LIMIT ${MAXIMO_POR_GRUPO.whatsapp}`,
          lista.map((t) => `%${t}`),
        );
        fora.whatsapp = conversas.map((c) =>
          linhaDaConversa({
            telefone: String(c.telefone),
            ultimaEm: quando(c.ultimaEm),
            mensagens: Number(c.mensagens ?? 0),
            nome: nomes.get(String(c.telefone).replace(/\D/g, "").slice(-9)) ?? null,
          }),
        );
      }
    }

    /* A AGENDA — os trabalhos acordados dos pedidos e dos profissionais encontrados. */
    if (quer("agenda")) {
      const idsDosPros = prosQueBatem.slice(0, 5).map((p) => Number(p.id));
      const condicoes: string[] = [];
      const params: unknown[] = [];
      if (idsDosPedidos.length > 0) {
        condicoes.push(`n.pedidoId IN (${idsDosPedidos.map(() => "?").join(",")})`);
        params.push(...idsDosPedidos);
      }
      if (idsDosPros.length > 0) {
        condicoes.push(`n.providerId IN (${idsDosPros.map(() => "?").join(",")})`);
        params.push(...idsDosPros);
      }
      if (condicoes.length > 0) {
        const marcados = await ler<{ pedidoId: number; dataCombinada: Date | string | null; dataAgendada: Date | string | null; profissional: string | null; serviceType: string | null }>(
          conn,
          `SELECT n.pedidoId, n.dataCombinada, o.dataAgendada, p.name AS profissional, o.serviceType
             FROM negociacoes n
             JOIN simulatorOrders o ON o.id = n.pedidoId
             JOIN providers p ON p.id = n.providerId
            WHERE n.estado = 'acordada'
              AND (o.status IS NULL OR o.status <> 'cancelado')
              AND (${condicoes.join(" OR ")})
            ORDER BY n.pedidoId DESC
            LIMIT ${MAXIMO_POR_GRUPO.agenda}`,
          params,
        );
        fora.agenda = marcados.map((m) =>
          linhaDaAgenda({
            pedidoId: Number(m.pedidoId),
            quando: quando(m.dataCombinada ?? m.dataAgendada),
            profissional: m.profissional,
            servico: m.serviceType,
          }),
        );
      }
    }

    /* AS FATURAS E OS COMPROVATIVOS dos pedidos encontrados. */
    if (quer("documentos") && idsDosPedidos.length > 0) {
      const em = idsDosPedidos.map(() => "?").join(",");
      const [faturas, comprovativos] = await Promise.all([
        ler<{ id: number; pedidoId: number; nome: string | null; deQuem: string | null }>(
          conn,
          `SELECT id, pedidoId, nome, deQuem FROM faturasDoTrabalho
            WHERE activa = 1 AND pedidoId IN (${em}) ORDER BY id DESC LIMIT ${MAXIMO_POR_GRUPO.documentos}`,
          idsDosPedidos,
        ),
        ler<{ id: number; pedidoId: number; nome: string | null }>(
          conn,
          `SELECT id, pedidoId, nome FROM comprovativosDosPagamentos
            WHERE activo = 1 AND pedidoId IN (${em}) ORDER BY id DESC LIMIT ${MAXIMO_POR_GRUPO.documentos}`,
          idsDosPedidos,
        ),
      ]);
      const docs: LinhaDaProcura[] = [
        ...faturas.map((f) => linhaDoDocumento({ tipo: "fatura", id: f.id, pedidoId: Number(f.pedidoId), nome: f.nome, deQuem: f.deQuem })),
        ...comprovativos.map((c) => linhaDoDocumento({ tipo: "comprovativo", id: c.id, pedidoId: Number(c.pedidoId), nome: c.nome })),
      ];
      fora.documentos = docs.sort((a, b) => (b.pedidoId ?? 0) - (a.pedidoId ?? 0)).slice(0, MAXIMO_POR_GRUPO.documentos);
    }

    return fora;
  });
}
