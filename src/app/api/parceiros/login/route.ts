import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import * as jose from "jose";

import { withConnection } from "@/lib/db";
import { getProviderSecretKey } from "@/lib/provider-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface ProviderRow {
  id: number;
  name: string;
  email: string | null;
  passwordHash: string | null;
  isActive: number;
}

async function generateToken(providerId: number, name: string) {
  return new jose.SignJWT({ providerId, name, type: "provider" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getProviderSecretKey());
}

/**
 * Mensagem única para qualquer credencial que não sirva.
 *
 * Antes havia três respostas diferentes: "Parceiro não encontrado",
 * "Palavra-passe incorreta" e "conta desativada". Isso diz a quem tenta
 * quais os emails que existem na base — dá para percorrer uma lista e
 * separar os que são parceiros dos que não são, antes sequer de tentar
 * adivinhar palavras-passe.
 */
const CREDENCIAIS_INVALIDAS = "Email ou palavra-passe incorretos.";

// POST /api/parceiros/login
export async function POST(req: NextRequest) {
  // Sem limite, uma página de login é um convite a tentar palavras-passe
  // até acertar. Cinco por IP em cada quarto de hora chega para quem se
  // engana e trava quem não se engana.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`parceiros-login:${ip}`, 5, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiadas tentativas. Aguarde uns minutos antes de tentar de novo." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const { email, senha } = body as Record<string, string | undefined>;
  if (!email || !senha) {
    return NextResponse.json({ error: "Email e palavra-passe são obrigatórios." }, { status: 400 });
  }

  const provider = await withConnection(async (conn) => {
    const [rows] = await conn.execute(
      "SELECT id, name, email, passwordHash, isActive FROM providers WHERE email = ? LIMIT 1",
      [String(email).trim().toLowerCase()],
    ) as [ProviderRow[], unknown];
    return rows[0] ?? null;
  });

  // Comparar sempre, mesmo sem parceiro: responder mais depressa quando o
  // email não existe é outra forma de o revelar.
  const hashFicticio = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  const passwordMatches = await bcrypt.compare(
    String(senha),
    provider?.passwordHash || hashFicticio,
  );

  if (!provider || !provider.passwordHash || !passwordMatches) {
    return NextResponse.json({ error: CREDENCIAIS_INVALIDAS }, { status: 401 });
  }

  // A conta desactivada só se revela a quem provou ser o dono dela.
  if (!provider.isActive) {
    return NextResponse.json({ error: "Esta conta de parceiro está desativada." }, { status: 403 });
  }


  const token = await generateToken(provider.id, provider.name);

  return NextResponse.json({
    token,
    provider: { id: provider.id, name: provider.name, email: provider.email },
  });
}
