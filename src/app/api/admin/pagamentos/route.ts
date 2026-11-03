import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { configuracaoDoEupago, podeCobrar } from "@/lib/eupago";
import { O_CLIENTE_PAGA_SOZINHO } from "@/lib/pagamento-na-plataforma";
import {
  avisosPorAplicar,
  estadoDoWebhook,
  faturasPorEmitir,
  resumoDosPagamentos,
  ultimosPagamentos,
  transferenciasPendentes,
} from "@/lib/pagamentos-na-base";
import { trabalhosParaGerir } from "@/lib/trabalhos-para-gerir";
import { estadoVistoPeloCliente } from "@/lib/pagamento-para-o-cliente";

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

/*
 * QUEM VÊ — 03-10-2026, decisão do dono: o administrador, e o assistente com a
 * secção Pagamentos. Era `requireAdminGeral`. O assistente SÓ VÊ: registar o
 * que entrou, o que se pagou ao profissional, corrigir valores, excluir e
 * testar a chave do euPago continuam só do administrador.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  try {
    const conf = configuracaoDoEupago(process.env);
    const [resumo, ultimos, avisos, webhook, trabalhos, faturas, transferencias] = await Promise.all([
      resumoDosPagamentos(),
      // Os últimos de cada secção (à CLYON, aos profissionais) saem destes — 03-11-2026 (d3).
      ultimosPagamentos(80),
      avisosPorAplicar(25),
      estadoDoWebhook(),
      trabalhosParaGerir(),
      faturasPorEmitir(50),
      transferenciasPendentes(50).catch(() => []),
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
            aberta: podeCobrar(conf.config, O_CLIENTE_PAGA_SOZINHO).pode,
            plataformaCobra: O_CLIENTE_PAGA_SOZINHO,
            /*
             * Quantos emails podem pagar a sério antes de a cobrança abrir.
             * O NÚMERO e não a lista: quem administra precisa de saber que o
             * portão está aberto e para quantos, não de ver emails num ecrã
             * que se mostra a quem entra no backoffice.
             */
            testadores: conf.config.emailsDeTeste.length,
          }
        : { configurado: false, falta: conf.falta, plataformaCobra: O_CLIENTE_PAGA_SOZINHO },
      resumo,
      /*
       * O MB WAY SEM RESPOSTA MOSTRA-SE «EXPIRADO» TAMBÉM AQUI — 02-11-2026 (#551).
       * O 7a57cbc5 só o fazia na vista do cliente; a base continua «pendente»
       * (se o dinheiro entrar, o aviso ainda encontra a linha), mas a equipa
       * vê o mesmo que o cliente.
       */
      ultimos: ultimos.map((p) => ({ ...p, estado: estadoVistoPeloCliente(p) })),
      avisos,
      /*
       * O QUE ANDA A ACONTECER À PORTA DOS AVISOS — ver `estadoDoWebhook`.
       *
       * «Nunca chegou nenhum» e «chegam e são recusados» são dois problemas
       * com dois consertos em sítios diferentes, e apareciam como o mesmo
       * silêncio. Quem procura sem isto passa a tarde no sítio errado.
       */
      webhook,
      // As transferências bancárias à espera de «Recebido» (02-11-2026).
      transferenciasAEspera: transferencias,
      /*
       * UM TRABALHO POR LINHA, com as duas pontas do dinheiro.
       *
       * «Quem pagou, como pagou, e se já pagámos o profissional» são três
       * perguntas sobre a MESMA coisa, e viviam em quatro ecrãs: as Carteiras
       * (por profissional), os Levantamentos (quem pediu), o Livro (o que se
       * moveu) e isto (o que o euPago aceitou). Nenhum respondia por trabalho,
       * que é como a pergunta é feita.
       */
      trabalhos,
      /*
       * A FILA «FATURAS POR EMITIR» — 27-10-2026 (d16). Cada pagamento
       * confirmado com fatura, até alguém dizer que a fatura saiu.
       */
      faturasPorEmitir: faturas.map((p) => ({
        id: p.id,
        pedidoId: p.pedidoId,
        negociacaoId: p.negociacaoId,
        metodo: p.metodo,
        valor: p.valorPago ?? p.valor,
        pagoEm: p.pagoEm,
      })),
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
