import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { levantamentoPorId, levantamentosParaAdmin, marcarLevantamento } from "@/lib/db";
import { formatarIban } from "@/lib/iban";
import { abatimentosDosLevantamentos } from "@/lib/pagamentos-na-base";
import { abaterDividasNoSaldo, previsaoDoAbatimento } from "@/lib/abater-dividas-no-saldo";

export const runtime = "nodejs";

/**
 * Os pedidos de transferência dos profissionais.
 *
 * Enquanto não houver ligação ao banco, é aqui que a transferência acontece:
 * alguém vê o pedido, faz a transferência no banco e marca como paga. O
 * profissional vê "a caminho" desde que pede — é honesto, e é melhor do que um
 * botão que promete instantâneo e depois demora dois dias.
 *
 * O IBAN sai INTEIRO nesta rota, ao contrário do que acontece do lado do
 * profissional: quem está aqui é para copiar para o banco. Daí exigir sessão de
 * administrador.
 *
 * E AS DÍVIDAS À CLYON — 01-10-2026, «abater no saldo». Cada levantamento por
 * transferir vem com a previsão (quanto ele deve, quanto se abate quando for
 * dado por pago), e cada um já pago com o que nele se abateu. Ver
 * `abater-dividas-no-saldo.ts`.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const linhas = await levantamentosParaAdmin();

    /*
     * Só se calcula a previsão para os por transferir — um por profissional,
     * no máximo (não pode pedir outro enquanto há um a ser processado) — e
     * nunca deita a lista abaixo: sem previsão, a linha mostra-se sem ela.
     */
    const porTransferir = [...new Set(linhas.filter((l) => l.estado === "pedido").map((l) => Number(l.providerId)))];
    const previsoes = new Map(
      await Promise.all(
        porTransferir.map(async (p) => [p, await previsaoDoAbatimento(p)] as const),
      ),
    );
    const abatidos = await abatimentosDosLevantamentos(
      linhas.filter((l) => l.estado === "pago").map((l) => Number(l.id)),
    ).catch(() => new Map<number, Array<{ negociacaoId: number; pedidoId: number; valor: number }>>());

    return NextResponse.json({
      levantamentos: linhas.map((l) => ({
        id: l.id,
        providerId: l.providerId,
        profissionalNome: l.profissionalNome,
        valor: Number(l.valor),
        iban: formatarIban(l.iban),
        titular: l.titular,
        estado: l.estado,
        nota: l.nota,
        processadoPor: l.processadoPor,
        processadoEm: l.processadoEm,
        createdAt: l.createdAt,
        dividas: l.estado === "pedido" ? (previsoes.get(Number(l.providerId)) ?? null) : null,
        abatido: abatidos.get(Number(l.id)) ?? [],
      })),
    });
  } catch (error) {
    console.error("[admin/levantamentos GET]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { id?: unknown; estado?: unknown; nota?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const id = Number(corpo.id);
  const estado = corpo.estado;
  if (!Number.isInteger(id) || (estado !== "pago" && estado !== "recusado")) {
    return NextResponse.json({ error: "Dados em falta." }, { status: 400 });
  }

  // Recusar sem dizer porquê deixa o profissional a ver o saldo voltar sem
  // explicação nenhuma — e a escrever para o apoio a perguntar o que se passou.
  const nota = typeof corpo.nota === "string" ? corpo.nota.trim().slice(0, 255) : "";
  if (estado === "recusado" && !nota) {
    return NextResponse.json({ error: "Escreva o motivo da recusa." }, { status: 400 });
  }

  try {
    const quem = String(colab?.nome ?? "admin");
    const feito = await marcarLevantamento(id, estado, quem, nota || undefined);
    if (!feito) {
      return NextResponse.json(
        { error: "Este pedido já tinha sido processado." },
        { status: 409 },
      );
    }

    /*
     * ABATER NO SALDO — 01-10-2026. Só depois de o levantamento estar dado
     * por pago (o UPDATE acima, que só pega uma vez), e só num pago: uma
     * recusa devolve o dinheiro ao disponível e não paga dívida nenhuma.
     * Nunca lança — a transferência já foi feita e registada.
     */
    let abatimento = null;
    if (estado === "pago") {
      const l = await levantamentoPorId(id);
      if (l) {
        abatimento = await abaterDividasNoSaldo(Number(l.providerId), {
          levantamentoId: id,
          autor: quem,
        });
      }
    }

    return NextResponse.json({ ok: true, abatimento });
  } catch (error) {
    console.error("[admin/levantamentos POST]", error);
    return NextResponse.json({ error: "Não foi possível processar" }, { status: 500 });
  }
}
