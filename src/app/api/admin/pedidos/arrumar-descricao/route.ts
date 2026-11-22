import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { instanteEmLisboa } from "@/lib/hora-de-lisboa";
import { descricaoPelasRegras, textoNormal } from "@/lib/fontes-da-descricao";
import { camposQueOProfissionalVe, escreverADescricao, sugestoesDaDescricao } from "@/lib/descricao-pelo-modelo";
import {
  fontesDoPedido,
  pedidoParaADescricao,
  verAsFotografiasNovas,
  type PedidoComDescricao,
} from "@/lib/descricao-do-pedido-na-base";
import { descricaoEmPortugues } from "@/lib/descricao-em-portugues";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * «ARRUMAR A DESCRIÇÃO» — o botão do «Editar pedido». 29-10-2026 (ordem do
 * CEO, aprovada pelo dono: «automático + botão»).
 *
 * Corre o MESMO gerador da Vitória (`escreverADescricao`) sobre o que está no
 * formulário AGORA — o texto da equipa, os campos, as fotografias — e sobre o
 * que o cliente já disse no WhatsApp (as fontes guardadas no pedido).
 *
 * NÃO GRAVA NADA. Devolve o texto para o campo; a equipa lê-o e decide se
 * grava — e gravar recomeça o pedido e acaba com as propostas actuais, por
 * isso a decisão é dela. Se o modelo falhar, devolve a descrição das regras e
 * diz porquê.
 *
 * O QUE OS CAMPOS DIZEM NÃO VAI PARA O TEXTO (d84, 22-11-2026): o andar, o
 * elevador, o dia, o estacionamento, as fotografias. O que a conversa diz e o
 * campo não tem vem em `sugestoes` — o formulário mostra-as por baixo, com um
 * «Preencher» que só muda o campo (grava-se com o «Gravar» de sempre); o que
 * a conversa diz ao contrário do campo vem como aviso, sem mudar nada.
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const texto = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim().slice(0, max);
    return t || null;
  };

  const agora = new Date();
  const pedidoId = Number(corpo.pedidoId);
  let guardadas: string | null = null;
  if (Number.isInteger(pedidoId) && pedidoId > 0) {
    const { getSimulatorOrderById } = await import("@/lib/db");
    const doBanco = (await getSimulatorOrderById(pedidoId)) as unknown as PedidoComDescricao | undefined;
    if (!doBanco) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    guardadas = doBanco.fontesDaDescricao ?? null;
  }

  const ficheiros = Array.isArray(corpo.files) ? (corpo.files as Array<Record<string, unknown>>) : [];
  const dataCrua = texto(corpo.dataDesejada, 30);
  // O que está no formulário agora — não o que está na base.
  const doFormulario: PedidoComDescricao = {
    id: Number.isInteger(pedidoId) && pedidoId > 0 ? pedidoId : 0,
    description: texto(corpo.description, 4000) ?? "",
    fontesDaDescricao: guardadas,
    serviceType: texto(corpo.serviceType, 80),
    city: texto(corpo.city, 120),
    postalCode: texto(corpo.postalCode, 20),
    floor: texto(corpo.floor, 40),
    hasElevator: texto(corpo.hasElevator, 40),
    parkingDistance: texto(corpo.parkingDistance, 40),
    dataAgendada: dataCrua ? instanteEmLisboa(dataCrua) : null,
    filesJson: JSON.stringify(
      ficheiros
        .filter((f) => f && typeof f.url === "string")
        .slice(0, 12)
        .map((f) => ({ url: f.url, type: typeof f.type === "string" ? f.type : undefined })),
    ),
    rawOrderJson: JSON.stringify({
      destinationAddress: { city: texto(corpo.localidadeDestino, 120), postalCode: texto(corpo.codigoPostalDestino, 20) },
      destinationAccess: {
        floor: texto(corpo.andarDestino, 40),
        hasElevator: texto(corpo.elevadorDestino, 40),
        parkingDistance: texto(corpo.estacionamentoDestino, 40),
      },
    }),
    contactName: texto(corpo.contactName, 120),
    contactPhone: texto(corpo.contactPhone, 30),
    contactEmail: texto(corpo.contactEmail, 200),
    address: texto(corpo.address, 300),
  };
  if (doFormulario.serviceType !== "mudanca") doFormulario.rawOrderJson = null;

  try {
    let fontes = fontesDoPedido(doFormulario, agora);
    fontes = await verAsFotografiasNovas(fontes, doFormulario, agora);
    /*
     * SEMPRE EM PORTUGUÊS (d46): o que vier noutra língua traduz-se aqui também
     * — e diz-se, para quem lê antes de gravar. Se o tradutor falhar, fica o
     * texto como está e a nota diz que falta traduzir.
     */
    const pedido = pedidoParaADescricao(doFormulario);
    const r = await escreverADescricao(fontes, pedido, { modo: "sugestao", agora });
    if (r.ok) {
      const t = await descricaoEmPortugues(r.texto);
      return NextResponse.json({
        ok: true,
        texto: t.descricao,
        por: "modelo",
        sugestoes: r.sugestoes,
        traduzida: t.original != null && !t.porTraduzir,
        porTraduzir: t.porTraduzir,
      });
    }
    const t = await descricaoEmPortugues(
      descricaoPelasRegras(fontes, doFormulario.serviceType, camposQueOProfissionalVe(pedido), { modo: "sugestao", agora }),
    );
    const regras = t.descricao;
    return NextResponse.json({
      ok: true,
      texto: regras,
      por: "regras",
      igual: textoNormal(regras) === textoNormal(doFormulario.description),
      sugestoes: sugestoesDaDescricao(null, fontes, pedido, agora),
      motivo: r.motivo.slice(0, 200),
      traduzida: t.original != null && !t.porTraduzir,
      porTraduzir: t.porTraduzir,
    });
  } catch (e) {
    console.error("[admin/pedidos/arrumar-descricao]", e);
    return NextResponse.json({ error: "Não foi possível arrumar a descrição." }, { status: 500 });
  }
}
