import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import * as jose from "jose";
import { eq } from "drizzle-orm";

import { getDb, getSimulatorSettings, upsertSimulatorSetting, createColaborador, updateColaborador, deleteColaborador } from "@/lib/db";
import { defaultSimulatorSettings } from "@/lib/simulator-settings";
import { colaboradores } from "../../../../../drizzle/schema";

const JWT_SECRET = process.env.JWT_SECRET || "clyon-secret-2026";

type JwtPayload = { id: number; nome: string; isAdmin: number };
type RouteContext = { params: Promise<{ path: string[] }> };

async function verifyToken(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  try {
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

async function generateToken(payload: Record<string, unknown>) {
  const secretKey = new TextEncoder().encode(JWT_SECRET);
  return new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(secretKey);
}

async function handleRequest(req: NextRequest, path: string[]) {
  const route = path.join("/");
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ error: "Base de dados indisponivel." }, { status: 500 });
  }

  if (route === "login" && req.method === "POST") {
    const { nome, senha } = await req.json();
    if (!nome || !senha) {
      return NextResponse.json({ error: "Nome e palavra-passe sao obrigatorios." }, { status: 400 });
    }

    const [colaborador] = await db
      .select()
      .from(colaboradores)
      .where(eq(colaboradores.nome, String(nome).toUpperCase()));

    if (!colaborador) {
      return NextResponse.json({ error: "Colaborador nao encontrado." }, { status: 401 });
    }

    const passwordMatches = await bcrypt.compare(String(senha), colaborador.senha);
    if (!passwordMatches) {
      return NextResponse.json({ error: "Palavra-passe incorreta." }, { status: 401 });
    }

    const token = await generateToken({
      id: colaborador.id,
      nome: colaborador.nome,
      funcao: colaborador.funcao,
      isAdmin: colaborador.isAdmin,
    });

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
  }

  const auth = await verifyToken(req);
  if (!auth) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  if (route === "alterar-senha" && req.method === "POST") {
    const { senhaAtual, novaSenha } = await req.json();
    const [member] = await db.select().from(colaboradores).where(eq(colaboradores.id, auth.id));
    if (!member) {
      return NextResponse.json({ error: "Colaborador nao encontrado." }, { status: 404 });
    }

    const passwordMatches = await bcrypt.compare(String(senhaAtual), member.senha);
    if (!passwordMatches) {
      return NextResponse.json({ error: "Palavra-passe atual incorreta." }, { status: 400 });
    }

    const newPasswordHash = await bcrypt.hash(String(novaSenha), 10);
    await db.update(colaboradores).set({ senha: newPasswordHash }).where(eq(colaboradores.id, auth.id));
    return NextResponse.json({ success: true });
  }

  if (route === "admin/todos" && req.method === "GET") {
    if (!auth.isAdmin) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    try {
      const { ensureColaboradoresSchema } = await import("@/lib/db");
      await ensureColaboradoresSchema();

      const team = await db.select().from(colaboradores);
      return NextResponse.json({
        colaboradores: team.map((member) => ({
          id: member.id,
          nome: member.nome,
          funcao: member.funcao,
          valorHora: member.valorHora,
          isAdmin: member.isAdmin,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        })),
      });
    } catch (error) {
      console.error("[v0] GET admin/todos erro:", error instanceof Error ? error.message : String(error), error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erro ao carregar dados do painel", debug: String(error) },
        { status: 500 }
      );
    }
  }

  if (route === "admin/settings/simulador" && req.method === "GET") {
    if (!auth.isAdmin) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const settings = await getSimulatorSettings();
    return NextResponse.json({
      settings: settings.map((item) => ({
        key: item.key,
        label: item.label,
        category: item.category,
        unit: item.unit,
        value: item.value,
        description: item.description,
      })),
    });
  }

  if (route === "admin/settings/simulador" && req.method === "PUT") {
    if (!auth.isAdmin) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await req.json();
    const definition = defaultSimulatorSettings.find((item) => item.key === body.key);
    if (!definition) {
      return NextResponse.json({ error: "Configuracao invalida." }, { status: 400 });
    }

    const parsedValue = Number(body.value);
    if (!Number.isFinite(parsedValue)) {
      return NextResponse.json({ error: "Valor invalido." }, { status: 400 });
    }

    await upsertSimulatorSetting({
      key: definition.key,
      label: definition.label,
      category: definition.category,
      unit: definition.unit,
      value: parsedValue.toFixed(2),
      description: definition.description,
    });

    return NextResponse.json({ success: true });
  }

  if (route === "criar" && req.method === "POST") {
    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN", error: "Acesso negado." }, { status: 403 });
    }

    const body = await req.json();
    const { nome, senha, funcao, isAdmin: bodyIsAdmin,
      paymentModel, valorHora, valorDiaria,
      commissionType, commissionPercent, commissionFixedAmount, commissionNotes,
      canReceiveSimulatorRequests, participatesInTimeTracking,
    } = body;

    if (!nome || String(nome).trim() === "") {
      return NextResponse.json({ ok: false, code: "MISSING_NOME", error: "Preencha o nome do colaborador." }, { status: 400 });
    }
    if (!senha || String(senha).trim() === "") {
      return NextResponse.json({ ok: false, code: "MISSING_SENHA", error: "Preencha a palavra-passe inicial." }, { status: 400 });
    }
    const validFuncoes = ["motorista", "ajudante", "admin", "assistente"];
    if (!funcao || !validFuncoes.includes(funcao)) {
      return NextResponse.json({ ok: false, code: "INVALID_FUNCAO", error: "Função inválida. Use: motorista, ajudante, admin ou assistente." }, { status: 400 });
    }
    if (["motorista", "ajudante"].includes(funcao)) {
      const vh = parseFloat(String(valorHora ?? 0));
      const vd = parseFloat(String(valorDiaria ?? 0));
      if ((!valorHora && !valorDiaria) || (isNaN(vh) && isNaN(vd)) || (vh <= 0 && vd <= 0)) {
        return NextResponse.json({ ok: false, code: "MISSING_VALOR_HORA", error: "Preencha o valor por hora ou diária para motoristas e ajudantes." }, { status: 400 });
      }
    }

    const passwordHash = await bcrypt.hash(String(senha), 10);

    try {
      await createColaborador({
        nome: String(nome).toUpperCase().trim(),
        senha: passwordHash,
        funcao: funcao as "motorista" | "ajudante" | "admin" | "assistente",
        isAdmin: bodyIsAdmin ? 1 : 0,
        paymentModel: paymentModel ?? undefined,
        valorHora: valorHora ? String(parseFloat(String(valorHora))) : null,
        valorDiaria: valorDiaria ? String(parseFloat(String(valorDiaria))) : null,
        commissionType: commissionType ?? null,
        commissionPercent: commissionPercent != null ? String(parseFloat(String(commissionPercent))) : null,
        commissionFixedAmount: commissionFixedAmount != null ? String(parseFloat(String(commissionFixedAmount))) : null,
        commissionNotes: commissionNotes ?? null,
        canReceiveSimulatorRequests: canReceiveSimulatorRequests != null ? Number(canReceiveSimulatorRequests) : undefined,
        participatesInTimeTracking: participatesInTimeTracking != null ? Number(participatesInTimeTracking) : undefined,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[criar-colaborador] erro:", msg, err);
      if (msg.includes("Duplicate") || msg.includes("ER_DUP")) {
        return NextResponse.json({ ok: false, code: "DUPLICATE_NOME", error: "Já existe um colaborador com este nome." }, { status: 409 });
      }
      return NextResponse.json({ ok: false, code: "DB_ERROR", error: msg }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (route.match(/^\d+\/editar$/) && req.method === "PUT") {
    if (!auth.isAdmin) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN", error: "Acesso negado." }, { status: 403 });
    }

    const id = parseInt(route.split("/")[0], 10);
    const body = await req.json();

    const updateData: Parameters<typeof updateColaborador>[1] = {};

    if (body.nome) updateData.nome = String(body.nome).toUpperCase().trim();
    if (body.senha) updateData.senha = await bcrypt.hash(String(body.senha), 10);
    if (body.funcao) updateData.funcao = body.funcao;
    if (body.isAdmin !== undefined) updateData.isAdmin = body.isAdmin ? 1 : 0;
    if (body.paymentModel !== undefined) updateData.paymentModel = body.paymentModel;
    if (body.valorHora !== undefined) updateData.valorHora = body.valorHora ? String(parseFloat(String(body.valorHora))) : null;
    if (body.valorDiaria !== undefined) updateData.valorDiaria = body.valorDiaria ? String(parseFloat(String(body.valorDiaria))) : null;
    if (body.commissionType !== undefined) updateData.commissionType = body.commissionType;
    if (body.commissionPercent !== undefined) updateData.commissionPercent = body.commissionPercent != null ? String(parseFloat(String(body.commissionPercent))) : null;
    if (body.commissionFixedAmount !== undefined) updateData.commissionFixedAmount = body.commissionFixedAmount != null ? String(parseFloat(String(body.commissionFixedAmount))) : null;
    if (body.commissionNotes !== undefined) updateData.commissionNotes = body.commissionNotes;
    if (body.canReceiveSimulatorRequests !== undefined) updateData.canReceiveSimulatorRequests = Number(body.canReceiveSimulatorRequests);
    if (body.participatesInTimeTracking !== undefined) updateData.participatesInTimeTracking = Number(body.participatesInTimeTracking);
    if (body.active !== undefined) updateData.active = Number(body.active);

    try {
      await updateColaborador(id, updateData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ok: false, code: "DB_ERROR", error: `Erro ao actualizar colaborador: ${msg}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (route.match(/^\d+\/deletar$/) && req.method === "DELETE") {
    if (!auth.isAdmin) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const id = parseInt(route.split("/")[0], 10);
    await deleteColaborador(id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Rota nao encontrada." }, { status: 404 });
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleRequest(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleRequest(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleRequest(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleRequest(req, path);
}
