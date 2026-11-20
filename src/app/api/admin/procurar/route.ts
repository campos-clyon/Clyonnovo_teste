import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth-helper";
import { assistentePorId } from "@/lib/assistentes";
import { gruposQuePodeVer, soOQuePodeVer } from "@/lib/procura-do-backoffice";
import { procurarNoBackoffice } from "@/lib/procura-do-backoffice-na-base";

export const runtime = "nodejs";

/**
 * «EM TODO O BACKOFFICE» — d79 (20-11-2026), a barra única do backoffice. Só
 * leitura: o que a procura encontra em cada grupo (pedidos, clientes,
 * profissionais, pagamentos e referências, WhatsApp, agenda, faturas e
 * comprovativos), no máximo umas linhas de cada.
 *
 * O ACESSO CONFERE-SE AQUI, e não no ecrã: o assistente só recebe os grupos
 * das secções que tem (`gruposQuePodeVer`, lidas da base agora), a base só é
 * lida para esses, e à saída passa-se outra vez pelo filtro (`soOQuePodeVer`).
 * Os Leads ficam de fora (dono): não há grupo deles.
 */
export async function GET(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const termo = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  try {
    const seccoes = colab.papel === "admin" ? null : ((await assistentePorId(colab.id))?.seccoes ?? []);
    const grupos = gruposQuePodeVer(colab.papel, seccoes);
    const encontrados = soOQuePodeVer(await procurarNoBackoffice(termo, grupos), grupos);
    return NextResponse.json({ grupos: encontrados });
  } catch (e) {
    console.error("[admin/procurar GET]", e);
    return NextResponse.json({ error: "Não foi possível procurar." }, { status: 500 });
  }
}
