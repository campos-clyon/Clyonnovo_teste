import {
  appendOrderHistory,
  negociacoesDoPedido,
  perfilDoProfissional,
  quemTemOTrabalhoClyon,
  registarSemFalhar,
  trabalhosClyonComOPrecoNoCliente,
  updateSimulatorOrder,
} from "./db";
import { clienteRespondeu, ficaSemEfeito, HORAS_PARA_O_CLIENTE_RESPONDER } from "./prazo-do-cliente-clyon";
import { avisarProfissionalSemOTrabalhoPorPush } from "./avisar-por-push";
import { avisarSemEfeitoDoTrabalhoClyon } from "./avisar-trabalho-clyon";
import { dataEHora } from "./historico-negociacao";

/**
 * A ROTINA DOS TRABALHOS CLYON SEM RESPOSTA DO CLIENTE — 28-10-2026 (d12).
 *
 * De hora a hora, no padrão de «Pedidos abertos voltam a procurar
 * profissionais»: cada Trabalho CLYON com o preço no cliente há 72 horas, sem
 * profissional escolhido e com quem tenha aceitado (`ficaSemEfeito`), passa
 * para os Arquivados — como o «Arquivar» dos Trabalhos CLYON, que encerra as
 * negociações vivas — e quem aceitou é avisado: no telemóvel (app ou
 * navegador) e, a quem quer avisos, no WhatsApp.
 *
 * Desde 31-10-2026 (d2): um pedido em que o cliente respondeu — «Aceito este
 * preço», uma mensagem no WhatsApp depois do preço, ou a conversa passada a
 * uma pessoa — não se arquiva (vai ao «Por decidir» da Mesa, com o selo); e
 * um que esta rotina já arquivou e a equipa restaurou não volta a levar o
 * «sem efeito». Ver `ficaSemEfeito`.
 *
 * Um pedido que falhe não pára os outros. Se a leitura das respostas falhar,
 * a passagem não arquiva nenhum (falha fechada).
 */
export type ResultadoDaRotina = {
  arquivados: number[];
  avisados: number;
  falhados: number;
  /** Com o preço no cliente e resposta dele: a rotina não lhes toca, ficam no «Por decidir». */
  clienteRespondeu?: number[];
};

export async function arquivarTrabalhosClyonSemResposta(agora: Date = new Date()): Promise<ResultadoDaRotina> {
  const r: ResultadoDaRotina = { arquivados: [], avisados: 0, falhados: 0, clienteRespondeu: [] };
  const candidatos = await trabalhosClyonComOPrecoNoCliente();

  for (const p of candidatos) {
    try {
      const negs = await negociacoesDoPedido(p.id);
      const t = {
        valorFixoClyon: p.valorFixoClyon,
        estadoDoPedido: p.status,
        propostaEnviadaEm: p.propostaEnviadaEm,
        negociacoes: negs.map((n) => ({ estado: String(n.estado) })),
        precoAceiteEm: p.precoAceiteEm ?? null,
        ultimaMensagemDoClienteEm: p.ultimaMensagemDoClienteEm ?? null,
        passadaAUmaPessoaEm: p.passadaAUmaPessoaEm ?? null,
        semEfeitoAvisadoEm: p.semEfeitoAvisadoEm ?? null,
      };
      if (clienteRespondeu(t)) {
        r.clienteRespondeu!.push(p.id);
        continue;
      }
      if (!ficaSemEfeito(t, agora)) continue;

      // Quem aceitou — lido ANTES de arquivar, que encerra as negociações.
      const aceitaram = negs.filter((n) => n.estado === "aguarda_contratacao");
      const ids = new Set(aceitaram.map((n) => Number(n.id)));
      const comTelefone = (await quemTemOTrabalhoClyon(p.id)).vivos.filter((v) => ids.has(v.negociacaoId));

      await updateSimulatorOrder(p.id, { status: "arquivado" });
      r.arquivados.push(p.id);

      let avisados = 0;
      for (const n of aceitaram) {
        try {
          const perfil = await perfilDoProfissional(Number(n.providerId));
          const email = typeof perfil?.email === "string" ? perfil.email : null;
          if (!email) continue;
          await avisarProfissionalSemOTrabalhoPorPush({
            email,
            pedidoId: p.id,
            negociacaoId: Number(n.id),
            porque: "sem_resposta",
          });
          avisados += 1;
        } catch (err) {
          console.error("[arquivar-sem-resposta] aviso não saiu:", err);
        }
      }
      await avisarSemEfeitoDoTrabalhoClyon({
        pedidoId: p.id,
        servico: p.serviceType,
        localidade: p.city,
        quem: comTelefone,
      });
      r.avisados += avisados;

      const resumo =
        `Arquivado sozinho: o preço foi ao cliente a ${dataEHora(p.propostaEnviadaEm)} e ele não respondeu ` +
        `em ${HORAS_PARA_O_CLIENTE_RESPONDER} horas. ` +
        `${aceitaram.length} ${aceitaram.length === 1 ? "profissional tinha aceitado e foi avisado" : "profissionais tinham aceitado e foram avisados"}.`;
      await appendOrderHistory(p.id, { type: "archived", by: null, message: resumo });
      await registarSemFalhar({
        acontecimento: "negociacao_encerrada",
        pedidoId: p.id,
        autorTipo: "sistema",
        autorNome: "prazo do cliente",
        resumo,
      });
    } catch (err) {
      r.falhados += 1;
      console.error("[arquivar-sem-resposta] pedido", p.id, err);
    }
  }
  return r;
}

/** Uma linha para o registo e para o carimbo da rotina. */
export function resumoDaRotina(r: ResultadoDaRotina): string {
  if (r.arquivados.length === 0) return r.falhados > 0 ? `${r.falhados} falhado(s)` : "nada a arquivar";
  return (
    `${r.arquivados.length} Trabalho(s) CLYON sem resposta do cliente arquivado(s) ` +
    `(#${r.arquivados.join(", #")}) — ${r.avisados} profissional(is) avisado(s)` +
    (r.falhados > 0 ? ` · ${r.falhados} falhado(s)` : "")
  );
}
