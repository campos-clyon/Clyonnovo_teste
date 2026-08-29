import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool } from "@/lib/db";
import { naAgenda } from "@/lib/agenda-dos-trabalhos";

export const runtime = "nodejs";

/**
 * A AGENDA DO BACKOFFICE — o que está marcado, e o que já passou do dia.
 *
 * "Quero uma agenda para o admin acompanhar as datas e horários dos trabalhos,
 * para saber se os trabalhos estão no horário ou não."
 *
 * A mesa das negociações responde «quem está à espera de quem». Não responde
 * à pergunta que faz o telefone tocar: QUANDO. Um trabalho fechado a 20 para o
 * dia 22 aparecia lá exactamente igual a um fechado ontem para o mês que vem —
 * e o que passou do dia sem ninguém lá ir não se distinguia de nenhum.
 *
 * SÓ OS CONTRATADOS. Uma negociação a decorrer não tem data para acompanhar:
 * tem uma proposta à espera de resposta, e isso já tem ecrã. Aqui só entra o
 * que está fechado — e o que está fechado ou tem dia, ou precisa de um
 * telefonema para o ter.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      `SELECT n.id AS negociacaoId, n.pedidoId, n.valorAcordado,
              n.dataCombinada, n.execucaoEnviadaEm, n.confirmadoEm, n.pagoEm,
              o.dataAgendada, o.serviceType, o.city, o.address,
              o.contactName, o.contactPhone,
              p.id AS providerId, p.name AS profissionalNome, p.phone AS profissionalTelefone
         FROM negociacoes n
         JOIN providers p ON p.id = n.providerId
         JOIN simulatorOrders o ON o.id = n.pedidoId
        WHERE n.estado = 'acordada'
          AND (o.status IS NULL OR o.status <> 'cancelado')
        ORDER BY COALESCE(n.dataCombinada, o.dataAgendada) IS NULL,
                 COALESCE(n.dataCombinada, o.dataAgendada) ASC`,
    )) as [Array<Record<string, unknown>>, unknown];

    const agora = new Date();
    const trabalhos = linhas.map((l) => {
      const a = naAgenda(
        {
          dataCombinada: l.dataCombinada as Date | null,
          dataAgendada: l.dataAgendada as Date | null,
          execucaoEnviadaEm: l.execucaoEnviadaEm as Date | null,
          confirmadoEm: l.confirmadoEm as Date | null,
          pagoEm: l.pagoEm as Date | null,
        },
        agora,
      );
      return {
        negociacaoId: Number(l.negociacaoId),
        pedidoId: Number(l.pedidoId),
        servico: (l.serviceType as string) ?? null,
        cidade: (l.city as string) ?? null,
        morada: (l.address as string) ?? null,
        clienteNome: (l.contactName as string) ?? null,
        clienteTelefone: (l.contactPhone as string) ?? null,
        providerId: Number(l.providerId),
        profissionalNome: (l.profissionalNome as string) ?? "",
        profissionalTelefone: (l.profissionalTelefone as string) ?? null,
        valorAcordado: l.valorAcordado != null ? Number(l.valorAcordado) : null,
        /*
         * As duas datas seguem SEPARADAS para o ecrã.
         *
         * Ver «pedido para quinta, combinado para sábado» é meia da razão de
         * existir desta agenda; mandar só o resultado escondia isso.
         */
        dataCombinada: l.dataCombinada ? new Date(l.dataCombinada as string).toISOString() : null,
        dataDoCliente: l.dataAgendada ? new Date(l.dataAgendada as string).toISOString() : null,
        estado: a.estado,
        quando: a.quando ? a.quando.toISOString() : null,
        origem: a.origem,
        diasDeAtraso: a.diasDeAtraso,
        horaJaPassou: a.horaJaPassou,
      };
    });

    const conta = (e: string) => trabalhos.filter((t) => t.estado === e).length;
    return NextResponse.json({
      trabalhos,
      resumo: {
        atrasados: conta("atrasado"),
        hoje: conta("hoje"),
        semData: conta("sem_data"),
        porVir: conta("por_vir"),
        feitos: conta("feito"),
      },
    });
  } catch (e) {
    console.error("[api/admin/agenda]", e);
    return NextResponse.json({ error: "Não foi possível ler a agenda." }, { status: 500 });
  }
}
