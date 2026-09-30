import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSimulatorOrder, createLead, createLeadEvent, appendOrderHistory, calculateOrderPriority } from "@/lib/db";
import { calculateFastEstimate } from "@/lib/pricing-helper";
import { kmParaOrcamento } from "@/lib/distancia-estimada";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyNewOrder } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/seo-data";
import { problemaDoTelefone, juntarIndicativo, MENSAGENS_DO_TELEFONE } from "@/lib/telefone-do-cliente";

export const runtime = "nodejs";

/** O que o cliente lê quando nada chegou a ficar gravado. */
const NADA_GRAVADO =
  "Não foi possível registar o pedido. Tente novamente ou fale connosco por WhatsApp.";

const SERVICE_LABELS: Record<string, string> = {
  recolha_moveis:           "Recolha de móveis",
  recolha_monos:            "Recolha de monos",
  recolha_entulho:          "Recolha de entulho",
  esvaziamento_casa:        "Esvaziamento de casa",
  esvaziamento_apartamento: "Esvaziamento de apartamento",
  mudanca:                  "Mudança",
  outro:                    "Outro",
};

/*
 * As mensagens em português, campo a campo.
 *
 * O formulário mostra `details` por baixo de cada campo. Sem elas, o que lá
 * aparecia era o texto por omissão do zod — em inglês — ou, como até aqui,
 * só "Dados inválidos." no fundo do cartão, sem dizer qual.
 */
const HeroQuoteSchema = z.object({
  primeiroNome:    z.string().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  ultimoNome:      z.string().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  indicativo:      z.string().min(1, "Obrigatório").max(6, "Máximo 6 caracteres"),   // ex: "+351"
  // O resto da regra do telefone está em telefone-do-cliente.ts, mais abaixo.
  telefone:        z.string().min(1, MENSAGENS_DO_TELEFONE.falta).max(20, "Máximo 20 caracteres"),
  rua:             z.string().min(2, "Mínimo 2 caracteres").max(200, "Máximo 200 caracteres"),
  codigoPostal:    z.string().min(4, "Código postal inválido").max(12, "Código postal inválido"),
  numeroPosta:     z.string().max(20, "Máximo 20 caracteres"),
  // Obrigatórios: o andar e o elevador mudam o preço mais do que quase tudo
  // o resto, e uma validação que vive só no browser não é validação.
  andar:           z.string().min(1, "Indique o andar").max(20, "Máximo 20 caracteres"),
  elevador:        z.enum(["yes", "small", "no", "unknown"], "Indique se há elevador"),
  tipoServico:     z.string().min(2, "Escolha um serviço").max(80, "Escolha um serviço"),
  descricao:       z.string().max(300, "Máximo 300 caracteres").optional(),
  // UTM / rastreio opcional
  pagePath:        z.string().max(255).optional(),
  utmSource:       z.string().max(120).optional(),
  utmMedium:       z.string().max(120).optional(),
  utmCampaign:     z.string().max(120).optional(),
  /*
   * As fotos, que até aqui eram deitadas fora.
   *
   * O formulário recolhia-as, contava-as no ecrã ("2 imagens selecionadas") e
   * o pedido saía sem elas — o `images` do componente nunca chegava ao corpo
   * do POST. O cliente via a confirmação de que tinham sido anexadas e o
   * orçamento era feito às cegas.
   *
   * Vêm como URLs e não como ficheiros: o cliente envia-as primeiro pelo
   * mesmo caminho do simulador (enviarFicheiro → Blob), que comprime e
   * contorna o limite de 4,5 MB do corpo de um pedido serverless.
   */
  fotos: z
    .array(
      z.object({
        url: z.string().url().max(600),
        name: z.string().max(200).optional(),
        size: z.number().optional(),
        type: z.string().max(80).optional(),
      }),
    )
    .max(8)
    .optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`hero-quote:${ip}`, 5, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde um momento e tente novamente." },
      { status: 429 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = HeroQuoteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    primeiroNome, ultimoNome, indicativo, telefone,
    rua, codigoPostal, numeroPosta, andar, elevador,
    tipoServico, descricao, pagePath, utmSource, utmMedium, utmCampaign, fotos,
  } = parsed.data;

  const nomeCompleto = `${primeiroNome} ${ultimoNome}`.trim();
  const telefoneFull = juntarIndicativo(indicativo, telefone).replace(/\s+/g, "");
  const morada = [rua, numeroPosta, codigoPostal].filter(Boolean).join(", ");

  // Qualquer texto passava como telefone — e neste formulário não há email:
  // o telefone é o único caminho até ao cliente.
  const erroDoTelefone = problemaDoTelefone(telefoneFull);
  if (erroDoTelefone) {
    return NextResponse.json(
      { error: erroDoTelefone, details: { telefone: [erroDoTelefone] } },
      { status: 400 },
    );
  }

  // ── Motor de preços (rápido, sem Gemini) ─────────────────────────────────────
  // Estimativa de distância a partir do código postal relativamente à base CLYON em Fernão Ferro.
  // Fernão Ferro (2865) é a origem → zonas adjacentes têm km reduzidos.
  // A tabela de distâncias vivia aqui dentro. É regra de negócio e não
  // detalhe desta rota — passou para src/lib/distancia-estimada.ts, para o
  // formulário de contactos a usar também em vez de nascer uma segunda cópia
  // com outros números. (Havia faixas sobrepostas na versão antiga: 2830-2839
  // e 2836-2844 cruzavam-se, e ganhava a primeira condição escrita.)
  const { km: estimatedKm } = kmParaOrcamento({ codigoPostal, morada: null });

  let estimate: Awaited<ReturnType<typeof calculateFastEstimate>> | null = null;
  try {
    estimate = await calculateFastEstimate({
      serviceType: tipoServico,
      description: descricao ?? "",
      floor: andar || undefined,
      hasElevator: elevador,
      distanceFromBase: { distanceKm: estimatedKm },
    });
  } catch (e) {
    console.error("[hero-quote] calculateFastEstimate error:", e);
  }

  // ── Criar lead ────────────────────────────────────────────────────────────────
  let leadGravado = false;
  try {
    await createLead({
      nome:                nomeCompleto,
      telefone:            telefoneFull,
      email:               "",          // email não exigido neste formulário
      localidade:          codigoPostal,
      tipoServico:         SERVICE_LABELS[tipoServico] ?? tipoServico,
      preferenciaContacto: "telefone",
      mensagem:            descricao ?? null,
      // A coluna `origem` existia e ninguém a preenchia: o painel caía no
      // pagePath e mostrava "/" a todos os leads da homepage.
      origem:              "hero_quote_form",
      canal:               "telefone",
      pagePath:            pagePath ?? "/",
      pageUrl:             pagePath ? `${SITE_URL}${pagePath}` : SITE_URL,
      utmSource:           utmSource ?? null,
      utmMedium:           utmMedium ?? null,
      utmCampaign:         utmCampaign ?? null,
      gclid:               null,
    });
    leadGravado = true;
  } catch (e) {
    console.error("[hero-quote] createLead error:", e);
  }

  void createLeadEvent({
    eventType: "form_submit_hero_quote",
    pagePath: pagePath ?? "/",
    serviceType: tipoServico,
    location: codigoPostal,
    contactPreference: "telefone",
    utmSource: utmSource ?? null,
    utmMedium: utmMedium ?? null,
    utmCampaign: utmCampaign ?? null,
    gclid: null,
  }).catch((e) => console.error("[hero-quote] createLeadEvent error:", e));

  // ── Criar pedido (pedidos backoffice) ─────────────────────────────────────────
  let orderId: number | null = null;
  try {
    const priority = calculateOrderPriority({
      urgency: undefined,
      description: descricao,
      estimateTotal: estimate?.estimatedPriceWithVat?.toString() ?? null,
    });

    const row = {
      serviceType: tipoServico || null,
      description: descricao || null,
      // Só entradas COM url. Uma linha sem url não é uma foto: é uma linha que
      // faz o painel dizer que há fotos quando não há nenhuma.
      filesJson:
        fotos && fotos.length > 0
          ? JSON.stringify(
              fotos
                .filter((f) => f.url)
                .map((f, i) => ({
                  id: String(i),
                  url: f.url,
                  name: f.name ?? `foto-${i + 1}`,
                  size: f.size ?? 0,
                  type: f.type ?? "image/jpeg",
                  mimeType: f.type ?? "image/jpeg",
                })),
            )
          : null,
      address: morada || null,
      city: codigoPostal || null,   // será refinado pelo admin; usamos CP como referência
      postalCode: codigoPostal || null,
      floor: andar || null,
      hasElevator: elevador !== "unknown" ? elevador : null,
      parkingDistance: null,
      contactName: nomeCompleto,
      contactPhone: telefoneFull,
      contactEmail: null,
      urgency: null,
      estimateMin: estimate?.estimatedPriceWithoutVat?.toString() ?? null,
      estimateMax: estimate?.estimatedPriceWithVat?.toString() ?? null,
      estimateTotal: estimate?.estimatedPriceWithVat?.toString() ?? null,
      estimateJson: estimate ? JSON.stringify(estimate) : null,
      recurrenceFrequency: null,
      recurringDiscountPercent: null,
      analysisJsonExtended: null,
      distanceKm: null,
      distanceText: null,
      chatJson: null,
      priority,
      status: "sem_assistente" as const,
      assignedToId: null,
      assignedToName: null,
      assignedAt: null,
      rawOrderJson: JSON.stringify({
        serviceType: tipoServico,
        description: descricao,
        floor: andar,
        hasElevator: elevador,
        address: { formattedAddress: morada },
        receiver: { name: nomeCompleto, phone: telefoneFull },
        _source: "hero_quote_form",
      }),
    };

    orderId = await createSimulatorOrder(row);

    // O histórico é um extra. Se falhar, o pedido existe na mesma — e o aviso
    // à equipa, logo abaixo, não pode ficar por mandar por causa dele.
    await appendOrderHistory(orderId, {
      type: "created",
      by: null,
      message: `Pedido criado via formulário hero (homepage). Serviço: ${tipoServico}. Prioridade: ${priority}.`,
    }).catch((e) => console.error("[hero-quote] appendOrderHistory error:", e));

    notifyNewOrder({
      id: orderId,
      serviceType: tipoServico,
      contactName: nomeCompleto,
      city: null,
      address: morada,
      estimateWithVat: estimate?.estimatedPriceWithVat?.toString() ?? null,
      backofficeUrl: `${SITE_URL}/admin/pedidos/${orderId}`,
    });
  } catch (e) {
    console.error("[hero-quote] createSimulatorOrder error:", e);
  }

  /*
   * NADA GRAVADO NÃO É SUCESSO.
   *
   * As duas escritas estavam em try/catch que só escreviam no log, e a rota
   * respondia sempre {ok: true} — com `orderId: null` quando a base falhava.
   * O cliente via "Pedido enviado com sucesso!" e ficava à espera de uma
   * chamada que ninguém ia fazer: não havia pedido nem lead com o telefone
   * dele em sítio nenhum.
   *
   * Basta uma das duas para a equipa lhe chegar (o lead também traz o
   * telefone). Com nenhuma, diz-se-lhe — e o formulário mostra o WhatsApp.
   */
  const pedidoGravado = typeof orderId === "number" && orderId > 0;
  if (!pedidoGravado && !leadGravado) {
    return NextResponse.json({ ok: false, error: NADA_GRAVADO }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    orderId,
    estimate: estimate
      ? {
          estimatedPriceWithVat: estimate.estimatedPriceWithVat,
          estimatedPriceWithoutVat: estimate.estimatedPriceWithoutVat,
          estimateMinWithVat: estimate.estimateMinWithVat,
          estimateMaxWithVat: estimate.estimateMaxWithVat,
          status: estimate.status,
          confidence: estimate.confidence,
          customerMessage: estimate.customerMessage,
        }
      : null,
  });
}
