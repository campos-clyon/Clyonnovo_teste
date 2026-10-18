import { NextRequest, NextResponse, after } from "next/server";
import { tokenDoProfissional } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import {
  appendOrderHistory,
  gravarAjustes,
  negociacaoNoTerreno,
  registarSemFalhar,
} from "@/lib/db";
import { ajustesDe, cancelarAjuste, pedirAjuste, vistaDoAjuste } from "@/lib/ajuste-no-local";
import { faseDoTrabalho } from "@/lib/trabalho";
import { urlDeAnexoPermitido } from "@/lib/url-externo-seguro";
import { lerForma, excedeONumerario, MAXIMO_EM_NUMERARIO } from "@/lib/forma-de-pagamento";
import { valorEmNumerario } from "@/lib/divida-do-profissional";
import { modeloDaNegociacao } from "@/lib/iva-incluido";
import { taxasDaNegociacao } from "@/lib/taxas-plataforma";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import { avisarClienteDoAjuste } from "@/lib/avisos-do-terreno";

export const runtime = "nodejs";

/**
 * O AJUSTE NO LOCAL, PEDIDO PELO PROFISSIONAL — 18-10-2026.
 * As regras estão em `ajuste-no-local.ts`; o plano em `docs/plano-ajuste-no-local.md`.
 *
 * POST pede: subir fica à espera do «sim» do cliente (que recebe um WhatsApp
 * com o link), baixar aplica-se logo e o cliente é avisado. DELETE retira um
 * pedido que ainda está à espera.
 *
 * Num trabalho CLYON de valor fixo o cliente não é a contraparte: o pedido
 * fica à espera da CLYON, que responde no backoffice.
 */

const eur = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

async function lerCorpo(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function oTrabalhoDele(negociacaoId: number, providerId: number) {
  const n = await negociacaoNoTerreno(negociacaoId);
  return n && Number(n.providerId) === providerId ? n : null;
}

export async function POST(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const corpo = await lerCorpo(req);
  if (!corpo) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  const negociacaoId = Number(corpo.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }
  const valorNovo = typeof corpo.valorNovo === "string" ? Number(corpo.valorNovo.replace(",", ".")) : Number(corpo.valorNovo);
  const motivo = typeof corpo.motivo === "string" ? corpo.motivo : "";
  const fotos = Array.isArray(corpo.fotos)
    ? corpo.fotos.map((u) => urlDeAnexoPermitido(u)).filter((u): u is string => !!u)
    : [];

  try {
    const n = await oTrabalhoDele(negociacaoId, sessao.providerId);
    if (!n) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });

    const agora = new Date();
    const antes = n.ajustesJson ?? null;
    const valorAcordado = n.valorAcordado != null ? Number(n.valorAcordado) : null;
    const r = pedirAjuste(
      { estado: n.estado, fase: faseDoTrabalho(n as never), valorAcordado, ajustes: ajustesDe(antes) },
      { valorNovo, motivo, fotos },
      agora,
    );
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 409 });

    // Em dinheiro, a lei não deixa passar do tecto do numerário — a mesma
    // regra da correcção de valor no backoffice.
    if (
      lerForma(n.formaDePagamento) === "dinheiro" &&
      excedeONumerario(valorEmNumerario(r.ajuste.valorNovo, taxasDaNegociacao(n), modeloDaNegociacao(n.createdAt)))
    ) {
      return NextResponse.json(
        {
          error:
            `Este trabalho é pago em dinheiro e a lei não permite numerário a partir de ${MAXIMO_EM_NUMERARIO} €. ` +
            "Fale com a CLYON para mudar a forma de pagamento.",
        },
        { status: 409 },
      );
    }

    const gravou = await gravarAjustes(negociacaoId, {
      antes,
      depois: JSON.stringify(r.ajustes),
      valorAcordado: r.valorAcordadoNovo,
      providerId: sessao.providerId,
    });
    if (!gravou) {
      return NextResponse.json(
        { error: "O trabalho mudou entretanto. Volte a abri-lo e tente outra vez." },
        { status: 409 },
      );
    }

    const a = r.ajuste;
    const resumo =
      a.estado === "descida"
        ? `${sessao.nome} baixou o valor de ${eur(a.valorAntigo)} para ${eur(a.valorNovo)} no local: «${a.motivo}».`
        : `${sessao.nome} pediu para ajustar o valor de ${eur(a.valorAntigo)} para ${eur(a.valorNovo)}: «${a.motivo}» (${a.fotos.length} fotografia(s)). À espera do cliente.`;

    // O aviso tem de chegar em minutos — mas sai depois da resposta, para o
    // botão não ficar preso à espera do WhatsApp. O link vai na resposta
    // seguinte que a app pedir (não precisa dele para continuar).
    const baseUrl = urlDeAccaoDoPedido(req.headers);
    after(async () => {
      await appendOrderHistory(n.pedidoId, { type: "created", message: resumo }).catch(() => {});
      await registarSemFalhar({
        acontecimento: "ajuste_pedido",
        pedidoId: n.pedidoId,
        negociacaoId,
        providerId: sessao.providerId,
        providerNome: sessao.nome,
        autorTipo: "profissional",
        autorNome: sessao.nome,
        resumo,
        detalhe: a,
      });
      await avisarClienteDoAjuste(n, a, baseUrl, agora);
    });

    return NextResponse.json({
      ok: true,
      efeito: r.efeito,
      valorAcordado: r.valorAcordadoNovo ?? valorAcordado,
      ajuste: vistaDoAjuste(
        { estado: n.estado, fase: faseDoTrabalho(n as never), valorAcordado: r.valorAcordadoNovo ?? valorAcordado, ajustes: r.ajustes },
        agora,
      ),
    });
  } catch (error) {
    console.error("[profissionais/trabalho/ajuste POST]", error);
    return NextResponse.json({ error: "Não foi possível pedir o ajuste." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const corpo = await lerCorpo(req);
  const negociacaoId = Number(corpo?.negociacaoId);
  if (!Number.isInteger(negociacaoId) || negociacaoId <= 0) {
    return NextResponse.json({ error: "Trabalho não indicado." }, { status: 400 });
  }

  try {
    const n = await oTrabalhoDele(negociacaoId, sessao.providerId);
    if (!n) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
    const agora = new Date();
    const antes = n.ajustesJson ?? null;
    const r = cancelarAjuste(ajustesDe(antes), agora);
    if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 409 });
    const gravou = await gravarAjustes(negociacaoId, {
      antes,
      depois: JSON.stringify(r.ajustes),
      valorAcordado: null,
      providerId: sessao.providerId,
    });
    if (!gravou) {
      return NextResponse.json({ error: "O cliente respondeu entretanto. Volte a abrir o trabalho." }, { status: 409 });
    }
    after(async () => {
      await registarSemFalhar({
        acontecimento: "ajuste_cancelado",
        pedidoId: n.pedidoId,
        negociacaoId,
        providerId: sessao.providerId,
        providerNome: sessao.nome,
        autorTipo: "profissional",
        autorNome: sessao.nome,
        resumo: `${sessao.nome} retirou o pedido de ajuste do valor.`,
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[profissionais/trabalho/ajuste DELETE]", error);
    return NextResponse.json({ error: "Não foi possível retirar o pedido." }, { status: 500 });
  }
}
