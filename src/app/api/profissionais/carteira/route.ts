import { NextRequest, NextResponse } from "next/server";
import {
  negociacoesDoProfissional,
  levantamentosDoProfissional,
  perfilDoProfissional,
} from "@/lib/db";
import { COOKIE_SESSAO_PROFISSIONAL } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import {
  aPagarAClyonDe,
  carteiraDe,
  dividasDe,
  levantavelDe,
  type TrabalhoNaCarteira,
} from "@/lib/carteira";
import { bloqueioEmDinheiro, explicacaoDoBloqueio, venceEm } from "@/lib/bloqueio-por-divida";
import { pagamentosDaNegociacao } from "@/lib/pagamentos-na-base";
import { trabalhosDaCarteira } from "@/lib/carteira-do-profissional";
import { faseDoTrabalho } from "@/lib/trabalho";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { ibanEncurtado } from "@/lib/iban";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";

export const runtime = "nodejs";

/**
 * A carteira do profissional: saldos e movimentos.
 *
 * Os saldos são calculados aqui e não guardados numa coluna. Um saldo em
 * coluna é um número que pode discordar dos factos que o produziram — e quando
 * discorda, ninguém sabe qual dos dois está certo. Assim há uma fonte só: os
 * trabalhos e os pedidos de transferência.
 *
 * O IBAN volta encurtado. O completo já está no telemóvel de quem o escreveu, e
 * esta resposta abre-se em qualquer sítio onde ele deixe a sessão iniciada.
 */
export async function GET(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const [linhas, levantamentos, perfil] = await Promise.all([
      negociacoesDoProfissional(sessao.providerId),
      levantamentosDoProfissional(sessao.providerId),
      perfilDoProfissional(sessao.providerId),
    ]);

    const agora = new Date();

    // A conversão vive num sítio só: a rota do levantamento usa a MESMA, e duas
    // cópias de uma regra de dinheiro acabam a discordar sobre quem recebe.
    const trabalhos: TrabalhoNaCarteira[] = await trabalhosDaCarteira(linhas);

    const carteira = carteiraDe(
      trabalhos,
      levantamentos.map((l) => ({ id: l.id, valor: Number(l.valor), estado: l.estado })),
      agora,
    );

    // Os movimentos são a história do saldo: um por trabalho que já conta, mais
    // um por transferência. Sem isto, o profissional vê um número e não tem como
    // o reconstituir — e um saldo que não se explica é um saldo em que não se
    // confia.
    const movimentos = [
      ...linhas
        .filter((l) => faseDoTrabalho(l as never) !== "a_negociar")
        .map((l) => {
          const valor = l.valorAcordado != null ? Number(l.valorAcordado) : 0;
          return {
            tipo: "trabalho" as const,
            id: l.id,
            pedidoId: l.pedidoId,
            titulo:
              SERVICE_CATEGORIES.find((c) => c.id === l.serviceType)?.label ??
              l.serviceType ??
              "Trabalho",
            zona: l.city,
            valor: quantoOProfissionalRecebe(valor, taxasDaNegociacao(l)),
            fase: faseDoTrabalho(l as never),
            data: l.confirmadoEm ?? l.execucaoEnviadaEm ?? l.updatedAt,
          };
        }),
      ...levantamentos.map((l) => ({
        tipo: "levantamento" as const,
        id: l.id,
        pedidoId: null,
        titulo: "Transferência para a sua conta",
        zona: null,
        // Negativo: sai da carteira. Somar tudo numa lista de movimentos tem de
        // dar o saldo, senão a lista não explica nada.
        valor: -Number(l.valor),
        fase: l.estado,
        data: l.processadoEm ?? l.createdAt,
      })),
      /*
       * AS DÍVIDAS ABATIDAS NO SALDO — 01-10-2026. Saem da carteira como um
       * levantamento (negativas), para a lista continuar a somar o saldo.
       */
      ...trabalhos
        .filter((t) => t.dividaAbatida != null)
        .map((t) => {
          const l = linhas.find((x) => x.id === t.negociacaoId);
          const a = t.dividaAbatida!;
          return {
            tipo: "divida_abatida" as const,
            id: t.negociacaoId,
            pedidoId: l?.pedidoId ?? null,
            titulo:
              "IVA e comissão pagos à CLYON com o saldo" +
              (a.levantamentoId != null ? ` (transferência #${a.levantamentoId})` : ""),
            zona: null,
            valor: -a.valor,
            fase: "pago",
            data: a.em ?? l?.updatedAt ?? agora,
          };
        }),
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    /*
     * A PAGAR À CLYON — 01-10-2026. Em dinheiro com IVA incluído, o cliente
     * pagou-lhe o preço inteiro, e o IVA e a comissão são da CLYON. Cada
     * dívida vai com a referência viva que houver (gerada na confirmação, ou
     * pedida por ele aqui), para a poder pagar sem perguntar a ninguém.
     */
    const dividas = await Promise.all(
      dividasDe(trabalhos, agora)
        .filter((d) => !d.paga)
        .map(async (d) => {
          const l = linhas.find((x) => x.id === d.negociacaoId);
          const viva = (await pagamentosDaNegociacao(d.negociacaoId)).find(
            (p) =>
              p.estado === "pendente" &&
              p.valor === d.total &&
              p.referencia != null &&
              (!p.expiraEm || new Date(p.expiraEm).getTime() > agora.getTime()),
          );
          return {
            ...d,
            /*
             * ATÉ QUANDO TEM PARA A PAGAR — 01-10-2026. Passado o prazo, deixa
             * de poder propor e aceitar trabalhos em dinheiro. Ver
             * `bloqueio-por-divida.ts`.
             */
            venceEm: venceEm(d)?.toISOString() ?? null,
            pedidoId: l?.pedidoId ?? null,
            titulo:
              SERVICE_CATEGORIES.find((c) => c.id === l?.serviceType)?.label ??
              l?.serviceType ??
              "Trabalho",
            referencia: viva
              ? {
                  metodo: viva.metodo,
                  entidade: viva.entidade,
                  referencia: viva.referencia,
                  expiraEm: viva.expiraEm,
                }
              : null,
          };
        }),
    );

    const iban = typeof perfil?.iban === "string" ? perfil.iban : "";
    const aPagarAClyon = aPagarAClyonDe(trabalhos, agora);

    /*
     * O BLOQUEIO DOS TRABALHOS EM DINHEIRO — 01-10-2026. Calculado dos MESMOS
     * trabalhos desta carteira, com a referência que já se juntou a cada
     * dívida acima: o painel diz-lhe porquê, com o valor e por onde pagar.
     */
    const bloqueio = bloqueioEmDinheiro(trabalhos, agora);
    const explicacao = bloqueio.bloqueado
      ? explicacaoDoBloqueio(
          bloqueio.dividas.map((d) => {
            const comRef = dividas.find((x) => x.negociacaoId === d.negociacaoId);
            return {
              total: d.total,
              pedidoId: comRef?.pedidoId ?? null,
              multibanco:
                comRef?.referencia?.metodo === "multibanco"
                  ? { entidade: comRef.referencia.entidade, referencia: comRef.referencia.referencia }
                  : null,
            };
          }),
        )
      : "";

    return NextResponse.json({
      carteira,
      aPagarAClyon,
      /*
       * O QUE PODE PEDIR — o disponível menos o que deve («abater no saldo»,
       * 01-10-2026). É o mesmo número que a rota do levantamento aceita.
       */
      levantavel: levantavelDe(carteira, aPagarAClyon),
      bloqueioEmDinheiro: bloqueio.bloqueado
        ? { total: bloqueio.total, explicacao, negociacoes: bloqueio.dividas.map((d) => d.negociacaoId) }
        : null,
      dividas,
      movimentos,
      iban: iban ? ibanEncurtado(iban) : "",
      temIban: Boolean(iban),
      titular: perfil?.ibanTitular ?? null,
      temPedidoPendente: levantamentos.some((l) => l.estado === "pedido"),
    });
  } catch (error) {
    console.error("[profissionais/carteira]", error);
    return NextResponse.json({ error: "Erro ao carregar a carteira" }, { status: 500 });
  }
}
