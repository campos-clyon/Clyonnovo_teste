import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getToken } from "next-auth/jwt";
import { COOKIE_SESSAO_ADMIN, sessaoDeAdminValida } from "@/lib/colaborador-auth";
import {
  COOKIE_SESSAO_PROFISSIONAL,
  verificarSessaoDoProfissional,
} from "@/lib/profissional-auth";
import {
  COOKIE_CHAVE_MVP,
  COOKIE_SESSAO_TESTE,
  chaveConfere,
  verificarSessaoDeTeste,
} from "@/lib/acesso-mvp";

const CANONICAL_HOST = "clyon.pt";

// Cidades onde temos página dedicada em /mudancas/[cidade].
// URLs antigas /mudancas-cidade fazem 301 para /mudancas/cidade — preserva
// o SEO acumulado sem manter o formato antigo.
const MUDANCAS_CITIES_WITH_PAGE = [
  "lisboa",
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
  "almada",
  "cascais",
  "amadora",
  "seixal",
  "moita",
  "setubal",
];

/**
 * O backoffice é servido a quem tiver sessão — verificada aqui, no servidor.
 *
 * Até agora nada verificava nada antes de entregar o HTML de /admin: o painel
 * chegava ao browser e só depois o JavaScript olhava para o localStorage e
 * decidia se mandava a pessoa para o ecrã de entrada. Quem soubesse disso
 * escrevia duas chaves na consola e via o painel desenhar.
 *
 * A assinatura é verificada aqui à custa do cookie httpOnly que o login põe.
 * Se não houver cookie, se a assinatura não conferir, se o token tiver
 * expirado ou se não for de administrador, o pedido nem chega à página.
 */
async function temSessaoDeAdmin(request: NextRequest) {
  return sessaoDeAdminValida(request.cookies.get(COOKIE_SESSAO_ADMIN)?.value);
}

/**
 * O mesmo, para o profissional.
 *
 * A verificação exige `type: "profissional"` no token. Um cookie de
 * administrador colocado à mão neste nome não abre o painel dele — nem o
 * contrário, porque o verificador do colaborador recusa tudo o que traga um
 * `type`. Este projecto já teve um token de um domínio a passar por outro.
 */
async function temSessaoDeProfissional(request: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    request.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  return sessao !== null;
}

/**
 * Tudo o que vive atrás do portão do MVP, em duas camadas.
 *
 * Escrito como listas explícitas e não como "tudo menos o site" — uma regra por
 * exclusão deixa passar o que for criado amanhã, e o que for criado amanhã é
 * precisamente a parte nova.
 *
 * A CAMADA DE CIMA (chave + credenciais de testador) guarda o que não tem
 * autenticação nenhuma por baixo: a bancada de testes e o formulário de pedido,
 * onde qualquer pessoa que lá chegasse podia criar pedidos reais na base.
 *
 * A CAMADA DE BAIXO (só a chave) guarda o que já tem identidade própria: as
 * páginas dos profissionais, onde a segunda prova de quem é são as credenciais
 * DELE. Exigir-lhe também uma conta de testador dava-lhe duas palavras-passe
 * para o mesmo sítio e partia todos os links que lhe enviamos por email.
 */
function exigeTestador(caminho: string): boolean {
  return caminho === "/plataforma" || caminho.startsWith("/plataforma/");
}

/*
 * A INSCRIÇÃO SAIU DAQUI, E PORQUÊ.
 *
 * Estava em `exigeTestador` com esta justificação: "a inscrição é a única
 * escrita da plataforma que não exige sessão de ninguém — sem o portão à
 * frente, quem descobrisse o endereço inscrevia profissionais na base a partir
 * de uma linha de comandos".
 *
 * Isso era verdade quando foi escrito, e deixou de ser a 19-08-2026, quando a
 * inscrição passou a exigir convite. Hoje a rota valida um token de 256 bits,
 * guardado só em hash, com prazo e de uso único — uma credencial mais forte do
 * que a palavra-passe de um testador. Quem descobrir o endereço sem convite não
 * escreve nada: leva 403.
 *
 * E entretanto o portão passou a partir o que devia proteger. A PÁGINA do
 * formulário está em `exigeChave` (é `/profissionais/...`), por isso o
 * profissional convidado chega lá e preenche-a. O BOTÃO dela chamava uma rota
 * em `exigeTestador` — um nível acima — e o middleware devolvia 404 SEM CORPO.
 * O formulário faz `res.json()` a essa resposta vazia, o parse estoira, e o
 * `catch` mostra "Erro de rede. Verifique a ligação e tente novamente."
 *
 * Ou seja: dizia-se ao profissional que a Internet dele estava avariada, quando
 * o que estava era um formulário atrás de um portão e o seu próprio botão atrás
 * de outro, mais forte. Fica no mesmo nível da página que o serve.
 */

/**
 * AS SECÇÕES DE `/profissionais` QUE SÃO MESMO PRIVADAS.
 *
 * Escrita à mão e curta de propósito. O portão fecha tudo o que está debaixo de
 * `/profissionais/` menos uma coisa — a página pública de um profissional — e
 * a forma segura de fazer isso é listar o que fica fechado, e não o que abre.
 * Ao contrário, uma pasta nova criada daqui a seis meses nascia aberta.
 */
const SECCOES_PRIVADAS = [
  "painel",
  "entrar",
  "login",
  "inscricao",
  "definir-senha",
  "pedidos",
];

/**
 * O PERFIL PÚBLICO DE UM PROFISSIONAL — `/profissionais/joao-silva`.
 *
 * É a primeira coisa que a CLYON põe no Google que não é escrita por nós:
 * escreve-se sozinha à medida que ele trabalha. Estar atrás do portão do MVP
 * tornava-a inútil — uma página que o Google não pode ler não é SEO nenhum, e
 * um cliente que recebe uma proposta não podia ver com quem ia lidar.
 *
 * UM SEGMENTO SÓ. `/profissionais/joao-silva` abre; `/profissionais/painel` e
 * tudo o que tenha barra a mais continua fechado.
 */
function ePerfilPublicoDeProfissional(caminho: string): boolean {
  const partes = caminho.split("/").filter(Boolean);
  if (partes.length !== 2 || partes[0] !== "profissionais") return false;
  return !SECCOES_PRIVADAS.includes(partes[1]);
}

function exigeChave(caminho: string): boolean {
  if (ePerfilPublicoDeProfissional(caminho)) return false;
  return (
    caminho === "/profissionais" ||
    caminho.startsWith("/profissionais/") ||
    /*
     * A rota da inscrição, no MESMO nível da página que a chama.
     *
     * Tem de estar aqui à mão: o endereço dela é `/api/profissionais/...` e
     * não `/profissionais/...`, por isso a condição acima não a apanha. Sem
     * esta linha, tirá-la do `exigeTestador` deixava-a sem portão nenhum.
     */
    caminho === "/api/profissionais/inscricao"
  );
}

/**
 * O que fica de fora de tudo isto.
 *
 * Os links com token são credenciais por si: 256 bits aleatórios, guardados em
 * hash. São mais fortes do que qualquer palavra-passe que alguém escolha, e
 * pô-los atrás do portão obrigava o cliente de teste a ter conta — deixávamos
 * de estar a testar o fluxo real, que é um cliente sem conta nenhuma a abrir o
 * link que lhe chegou por email.
 *
 * E a PÁGINA DE ENTRADA do profissional, porque as credenciais dele SÃO o
 * portão. Com ela atrás da chave, o link que se dava a um profissional era
 * `/profissionais/entrar?chave=vUyd...` — impossível de ditar ao telefone e
 * partido ao fim de 30 dias, quando o cookie da chave expirava no telemóvel
 * dele. Agora o endereço é só `clyon.pt/profissionais/login`. O que isto
 * expõe ao público é um formulário de login sem indexação; tudo o resto do
 * MVP continua a responder 404.
 */
function portaAberta(caminho: string): boolean {
  return caminho.startsWith("/profissionais/pedidos/") ||
    caminho.startsWith("/profissionais/definir-senha/") ||
    caminho === "/profissionais/entrar" ||
    caminho === "/profissionais/login"
}

export async function middleware(request: NextRequest) {
  const { nextUrl, headers } = request;

  /*
   * Trava no consumo dos links de entrada.
   *
   * O token tem 256 bits e não se adivinha — ninguém entra por força bruta. O
   * que se trava aqui é o custo: cada tentativa é uma consulta indexada à
   * base, e um guião que dispare milhares por segundo não descobre nada mas
   * ocupa a base a dizer que não.
   *
   * Fica no middleware e não dentro do NextAuth porque é aqui que se apanha o
   * pedido antes de ele custar seja o que for.
   */
  if (nextUrl.pathname.startsWith("/api/auth/callback/link-de-entrada")) {
    const rl = await checkRateLimit(`entrada-consumo:${getClientIp(request)}`, 20, 300);
    if (!rl.allowed) {
      return new NextResponse(null, { status: 429, headers: { "Retry-After": "300" } });
    }
  }

  // Marcado pelo portão e aplicado a toda a resposta que saia daqui.
  let semIndexacao = false;

  // ── O portão do ambiente de testes ────────────────────────────────────────
  //
  // Duas fechaduras. A chave no endereço diz que a pessoa sabe onde é; as
  // credenciais dizem quem é. Sem a primeira, responde-se 404: um 403
  // confirmaria a quem anda a sondar que ali existe qualquer coisa.
  // O endereço curto que se dita ao telefone. "login" em vez de "entrar"
  // porque é a palavra que toda a gente reconhece num endereço — o site por
  // dentro continua a dizer "entrar".
  if (nextUrl.pathname === "/profissionais/login") {
    return NextResponse.redirect(new URL("/profissionais/entrar", request.url), 301);
  }

  const precisaDeTestador = exigeTestador(nextUrl.pathname);
  const precisaDeChave = precisaDeTestador || exigeChave(nextUrl.pathname);

  // A chave passa a cookie e sai do endereço — senão viaja em cada partilha
  // de ecrã, fica no histórico e aparece no cabeçalho Referer de tudo o que
  // a página carregue. Fora do portão de propósito: o link antigo com
  // ?chave= aponta para a página de entrar, que hoje é ABERTA — sem isto, a
  // chave ficava pendurada na barra de endereço de quem o abrisse. Só se
  // guarda uma chave que CONFERE: gravar o que viesse deixava um
  // `?chave=errada` pisar um cookie válido.
  if (precisaDeChave) {
    const chaveNoEndereco = nextUrl.searchParams.get("chave");
    if (chaveNoEndereco && chaveConfere(chaveNoEndereco)) {
      const limpo = new URL(request.url);
      limpo.searchParams.delete("chave");
      const resposta = NextResponse.redirect(limpo);
      resposta.cookies.set(COOKIE_CHAVE_MVP, chaveNoEndereco, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      return resposta;
    }
  }

  if (precisaDeChave && !portaAberta(nextUrl.pathname)) {
    const chaveNoCookie = request.cookies.get(COOKIE_CHAVE_MVP)?.value;
    const sabeOEndereco = chaveConfere(chaveNoCookie);

    if (!sabeOEndereco) {
      // A conta do profissional vale como passagem na camada da chave: quem
      // acabou de provar quem é com as credenciais DELE já mostrou mais do
      // que a chave partilhada mostra. Sem isto, o login aberto autenticava
      // e o painel respondia 404 logo a seguir — entrava-se para lado nenhum.
      const entraPelaConta = !precisaDeTestador && (await temSessaoDeProfissional(request));
      if (!entraPelaConta) {
        return new NextResponse(null, { status: 404 });
      }
    }

    const temSessao =
      !precisaDeTestador ||
      (await verificarSessaoDeTeste(request.cookies.get(COOKIE_SESSAO_TESTE)?.value)) !== null;

    if (!temSessao && nextUrl.pathname !== "/plataforma/entrar") {
      // Uma API responde com um código, não com um desvio para um ecrã de
      // entrada — quem está a chamá-la não tem browser para o seguir.
      if (nextUrl.pathname.startsWith("/api/")) {
        return new NextResponse(null, { status: 404 });
      }
      const entrada = new URL("/plataforma/entrar", request.url);
      entrada.searchParams.set("proximo", nextUrl.pathname + nextUrl.search);
      return NextResponse.redirect(entrada);
    }

    // NÃO se devolve aqui uma resposta. Passar o portão não é chegar ao
    // destino: as verificações que vêm a seguir — a sessão do profissional
    // para o painel dele, por exemplo — têm de correr na mesma. Devolver
    // `next()` aqui saltava-as todas, e uma conta de testador passava a abrir
    // o painel de um profissional.
    semIndexacao = true;
  }

  // Proteger o backoffice — /admin/login é a única porta aberta
  if (nextUrl.pathname === "/admin" || nextUrl.pathname.startsWith("/admin/")) {
    if (nextUrl.pathname !== "/admin/login" && !(await temSessaoDeAdmin(request))) {
      const entrada = new URL("/admin/login", request.url);
      // Voltar ao sítio onde ia dar depois de entrar
      if (nextUrl.pathname !== "/admin") {
        entrada.searchParams.set("proximo", nextUrl.pathname + nextUrl.search);
      }
      return NextResponse.redirect(entrada);
    }
  }

  // Proteger /conta — requer sessão de cliente Google
  // (startsWith("/conta") apanharia também "/contactos" — por isso a checagem exata + "/conta/")
  if (nextUrl.pathname === "/conta" || nextUrl.pathname.startsWith("/conta/")) {
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
  // Proteger o painel do profissional.
  //
  // Só o /painel: a inscrição, a entrada e o link para definir palavra-passe
  // têm de continuar abertos — é por eles que se chega aqui. E o
  // /profissionais/pedidos/[token] também, porque o token É a credencial.
  if (nextUrl.pathname.startsWith("/profissionais/painel")) {
    if (!(await temSessaoDeProfissional(request))) {
      const entrada = new URL("/profissionais/entrar", request.url);
      return NextResponse.redirect(entrada);
    }
  }

  const host = headers.get("host") ?? nextUrl.host;
  const forwardedProto = headers.get("x-forwarded-proto") ?? nextUrl.protocol.replace(":", "");

  // 1. Força HTTPS e sem www (redirect to canonical domain)
  // Excluir rotas /api/ do redirect — são chamadas internas onde o
  // Authorization header seria perdido no redirect.
  // Excluir localhost/127.0.0.1 — nunca ocorre em produção, só permite dev local.
  const isApiOrInternal = nextUrl.pathname.startsWith("/api/");
  const isLocalDev = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  // Deployments de teste no Vercel (preview/staging) não devem ser forçados para o domínio de produção.
  const isVercelPreview = host.endsWith(".vercel.app");

  if (!isApiOrInternal && !isLocalDev && !isVercelPreview && (host !== CANONICAL_HOST || forwardedProto !== "https")) {
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
    
    // /mudanças (sem cidade) → /mudancas
    if (decodedPath === "/mudanças") {
      return NextResponse.redirect(new URL("/mudancas", request.url), 301);
    }

    // /mudanças-cidade → /mudancas/cidade quando temos a página
    if (decodedPath.startsWith("/mudanças-")) {
      const city = decodedPath.substring(10);
      if (MUDANCAS_CITIES_WITH_PAGE.includes(city)) {
        return NextResponse.redirect(new URL(`/mudancas/${city}`, request.url), 301);
      }
      return NextResponse.redirect(new URL("/mudancas", request.url), 301);
    }
  }

  // 4. URLs antigas /mudancas-cidade → 301 para /mudancas/cidade
  //    Preserva o SEO acumulado das long-tails ("mudanças alcochete", etc.)
  //    em vez de as colapsar todas na página genérica.
  if (nextUrl.pathname.startsWith("/mudancas-")) {
    const city = nextUrl.pathname.substring(10); // Remove "/mudancas-"
    if (MUDANCAS_CITIES_WITH_PAGE.includes(city)) {
      return NextResponse.redirect(new URL(`/mudancas/${city}`, request.url), 301);
    }
    // Cidade não conhecida — cai na página genérica /mudancas
    return NextResponse.redirect(new URL("/mudancas", request.url), 301);
  }

  const resposta = NextResponse.next();
  if (semIndexacao) {
    resposta.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    resposta.headers.set("Cache-Control", "no-store, private");
  }
  return resposta;
}

export const config = {
  matcher: [
    // Rotas protegidas por autenticação de cliente
    "/conta/:path*",
    // Todas as outras rotas (excluindo assets estáticos)
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|site.webmanifest).*)",
  ],
};
