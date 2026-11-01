import { NextRequest, NextResponse } from "next/server";
import { emailDoCliente } from "@/lib/cliente-auth";
import { hashDaPalavraPasse, palavraPasseConfere, validarPalavraPasse } from "@/lib/profissional-auth";
import { limitarPorConta, limitarRotaPublica } from "@/lib/limite-rota-publica";
import { contaDoClientePorEmail, gravarPalavraPasseDoCliente } from "@/lib/conta-com-palavra-passe";

export const runtime = "nodejs";

/**
 * DEFINIR OU ALTERAR A PALAVRA-PASSE, COM SESSÃO DE CLIENTE — 01-11-2026.
 * Na «Segurança» da conta do site; a app pode usar a mesma rota com o Bearer.
 *
 *   · GET → `{ temPalavraPasse }`;
 *   · POST `{ nova, actual? }` → com palavra-passe já definida, a actual é
 *     obrigatória e tem de conferir (uma sessão esquecida aberta num
 *     computador não chega para trocar a chave da conta). Sem ela — quem entra
 *     com o Google ou com o link —, a sessão chega: o email já está provado.
 */
export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "conta-palavra-passe", 60, 300);
  if (limite.erro) return limite.erro;
  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  try {
    const conta = await contaDoClientePorEmail(email);
    if (!conta) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    return NextResponse.json(
      { ok: true, temPalavraPasse: !!conta.passwordHash },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[conta/palavra-passe] GET:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível ler agora." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "conta-palavra-passe", 60, 300);
  if (limite.erro) return limite.erro;
  const email = await emailDoCliente(req);
  if (!email) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  const porConta = await limitarPorConta("conta-palavra-passe-gravar", email, 5, 900);
  if (porConta.erro) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas seguidas. Espere alguns minutos e tente outra vez." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let corpo: { nova?: unknown; actual?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  const erro = validarPalavraPasse(corpo?.nova);
  if (erro) return NextResponse.json({ ok: false, campo: "nova", error: erro.mensagem }, { status: 400 });

  try {
    const conta = await contaDoClientePorEmail(email);
    if (!conta) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    if (conta.passwordHash) {
      const actual = typeof corpo.actual === "string" ? corpo.actual : "";
      if (!actual || !(await palavraPasseConfere(actual, conta.passwordHash))) {
        return NextResponse.json(
          { ok: false, campo: "actual", error: "A palavra-passe actual não está certa." },
          { status: 403 },
        );
      }
    }
    await gravarPalavraPasseDoCliente(conta.id, await hashDaPalavraPasse(corpo.nova as string));
    return NextResponse.json({ ok: true, temPalavraPasse: true });
  } catch (err) {
    console.error("[conta/palavra-passe] POST:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível gravar agora. Tente outra vez." }, { status: 500 });
  }
}
