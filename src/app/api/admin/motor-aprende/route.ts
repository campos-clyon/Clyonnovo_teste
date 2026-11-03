import { NextRequest, NextResponse } from "next/server";

import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { AMOSTRA_MINIMA, FATOR_MAXIMO, FATOR_MINIMO } from "@/lib/motor-aprende";
import { DIAS_A_OLHAR, relatorioDaAprendizagem } from "@/lib/motor-aprende-na-base";

export const dynamic = "force-dynamic";

/*
 * O QUE O MOTOR APRENDEU — 03-11-2026. Ver `motor-aprende.ts`.
 *
 * Por serviço: quantos trabalhos acordados contam, a mediana do acordado ÷
 * estimado, e o fator que o simulador está de facto a aplicar. Só o admin
 * geral vê: são números do negócio.
 */
export async function GET(request: NextRequest) {
  const { err } = await requireAdminGeral(request);
  if (err) return err;
  try {
    const servicos = await relatorioDaAprendizagem();
    return NextResponse.json({
      servicos,
      regras: { amostraMinima: AMOSTRA_MINIMA, fatorMinimo: FATOR_MINIMO, fatorMaximo: FATOR_MAXIMO, dias: DIAS_A_OLHAR },
    });
  } catch (e) {
    console.error("[admin/motor-aprende]", String(e).slice(0, 200));
    return NextResponse.json({ error: "Não foi possível ler os trabalhos acordados." }, { status: 500 });
  }
}
