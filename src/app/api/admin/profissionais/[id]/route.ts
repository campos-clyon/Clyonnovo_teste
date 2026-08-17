import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  verificarGuiaDeTransporte,
  definirEstadoDoProfissional,
  actualizarProfissional,
  definirBaseDoProfissional,
  getPool,
} from "@/lib/db";
import { validarEdicao, estadoValido, afectaDistribuicao } from "@/lib/edicao-profissional";
import { geocodificarLocalidade } from "@/lib/geocodificar";

export const runtime = "nodejs";

/**
 * Gerir um profissional: estado, perfil, verificação da guia, coordenadas.
 *
 * Uma rota com várias acções em vez de quatro rotas, porque o painel altera
 * frequentemente duas coisas ao mesmo tempo — aprovar e verificar a guia, por
 * exemplo — e duas chamadas separadas deixavam um estado intermédio possível.
 *
 * Aprovar e verificar continuam a ser acções DISTINTAS. Aprovar diz "pode
 * receber pedidos"; verificar diz "confirmámos que pode legalmente transportar
 * resíduos". Alguém pode estar aprovado sem guia verificada — só não recebe os
 * pedidos que a exigem.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const providerId = Number(id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  try {
    const feito: string[] = [];
    let avisoDeDistribuicao = false;

    // ── Estado ───────────────────────────────────────────────────────────────
    if (corpo.estado !== undefined) {
      if (!estadoValido(corpo.estado)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
      }
      await definirEstadoDoProfissional(providerId, corpo.estado);
      feito.push(`estado: ${corpo.estado}`);
    }

    // ── Verificação da guia ──────────────────────────────────────────────────
    if (corpo.verificarGuia === true) {
      await verificarGuiaDeTransporte(providerId, colab.nome);
      feito.push("guia verificada");
    }

    // ── Re-geocodificar a base ───────────────────────────────────────────────
    //
    // A geocodificação na inscrição é "melhor esforço" e pode ter falhado — o
    // Nominatim fora de serviço, ou um nome de localidade que ele não conhece.
    // Sem coordenadas o raio não é aplicado e o profissional só recebe por
    // zona, o que é pior do que ele pediu. Isto dá uma segunda tentativa.
    if (corpo.regeocodificar === true) {
      const pool = await getPool();
      const [linhas] = pool
        ? ((await pool.execute("SELECT city FROM providers WHERE id = ? LIMIT 1", [
            providerId,
          ])) as any[])
        : [[]];
      const cidade = (linhas as Array<{ city: string | null }>)[0]?.city;
      if (!cidade) {
        return NextResponse.json(
          { error: "Este profissional não tem cidade indicada." },
          { status: 400 },
        );
      }
      const base = await geocodificarLocalidade(cidade);
      if (!base) {
        return NextResponse.json(
          { error: `Não foi possível localizar "${cidade}". Continua a receber por zona.` },
          { status: 422 },
        );
      }
      await definirBaseDoProfissional(providerId, base.lat, base.lng);
      feito.push("coordenadas actualizadas");
      avisoDeDistribuicao = true;
    }

    // ── Perfil ───────────────────────────────────────────────────────────────
    const CAMPOS_DE_PERFIL = [
      "categorias",
      "zonas",
      "raioKm",
      "emiteFatura",
      "emiteGuiaTransporte",
      "numeroTransportador",
    ];
    if (CAMPOS_DE_PERFIL.some((k) => k in corpo)) {
      const validacao = validarEdicao(corpo);
      if (!validacao.ok) {
        return NextResponse.json(
          { error: validacao.erros[0].mensagem, erros: validacao.erros },
          { status: 400 },
        );
      }
      await actualizarProfissional(providerId, validacao.alteracoes);
      feito.push("perfil actualizado");
      if (afectaDistribuicao(validacao.alteracoes)) avisoDeDistribuicao = true;
    }

    if (feito.length === 0) {
      return NextResponse.json({ error: "Nada para alterar" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, feito, avisoDeDistribuicao });
  } catch (error) {
    console.error("[api/admin/profissionais PATCH]", error);
    return NextResponse.json({ error: "Erro ao actualizar profissional" }, { status: 500 });
  }
}
