import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getPool,
  ensureProvidersSchema,
  ensureConvitesTable,
  actividadeDosProfissionais,
} from "@/lib/db";

export const runtime = "nodejs";

/**
 * Lista os profissionais do site para o painel, com a actividade de cada um.
 *
 * A actividade não é enfeite: sem ela não se distingue um profissional que
 * trabalha de um que recebe pedidos e nunca responde, ou de um que nunca
 * recebeu nada — e cada um desses casos pede uma acção diferente do
 * administrador. Vem de uma consulta agregada às negociações, e não de uma por
 * profissional.
 *
 * Devolve email, telefone, NIF e número de transportador, que são dados
 * pessoais e comerciais — daí exigir sessão de administrador.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    await ensureProvidersSchema();
    /*
     * A tabela dos convites tem de existir ANTES do JOIN.
     *
     * Numa instalação onde nunca se criou nem listou um convite ela não foi
     * criada, e um JOIN a uma tabela que não existe não devolve zero linhas:
     * deita abaixo a consulta toda com um 500, e o painel fica sem lista
     * nenhuma. `ensureConvitesTable` é idempotente e barata.
     */
    await ensureConvitesTable();
    const pool = await getPool();
    if (!pool) return NextResponse.json({ profissionais: [] });

    /*
     * DE ONDE VEIO ESTE PROFISSIONAL — e porque é que isso passou a importar.
     *
     * Desde que a candidatura abriu ao público, a fila «Por aprovar» mistura
     * duas coisas que pedem trabalho diferente: quem foi convidado (já se
     * falou com ele, e a nota do convite diz quem o indicou e o que ficou
     * combinado) e quem apareceu do nada (é preciso verificar o NIF e ligar).
     * O cartão não dava pista nenhuma, e a nota vivia noutra lista, no painel
     * de cima, que alguém tinha de ir cruzar pelo email.
     *
     * Não é preciso coluna nova: `marcarConviteUsado` grava `providerId` desde
     * sempre, portanto quem entrou por convite já está marcado — faltava ler.
     *
     * O JOIN é pelo convite MAIS RECENTE (`MAX(c2.id)`) para uma linha de
     * profissional nunca poder duplicar dentro do LIMIT — quem foi convidado
     * duas vezes aparecia duas vezes, e empurrava outro para fora da lista.
     *
     * E todas as colunas levam o prefixo `p.`: `convitesProfissionais` também
     * tem `id`, `email`, `telefone` e `createdAt`, e sem prefixo o MySQL
     * responde "Column 'id' in field list is ambiguous".
     */
    const [rows] = await pool.execute(
      `SELECT p.id, p.name, p.email, p.phone, p.nif, p.city, p.categorias, p.zonas, p.raioKm,
              p.emiteFatura, p.regimeIva, p.emiteGuiaTransporte, p.numeroTransportador,
              p.guiaVerificadaEm, p.guiaVerificadaPor, p.estado, p.isActive,
              p.baseLat, p.baseLng, p.createdAt,
              c.criadoPor AS convidadoPor,
              c.nota      AS notaDoConvite,
              c.createdAt AS convidadoEm
         FROM providers p
         LEFT JOIN convitesProfissionais c
                ON c.id = (SELECT MAX(c2.id) FROM convitesProfissionais c2
                            WHERE c2.providerId = p.id)
        -- 'apagado' é a linha vazia que fica quando uma conta com história é
        -- apagada: as negociações antigas precisam dela, o painel não. Sem
        -- isto, "Profissional removido" ficava na lista para sempre.
        WHERE p.isClyon = 0 AND (p.estado IS NULL OR p.estado <> 'apagado')
        ORDER BY
          -- Quem espera verificação primeiro: é o que trava pedidos.
          (p.emiteGuiaTransporte = 1 AND p.guiaVerificadaEm IS NULL) DESC,
          (p.estado = 'pendente') DESC,
          p.createdAt DESC
        LIMIT 500`,
    ) as any[];

    const actividade = await actividadeDosProfissionais();

    const profissionais = (rows as Array<Record<string, unknown>>).map((p) => ({
      ...p,
      actividade:
        actividade.get(Number(p.id)) ?? { recebidos: 0, comProposta: 0, fechados: 0 },
    }));

    return NextResponse.json({ profissionais });
  } catch (error) {
    console.error("[api/admin/profissionais GET]", error);
    return NextResponse.json({ error: "Erro ao listar profissionais" }, { status: 500 });
  }
}
