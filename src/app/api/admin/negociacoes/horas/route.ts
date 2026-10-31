import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import { gravarHorasDoTrabalho, negociacoesDoPedido } from "@/lib/db";
import { confirmarAsHoras, resumoDaLinha } from "@/lib/horas-no-servidor";
import {
  aDevolverEmPalavras,
  estadoDasHorasParaQuemFez,
  horasConfirmadas,
  horasContestadas,
  horasMarcadas,
  intervaloDasHoras,
  lerQuemConfirmouAsHoras,
  totalDasHoras,
  valorPorHoraDe,
} from "@/lib/horas-do-trabalho";
import { lerMateriaisDaProposta, lerQuantidadesUsadas, materiaisParaOProfissional, materiaisUsados } from "@/lib/materiais-da-proposta";
import { trabalhoVistoPeloBackoffice } from "@/lib/acesso-ao-pagamento";
import { pagamentosDaNegociacao } from "@/lib/pagamentos-na-base";
import { acertoDasHoras } from "@/lib/pagamento-para-o-cliente";
import { diaEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";

export const runtime = "nodejs";

/**
 * AS HORAS DE UM TRABALHO POR HORA, NO BACKOFFICE — 31-10-2026.
 *
 * GET `?pedidoId&negociacaoId`: o resumo (início, fim, horas, total, quem
 * confirmou e quando, o «Não concordo» do cliente) e o acerto do dinheiro — a
 * diferença que o cliente ainda paga, ou o «a devolver ao cliente», que a
 * equipa trata à mão (nunca se devolve sozinho).
 *
 * POST `{ pedidoId, negociacaoId, accao }`, só administradores (muda o valor
 * do trabalho, como o ajuste):
 *   · «confirmar» — confirma as horas como estão, pela CLYON;
 *   · «corrigir» — a CLYON escreve outras horas (`dia`, `inicio`, `fim`,
 *     `materiais`) e confirma-as no mesmo passo: é assim que se resolve um
 *     «Não concordo» falado com os dois.
 */

async function oTrabalho(pedidoId: number, negociacaoId: number) {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !Number.isInteger(negociacaoId) || negociacaoId <= 0) return null;
  return (await negociacoesDoPedido(pedidoId)).find((n) => Number(n.id) === negociacaoId) ?? null;
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const p = req.nextUrl.searchParams;
  const linha = await oTrabalho(Number(p.get("pedidoId")), Number(p.get("negociacaoId")));
  if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
  try {
    const resumo = resumoDaLinha(linha as never);
    let acerto: ReturnType<typeof acertoDasHoras> = null;
    const acesso = await trabalhoVistoPeloBackoffice(Number(linha.id));
    if (acesso.ok) acerto = acertoDasHoras(acesso.trabalho, await pagamentosDaNegociacao(Number(linha.id)));
    const m = lerMateriaisDaProposta((linha as { materiaisJson?: string | null }).materiaisJson ?? null);
    return NextResponse.json({
      marcadas: horasMarcadas(linha as never),
      confirmadas: horasConfirmadas(linha as never),
      confirmadasPor: lerQuemConfirmouAsHoras((linha as { horasConfirmadasPor?: unknown }).horasConfirmadasPor),
      contestadas: horasContestadas(linha as never),
      contestacao: (linha as { horasContestacao?: string | null }).horasContestacao ?? null,
      estadoTexto: estadoDasHorasParaQuemFez(linha as never),
      resumo,
      materiaisTexto: materiaisParaOProfissional(m),
      acerto: acerto
        ? {
            ...acerto,
            aDevolverTexto: acerto.aDevolver > 0 ? aDevolverEmPalavras(acerto.aDevolver) : null,
          }
        : null,
    });
  } catch (e) {
    console.error("[admin/negociacoes/horas GET]", e);
    return NextResponse.json({ error: "Não foi possível ler as horas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: {
    pedidoId?: unknown;
    negociacaoId?: unknown;
    accao?: unknown;
    dia?: unknown;
    inicio?: unknown;
    fim?: unknown;
    materiais?: unknown;
  };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pedidoId = Number(corpo.pedidoId);
  const negociacaoId = Number(corpo.negociacaoId);
  const linha = await oTrabalho(pedidoId, negociacaoId);
  if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
  if (corpo.accao !== "confirmar" && corpo.accao !== "corrigir") {
    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  }
  await assumirPedidoSeLivre(pedidoId, colab);
  const porQuem = colab?.nome ?? "a CLYON";

  try {
    let comHoras = linha as Record<string, unknown>;
    if (corpo.accao === "corrigir") {
      if (horasConfirmadas(linha as never)) {
        return NextResponse.json({ error: "As horas já estão confirmadas." }, { status: 409 });
      }
      const inicioGravado = instanteDaBase((linha as { horasInicioEm?: Date | string | null }).horasInicioEm ?? null);
      const dia =
        typeof corpo.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.dia)
          ? corpo.dia
          : diaEmLisboa(inicioGravado ?? instanteDaBase((linha as { chegouEm?: Date | string | null }).chegouEm ?? null) ?? new Date());
      const lido = intervaloDasHoras({ dia, inicio: corpo.inicio, fim: corpo.fim });
      if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
      const valorPorHora = valorPorHoraDe(linha as never);
      if (valorPorHora == null || valorPorHora <= 0) {
        return NextResponse.json({ error: "Este trabalho não tem valor por hora acordado." }, { status: 409 });
      }
      const m = lerMateriaisDaProposta((linha as { materiaisJson?: string | null }).materiaisJson ?? null);
      const quantidades = lerQuantidadesUsadas(corpo.materiais, m);
      const usados = materiaisUsados(m, quantidades);
      const valorDasHoras = totalDasHoras(valorPorHora, lido.intervalo.horasFaturadas, usados.total);
      const materiaisUsadosJson = Object.keys(quantidades).length > 0 ? JSON.stringify(quantidades) : null;
      const gravou = await gravarHorasDoTrabalho(negociacaoId, Number(linha.providerId), {
        inicioEm: lido.intervalo.inicioEm,
        fimEm: lido.intervalo.fimEm,
        minutos: lido.intervalo.minutos,
        horasFaturadas: lido.intervalo.horasFaturadas,
        valorPorHora,
        valorDasHoras,
        materiaisUsadosJson,
      });
      if (!gravou) return NextResponse.json({ error: "As horas já não se podem mudar." }, { status: 409 });
      comHoras = {
        ...comHoras,
        horasInicioEm: lido.intervalo.inicioEm,
        horasFimEm: lido.intervalo.fimEm,
        horasMinutos: lido.intervalo.minutos,
        horasFaturadas: lido.intervalo.horasFaturadas,
        valorPorHora,
        valorDasHoras,
        materiaisUsadosJson,
        horasMarcadasEm: new Date(),
        horasContestadasEm: null,
        horasContestacao: null,
      };
    }
    const r = await confirmarAsHoras({
      negociacaoId,
      pedidoId,
      providerId: Number(linha.providerId),
      por: "clyon",
      onde: corpo.accao === "corrigir" ? `corrigidas no backoffice por ${porQuem}` : `no backoffice por ${porQuem}`,
      autorNome: porQuem,
      linha: comHoras as never,
    });
    return NextResponse.json(r.corpo, { status: r.status });
  } catch (e) {
    console.error("[admin/negociacoes/horas POST]", e);
    return NextResponse.json({ error: "Não foi possível gravar as horas." }, { status: 500 });
  }
}
