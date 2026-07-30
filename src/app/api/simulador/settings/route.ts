import { NextResponse } from "next/server";
import { getSimulatorSettings } from "@/lib/db";

/**
 * Tabela de preços que o simulador do site precisa para calcular a estimativa
 * no browser.
 *
 * ⚠️ Esta rota é PÚBLICA e devolvia a tabela de configuração INTEIRA — o que
 * incluía `custo_km`, `custo_hora_pessoa`, `overhead_por_servico`,
 * `num_pessoas_equipa` e a margem. Isso é a estrutura de custos da CLYON: com
 * ela, qualquer pessoa — um concorrente, sobretudo — calcula ao cêntimo
 * quanto se ganha em cada serviço, e a que preço se pode ir abaixo.
 *
 * Passa a sair só o que o simulador usa de facto para somar o preço ao
 * cliente. Confirmado uma a uma contra SimuladorClient.tsx: nenhuma chave de
 * custo interno é lida no browser.
 */
const CHAVES_PUBLICAS = new Set([
  "moveis_item_pequeno",
  "moveis_item_medio",
  "moveis_item_grande",
  "moveis_distancia_km",
  "moveis_carga_base",
  "moveis_carga_multiplicador",
  "entulho_saco_ensacado",
  "entulho_saco_chao",
  "entulho_distancia_km",
  "entulho_multiplicador",
  "mudancas_distancia_km",
  "mudancas_multiplicador",
  "apartamento_com_elevador_por_andar",
  "apartamento_sem_elevador_por_andar",
  "acesso_dificil_extra",
  "hora_base",
]);

export async function GET() {
  try {
    const settings = await getSimulatorSettings();
    return NextResponse.json({
      settings: settings
        .filter((item) => CHAVES_PUBLICAS.has(item.key))
        // `description` e `label` são notas internas de quem configurou os
        // preços — não têm de sair para a internet.
        .map((item) => ({
          key: item.key,
          category: item.category,
          unit: item.unit,
          value: item.value,
        })),
    });
  } catch (error) {
    console.error("[Simulador Settings] Failed to load settings", error);
    return NextResponse.json({ error: "Nao foi possivel carregar as configuracoes." }, { status: 500 });
  }
}
