import { lerBase } from "@/lib/base-do-preco";
import {
  pedidosAbertosParaAlcancar,
  getSimulatorOrderById,
  appendOrderHistory,
} from "@/lib/db";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";
import { distribuirPedido, resumoDaDistribuicao } from "@/lib/distribuir-pedido";
import {
  DIAS_PARA_ALCANCAR,
  NOVAS_POR_PASSAGEM,
  type ResultadoDoAlcance,
} from "@/lib/alcancar-pedidos";

/**
 * A PASSAGEM QUE ALCANÇA OS PEDIDOS ATRASADOS.
 *
 * A metade suja de `alcancar-pedidos.ts`: lê a base, chama a distribuição de
 * sempre, escreve o que aconteceu. Não decide nada — a regra de o que está
 * aberto está no outro ficheiro, e a de quem é elegível em
 * `profissional-elegivel.ts`.
 *
 * NÃO SE COPIOU A DISTRIBUIÇÃO. `distribuirPedido` já salta quem tem
 * negociação, já mede a distância de cada profissional à base dele, já guarda
 * as medições e já manda o email. Repeti-la aqui, mais simples, era escrever
 * uma segunda distribuição que no primeiro dia concordava com a primeira e no
 * segundo já não.
 */
export async function correrOAlcance(opcoes: {
  baseUrl?: string;
  /** Quantas negociações novas esta passagem pode criar. */
  tecto?: number;
  dias?: number;
}): Promise<ResultadoDoAlcance> {
  const tecto = opcoes.tecto ?? NOVAS_POR_PASSAGEM;
  const dias = opcoes.dias ?? DIAS_PARA_ALCANCAR;

  /*
   * O TECTO CONTA NEGOCIAÇÕES, E POR ISSO PEDE-SE MAIS PEDIDOS DO QUE ELE.
   *
   * A maioria das passagens não cria nada — quem havia de receber já recebeu.
   * Limitar a consulta ao tecto faria a passagem parar de olhar depois de 120
   * pedidos onde não havia nada para fazer, e os que interessam ficavam sempre
   * atrás deles.
   */
  const ids = await pedidosAbertosParaAlcancar(dias, 400);

  const r: ResultadoDoAlcance = {
    vistos: 0,
    novas: 0,
    pedidosComNovidade: 0,
    porOlhar: 0,
    falhados: 0,
  };

  for (const [i, pedidoId] of ids.entries()) {
    if (r.novas >= tecto) {
      r.porOlhar = ids.length - i;
      break;
    }
    r.vistos += 1;

    try {
      const pedido = await getSimulatorOrderById(pedidoId);
      /*
       * Sem valor de partida não é um pedido da plataforma — é a mesma guarda
       * da rota de redistribuir, e sem ela a conta do profissional sairia de
       * um `null`.
       */
      if (!pedido || pedido.valorDesejadoCliente == null) continue;

      const geo = await coordenadasDoPedido(pedido);
      let fotos = 0;
      try {
        const cru = JSON.parse(pedido.rawOrderJson ?? "{}");
        fotos = Array.isArray(cru?.files) ? cru.files.length : 0;
      } catch {
        /* sem fotos */
      }

      const d = await distribuirPedido({
        id: pedidoId,
        serviceType: pedido.serviceType ?? null,
        description: pedido.description ?? null,
        city: pedido.city ?? null,
        urgency: pedido.urgency ?? null,
        quantidadeDeFotos: fotos,
        valorDesejadoCliente: Number(pedido.valorDesejadoCliente),
        precisaFatura: Boolean(pedido.precisaFatura),
        precisaGuiaTransporte: Boolean(pedido.precisaGuiaTransporte),
        baseDoPreco: lerBase(pedido.baseDoPreco),
        lat: geo.lat,
        lng: geo.lng,
        baseUrl: opcoes.baseUrl,
      });

      if (d.receberam > 0) {
        r.novas += d.receberam;
        r.pedidosComNovidade += 1;
        /*
         * SÓ SE ESCREVE QUANDO ALGUMA COISA ACONTECEU.
         *
         * O histórico do pedido é permanente e é onde se vai procurar o que
         * lhe aconteceu. Uma linha por noite a dizer «revisto, nada a fazer»
         * enterrava as que interessam debaixo de sessenta iguais.
         */
        await appendOrderHistory(pedidoId, {
          type: "created",
          by: null,
          message: `Alcance automático: chegou a quem se inscreveu depois. ${resumoDaDistribuicao(d)}`,
        });
      }
    } catch (e) {
      r.falhados += 1;
      console.error("[alcance] pedido", pedidoId, e);
    }
  }

  return r;
}
