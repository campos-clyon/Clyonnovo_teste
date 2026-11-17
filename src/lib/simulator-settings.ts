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
  | "mudanca_km_limite_recolha"
  // O motor de custos (d61, 16-11-2026) — custo-do-trabalho.ts. Só o admin as muda.
  | "consumo_l_100km"
  | "desgaste_por_km"
  | "custo_hora_equipa_1"
  | "custo_hora_equipa_2"
  | "custo_hora_equipa_3"
  | "motor_custo_por_saida"
  | "motor_margem_parceiro"
  | "motor_velocidade_sem_medida"
  | "motor_minutos_fixos_no_local"
  | "motor_minutos_na_deposicao"
  | "motor_minutos_por_peca_na_deposicao"
  | "motor_enchimento_util"
  | "motor_tecto_fator"
  | "motor_chao_fator"
  | "moveis_carga_adicional_fator"
  | "motor_preco_de_uma_carga"
  | "deposicao_valorsul_eur_t"
  | "deposicao_amarsul_eur_t"
  | "deposicao_provisoria_eur_t"
  | "deposicao_minimo_por_entrega"
  | "portagem_ponte_25_abril"
  | "portagem_ponte_vasco_da_gama";

export type SimulatorSettingDefinition = {
  key: SimulatorSettingKey;
  label: string;
  description: string;
  category: "moveis" | "entulho" | "mudancas" | "acessos" | "geral" | "motor";
  unit: "eur" | "multiplier";
  value: number;
};

export const defaultSimulatorSettings: SimulatorSettingDefinition[] = [
  {
    key: "moveis_item_pequeno",
    label: "Móvel pequeno",
    description: "Valor por unidade para peça pequena.",
    category: "moveis",
    unit: "eur",
    value: 5,
  },
  {
    key: "moveis_item_medio",
    label: "Móvel médio",
    description: "Valor por unidade para peça média.",
    category: "moveis",
    unit: "eur",
    value: 7,
  },
  {
    key: "moveis_item_grande",
    label: "Móvel grande",
    description: "Valor por unidade para peça grande.",
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
    description: "Acréscimo por andar com elevador.",
    category: "acessos",
    unit: "eur",
    value: 3,
  },
  {
    key: "apartamento_sem_elevador_por_andar",
    label: "Apartamento sem elevador",
    description: "Acréscimo por andar sem elevador.",
    category: "acessos",
    unit: "eur",
    value: 6,
  },
  {
    key: "acesso_dificil_extra",
    label: "Extra por acesso difícil",
    description: "Acréscimo fixo para acessos complexos.",
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
    description: "Margem final do cálculo de entulho.",
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
    description: "Valor fixo pago a cada assistente por trabalho agendado/atribuído. Cada assistente recebe este valor individualmente (ex.: 2 assistentes = 2 × valor).",
    category: "geral",
    unit: "eur",
    value: 7.00,
  },
  /*
   * SAÍRAM «Mudança 2 colaboradores 50 €/h», «3 colaboradores 70 €/h» e
   * «Mínimo de horas» — 27-10-2026 (d12). Nada os lia, e contradiziam a
   * regra pública (50 €/h pela equipa de 3, mínimo 3 horas): quem os mudava
   * aqui não mudava nada. O preço das mudanças está em tabela-das-mudancas.ts.
   */
  {
    key: "mudanca_km_limite_recolha",
    label: "Limite de distância para recolhas (km)",
    description: "Distância máxima aceitável para recolhas sem orçamento personalizado. Mudanças não têm limite.",
    category: "geral",
    unit: "multiplier",
    value: 70,
  },
  {
    key: "consumo_l_100km",
    label: "Consumo da carrinha (l/100 km)",
    description: "Litros de gasóleo por 100 km de uma carrinha de 3,5 t. Com o preço do gasóleo, dá o combustível de cada km.",
    category: "motor",
    unit: "multiplier",
    value: 10,
  },
  {
    key: "desgaste_por_km",
    label: "Desgaste por km",
    description: "Pneus, manutenção, seguro e amortização por km, sem o gasóleo.",
    category: "motor",
    unit: "eur",
    value: 0.29,
  },
  {
    key: "custo_hora_equipa_1",
    label: "Custo por hora — 1 pessoa",
    description: "O que custa uma hora de uma equipa de 1 pessoa (o condutor).",
    category: "motor",
    unit: "eur",
    value: 15,
  },
  {
    key: "custo_hora_equipa_2",
    label: "Custo por hora — 2 pessoas",
    description: "O que custa uma hora de uma equipa de 2 pessoas.",
    category: "motor",
    unit: "eur",
    value: 27,
  },
  {
    key: "custo_hora_equipa_3",
    label: "Custo por hora — 3 pessoas",
    description: "O que custa uma hora de uma equipa de 3 pessoas.",
    category: "motor",
    unit: "eur",
    value: 39,
  },
  {
    key: "motor_custo_por_saida",
    label: "Custo por saída",
    description: "Uma vez por trabalho: sair, preparar, voltar a arrumar.",
    category: "motor",
    unit: "eur",
    value: 15,
  },
  {
    key: "motor_margem_parceiro",
    label: "Margem do parceiro",
    description: "Sobre o custo, antes da taxa da plataforma. 0,25 = 25 %.",
    category: "motor",
    unit: "multiplier",
    value: 0.25,
  },
  {
    key: "motor_velocidade_sem_medida",
    label: "Velocidade sem medida (km/h)",
    description: "Só quando a distância não foi medida pela estrada: km a dividir por esta velocidade.",
    category: "motor",
    unit: "multiplier",
    value: 35,
  },
  {
    key: "motor_minutos_fixos_no_local",
    label: "Minutos fixos no local",
    description: "Chegar, estacionar e conferir, uma vez por trabalho.",
    category: "motor",
    unit: "multiplier",
    value: 10,
  },
  {
    key: "motor_minutos_na_deposicao",
    label: "Minutos na deposição, por carga",
    description: "Descarga e talão, por cada carga.",
    category: "motor",
    unit: "multiplier",
    value: 15,
  },
  {
    key: "motor_minutos_por_peca_na_deposicao",
    label: "Minutos na deposição, por peça",
    description: "A mais por cada peça descarregada.",
    category: "motor",
    unit: "multiplier",
    value: 1,
  },
  {
    key: "motor_enchimento_util",
    label: "Enchimento útil da carrinha",
    description: "A fracção da carrinha que se aproveita. 0,85 = 85 %.",
    category: "motor",
    unit: "multiplier",
    value: 0.85,
  },
  {
    key: "motor_tecto_fator",
    label: "Tecto da grelha (fator)",
    description: "Numa grelha de valor único, o tecto é o valor vezes isto.",
    category: "motor",
    unit: "multiplier",
    value: 1.3,
  },
  {
    key: "motor_chao_fator",
    label: "Chão da grelha (fator)",
    description: "Numa grelha de valor único, o chão é o valor vezes isto.",
    category: "motor",
    unit: "multiplier",
    value: 0.9,
  },
  {
    key: "moveis_carga_adicional_fator",
    label: "Carga a mais (fator)",
    description: "Cada carga a mais vale esta fracção da primeira. 0,70 = 70 %.",
    category: "motor",
    unit: "multiplier",
    value: 0.7,
  },
  {
    key: "motor_preco_de_uma_carga",
    label: "Preço de uma carga cheia",
    description: "O limite da soma por peça a partir de uma carga cheia. 0 = ainda sem valor: não limita.",
    category: "motor",
    unit: "eur",
    value: 0,
  },
  {
    key: "deposicao_valorsul_eur_t",
    label: "Deposição Valorsul (€/t)",
    description: "Lisboa, Amadora, Loures, Odivelas e Vila Franca de Xira.",
    category: "motor",
    unit: "eur",
    value: 85.64,
  },
  {
    key: "deposicao_amarsul_eur_t",
    label: "Deposição Amarsul (€/t)",
    description: "Almada, Seixal, Sesimbra, Barreiro, Moita, Montijo, Alcochete, Palmela e Setúbal.",
    category: "motor",
    unit: "eur",
    value: 85,
  },
  {
    key: "deposicao_provisoria_eur_t",
    label: "Deposição a confirmar (€/t)",
    description: "Cascais, Oeiras, Sintra e Mafra, provisório até as Finanças confirmarem.",
    category: "motor",
    unit: "eur",
    value: 85,
  },
  {
    key: "deposicao_minimo_por_entrega",
    label: "Deposição: mínimo por entrega",
    description: "O valor mínimo de cada descarga. 0 = só o peso.",
    category: "motor",
    unit: "eur",
    value: 0,
  },
  {
    key: "portagem_ponte_25_abril",
    label: "Portagem Ponte 25 de Abril (classe 2)",
    description: "Cobrada de sul para norte.",
    category: "motor",
    unit: "eur",
    value: 4.85,
  },
  {
    key: "portagem_ponte_vasco_da_gama",
    label: "Portagem Ponte Vasco da Gama (classe 2)",
    description: "Cobrada de sul para norte.",
    category: "motor",
    unit: "eur",
    value: 7.55,
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

/**
 * OS VALORES POR OMISSÃO QUE A BASE AINDA NÃO TEM COMO NO CÓDIGO — 07-10-2026.
 *
 * A linha que falta, ou aquela cujo rótulo, categoria, unidade ou descrição
 * ficou diferente do que está escrito acima. O VALOR não conta: é o que o
 * backoffice edita, e o arranque nunca lhe toca.
 *
 * Em regime normal devolve uma lista vazia — que é o que deixa de pôr vinte e
 * oito gravações à frente de cada leitura dos preços (ver
 * `ensureSimulatorSettingsTable`).
 */
export function defaultsPorGravar(
  naBase: Array<{
    key: string;
    label?: unknown;
    category?: unknown;
    unit?: unknown;
    description?: unknown;
  }>,
  defaults: SimulatorSettingDefinition[] = defaultSimulatorSettings,
): SimulatorSettingDefinition[] {
  const porChave = new Map(naBase.map((l) => [String(l.key), l]));
  return defaults.filter((d) => {
    const l = porChave.get(d.key);
    return (
      !l ||
      l.label !== d.label ||
      l.category !== d.category ||
      l.unit !== d.unit ||
      (l.description ?? null) !== d.description
    );
  });
}
