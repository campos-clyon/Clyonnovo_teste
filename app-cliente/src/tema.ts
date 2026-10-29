/**
 * As cores da app de cliente — as do site (globals.css) e das maquetas v3
 * aprovadas pelo dono a 29-10-2026: o ciano de acção, o ciano claro
 * (#2BB8D4 / #4FC3DC) com muito branco à volta, e uma cor por serviço (os tons do backoffice).
 *
 * Fundo branco, como o ícone (o «S» em fundo branco, decisão de 18-10-2026;
 * o Pro é o mesmo «S» em azul-noite). Só claro nesta versão.
 */
export const CORES = {
  fundo: "#FFFFFF",
  superficie: "#F4F8FB",
  tinta: "#0B1929",
  suave: "#5A6B78",
  linha: "#E2EEF3",
  linhaForte: "#CCDCE4",
  marca: "#007A8C",
  marcaSuave: "#E7F9FB",
  azul: "#0062C4",
  sobreMarca: "#FFFFFF",
  sobreMarcaSuave: "rgba(255,255,255,0.88)",
  vidro: "rgba(255,255,255,0.16)",
  vidroLinha: "rgba(255,255,255,0.34)",
  estrela: "#F2A21B",
  bom: "#047857",
  bomSuave: "#ECFDF5",
  aviso: "#B45309",
  avisoSuave: "#FFFBEB",
  mau: "#B42318",
  mauSuave: "#FEF3F2",
  whatsapp: "#25D366",
  whatsappTinta: "#062A33",
  whatsappSuave: "#E8FAEF",
  /** O ciano claro da imagem de referência (dono, 29-10-2026): o botão «Pedir» e os realces. */
  ciano: "#2BB8D4",
  cianoClaro: "#4FC3DC",
  cianoFundo: "#EEF9FC",
  /** Os ícones finos da barra de baixo que não estão escolhidos. */
  icone: "#94A3B8",
} as const;

/**
 * O degradé do botão «Pedir»: ciano claro → ciano (29-10-2026). O ciano →
 * azul-escuro de antes pesava demasiado; o topo do Início já não o usa.
 */
export const DEGRADE = [CORES.cianoClaro, CORES.ciano] as const;

/** Um tom por serviço: a cor forte e o fundo claro. */
export type Tom = { forte: string; claro: string };
const TONS = {
  ciano: { forte: "#007A8C", claro: "#E7F9FB" },
  azul: { forte: "#1D4ED8", claro: "#EFF6FF" },
  violeta: { forte: "#6D28D9", claro: "#F5F3FF" },
  coral: { forte: "#BE123C", claro: "#FFF1F2" },
  laranja: { forte: "#C2410C", claro: "#FFF7ED" },
  ambar: { forte: "#B45309", claro: "#FFFBEB" },
  esmeralda: { forte: "#047857", claro: "#ECFDF5" },
  ardosia: { forte: "#475569", claro: "#F1F5F9" },
} as const satisfies Record<string, Tom>;

/** O tom e o ícone (Ionicons) de cada serviço, pelo id do simulador. Um serviço novo cai no ardósia. */
const POR_SERVICO: Readonly<Record<string, { tom: keyof typeof TONS; icone: string }>> = {
  recolha_moveis: { tom: "ciano", icone: "bed-outline" },
  recolha_monos: { tom: "azul", icone: "cube-outline" },
  recolha_entulho: { tom: "laranja", icone: "construct-outline" },
  esvaziamento_casa: { tom: "violeta", icone: "home-outline" },
  esvaziamento_apartamento: { tom: "coral", icone: "business-outline" },
  mudanca: { tom: "esmeralda", icone: "car-outline" },
  manutencao_casa: { tom: "ambar", icone: "hammer-outline" },
  outro: { tom: "ardosia", icone: "ellipsis-horizontal-circle-outline" },
};

export function aparenciaDoServico(id: string | null | undefined): { tom: Tom; icone: string } {
  const a = (id && POR_SERVICO[id]) || { tom: "ardosia" as const, icone: "ellipsis-horizontal-circle-outline" };
  return { tom: TONS[a.tom], icone: a.icone };
}

/** As letras do site: Poppins nos títulos, Plus Jakarta Sans no texto (carregadas no _layout). */
export const LETRAS = {
  titulo: "Poppins_700Bold",
  tituloForte: "Poppins_800ExtraBold",
  tituloMedio: "Poppins_600SemiBold",
  texto: "PlusJakartaSans_400Regular",
  textoMedio: "PlusJakartaSans_500Medium",
  textoSemi: "PlusJakartaSans_600SemiBold",
  textoForte: "PlusJakartaSans_700Bold",
} as const;
