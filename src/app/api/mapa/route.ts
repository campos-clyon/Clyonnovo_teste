import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { getMapsApiKey } from "@/lib/maps-config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { percursoDaNegociacao } from "@/lib/db";
import { parametrosDoMapa, podeVerAMoradaExacta, pontasDoPedido } from "@/lib/mapa-do-percurso";
import { percursoDoPedido } from "@/lib/percurso-do-pedido";

export const runtime = "nodejs";

/**
 * O mapinha de um endereço, servido por nós.
 *
 * O caminho óbvio era pôr o URL da Google diretamente no `src` da imagem. Isso
 * publica a chave em cada página onde o mapa aparece, e obriga a abrir a CSP a
 * um domínio externo. Aqui a chave nunca sai do servidor e a imagem continua a
 * vir de 'self'.
 *
 * Pede-se sessão — de profissional ou de cliente — porque um endereço não é
 * coisa que se desenhe a pedido de quem passa, e porque cada imagem destas é
 * uma chamada paga à Google. O travão por IP é a segunda linha: uma sessão
 * roubada não pode transformar isto numa fonte de mapas grátis à nossa conta.
 */

/** Uma semana. O mapa de uma morada não muda. */
const CACHE = "public, max-age=604800, s-maxage=604800, immutable";

export async function GET(req: NextRequest) {
  const daPlataforma = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  const doCliente = daPlataforma ? null : await getServerSession(authOptions);
  if (!daPlataforma && !doCliente?.user?.email) {
    return new NextResponse(null, { status: 401 });
  }

  const rl = await checkRateLimit(`mapa:${getClientIp(req)}`, 60, 600);
  if (!rl.allowed) return new NextResponse(null, { status: 429 });

  /*
   * O PERCURSO DE UMA MUDANÇA (11-11-2026) — `?percurso=<negociação>`, só para
   * o parceiro dessa negociação. Antes de contratado, só as duas cidades (sem
   * traçado); depois, os dois pontos e o traçado do Routes, guardado no pedido.
   * Quem decide é a base, nunca um parâmetro — ver mapa-do-percurso.ts.
   */
  const percurso = req.nextUrl.searchParams.get("percurso");
  if (percurso != null) {
    if (!daPlataforma) return new NextResponse(null, { status: 401 });
    return mapaDoPercurso(req, Number(percurso), daPlataforma.providerId);
  }

  const morada = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!morada) return new NextResponse(null, { status: 400 });

  const chave = getMapsApiKey();
  if (!chave) {
    // Sem chave não há mapa, e não há erro: quem chama desenha o bloco sem
    // imagem. Um 500 aqui punha uma cruz vermelha no meio de um ecrã que
    // funciona perfeitamente sem isto.
    return new NextResponse(null, { status: 204 });
  }

  const largura = Math.min(800, Math.max(200, Number(req.nextUrl.searchParams.get("w") ?? 640)));
  const altura = Math.min(400, Math.max(100, Number(req.nextUrl.searchParams.get("h") ?? 200)));

  const url =
    "https://maps.googleapis.com/maps/api/staticmap" +
    `?center=${encodeURIComponent(morada)}` +
    "&zoom=14" +
    `&size=${largura}x${altura}` +
    // scale=2 para não sair desfocado num telemóvel, que é onde isto se vê.
    "&scale=2" +
    "&maptype=roadmap" +
    `&markers=${encodeURIComponent(`color:0x00B4CC|${morada}`)}` +
    "&language=pt-PT&region=PT" +
    `&key=${chave}`;

  try {
    const resposta = await fetch(url, { next: { revalidate: 604800 } });
    if (!resposta.ok) {
      console.error("[api/mapa] Google recusou:", resposta.status);
      return new NextResponse(null, { status: 204 });
    }
    const imagem = await resposta.arrayBuffer();
    return new NextResponse(imagem, {
      headers: {
        "Content-Type": resposta.headers.get("content-type") ?? "image/png",
        "Cache-Control": CACHE,
      },
    });
  } catch (err) {
    console.error("[api/mapa] falhou:", err);
    return new NextResponse(null, { status: 204 });
  }
}

async function mapaDoPercurso(req: NextRequest, negociacaoId: number, providerId: number): Promise<NextResponse> {
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) return new NextResponse(null, { status: 400 });
  const chave = getMapsApiKey();
  if (!chave) return new NextResponse(null, { status: 204 });
  try {
    const n = await percursoDaNegociacao(negociacaoId, providerId);
    // De outro parceiro, ou não é uma mudança com a lista: como se não existisse.
    if (!n) return new NextResponse(null, { status: 404 });
    const pontas = pontasDoPedido(n.rawOrderJson);
    if (!pontas) return new NextResponse(null, { status: 204 });
    const exacto = podeVerAMoradaExacta(n.estado);
    const ponto = (p: { lat: number | null; lng: number | null }) => (p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null);
    // O traçado só se pergunta (e paga) quando se pode mostrar.
    const guardado = exacto ? await percursoDoPedido(n.pedidoId, n.percursoJson, ponto(pontas.origem), ponto(pontas.destino)) : null;
    const params = parametrosDoMapa({ exacto, origem: pontas.origem, destino: pontas.destino, polyline: guardado?.polyline ?? null });
    if (!params) return new NextResponse(null, { status: 204 });
    const largura = Math.min(800, Math.max(200, Number(req.nextUrl.searchParams.get("w") ?? 640)));
    const altura = Math.min(400, Math.max(100, Number(req.nextUrl.searchParams.get("h") ?? 240)));
    const url =
      "https://maps.googleapis.com/maps/api/staticmap" +
      `?size=${largura}x${altura}&scale=2&maptype=roadmap&${params.join("&")}&language=pt-PT&region=PT&key=${chave}`;
    const resposta = await fetch(url, { cache: "no-store" });
    if (!resposta.ok) {
      console.error("[api/mapa] Google recusou o percurso:", resposta.status);
      return new NextResponse(null, { status: 204 });
    }
    return new NextResponse(await resposta.arrayBuffer(), {
      headers: {
        "Content-Type": resposta.headers.get("content-type") ?? "image/png",
        // De um parceiro só, e muda quando ele é contratado: nada de cache partilhada.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[api/mapa] percurso falhou:", err);
    return new NextResponse(null, { status: 204 });
  }
}
