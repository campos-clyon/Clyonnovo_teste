import { NextRequest, NextResponse } from "next/server";
import { CABECALHO_DO_TOKEN_DO_PAGAMENTO } from "@/lib/cabecalho-do-pagamento";
import { sessaoDoCliente } from "@/lib/cliente-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { trabalhoQueSePodePagar } from "@/lib/acesso-ao-pagamento";
import { perfilDoProfissional, registarSemFalhar } from "@/lib/db";
import { dadosParaPagarAoParceiro } from "@/lib/dados-para-receber";
import { perfilFiscalDoParceiro } from "@/lib/perfil-fiscal";
import { contaDoValorAcordado } from "@/lib/pagamento-directo";
import {
  AS_DUAS_FATURAS,
  COMO_PAGAR_EM_PALAVRAS,
  PAGA_DIRETAMENTE_AO_PARCEIRO,
  comoPagarDisponiveis,
  lerComoPagar,
} from "@/lib/pagar-ao-parceiro";
import { congelarRegimeDoProfissional, gravarComoPagarAoParceiro, oQueONovoModeloGravou } from "@/lib/pagar-ao-parceiro-na-base";
import { faturasDaNegociacao } from "@/lib/faturas-do-trabalho-na-base";
import { asDuasFaturas } from "@/lib/faturas-do-trabalho";

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

async function oQueOClienteVe(
  t: Extract<Awaited<ReturnType<typeof trabalhoQueSePodePagar>>, { ok: true }>["trabalho"],
) {
  const perfil = await perfilDoProfissional(t.providerId);
  const fiscal = perfilFiscalDoParceiro(perfil ?? {});
  const regime = await congelarRegimeDoProfissional(t.negociacaoId, fiscal.regimeParaAConta);
  const gravado = await oQueONovoModeloGravou(t.negociacaoId);
  const c = contaDoValorAcordado(t.acordado, t.taxas, regime);
  const faturas = asDuasFaturas(await faturasDaNegociacao(t.negociacaoId));
  const total = c ? c.totalAoClienteCent / 100 : null;
  return {
    pagaAoParceiro: true,
    frase: PAGA_DIRETAMENTE_AO_PARCEIRO,
    parceiro: t.profissionalNome,
    paraPagar: dadosParaPagarAoParceiro(perfil ?? {}, { contratado: true, doNovoModelo: true }),
    perfilFiscal: { ...fiscal, regimeParaAConta: regime },
    conta: c
      ? {
          semIva: c.servicoCent / 100,
          faturaDoParceiro: c.faturaDoProfissionalCent / 100,
          ivaDoParceiro: c.ivaDoProfissionalCent / 100,
          faturaDaTaxa: c.faturaDaClyonCent / 100,
          ivaDaTaxa: c.ivaDaTaxaCent / 100,
          total,
        }
      : null,
    comoPagar: lerComoPagar(gravado.pagarAoParceiroPor),
    opcoes: comoPagarDisponiveis(total).map((id) => ({ id, ...COMO_PAGAR_EM_PALAVRAS[id] })),
    faturas: {
      frase: AS_DUAS_FATURAS,
      daTaxa: faturas.clyon ? { url: faturas.clyon.url, nome: faturas.clyon.nome, em: faturas.clyon.carregadaEm } : null,
      doTrabalho: faturas.parceiro ? { url: faturas.parceiro.url, nome: faturas.parceiro.nome, em: faturas.parceiro.carregadaEm } : null,
    },
  };
}

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
      return NextResponse.json({ ok: false, error: "Neste valor não é possível pagar em dinheiro (Lei n.º 92/2017)." }, { status: 409 });
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
