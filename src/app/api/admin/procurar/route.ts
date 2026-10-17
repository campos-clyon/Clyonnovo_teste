import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth-helper";
import { procurarEmTodoOLado } from "@/lib/procurar-em-todo-o-lado-na-base";

export const runtime = "nodejs";

/**
 * PROCURAR UM PEDIDO EM TODO O BACKOFFICE — 17-10-2026. Ver
 * `procurar-em-todo-o-lado.ts`. Só leitura: devolve os pedidos que a procura
 * encontra, de onde vieram e onde se tratam.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const termo = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  try {
    return NextResponse.json({ resultados: await procurarEmTodoOLado(termo) });
  } catch (e) {
    console.error("[admin/procurar GET]", e);
    return NextResponse.json({ error: "Não foi possível procurar." }, { status: 500 });
  }
}
