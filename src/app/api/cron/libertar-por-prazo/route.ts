import { NextRequest, NextResponse } from "next/server";
import { libertarTrabalhosPorPrazo, registarSemFalhar } from "@/lib/db";
import { avisarProfissionalTrabalhoConfirmado } from "@/lib/avisar-confirmacao";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "@/lib/trabalho";

export const runtime = "nodejs";

/**
 * Gravar a libertação por prazo dos trabalhos que o cliente nunca confirmou.
 *
 * A FUNÇÃO EXISTIA E NINGUÉM A CHAMAVA
 *
 * `libertarTrabalhosPorPrazo` estava escrita em db.ts, com o comentário a
 * explicar porque era precisa — e não tinha um único chamador. Era código
 * morto desde o dia em que foi escrita.
 *
 * A carteira do profissional CALCULA a libertação a partir da data da entrega,
 * por isso ele via o dinheiro como disponível e ninguém deu por nada. Mas a
 * coluna `confirmadoEm` ficava NULL para sempre, e é essa data que:
 *
 *   · fecha o trabalho no painel — que dizia "a aguardar confirmação" um ano
 *     depois de estar tudo pago;
 *   · deixa apagar o pedido, que de outra forma bate no guarda do trabalho em
 *     curso;
 *   · deixa apagar a conta do profissional ou a do cliente, pela mesma razão.
 *
 * Ou seja: um cliente que simplesmente não voltasse ao site prendia para
 * sempre o pedido dele, a conta dele e a conta do profissional. Sem erro
 * nenhum, sem aviso nenhum, e sem ninguém do lado de dentro conseguir desfazer.
 *
 * TODOS OS DIAS, E NÃO À SEGUNDA
 *
 * O prazo é de sete dias a contar da entrega. Um trabalho entregue a uma
 * terça-feira cumpre o prazo na terça seguinte — com um cron semanal esperaria
 * até seis dias a mais por uma data que já era devida.
 */
export async function GET(req: NextRequest) {
  // Falha fechada: sem CRON_SECRET definido, a rota recusa. Aberta, seria um
  // endereço público que mexe em datas de pagamento.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/libertar-por-prazo] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const libertados = await libertarTrabalhosPorPrazo(DIAS_ATE_LIBERTAR_SOZINHO);

    // Só se regista quando houve alguma coisa: uma linha por dia a dizer
    // "zero" enterrava as que interessam.
    if (libertados.length > 0) {
      await registarSemFalhar({
        acontecimento: "execucao_confirmada",
        autorTipo: "sistema",
        autorNome: "prazo",
        resumo:
          `${libertados.length} trabalho(s) libertado(s) por prazo — ` +
          `${DIAS_ATE_LIBERTAR_SOZINHO} dias sem resposta do cliente`,
      });

      // Um email por trabalho, em série e sem pressa: é um cron, ninguém está
      // à espera da resposta, e o Resend prefere isto a uma rajada.
      for (const l of libertados) {
        await avisarProfissionalTrabalhoConfirmado(l);
      }
    }

    return NextResponse.json({ ok: true, libertados: libertados.length });
  } catch (error) {
    console.error("[cron/libertar-por-prazo]", error);
    return NextResponse.json({ error: "Erro ao libertar" }, { status: 500 });
  }
}
