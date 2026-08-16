import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  createSimulatorOrder,
  getSimulatorOrderById,
  appendOrderHistory,
  calculateOrderPriority,
} from "@/lib/db";
import type { InsertSimulatorOrder } from "../../../../../drizzle/schema";
import { notifyNewOrder } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/seo-data";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { calculateFastEstimate } from "@/lib/pricing-helper";
import { kmParaOrcamento } from "@/lib/distancia-estimada";
import { validarValoresDoCliente } from "@/lib/pedido-valores";
import { gerarTokenDeAcesso, linkDoPedido } from "@/lib/pedido-acesso";
import { enviarLinkDoPedido } from "@/lib/email-pedido";
import { distribuirPedido } from "@/lib/distribuir-pedido";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Rota aberta por necessidade — quem preenche o simulador ainda não tem
  // conta. Mas cada chamada grava uma linha completa na base e dispara email
  // e WhatsApp para a equipa: sem travão, qualquer pessoa enche o backoffice
  // de pedidos falsos e gasta a quota de notificações. Dez por IP a cada
  // cinco minutos é muito mais do que alguém precisa para pedir orçamento.
  const limite = await limitarRotaPublica(req, "simulador-pedido", 10, 300);
  if (limite.erro) return limite.erro;

  try {
    const { order, estimate, chatHistory } = await req.json();
    if (!order) {
      return NextResponse.json({ error: "order required" }, { status: 400 });
    }

    // ── Ligação à conta do cliente ────────────────────────────────────────────
    // Se existir uma sessão de cliente autenticada, o pedido fica SEMPRE ligado
    // ao email dessa conta (normalizado), garantindo que aparece em "Os meus
    // pedidos". Caso contrário, usamos o email indicado no formulário.
    // O email do formulário fica sempre preservado dentro de rawOrderJson.
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null;
    const formEmail = order.receiver?.email?.trim().toLowerCase() ?? null;
    const contactEmail = sessionEmail ?? formEmail;

    // ── O motor de preços, para TODOS os pedidos ──────────────────────────────
    //
    // Esta rota é a porta comum: o simulador entra por aqui, e também o
    // formulário de contactos e o "quero contratar". Só que o simulador
    // calcula a estimativa no browser ANTES de gravar e manda-a no corpo; os
    // formulários não mandam nada.
    //
    // Resultado: um pedido de contactos chegava ao painel com preço zero,
    // sem análise e com o botão de recalcular sem nada para recalcular — e
    // alguém tinha de o orçamentar de cabeça. Foi o que aconteceu ao #188.
    //
    // Agora, se não vier estimativa, calcula-se aqui. Nunca por cima da que
    // vem do simulador: essa passou pelas fotos e pela distância medida, e é
    // melhor do que qualquer coisa que se faça a partir de texto.
    //
    // A origem do pedido não é tocada — continua a ser gravada tal como veio,
    // e é o que distingue "Contactos" de "Simulador" no painel.
    let estimativa = estimate ?? null;
    let estimativaDoServidor = false;
    if (!estimativa) {
      try {
        const morada =
          order.address?.formattedAddress ??
          (typeof order.address === "string" ? order.address : null);
        const { km, origem: origemKm } = kmParaOrcamento({
          distanciaMedidaKm: order.distanceFromBase?.distanceKm ?? null,
          codigoPostal: order.address?.postalCode ?? order.postalCode ?? null,
          morada,
        });

        const calculada = await calculateFastEstimate({
          serviceType: order.serviceType ?? "outro",
          description: order.description ?? "",
          floor: order.floor || undefined,
          hasElevator: order.hasElevator,
          parkingDistance: order.parkingDistance,
          urgency: order.urgency,
          distanceFromBase: { distanceKm: km },
        } as Parameters<typeof calculateFastEstimate>[0]);

        estimativa = {
          ...calculada,
          internalNotes: [
            ...(calculada.internalNotes ?? []),
            // Quem abrir isto tem de saber com o que está a lidar: um número
            // tirado de texto não vale o mesmo que um tirado de fotos.
            `Estimativa calculada no servidor a partir dos dados do formulário (origem: ${order.origemPedido ?? order._source ?? "desconhecida"}).`,
            origemKm === "medida"
              ? `Distância medida: ${km} km.`
              : origemKm === "codigo_postal"
                ? `Distância estimada pelo código postal: ${km} km — confirmar com a morada exacta.`
                : `Sem morada utilizável: assumidos ${km} km. Confirmar antes de fechar o preço.`,
          ],
        };
        estimativaDoServidor = true;
      } catch (e) {
        // Um pedido sem estimativa é mau; um pedido perdido é pior.
        console.error("[simulador/pedido] motor de preços falhou:", e);
      }
    }

    const priority = calculateOrderPriority({
      urgency: order.urgency,
      description: order.description,
      estimateTotal: estimativa?.estimatedPriceWithVat?.toString() ?? null,
    });

    // ── Marcação recorrente: aplica desconto à estimativa guardada ────────────
    // Semanal = 15%, quinzenal = 10%. O assistente vê o valor já com desconto
    // e as notas internas explicam a razão, antes de definir o precoFinal.
    const recurrenceFrequency: "semanal" | "quinzenal" | null =
      order.recurrenceFrequency === "semanal" || order.recurrenceFrequency === "quinzenal"
        ? order.recurrenceFrequency
        : null;
    const recurringDiscountPercent = recurrenceFrequency === "semanal" ? 15 : recurrenceFrequency === "quinzenal" ? 10 : null;
    const applyDiscount = (value: number | null | undefined) =>
      value != null && recurringDiscountPercent != null
        ? Math.round(value * (1 - recurringDiscountPercent / 100) * 100) / 100
        : (value ?? null);

    // ── Sem atribuição automática ─────────────────────────────────────────────
    // Pedidos entram sempre na fila geral. Uma assistente deve aceitar
    // manualmente via POST /api/admin/pedidos/[id]/accept.

    // ── Quanto o cliente quer pagar ───────────────────────────────────────────
    //
    // Validado outra vez aqui, e não só no formulário. O ecrã impede a pessoa
    // distraída; não impede quem chame a rota directamente, e esta é pública
    // por necessidade. Um pedido gravado com o máximo abaixo do mínimo, ou com
    // um valor absurdo vindo de um campo de texto, é lixo que alguém teria de
    // limpar à mão mais tarde.
    //
    // Pedidos que não vêm do formulário novo (a página de contactos, por
    // exemplo) continuam a entrar sem valores — daí o `null` em vez de erro
    // quando os dois campos vêm vazios.
    let valoresParaGravar: {
      valorMinimoCliente?: string | null;
      valorMaximoCliente?: string | null;
    } = {};
    const clienteIndicouValores =
      order.valorMinimoCliente != null || order.valorMaximoCliente != null;
    if (clienteIndicouValores) {
      const validacao = validarValoresDoCliente(
        order.valorMinimoCliente,
        order.valorMaximoCliente,
      );
      if (!validacao.ok) {
        return NextResponse.json(
          { ok: false, error: validacao.erros[0].mensagem, erros: validacao.erros },
          { status: 400 },
        );
      }
      valoresParaGravar = {
        valorMinimoCliente: String(validacao.valores.valorMinimoCliente),
        valorMaximoCliente: String(validacao.valores.valorMaximoCliente),
      };
    }

    // O token que vai no link. Aqui fica só o hash — ver pedido-acesso.ts.
    const acesso = gerarTokenDeAcesso();

    const row: InsertSimulatorOrder = {
      serviceType: order.serviceType || null,
      description: order.description || null,
      filesJson: order.files?.length
        ? JSON.stringify(
            order.files.map((f: unknown) => {
              if (typeof f === "string") return { url: f };
              const rec = f as Record<string, unknown>;
              return {
                id: rec.id,
                name: rec.name,
                size: rec.size,
                type: rec.type,
                mimeType: rec.mimeType,
                url: rec.url ?? rec.path ?? null,
              };
            })
          )
        : null,
      // Morada principal: para mudança guardamos a origem; para outros o endereço único
      address:
        order.serviceType === "mudanca"
          ? (order.originAddress?.formattedAddress ?? order.address?.formattedAddress ?? null)
          : (order.address?.formattedAddress ?? null),
      city: order.city || order.address?.city || order.originAddress?.city || null,
      // postalCode: não existe como coluna separada na DB — guardado em rawOrderJson
      floor: (() => {
        const v = order.serviceType === "mudanca"
          ? (order.originAccess?.floor ?? order.floor)
          : order.floor;
        return v || null;
      })(),
      // Converter "" para null — alguns clientes submetem string vazia quando não preenchido
      hasElevator: (() => {
        const v = order.serviceType === "mudanca"
          ? (order.originAccess?.hasElevator ?? order.hasElevator)
          : order.hasElevator;
        return v || null;
      })(),
      parkingDistance: (() => {
        const v = order.serviceType === "mudanca"
          ? (order.originAccess?.parkingDistance ?? order.parkingDistance)
          : order.parkingDistance;
        return v || null;
      })(),
      contactName: order.receiver?.name ?? session?.user?.name ?? null,
      contactPhone: order.receiver?.phone ?? null,
      // Prioridade: email da conta autenticada → email do formulário
      contactEmail,
      urgency: order.urgency || null,
      estimateMin: applyDiscount(estimativa?.estimatedPriceWithoutVat)?.toString() ?? null,
      estimateMax: applyDiscount(estimativa?.estimatedPriceWithVat)?.toString() ?? null,
      estimateTotal: applyDiscount(estimativa?.estimatedPriceWithVat)?.toString() ?? null,
      estimateJson: estimativa ? JSON.stringify(estimativa) : null,
      recurrenceFrequency,
      recurringDiscountPercent: recurringDiscountPercent != null ? recurringDiscountPercent.toFixed(2) : null,
      // Guardar análise completa incluindo externalMarketEstimate, analysisSource e confidence
      // Este campo é APENAS para uso interno no backoffice — nunca exposto ao cliente
      analysisJsonExtended: estimativa
        ? JSON.stringify({
            analysisSource: estimativa.analysisSource ?? null,
            confidence: estimativa.confidence ?? null,
            clyonEstimate: {
              status: estimativa.status,
              estimatedPriceWithoutVat: estimativa.estimatedPriceWithoutVat,
              vatAmount: estimativa.vatAmount,
              estimatedPriceWithVat: estimativa.estimatedPriceWithVat,
              difficultyLevel: estimativa.difficultyLevel,
              summary: estimativa.summary,
              assumptions: estimativa.assumptions,
              missingFields: estimativa.missingFields,
              internalNotes: estimativa.internalNotes,
              labor: estimativa.labor ?? null,
            },
            externalMarketEstimate: estimativa.externalMarketEstimate ?? null,
            savedAt: new Date().toISOString(),
          })
        : null,
      // Distância guardada (km): mudança usa origem→destino; restantes usam base→morada.
      distanceKm: (order.movingDistance?.distanceKm ?? order.distanceFromBase?.distanceKm)?.toString() ?? null,
      // distanceText passa a guardar um resumo legível "X km · Y min" (antes só o tempo).
      distanceText: (() => {
        const src = order.movingDistance?.distanceKm ? order.movingDistance : order.distanceFromBase;
        const km = src?.distanceKm;
        if (!km) return null;
        const kmStr = `${String(km).replace(".", ",")} km`;
        return src?.durationText ? `${kmStr} · ${src.durationText}` : kmStr;
      })(),
      chatJson: chatHistory ? JSON.stringify(chatHistory) : null,
      priority,
      // Sempre sem assistente — fluxo de aceitação manual obrigatório
      status: "sem_assistente",
      assignedToId: null,
      assignedToName: null,
      assignedAt: null,
      // Guardar todo o JSON do formulário para preservar dados de mudança
      // (originAddress, destinationAddress, originAccess, destinationAccess, movingDistance, heavyItems, etc.)
      rawOrderJson: JSON.stringify(order),

      // ── Plataforma ──────────────────────────────────────────────────────
      ...valoresParaGravar,
      precisaFatura: order.precisaFatura === true ? 1 : 0,
      precisaGuiaTransporte: order.precisaGuiaTransporte === true ? 1 : 0,
      acessoTokenHash: acesso.hash,
      acessoTokenExpiraEm: acesso.expiraEm,
    };

    const id = await createSimulatorOrder(row);

    // Confirmação de escrita
    const created = await getSimulatorOrderById(id);
    if (!created) {
      console.error("[v0] POST /api/simulador/pedido: pedido #", id, " não encontrado após INSERT");
      return NextResponse.json(
        { ok: false, error: `Pedido #${id} não encontrado após criação.` },
        { status: 500 }
      );
    }

    // Histórico
    await appendOrderHistory(id, {
      type: "created",
      by: null,
      // A origem é a que veio no pedido. Dizer "via simulador" a um contacto
      // da página de contactos era escrever no histórico uma coisa que não
      // aconteceu — e o histórico é onde se vai procurar quando algo não bate
      // certo.
      message:
        `Pedido criado (${order.origemPedido ?? order._source ?? "simulador"}). ` +
        `Por atribuir. Serviço: ${order.serviceType ?? "—"}. Prioridade: ${priority}.` +
        (estimativaDoServidor
          ? " Estimativa calculada pelo motor a partir dos dados do formulário — confirmar a morada antes de fechar o preço."
          : "")
        + (recurrenceFrequency ? ` Marcação recorrente (${recurrenceFrequency}, desconto de ${recurringDiscountPercent}% já aplicado à estimativa).` : ""),
    });

    // Notificação WhatsApp — assíncrona, não bloqueia a resposta ao cliente.
    // Se falhar, o pedido já está guardado e o erro apenas fica no log.
    notifyNewOrder({
      id,
      contactName:     row.contactName ?? null,
      serviceType:     row.serviceType ?? null,
      city:            row.city ?? null,
      address:         row.address ?? null,
      estimateWithVat: row.estimateMax ?? row.estimateTotal ?? null,
      backofficeUrl:   `${SITE_URL}/admin/pedidos/${id}`,
    });

    // ── O link de acesso ──────────────────────────────────────────────────────
    //
    // Só para pedidos que trazem valores, ou seja, os que vêm do formulário
    // novo. Um contacto da página de contactos não tem negociação a que voltar,
    // e mandar-lhe um link para um pedido sem propostas era prometer um ecrã
    // que não lhe diz nada.
    //
    // Não bloqueia a resposta: o pedido está gravado, e um email que falhe não
    // pode transformar-se num erro de criação aos olhos do cliente.
    let linkEnviado = false;
    if (clienteIndicouValores && contactEmail) {
      linkEnviado = await enviarLinkDoPedido({
        para: contactEmail,
        nomeDoCliente: row.contactName ?? null,
        pedidoId: id,
        serviceType: row.serviceType ?? null,
        token: acesso.token,
        valorMinimoCliente: valoresParaGravar.valorMinimoCliente
          ? Number(valoresParaGravar.valorMinimoCliente)
          : null,
      });
      if (!linkEnviado) {
        // Fica no histórico porque é recuperável à mão: o pedido existe, o
        // token existe, e alguém pode reenviar. Sem este registo, o cliente
        // desaparecia sem ninguém perceber que nunca chegou a receber nada.
        await appendOrderHistory(id, {
          type: "created",
          by: null,
          message: "O email com o link de acesso NÃO foi enviado. Reenviar ao cliente.",
        });
      }
    }

    // ── Levar o pedido a quem o pode fazer ────────────────────────────────────
    //
    // Só para pedidos do formulário novo: os outros não têm valor pedido nem
    // negociação, e um profissional que recebesse um deles abria um ecrã que
    // não lhe dizia nada.
    //
    // Corre depois da resposta estar praticamente montada e nunca a bloqueia
    // com um erro: se a distribuição falhar, o pedido existe e reenvia-se. O
    // contrário — o cliente ver um erro porque um email não saiu — seria pior.
    if (clienteIndicouValores) {
      try {
        const distribuicao = await distribuirPedido({
          id,
          serviceType: row.serviceType ?? null,
          description: row.description ?? null,
          city: row.city ?? null,
          urgency: row.urgency ?? null,
          quantidadeDeFotos: order.files?.length ?? 0,
          valorMinimoCliente: valoresParaGravar.valorMinimoCliente
            ? Number(valoresParaGravar.valorMinimoCliente)
            : null,
          precisaFatura: order.precisaFatura === true,
          precisaGuiaTransporte: order.precisaGuiaTransporte === true,
          lat: order.address?.lat ?? null,
          lng: order.address?.lng ?? null,
        });

        // Um pedido que não chega a ninguém fica publicado e sem propostas,
        // igualzinho a um que ninguém quis. Isto deixa escrito qual dos dois é.
        await appendOrderHistory(id, {
          type: "created",
          by: null,
          message:
            distribuicao.avisados > 0
              ? `Enviado a ${distribuicao.avisados} profissional(is) de ${distribuicao.candidatos} activos.` +
                (distribuicao.falhados > 0 ? ` ${distribuicao.falhados} email(s) falharam.` : "")
              : `NÃO chegou a nenhum profissional (${distribuicao.candidatos} activos). ` +
                `Motivos: ${JSON.stringify(distribuicao.motivos)}`,
        });
      } catch (err) {
        console.error("[simulador/pedido] distribuição falhou:", err);
        await appendOrderHistory(id, {
          type: "created",
          by: null,
          message: "A distribuição aos profissionais falhou. Reenviar.",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      id: created.id,
      status: created.status,
      priority: created.priority,
      assignedToId: null,
      assignedToName: null,
      createdAt: created.createdAt,
      queue: "general",
      linkEnviado,
      // O token vai na resposta para o formulário poder levar o cliente ao
      // pedido sem esperar pelo email. Vai só aqui, ao próprio, no momento em
      // que o criou — nunca numa listagem nem numa leitura posterior.
      acessoToken: clienteIndicouValores ? acesso.token : undefined,
      message: linkEnviado
        ? "Pedido criado. Enviámos o link de acesso para o seu email."
        : "Pedido criado com sucesso.",
    });
  } catch (err: any) {
    // A mensagem crua do MySQL ia para o browser numa rota pública: dizia o
    // nome da tabela, os nomes e os limites das colunas — e, se a ligação
    // falhasse, o host e o utilizador da base de dados. Quem quisesse mapear
    // o esquema só tinha de enviar valores inválidos e ler a resposta.
    // O detalhe fica no log; ao cliente vai uma frase que ele possa usar.
    console.error("[simulador/pedido] erro ao gravar:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível registar o pedido. Tente novamente ou fale connosco." },
      { status: 500 },
    );
  }
}
