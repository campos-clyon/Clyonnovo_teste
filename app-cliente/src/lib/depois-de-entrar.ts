import { router } from "expo-router";
import { pedir } from "./api";
import { codigoDoConvidado, esquecerSessaoDeConvidado, sessaoDoPedido } from "./convidado";
import { esquecerDepoisDeEntrar, lerDepoisDeEntrar, type DepoisDeEntrar } from "./guardado";
import { ROTA_DO_PEDIDO_DO_LINK, type RespostaDoPedidoDoLink } from "./pedidos";

/**
 * DEPOIS DE ENTRAR (E1 v3) — volta ao ecrã de onde se veio:
 *   resumo  → o passo 3 do pedido, com «Entrou como …» (não envia sozinho);
 *   juntar  → junta o pedido aberto pelo link à conta (D5, R10 com a sessão de
 *             convidado) e abre-o; se o site não deixar, volta ao pedido do link;
 *   pedidos → os pedidos.
 * Sem nada guardado, vai para os pedidos.
 */
export async function seguirDepoisDeEntrar(d?: DepoisDeEntrar | null): Promise<void> {
  const destino = d === undefined ? await lerDepoisDeEntrar() : d;
  esquecerDepoisDeEntrar();
  if (destino?.para === "resumo") {
    router.replace({ pathname: "/pedir", params: { entrou: "1" } });
    return;
  }
  if (destino?.para === "juntar") {
    const s = await sessaoDoPedido(destino.pedidoId);
    if (s) {
      try {
        const r = await pedir<RespostaDoPedidoDoLink>(ROTA_DO_PEDIDO_DO_LINK, {
          metodo: "POST",
          corpo: { convidado: s.sessao, codigoDoAparelho: await codigoDoConvidado(), juntar: true },
        });
        if (r.estado === "seu") {
          await esquecerSessaoDeConvidado(destino.pedidoId);
          router.replace(`/pedido/${r.id}`);
          return;
        }
      } catch {
        /* a junção falhou (outro email, já juntado, ou a S16 ainda não está no ar): o pedido do link continua */
      }
      router.replace(`/convidado/${destino.pedidoId}`);
      return;
    }
  }
  router.replace("/pedidos");
}
