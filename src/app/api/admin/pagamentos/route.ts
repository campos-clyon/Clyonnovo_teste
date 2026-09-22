import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { configuracaoDoEupago, podeCobrar } from "@/lib/eupago";
import { A_PLATAFORMA_COBRA } from "@/lib/pagamento-na-plataforma";
import {
  avisosPorAplicar,
  estadoDoWebhook,
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
    const [resumo, ultimos, avisos, webhook] = await Promise.all([
      resumoDosPagamentos(),
      ultimosPagamentos(25),
      avisosPorAplicar(25),
      estadoDoWebhook(),
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
      /*
       * O QUE ANDA A ACONTECER À PORTA DOS AVISOS — ver `estadoDoWebhook`.
       *
       * «Nunca chegou nenhum» e «chegam e são recusados» são dois problemas
       * com dois consertos em sítios diferentes, e apareciam como o mesmo
       * silêncio. Quem procura sem isto passa a tarde no sítio errado.
       */
      webhook,
    });
  } catch (error) {
    /*
     * A MENSAGEM DIZ O QUE FALHOU, e não só que falhou.
     *
     * «Não foi possível ler os pagamentos» é uma parede: quem a lê fica sem
     * saber por onde começar, e a única pista ficava num registo do servidor a
     * que ninguém chega de um telemóvel. Isto é uma rota de administração — o
     * detalhe vai para quem já está autenticado, e poupou-me a adivinhar.
     */
    console.error("[admin/pagamentos]", error);
    const porque = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Não foi possível ler os pagamentos.", detalhe: porque.slice(0, 300) },
      { status: 500 },
    );
  }
}
