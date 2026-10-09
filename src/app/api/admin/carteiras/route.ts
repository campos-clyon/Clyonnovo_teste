import { NextRequest, NextResponse } from "next/server";
import { lerForma } from "@/lib/forma-de-pagamento";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { getPool, appendOrderHistory, registarSemFalhar } from "@/lib/db";
import {
  quantoOProfissionalRecebe,
  comissaoDaClyon,
  contaDoCliente,
  taxasDaNegociacao,
} from "@/lib/taxas-plataforma";
import { precoDoCliente } from "@/lib/preco-do-cliente";
import { modeloDaNegociacao } from "@/lib/iva-incluido";
import { dividaDoProfissional, temDividaDoProfissional } from "@/lib/divida-do-profissional";
import { negociacoesPagas } from "@/lib/pagamentos-na-base";
import { lucroDoTrabalho } from "@/lib/assistentes";

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
  /** Quem contratou. É por aqui que se reconhece o trabalho. */
  cliente: string | null;
  telefoneDoCliente: string | null;
  morada: string | null;
  /** O dia combinado, quando há. Muita gente lembra-se do dia e não do número. */
  quando: string | null;
  /** Quem o fez. Vem na linha para ela se explicar fora do cartão. */
  profissional: string;
  valorAcordado: number;
  recebe: number;
  confirmadoEm: string | null;
  /** Prova enviada, à espera de confirmação — ou ainda por fazer. */
  aguardaConfirmacao: boolean;
  /*
   * A CONTA DO TRABALHO, POR EXTENSO — 01-10-2026.
   *
   * *«Não consigo ver de qual trabalho se trata os valores; deve ter mais
   * informações.»* A linha dizia «Acordado 190,00 € · ele recebe 178,60 €» e
   * nada mais: de onde vinham os 11,40 € de diferença, quanto pagou o cliente,
   * quando foi feito, quando foi confirmado. Estava tudo na consulta e ficava
   * aqui dentro.
   */
  /** Quando ele deu o trabalho por feito (mandou a prova). */
  feitoEm: string | null;
  /**
   * O que o cliente pagou pelo trabalho — o número que lhe foi mostrado. Com
   * IVA incluído nas negociações abertas desde `IVA_INCLUIDO_DESDE`; sem IVA
   * nas de antes (01-10-2026). `ivaIncluido` diz qual.
   */
  clientePaga: number;
  /**
   * Trabalho CLYON de valor fixo — 02-10-2026. O cliente pagou à CLYON um
   * preço combinado por fora: `clientePaga` aqui seria um número inventado a
   * partir do valor do profissional. Ver `oferta-clyon.ts`.
   */
  trabalhoClyon: boolean;
  ivaIncluido: boolean;
  /**
   * EM DINHEIRO COM IVA INCLUÍDO, O QUE O PROFISSIONAL DEVE À CLYON — o IVA e
   * a comissão (`dividaDoProfissional`). Nulo em tudo o resto. 01-10-2026.
   */
  dividaDoProfissional: number | null;
  /** Essa dívida já entrou (referência paga, ou registada à mão). */
  dividaPaga: boolean;
  /** O que se desconta ao profissional: o valor do trabalho menos o que ele recebe. */
  taxaDescontada: number;
  /** Pago pela plataforma, ou em dinheiro na mão dele. */
  forma: "plataforma" | "dinheiro";
  /*
   * QUANTO A CLYON FICA COM ESTE TRABALHO — 09-10-2026. *«Quero saber em
   * detalhes também quanto ganhamos com esse trabalho.»* Sem IVA, e pela
   * mesma conta das comissões dos assistentes (`lucroDoTrabalho`): num
   * trabalho normal, as duas taxas; num Trabalho CLYON, o preço ao cliente
   * menos o que o profissional recebe. Nulo num Trabalho CLYON antigo sem o
   * preço ao cliente escrito — escreve-se nos Trabalhos CLYON.
   */
  lucroDaClyon: number | null;
  /** O que o cliente paga, sem IVA. Nulo num Trabalho CLYON sem o preço escrito. */
  clienteSemIva: number | null;
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
              n.taxaCliente, n.taxaProfissional, n.formaDePagamento,
              -- Trabalho CLYON de valor fixo (02-10-2026): o preço do cliente passa por fora.
              n.ofertaClyon,
              -- Para o lucro da CLYON em cada trabalho (09-10-2026): o acréscimo
              -- do pagamento e, num Trabalho CLYON, o preço ao cliente e a taxa.
              n.acrescimoPagamento, o.valorFixoClyon, o.taxaClyon, o.precoClienteClyon,
              n.confirmadoEm, n.execucaoEnviadaEm, n.pagoEm,
              -- A abertura da negociação decide o modelo do preço (IVA incluído).
              n.createdAt AS negociacaoCriadaEm,
              o.serviceType, o.city,
              /*
               * QUEM, ONDE E QUANDO — para o trabalho ser RECONHECÍVEL.
               *
               * "Para eu dizer se já paguei preciso saber de qual se trata:
               * nome do cliente, número e localidade." — 18-09-2026.
               *
               * E tinha razão: o botão «Já paguei» tira dinheiro da conta da
               * CLYON com base no reconhecimento de quem carrega, e
               * «#325 · Recolha de móveis · Carcavelos» não chega para
               * reconhecer nada. Quem paga tem a transferência no homebanking
               * de um lado e esta lista do outro; o que faz a ponte entre as
               * duas é o NOME e o TELEFONE, não o número do pedido.
               */
              o.contactName, o.contactPhone, o.address, o.scheduledDate
         FROM providers p
         /*
          * TODAS as acordadas, e nao so as confirmadas.
          *
          * "A carteira deve mostrar os valores ja pagos, por pagar, e por
          * finalizar — seriam os trabalhos acordados mas ainda nao realizados."
          *
          * Faltava o terceiro monte, e e o que diz o que ai vem: trabalho
          * fechado com o profissional, dinheiro do cliente ja cativo, mas ainda
          * por fazer ou por confirmar. Sem ele, a carteira mostrava o passado e
          * calava o futuro — e e o futuro que diz se vale a pena esperar pela
          * proxima transferencia ou fazer ja esta.
          */
         LEFT JOIN negociacoes n
           ON n.providerId = p.id AND n.estado = 'acordada' 
         LEFT JOIN simulatorOrders o ON o.id = n.pedidoId
        /*
         * As contas APAGADAS ficam de fora.
         *
         * "Se o pro foi removido, ele deveria ter sido 100% apagado dos nossos
         * dados."
         *
         * Quase foi: quando não há passado, a linha é mesmo apagada. Quando há
         * — negociações, levantamentos, pedidos atribuídos — fica um número com
         * a etiqueta «Profissional removido» e mais nada: sem nome, email,
         * telefone, NIF, IBAN nem morada. É o mínimo para as negociações
         * antigas terem a que se agarrar, e para o cliente que o contratou
         * continuar a poder ver quem lhe fez o trabalho.
         *
         * O que não faz sentido nenhum é aparecer AQUI. Uma carteira é «a quem
         * pagar», e a uma etiqueta não se paga. Se alguma vez tiver dinheiro
         * por transferir, o filtro deixa-a passar — aí é um problema a sério e
         * tem de se ver.
         */
        WHERE p.isClyon = 0
          AND (p.estado <> 'apagado' OR EXISTS (
                SELECT 1 FROM negociacoes x
                 WHERE x.providerId = p.id AND x.estado = 'acordada' AND x.pagoEm IS NULL))
        ORDER BY p.name, n.confirmadoEm, n.updatedAt`,
    )) as [Array<Record<string, unknown>>, unknown];

    const porProfissional = new Map<number, ReturnType<typeof novaFicha>>();

    /*
     * A conta da casa, nos mesmos três estados do dinheiro deles.
     *
     * `fechada` é o que já está feito e pago dos dois lados — o único número
     * que é mesmo ganho. `ganha` é de trabalho confirmado que ainda tem
     * transferência por fazer: já é dela, mas o dinheiro ainda passa por aqui.
     * `porFinalizar` é promessa.
     */
    const clyon = { porFinalizar: 0, ganha: 0, fechada: 0, faturado: 0 };

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
        /* Acordado, com o dinheiro do cliente cativo, e ainda por confirmar. */
        porFinalizar: [] as TrabalhoPorPagar[],
        /** Pago em dinheiro, ao profissional, no local. Não é a CLYON quem paga. */
        recebidoEmMao: 0,
        /**
         * O QUE ELE DEVE À CLYON — o IVA e a comissão dos trabalhos em dinheiro
         * já confirmados e ainda por pagar. 01-10-2026. Paga-se por referência
         * (gerada na confirmação, ou no cartão do trabalho em Negociações).
         */
        aPagarAClyon: 0,
        jaPago: 0,
        totalPorPagar: 0,
        totalPorFinalizar: 0,
      };
    }

    /*
     * AS DÍVIDAS JÁ PAGAS — uma consulta só, para os trabalhos em dinheiro com
     * IVA incluído. A dívida paga-se por referência, e a referência paga marca
     * a negociação como paga na tabela dos pagamentos (`negociacaoPaga`), como
     * um pagamento de cliente qualquer.
     */
    const pagas = await negociacoesPagas(
      linhas
        .filter(
          (l) =>
            l.negociacaoId != null &&
            temDividaDoProfissional(l.formaDePagamento, modeloDaNegociacao(l.negociacaoCriadaEm as Date | null)),
        )
        .map((l) => Number(l.negociacaoId)),
    );

    for (const l of linhas) {
      const id = Number(l.id);
      if (!porProfissional.has(id)) porProfissional.set(id, novaFicha(l));
      const ficha = porProfissional.get(id)!;

      if (l.negociacaoId == null || l.valorAcordado == null) continue;
      const acordado = Number(l.valorAcordado);
      const taxas = taxasDaNegociacao(l);
      const recebe = quantoOProfissionalRecebe(acordado, taxas);
      /*
       * A COMISSÃO DA CASA, no mesmo trabalho e nos mesmos três montes.
       *
       * "Coloque também os ganhos da CLYON."
       *
       * Vem das duas pontas — 5% que o cliente paga a mais e 6% que se desconta
       * ao profissional — e por isso não se lê nem do que entra nem do que sai:
       * é a diferença entre os dois, e ninguém a via em lado nenhum.
       *
       * Segue os mesmos três estados do dinheiro dele, de propósito. Uma
       * comissão de um trabalho por fazer ainda não é ganho: é uma promessa,
       * como o dinheiro cativo do lado do cliente.
       */
      const comissao = comissaoDaClyon(acordado, taxas);
      // O que o cliente paga a serio: o valor acordado e SEM IVA, e o imposto
      // do regime de quem factura soma-se por cima. Sem isto, o "facturado aos
      // clientes" ficava 23% abaixo do que ha mesmo facturado.
      const clientePaga = contaDoCliente(acordado, taxas).total;
      const modelo = modeloDaNegociacao(l.negociacaoCriadaEm as Date | null);
      const comDivida = temDividaDoProfissional(l.formaDePagamento, modelo);
      const divida = comDivida ? dividaDoProfissional(acordado, taxas).total : null;
      const dividaPaga = comDivida && pagas.has(Number(l.negociacaoId));

      const trabalhoClyon = typeof l.ofertaClyon === "string" && l.ofertaClyon !== "";
      const doLucro = lucroDoTrabalho({
        id: Number(l.pedidoId),
        status: null,
        valorAcordado: acordado,
        taxaCliente: l.taxaCliente as string | null,
        taxaProfissional: l.taxaProfissional as string | null,
        acrescimoPagamento: l.acrescimoPagamento as string | null,
        valorFixoClyon: trabalhoClyon ? (l.valorFixoClyon as string | null) : null,
        taxaClyon: l.taxaClyon as string | null,
        precoClienteClyon: l.precoClienteClyon as string | null,
      });
      const semPrecoAoCliente = doLucro.fonte === "falta_preco_ao_cliente";
      const trabalho: TrabalhoPorPagar = {
        trabalhoClyon,
        negociacaoId: Number(l.negociacaoId),
        pedidoId: Number(l.pedidoId),
        servico: (l.serviceType as string) ?? null,
        cidade: (l.city as string) ?? null,
        cliente: ((l.contactName as string) ?? "").trim() || null,
        telefoneDoCliente: ((l.contactPhone as string) ?? "").trim() || null,
        morada: ((l.address as string) ?? "").trim() || null,
        quando: l.scheduledDate ? String(l.scheduledDate).slice(0, 10) : null,
        profissional: ficha.nome,
        valorAcordado: acordado,
        recebe,
        confirmadoEm: l.confirmadoEm ? new Date(l.confirmadoEm as string).toISOString() : null,
        /* Ele ja mandou a prova e falta so alguem confirmar? Muda a espera. */
        aguardaConfirmacao: l.confirmadoEm == null && l.execucaoEnviadaEm != null,
        feitoEm: l.execucaoEnviadaEm
          ? new Date(l.execucaoEnviadaEm as string).toISOString()
          : null,
        clientePaga: precoDoCliente(acordado, taxas, modelo).aPagar,
        ivaIncluido: modelo === "iva_incluido",
        dividaDoProfissional: divida,
        dividaPaga,
        // Ao centimo, e no servidor: a subtraccao em virgula flutuante no ecra
        // dava 11,399999 € na linha de um trabalho de 190 €.
        taxaDescontada: Math.round((acordado - recebe) * 100) / 100,
        forma: lerForma(l.formaDePagamento) === "dinheiro" ? "dinheiro" : "plataforma",
        lucroDaClyon: semPrecoAoCliente ? null : doLucro.lucro,
        clienteSemIva: trabalhoClyon
          ? semPrecoAoCliente
            ? null
            : doLucro.valor
          : contaDoCliente(acordado, taxas, Number(l.acrescimoPagamento ?? 0) || 0).semIva,
      };

      /* Três montes, e cada trabalho está exactamente num deles. */
      /*
       * EM DINHEIRO NÃO HÁ NADA A PAGAR PELA CLYON — 21-09-2026.
       *
       * O cliente entregou o serviço ao profissional em mão. Esta lista é «a
       * quem pagar», e pô-lo em «por pagar» era o botão «Já paguei» a tirar da
       * conta da CLYON dinheiro que nunca lá entrou. Conta-se à parte, e a
       * comissão da CLYON neste trabalho vem da referência ao cliente — não
       * do profissional.
       */
      if (lerForma(l.formaDePagamento) === "dinheiro") {
        if (l.confirmadoEm != null) {
          ficha.recebidoEmMao = Math.round((ficha.recebidoEmMao + recebe) * 100) / 100;
          if (divida != null && !dividaPaga) {
            ficha.aPagarAClyon = Math.round((ficha.aPagarAClyon + divida) * 100) / 100;
          }
          clyon.ganha = Math.round((clyon.ganha + comissao) * 100) / 100;
          if (!trabalhoClyon) clyon.faturado = Math.round((clyon.faturado + clientePaga) * 100) / 100;
        } else {
          clyon.porFinalizar = Math.round((clyon.porFinalizar + comissao) * 100) / 100;
          ficha.porFinalizar.push(trabalho);
          ficha.totalPorFinalizar = Math.round((ficha.totalPorFinalizar + recebe) * 100) / 100;
        }
        continue;
      }

      if (l.pagoEm != null) {
        ficha.jaPago = Math.round((ficha.jaPago + recebe) * 100) / 100;
        clyon.fechada = Math.round((clyon.fechada + comissao) * 100) / 100;
        if (!trabalhoClyon) clyon.faturado = Math.round((clyon.faturado + clientePaga) * 100) / 100;
        continue;
      }
      if (l.confirmadoEm == null) {
        clyon.porFinalizar = Math.round((clyon.porFinalizar + comissao) * 100) / 100;
        ficha.porFinalizar.push(trabalho);
        ficha.totalPorFinalizar = Math.round((ficha.totalPorFinalizar + recebe) * 100) / 100;
        continue;
      }
      ficha.porPagar.push(trabalho);
      ficha.totalPorPagar = Math.round((ficha.totalPorPagar + recebe) * 100) / 100;
      clyon.ganha = Math.round((clyon.ganha + comissao) * 100) / 100;
      if (!trabalhoClyon) clyon.faturado = Math.round((clyon.faturado + clientePaga) * 100) / 100;
    }

    /*
     * Quem tem dinheiro à espera vem primeiro, e do maior para o menor: é a
     * ordem por que se fazem as transferências. Os outros ficam em baixo,
     * porque a ficha deles continua a ser útil — é lá que se vê que falta o
     * IBAN antes de haver trabalho para pagar.
     */
    const carteiras = [...porProfissional.values()].sort(
      (a, b) =>
        b.totalPorPagar - a.totalPorPagar ||
        b.totalPorFinalizar - a.totalPorFinalizar ||
        a.nome.localeCompare(b.nome, "pt"),
    );

    const total = carteiras.reduce((s, c) => s + c.totalPorPagar, 0);
    const totalPorFinalizar = carteiras.reduce((s, c) => s + c.totalPorFinalizar, 0);
    const totalJaPago = carteiras.reduce((s, c) => s + c.jaPago, 0);
    const semComoPagar = carteiras.filter((c) => c.totalPorPagar > 0 && !c.iban && !c.mbway).length;
    const totalAPagarAClyon = carteiras.reduce((s, c) => s + c.aPagarAClyon, 0);

    return NextResponse.json({
      carteiras,
      total: Math.round(total * 100) / 100,
      totalPorFinalizar: Math.round(totalPorFinalizar * 100) / 100,
      totalJaPago: Math.round(totalJaPago * 100) / 100,
      /* O que os profissionais devem à CLYON de trabalhos em dinheiro (IVA e comissão). */
      totalAPagarAClyon: Math.round(totalAPagarAClyon * 100) / 100,
      clyon: {
        porFinalizar: clyon.porFinalizar,
        ganha: clyon.ganha,
        fechada: clyon.fechada,
        /* O que os clientes pagaram ao todo, para dar escala à comissão. */
        faturado: clyon.faturado,
      },
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
  // Só o administrador — 03-10-2026, decisão do dono: nesta secção o assistente
  // só vê; mexer em dinheiro ou em taxas é do administrador. Ver
  // `ESCRITAS_SO_DO_ADMINISTRADOR` em papel-do-painel.ts.
  const { err, colab } = await requireAdminGeral(req);
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
      `SELECT n.pedidoId, n.valorAcordado, n.taxaCliente, n.taxaProfissional,
              p.name AS profissionalNome
         FROM negociacoes n JOIN providers p ON p.id = n.providerId
        WHERE n.id = ? LIMIT 1`,
      [negociacaoId],
    )) as [Array<{
        pedidoId: number;
        valorAcordado: string | null;
        taxaCliente: string | null;
        taxaProfissional: string | null;
        profissionalNome: string;
      }>, unknown];
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
      linha.valorAcordado != null
        ? quantoOProfissionalRecebe(Number(linha.valorAcordado), taxasDaNegociacao(linha))
        : null;
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
