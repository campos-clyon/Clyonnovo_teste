/**
 * A PURGA DO REGISTO DA VITÓRIA AGENTE — d85 (22-11-2026, CEO e dono).
 *
 * `vitoriaAccoes` e `vitoriaEnsaios` guardam o telefone (em dígitos) e o
 * texto das mensagens — o que o cliente escreveu, o que a assistente teria
 * respondido e o que teria feito. Nasceram sem prazo nenhum; a Política de
 * Privacidade (secção 6) diz que este registo e os testes dela se guardam
 * `DIAS_DE_RETENCAO_DOS_PEDIDOS` dias, como as mensagens do WhatsApp.
 *
 * Corre na purga da noite (`api/cron/purgar-pedidos`), à parte das regras
 * dos pedidos, com o mesmo `PURGA_ARMADA`: a seco (`aSerio: false`) só conta.
 *
 * O custo do agente (o termómetro e o tecto diário) lê só os últimos 32 dias
 * de `vitoriaAccoes` (`chamadasRecentes` em na-base.ts): com um prazo de 60,
 * nada do que ele soma é apagado. O prazo nunca desce abaixo de 32 dias,
 * para que uma mudança à constante não estrague o gasto do mês.
 *
 * A idade conta-se na base: `criadoEm` é escrito pelo relógio dela
 * (CURRENT_TIMESTAMP), e compara-se com o NOW() dela. Aos 5000 de cada vez
 * por tabela; o que sobrar sai na noite seguinte.
 */

import { garantirTabelas } from "./na-base";

/** O que o custo do agente lê para trás (`chamadasRecentes`): o prazo nunca é mais curto. */
export const DIAS_QUE_O_CUSTO_DO_AGENTE_LE = 32;

/** As tabelas da Vitória agente que a purga da noite limpa. */
export const TABELAS_DO_REGISTO_DA_VITORIA_AGENTE = ["vitoriaAccoes", "vitoriaEnsaios"] as const;

export async function purgarRegistoDaVitoriaAgente(dias: number, opcoes: { aSerio?: boolean } = {}): Promise<number> {
  const aSerio = opcoes.aSerio !== false;
  const n = Math.max(DIAS_QUE_O_CUSTO_DO_AGENTE_LE, Math.floor(dias));
  const pool = await garantirTabelas();
  let total = 0;
  for (const tabela of TABELAS_DO_REGISTO_DA_VITORIA_AGENTE) {
    const onde = `${tabela} WHERE criadoEm < NOW() - INTERVAL ${n} DAY`;
    if (!aSerio) {
      const [linhas] = (await pool.execute(`SELECT COUNT(*) AS n FROM ${onde}`)) as [Array<{ n: number | string }>, unknown];
      total += Number(linhas[0]?.n ?? 0);
      continue;
    }
    const [r] = (await pool.execute(`DELETE FROM ${onde} LIMIT 5000`)) as [{ affectedRows?: number }, unknown];
    total += Number(r?.affectedRows ?? 0);
  }
  return total;
}
