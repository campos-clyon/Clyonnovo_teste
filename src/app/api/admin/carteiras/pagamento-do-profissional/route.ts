import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { appendOrderHistory, negociacoesDoProfissional, registar } from "@/lib/db";
import { trabalhosDaCarteira } from "@/lib/carteira-do-profissional";
import { dividasDe } from "@/lib/carteira";
import { registarRecebimentoAMao } from "@/lib/pagamentos-na-base";
import { configuracaoDoEupago } from "@/lib/eupago";
import {
  eMetodoDoProfissional,
  fraseDoPagamentoDoProfissional,
  planoDoPagamentoDoProfissional,
} from "@/lib/pagamento-da-divida";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «REGISTAR PAGAMENTO DO PROFISSIONAL À CLYON» — 01-11-2026 (dono).
 *
 * O profissional pagou a dívida (IVA e taxa da plataforma de trabalhos pagos
 * em mão) por outra via — transferência, MB WAY, numerário — e a equipa
 * regista-o: valor, método e nota. Fecha as dívidas inteiras que o valor
 * cobre, das mais antigas para as mais novas (`planoDoPagamentoDoProfissional`),
 * cada uma com a sua linha em `pagamentos` (o índice único impede repetir) e
 * no registo permanente, e o histórico de cada pedido diz «O profissional
 * pagou Y € à CLYON (método)», com quem e quando.
 *
 * NÃO MEXE NO SALDO: não é abatimento, não sai do «Pode pedir já» — liberta-o,
 * porque o que estava reservado para a dívida deixa de estar.
 *
 * Só o administrador (`requireAdminGeral`, e o prefixo em
 * `ESCRITAS_SO_DO_ADMINISTRADOR`).
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;

  let corpo: { providerId?: unknown; valor?: unknown; metodo?: unknown; nota?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const providerId = Number(corpo.providerId);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Profissional não indicado." }, { status: 400 });
  }
  if (!eMetodoDoProfissional(corpo.metodo)) {
    return NextResponse.json({ error: "Diga como pagou: transferência, MB WAY ou numerário." }, { status: 400 });
  }
  const metodo = corpo.metodo;
  const valor = Number(String(corpo.valor ?? "").replace(/\s|€/g, "").replace(",", "."));
  const nota = typeof corpo.nota === "string" ? corpo.nota.trim().slice(0, 255) : "";

  try {
    const agora = new Date();
    const linhas = await negociacoesDoProfissional(providerId);
    const trabalhos = await trabalhosDaCarteira(linhas);
    const plano = planoDoPagamentoDoProfissional(
      dividasDe(trabalhos, agora).filter((d) => !d.paga),
      valor,
    );
    if (!plano.ok) return NextResponse.json({ error: plano.porque }, { status: 409 });

    const conf = configuracaoDoEupago(process.env);
    const ambiente = conf.ok ? conf.config.ambiente : "producao";
    const porQuem = String(colab?.nome ?? "a CLYON");

    const fechadas: Array<{ negociacaoId: number; pedidoId: number | null; valor: number }> = [];
    const ficaram: number[] = [];
    for (const d of plano.fecha) {
      const pedidoId = linhas.find((l) => Number(l.id) === d.negociacaoId)?.pedidoId ?? null;
      const r = await registarRecebimentoAMao({
        negociacaoId: d.negociacaoId,
        pedidoId: pedidoId ?? 0,
        providerId,
        metodo,
        valor: d.total,
        quando: agora,
        ambiente,
        // Num trabalho da plataforma pago em mão a negociação já está fechada
        // pelo registo: a dívida vive numa linha à parte (`tridDoAbatimentoAParte`).
        aParte: d.aParte === true,
      });
      // Já paga entretanto (o índice disse que não): fica como está.
      if (!r.feito) {
        ficaram.push(d.negociacaoId);
        continue;
      }

      const frase = fraseDoPagamentoDoProfissional({ valor: d.total, metodo, pedidoId });
      // O registo É o trabalho aqui: se não se escrever, diz-se (lança).
      await registar({
        acontecimento: "divida_paga_pelo_profissional",
        pedidoId,
        negociacaoId: d.negociacaoId,
        providerId,
        autorTipo: "clyon",
        autorNome: porQuem,
        valor: d.total,
        resumo: frase + (nota ? ` Nota: ${nota}` : ""),
        detalhe: { pagamentoId: r.pagamentoId, metodo, iva: d.iva, comissao: d.comissao, nota: nota || null },
        visivelProfissional: true,
      });
      if (pedidoId != null) {
        await appendOrderHistory(pedidoId, {
          type: "created",
          by: null,
          message: `${frase} Registado por ${porQuem}.` + (nota ? ` Nota: ${nota}` : ""),
        }).catch(() => {});
      }
      fechadas.push({ negociacaoId: d.negociacaoId, pedidoId, valor: d.total });
    }

    if (fechadas.length === 0) {
      return NextResponse.json(
        { error: "Estas dívidas já estavam pagas entretanto. Recarregue a página." },
        { status: 409 },
      );
    }
    const total = Math.round(fechadas.reduce((s, f) => s + f.valor, 0) * 100) / 100;
    return NextResponse.json({ ok: true, total, fechadas, ficaram });
  } catch (e) {
    console.error("[admin/carteiras/pagamento-do-profissional]", e);
    const porque = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Não foi possível registar o pagamento.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}
