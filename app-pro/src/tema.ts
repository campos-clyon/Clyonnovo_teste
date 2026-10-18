import { useColorScheme } from "react-native";

/**
 * As cores da CLYON Pro — o ciano da marca, as mesmas famílias do painel no
 * navegador. Claro e escuro, porque o profissional abre a app às seis da manhã
 * dentro da carrinha.
 *
 * O ESCURO É O AZUL-NOITE DO ÍCONE (18-10-2026, pedido do dono): o mesmo
 * #0F172A do fundo do ícone, do ecrã de arranque e do rodapé do site — abrir a
 * app não dá um salto de cor. Os botões levam o ciano do site (#22D3EE).
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
  fundo: "#0F172A",
  superficie: "#1E293B",
  tinta: "#E2E8F0",
  suave: "#94A3B8",
  linha: "#334155",
  marca: "#22D3EE",
  marcaSuave: "#133D51",
  sobreMarca: "#0F172A",
  bom: "#5CC488",
  bomSuave: "#0E3B2E",
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
/** Tamanhos pensados para um telemóvel de 360–400 px de largura, com a letra do sistema até 1,2×. */
export const LETRA = { pequena: 12, normal: 15, media: 16, titulo: 20, grande: 24 } as const;
