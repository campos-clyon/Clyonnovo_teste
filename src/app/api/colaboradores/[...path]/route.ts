import { NextRequest, NextResponse } from "next/server";

import { getSimulatorSettings, upsertSimulatorSetting } from "@/lib/db";
import { defaultSimulatorSettings } from "@/lib/simulator-settings";
import { requireAdminGeral } from "@/lib/admin-auth-helper";

/**
 * O que resta deste catch-all: os valores do simulador.
 *
 * Já teve muito mais — login, alterar palavra-passe, listar a equipa, criar,
 * editar e apagar colaboradores. Tudo isso servia o portal do colaborador e a
 * secção Equipa, que desapareceram com as funções de assistente, motorista e
 * ajudante. Manter endpoints de escrita sem nada que os chame é guardar porta
 * aberta para uma casa vazia.
 *
 * O `login` que aqui vivia era a segunda porta para a mesma conta e nunca
 * chegou a receber a verificação de administrador que /api/colaboradores/login
 * passou a fazer. Estava inalcançável — a rota específica ganha à genérica —
 * mas bastava alguém apagar a outra para ficar a valer. Fora.
 *
 * O caminho mantém-se em /api/colaboradores/admin/settings/simulador porque é
 * o que o painel chama.
 */

type RouteContext = { params: Promise<{ path: string[] }> };

async function handleRequest(req: NextRequest, path: string[]) {
  const route = path.join("/");

  /*
   * Pelo `requireAdminGeral`, e não por um `jwtVerify` escrito aqui.
   *
   * O de cá só conferia a assinatura e o `isAdmin` do payload: não recusava
   * tokens de outros domínios assinados com a mesma chave (a verificação do
   * `type` vive em `verifyColaboradorToken`) nem perguntava à base se a conta
   * ainda existia, estava activa, ou tinha mudado de palavra-passe.
   */
  const { err } = await requireAdminGeral(req);
  if (err) return err;

  if (route === "admin/settings/simulador" && req.method === "GET") {
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
    const body = await req.json();
    const definition = defaultSimulatorSettings.find((item) => item.key === body.key);
    if (!definition) {
      return NextResponse.json({ error: "Configuração inválida." }, { status: 400 });
    }

    const parsedValue = Number(body.value);
    if (!Number.isFinite(parsedValue)) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
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

  return NextResponse.json({ error: "Rota não encontrada." }, { status: 404 });
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleRequest(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return handleRequest(req, path);
}
