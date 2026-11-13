import { NextRequest, NextResponse } from "next/server";
import { CABECALHO_DO_TOKEN_DO_PAGAMENTO } from "@/lib/cabecalho-do-pagamento";
import { sessaoDoCliente } from "@/lib/cliente-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { trabalhoQueSePodePagar } from "@/lib/acesso-ao-pagamento";
import { registarSemFalhar } from "@/lib/db";
import { COMO_PAGAR_EM_PALAVRAS, lerComoPagar } from "@/lib/pagar-ao-parceiro";
import { gravarComoPagarAoParceiro } from "@/lib/pagar-ao-parceiro-na-base";
import { oQueOClienteVeDoParceiro } from "@/lib/pagar-ao-parceiro-para-o-cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PAGAR AO PARCEIRO — d10, o modelo de 15-11-2026 (`novo-modelo.ts`).
 *
 * GET: ao cliente que contratou (o link do pedido, a conta ou a app — as mesmas
 * credenciais de `/api/pagamentos`), num trabalho do modelo novo: o IBAN, o
 * titular e o MB WAY do parceiro, a forma que escolheu, a conta (as duas faturas e
 * o total) e as faturas já juntas. Fora do modelo novo, `{ pagaAoParceiro: false }`.
 *
 * POST `{ pedidoId, negociacaoId, token?, comoPagar }`: grava como vai pagar
 * (transferência, MB WAY ou dinheiro — sem dinheiro a partir do tecto legal).
 *
 * O IBAN e o MB WAY só saem daqui: nunca na lista, no perfil público, nem antes
 * de contratar (`trabalhoQueSePodePagar` recusa um trabalho por fechar).
 */

function tokenDoPedido(req: NextRequest, corpo?: { token?: unknown }): string | undefined {
  const doCabecalho = req.headers.get(CABECALHO_DO_TOKEN_DO_PAGAMENTO)?.trim();
  if (doCabecalho) return doCabecalho;
  if (typeof corpo?.token === "string" && corpo.token) return corpo.token;
  return req.nextUrl.searchParams.get("token") ?? undefined;
}

async function emailDaSessao(req: NextRequest): Promise<string | null> {
  const sessao = await sessaoDoCliente(req);
  return sessao?.user?.email ?? null;
}

/** O mesmo bloco da app de cliente (R5): uma função só (d17). */
const oQueOClienteVe = oQueOClienteVeDoParceiro;

export async function GET(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "pagar-ao-parceiro-ver", 60, 300);
  if (limite.erro) return limite.erro;
  const p = req.nextUrl.searchParams;
  const acesso = await trabalhoQueSePodePagar(Number(p.get("pedidoId")), Number(p.get("negociacaoId")), {
    token: tokenDoPedido(req),
    email: await emailDaSessao(req),
  });
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });
  if (!acesso.trabalho.novoModelo) return NextResponse.json({ pagaAoParceiro: false });
  try {
    return NextResponse.json(await oQueOClienteVe(acesso.trabalho));
  } catch (e) {
    console.error("[pagamentos/ao-parceiro GET]", e);
    return NextResponse.json({ error: "Não foi possível ler os dados do pagamento." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "pagar-ao-parceiro-escolher", 20, 300);
  if (limite.erro) return limite.erro;
  let corpo: { pedidoId?: unknown; negociacaoId?: unknown; token?: unknown; comoPagar?: unknown };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const acesso = await trabalhoQueSePodePagar(Number(corpo.pedidoId), Number(corpo.negociacaoId), {
    token: tokenDoPedido(req, corpo),
    email: await emailDaSessao(req),
  });
  if (!acesso.ok) return NextResponse.json({ ok: false, error: acesso.erro }, { status: acesso.estado });
  const t = acesso.trabalho;
  if (!t.novoModelo) return NextResponse.json({ ok: false, error: "Este trabalho paga-se como foi combinado.", pagaAoParceiro: false }, { status: 409 });

  const como = lerComoPagar(corpo.comoPagar);
  if (!como) return NextResponse.json({ ok: false, error: "Escolha transferência, MB WAY ou dinheiro." }, { status: 400 });
  try {
    const visto = await oQueOClienteVe(t);
    if (!visto.opcoes.some((o) => o.id === como)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            como === "dinheiro"
              ? "Neste valor não é possível pagar em dinheiro (Lei n.º 92/2017)."
              : "O parceiro ainda não tem os dados para esta forma de pagamento. Escolha outra.",
        },
        { status: 409 },
      );
    }
    await gravarComoPagarAoParceiro(t.negociacaoId, como);
    await registarSemFalhar({
      acontecimento: "forma_de_pagar_ao_parceiro",
      pedidoId: t.pedidoId,
      negociacaoId: t.negociacaoId,
      providerId: t.providerId,
      autorTipo: "cliente",
      autorNome: t.nomeDoCliente ?? "o cliente",
      resumo: `O cliente vai pagar ao parceiro: ${COMO_PAGAR_EM_PALAVRAS[como].curta}.`,
      detalhe: { comoPagar: como },
    });
    return NextResponse.json({ ok: true, ...visto, comoPagar: como });
  } catch (e) {
    console.error("[pagamentos/ao-parceiro POST]", e);
    return NextResponse.json({ ok: false, error: "Não foi possível guardar. Tente novamente." }, { status: 500 });
  }
}
