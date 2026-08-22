import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { createSimulatorOrder, appendOrderHistory } from "@/lib/db";
import { calculateFastEstimate } from "@/lib/pricing-helper";
import { kmParaOrcamento } from "@/lib/distancia-estimada";
import { moradaCompleta } from "@/lib/morada";
import { valorDeArranque } from "@/lib/valor-de-arranque";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { avaliarAlcance } from "@/lib/distribuir-pedido";
import { emailValido } from "@/lib/inscricao-profissional";
import { geocodificarMorada } from "@/lib/geocodificar";

export const runtime = "nodejs";

/**
 * A CLYON regista um pedido que chegou por WhatsApp ou por telefone.
 *
 * PORQUE EXISTE
 *
 * Uma boa parte dos pedidos nunca passa pelo site: a pessoa manda uma
 * mensagem, ou liga, descreve o que precisa e desliga. Esses pedidos existiam
 * na cabeça de quem atendeu e em mais lado nenhum — não chegavam aos
 * profissionais, e o trabalho ou era feito pela CLYON ou perdia-se.
 *
 * Isto dá-lhes a mesma vida que os outros: entram na base, passam pelo motor
 * de preços, e são distribuídos a quem os pode fazer. A diferença é quem
 * responde às propostas — nestes é a CLYON, em nome do cliente, pela rota
 * /api/admin/negociacoes/agir.
 *
 * O QUE ESTA ROTA NÃO FAZ, E A ROTA PÚBLICA FAZ
 *
 * A rota pública sobrepõe o contacto do pedido pelo da sessão autenticada:
 * quem está a preencher É o cliente. Aqui é o contrário — quem preenche é um
 * colaborador, e o contacto é de outra pessoa. Usar a sessão aqui gravava os
 * pedidos todos no nome de quem os registou, e o profissional recebia o
 * telefone da CLYON em vez do de quem o espera em casa.
 */

type Corpo = {
  serviceType?: string;
  description?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  floor?: string;
  hasElevator?: string;
  parkingDistance?: string;
  urgency?: string;
  precisaFatura?: boolean;
  precisaGuiaTransporte?: boolean;
  /** O valor de partida, se a equipa já combinou um ao telefone. */
  valor?: string | number | null;
};

const texto = (v: unknown, max = 500): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
};

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdmin(req);
  if (err) return err;

  let corpo: Corpo;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const serviceType = texto(corpo.serviceType, 60);
  const contactName = texto(corpo.contactName, 120);
  const contactPhone = texto(corpo.contactPhone, 40);
  const contactEmail = texto(corpo.contactEmail, 200)?.toLowerCase() ?? null;
  const address = texto(corpo.address, 300);

  /*
   * O mínimo para isto servir para alguma coisa.
   *
   * Sem serviço não há preço nem elegibilidade — a regra que decide a quem o
   * pedido chega compara categorias, e um pedido sem categoria não se manda a
   * ninguém. Sem morada não há distância. Sem contacto não há a quem entregar
   * o trabalho depois de fechado.
   */
  if (!serviceType) {
    return NextResponse.json({ error: "Escolha o tipo de serviço." }, { status: 400 });
  }
  if (!address) {
    return NextResponse.json({ error: "Indique a morada do serviço." }, { status: 400 });
  }
  if (!contactName || !contactPhone) {
    return NextResponse.json({ error: "Indique o nome e o telefone do cliente." }, { status: 400 });
  }
  /*
   * O email é opcional AQUI e obrigatório no simulador, e a diferença é
   * deliberada: quem telefona muitas vezes não tem o email à mão, e nestes
   * pedidos é a CLYON que responde às propostas por ele. Mas se houver um, tem
   * de estar certo — um email mal escrito manda o acompanhamento para o lado
   * errado e ninguém dá por isso.
   */
  if (corpo.contactEmail != null && corpo.contactEmail !== "" && !emailValido(contactEmail ?? "")) {
    return NextResponse.json({ error: "Este email não parece estar certo." }, { status: 400 });
  }

  try {
    const postalCode = texto(corpo.postalCode, 20);
    const city = texto(corpo.city, 120);
    const description = texto(corpo.description, 4000);

    /*
     * O mesmo motor de preços dos pedidos do site.
     *
     * Uma morada ditada ao telefone não passou por pesquisa nenhuma, e por
     * isso não há coordenadas: a distância sai do código postal, ou do nome da
     * localidade, ou do valor por omissão. Nenhuma é a medição real, e todas
     * são melhores do que zero — que era o que dava um preço de trabalho ao
     * lado da base para um serviço do outro lado da ponte.
     */
    /*
     * Coordenadas primeiro. É o que decide a quem o pedido chega.
     *
     * Sem elas, a regra de elegibilidade cai na lista de zonas que cada
     * profissional escreveu à mão — cinco ou seis nomes — em vez de comparar
     * a distância real com o raio que ele declarou. Foi o que matou o #205:
     * uma recolha em Lisboa contra "palmela, montijo, seixal, amora, setubal",
     * zero profissionais, quando a 35 km havia um com raio de 125.
     *
     * Se falhar, seguimos na mesma: null cai nas zonas, como antes.
     */
    const coords = await geocodificarMorada(address, postalCode);

    const { km, origem: origemKm } = kmParaOrcamento({
      distanciaMedidaKm: null,
      codigoPostal: postalCode,
      morada: moradaCompleta({ formattedAddress: address, city, postalCode }),
      cidade: city,
    });

    let estimativa: Awaited<ReturnType<typeof calculateFastEstimate>> | null = null;
    try {
      const calculada = await calculateFastEstimate({
        serviceType,
        description: description ?? "",
        floor: texto(corpo.floor, 40) || undefined,
        hasElevator: texto(corpo.hasElevator, 40),
        parkingDistance: texto(corpo.parkingDistance, 40),
        urgency: texto(corpo.urgency, 40),
        distanceFromBase: { distanceKm: km },
      } as Parameters<typeof calculateFastEstimate>[0]);

      estimativa = {
        ...calculada,
        internalNotes: [
          ...(calculada.internalNotes ?? []),
          "Pedido registado no backoffice por " + (colab?.nome ?? "a equipa") + ".",
          origemKm === "codigo_postal"
            ? "Distância estimada pelo código postal: " + km + " km — confirmar com a morada exacta."
            : origemKm === "cidade"
              ? "Morada sem código postal: assumidos " + km + " km pela localidade."
              : "Sem morada utilizável: assumidos " + km + " km. Confirmar antes de fechar.",
        ],
      };
    } catch (e) {
      // Um pedido sem estimativa é mau; um pedido perdido é pior.
      console.error("[admin/pedidos/criar] motor de precos falhou:", e);
    }

    const arranque = valorDeArranque(corpo.valor ?? null, estimativa);
    const acesso = gerarTokenDeAcesso();

    const linha = {
      serviceType,
      description,
      contactName,
      contactPhone,
      contactEmail,
      address,
      city,
      postalCode,
      floor: texto(corpo.floor, 40),
      hasElevator: texto(corpo.hasElevator, 40),
      parkingDistance: texto(corpo.parkingDistance, 40),
      urgency: texto(corpo.urgency, 40),
      estimateMin: estimativa?.estimateMinWithoutVat?.toString() ?? null,
      estimateMax: estimativa?.estimateMaxWithoutVat?.toString() ?? null,
      estimateTotal: estimativa?.estimatedPriceWithVat?.toString() ?? null,
      estimateJson: estimativa ? JSON.stringify(estimativa) : null,
      distanceKm: String(km),
      status: "sem_assistente",
      priority: "normal",
      /*
       * A origem fica marcada, e não é enfeite.
       *
       * É por ela que quem abrir a lista sabe que, neste pedido, o cliente não
       * responde sozinho: foi a CLYON que o registou e é a CLYON que negoceia
       * por ele. Sem a marca, daqui a um mês ninguém distingue este de um que
       * veio do simulador — e alguém fica à espera de uma resposta que o
       * cliente não sabe que tem de dar.
       */
      rawOrderJson: JSON.stringify({
        origemPedido: "backoffice",
        registadoPor: colab?.nome ?? null,
        address: {
          formattedAddress: coords?.moradaNormalizada ?? address,
          city,
          postalCode,
          // Ficam gravadas para o botão "Enviar aos profissionais" as
          // reaproveitar mais tarde — é de lá que ele as lê.
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        },
      }),
      valorDesejadoCliente: arranque != null ? String(arranque) : null,
      precisaFatura: corpo.precisaFatura === true ? 1 : 0,
      precisaGuiaTransporte: corpo.precisaGuiaTransporte === true ? 1 : 0,
      acessoTokenHash: acesso.hash,
      acessoTokenExpiraEm: acesso.expiraEm,
    };

    const id = await createSimulatorOrder(
      linha as unknown as Parameters<typeof createSimulatorOrder>[0],
    );

    await appendOrderHistory(id, {
      type: "created",
      by: null,
      message:
        "Pedido registado no backoffice por " +
        (colab?.nome ?? "a equipa") +
        " (chegou por fora do site). Serviço: " +
        serviceType +
        "." +
        (arranque != null
          ? " Valor de partida: " + arranque + " €."
          : " Sem valor de partida."),
    });

    /*
     * Avaliar o alcance, e NÃO enviar.
     *
     * Enviava logo. Um pedido escrito à mão a partir de um telefonema pode ter
     * a morada, a categoria ou a zona erradas de maneiras que só se descobrem
     * quando não chega a ninguém — e descobri-lo depois de enviar é tarde: as
     * negociações estão criadas e os emails saíram.
     *
     * Agora quem regista vê a quem chegaria, confere a estimativa, e decide.
     * O envio é um segundo passo, deliberado.
     */
    let alcance: Awaited<ReturnType<typeof avaliarAlcance>> | null = null;
    if (arranque != null) {
      try {
        alcance = await avaliarAlcance({
          serviceType,
          precisaFatura: corpo.precisaFatura === true,
          precisaGuiaTransporte: corpo.precisaGuiaTransporte === true,
          city,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        });
      } catch (e) {
        console.error("[admin/pedidos/criar] avaliacao de alcance falhou:", e);
      }
    }

    return NextResponse.json({
      ok: true,
      id,
      valorDePartida: arranque,
      estimativa: estimativa?.estimatedPriceWithVat ?? null,
      distanciaKm: km,
      geocodificado: coords != null,
      moradaNormalizada: coords?.moradaNormalizada ?? null,
      alcance,
    });
  } catch (error) {
    console.error("[admin/pedidos/criar]", error);
    return NextResponse.json({ error: "Não foi possível criar o pedido." }, { status: 500 });
  }
}
