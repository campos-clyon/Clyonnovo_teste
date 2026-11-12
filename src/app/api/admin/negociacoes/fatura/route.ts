import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { trabalhoVistoPeloBackoffice } from "@/lib/acesso-ao-pagamento";
import { receberFaturaDoTrabalho } from "@/lib/faturas-do-trabalho-no-servidor";
import { faturasDaNegociacao } from "@/lib/faturas-do-trabalho-na-base";
import { MENSAGENS_DA_FATURA, asDuasFaturas, deQuemValido } from "@/lib/faturas-do-trabalho";

export const runtime = "nodejs";

/**
 * AS FATURAS DO TRABALHO, PELA EQUIPA — d10, o modelo de 15-11-2026.
 *
 * POST (multipart: `file`; `?negociacaoId=&deQuem=clyon|parceiro`): a equipa
 * junta a fatura da taxa da plataforma, feita à mão pela empresa parceira — ou,
 * a pedido, a do parceiro. Só num trabalho contratado do modelo novo.
 * GET `?negociacaoId=`: as duas.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const negociacaoId = Number(req.nextUrl.searchParams.get("negociacaoId"));
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  const acesso = await trabalhoVistoPeloBackoffice(negociacaoId);
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });
  const f = asDuasFaturas(await faturasDaNegociacao(negociacaoId));
  return NextResponse.json({ novoModelo: acesso.trabalho.novoModelo, daTaxa: f.clyon, doTrabalho: f.parceiro });
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const p = req.nextUrl.searchParams;
  const negociacaoId = Number(p.get("negociacaoId"));
  const deQuem = p.get("deQuem") ?? "clyon";
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  if (!deQuemValido(deQuem)) return NextResponse.json({ error: "Indique de quem é a fatura." }, { status: 400 });
  const acesso = await trabalhoVistoPeloBackoffice(negociacaoId);
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });
  if (!acesso.trabalho.novoModelo) return NextResponse.json({ error: MENSAGENS_DA_FATURA.naoE }, { status: 409 });
  const quem = (colab as { nome?: string; email?: string } | null | undefined)?.nome ?? "a equipa";
  return receberFaturaDoTrabalho(req, {
    negociacaoId,
    pedidoId: acesso.trabalho.pedidoId,
    deQuem,
    quem: String(quem),
    autorTipo: "clyon",
  });
}
