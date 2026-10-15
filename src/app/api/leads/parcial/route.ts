import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { guardarContactoAMeio } from "@/lib/db";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { problemaDoTelefone } from "@/lib/telefone-do-cliente";
import { tService } from "@/lib/translations";

/*
 * POST /api/leads/parcial — o nome e o telefone de quem avançou do passo 1
 * do formulário da página inicial (14-10-2026). Ver contacto-a-meio.ts.
 *
 * Rota aberta, como a do formulário: limitada por IP, e um telefone que não
 * é telefone não se grava. Responde sempre depressa — quem chama não espera
 * por isto para seguir para o passo 2.
 */
const Corpo = z.object({
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().min(6).max(40),
  servico: z.string().trim().max(80).optional(),
  pagePath: z.string().max(255).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  gclid: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "leads-parcial", 10, 300);
  if (limite.erro) return limite.erro;

  const lido = Corpo.safeParse(await req.json().catch(() => null));
  if (!lido.success) return NextResponse.json({ ok: false }, { status: 400 });
  const d = lido.data;
  if (problemaDoTelefone(d.telefone)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await guardarContactoAMeio({
      nome: d.nome,
      telefone: d.telefone,
      tipoServico: d.servico ? tService(d.servico) : "",
      pagePath: d.pagePath ?? "/",
      utmSource: d.utmSource ?? null,
      utmMedium: d.utmMedium ?? null,
      utmCampaign: d.utmCampaign ?? null,
      gclid: d.gclid ?? null,
    });
  } catch (e) {
    console.error("[leads/parcial] não gravou:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
