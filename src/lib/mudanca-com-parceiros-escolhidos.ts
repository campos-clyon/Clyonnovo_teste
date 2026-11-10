import { appendOrderHistory, gravarEscolhaDosParceiros, listaDeParceirosNasMudancasLigada } from "./db";
import { congelarTarifa, REGRAS_DAS_MUDANCAS } from "./conta-da-mudanca";
import { distribuirPedido, resumoDaDistribuicao } from "./distribuir-pedido";
import { avisarCliente } from "./avisos-do-backoffice";
import { lerForma } from "./forma-de-pagamento";
import { lerPessoas, resumoDaMudanca, type Pessoas } from "./lista-de-parceiros-da-mudanca";
import { prazoDeResposta } from "./prazo-de-resposta-do-parceiro";
import { dataEHoraEmLisboa } from "./hora-de-lisboa";
import {
  conferirEscolha,
  lerPedidoDaLista,
  listaDosParceirosDaMudanca,
  type EscolhivelDaLista,
  type PedidoDaLista,
} from "./parceiros-da-mudanca";
import type { Ponto } from "./distancia-entre-pontos";
import type { CartaoDoParceiro } from "./lista-de-parceiros-da-mudanca";

/**
 * O PEDIDO DE MUDANÇA COM OS PARCEIROS ESCOLHIDOS PELO CLIENTE — 10-11-2026.
 *
 * Duas metades, chamadas pela rota do pedido:
 *
 *   1. `prepararEscolhaDaMudanca`, ANTES de gravar: refaz a lista no servidor
 *      e confere cada id escolhido (elegível, com tarifa activa, na lista de
 *      agora). Um id que não esteja recusa o pedido — o cliente não força
 *      ninguém. Sem escolha, ou com o interruptor das Configs desligado, é o
 *      caminho de antes (a Mesa).
 *   2. `enviarAosEscolhidos`, DEPOIS de gravar: congela a tarifa de cada um na
 *      negociação dele, grava o prazo (3 h entre as 8h e as 21h de Lisboa),
 *      envia SÓ a esses (soPara ∩ elegíveis, sem a análise da CLYON), avisa-os
 *      como a distribuição avisa, e grava no pedido o que o cliente viu.
 */

export type EscolhaPreparada = {
  pedidoDaLista: PedidoDaLista;
  pessoas: Pessoas;
  escolhidos: EscolhivelDaLista[];
  cartoesVistos: CartaoDoParceiro[];
  kmPercurso: number;
  horas: number;
  origemPonto: Ponto;
  procurarMais: boolean;
};

export type ResultadoDaPreparacao =
  | { caminho: "antigo" }
  | { caminho: "escolhidos"; escolha: EscolhaPreparada }
  | { caminho: "recusado"; erro: string; campo: string };

type Morada = { lat?: unknown; lng?: unknown; formattedAddress?: unknown; city?: unknown } | undefined;

/** O pedaço do pedido do simulador (ou da app) que a lista lê. */
export function pedidoDaListaDoPedido(order: Record<string, unknown>) {
  const o = order.originAddress as Morada;
  const d = order.destinationAddress as Morada;
  const ao = order.originAccess as { difficultAccess?: unknown } | undefined;
  const ad = order.destinationAccess as { difficultAccess?: unknown } | undefined;
  return lerPedidoDaLista({
    origem: o ? { lat: o.lat, lng: o.lng, morada: o.formattedAddress, cidade: o.city } : null,
    destino: d ? { lat: d.lat, lng: d.lng, morada: d.formattedAddress, cidade: d.city } : null,
    tipologia: order.tipologia,
    desmontagem: ao?.difficultAccess === true || ad?.difficultAccess === true || order.desmontagem === true,
    pessoas: order.pessoas,
    data: typeof order.dataPreferida === "string" ? order.dataPreferida : null,
    formaDePagamento: order.formaDePagamento,
  });
}

export async function prepararEscolhaDaMudanca(
  order: Record<string, unknown>,
  agora: Date = new Date(),
): Promise<ResultadoDaPreparacao> {
  const ids = order.parceirosEscolhidos;
  if (order.serviceType !== "mudanca" || ids == null || (Array.isArray(ids) && ids.length === 0)) {
    return { caminho: "antigo" };
  }
  if (!(await listaDeParceirosNasMudancasLigada())) return { caminho: "antigo" };

  if (!lerPessoas(order.pessoas)) {
    return { caminho: "recusado", erro: "A equipa é de 2 ou de 3 pessoas.", campo: "pessoas" };
  }
  const lido = pedidoDaListaDoPedido(order);
  if (!lido.ok) return { caminho: "recusado", erro: lido.erro, campo: "parceirosEscolhidos" };

  const lista = await listaDosParceirosDaMudanca(lido.pedido, agora);
  if (!lista.ok) return { caminho: "recusado", erro: lista.erro, campo: "parceirosEscolhidos" };

  const conferida = conferirEscolha(ids, lista.escolhiveis);
  if (!conferida.ok) return { caminho: "recusado", erro: conferida.erro, campo: "parceirosEscolhidos" };

  return {
    caminho: "escolhidos",
    escolha: {
      pedidoDaLista: lido.pedido,
      pessoas: lido.pedido.pessoas,
      escolhidos: conferida.escolhidos,
      cartoesVistos: lista.cartoes,
      kmPercurso: lista.kmPercurso,
      horas: lista.horas,
      origemPonto: lista.origemPonto,
      procurarMais: order.procurarMaisParceiros === true,
    },
  };
}

/** O que fica gravado no pedido: a prova do que o cliente viu e escolheu. */
export function provaDaEscolha(e: EscolhaPreparada, prazo: Date, agora: Date) {
  return {
    versao: 1,
    em: agora.toISOString(),
    pessoas: e.pessoas,
    tipologia: e.pedidoDaLista.tipologia,
    desmontagem: e.pedidoDaLista.desmontagem,
    kmPercurso: e.kmPercurso,
    horas: e.horas,
    resumo: resumoDaMudanca(e.pedidoDaLista.tipologia, e.pedidoDaLista.origem.cidade, e.pedidoDaLista.destino.cidade, e.horas, e.pessoas),
    escolhidos: e.escolhidos.map((x) => ({ id: x.id, providerId: x.providerId, nome: x.nome })),
    procurarMais: e.procurarMais,
    prazoRespostaEm: prazo.toISOString(),
    // Os cartões tal como saíram: preços, horas, km e estimativas, sem contactos.
    cartoesVistos: e.cartoesVistos,
  };
}

/** A linha do histórico da Mesa. Fala de parceiros: é o que o cliente fez. */
export function linhaDoHistorico(e: EscolhaPreparada, prazo: Date, resumo: string): string {
  return (
    `Mudança com a lista de parceiros: o cliente escolheu ${e.escolhidos.map((x) => x.nome).join(", ")} ` +
    `(equipa de ${e.pessoas}). Enviado logo aos escolhidos, sem a análise da CLYON, com a tarifa de cada um congelada. ` +
    `Prazo de resposta: ${dataEHoraEmLisboa(prazo)} (3 h, entre as 8h e as 21h). ` +
    (e.procurarMais ? "O cliente pediu também que a CLYON procure mais parceiros. " : "") +
    resumo
  );
}

export async function enviarAosEscolhidos(
  pedido: {
    id: number;
    description: string | null;
    city: string | null;
    urgency: string | null;
    quantidadeDeFotos: number;
    valorDesejadoCliente: number | null;
    precisaFatura: boolean;
    formaDePagamento: unknown;
    baseUrl: string;
  },
  e: EscolhaPreparada,
  agora: Date = new Date(),
): Promise<void> {
  const prazo = prazoDeResposta(agora);
  const taxas = { cliente: 0, profissional: REGRAS_DAS_MUDANCAS.taxa };
  const porParceiro = new Map(
    e.escolhidos.map((x) => {
      const congelada = congelarTarifa(x.tarifa, REGRAS_DAS_MUDANCAS, agora);
      const hora = e.pessoas === 3 ? congelada.precoHora3Cent : congelada.precoHora2Cent;
      return [
        x.providerId,
        {
          tarifaCongeladaJson: JSON.stringify(congelada),
          pessoas: e.pessoas,
          prazoRespostaEm: prazo,
          taxas,
          precoHora: (hora ?? congelada.precoHora2Cent) / 100,
        },
      ] as const;
    }),
  );

  // A prova primeiro: se a distribuição falhar a meio, o que o cliente viu já está escrito.
  await gravarEscolhaDosParceiros(pedido.id, provaDaEscolha(e, prazo, agora)).catch((err) =>
    console.error("[mudança escolhida] a prova não se gravou:", err),
  );

  const r = await distribuirPedido(
    {
      id: pedido.id,
      serviceType: "mudanca",
      description: pedido.description,
      city: pedido.city,
      urgency: pedido.urgency,
      quantidadeDeFotos: pedido.quantidadeDeFotos,
      valorDesejadoCliente: pedido.valorDesejadoCliente,
      precisaFatura: pedido.precisaFatura,
      precisaGuiaTransporte: false,
      baseDoPreco: "hora",
      formaDePagamento: lerForma(pedido.formaDePagamento),
      lat: e.origemPonto.lat,
      lng: e.origemPonto.lng,
      baseUrl: pedido.baseUrl,
    },
    { soPara: e.escolhidos.map((x) => x.providerId), exigirElegibilidade: true, mudancaPorParceiro: porParceiro },
  );

  await appendOrderHistory(pedido.id, { type: "created", by: null, message: linhaDoHistorico(e, prazo, resumoDaDistribuicao(r)) });
  if (r.receberam > 0) await avisarCliente(pedido.id, "enviado").catch(() => undefined);
}
