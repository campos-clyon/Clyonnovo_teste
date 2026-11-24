import { NextRequest, NextResponse } from "next/server";
import { sessaoActivaDoCliente, tokenDoClienteNoCabecalho } from "@/lib/cliente-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { lerProblema, MAXIMO_DO_PROBLEMA } from "@/lib/sinais-da-app-de-cliente";
import { registarProblema } from "@/lib/sinais-da-app-de-cliente-na-base";

export const runtime = "nodejs";

const MAXIMO_DO_CORPO = MAXIMO_DO_PROBLEMA * 4 + 1024;

/**
 * «ALGO NÃO FUNCIONA?» NA APP DE CLIENTE — 24-11-2026 (d108).
 *
 * Corpo: `{ "texto": "…", "onde": "pedir", "versao": "0.1.0 (…)", "modelo":
 * "Pixel 7", "sistema": "Android 15" }` → `{ ok: true }`.
 *
 * É a pessoa que o escreve e envia: guarda-se o texto, onde aconteceu (uma
 * escolha fechada), a versão, o modelo e o sistema. Com uma sessão de cliente
 * válida no cabeçalho, junta-se o email da conta, para a equipa responder; um
 * token inválido NÃO dá 401 (a app não sai da conta por isto) — vai só sem
 * email. Não se guarda o endereço de onde veio. Travão por endereço contra
 * abusos (6 por hora). Aparece no backoffice em Contas › Programa da app.
 */
export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "app-cliente-algo-nao-funciona", 6, 3600);
  if (limite.erro) return limite.erro;

  let texto = "";
  try {
    texto = await req.text();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (texto.length > MAXIMO_DO_CORPO) return NextResponse.json({ error: "O texto é demasiado comprido." }, { status: 413 });
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const lido = lerProblema(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });

  let email: string | null = null;
  try {
    const token = tokenDoClienteNoCabecalho(req);
    if (token) email = (await sessaoActivaDoCliente(token))?.email ?? null;
  } catch {
    email = null;
  }

  try {
    await registarProblema(lido.problema, email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cliente/algo-nao-funciona]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível enviar. Tente outra vez daqui a pouco." }, { status: 500 });
  }
}
