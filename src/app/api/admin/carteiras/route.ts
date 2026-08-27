import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool, appendOrderHistory, registarSemFalhar } from "@/lib/db";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";

export const runtime = "nodejs";

/**
 * As carteiras de todos os profissionais, e por onde lhes pagar.
 *
 * "Todos esses pedidos já foram concluídos e recebemos os pagamentos, mas não
 * tenho acesso aos dados dos pros para efectuar o pagamento deles manual —
 * enquanto estamos à espera do eupago validar a nossa conta. Devíamos ver o
 * IBAN dos pros, nome completo e morada fiscal, assim como o MB WAY como outra
 * opção de pagamento."
 *
 * O ecrã dos LEVANTAMENTOS mostra só quem PEDIU para receber, e hoje não pediu
 * ninguém — porque para pedir é preciso ter IBAN gravado, e dois dos três
 * profissionais com trabalho por pagar não o têm. O dinheiro do cliente entrou,
 * o trabalho está confirmado, e a fila estava vazia: um ecrã a dizer "nada por
 * transferir" com 570 € por transferir.
 *
 * Esta rota olha para o outro lado: não para quem pediu, mas para quem TEM A
 * RECEBER. É a pergunta certa enquanto o pagamento for feito à mão.
 *
 * O IBAN VAI INTEIRO, e é a única rota da casa onde isso acontece: em todo o
 * resto ele volta encurtado. Aqui o número é o produto — sem ele não há
 * transferência — e quem chega aqui já passou pelo `requireAdmin`.
 */

type TrabalhoPorPagar = {
  negociacaoId: number;
  pedidoId: number;
  servico: string | null;
  cidade: string | null;
  valorAcordado: number;
  recebe: number;
  confirmadoEm: string | null;
};

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      `SELECT p.id, p.name, p.email, p.phone, p.nif, p.estado, p.isActive,
              p.iban, p.ibanTitular, p.mbway,
              p.moradaFiscal, p.codigoPostalFiscal, p.localidadeFiscal,
              p.regimeIva, p.emiteFatura,
              n.id AS negociacaoId, n.pedidoId, n.valorAcordado,
              n.confirmadoEm, n.pagoEm,
              o.serviceType, o.city
         FROM providers p
         LEFT JOIN negociacoes n
           ON n.providerId = p.id AND n.estado = 'acordada' AND n.confirmadoEm IS NOT NULL
         LEFT JOIN simulatorOrders o ON o.id = n.pedidoId
        WHERE p.isClyon = 0
        ORDER BY p.name, n.confirmadoEm`,
    )) as [Array<Record<string, unknown>>, unknown];

    const porProfissional = new Map<number, ReturnType<typeof novaFicha>>();

    function novaFicha(l: Record<string, unknown>) {
      return {
        id: Number(l.id),
        nome: String(l.name ?? ""),
        email: (l.email as string) ?? null,
        telefone: (l.phone as string) ?? null,
        nif: (l.nif as string) ?? null,
        estado: (l.estado as string) ?? null,
        activo: Number(l.isActive) === 1,
        /* Para onde vai o dinheiro. */
        iban: (l.iban as string) ?? null,
        ibanTitular: (l.ibanTitular as string) ?? null,
        mbway: (l.mbway as string) ?? null,
        /* Para a factura, que é outra coisa. */
        moradaFiscal: (l.moradaFiscal as string) ?? null,
        codigoPostalFiscal: (l.codigoPostalFiscal as string) ?? null,
        localidadeFiscal: (l.localidadeFiscal as string) ?? null,
        regimeIva: (l.regimeIva as string) ?? null,
        emiteFatura: Number(l.emiteFatura) === 1,
        porPagar: [] as TrabalhoPorPagar[],
        jaPago: 0,
        totalPorPagar: 0,
      };
    }

    for (const l of linhas) {
      const id = Number(l.id);
      if (!porProfissional.has(id)) porProfissional.set(id, novaFicha(l));
      const ficha = porProfissional.get(id)!;

      if (l.negociacaoId == null || l.valorAcordado == null) continue;
      const acordado = Number(l.valorAcordado);
      const recebe = quantoOProfissionalRecebe(acordado);

      if (l.pagoEm != null) {
        ficha.jaPago = Math.round((ficha.jaPago + recebe) * 100) / 100;
        continue;
      }
      ficha.porPagar.push({
        negociacaoId: Number(l.negociacaoId),
        pedidoId: Number(l.pedidoId),
        servico: (l.serviceType as string) ?? null,
        cidade: (l.city as string) ?? null,
        valorAcordado: acordado,
        recebe,
        confirmadoEm: l.confirmadoEm ? new Date(l.confirmadoEm as string).toISOString() : null,
      });
      ficha.totalPorPagar = Math.round((ficha.totalPorPagar + recebe) * 100) / 100;
    }

    /*
     * Quem tem dinheiro à espera vem primeiro, e do maior para o menor: é a
     * ordem por que se fazem as transferências. Os outros ficam em baixo,
     * porque a ficha deles continua a ser útil — é lá que se vê que falta o
     * IBAN antes de haver trabalho para pagar.
     */
    const carteiras = [...porProfissional.values()].sort(
      (a, b) => b.totalPorPagar - a.totalPorPagar || a.nome.localeCompare(b.nome, "pt"),
    );

    const total = carteiras.reduce((s, c) => s + c.totalPorPagar, 0);
    const semComoPagar = carteiras.filter((c) => c.totalPorPagar > 0 && !c.iban && !c.mbway).length;

    return NextResponse.json({
      carteiras,
      total: Math.round(total * 100) / 100,
      semComoPagar,
    });
  } catch (e) {
    console.error("[api/admin/carteiras]", e);
    return NextResponse.json({ error: "Erro ao listar as carteiras" }, { status: 500 });
  }
}

/**
 * Marcar um trabalho como pago, depois de a transferência sair do banco.
 *
 * `pagoEm` é a data que fecha o dinheiro: é ela que a carteira do profissional
 * lê para deixar de o mostrar como disponível. Sem isto, o backoffice pagava e
 * o painel dele continuava a dizer que tinha saldo à espera — e o próximo
 * pagamento saía duas vezes.
 *
 * Os guardas vivem no SQL: só marca o que está acordado, confirmado e por
 * pagar. Carregar duas vezes no mesmo botão não paga duas vezes.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; nota?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const nota =
    typeof corpo.nota === "string" && corpo.nota.trim().length > 0
      ? corpo.nota.trim().slice(0, 200)
      : null;

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [antes] = (await pool.execute(
      `SELECT n.pedidoId, n.valorAcordado, p.name AS profissionalNome
         FROM negociacoes n JOIN providers p ON p.id = n.providerId
        WHERE n.id = ? LIMIT 1`,
      [negociacaoId],
    )) as [Array<{ pedidoId: number; valorAcordado: string | null; profissionalNome: string }>, unknown];
    const linha = antes[0];
    if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });

    const [res] = (await pool.execute(
      `UPDATE negociacoes SET pagoEm = NOW()
        WHERE id = ? AND estado = 'acordada'
          AND confirmadoEm IS NOT NULL AND pagoEm IS NULL`,
      [negociacaoId],
    )) as [{ affectedRows?: number }, unknown];

    if (Number(res?.affectedRows ?? 0) === 0) {
      return NextResponse.json(
        { error: "Não há nada para pagar: ou o trabalho não está confirmado, ou já foi pago." },
        { status: 409 },
      );
    }

    const recebe =
      linha.valorAcordado != null ? quantoOProfissionalRecebe(Number(linha.valorAcordado)) : null;
    const porQuem = colab?.nome ?? "a CLYON";
    const quanto = recebe != null ? `${recebe.toFixed(2).replace(".", ",")} €` : "o valor acordado";

    await appendOrderHistory(linha.pedidoId, {
      type: "created",
      by: null,
      message:
        `Pagamento a ${linha.profissionalNome} marcado como feito por ${porQuem} — ${quanto}` +
        (nota ? ` (${nota})` : "") +
        ". Transferência feita fora da plataforma.",
    });

    await registarSemFalhar({
      acontecimento: "levantamento_pago",
      pedidoId: linha.pedidoId,
      negociacaoId,
      autorTipo: "clyon",
      autorNome: porQuem,
      valor: recebe,
      resumo:
        `Pagamento manual a ${linha.profissionalNome} de ${quanto}, marcado por ${porQuem}` +
        (nota ? `: ${nota}` : ""),
    });

    return NextResponse.json({ ok: true, pago: recebe });
  } catch (e) {
    console.error("[api/admin/carteiras POST]", e);
    return NextResponse.json({ error: "Não foi possível marcar como pago" }, { status: 500 });
  }
}
