import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { validarConteudo, type Canal } from "@/lib/aviso-aos-profissionais";
import {
  AvisoRecusado,
  comecarOEnvio,
  conteudoEmVigor,
  enviarTeste,
  estadoDoAviso,
  guardarVersao,
  mudarInterruptorDoAviso,
  pararOEnvio,
  passagemDoAviso,
  versoesDoAviso,
} from "@/lib/aviso-aos-profissionais-na-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * O AVISO A TODOS OS PROFISSIONAIS — d11 (15-11-2026). Só o administrador.
 *
 * GET: os destinatários (só contagens e ids), as versões do texto, o envio e
 * os contadores. POST com `accao`:
 *   guardar     — grava uma versão nova do texto;
 *   comecar     — começa o envio (escreve-se ENVIAR); idempotente por canal;
 *   parar       — pára o envio a correr;
 *   avancar     — uma passagem do motor (a página chama-a enquanto está aberta);
 *   teste       — envia o texto do editor só para o email/telemóvel escrito;
 *   interruptor — «Mostrar o aviso do novo modelo» (para ligar, LIGAR).
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  try {
    const [estado, versoes, emVigor] = await Promise.all([estadoDoAviso(), versoesDoAviso(10), conteudoEmVigor()]);
    return NextResponse.json({ ...estado, versoes, emVigor });
  } catch (e) {
    console.error("[admin/aviso-aos-profissionais] GET", e);
    return NextResponse.json({ error: "Não foi possível ler o aviso." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  const quem = colab?.nome?.trim() || "administrador";
  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  try {
    switch (corpo.accao) {
      case "guardar": {
        const c = validarConteudo(corpo as never);
        if (typeof c === "string") return NextResponse.json({ error: c }, { status: 400 });
        return NextResponse.json({ versao: await guardarVersao(c, quem) });
      }
      case "comecar": {
        if (String(corpo.confirmacao ?? "").trim().toUpperCase() !== "ENVIAR") {
          return NextResponse.json({ error: "Para enviar, escreva ENVIAR." }, { status: 400 });
        }
        const canais = (Array.isArray(corpo.canais) ? corpo.canais : []).filter(
          (c): c is Canal => c === "email" || c === "whatsapp",
        );
        const versaoId = Number(corpo.versaoId);
        if (!Number.isInteger(versaoId) || versaoId <= 0) {
          return NextResponse.json({ error: "Guarde o texto antes de enviar." }, { status: 400 });
        }
        return NextResponse.json(await comecarOEnvio(versaoId, canais, quem));
      }
      case "parar":
        return NextResponse.json({ parado: await pararOEnvio(quem) });
      case "avancar":
        return NextResponse.json({ passagem: await passagemDoAviso("backoffice", 8) });
      case "teste": {
        const c = validarConteudo(corpo as never);
        if (typeof c === "string") return NextResponse.json({ error: c }, { status: 400 });
        const r = await enviarTeste(
          c,
          {
            email: typeof corpo.email === "string" && corpo.email.trim() ? corpo.email : null,
            telefone: typeof corpo.telefone === "string" && corpo.telefone.trim() ? corpo.telefone : null,
          },
          quem,
        );
        return NextResponse.json(r);
      }
      case "interruptor": {
        if (typeof corpo.ligar !== "boolean") {
          return NextResponse.json({ error: "Falta dizer se é para ligar ou desligar." }, { status: 400 });
        }
        if (corpo.ligar && String(corpo.confirmacao ?? "").trim().toUpperCase() !== "LIGAR") {
          return NextResponse.json({ error: "Para ligar, escreva LIGAR." }, { status: 400 });
        }
        return NextResponse.json(await mudarInterruptorDoAviso(corpo.ligar, quem));
      }
      default:
        return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof AvisoRecusado) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[admin/aviso-aos-profissionais] POST", e);
    return NextResponse.json({ error: "Não foi possível fazer isto." }, { status: 500 });
  }
}
