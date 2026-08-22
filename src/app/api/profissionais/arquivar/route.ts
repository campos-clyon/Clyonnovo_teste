import { NextRequest, NextResponse } from "next/server";
import { arquivarNegociacao } from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";

export const runtime = "nodejs";

/**
 * Arrumar um trabalho, ou tirá-lo de novo do arquivo.
 *
 * PORQUE É QUE ISTO NÃO É APAGAR
 *
 * Porque o profissional não pode apagar o registo de um trabalho — nem o dele,
 * nem o do cliente. O que ele quer, quando pede isto, é outra coisa: tirar da
 * vista uma negociação que já não vai a lado nenhum, para conseguir ver as que
 * ainda contam.
 *
 * Arquivar é arrumação de quem arruma. Só mexe na coluna do lado dele: o
 * cliente continua a ver o mesmo, a carteira continua a contar o mesmo, e o
 * histórico permanente não se altera. E é reversível — o separador "Arquivados"
 * existe precisamente para nada desaparecer de vez.
 */
export async function POST(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: { negociacaoId?: unknown; arquivar?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  // Por omissão arquiva. Desarquivar é um pedido explícito.
  const arquivar = corpo.arquivar !== false;

  try {
    const mexeu = await arquivarNegociacao(
      negociacaoId,
      { providerId: sessao.providerId },
      arquivar,
    );
    if (!mexeu) {
      // 404 e não 403: dizer "não é seu" a quem tenta um id ao acaso confirma
      // que o id existe. Quem tem o trabalho nunca vê isto.
      return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, arquivado: arquivar });
  } catch (error) {
    console.error("[profissionais/arquivar]", error);
    return NextResponse.json({ error: "Não foi possível arquivar." }, { status: 500 });
  }
}
