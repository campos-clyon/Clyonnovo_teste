import { Resend } from "resend";
import { getPool, ensureNegociacoesTable, ensureProvidersSchema, perfilDoProfissional, registarSemFalhar, appendOrderHistory, getSimulatorOrderById } from "./db";
import { ensureFaturasDoTrabalho } from "./faturas-do-trabalho-na-base";
import { garantirTabelaDasCobrancas } from "./marcas-da-divida-na-base";
import { perfilFiscalDoParceiro } from "./perfil-fiscal";
import { reservasDe } from "./reserva-na-base";
import { acertoDoRegime, fraseDoTotalQueDesceu, ONDE_O_REGIME_SE_PODE_ACERTAR, type AcertoDoRegime } from "./regime-acertado";
import { avisarOClienteDoPedido } from "./avisos-ao-cliente";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { e } from "./escapar-html";
import { BUSINESS_EMAIL } from "./seo-data";

/**
 * ACERTA O REGIME DAS CONTRATADAS DE UM PARCEIRO — d2, 19-11-2026. A regra é
 * `acertoDoRegime` (`regime-acertado.ts`): fica o menor dos dois totais.
 *
 * Chama-se depois de o regime ficar gravado — no perfil dele, quando o confirma
 * (`confirmarRegime`), e na ficha do backoffice, quando o administrador o muda.
 * Para cada negociação que desce: grava o regime novo (só se ainda for o
 * antigo), deixa no registo permanente o antes e o depois, escreve no histórico
 * do pedido e avisa o cliente (push «o preço mudou» e um email com o total
 * novo). Os avisos são automáticos do produto; ao parceiro não se manda nada.
 *
 * NUNCA LANÇA: o perfil já está gravado. Devolve os acertos feitos.
 */
export async function acertarRegimeDasContratadas(
  providerId: number,
  porQuem: { tipo: "profissional" | "clyon"; nome: string },
): Promise<Array<AcertoDoRegime & { negociacaoId: number; pedidoId: number }>> {
  const feitos: Array<AcertoDoRegime & { negociacaoId: number; pedidoId: number }> = [];
  try {
    await ensureProvidersSchema();
    await ensureNegociacoesTable();
    await ensureFaturasDoTrabalho();
    await garantirTabelaDasCobrancas();
    const pool = await getPool();
    if (!pool) return feitos;
    const perfil = await perfilDoProfissional(providerId);
    if (!perfil) return feitos;
    const regimeDoPerfil = perfilFiscalDoParceiro(perfil).regimeParaAConta;
    const [linhas] = (await pool.execute(
      `SELECT n.id, n.pedidoId, n.estado, n.valorAcordado, n.taxaCliente, n.taxaProfissional, n.regimeDoProfissional
         FROM negociacoes n
        WHERE ${ONDE_O_REGIME_SE_PODE_ACERTAR}
          AND n.regimeDoProfissional <> ?
          AND NOT EXISTS (SELECT 1 FROM faturasDoTrabalho f WHERE f.negociacaoId = n.id AND f.activa = 1)
          AND NOT EXISTS (SELECT 1 FROM cobrancasAoProfissional c WHERE c.negociacaoId = n.id AND c.activa = 1)`,
      [providerId, regimeDoPerfil],
    )) as unknown as [Array<Record<string, unknown>>, unknown];
    const lista = Array.isArray(linhas) ? linhas : [];
    if (lista.length === 0) return feitos;
    const reservas = await reservasDe(lista.map((l) => Number(l.id))).catch(() => new Map<number, number>());
    for (const l of lista) {
      const negociacaoId = Number(l.id);
      const pedidoId = Number(l.pedidoId);
      const acerto = acertoDoRegime({ ...l, reservaCent: reservas.get(negociacaoId) ?? null }, regimeDoPerfil);
      if (!acerto?.desceu) continue;
      // Só se ainda estiver como o lemos: dois pedidos ao mesmo tempo não acertam duas vezes.
      const [r] = (await pool.execute(
        "UPDATE negociacoes SET regimeDoProfissional = ? WHERE id = ? AND regimeDoProfissional = ? AND pagoEm IS NULL AND pagamentoDeclaradoEm IS NULL",
        [acerto.regimeDepois, negociacaoId, acerto.regimeAntes],
      )) as unknown as [{ affectedRows?: number }, unknown];
      if (Number(r?.affectedRows ?? 0) === 0) continue;
      feitos.push({ ...acerto, negociacaoId, pedidoId });
      const frase = fraseDoTotalQueDesceu(pedidoId, acerto);
      await registarSemFalhar({
        acontecimento: "regime_acertado",
        pedidoId,
        negociacaoId,
        providerId,
        autorTipo: porQuem.tipo,
        autorNome: porQuem.nome,
        valorCliente: acerto.totalDepois,
        resumo: `Regime de IVA do parceiro confirmado: ${acerto.regimeAntes} → ${acerto.regimeDepois}. ${frase}`,
        detalhe: {
          regimeAntes: acerto.regimeAntes,
          regimeDepois: acerto.regimeDepois,
          totalAntes: acerto.totalAntes,
          totalDepois: acerto.totalDepois,
          regra: "min(total antigo, total novo)",
        },
      });
      await appendOrderHistory(pedidoId, { type: "regime_acertado", by: null, message: frase }).catch(() => {});
      await avisarOClienteDoPedido(pedidoId, "preco_mudou", { negociacaoId });
      await emailDoTotalQueDesceu(pedidoId, frase);
    }
  } catch (err) {
    console.error("[regime-acertado]", providerId, err instanceof Error ? err.message : err);
  }
  return feitos;
}

/** O email ao cliente, pelo email do pedido. Nunca lança. */
async function emailDoTotalQueDesceu(pedidoId: number, frase: string): Promise<boolean> {
  try {
    const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
    if (!chave) return false;
    const pedido = await getSimulatorOrderById(pedidoId);
    const para = (pedido?.contactEmail ?? "").trim();
    if (!para.includes("@")) return false;
    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"><title>O total do seu pedido desceu</title></head>
<body style="margin:0;padding:24px 16px;background:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <div style="color:#00B4CC;font-size:20px;font-weight:700;margin-bottom:16px;">CLYON</div>
    <h1 style="margin:0 0 12px;font-size:20px;color:#0B1929;">O total do seu pedido desceu</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">${e(frase)}</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Não precisa de fazer nada: o pedido já mostra o total novo.</p>
  </div>
</body></html>`;
    const { error } = await new Resend(chave).emails.send({
      from: "CLYON <noreply@clyon.pt>",
      to: para,
      replyTo: BUSINESS_EMAIL,
      subject: `O total do pedido #${pedidoId} desceu — CLYON`,
      html: legivelNoResumo(html),
    });
    return !error;
  } catch (err) {
    console.error("[regime-acertado] email:", err instanceof Error ? err.message : err);
    return false;
  }
}
