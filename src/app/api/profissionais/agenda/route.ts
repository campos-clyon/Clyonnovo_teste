import { NextRequest, NextResponse } from "next/server";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { getPool, appendOrderHistory, registarSemFalhar } from "@/lib/db";

export const runtime = "nodejs";

/**
 * O PROFISSIONAL MARCA — E CORRIGE — O DIA DO TRABALHO.
 *
 * "Também deve ter a opção do pro corrigir a sua agenda, podendo alterar
 * horário e data."
 *
 * Até aqui a data era só do cliente: ele pedia «quinta de manhã» no
 * formulário e mais ninguém lhe podia tocar. Mas quem combina o dia a sério é
 * o profissional, ao telefone, depois de ser contratado — e o que ficava
 * combinado vivia na cabeça dos dois e em mais lado nenhum. A agenda do
 * backoffice não tinha como saber se um trabalho estava a horas, porque não
 * havia hora nenhuma gravada.
 *
 * NÃO ESCREVE POR CIMA DO QUE O CLIENTE PEDIU. Vai para `dataCombinada`, na
 * negociação; `simulatorOrders.dataAgendada` fica intacta. É assim que se
 * continua a ver que um trabalho pedido para quinta acabou marcado para
 * sábado — e essa diferença é exactamente o que interessa numa agenda.
 *
 * A NEGOCIAÇÃO TEM DE SER DELE. O `providerId` sai da sessão e entra no
 * WHERE: sem isso, bastava mudar um número no corpo do pedido para remarcar
 * o trabalho de outra pessoa.
 */
export async function POST(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

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

  /*
   * Vazio APAGA a marcação, e é de propósito.
   *
   * Um dia que se desmarcou é diferente de um dia que nunca se marcou apenas
   * para quem já o sabia. Para o ecrã são a mesma coisa: «falta combinar», que
   * é o estado accionável.
   */
  const cru = typeof corpo.quando === "string" ? corpo.quando.trim() : "";
  let quando: Date | null = null;
  if (cru) {
    const d = new Date(cru);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }
    /*
     * Um tecto de dois anos. Não é desconfiança: `datetime-local` deixa
     * escrever o ano 2206 sem se dar por isso, e um trabalho a 180 anos de
     * distância nunca mais sai da lista de «por vir».
     */
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
      `SELECT id, pedidoId, estado, dataCombinada, confirmadoEm, pagoEm
         FROM negociacoes
        WHERE id = ? AND providerId = ? LIMIT 1`,
      [negociacaoId, sessao.providerId],
    )) as [
      Array<{
        pedidoId: number;
        estado: string;
        dataCombinada: Date | null;
        confirmadoEm: Date | null;
        pagoEm: Date | null;
      }>,
      unknown,
    ];
    const linha = linhas[0];
    if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });

    if (linha.estado !== "acordada") {
      return NextResponse.json(
        { error: "Só se marca o dia de um trabalho que já é seu." },
        { status: 409 },
      );
    }

    /*
     * Depois de confirmado, a data deixa de ser um plano e passa a ser o
     * registo do que aconteceu. Mudá-la seria reescrever o passado.
     */
    if (linha.confirmadoEm || linha.pagoEm) {
      return NextResponse.json(
        { error: "Este trabalho já está fechado — a data já não se muda." },
        { status: 409 },
      );
    }

    await pool.execute(
      "UPDATE negociacoes SET dataCombinada = ? WHERE id = ? AND providerId = ?",
      [quando, negociacaoId, sessao.providerId],
    );

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

    const resumo = quando
      ? `${sessao.nome} marcou o trabalho para ${fmt(quando)}` +
        (antes ? ` (estava ${fmt(antes)})` : "")
      : `${sessao.nome} desmarcou o dia do trabalho${antes ? ` (estava ${fmt(antes)})` : ""}`;

    await appendOrderHistory(linha.pedidoId, { type: "agenda", by: null, message: resumo });
    await registarSemFalhar({
      acontecimento: "agenda_marcada",
      pedidoId: linha.pedidoId,
      negociacaoId,
      autorTipo: "profissional",
      autorNome: sessao.nome,
      valor: null,
      resumo,
    });

    return NextResponse.json({ ok: true, dataCombinada: quando ? quando.toISOString() : null });
  } catch (e) {
    console.error("[api/profissionais/agenda]", e);
    return NextResponse.json({ error: "Não foi possível gravar a data." }, { status: 500 });
  }
}
