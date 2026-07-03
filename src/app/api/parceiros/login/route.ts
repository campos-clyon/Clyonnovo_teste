import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import * as jose from "jose";

import { withConnection } from "@/lib/db";
import { getProviderSecretKey } from "@/lib/provider-auth";

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

// POST /api/parceiros/login
export async function POST(req: NextRequest) {
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

  if (!provider) {
    return NextResponse.json({ error: "Parceiro não encontrado." }, { status: 401 });
  }
  if (!provider.isActive) {
    return NextResponse.json({ error: "Esta conta de parceiro está desativada." }, { status: 403 });
  }
  if (!provider.passwordHash) {
    return NextResponse.json({ error: "Conta ainda não tem palavra-passe definida. Contacta a CLYON." }, { status: 403 });
  }

  const passwordMatches = await bcrypt.compare(String(senha), provider.passwordHash);
  if (!passwordMatches) {
    return NextResponse.json({ error: "Palavra-passe incorreta." }, { status: 401 });
  }

  const token = await generateToken(provider.id, provider.name);

  return NextResponse.json({
    token,
    provider: { id: provider.id, name: provider.name, email: provider.email },
  });
}
