import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { configuracaoDoEupago, podeCobrar } from "@/lib/eupago";
import { A_PLATAFORMA_COBRA } from "@/lib/pagamento-na-plataforma";
import {
  avisosPorAplicar,
  resumoDosPagamentos,
  ultimosPagamentos,
} from "@/lib/pagamentos-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O QUE ENTROU PELO euPAGO — para a CLYON.
 *
 * Fase 2 do `docs/plano-pagamentos-eupago.md`. Só lê.
 *
 * O número que interessa neste ecrã não é o total recebido: é o dos **avisos
 * por aplicar**. Cada um deles é dinheiro que se moveu do lado do euPago e não
 * se moveu do nosso — um pagamento em duplicado por devolver, um valor que não
 * bate certo. Nenhum dá erro em lado nenhum, e por isso tem de haver um sítio
 * onde se vejam. O contrato ainda aperta o prazo: uma operação não autorizada
 * comunica-se em dois dias úteis.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  try {
    const conf = configuracaoDoEupago(process.env);
    const [resumo, ultimos, avisos] = await Promise.all([
      resumoDosPagamentos(),
      ultimosPagamentos(25),
      avisosPorAplicar(25),
    ]);

    return NextResponse.json({
      /*
       * O ESTADO DA LIGAÇÃO, dito como está — e sem nunca devolver a chave.
       *
       * «Não configurado» e «configurado mas com a porta fechada» são duas
       * situações diferentes com duas respostas diferentes, e quem olha para
       * este ecrã precisa de saber em qual das duas está.
       */
      ligacao: conf.ok
        ? {
            configurado: true,
            ambiente: conf.config.ambiente,
            temSegredoDoWebhook: Boolean(conf.config.segredoDoWebhook),
            aberta: podeCobrar(conf.config, A_PLATAFORMA_COBRA).pode,
            plataformaCobra: A_PLATAFORMA_COBRA,
            /*
             * Quantos emails podem pagar a sério antes de a cobrança abrir.
             * O NÚMERO e não a lista: quem administra precisa de saber que o
             * portão está aberto e para quantos, não de ver emails num ecrã
             * que se mostra a quem entra no backoffice.
             */
            testadores: conf.config.emailsDeTeste.length,
          }
        : { configurado: false, falta: conf.falta, plataformaCobra: A_PLATAFORMA_COBRA },
      resumo,
      ultimos,
      avisos,
    });
  } catch (error) {
    console.error("[admin/pagamentos]", error);
    return NextResponse.json({ error: "Não foi possível ler os pagamentos." }, { status: 500 });
  }
}
