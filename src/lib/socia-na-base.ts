import { listarAssistentes } from "./assistentes";
import type { PeriodoDaSocia } from "./financas-do-mes";

/**
 * Os períodos das contas de assistente que ganham sobre todos os trabalhos (a
 * sócia), como os Assistentes os calculam. Servem as Finanças e o Início
 * (d56). Se a leitura falhar, `null` — o ecrã diz que não se sabe.
 */
export async function periodosDaSocia(): Promise<PeriodoDaSocia[] | null> {
  try {
    const { assistentes } = await listarAssistentes();
    return assistentes
      .filter((a) => a.activo && a.comissaoSobre === "todos")
      .flatMap((a) =>
        a.comissoes.periodos.map((p) => ({
          nome: a.nome,
          assistenteId: a.id,
          percentagem: p.comissaoPercent,
          inicio: p.inicio,
          fim: p.fim,
          rotulo: p.rotulo,
          estado: p.estado,
          lucro: p.lucro,
          comissao: p.comissaoAssistente,
          pendentes: p.pendentes.length,
        })),
      );
  } catch (e) {
    console.error("[sócia] períodos", e);
    return null;
  }
}
