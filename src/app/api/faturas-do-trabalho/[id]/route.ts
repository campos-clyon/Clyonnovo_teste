import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { sessaoDoCliente } from "@/lib/cliente-auth";
import { CABECALHO_DO_TOKEN_DO_PAGAMENTO } from "@/lib/cabecalho-do-pagamento";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { trabalhoQueSePodePagar, trabalhoVistoPeloBackoffice } from "@/lib/acesso-ao-pagamento";
import { faturaParaLer } from "@/lib/faturas-do-trabalho-na-base";
import { eDoBlobPublico, linkDaFaturaValido } from "@/lib/faturas-do-trabalho-link";
import { tokenDoBlobDasFaturas } from "@/lib/faturas-do-trabalho-no-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LER UMA FATURA DO TRABALHO — d28 (CEO e dono, 15-11-2026).
 *
 * As faturas têm nome, NIF e morada. Abrem só por aqui, e só para quem pode ver
 * o trabalho:
 *   · o link assinado e dentro do prazo que as rotas autorizadas dão
 *     (`linkDaFatura`); ou
 *   · a equipa (sessão do backoffice); ou
 *   · o parceiro do trabalho (a sessão dele); ou
 *   · o cliente, pelas credenciais do pedido (o token do pedido ou a conta).
 * «Não existe» e «não pode ver» respondem igual (404).
 */
const NAO_ENCONTRADA = () => NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });

async function podeVer(
  req: NextRequest,
  f: { id: number; negociacaoId: number; pedidoId: number },
): Promise<boolean> {
  const p = req.nextUrl.searchParams;
  if (linkDaFaturaValido(f.id, p.get("ate"), p.get("a"))) return true;

  const admin = await requireAdmin(req).catch(() => null);
  if (admin && !admin.err) return true;

  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req)).catch(() => null);
  if (sessao) {
    const acesso = await trabalhoVistoPeloBackoffice(f.negociacaoId).catch(() => null);
    if (acesso?.ok && acesso.trabalho.providerId === sessao.providerId) return true;
  }

  const token = req.headers.get(CABECALHO_DO_TOKEN_DO_PAGAMENTO)?.trim() || p.get("token") || undefined;
  const email = (await sessaoDoCliente(req).catch(() => null))?.user?.email ?? null;
  if (token || email) {
    const acesso = await trabalhoQueSePodePagar(f.pedidoId, f.negociacaoId, { token, email }).catch(() => null);
    if (acesso?.ok) return true;
  }
  return false;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const limite = await limitarRotaPublica(req, "fatura-do-trabalho-ler", 60, 300);
  if (limite.erro) return limite.erro;
  const id = Number((await ctx.params).id);
  const f = await faturaParaLer(id).catch(() => null);
  if (!f) return NAO_ENCONTRADA();
  if (!(await podeVer(req, f))) return NAO_ENCONTRADA();

  try {
    let corpo: ReadableStream<Uint8Array> | null = null;
    let tipo: string | null = null;
    if (eDoBlobPublico(f.url)) {
      // As de antes do armazenamento privado: lêem-se no servidor, e o endereço não sai daqui.
      const r = await fetch(f.url, { cache: "no-store" });
      if (!r.ok || !r.body) return NAO_ENCONTRADA();
      corpo = r.body;
      tipo = r.headers.get("content-type");
    } else {
      const token = tokenDoBlobDasFaturas();
      if (!token) {
        console.error("[faturas-do-trabalho] fatura privada sem o token do armazenamento privado");
        return NextResponse.json({ error: "Não foi possível abrir a fatura." }, { status: 503 });
      }
      const r = await get(f.url, { access: "private", token });
      if (!r || r.statusCode !== 200 || !r.stream) return NAO_ENCONTRADA();
      corpo = r.stream;
      tipo = r.blob.contentType;
    }
    const nome = (f.nome ?? `fatura-${f.id}`).replace(/[^\w.\- ]/g, "_");
    return new NextResponse(corpo, {
      status: 200,
      headers: {
        "Content-Type": tipo || "application/octet-stream",
        "Content-Disposition": `inline; filename="${nome}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    console.error("[faturas-do-trabalho]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível abrir a fatura." }, { status: 500 });
  }
}
