import { NextRequest, NextResponse } from "next/server";
import { negociacoesDoProfissional } from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { vistaDoProfissional } from "@/lib/pedido-valores";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";

export const runtime = "nodejs";

/**
 * Os pedidos deste profissional, para o painel dele.
 *
 * A sessão vem do cookie e mais nada. O `providerId` NUNCA vem do corpo nem da
 * query: se viesse, bastava mudar um número no endereço para ler os pedidos —
 * e as negociações — de outro profissional.
 *
 * Cada pedido passa por `vistaDoProfissional` antes de sair. A consulta traz
 * colunas do pedido, e entre elas podia vir o valor máximo do cliente ou a
 * morada exacta no dia em que alguém acrescentasse um campo à consulta. A lista
 * de permissões é o que impede isso de acontecer por distracção.
 */
export async function GET(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const linhas = await negociacoesDoProfissional(sessao.providerId);

    const pedidos = linhas.map((l) => {
      const vista = vistaDoProfissional(l as unknown as Record<string, unknown>);
      const minimo = l.valorMinimoCliente != null ? Number(l.valorMinimoCliente) : null;
      const acordado = l.valorAcordado != null ? Number(l.valorAcordado) : null;

      return {
        negociacaoId: l.id,
        pedidoId: l.pedidoId,
        estado: l.estado,
        actualizadoEm: l.updatedAt,
        propostas: l.propostasJson,
        // O que ele vê do pedido — nada além disto.
        serviceType: vista.serviceType ?? null,
        city: vista.city ?? null,
        urgency: vista.urgency ?? null,
        description: vista.description ?? null,
        filesJson: vista.filesJson ?? null,
        precisaFatura: Boolean(vista.precisaFatura),
        precisaGuiaTransporte: Boolean(vista.precisaGuiaTransporte),
        // Sempre o líquido. Nunca o bruto — ver taxas-plataforma.ts.
        querPagar: minimo,
        recebeSeAceitar: minimo != null ? quantoOProfissionalRecebe(minimo) : null,
        recebeSeFechado: acordado != null ? quantoOProfissionalRecebe(acordado) : null,
      };
    });

    return NextResponse.json({ nome: sessao.nome, pedidos });
  } catch (error) {
    console.error("[profissionais/meus-pedidos]", error);
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 });
  }
}
