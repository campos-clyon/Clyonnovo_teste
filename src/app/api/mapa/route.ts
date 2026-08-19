import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { getMapsApiKey } from "@/lib/maps-config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * O mapinha de um endereço, servido por nós.
 *
 * O caminho óbvio era pôr o URL da Google directamente no `src` da imagem. Isso
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
  const daPlataforma = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  const doCliente = daPlataforma ? null : await getServerSession(authOptions);
  if (!daPlataforma && !doCliente?.user?.email) {
    return new NextResponse(null, { status: 401 });
  }

  const rl = await checkRateLimit(`mapa:${getClientIp(req)}`, 60, 600);
  if (!rl.allowed) return new NextResponse(null, { status: 429 });

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
