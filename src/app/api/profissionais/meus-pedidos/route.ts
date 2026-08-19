import { NextRequest, NextResponse } from "next/server";
import { negociacoesDoProfissional } from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { vistaParaOEstado } from "@/lib/pedido-valores";
import { quantoOProfissionalRecebe } from "@/lib/taxas-plataforma";
import { faseDoTrabalho, diasAteLibertar } from "@/lib/trabalho";

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

    const agora = new Date();

    const pedidos = linhas.map((l) => {
      // A morada e o contacto só entram na vista depois de ele ser contratado —
      // a decisão está numa função só, e não repetida a cada rota.
      const vista = vistaParaOEstado(l as unknown as Record<string, unknown>, l.estado) as Record<
        string,
        unknown
      >;
      const minimo = l.valorDesejadoCliente != null ? Number(l.valorDesejadoCliente) : null;
      const acordado = l.valorAcordado != null ? Number(l.valorAcordado) : null;
      const fase = faseDoTrabalho(l as never);

      return {
        negociacaoId: l.id,
        pedidoId: l.pedidoId,
        estado: l.estado,
        fase,
        diasAteLibertar: diasAteLibertar(l as never, agora),
        provaJson: l.provaJson ?? null,
        actualizadoEm: l.updatedAt,
        propostas: l.propostasJson,
        // Só chegam preenchidos quando o trabalho é dele.
        morada: (vista.address as string | undefined) ?? null,
        contactoNome: (vista.contactName as string | undefined) ?? null,
        contactoTelefone: (vista.contactPhone as string | undefined) ?? null,
        // O que ele vê do pedido — nada além disto.
        serviceType: (vista.serviceType as string | undefined) ?? null,
        city: (vista.city as string | undefined) ?? null,
        urgency: (vista.urgency as string | undefined) ?? null,
        description: (vista.description as string | undefined) ?? null,
        filesJson: (vista.filesJson as string | undefined) ?? null,
        floor: (vista.floor as string | undefined) ?? null,
        hasElevator: (vista.hasElevator as string | undefined) ?? null,
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
