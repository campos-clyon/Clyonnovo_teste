import { NextRequest, NextResponse } from "next/server";
import { lerBase } from "@/lib/base-do-preco";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  getSimulatorOrderById,
  updateSimulatorOrder,
  appendOrderHistory,
} from "@/lib/db";
import { geocodificarMoradaDetalhado, geocodificarLocalidade } from "@/lib/geocodificar";
import { camposDoServico } from "@/lib/campos-do-servico";
import { avaliarAlcance } from "@/lib/distribuir-pedido";
import { urlDeAccaoDoPedido } from "@/lib/url-do-site";
import {
  retratoDoPedido,
  oQueMudou,
  mudancasPorExtenso,
  recomecarDoZero,
} from "@/lib/recomecar-do-zero";

export const runtime = "nodejs";

/**
 * Editar um pedido com os campos DA PLATAFORMA — e só esses.
 *
 * PORQUE NÃO CHEGAVA O PATCH GENÉRICO
 *
 * O PATCH de /api/admin/pedidos/[id] grava colunas às cegas: não geocodifica
 * a morada nova, não limpa o ", Portugal" da localidade, não deriva a
 * urgência da data, e não deixa nada no histórico. Editar a morada por lá
 * deixava as coordenadas ANTIGAS no rawOrderJson — o pedido mudava de rua no
 * ecrã e continuava no sítio velho para a regra do raio.
 *
 * E PORQUE NÃO SE EDITA NO PAINEL ANTIGO
 *
 * O modal dos Pedidos é o painel do modelo executante — "Aceitar pedido",
 * "Aprovar orçamento", preço final com IVA. Nada disso existe na plataforma.
 * A edição da plataforma acontece na plataforma, com os campos que os
 * profissionais vão ler.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  const { id } = await params;
  const pedidoId = Number(id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const texto = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim().slice(0, max);
    return t.length > 0 ? t : null;
  };

  try {
    const address = texto(corpo.address, 300);
    const postalCode = texto(corpo.postalCode, 20);
    // O ", Portugal" cai — a elegibilidade compara zonas por igualdade.
    const city = texto(corpo.city, 120)?.replace(/\s*,?\s*portugal\s*$/i, "").trim() || null;

    if (!address) {
      return NextResponse.json({ error: "A morada é obrigatória." }, { status: 400 });
    }

    // A mesma localização da criação: Google primeiro, freguesia como rede.
    const geo = await geocodificarMoradaDetalhado(address, postalCode, city);
    let coords = geo.coords;
    let coordsAproximadas = false;
    if (!coords && (postalCode || city)) {
      const aprox = await geocodificarLocalidade([postalCode, city].filter(Boolean).join(" "));
      if (aprox) {
        coords = { ...aprox, moradaNormalizada: null };
        coordsAproximadas = true;
      }
    }
    const chaveRecusada =
      geo.estado === "REQUEST_DENIED" ||
      geo.estado === "OVER_DAILY_LIMIT" ||
      geo.estado === "OVER_QUERY_LIMIT";

    // A data desejada e a urgência derivada, como na criação.
    let dataAgendada: Date | null = null;
    const dataCrua = texto(corpo.dataDesejada, 30);
    if (dataCrua) {
      const d = new Date(dataCrua);
      if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now() - 3600_000) dataAgendada = d;
    }
    let urgency = texto(corpo.urgency, 40);
    if ((!urgency || urgency === "flexivel") && dataAgendada) {
      const dias = (dataAgendada.getTime() - Date.now()) / 86_400_000;
      urgency = dias < 1 ? "today" : dias < 2 ? "tomorrow" : dias < 7 ? "this_week" : "flexible";
    }

    // As fotografias, com a mesma forma do simulador.
    //
    // NÃO ENVIAR e ENVIAR VAZIO são coisas diferentes, e agora que a coluna
    // grava mesmo a diferença custa caro: sem elas o profissional propõe às
    // cegas. Quem não mandar o campo está a dizer "não mexi nas fotografias";
    // só quem mandar uma lista vazia está a dizer "tirei-as todas".
    const enviouFotografias = Array.isArray(corpo.files);
    const fotosCruas = enviouFotografias
      ? (corpo.files as Array<Record<string, unknown>>)
      : [];
    const fotos = fotosCruas
      .filter((ft) => ft && typeof ft.url === "string" && (ft.url as string).length > 0)
      .slice(0, 12)
      .map((ft, i) => ({
        id: String(i),
        url: ft.url as string,
        name: typeof ft.name === "string" ? ft.name : `foto-${i + 1}`,
        size: typeof ft.size === "number" ? ft.size : 0,
        type: typeof ft.type === "string" ? ft.type : undefined,
        mimeType: typeof ft.type === "string" ? ft.type : undefined,
      }));

    const valorCru =
      typeof corpo.valor === "string" ? Number(corpo.valor.replace(",", ".")) : Number(corpo.valor);
    const valorDesejado = Number.isFinite(valorCru) && valorCru > 0 ? valorCru : null;

    // O rawOrderJson guarda as coordenadas e o retrato do pedido — funde-se,
    // não se substitui: o que lá está (origem, histórico de coordenadas,
    // fotosNaoEnviadas) não pode desaparecer por causa de uma edição.
    let raw: Record<string, unknown> = {};
    try {
      raw = pedido.rawOrderJson ? JSON.parse(pedido.rawOrderJson) : {};
    } catch {
      raw = {};
    }
    const moradaAntiga = (raw.address ?? {}) as Record<string, unknown>;
    raw.address = {
      ...moradaAntiga,
      formattedAddress: coords?.moradaNormalizada ?? address,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      coordenadasAproximadas: coordsAproximadas || undefined,
      city,
      postalCode,
    };
    // Os campos próprios do serviço, recalculados: se ele mudou a morada de
    // destino, o percurso muda, e com ele as horas e o preço.
    const proprios = await camposDoServico(
      corpo as Parameters<typeof camposDoServico>[0],
      coords ? { lat: coords.lat, lng: coords.lng } : null,
    );
    Object.assign(raw, proprios.paraOJson);

    raw.editadoPelaClyonEm = new Date().toISOString();

    // Como o pedido estava ANTES — para saber, depois de gravar, se mudou
    // alguma coisa que os profissionais leem.
    const antes = retratoDoPedido(pedido);

    await updateSimulatorOrder(pedidoId, {
      serviceType: texto(corpo.serviceType, 80) ?? pedido.serviceType,
      description: texto(corpo.description, 4000),
      contactName: texto(corpo.contactName, 120),
      contactPhone: texto(corpo.contactPhone, 30),
      contactEmail: texto(corpo.contactEmail, 200),
      address,
      city,
      postalCode,
      floor: texto(corpo.floor, 40),
      hasElevator: texto(corpo.hasElevator, 40),
      parkingDistance: texto(corpo.parkingDistance, 40),
      urgency,
      dataAgendada,
      valorDesejadoCliente: valorDesejado != null ? String(valorDesejado) : null,
      // O que o numero MEDE: o trabalho todo, ou cada carga. Anda agarrado ao
      // valor ate ao ecra do profissional e ao do cliente -- ver
      // `base-do-preco.ts`. O que nao for uma das duas palavras vira 'total'.
      baseDoPreco: lerBase(corpo.baseDoPreco),
      precisaFatura: corpo.precisaFatura === true ? 1 : 0,
      filesJson: enviouFotografias ? (fotos.length > 0 ? JSON.stringify(fotos) : null) : undefined,
      rawOrderJson: JSON.stringify(raw),
      // Sem molde forcado: se um destes campos sair do tipo de
      // `updateSimulatorOrder`, isto tem de partir na compilacao em vez de
      // gravar metade do formulario e dizer que gravou tudo.
    });

    // Fica escrito QUEM editou. Os profissionais leem o pedido da base a cada
    // abertura — uma edição muda o que eles veem, e isso não pode ser anónimo.
    const depoisDeGravar = await getSimulatorOrderById(pedidoId);
    const mudou = depoisDeGravar ? oQueMudou(antes, retratoDoPedido(depoisDeGravar)) : [];

    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message:
        `Pedido editado pela CLYON (${colab?.nome ?? "equipa"}) no ecrã da plataforma` +
        (mudou.length > 0 ? ` — mudou ${mudancasPorExtenso(mudou)}.` : "."),
    });

    /*
     * GRAVAR É RECOMEÇAR.
     *
     * "Essa função eu queria no código do pedido: quando ele fosse editado —
     * por ex. o valor, fotos ou infos dele — quando houvesse isso, ele fosse
     * salvo, passasse pelo processo de recomeçar do zero e fosse reenviado a
     * todos como novo pedido."
     *
     * Um pedido editado já não é o pedido que os profissionais viram. Eles
     * propuseram 121 € sobre uma cómoda e agora diz 30 €; propuseram sem
     * fotografias e agora há três; propuseram para um rés-do-chão e agora é um
     * oitavo andar sem elevador. As propostas antigas são respostas a uma
     * pergunta que já ninguém fez.
     *
     * Só quando muda alguma coisa que ELES leem. Corrigir um "Fatima" para
     * "Fátima" não pode matar cinco propostas a sério — o nome, o telefone e o
     * email são do cliente, e nenhum profissional os vê antes de ser
     * contratado.
     */
    let recomeco: Awaited<ReturnType<typeof recomecarDoZero>> | null = null;
    if (mudou.length > 0 && depoisDeGravar) {
      try {
        recomeco = await recomecarDoZero(depoisDeGravar, urlDeAccaoDoPedido(req.headers));
      } catch (e) {
        // A edição já está gravada e isso não se desfaz por causa disto. O
        // ecrã fica sem a linha do recomeço, que é melhor do que dizer que
        // gravou e não ter gravado.
        console.error("[admin/pedidos/editar] recomeço falhou:", e);
      }
    }

    // O alcance com a informação NOVA — é a pergunta que se segue a qualquer
    // edição de morada: "e agora, chega a quem?"
    let alcance: Awaited<ReturnType<typeof avaliarAlcance>> | null = null;
    try {
      alcance = await avaliarAlcance({
        serviceType: texto(corpo.serviceType, 80) ?? pedido.serviceType ?? null,
        precisaFatura: corpo.precisaFatura === true,
        precisaGuiaTransporte: Number(pedido.precisaGuiaTransporte) === 1,
        city,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
    } catch (e) {
      console.error("[admin/pedidos/editar] alcance falhou:", e);
    }

    return NextResponse.json({
      ok: true,
      id: pedidoId,
      // O enviar do editor usa-o como valor de partida; sem ele a promoção
      // caia na estimativa mesmo quando o cliente disse quanto queria pagar.
      valorDePartida: valorDesejado,
      geocodificado: coords != null,
      geocodificadoAproximado: coordsAproximadas,
      chaveRecusada,
      motivoSemCoordenadas: coords
        ? null
        : geo.estado === "SEM_CHAVE"
          ? "sem_chave"
          : chaveRecusada
            ? "chave_recusada"
            : "nao_encontrada",
      moradaNormalizada: coords?.moradaNormalizada ?? null,
      alcance,
      percursoKm: proprios.percursoKm,
      faltaParaOPreco: proprios.emFalta,
      mudou,
      mudancas: mudancasPorExtenso(mudou),
      recomeco,
    });
  } catch (error) {
    console.error("[admin/pedidos/editar]", error);
    return NextResponse.json({ error: "Erro ao editar o pedido" }, { status: 500 });
  }
}
