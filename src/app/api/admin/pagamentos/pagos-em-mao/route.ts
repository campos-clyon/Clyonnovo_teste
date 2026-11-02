import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { getPool, ensurePlataformaConfiguracoes } from "@/lib/db";

/**
 * «JÁ CONFERI» — 02-11-2026 (dono). Quem conferiu, quando, e QUAIS trabalhos:
 * a lista esconde-se enquanto não aparecer um trabalho que não estava lá. Só
 * apresentação: não muda dados nem contas.
 */
const CHAVE_DO_CONFERIDO = "pagos_em_mao_conferido";
type Conferido = { ids: number[]; porQuem: string; em: string };

async function lerConferido(pool: NonNullable<Awaited<ReturnType<typeof getPool>>>): Promise<Conferido | null> {
  await ensurePlataformaConfiguracoes();
  const [rows] = (await pool.execute("SELECT valor FROM plataformaConfiguracoes WHERE chave = ? LIMIT 1", [
    CHAVE_DO_CONFERIDO,
  ])) as [Array<{ valor: string }>, unknown];
  try {
    const c = JSON.parse(rows[0]?.valor ?? "null") as Conferido | null;
    return c && Array.isArray(c.ids) ? c : null;
  } catch {
    return null;
  }
}
import {
  afectadosPeloPagoEmMao,
  type LevantamentoParaConferir,
  type LinhaPagoEmMao,
} from "@/lib/pagos-em-mao-afectados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OS TRABALHOS DA PLATAFORMA PAGOS EM MÃO — e quem pode ter sido pago duas
 * vezes por eles. 01-11-2026 (urgência, com o ok do dono).
 *
 * GET — SÓ LÊ, e só o administrador (há nomes e dinheiro). Todos os trabalhos
 * que não foram combinados em dinheiro mas ficaram registados nos Pagamentos
 * como «o cliente pagou ao profissional, em mão»: até hoje a carteira deles
 * contava-os em «Por receber». Ver `pagos-em-mao-afectados.ts`.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });

  try {
    const [linhas] = (await pool.execute(
      `SELECT n.id AS negociacaoId, n.pedidoId, n.providerId, pr.name AS profissional,
              n.valorAcordado, n.taxaCliente, n.taxaProfissional, n.pagoEm,
              COALESCE(p.valorPago, p.valor) AS valorQueEntrou, p.pagoEm AS registadoEm
         FROM pagamentos p
         JOIN negociacoes n ON n.id = p.negociacaoPaga
         JOIN providers pr ON pr.id = n.providerId
        WHERE p.metodo = 'ao_profissional'
          AND (n.formaDePagamento IS NULL OR n.formaDePagamento <> 'dinheiro')
        ORDER BY n.pedidoId DESC`,
    )) as [Array<Record<string, unknown>>, unknown];

    const trabalhos: LinhaPagoEmMao[] = linhas.map((l) => ({
      negociacaoId: Number(l.negociacaoId),
      pedidoId: Number(l.pedidoId),
      providerId: Number(l.providerId),
      profissional: (l.profissional as string | null) ?? null,
      valorAcordado: l.valorAcordado,
      taxaCliente: l.taxaCliente,
      taxaProfissional: l.taxaProfissional,
      valorQueEntrou: l.valorQueEntrou,
      registadoEm: (l.registadoEm as Date | null) ?? null,
      pagoEm: (l.pagoEm as Date | null) ?? null,
    }));

    const pros = [...new Set(trabalhos.map((t) => t.providerId))];
    let levantamentos: LevantamentoParaConferir[] = [];
    if (pros.length > 0) {
      const [ls] = (await pool.execute(
        `SELECT id, providerId, valor, estado, createdAt, processadoEm
           FROM levantamentos
          WHERE estado IN ('pedido', 'pago')
            AND providerId IN (${pros.map(() => "?").join(", ")})`,
        pros,
      )) as [Array<Record<string, unknown>>, unknown];
      levantamentos = ls.map((v) => ({
        id: Number(v.id),
        providerId: Number(v.providerId),
        valor: v.valor,
        estado: String(v.estado),
        createdAt: (v.createdAt as Date | null) ?? null,
        processadoEm: (v.processadoEm as Date | null) ?? null,
      }));
    }

    const profissionais = afectadosPeloPagoEmMao(trabalhos, levantamentos);
    const conferido = await lerConferido(pool).catch(() => null);
    const vistos = new Set(conferido?.ids ?? []);
    const novos = trabalhos.filter((t) => !vistos.has(t.negociacaoId)).length;
    return NextResponse.json({
      // Escondido quando já se conferiu tudo o que lá está; um caso novo volta a mostrá-lo.
      conferido: conferido && novos === 0 ? { porQuem: conferido.porQuem, em: conferido.em } : null,
      profissionais,
      totalTrabalhos: trabalhos.length,
      comPedidoAberto: profissionais.filter((p) => p.alerta === "pedido_aberto").length,
    });
  } catch (e) {
    // Sem a tabela dos pagamentos (base nova) não há nada a listar.
    if ((e as { code?: string })?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ profissionais: [], totalTrabalhos: 0, comPedidoAberto: 0 });
    }
    console.error("[admin/pagamentos/pagos-em-mao]", e);
    return NextResponse.json({ error: "Não foi possível ler." }, { status: 500 });
  }
}

/** «Já conferi» — só o administrador. Grava os trabalhos que estão na lista agora. */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "Base indisponível" }, { status: 503 });
  try {
    const [linhas] = (await pool.execute(
      `SELECT DISTINCT p.negociacaoPaga AS id
         FROM pagamentos p
         JOIN negociacoes n ON n.id = p.negociacaoPaga
        WHERE p.metodo = 'ao_profissional'
          AND (n.formaDePagamento IS NULL OR n.formaDePagamento <> 'dinheiro')`,
    )) as [Array<{ id: number }>, unknown];
    const conferido: Conferido = {
      ids: linhas.map((l) => Number(l.id)),
      porQuem: (colab?.nome ?? "administrador").slice(0, 80),
      em: new Date().toISOString(),
    };
    await ensurePlataformaConfiguracoes();
    await pool.execute(
      `INSERT INTO plataformaConfiguracoes (chave, valor, porQuem) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_CONFERIDO, JSON.stringify(conferido), conferido.porQuem],
    );
    return NextResponse.json({ ok: true, conferido: { porQuem: conferido.porQuem, em: conferido.em } });
  } catch (e) {
    console.error("[admin/pagamentos/pagos-em-mao POST]", e);
    return NextResponse.json({ error: "Não foi possível gravar." }, { status: 500 });
  }
}
