/**
 * O ENTULHO SEM GUIA, NA BASE — 25-11-2026 (d118). Ver `guia-no-entulho.ts`.
 */
import { servicoExigeGuia } from "./guia-antes-de-contratar";

/** Este número tem um pedido de entulho aberto? Na dúvida (a base falhou), não. */
export async function temPedidoDeEntulhoAberto(telefone: string): Promise<boolean> {
  try {
    const { pedidosDoTelefone } = await import("./whatsapp-negociacao");
    const { getSimulatorOrderById } = await import("./db");
    const ids = await pedidosDoTelefone(telefone);
    for (const id of ids.slice(0, 5)) {
      const p = await getSimulatorOrderById(id).catch(() => null);
      if (servicoExigeGuia(p?.serviceType ?? null)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
