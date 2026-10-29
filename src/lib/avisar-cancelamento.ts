import { perfilDoProfissional } from "./db";
import { avisarQuemFicouSemOTrabalho } from "./avisar-quem-perdeu";
import { avisarOClienteDoPedido } from "./avisos-ao-cliente";
import { avisoSemOTrabalho } from "./textos-dos-avisos-ao-profissional";

/**
 * UM PEDIDO CANCELADO AVISA QUEM ESTAVA NELE — 29-10-2026 (S19, BO23 e BO24).
 *
 * *«Os cancelamentos não avisam ninguém.»* Cancelar pela Mesa ou pelo cliente
 * encerrava as negociações em silêncio: o profissional contratado só sabia
 * quando aparecesse à porta, e o motivo (obrigatório quando há compromisso)
 * ficava só no histórico.
 *
 *   · cada profissional com proposta em aberto ou contratado: aviso no
 *     telemóvel, com o motivo; o contratado também por WhatsApp (se o ligou);
 *   · o cliente, quando foi a CLYON a cancelar: aviso no telemóvel.
 *
 * As negociações lêem-se ANTES de cancelar (depois estão todas «morta»).
 * Nunca lança: o cancelamento já está gravado.
 */
const COM_O_PROFISSIONAL = new Set(["aberta", "aguarda_contratacao", "acordada"]);

export async function avisarDoCancelamento(c: {
  pedidoId: number;
  negociacoes: Array<{ id: unknown; estado: unknown; providerId: unknown }>;
  motivo: string | null;
  porQuem: "cliente" | "clyon";
}): Promise<void> {
  try {
    const afectadas = (c.negociacoes ?? []).filter((n) => COM_O_PROFISSIONAL.has(String(n.estado)));
    await avisarQuemFicouSemOTrabalho({
      pedidoId: c.pedidoId,
      quem: afectadas.map((n) => ({ negociacaoId: Number(n.id), providerId: Number(n.providerId) })),
      porque: "cancelado",
      motivo: c.motivo,
    });
    for (const n of afectadas.filter((x) => String(x.estado) === "acordada")) {
      try {
        const perfil = await perfilDoProfissional(Number(n.providerId));
        const telefone = typeof perfil?.phone === "string" ? perfil.phone.trim() : "";
        if (!telefone) continue;
        const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
        const aviso = avisoSemOTrabalho({ pedidoId: c.pedidoId, porque: "cancelado", motivo: c.motivo });
        await enviarAvisoWhatsApp(telefone, aviso.body);
      } catch (err) {
        console.error("[avisar-cancelamento] WhatsApp ao contratado:", err instanceof Error ? err.message : err);
      }
    }
    if (c.porQuem === "clyon") {
      await avisarOClienteDoPedido(c.pedidoId, "cancelado", { motivo: c.motivo });
    }
  } catch (err) {
    console.error("[avisar-cancelamento]", err instanceof Error ? err.message : err);
  }
}
