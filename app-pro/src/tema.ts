import { useColorScheme } from "react-native";

/**
 * As cores da CLYON Pro — o ciano da marca sobre um fundo levemente esverdeado,
 * as mesmas famílias do painel no navegador. Claro e escuro, porque o
 * profissional abre a app às seis da manhã dentro da carrinha.
 */
const CLARO = {
  fundo: "#F2F6F6",
  superficie: "#FFFFFF",
  tinta: "#132321",
  suave: "#546965",
  linha: "#D5DFDD",
  marca: "#0A7C87",
  marcaSuave: "#E0F1F2",
  sobreMarca: "#FFFFFF",
  bom: "#2A7849",
  bomSuave: "#E3F2E8",
  aviso: "#9A6500",
  avisoSuave: "#FBEFD6",
  mau: "#AD3A29",
  mauSuave: "#F8E4E0",
};

const ESCURO: typeof CLARO = {
  fundo: "#0D1615",
  superficie: "#15211F",
  tinta: "#E3EEEC",
  suave: "#9BB0AC",
  linha: "#293A37",
  marca: "#4CC5D0",
  marcaSuave: "#0F3539",
  sobreMarca: "#0D1615",
  bom: "#5CC488",
  bomSuave: "#13301F",
  aviso: "#F0B43A",
  avisoSuave: "#382A0C",
  mau: "#F07B67",
  mauSuave: "#3A1A15",
};

export type Cores = typeof CLARO;

export function useCores(): Cores {
  return useColorScheme() === "dark" ? ESCURO : CLARO;
}

export const ESPACO = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const RAIO = { s: 6, m: 10, l: 14 } as const;
export const LETRA = { pequena: 13, normal: 16, media: 18, titulo: 24, grande: 30 } as const;
