import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { trabalhoVistoPeloBackoffice } from "@/lib/acesso-ao-pagamento";
import { receberFaturaDoTrabalho } from "@/lib/faturas-do-trabalho-no-servidor";
import { faturasDaNegociacao } from "@/lib/faturas-do-trabalho-na-base";
import { MENSAGENS_DA_FATURA, asDuasFaturas, deQuemValido } from "@/lib/faturas-do-trabalho";
import { linhasDasFaturas } from "@/lib/faturas-do-trabalho-no-ecra";
import { contaDoNovoModelo, contaDoRegistoNoNovoModelo } from "@/lib/conta-do-pagamento";
import { METODO_PAGO_AO_PROFISSIONAL, dividaDoRegistoEmMao, pagoAoProfissionalRegistado } from "@/lib/pago-em-mao";
import { regimesDasNegociacoes } from "@/lib/novo-modelo-no-servidor";
import { pagamentosDaNegociacao } from "@/lib/pagamentos-na-base";

export const runtime = "nodejs";

/**
 * AS FATURAS DO TRABALHO, PELA EQUIPA — d10, o modelo de 15-11-2026.
 *
 * POST (multipart: `file`; `?negociacaoId=&deQuem=clyon|parceiro`): a equipa
 * junta a fatura da taxa da plataforma, feita à mão pela empresa parceira — ou,
 * a pedido, a do parceiro. Só num trabalho contratado do modelo novo.
 * GET `?negociacaoId=`: as duas.
 */
export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const negociacaoId = Number(req.nextUrl.searchParams.get("negociacaoId"));
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  const acesso = await trabalhoVistoPeloBackoffice(negociacaoId);
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });
  const f = asDuasFaturas(await faturasDaNegociacao(negociacaoId));
  const t = acesso.trabalho;
  if (!t.novoModelo) return NextResponse.json({ novoModelo: false, daTaxa: f.clyon, doTrabalho: f.parceiro });
  /*
   * d49: no modelo de 15-11 a «Conta do pagamento» do cartão e o valor de cada
   * fatura saem daqui, da mesma resposta que diz o modelo — o cartão nunca
   * mistura a conta antiga com as faturas do novo (o #618).
   */
  const regime = (await regimesDasNegociacoes([negociacaoId])).get(negociacaoId) ?? "normal";
  const pagamentos = await pagamentosDaNegociacao(negociacaoId).catch(() => []);
  const taxaPaga = pagamentos.some((p) => p.estado === "pago" && p.parte === "divida");
  // Registado «pago ao profissional» (o #588): a conta da regra do pago em mão, a mesma dos Pagamentos e das Carteiras.
  const registo = pagamentos.find((p) => p.estado === "pago" && String(p.metodo) === METODO_PAGO_AO_PROFISSIONAL);
  const conta =
    registo && pagoAoProfissionalRegistado(t.formaDePagamento, registo.metodo)
      ? contaDoRegistoNoNovoModelo(
          dividaDoRegistoEmMao(t.acordado, t.taxas, registo.valorPago),
          t.taxas.cliente + t.taxas.profissional,
          taxaPaga,
        )
      : contaDoNovoModelo(t.acordado, t.taxas, regime, taxaPaga, t.reservaCent ?? 0);
  return NextResponse.json({
    novoModelo: true,
    daTaxa: f.clyon,
    doTrabalho: f.parceiro,
    conta,
    linhas: linhasDasFaturas(t.acordado, t.taxas, regime, t.reservaCent ?? 0),
  });
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;
  const p = req.nextUrl.searchParams;
  const negociacaoId = Number(p.get("negociacaoId"));
  const deQuem = p.get("deQuem") ?? "clyon";
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  if (!deQuemValido(deQuem)) return NextResponse.json({ error: "Indique de quem é a fatura." }, { status: 400 });
  const acesso = await trabalhoVistoPeloBackoffice(negociacaoId);
  if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.estado });
  if (!acesso.trabalho.novoModelo) return NextResponse.json({ error: MENSAGENS_DA_FATURA.naoE }, { status: 409 });
  const quem = (colab as { nome?: string; email?: string } | null | undefined)?.nome ?? "a equipa";
  return receberFaturaDoTrabalho(req, {
    negociacaoId,
    pedidoId: acesso.trabalho.pedidoId,
    deQuem,
    quem: String(quem),
    autorTipo: "clyon",
  });
}
