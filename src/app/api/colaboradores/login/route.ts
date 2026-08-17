import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import * as jose from "jose";

import { getColaboradorByNome, getDb } from "@/lib/db";
import { COOKIE_SESSAO_ADMIN, DURACAO_SESSAO_ADMIN_SEGUNDOS, getColaboradorSecretKey } from "@/lib/colaborador-auth";

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// Mensagem genérica para não revelar se o nome existe na base de dados.
const CREDENCIAIS_INVALIDAS = "Nome ou palavra-passe incorretos.";

// Rate limiting simples em memória (por IP). Limita tentativas de força bruta.
const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000; // 15 minutos
const tentativas = new Map<string, { count: number; reset: number }>();

function obterIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "desconhecido";
}

function registarTentativa(ip: string) {
  const agora = Date.now();
  const registo = tentativas.get(ip);
  if (!registo || agora > registo.reset) {
    tentativas.set(ip, { count: 1, reset: agora + JANELA_MS });
    return;
  }
  registo.count += 1;
}

function estaBloqueado(ip: string) {
  const registo = tentativas.get(ip);
  if (!registo) return false;
  if (Date.now() > registo.reset) {
    tentativas.delete(ip);
    return false;
  }
  return registo.count >= MAX_TENTATIVAS;
}

function limparTentativas(ip: string) {
  tentativas.delete(ip);
}

export async function POST(req: NextRequest) {
  const ip = obterIp(req);

  if (estaBloqueado(ip)) {
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tente novamente dentro de alguns minutos." },
      { status: 429 },
    );
  }

  try {
    const { nome, senha, rememberMe } = await req.json();
    const nomeNormalizado = typeof nome === "string" ? nome.trim().toUpperCase() : "";
    const senhaNormalizada = typeof senha === "string" ? senha : "";
    const manterSessao = rememberMe === true;

    if (!nomeNormalizado || !senhaNormalizada) {
      return NextResponse.json({ error: "Nome e senha são obrigatórios" }, { status: 400 });
    }

    const db = await getDb();
    if (!db) {
      console.error("[Colaborador Login] DATABASE_URL not configured");
      return NextResponse.json(
        { error: "Área interna indisponível. Verifique a configuração da base de dados." },
        { status: 503 },
      );
    }

    // O segredo verifica-se ANTES de comparar a palavra-passe, e não no fim
    // quando se assina o token.
    //
    // Estava a ser usado só no fim, e o resultado era o pior diagnóstico
    // possível: num ambiente sem JWT_SECRET — um preview onde a variável não
    // foi copiada, por exemplo — a palavra-passe certa passava a comparação e
    // rebentava a seguir, devolvendo "Erro interno do servidor". Quem estava a
    // entrar concluía, com toda a razão, que a palavra-passe não funcionava.
    if (!process.env.JWT_SECRET) {
      console.error("[Colaborador Login] JWT_SECRET não está definido neste ambiente");
      return NextResponse.json(
        {
          error:
            "Área interna mal configurada: falta o JWT_SECRET neste ambiente. " +
            "A palavra-passe não é o problema.",
        },
        { status: 503 },
      );
    }

    const colaborador = await getColaboradorByNome(nomeNormalizado);
    if (!colaborador) {
      registarTentativa(ip);
      return NextResponse.json({ error: CREDENCIAIS_INVALIDAS }, { status: 401 });
    }

    if (!colaborador.senha || !BCRYPT_HASH_REGEX.test(colaborador.senha)) {
      // Só o id: o nome é a credencial de entrada deste painel, e escrevê-lo
      // nos registos é dar metade do par a quem os leia.
      console.error("[Colaborador Login] hash de palavra-passe inválido", {
        colaboradorId: colaborador.id,
      });
      return NextResponse.json(
        { error: "As credenciais deste colaborador precisam de ser repostas." },
        { status: 500 },
      );
    }

    let senhaValida = false;
    try {
      senhaValida = await bcrypt.compare(senhaNormalizada, colaborador.senha);
    } catch (error) {
      console.error("[Colaborador Login] Password compare failed", error);
      return NextResponse.json(
        { error: "As credenciais deste colaborador precisam de ser repostas." },
        { status: 500 },
      );
    }

    if (!senhaValida) {
      registarTentativa(ip);
      return NextResponse.json({ error: CREDENCIAIS_INVALIDAS }, { status: 401 });
    }

    // Login bem-sucedido: limpa o contador de tentativas deste IP.
    limparTentativas(ip);

    // As funções de assistente, motorista e ajudante deixaram de existir. As
    // contas antigas continuam na tabela — não se apagam registos de pessoas
    // que trabalharam connosco — mas deixam de poder entrar.
    //
    // Aceita-se `funcao === "admin"` além de `isAdmin === 1` porque houve
    // contas gravadas só com a função, com isAdmin a 0; o token normaliza para
    // 1. Sem isto, um administrador antigo ficava fechado fora do painel.
    const eAdministrador = colaborador.isAdmin === 1 || colaborador.funcao === "admin";
    if (!eAdministrador) {
      return NextResponse.json(
        { error: "Esta conta não tem acesso ao backoffice." },
        { status: 403 },
      );
    }

    const token = await new jose.SignJWT({
      id: colaborador.id,
      nome: colaborador.nome,
      isAdmin: 1,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(manterSessao ? "30d" : "8h")
      .sign(getColaboradorSecretKey());

    const resposta = NextResponse.json({
      token,
      colaborador: {
        id: colaborador.id,
        nome: colaborador.nome,
        isAdmin: 1,
      },
    });

    // O mesmo token, agora também onde o servidor o vê. httpOnly para que
    // nenhum script da página lhe toque; sameSite lax para sobreviver a vir
    // de um link externo sem servir para pedidos cruzados.
    resposta.cookies.set(COOKIE_SESSAO_ADMIN, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_SESSAO_ADMIN_SEGUNDOS,
    });

    return resposta;
  } catch (error) {
    console.error("[Colaborador Login]", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
