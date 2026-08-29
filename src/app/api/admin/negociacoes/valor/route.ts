import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { getPool, appendOrderHistory, registarSemFalhar } from "@/lib/db";
import {
  quantoOProfissionalRecebe,
  contaDoCliente,
  regimeDeIva,
} from "@/lib/taxas-plataforma";

export const runtime = "nodejs";

/**
 * CORRIGIR O VALOR DE UM TRABALHO JÁ FECHADO.
 *
 * "Me dê a opção de editar o valor, pois tem trabalhos que o orçamento é no
 * local e que muda — ex.: esse trabalho foi 230."
 *
 * O valor acordado era imutável depois do aperto de mão, e a realidade não é
 * assim: numa boa parte dos trabalhos o orçamento fecha-se à porta, com as
 * coisas à vista. O #242 foi combinado a 135 € e o trabalho foram 230 — sem
 * esta rota, o profissional recebia 128,25 € de um trabalho de 218,50 €, e a
 * única saída era pagar-lhe por fora, fora da carteira e fora das contas.
 *
 * O VALOR MEXE EM TUDO O RESTO, e por isso é uma rota e não um UPDATE:
 * do valor acordado saem o que o profissional recebe, o que o cliente paga, o
 * IVA e a comissão da casa. Aqui muda-se um número só e tudo o resto volta a
 * ser calculado a partir dele — em vez de ficarem quatro números gravados a
 * discordar uns dos outros.
 *
 * FICA SEMPRE REGISTO. Mudar um valor combinado depois de combinado é uma
 * decisão com duas pessoas do lado de lá, e daqui a três meses ninguém se
 * lembra porque é que 135 passaram a 230. O histórico do pedido guarda o antes,
 * o depois, quem mudou e porquê.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { negociacaoId?: unknown; valor?: unknown; motivo?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  const valor = Number(corpo.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "O valor tem de ser um número acima de zero." }, { status: 400 });
  }
  /*
   * Um tecto, e não por desconfiança: um dedo a mais no teclado transforma
   * 230 em 2300, e o erro só aparece na transferência. Cem mil euros é muito
   * acima de qualquer trabalho real desta plataforma e muito abaixo de um
   * engano de tecla.
   */
  if (valor > 100_000) {
    return NextResponse.json(
      { error: "Valor acima do razoável. Confirme antes de gravar." },
      { status: 400 },
    );
  }
  const novo = Math.round(valor * 100) / 100;

  const motivo =
    typeof corpo.motivo === "string" && corpo.motivo.trim().length > 0
      ? corpo.motivo.trim().slice(0, 300)
      : null;

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      `SELECT n.pedidoId, n.estado, n.valorAcordado, n.confirmadoEm, n.pagoEm,
              p.name AS profissionalNome, p.regimeIva
         FROM negociacoes n JOIN providers p ON p.id = n.providerId
        WHERE n.id = ? LIMIT 1`,
      [negociacaoId],
    )) as [
      Array<{
        pedidoId: number;
        estado: string;
        valorAcordado: string | null;
        confirmadoEm: Date | null;
        pagoEm: Date | null;
        profissionalNome: string;
        regimeIva: string | null;
      }>,
      unknown,
    ];
    const linha = linhas[0];
    if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });

    /*
     * SÓ SE CORRIGE O QUE ESTÁ FECHADO.
     *
     * Numa negociação a decorrer o valor muda-se propondo — é isso que a
     * negociação é. Mexer no número por baixo, enquanto os dois lados estão a
     * responder um ao outro, seria mudar as regras a meio do jogo.
     */
    if (linha.estado !== "acordada") {
      return NextResponse.json(
        {
          error:
            "Este trabalho ainda não está fechado. Enquanto se negoceia, o valor muda-se com uma proposta.",
        },
        { status: 409 },
      );
    }

    const antigo = linha.valorAcordado != null ? Number(linha.valorAcordado) : null;
    if (antigo != null && Math.abs(antigo - novo) < 0.005) {
      return NextResponse.json({ error: "O valor é o mesmo." }, { status: 400 });
    }

    /*
     * JÁ PAGO EXIGE MOTIVO.
     *
     * Depois da transferência, o número deixou de ser uma combinação e passou
     * a ser um facto contabilístico. Ainda se corrige — um engano registado é
     * pior do que um engano corrigido — mas não em silêncio.
     */
    if (linha.pagoEm && !motivo) {
      return NextResponse.json(
        {
          error:
            "Este trabalho já foi pago. Para mudar o valor agora, escreva o motivo — fica no histórico.",
          precisaMotivo: true,
        },
        { status: 409 },
      );
    }

    await pool.execute("UPDATE negociacoes SET valorAcordado = ? WHERE id = ?", [
      novo,
      negociacaoId,
    ]);

    const regime = regimeDeIva(linha.regimeIva);
    const recebe = quantoOProfissionalRecebe(novo);
    const conta = contaDoCliente(novo, regime);
    const eur = (v: number) => v.toFixed(2).replace(".", ",") + " €";

    const porQuem = colab?.nome ?? "a CLYON";
    const conta_ = 
      `Valor de ${linha.profissionalNome} corrigido de ` +
      `${antigo != null ? eur(antigo) : "(sem valor)"} para ${eur(novo)} por ${porQuem}. ` +
      `Ele passa a receber ${eur(recebe)}; o cliente paga ${eur(conta.total)}.` +
      (linha.pagoEm ? " ATENÇÃO: o trabalho já estava pago." : "") +
      (motivo ? ` Motivo: ${motivo}` : "");

    await appendOrderHistory(linha.pedidoId, {
      type: "valor_corrigido",
      by: null,
      message: conta_,
    });

    await registarSemFalhar({
      acontecimento: "valor_corrigido",
      pedidoId: linha.pedidoId,
      negociacaoId,
      autorTipo: "clyon",
      autorNome: porQuem,
      valor: novo,
      resumo: conta_,
    });

    return NextResponse.json({
      ok: true,
      valorAcordado: novo,
      recebe,
      clientePaga: conta.total,
      jaPago: Boolean(linha.pagoEm),
    });
  } catch (e) {
    console.error("[api/admin/negociacoes/valor]", e);
    return NextResponse.json({ error: "Não foi possível gravar o valor." }, { status: 500 });
  }
}
