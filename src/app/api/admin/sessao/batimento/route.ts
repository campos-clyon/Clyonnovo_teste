import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  localDosCabecalhos,
  marcaValida,
  navegadorESistema,
  resumoDoToken,
  tokenDoCabecalho,
} from "@/lib/sessoes-do-backoffice";
import { fecharSeparador, registarBatimento } from "@/lib/sessoes-do-backoffice-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sessao/batimento — 27-10-2026 (decisão d15).
 *
 * Cada janela do backoffice chama isto a cada minuto: «estou aberta». Exige a
 * sessão do backoffice (administrador ou assistente — fica debaixo de
 * /api/admin/sessao, que qualquer assistente chama). Quem é a pessoa sai do
 * token; do browser só vêm as duas marcas aleatórias.
 *
 * Com `fechar: true`, a janela está a fechar e deixa de contar já.
 *
 * Uma sessão terminada pelo administrador recebe aqui o 401 de
 * `requireAdmin`, e o painel volta ao ecrã de entrada.
 */
export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: { navegador?: unknown; separador?: unknown; fechar?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!marcaValida(corpo.navegador) || !marcaValida(corpo.separador)) {
    return NextResponse.json({ error: "Marcas inválidas." }, { status: 400 });
  }

  const token = tokenDoCabecalho(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const tokenHash = await resumoDoToken(token);

  try {
    if (corpo.fechar === true) {
      await fecharSeparador(corpo.navegador, corpo.separador, tokenHash);
      return NextResponse.json({ ok: true });
    }
    // O token já foi verificado por `requireAdmin`; daqui só se lêem as datas.
    const { iat, exp } = jose.decodeJwt(token);
    const { navegador, sistema } = navegadorESistema(req.headers.get("user-agent"));
    const { cidade, pais } = localDosCabecalhos(req.headers);
    await registarBatimento({
      colaboradorId: colab.id,
      nome: colab.nome,
      papel: colab.papel,
      navegadorId: corpo.navegador,
      separadorId: corpo.separador,
      tokenHash,
      iat,
      exp,
      navegador,
      sistema,
      cidade,
      pais,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Um batimento perdido não é motivo para pôr ninguém fora.
    console.error("[admin/sessao/batimento]", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
