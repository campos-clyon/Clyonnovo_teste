import { createSimulatorOrder, appendOrderHistory } from "./db";
import { calculateFastEstimate } from "./pricing-helper";
import { kmParaOrcamento } from "./distancia-estimada";
import { moradaCompleta } from "./morada";
import { valorDeArranque } from "./valor-de-arranque";
import { gerarTokenDeAcesso } from "./pedido-acesso";
import { geocodificarMoradaDetalhado, geocodificarLocalidade } from "./geocodificar";
import { camposDoServico } from "./campos-do-servico";
import type { DadosDaRecolha } from "./whatsapp-recolha";
import { nifDaFactura } from "./pedido-valores";
import { andarComLado, descricaoParaOPedido, telefoneDaConversa } from "./pedido-da-recolha";
import { valorDePartidaPorHora } from "./tabela-das-mudancas";

/**
 * O pedido que o bot do WhatsApp recolheu entra na base como os registados
 * à mão no backoffice.
 *
 * É a mesma sequência de /api/admin/pedidos/criar — coordenadas, campos do
 * serviço, motor de preços, valor de partida, linha na base, histórico — e
 * não é a rota porque a rota é HTTP com sessão de administrador, e isto corre
 * dentro do cérebro do WhatsApp sem pedido nenhum à volta. Repetir vinte
 * linhas é mais barato do que uma rota a fingir que é uma função.
 *
 * Nasce «sem_assistente», na fila «por enviar» do painel: quem confere e
 * envia aos profissionais é a equipa, como nos pedidos apanhados ao telefone.
 * O cliente responde às propostas sozinho, por aqui — o telefone é o dele.
 */
export async function registarPedidoDaRecolha(
  telefone: string,
  d: DadosDaRecolha,
): Promise<{ id: number; arranque: number | null; fotos: number }> {
  const serviceType = d.serviceType ?? "outro";
  const address = (d.address ?? "").trim();
  const postalCode = d.postalCode ?? null;
  const city = d.city?.replace(/\s*,?\s*portugal\s*$/i, "").trim() || null;
  /*
   * A mesma do formulário do backoffice — arrumada pela Vitória para o
   * profissional (26-10-2026, ver `descricao-do-pedido.ts`), com as
   * fotografias que estão à espera de entrar neste pedido contadas.
   */
  const { contarFotosPendentesWhatsApp } = await import("./db");
  const pendentes = await contarFotosPendentesWhatsApp(telefone).catch(() => 0);
  const description = descricaoParaOPedido(d, { fotos: Math.max(pendentes, d.fotosRecebidas ?? 0) });

  let dataAgendada: Date | null = null;
  if (d.dataDesejada) {
    const dt = new Date(d.dataDesejada);
    if (!Number.isNaN(dt.getTime()) && dt.getTime() > Date.now() - 3600_000) dataAgendada = dt;
  }
  const urgency = d.urgency ?? "flexible";

  const geo = await geocodificarMoradaDetalhado(address, postalCode ?? "", city ?? "");
  let coords = geo.coords;
  let coordsAproximadas = false;
  if (!coords && (postalCode || city)) {
    const aprox = await geocodificarLocalidade([postalCode, city].filter(Boolean).join(" "));
    if (aprox) {
      coords = { ...aprox, moradaNormalizada: null };
      coordsAproximadas = true;
    }
  }

  const { km, origem: origemKm } = kmParaOrcamento({
    distanciaMedidaKm: null,
    codigoPostal: postalCode,
    morada: moradaCompleta({ formattedAddress: address, city, postalCode }),
    cidade: city,
  });

  const proprios = await camposDoServico(
    {
      serviceType,
      floor: d.floor ?? undefined,
      hasElevator: d.hasElevator ?? undefined,
      parkingDistance: d.parkingDistance ?? undefined,
      moradaDestino: d.moradaDestino,
      localidadeDestino: d.localidadeDestino ?? undefined,
      codigoPostalDestino: d.codigoPostalDestino ?? undefined,
      // O acesso no destino de uma mudança (10-10-2026): o motor conta uma
      // hora por cada ponta, e o destino ia sempre em branco.
      andarDestino: d.andarDestino ?? undefined,
      elevadorDestino: d.elevadorDestino ?? undefined,
      estacionamentoDestino: d.estacionamentoDestino ?? undefined,
      entulhoQuantidade: d.entulhoQuantidade ?? undefined,
    },
    coords ? { lat: coords.lat, lng: coords.lng } : null,
  );

  let estimativa: Awaited<ReturnType<typeof calculateFastEstimate>> | null = null;
  try {
    const calculada = await calculateFastEstimate({
      serviceType,
      description: description ?? "",
      floor: d.floor ?? undefined,
      hasElevator: d.hasElevator ?? null,
      parkingDistance: d.parkingDistance ?? null,
      urgency,
      distanceFromBase: { distanceKm: km },
      ...proprios.paraOMotor,
    } as Parameters<typeof calculateFastEstimate>[0]);
    estimativa = {
      ...calculada,
      internalNotes: [
        ...(calculada.internalNotes ?? []),
        "Pedido recolhido pelo assistente do WhatsApp.",
        origemKm === "codigo_postal"
          ? "Distância estimada pelo código postal: " + km + " km — confirmar com a morada exacta."
          : origemKm === "cidade"
            ? "Morada sem código postal: assumidos " + km + " km pela localidade."
            : "Sem morada utilizável: assumidos " + km + " km. Confirmar antes de fechar.",
        ...(proprios.emFalta.length ? ["Falta para o preço: " + proprios.emFalta.join(", ") + "."] : []),
      ],
    };
  } catch (e) {
    console.error("[whatsapp/recolha] motor de preços falhou:", e);
  }

  /*
   * A MUDANÇA É À HORA (13-10-2026): o valor de partida é o da hora da tabela
   * — ver `tabela-das-mudancas.ts` —, e não a estimativa do trabalho todo.
   */
  const porHora = serviceType === "mudanca";
  const arranque = porHora
    ? valorDePartidaPorHora(await import("./db").then((m) => m.taxasActuais()).catch(() => undefined))
    : valorDeArranque(null, estimativa);
  const acesso = gerarTokenDeAcesso();

  const linha = {
    serviceType,
    description,
    contactName: d.contactName ?? "Cliente WhatsApp",
    // Com o «+» quando é de fora — ver `telefoneDaConversa` (26-10-2026).
    contactPhone: telefoneDaConversa(telefone),
    contactEmail: null,
    address,
    city,
    postalCode,
    // Com o lado da porta, que a morada já não leva (26-10-2026).
    floor: (d.lado ? andarComLado(d) : null) ?? d.floor ?? null,
    hasElevator: d.hasElevator ?? null,
    parkingDistance: d.parkingDistance ?? null,
    urgency,
    dataAgendada,
    filesJson: null,
    estimateMin: estimativa?.estimateMinWithoutVat?.toString() ?? null,
    estimateMax: estimativa?.estimateMaxWithoutVat?.toString() ?? null,
    estimateTotal: estimativa?.estimatedPriceWithVat?.toString() ?? null,
    estimateJson: estimativa ? JSON.stringify(estimativa) : null,
    distanceKm: String(km),
    status: "sem_assistente",
    priority: "normal",
    rawOrderJson: JSON.stringify({
      origemPedido: "whatsapp",
      registadoPor: "assistente do WhatsApp",
      address: {
        formattedAddress: coords?.moradaNormalizada ?? address,
        coordenadasAproximadas: coordsAproximadas || undefined,
        city,
        postalCode,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      },
      ...proprios.paraOJson,
    }),
    valorDesejadoCliente: arranque != null ? String(arranque) : null,
    baseDoPreco: porHora ? "hora" : "total",
    precisaFatura: d.precisaFatura ? 1 : 0,
    // O NIF que ele deu na conversa (10-10-2026). Sem NIF a coluna fica fora
    // do INSERT, como no pedido do site.
    nifFactura: (d.precisaFatura && nifDaFactura(d.nifFactura)) || undefined,
    precisaGuiaTransporte: 0,
    acessoTokenHash: acesso.hash,
    acessoTokenExpiraEm: acesso.expiraEm,
  };

  const id = await createSimulatorOrder(linha as unknown as Parameters<typeof createSimulatorOrder>[0]);
  await appendOrderHistory(id, {
    type: "created",
    by: null,
    message:
      "Pedido recolhido pelo assistente do WhatsApp da CLYON, em conversa com o cliente. Serviço: " +
      serviceType +
      "." +
      (arranque != null ? (porHora ? " Valor de partida: " + arranque + " € por hora." : " Estimativa: " + arranque + " €.") : " Sem estimativa."),
  });
  /*
   * AS FOTOGRAFIAS QUE CHEGARAM ANTES DO PEDIDO — 10-10-2026.
   *
   * O Bento mandou dezoito, o Simão nove, o Emiliano duas — todas antes de
   * haver pedido, e todas deitadas fora: a ponte só as guardava num pedido
   * que já existisse. Agora ficam à espera (`whatsappFotosPendentes`) e
   * entram aqui, no pedido que a conversa acabou de criar.
   */
  const { anexarFotosPendentesAoPedido } = await import("./db");
  const fotos = await anexarFotosPendentesAoPedido(telefone, id).catch((e) => {
    console.error("[whatsapp/recolha] fotografias pendentes não anexadas:", e);
    return 0;
  });
  /*
   * AS FONTES DA DESCRIÇÃO — 29-10-2026. Nascem da conversa (as frases dele,
   * o que se viu nas fotografias, o que apurou), e depois da resposta o
   * modelo escreve a descrição a partir delas, no formato do profissional. Se
   * falhar, fica a que a Vitória arrumou. Ver `descricao-do-pedido-na-base.ts`.
   */
  try {
    const nb = await import("./descricao-do-pedido-na-base");
    await nb.fontesDoPedidoRegistado(id, d, description);
    await nb.depoisDaResposta(() => nb.reescreverADescricao(id));
  } catch (e) {
    console.error("[whatsapp/recolha] fontes da descrição:", e);
  }
  return { id, arranque, fotos };
}
