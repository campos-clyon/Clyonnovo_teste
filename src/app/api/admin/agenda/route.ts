import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool, appendOrderHistory, registarSemFalhar } from "@/lib/db";
import { naAgenda } from "@/lib/agenda-dos-trabalhos";
import {
  quantoOProfissionalRecebe,
  contaDoCliente,
  regimeDeIva,
} from "@/lib/taxas-plataforma";

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
              o.dataAgendada, o.serviceType, o.city, o.address, o.postalCode,
              o.contactName, o.contactPhone, o.contactEmail,
              p.id AS providerId, p.name AS profissionalNome, p.phone AS profissionalTelefone,
              p.regimeIva
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
        codigoPostal: (l.postalCode as string) ?? null,
        clienteNome: (l.contactName as string) ?? null,
        clienteTelefone: (l.contactPhone as string) ?? null,
        clienteEmail: (l.contactEmail as string) ?? null,
        providerId: Number(l.providerId),
        profissionalNome: (l.profissionalNome as string) ?? "",
        profissionalTelefone: (l.profissionalTelefone as string) ?? null,
        valorAcordado: l.valorAcordado != null ? Number(l.valorAcordado) : null,
        /*
         * A CONTA INTEIRA, e não só o número acordado.
         *
         * A ficha mostra o valor a quem vai corrigi-lo, e do valor acordado
         * saem outros dois que não são iguais a ele: o que o profissional
         * recebe (menos 5 %) e o que o cliente paga (mais a taxa e o IVA do
         * regime dele). Sem os três à vista, corrige-se 135 para 230 sem
         * reparar que a transferência passou a ser de 218,50 €.
         */
        recebe: l.valorAcordado != null ? quantoOProfissionalRecebe(Number(l.valorAcordado)) : null,
        clientePaga:
          l.valorAcordado != null
            ? contaDoCliente(Number(l.valorAcordado), regimeDeIva(l.regimeIva)).total
            : null,
        /* A data ainda se corrige depois disto — mas não em silêncio. */
        jaConfirmado: Boolean(l.confirmadoEm),
        jaPago: Boolean(l.pagoEm),
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

/**
 * MARCAR — OU CORRIGIR — O DIA A PARTIR DO BACKOFFICE.
 *
 * "Me dê acesso ao pedido, deixe-me abrir os detalhes dele (…) e a opção de
 * editar essas informações, inclusive a agenda com data e hora."
 *
 * A data só se marcava de um lado: no painel do profissional. Do lado de cá
 * via-se «sem dia marcado» a semana inteira e a única saída era ligar-lhe e
 * pedir que fosse ele ao telemóvel gravar o que os dois já tinham combinado ao
 * telefone. Quem atende a chamada é que tem a informação na mão — e agora
 * grava-a.
 *
 * É A MESMA COLUNA, e de propósito. Isto escreve em `dataCombinada` como o
 * profissional escreve: uma só data a mandar na agenda, em vez de uma «data da
 * CLYON» e uma «data do pro» a discordarem no mesmo ecrã. O que o cliente
 * pediu no formulário continua intocado em `simulatorOrders.dataAgendada`.
 *
 * A DIFERENÇA PARA O PAINEL DELE: aqui um trabalho já confirmado ou já pago
 * ainda se corrige. A ele recusa-se — depois da prova enviada a data deixou de
 * ser um plano e passou a ser o registo do que aconteceu, e não é ele que
 * reescreve o registo. O backoffice é precisamente quem o corrige quando ficou
 * errado; fica dito no histórico que já estava fechado.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; quando?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  /* Vazio DESMARCA — o cliente adiou sem dizer quando, e «por combinar» é a
     verdade. Manter a data velha é que era mentira. */
  const cru = typeof corpo.quando === "string" ? corpo.quando.trim() : "";
  let quando: Date | null = null;
  if (cru) {
    const d = new Date(cru);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }
    /* O mesmo tecto do painel dele: `datetime-local` deixa escrever o ano 2206
       sem se dar por isso, e esse trabalho nunca mais sai de «por vir». */
    if (d.getTime() > Date.now() + 2 * 365 * 86_400_000) {
      return NextResponse.json(
        { error: "Essa data está demasiado longe. Confirme o ano." },
        { status: 400 },
      );
    }
    quando = d;
  }

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      `SELECT n.id, n.pedidoId, n.providerId, n.estado, n.dataCombinada,
              n.confirmadoEm, n.pagoEm, p.name AS profissionalNome
         FROM negociacoes n JOIN providers p ON p.id = n.providerId
        WHERE n.id = ? LIMIT 1`,
      [negociacaoId],
    )) as [
      Array<{
        pedidoId: number;
        providerId: number;
        estado: string;
        dataCombinada: Date | null;
        confirmadoEm: Date | null;
        pagoEm: Date | null;
        profissionalNome: string;
      }>,
      unknown,
    ];
    const linha = linhas[0];
    if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });

    /* Enquanto se negoceia não há dia nenhum para marcar: há uma proposta à
       espera de resposta. Marcar o dia de um trabalho que ainda não é de
       ninguém era prometer em nome de quem não disse que sim. */
    if (linha.estado !== "acordada") {
      return NextResponse.json(
        { error: "Só se marca o dia de um trabalho já contratado." },
        { status: 409 },
      );
    }

    await pool.execute("UPDATE negociacoes SET dataCombinada = ? WHERE id = ?", [
      quando,
      negociacaoId,
    ]);

    const antes = linha.dataCombinada ? new Date(linha.dataCombinada) : null;
    const fmt = (d: Date | null) =>
      d
        ? new Intl.DateTimeFormat("pt-PT", {
            timeZone: "Europe/Lisbon",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(d)
        : "sem data";

    const porQuem = colab?.nome ?? "a CLYON";
    const fechado = Boolean(linha.confirmadoEm || linha.pagoEm);
    const resumo =
      (quando
        ? `A CLYON (${porQuem}) marcou o trabalho de ${linha.profissionalNome} para ${fmt(quando)}` +
          (antes ? ` (estava ${fmt(antes)})` : "")
        : `A CLYON (${porQuem}) desmarcou o dia do trabalho de ${linha.profissionalNome}` +
          (antes ? ` (estava ${fmt(antes)})` : "")) +
      (fechado ? ". ATENÇÃO: o trabalho já estava fechado." : ".");

    await appendOrderHistory(linha.pedidoId, { type: "agenda", by: null, message: resumo });

    /* O profissional VÊ esta linha. Foi-lhe mudado o dia de trabalho por
       alguém que não é ele — descobri-lo ao chegar à porta não serve. */
    await registarSemFalhar({
      acontecimento: "agenda_marcada",
      pedidoId: linha.pedidoId,
      negociacaoId,
      providerId: linha.providerId,
      providerNome: linha.profissionalNome,
      autorTipo: "clyon",
      autorNome: porQuem,
      valor: null,
      resumo,
      visivelProfissional: true,
    });

    return NextResponse.json({ ok: true, dataCombinada: quando ? quando.toISOString() : null });
  } catch (e) {
    console.error("[api/admin/agenda] POST", e);
    return NextResponse.json({ error: "Não foi possível gravar a data." }, { status: 500 });
  }
}
