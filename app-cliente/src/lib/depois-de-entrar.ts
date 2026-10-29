import { router } from "expo-router";
import { ErroDaApi, mensagemDe, pedir } from "./api";
import { codigoDoConvidado, esquecerSessaoDeConvidado, sessaoDoPedido } from "./convidado";
import { esquecerDepoisDeEntrar, lerDepoisDeEntrar, type DepoisDeEntrar } from "./guardado";
import { resultadoDaJuncao, type ResultadoDaJuncao } from "./pedido-do-link";
import { ROTA_DO_PEDIDO_DO_LINK } from "./pedidos";

/**
 * DEPOIS DE ENTRAR (E1 v3) — volta ao ecrã de onde se veio:
 *   resumo  → o passo 3 do pedido, com «Entrou como …» (não envia sozinho);
 *   juntar  → junta o pedido aberto pelo link à conta (D5): pelo código de 6
 *             algarismos que chega por WhatsApp (ecrã `juntar/[id]`) ou pela Mesa;
 *   pedidos → os pedidos.
 * Sem nada guardado, vai para os pedidos.
 */

/** Uma chamada da junção (R10 com conta): o resultado, também nos 409/410/422/429. */
export async function pedirJuncao(corpo: Record<string, unknown>): Promise<ResultadoDaJuncao> {
  try {
    const r = await pedir<unknown>(ROTA_DO_PEDIDO_DO_LINK, { metodo: "POST", corpo: { ...corpo, juntar: true } });
    return resultadoDaJuncao(200, r);
  } catch (e) {
    if (e instanceof ErroDaApi) return resultadoDaJuncao(e.estado, { ...e.corpo, error: e.message });
    return { estado: "outro", mensagem: mensagemDe(e) };
  }
}

/** A junção com a sessão de convidado deste pedido (e o código do aparelho do convidado). */
export async function juntarOConvidado(pedidoId: number, codigo?: string): Promise<ResultadoDaJuncao | null> {
  const s = await sessaoDoPedido(pedidoId);
  if (!s) return null;
  const r = await pedirJuncao({ convidado: s.sessao, codigoDoAparelho: await codigoDoConvidado(), codigo });
  if (r.estado === "seu") await esquecerSessaoDeConvidado(pedidoId);
  return r;
}

export async function seguirDepoisDeEntrar(d?: DepoisDeEntrar | null): Promise<void> {
  const destino = d === undefined ? await lerDepoisDeEntrar() : d;
  esquecerDepoisDeEntrar();
  if (destino?.para === "resumo") {
    router.replace({ pathname: "/pedir", params: { entrou: "1" } });
    return;
  }
  if (destino?.para === "juntar") {
    const r = await juntarOConvidado(destino.pedidoId);
    if (!r) {
      router.replace("/pedidos");
      return;
    }
    if (r.estado === "seu") {
      router.replace(`/pedido/${r.id}`);
      return;
    }
    // O código foi pedido, ou fica à espera da Mesa, ou falhou: o ecrã da junção diz o quê.
    router.replace({ pathname: "/juntar/[id]", params: { id: String(destino.pedidoId), estado: r.estado, mensagem: r.mensagem } });
    return;
  }
  router.replace("/pedidos");
}
