export type SimulatorSettingKey =
  | "moveis_item_pequeno"
  | "moveis_item_medio"
  | "moveis_item_grande"
  | "moveis_distancia_km"
  | "moveis_carga_base"
  | "moveis_carga_multiplicador"
  | "entulho_saco_ensacado"
  | "entulho_saco_chao"
  | "entulho_distancia_km"
  | "mudancas_distancia_km"
  | "apartamento_com_elevador_por_andar"
  | "apartamento_sem_elevador_por_andar"
  | "acesso_dificil_extra"
  | "hora_base"
  | "entulho_multiplicador"
  | "mudancas_multiplicador"
  // Estrutura de custos reais (fórmula comercial)
  | "custo_km"
  | "custo_hora_pessoa"
  | "num_pessoas_equipa"
  | "overhead_por_servico"
  | "margem_lucro"
  | "diesel_preco"
  | "km_por_litro"
  | "pagamento_assistente_por_trabalho"
  // Mudanças — preçário horário comercial (o que o cliente paga)
  | "mudanca_2pessoas_hora"
  | "mudanca_3pessoas_hora"
  | "mudanca_minimo_horas"
  | "mudanca_km_limite_recolha";

export type SimulatorSettingDefinition = {
  key: SimulatorSettingKey;
  label: string;
  description: string;
  category: "moveis" | "entulho" | "mudancas" | "acessos" | "geral";
  unit: "eur" | "multiplier";
  value: number;
};

export const defaultSimulatorSettings: SimulatorSettingDefinition[] = [
  {
    key: "moveis_item_pequeno",
    label: "Movel pequeno",
    description: "Valor por unidade para peca pequena.",
    category: "moveis",
    unit: "eur",
    value: 5,
  },
  {
    key: "moveis_item_medio",
    label: "Movel medio",
    description: "Valor por unidade para peça média.",
    category: "moveis",
    unit: "eur",
    value: 7,
  },
  {
    key: "moveis_item_grande",
    label: "Movel grande",
    description: "Valor por unidade para peca grande.",
    category: "moveis",
    unit: "eur",
    value: 13,
  },
  {
    key: "moveis_distancia_km",
    label: "Custo por km em móveis",
    description: "Peso da distância para recolha de móveis.",
    category: "moveis",
    unit: "eur",
    value: 2.5,
  },
  {
    key: "moveis_carga_base",
    label: "Base por carga",
    description: "Base operacional para modo por carga.",
    category: "moveis",
    unit: "eur",
    value: 2,
  },
  {
    key: "moveis_carga_multiplicador",
    label: "Multiplicador por carga",
    description: "Margem aplicada ao modo por carga.",
    category: "moveis",
    unit: "multiplier",
    value: 0.35,
  },
  {
    key: "entulho_saco_ensacado",
    label: "Preço por saco já ensacado",
    description: "Valor por saco quando o entulho já está em sacos (padrão). 3,00€/saco.",
    category: "entulho",
    unit: "eur",
    value: 3.00,
  },
  {
    key: "entulho_saco_chao",
    label: "Preço por saco no chão/por ensacar",
    description: "Valor por saco sem elevador ou acesso difícil (agravamento). 3,20€/saco.",
    category: "entulho",
    unit: "eur",
    value: 3.20,
  },
  {
    key: "entulho_distancia_km",
    label: "Custo por km em entulho",
    description: "Peso da distância para entulho (€/km).",
    category: "entulho",
    unit: "eur",
    value: 2,
  },
  {
    key: "mudancas_distancia_km",
    label: "Custo por km em mudanças",
    description: "Peso da distância em mudanças e camião com motorista.",
    category: "mudancas",
    unit: "eur",
    value: 2.5,
  },
  {
    key: "apartamento_com_elevador_por_andar",
    label: "Apartamento com elevador",
    description: "Acrescimo por andar com elevador.",
    category: "acessos",
    unit: "eur",
    value: 3,
  },
  {
    key: "apartamento_sem_elevador_por_andar",
    label: "Apartamento sem elevador",
    description: "Acrescimo por andar sem elevador.",
    category: "acessos",
    unit: "eur",
    value: 6,
  },
  {
    key: "acesso_dificil_extra",
    label: "Extra por acesso dificil",
    description: "Acrescimo fixo para acessos complexos.",
    category: "acessos",
    unit: "eur",
    value: 30,
  },
  {
    key: "hora_base",
    label: "Hora base por pessoa",
    description: "Valor base por hora e por pessoa.",
    category: "geral",
    unit: "eur",
    value: 9,
  },
  {
    key: "entulho_multiplicador",
    label: "Multiplicador entulho",
    description: "Margem final do calculo de entulho.",
    category: "entulho",
    unit: "multiplier",
    value: 1.3,
  },
  {
    key: "mudancas_multiplicador",
    label: "Multiplicador mudanças",
    description: "Margem final do cálculo de mudanças.",
    category: "mudancas",
    unit: "multiplier",
    value: 1.4,
  },
  // ── Estrutura de custos reais (fórmula comercial com margem) ──────────────
  {
    key: "custo_km",
    label: "Custo por km (combustível)",
    description: "Custo real por km (combustível + desgaste veículo): 0,50€/km.",
    category: "geral",
    unit: "eur",
    value: 0.50,
  },
  {
    key: "custo_hora_pessoa",
    label: "Custo por hora por pessoa",
    description: "Custo interno de cada membro da equipa por hora.",
    category: "geral",
    unit: "eur",
    value: 9,
  },
  {
    key: "num_pessoas_equipa",
    label: "Número de pessoas na equipa",
    description: "Equipa fixa: motorista + ajudante + 3ª unidade (veículo).",
    category: "geral",
    unit: "multiplier",
    value: 3,
  },
  {
    key: "overhead_por_servico",
    label: "Overhead por serviço",
    description: "Custos fixos mensais rateados por serviço = 17,00€ por serviço.",
    category: "geral",
    unit: "eur",
    value: 17.00,
  },
  {
    key: "margem_lucro",
    label: "Margem de lucro (%)",
    description: "Percentagem de lucro obrigatória sobre o custo total. 0.50 = 50%.",
    category: "geral",
    unit: "multiplier",
    value: 0.50,
  },
  {
    key: "diesel_preco",
    label: "Preço do diesel (€/litro)",
    description: "Preço fixo do diesel usado para calcular custo de combustível.",
    category: "geral",
    unit: "eur",
    value: 2.00,
  },
  {
    key: "km_por_litro",
    label: "Km por litro do veículo",
    description: "Consumo do veículo: 1 litro a cada X km. Motor 1.3 = 6 km/litro.",
    category: "geral",
    unit: "multiplier",
    value: 6,
  },
  {
    key: "pagamento_assistente_por_trabalho",
    label: "Pagamento por trabalho (€/assistente)",
    description: "Valor fixo pago a cada assistente por trabalho agendado/atribuído. Cada assistente recebe este valor individualmente (ex: 2 assistentes = 2 × valor).",
    category: "geral",
    unit: "eur",
    value: 7.00,
  },
  // ── Mudanças — preçário horário comercial ──────────────────────────────────
  {
    key: "mudanca_2pessoas_hora",
    label: "Mudança 2 colaboradores (€/hora)",
    description: "Taxa horária total para mudanças com 2 colaboradores. Mínimo 3 horas.",
    category: "mudancas",
    unit: "eur",
    value: 50.00,
  },
  {
    key: "mudanca_3pessoas_hora",
    label: "Mudança 3 colaboradores (€/hora)",
    description: "Taxa horária total para mudanças com 3 colaboradores. Mínimo 3 horas.",
    category: "mudancas",
    unit: "eur",
    value: 70.00,
  },
  {
    key: "mudanca_minimo_horas",
    label: "Mínimo de horas por mudança",
    description: "Número mínimo de horas faturadas numa mudança (independente da duração real).",
    category: "mudancas",
    unit: "multiplier",
    value: 3,
  },
  {
    key: "mudanca_km_limite_recolha",
    label: "Limite de distância para recolhas (km)",
    description: "Distância máxima aceitável para recolhas sem orçamento personalizado. Mudanças não têm limite.",
    category: "geral",
    unit: "multiplier",
    value: 70,
  },
];

export type SimulatorSettingsMap = Record<SimulatorSettingKey, number>;

export function createSimulatorSettingsMap(
  values?: Array<{ key: string; value: string | number }>,
): SimulatorSettingsMap {
  const map = Object.fromEntries(
    defaultSimulatorSettings.map((setting) => [setting.key, setting.value]),
  ) as SimulatorSettingsMap;

  for (const item of values ?? []) {
    if (item.key in map) {
      const parsed = Number(item.value);
      if (Number.isFinite(parsed)) {
        map[item.key as SimulatorSettingKey] = parsed;
      }
    }
  }

  return map;
}
