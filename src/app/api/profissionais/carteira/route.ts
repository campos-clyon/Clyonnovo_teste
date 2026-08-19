import { NextRequest, NextResponse } from "next/server";
import {
  negociacoesDoProfissional,
  levantamentosDoProfissional,
  perfilDoProfissional,
} from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { carteiraDe, type TrabalhoNaCarteira } from "@/lib/carteira";
import { faseDoTrabalho } from "@/lib/trabalho";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
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
  const sessao = await verificarSessaoDoProfissional(
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

    const trabalhos: TrabalhoNaCarteira[] = linhas.map((l) => ({
      negociacaoId: l.id,
      estado: l.estado,
      valorAcordado: l.valorAcordado != null ? Number(l.valorAcordado) : null,
      execucaoEnviadaEm: l.execucaoEnviadaEm,
      confirmadoEm: l.confirmadoEm,
      pagoEm: l.pagoEm,
    }));

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
            valor: quantoOProfissionalRecebe(valor),
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
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const iban = typeof perfil?.iban === "string" ? perfil.iban : "";

    return NextResponse.json({
      carteira,
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
