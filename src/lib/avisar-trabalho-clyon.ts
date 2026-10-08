import {
  assistentePode,
  getSimulatorOrderById,
  reporAvisoAoProfissional,
  substituirAvisoPorSairAoProfissional,
  type ProfissionalAAvisar,
} from "./db";
import { avisoDeCancelamentoAoProfissional, avisoDeValorNovoAoProfissional } from "./aviso-de-oferta-clyon";
import { taxasDoTrabalhoClyon } from "./oferta-clyon";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";
import { enviarAvisoWhatsApp, telemovelParaWhatsApp } from "./whatsapp-cloud";

/**
 * OS AVISOS DE UM TRABALHO CLYON QUE MUDOU — 08-10-2026.
 *
 * *«Caso o valor seja alterado, mesmo que os pros já tenham aceitado, ele deve
 * aparecer novamente com o valor actualizado para aceitar.»* E cancelar avisa
 * todos (decisão do dono).
 *
 * As mesmas fechaduras dos avisos de pedido novo (`distribuir-pedido.ts`): o
 * interruptor de quem manda (`avisar_profissional`) e um número que seja um
 * telemóvel. A terceira — a vontade de quem recebe — depende de quem é:
 *
 *   · quem já tinha o trabalho (estava atribuído) é avisado sempre, já, como
 *     no aviso de que foi escolhido: o trabalho é dele, e mudou;
 *   · os outros, pela fila e só se quiserem avisos (`whatsappAvisos`, que a
 *     fila verifica ao enviar). O aviso de antes, se ainda não tinha saído, é
 *     substituído — o texto velho já não é verdade.
 *
 * Nunca atira: o valor já mudou, e um aviso que não sai não o desfaz.
 */

/** O valor mudou, ou o trabalho voltou aos que tinham ficado de fora. Devolve quantos ficaram avisados. */
export async function avisarValorNovoDoTrabalhoClyon(a: {
  pedidoId: number;
  valor: number;
  taxa: number;
  quem: ProfissionalAAvisar[];
  motivo: "valor_novo" | "de_novo";
  baseUrl: string;
}): Promise<number> {
  if (a.quem.length === 0) return 0;
  try {
    if (!(await assistentePode("avisar_profissional").catch(() => false))) return 0;
    const pedido = await getSimulatorOrderById(a.pedidoId);
    const ganhos = quantoOProfissionalRecebe(a.valor, taxasDoTrabalhoClyon(a.taxa));
    let avisados = 0;
    for (const q of a.quem) {
      // Quem não quer avisos não fica na fila a contar como avisado; quem o tinha, sim.
      if (!q.eraDele && !q.avisaPorWhatsApp) continue;
      const telefone = telemovelParaWhatsApp(q.telefone);
      if (!telefone) continue;
      const texto = avisoDeValorNovoAoProfissional(
        q.profissional,
        {
          pedidoId: a.pedidoId,
          servico: pedido?.serviceType ?? null,
          localidade: pedido?.city ?? null,
          valor: a.valor,
          ganhos,
          motivo: a.motivo,
          eraDele: q.eraDele,
          link: `${a.baseUrl}/profissionais/painel`,
        },
        new Date(),
      );
      // Ao que o tinha, já: e o aviso antigo que estivesse na fila (com o valor
      // e o link de antes) deixa de poder sair.
      if (q.eraDele) await substituirAvisoPorSairAoProfissional(a.pedidoId, q.providerId);
      const saiu = q.eraDele
        ? await enviarAvisoWhatsApp(telefone, texto).catch(() => false)
        : await reporAvisoAoProfissional({
            pedidoId: a.pedidoId,
            providerId: q.providerId,
            telefone,
            texto,
          });
      if (saiu) avisados += 1;
    }
    return avisados;
  } catch (e) {
    console.error("[avisar-trabalho-clyon] valor novo", e);
    return 0;
  }
}

/** O trabalho foi cancelado pela CLYON. Devolve quantos ficaram avisados. */
export async function avisarCancelamentoDoTrabalhoClyon(a: {
  pedidoId: number;
  servico: string | null;
  localidade: string | null;
  quem: ProfissionalAAvisar[];
}): Promise<number> {
  if (a.quem.length === 0) return 0;
  try {
    if (!(await assistentePode("avisar_profissional").catch(() => false))) return 0;
    let avisados = 0;
    for (const q of a.quem) {
      // Quem só o tinha em oferta e não quer avisos não é incomodado; quem o tinha atribuído é.
      if (!q.eraDele && !q.avisaPorWhatsApp) continue;
      const telefone = telemovelParaWhatsApp(q.telefone);
      if (!telefone) continue;
      const texto = avisoDeCancelamentoAoProfissional(
        q.profissional,
        { pedidoId: a.pedidoId, servico: a.servico, localidade: a.localidade },
        new Date(),
      );
      /*
       * Um a um, com folga — a fila não serve aqui (só envia a pedidos activos),
       * e vários envios no mesmo segundo do mesmo número são o padrão que faz
       * a Meta banir um número (ver `distribuir-pedido.ts`).
       */
      if (avisados > 0) await new Promise((r) => setTimeout(r, 1500));
      if (await enviarAvisoWhatsApp(telefone, texto).catch(() => false)) avisados += 1;
    }
    return avisados;
  } catch (e) {
    console.error("[avisar-trabalho-clyon] cancelamento", e);
    return 0;
  }
}
