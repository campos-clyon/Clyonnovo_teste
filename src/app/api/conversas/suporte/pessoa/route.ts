import { NextRequest, NextResponse } from "next/server";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { quemPedeAConversa } from "@/lib/quem-pede-a-conversa";
import { gravarMensagem, passarParaAEquipa, suporteDoCliente } from "@/lib/conversas-na-base";
import { chaveDeLeitura, vistaDaConversa } from "@/lib/conversas-da-clyon";

export const runtime = "nodejs";

/**
 * POST /api/conversas/suporte/pessoa — «falar com uma pessoa» (fase 1).
 *
 * Só o cliente, e só na «Suporte CLYON» da conta dele (nunca por um id que
 * venha de fora). A conversa passa a `atendidaPor = 'equipa'` e fica uma nota
 * do sistema no fio, que a equipa vê no separador «Suporte — clientes».
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "conversas-pessoa", 10, 300);
  if (limite.erro) return limite.erro;
  try {
    const quem = await quemPedeAConversa(req);
    if (!quem) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    if (quem.papel !== "cliente") {
      return NextResponse.json({ ok: false, error: "Só para clientes." }, { status: 403 });
    }
    const porConta = await limitarPorConta("conversas-pessoa-conta", chaveDeLeitura(quem), 5, 3600);
    if (porConta.erro) return porConta.erro;
    const c = await suporteDoCliente(quem.contaId);
    const jaEra = c.atendidaPor === "equipa";
    await passarParaAEquipa(c.id);
    if (!jaEra) {
      await gravarMensagem({
        conversaId: c.id,
        autor: "sistema",
        autorId: null,
        texto: "Pediu para falar com uma pessoa da equipa CLYON. Respondemos assim que possível.",
        textoOriginal: null,
        filtrada: false,
        anexoUrl: null,
      });
    }
    return NextResponse.json({ ok: true, conversa: vistaDaConversa({ ...c, atendidaPor: "equipa" }) });
  } catch (err) {
    console.error("[conversas/suporte/pessoa]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível chamar a equipa." }, { status: 500 });
  }
}
