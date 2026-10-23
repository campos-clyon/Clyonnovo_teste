import { naMesa, type ConversaNaMesa, type FactosDaConversa } from "./mesa-das-conversas";

/**
 * A MESA DAS CONVERSAS, A PARTIR DA BASE — 21-10-2026.
 *
 * Junta, número a número, o que a mesa precisa de saber (as últimas
 * mensagens, se está entregue, bloqueada, fechada, guardada, a recolha a meio
 * e o pedido) e passa tudo por `naMesa`, que é quem decide. A chave de cada
 * número são os últimos 9 dígitos — o mesmo que a base usa em todo o lado.
 *
 * Desde 23-10-2026 junta também o retrato do telemóvel e os «Já respondi».
 * Só para os números que o site conhece: o telemóvel da CLYON também fala com
 * profissionais, fornecedores e contactos pessoais, e a mesa é dos clientes.
 */

const ultimos9 = (t: string) => t.replace(/\D/g, "").slice(-9);

export type MesaDasConversas = {
  linhas: ConversaNaMesa[];
  /** Há quanto tempo a ponte leu o telemóvel. `null` = nunca. */
  telemovelLidoHaSegundos: number | null;
};

export async function mesaDasConversasWhatsApp(): Promise<ConversaNaMesa[]> {
  return (await mesaComOTelemovelWhatsApp()).linhas;
}

export async function mesaComOTelemovelWhatsApp(): Promise<MesaDasConversas> {
  const db = await import("./db");
  const vazio = { porChave: new Map(), tiradoHaSegundos: null };
  const [factos, entregues, bloqueados, fechadas, guardadas, recolhas, pedidos, leituras, telemovel, respondidas] =
    await Promise.all([
      db.factosDasConversasWhatsApp(),
      db.listarNumerosInterrompidosWhatsApp().catch(() => []),
      db.listarNumerosBloqueadosWhatsApp().catch(() => []),
      db.listarConversasArquivadasWhatsApp().catch(() => []),
      db.listarConversasGuardadasWhatsApp().catch(() => []),
      db.listarRecolhasWhatsAppEmCurso().catch(() => []),
      db.pedidosPorTelefoneWhatsApp().catch(() => new Map()),
      db.leiturasDasConversasWhatsApp().catch(() => new Map()),
      // Sem o retrato, a mesa é a de antes — só o fio do site.
      db.retratoDoTelemovelWhatsApp().catch((e) => {
        console.error("[mesa] o retrato do telemóvel não se leu:", e instanceof Error ? e.message : e);
        return vazio;
      }),
      db.respondidasWhatsApp().catch(() => new Map()),
    ]);

  const entregueDe = new Map(entregues.map((e) => [ultimos9(e.telefone), e] as const));
  const bloqueadoDe = new Set(bloqueados.map((b) => ultimos9(b.telefone)));
  const fechoDe = new Map(fechadas.map((f) => [ultimos9(f.telefone), f] as const));
  const guardadaDe = new Map(guardadas.map((g) => [ultimos9(g.telefone), g] as const));
  const recolhaDe = new Map(recolhas.map((r) => [ultimos9(r.telefone), r] as const));

  // Os números com fio, e os que nunca escreveram mas estão entregues ou
  // bloqueados — sem estes, um bloqueio à mão desaparecia do ecrã.
  const porChave = new Map<string, { telefone: string; f?: (typeof factos)[number] }>();
  for (const f of factos) porChave.set(ultimos9(f.telefone), { telefone: f.telefone, f });
  for (const t of [...entregues, ...bloqueados]) {
    const chave = ultimos9(t.telefone);
    if (!porChave.has(chave)) porChave.set(chave, { telefone: t.telefone });
  }

  const mesa: ConversaNaMesa[] = [];
  for (const [chave, { telefone, f }] of porChave) {
    if (chave.length < 9) continue;
    const fecho = fechoDe.get(chave);
    const pedido = pedidos.get(chave);
    const guardada = guardadaDe.get(chave);
    const ultimoId = Math.max(f?.ultimaEntrada?.id ?? 0, f?.ultimaSaida?.id ?? 0);
    const leitura = leituras.get(chave);
    const factosDaConversa: FactosDaConversa = {
      telefone,
      ultimaEntrada: f?.ultimaEntrada ? { ...f.ultimaEntrada, direccao: "in" } : null,
      ultimaSaida: f?.ultimaSaida ? { ...f.ultimaSaida, direccao: "out" } : null,
      noTelemovel: telemovel.porChave.get(chave) ?? null,
      respondida: respondidas.get(chave) ?? null,
      bloqueada: bloqueadoDe.has(chave),
      entregue: entregueDe.has(chave),
      motivoDaEntrega: entregueDe.get(chave)?.motivo ?? null,
      fecho: fecho
        ? { haSegundos: fecho.haSegundos, quando: fecho.criadoEm, motivo: fecho.motivo, porQuem: fecho.porQuem }
        : null,
      recolha: recolhaDe.has(chave) ? { passo: recolhaDe.get(chave)!.passo } : null,
      pedidoVivo: pedido?.vivo ?? null,
      ultimoPedido: pedido?.ultimo ?? null,
      guardada: guardada ? { nota: guardada.nota, quando: guardada.criadoEm } : null,
      // A leitura da Vitória só vale enquanto não houver mensagem nova.
      leitura:
        leitura && leitura.ateMensagemId >= ultimoId
          ? { estado: leitura.estado, motivo: leitura.motivo, lidaHaSegundos: leitura.lidaHaSegundos }
          : null,
    };
    mesa.push(naMesa(factosDaConversa));
  }
  return { linhas: mesa, telemovelLidoHaSegundos: telemovel.tiradoHaSegundos };
}
