import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const CANONICAL_HOST = "clyon.pt";

// Todas as cidades de mudanças que devem redirecionar para /mudancas
// (exceto lisboa que é especial e fica em /mudancas-lisboa)
const WEAK_MUDANCAS_CITIES = [
  "alcochete",
  "sintra",
  "montijo",
  "carnaxide",
  "oeiras",
  "corroios",
  "barreiro",
  "palmela",
  "odivelas",
  "lumiar",
  "sesimbra",
  "costa-da-caparica",
];

export async function middleware(request: NextRequest) {
  const { nextUrl, headers } = request;

  // Proteger /conta — requer sessão de cliente Google
  if (nextUrl.pathname.startsWith("/conta")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token) {
      const loginUrl = new URL("/entrar", request.url);
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  const host = headers.get("host") ?? nextUrl.host;
  const forwardedProto = headers.get("x-forwarded-proto") ?? nextUrl.protocol.replace(":", "");

  // 1. Força HTTPS e sem www (redirect to canonical domain)
  // Excluir rotas /api/ e /colaboradores/ do redirect — são chamadas internas
  // onde o Authorization header seria perdido no redirect.
  // Excluir localhost/127.0.0.1 — nunca ocorre em produção, só permite dev local.
  const isApiOrInternal =
    nextUrl.pathname.startsWith("/api/") ||
    nextUrl.pathname.startsWith("/colaboradores/");
  const isLocalDev = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);

  if (!isApiOrInternal && !isLocalDev && (host !== CANONICAL_HOST || forwardedProto !== "https")) {
    const redirectUrl = new URL(request.url);
    redirectUrl.protocol = "https:";
    redirectUrl.host = CANONICAL_HOST;
    return NextResponse.redirect(redirectUrl, 301);
  }

  // 2. URLs permanentemente removidas - retornar 410 Gone
  const goneUrls = ["/credito-fiscal"];
  if (goneUrls.includes(nextUrl.pathname)) {
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Serviço Descontinuado | CLYON</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; padding: 1rem; }
    .container { max-width: 540px; text-align: center; padding: 2.5rem; background: white; border-radius: 1.5rem; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .badge { display: inline-block; color: #0891b2; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 1rem; }
    h1 { color: #0f172a; font-size: 1.5rem; font-weight: 700; margin: 0 0 0.75rem; line-height: 1.3; }
    .desc { color: #64748b; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .divider { height: 1px; background: #e2e8f0; margin: 1.5rem 0; }
    .links-title { color: #334155; font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; }
    .links { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
    .link { display: inline-block; padding: 0.5rem 1rem; background: #f1f5f9; color: #0f172a; text-decoration: none; border-radius: 0.5rem; font-size: 0.875rem; transition: all 0.15s; }
    .link:hover { background: #0891b2; color: white; }
    .home { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem; color: #0891b2; text-decoration: none; font-weight: 500; }
    .home:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">410 - Serviço Descontinuado</span>
    <h1>Este serviço já não está disponível</h1>
    <p class="desc">A CLYON não presta actualmente este serviço. Mas temos outras soluções que podem ajudar.</p>
    <div class="divider"></div>
    <p class="links-title">Serviços disponíveis:</p>
    <div class="links">
      <a href="/recolha-de-moveis" class="link">Recolha de Móveis</a>
      <a href="/recolha-de-entulho" class="link">Recolha de Entulho</a>
      <a href="/esvaziamento-de-casas" class="link">Esvaziamento de Casas</a>
      <a href="/mudancas" class="link">Mudanças</a>
      <a href="/servicos" class="link">Todos os Serviços</a>
      <a href="/simulador" class="link">Simulador de Preços</a>
      <a href="/contactos" class="link">Contactos</a>
    </div>
    <a href="/" class="home">← Voltar à página inicial</a>
  </div>
</body>
</html>`,
      {
        status: 410,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex",
        },
      }
    );
  }

  // 3. Redirects de URLs antigas e deprecated
  if (nextUrl.pathname === "/contato") {
    return NextResponse.redirect(new URL("/contactos", request.url), 301);
  }

  if (nextUrl.pathname === "/avaliacoes-clientes") {
    return NextResponse.redirect(new URL("/avaliacoes", request.url), 301);
  }

  if (nextUrl.pathname === "/central-ajuda") {
    return NextResponse.redirect(new URL("/faq", request.url), 301);
  }

  // 4. Redirect URLs com cedilha "mudanças" para versão sem acento "mudancas"
  if (nextUrl.pathname.includes("mudan%C3%A7as") || nextUrl.pathname.includes("mudanças")) {
    const decodedPath = decodeURIComponent(nextUrl.pathname);
    
    // /mudanças-lisboa → /mudancas-lisboa
    if (decodedPath === "/mudanças-lisboa") {
      return NextResponse.redirect(new URL("/mudancas-lisboa", request.url), 301);
    }
    
    // /mudanças (sem cidade) → /mudancas
    if (decodedPath === "/mudanças") {
      return NextResponse.redirect(new URL("/mudancas", request.url), 301);
    }
    
    // /mudanças-[qualquer cidade] → /mudancas
    if (decodedPath.startsWith("/mudanças-")) {
      return NextResponse.redirect(new URL("/mudancas", request.url), 301);
    }
  }

  // 4. Redirect mudanças fracas (sem cedilha) para /mudancas
  if (nextUrl.pathname.startsWith("/mudancas-")) {
    const city = nextUrl.pathname.substring(10); // Remove "/mudancas-"
    if (WEAK_MUDANCAS_CITIES.includes(city)) {
      return NextResponse.redirect(new URL("/mudancas", request.url), 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Rotas protegidas por autenticação de cliente
    "/conta/:path*",
    // Todas as outras rotas (excluindo assets estáticos)
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|site.webmanifest).*)",
  ],
};
