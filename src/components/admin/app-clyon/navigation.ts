export const CLYON_TABS = [
  { id: "visao-geral",   label: "Visão Geral" },
  { id: "pedidos",       label: "Pedidos" },
  { id: "agenda",        label: "Agenda" },
  { id: "profissionais", label: "Profissionais" },
  { id: "contas",        label: "Contas" },
  { id: "pagamentos",    label: "Pagamentos" },
  { id: "cupons",        label: "Cupons" },
  { id: "moedas",        label: "Moedas e preços" },
  { id: "catalogo",      label: "Catálogo" },
  { id: "metricas",      label: "Métricas" },
  { id: "auditoria",     label: "Auditoria" },
] as const;

export type AppClyonTab = (typeof CLYON_TABS)[number]["id"];

export const CLYON_TAB_IDS = CLYON_TABS.map((t) => t.id) as AppClyonTab[];
