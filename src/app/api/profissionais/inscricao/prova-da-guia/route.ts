import { NextRequest, NextResponse } from "next/server";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { hashDeToken } from "@/lib/pedido-acesso";
import { profissionalDaInscricaoRecente } from "@/lib/db";
import { receberProvaDaGuia } from "@/lib/prova-da-guia-no-servidor";

export const runtime = "nodejs";

/**
 * A PROVA DO REGISTO, LOGO A SEGUIR À INSCRIÇÃO — 12-11-2026 (d5).
 *
 * A inscrição não tem sessão. O formulário manda a prova depois de a
 * inscrição gravar, com o convite que acabou de gastar (multipart: `file` e
 * `convite`). Só passa para o profissional que esse convite criou, na primeira
 * hora, e enquanto não tiver prova (`profissionalDaInscricaoRecente`). Fora
 * disso, a prova junta-se no painel.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "profissional-inscricao-prova", 5, 600);
  if (limite.erro) return limite.erro;

  let convite = "";
  try {
    const fd = await req.clone().formData();
    const c = fd.get("convite");
    convite = typeof c === "string" ? c : "";
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!convite) return NextResponse.json({ error: "Convite inválido." }, { status: 403 });

  const providerId = await profissionalDaInscricaoRecente(hashDeToken(convite));
  if (!providerId) {
    return NextResponse.json(
      { error: "Já não dá para juntar a prova por aqui. Junte-a no seu painel, em Faturação e IVA." },
      { status: 403 },
    );
  }
  return receberProvaDaGuia(req, providerId);
}
