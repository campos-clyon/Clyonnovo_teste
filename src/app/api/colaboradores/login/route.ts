import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import * as jose from "jose";

import { getColaboradorByNome, getDb } from "@/lib/db";
import { getColaboradorSecretKey } from "@/lib/colaborador-auth";

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

    const colaborador = await getColaboradorByNome(nomeNormalizado);
    if (!colaborador) {
      registarTentativa(ip);
      return NextResponse.json({ error: CREDENCIAIS_INVALIDAS }, { status: 401 });
    }

    if (!colaborador.senha || !BCRYPT_HASH_REGEX.test(colaborador.senha)) {
      console.error("[Colaborador Login] Invalid password hash", {
        colaboradorId: colaborador.id,
        nome: colaborador.nome,
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

    const token = await new jose.SignJWT({
      id: colaborador.id,
      nome: colaborador.nome,
      funcao: colaborador.funcao,
      isAdmin: colaborador.isAdmin,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(manterSessao ? "30d" : "8h")
      .sign(getColaboradorSecretKey());

    return NextResponse.json({
      token,
      colaborador: {
        id: colaborador.id,
        nome: colaborador.nome,
        funcao: colaborador.funcao,
        valorHora: colaborador.valorHora,
        isAdmin: colaborador.isAdmin,
      },
    });
  } catch (error) {
    console.error("[Colaborador Login]", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
