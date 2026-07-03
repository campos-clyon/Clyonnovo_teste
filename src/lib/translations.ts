/**
 * Traduções centralizadas dos valores internos para português.
 * Usar em todo o backoffice: tabs Geral, Cliente, Morada, Serviço e Fotos,
 * emails, mensagens WhatsApp e qualquer outro lugar onde os valores aparecem.
 */

export const FIELD_TRANSLATIONS: Record<string, Record<string, string>> = {
  elevator: {
    yes:     "Sim, funciona",
    small:   "Sim, mas é pequeno",
    no:      "Não tem",
    unknown: "Não informado",
    // legado
    sim:     "Sim",
    nao:     "Não",
  },
  parking: {
    door:      "Mesmo à porta",
    under_20m: "Sim, até 20 metros",
    over_30m:  "Mais de 30 metros",
    difficult:  "Estacionamento difícil",
    unknown:   "Não informado",
    // legado
    porta:   "À porta",
    proximo: "Próximo (até 50m)",
    medio:   "Médio (50-200m)",
    longe:   "Longe (mais de 200m)",
  },
  urgency: {
    today:     "Hoje",
    tomorrow:  "Amanhã",
    this_week: "Esta semana",
    flexible:  "Flexível",
    normal:    "Normal",
    no:        "Sem urgência",
    // legado
    urgente:  "Urgente",
    flexivel: "Flexível",
  },
  serviceType: {
    recolha_moveis:           "Recolha de móveis",
    recolha_monos:            "Recolha de monos",
    recolha_entulho:          "Recolha de entulho",
    esvaziamento_casa:        "Esvaziamento de casa",
    esvaziamento_apartamento: "Esvaziamento de apartamento",
    mudanca:                  "Mudança",
    outro:                    "Outro serviço",
  },
  floor: {
    // Valores internos do simulador
    "res_do_chao":   "Rés-do-chão",
    "rés-do-chão":   "Rés-do-chão",
    "res-do-chao":   "Rés-do-chão",
    "rdc":           "Rés-do-chão",
    "rc":            "Rés-do-chão",
    "0":             "Rés-do-chão",
    "1":             "1º Andar",
    "1º":            "1º Andar",
    "primeiro":      "1º Andar",
    "2":             "2º Andar",
    "2º":            "2º Andar",
    "segundo":       "2º Andar",
    "3":             "3º Andar",
    "3º":            "3º Andar",
    "terceiro":      "3º Andar",
    "4":             "4º Andar",
    "4º":            "4º Andar",
    "quarto":        "4º Andar",
    "5":             "5º Andar ou superior",
    "5º":            "5º Andar ou superior",
    "4º+":           "4º Andar ou superior",
  },
  entulhoState: {
    ensacado: "Ensacado",
    chao:     "No chão",
    misto:    "Misto",
    unknown:  "Não informado",
  },
  priority: {
    baixa:   "Baixa",
    normal:  "Normal",
    alta:    "Alta",
    urgente: "Urgente",
  },
  needsDismantling: {
    no:      "Não precisa",
    simple:  "Simples",
    medium:  "Média",
    complex: "Complexa",
    unknown: "Não informado",
  },
};

/**
 * Traduz um valor interno para português.
 * Se o campo ou valor não existir no mapa, devolve o valor original.
 * Se o valor for null/undefined/"", devolve "Não informado".
 */
export function translate(
  field: keyof typeof FIELD_TRANSLATIONS | string,
  value: string | null | undefined
): string {
  if (!value) return "Não informado";
  return FIELD_TRANSLATIONS[field]?.[value] ?? value;
}

/**
 * Atalhos para os campos mais usados no backoffice.
 */
export const tElevator        = (v?: string | null) => translate("elevator",         v);
export const tParking         = (v?: string | null) => translate("parking",          v);
export const tUrgency         = (v?: string | null) => translate("urgency",          v);
export const tService         = (v?: string | null) => translate("serviceType",      v);
export const tFloor           = (v?: string | null) => translate("floor",            v);
export const tEntulho         = (v?: string | null) => translate("entulhoState",     v);
export const tPriority        = (v?: string | null) => translate("priority",         v);
export const tNeedsDismantling = (v?: string | null) => translate("needsDismantling", v);
