import { NextRequest, NextResponse } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { trabalhoVistoPeloBackoffice } from "@/lib/acesso-ao-pagamento";
import { receberFaturaDoTrabalho } from "@/lib/faturas-do-trabalho-no-servidor";
import { faturasDaNegociacao } from "@/lib/faturas-do-trabalho-na-base";
import { MENSAGENS_DA_FATURA, asDuasFaturas } from "@/lib/faturas-do-trabalho";

export const runtime = "nodejs";

/**
 * A FATURA DO TRABALHO, PELO PARCEIRO — d10, o modelo de 15-11-2026.
 *
 * POST (multipart: `file`, `negociacaoId`): o parceiro junta ao pedido a fatura
 * que emitiu ao cliente. Só num trabalho dele, contratado e do modelo novo.
 * GET `?negociacaoId=`: as duas faturas desse trabalho (a dele e a da taxa).
 *
 * O id nunca é a autorização: o trabalho tem de ser da sessão.
 */
async function trabalhoDele(req: NextRequest, negociacaoId: number) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return { erro: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) } as const;
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return { erro: NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 }) } as const;
  }
  const acesso = await trabalhoVistoPeloBackoffice(negociacaoId);
  // «Não existe» e «não é seu» respondem igual.
  if (!acesso.ok || acesso.trabalho.providerId !== sessao.providerId) {
    return { erro: NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 }) } as const;
  }
  return { sessao, t: acesso.trabalho } as const;
}

export async function GET(req: NextRequest) {
  const r = await trabalhoDele(req, Number(req.nextUrl.searchParams.get("negociacaoId")));
  if ("erro" in r) return r.erro;
  const f = asDuasFaturas(await faturasDaNegociacao(r.t.negociacaoId));
  return NextResponse.json({
    novoModelo: r.t.novoModelo,
    daTaxa: f.clyon ? { url: f.clyon.url, nome: f.clyon.nome, em: f.clyon.carregadaEm } : null,
    doTrabalho: f.parceiro ? { url: f.parceiro.url, nome: f.parceiro.nome, em: f.parceiro.carregadaEm } : null,
  });
}

export async function POST(req: NextRequest) {
  const limite = await limitarRotaPublica(req, "profissional-fatura", 10, 600);
  if (limite.erro) return limite.erro;
  const negociacaoId = Number(req.nextUrl.searchParams.get("negociacaoId"));
  const r = await trabalhoDele(req, negociacaoId);
  if ("erro" in r) return r.erro;
  if (!r.t.novoModelo) return NextResponse.json({ error: MENSAGENS_DA_FATURA.naoE }, { status: 409 });
  return receberFaturaDoTrabalho(req, {
    negociacaoId: r.t.negociacaoId,
    pedidoId: r.t.pedidoId,
    deQuem: "parceiro",
    quem: r.sessao.nome ?? `profissional #${r.sessao.providerId}`,
    autorTipo: "profissional",
  });
}
