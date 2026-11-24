import { NextRequest, NextResponse } from "next/server";
import { requireAdminGeral } from "@/lib/admin-auth-helper";
import { eAppDoTeste, emailsDaListaColada, montarQuadro } from "@/lib/quem-conta-para-os-12";
import {
  guardarListaDaPlay,
  listaDaPlayGuardada,
  pessoasDaAppDeCliente,
  pessoasDaAppPro,
} from "@/lib/quem-conta-para-os-12-na-base";
import { avisarClientesQueEntraramNaListaDaPlay, avisarQuemEntrouNaListaDaPlay } from "@/lib/lista-da-play-avisos-na-base";
import { percursosDosConvites } from "@/lib/percurso-da-app-cliente-na-base";
import { resumoDosPercursos, type Percurso } from "@/lib/percurso-da-app-cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * «QUEM CONTA PARA OS 12» — 17-11-2026 (d60). Só o administrador
 * (`requireAdminGeral`): nomes, emails e telefones de quem está no teste.
 *
 * GET  ?app=pro|cliente            → o quadro (cada pessoa e o estado) e a última lista colada
 * POST { app, lista }              → guarda a lista da Play colada (vazia = apaga) e devolve o quadro
 *
 * Na CLYON Pro, ao guardar uma lista, quem passou a estar nela (pelo Gmail do
 * teste ou pelo da conta) e ainda não abriu a app recebe UM aviso «Já pode
 * entrar no teste» (18-11-2026, d6) — ver lista-da-play-avisos-na-base.ts.
 * Só aqui, ao colar: nunca num deploy.
 *
 * d106 (24-11-2026): na app de cliente, também — o mesmo aviso, com o link
 * NOSSO de cada pessoa (`avisarClientesQueEntraramNaListaDaPlay`), desligado
 * enquanto o texto não estiver aprovado. E o quadro da app de cliente traz o
 * percurso de cada pessoa no link do convite (clique, aparelho, passo, «Não
 * consegui») e o resumo de todos.
 */

const MAXIMO_DO_TEXTO = 200_000;

async function percursos(app: "pro" | "cliente"): Promise<Percurso[] | null> {
  if (app !== "cliente") return null;
  try {
    return await percursosDosConvites();
  } catch (e) {
    // O percurso é um extra: sem ele, o quadro sai na mesma.
    console.error("[admin/quem-conta-para-os-12] percurso:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function quadro(app: "pro" | "cliente") {
  const [pessoas, lista, todos] = await Promise.all([
    app === "pro" ? pessoasDaAppPro() : pessoasDaAppDeCliente(),
    listaDaPlayGuardada(app),
    percursos(app),
  ]);
  const montado = montarQuadro(pessoas, lista.emails.length ? lista.emails : null, new Date());
  const porEmail = new Map((todos ?? []).map((p) => [p.email, p]));
  return {
    ok: true,
    app,
    ...montado,
    linhas: montado.linhas.map((l) => ({
      ...l,
      percurso: todos ? (l.emails.map((e) => porEmail.get(e)).find(Boolean) ?? null) : null,
    })),
    percursos: todos ? resumoDosPercursos(todos) : null,
    lista: { emails: lista.emails, coladaEm: lista.coladaEm, porQuem: lista.porQuem },
  };
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdminGeral(req);
  if (err) return err;
  const app = req.nextUrl.searchParams.get("app");
  if (!eAppDoTeste(app)) return NextResponse.json({ error: "App inválida." }, { status: 400 });
  try {
    return NextResponse.json(await quadro(app), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/quem-conta-para-os-12 GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui ler o quadro." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: { app?: unknown; lista?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!eAppDoTeste(corpo?.app)) return NextResponse.json({ error: "App inválida." }, { status: 400 });
  const lista = typeof corpo.lista === "string" ? corpo.lista : "";
  if (lista.length > MAXIMO_DO_TEXTO) {
    return NextResponse.json({ error: "A lista é demasiado grande." }, { status: 400 });
  }
  try {
    await guardarListaDaPlay(corpo.app, lista, String(colab?.nome ?? "admin"));
    const avisos =
      corpo.app === "pro"
        ? await avisarQuemEntrouNaListaDaPlay(emailsDaListaColada(lista))
        : await avisarClientesQueEntraramNaListaDaPlay(emailsDaListaColada(lista));
    return NextResponse.json({ ...(await quadro(corpo.app)), avisos });
  } catch (e) {
    console.error("[admin/quem-conta-para-os-12 POST]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não consegui guardar a lista." }, { status: 500 });
  }
}
