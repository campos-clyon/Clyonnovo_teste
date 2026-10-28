import { NextRequest, NextResponse } from "next/server";
import { registarSemFalhar } from "@/lib/db";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { arquivarTrabalhosClyonSemResposta, resumoDaRotina } from "@/lib/arquivar-sem-resposta";
import { bearerConfere } from "@/lib/segredo-igual";

export const runtime = "nodejs";

/**
 * QUEM ACEITA UM TRABALHO CLYON TEM RESPOSTA EM 72 HORAS — 28-10-2026 (d12).
 *
 * 72 horas depois de o preço ir ao cliente sem resposta (e sem a CLYON ter
 * escolhido ninguém), o pedido passa para os Arquivados e quem aceitou é
 * avisado: «O cliente não respondeu — este trabalho ficou sem efeito.
 * Obrigado por ter aceitado.» A regra é `ficaSemEfeito`
 * (prazo-do-cliente-clyon.ts); o trabalho, `arquivarTrabalhosClyonSemResposta`.
 *
 * De hora a hora, como «Pedidos abertos voltam a procurar profissionais»: um
 * prazo de 72 horas não precisa de mais do que isso.
 */
export async function GET(req: NextRequest) {
  // Falha fechada: sem CRON_SECRET definido, a rota recusa. Aberta, seria um
  // endereço público que arquiva pedidos e manda avisos a profissionais.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/trabalhos-clyon-sem-resposta] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    // Cada passagem carimbada, com nada a fazer ou a rebentar (como as outras rotinas).
    const r = await carimbarPassagem(
      "trabalhos-clyon-sem-resposta",
      () => arquivarTrabalhosClyonSemResposta(),
      (a) => ({ ok: a.falhados === 0, motivo: a.arquivados.length > 0 || a.falhados > 0 ? resumoDaRotina(a) : null }),
    );

    // Só se regista quando houve alguma coisa — cada pedido já deixou a sua linha.
    if (r.arquivados.length > 0) {
      await registarSemFalhar({
        acontecimento: "negociacao_encerrada",
        autorTipo: "sistema",
        autorNome: "prazo do cliente",
        resumo: resumoDaRotina(r),
      });
    }

    return NextResponse.json({ ok: true, ...r, resumo: resumoDaRotina(r) });
  } catch (error) {
    console.error("[cron/trabalhos-clyon-sem-resposta]", error);
    return NextResponse.json({ error: "Falhou" }, { status: 500 });
  }
}
