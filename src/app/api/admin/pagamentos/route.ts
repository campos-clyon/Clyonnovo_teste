import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { configuracaoDoEupago, podeCobrar } from "@/lib/eupago";
import { A_PLATAFORMA_COBRA } from "@/lib/pagamento-na-plataforma";
import { getPool } from "@/lib/db";
import { faseDoDinheiro } from "@/lib/dinheiro-do-trabalho";
import { quantoOProfissionalRecebe, taxasDaNegociacao, contaDoCliente } from "@/lib/taxas-plataforma";
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
export type TrabalhoParaGerir = {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  cliente: string | null;
  telefoneDoCliente: string | null;
  cidade: string | null;
  servico: string | null;
  profissional: string;
  /** O que o cliente paga, já com a taxa e o imposto de quem factura. */
  clientePaga: number;
  /** O que o profissional recebe, líquido. */
  profissionalRecebe: number;
  formaDePagamento: string | null;
  comoEntrou: string | null;
  clientePagouEm: string | null;
  confirmadoEm: string | null;
  pagoEm: string | null;
  fase: string;
};

/**
 * Todos os trabalhos fechados, com as duas pontas do dinheiro numa linha.
 *
 * O `LEFT JOIN` ao pagamento pago é a peça nova: sem ele, «o cliente pagou»
 * era uma pergunta que só se respondia trabalho a trabalho. `negociacaoPaga`
 * tem índice único, por isso o join nunca duplica a linha.
 */
async function trabalhosParaGerir(): Promise<TrabalhoParaGerir[]> {
  const pool = await getPool();
  if (!pool) return [];

  const [linhas] = (await pool.execute(
    `SELECT n.id AS negociacaoId, n.pedidoId, n.providerId, n.valorAcordado,
            n.taxaCliente, n.taxaProfissional, n.formaDePagamento,
            n.confirmadoEm, n.pagoEm,
            o.contactName, o.contactPhone, o.city, o.serviceType,
            pr.name AS profissional,
            pg.metodo AS comoEntrou, pg.pagoEm AS clientePagouEm
       FROM negociacoes n
       JOIN providers pr ON pr.id = n.providerId
       LEFT JOIN simulatorOrders o ON o.id = n.pedidoId
       LEFT JOIN pagamentos pg ON pg.negociacaoPaga = n.id
      WHERE n.estado = 'acordada' AND n.valorAcordado IS NOT NULL
      ORDER BY n.updatedAt DESC
      LIMIT 400`,
  )) as [Array<Record<string, unknown>>, unknown];

  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

  return linhas.map((l) => {
    const acordado = Number(l.valorAcordado);
    const taxas = taxasDaNegociacao(l);
    const base = {
      formaDePagamento: (l.formaDePagamento as string) ?? null,
      comoEntrou: (l.comoEntrou as string) ?? null,
      clientePagouEm: iso(l.clientePagouEm),
      confirmadoEm: iso(l.confirmadoEm),
      pagoEm: iso(l.pagoEm),
    };
    return {
      negociacaoId: Number(l.negociacaoId),
      pedidoId: Number(l.pedidoId),
      providerId: Number(l.providerId),
      cliente: ((l.contactName as string) ?? "").trim() || null,
      telefoneDoCliente: ((l.contactPhone as string) ?? "").trim() || null,
      cidade: (l.city as string) ?? null,
      servico: (l.serviceType as string) ?? null,
      profissional: String(l.profissional ?? ""),
      clientePaga: contaDoCliente(acordado, taxas).total,
      profissionalRecebe: quantoOProfissionalRecebe(acordado, taxas),
      ...base,
      fase: faseDoDinheiro(base),
    };
  });
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  try {
    const conf = configuracaoDoEupago(process.env);
    const [resumo, ultimos, avisos, webhook, trabalhos] = await Promise.all([
      resumoDosPagamentos(),
      ultimosPagamentos(25),
      avisosPorAplicar(25),
      estadoDoWebhook(),
      trabalhosParaGerir(),
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
