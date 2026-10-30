import { StyleSheet, Text as TextoNativo, TextInput as CampoNativo, type TextInputProps, type TextProps, type TextStyle } from "react-native";
import { useCallback, useRef, type Ref } from "react";
import { LETRAS } from "../tema";
import { useLevarAoTeclado } from "./Teclado";

/**
 * O TEXTO DA APP, COM A LETRA DO TELEMÓVEL MAS COM LIMITE.
 *
 * Muita gente tem a letra do sistema aumentada. Sem limite, os
 * títulos dos cartões passavam para três linhas e os separadores de cima
 * cortavam-se ao meio. Assim a letra cresce com a escolha de cada um, mas só até
 * 1,2× — o suficiente para ler, sem partir o ecrã.
 *
 * A letra é a do site (v3, 29-10-2026): Plus Jakarta Sans no texto, pelo peso
 * que o estilo pede; `titulo` passa à Poppins. Sem as letras carregadas, o
 * Android usa a do sistema — nada parte.
 *
 * Os ecrãs importam `Text` e `TextInput` daqui, e não de "react-native".
 */
export const LIMITE_DA_LETRA = 1.2;

function familia(peso: TextStyle["fontWeight"], titulo: boolean): string {
  const n = typeof peso === "number" ? peso : peso === "bold" ? 700 : Number(peso) || 400;
  if (titulo) return n >= 800 ? LETRAS.tituloForte : n >= 700 ? LETRAS.titulo : LETRAS.tituloMedio;
  if (n >= 700) return LETRAS.textoForte;
  if (n >= 600) return LETRAS.textoSemi;
  if (n >= 500) return LETRAS.textoMedio;
  return LETRAS.texto;
}

function comLetra(style: TextProps["style"], titulo: boolean): TextStyle {
  const s = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (s.fontFamily) return s;
  // Com uma letra própria, o peso vai no nome da família: o Android ignora o fontWeight.
  const { fontWeight, ...resto } = s;
  return { ...resto, fontFamily: familia(fontWeight, titulo) };
}

export function Text({ titulo = false, style, ...props }: TextProps & { titulo?: boolean }) {
  return <TextoNativo maxFontSizeMultiplier={LIMITE_DA_LETRA} {...props} style={comLetra(style, titulo)} />;
}

export function TextInput({ style, onFocus, ref, ...props }: TextInputProps & { ref?: Ref<CampoNativo> }) {
  // Ao ganhar o foco, a rolagem à volta sobe o campo para cima do teclado (Teclado.tsx).
  const levarAoTeclado = useLevarAoTeclado();
  const proprio = useRef<CampoNativo | null>(null);
  const juntar = useCallback(
    (no: CampoNativo | null) => {
      proprio.current = no;
      if (typeof ref === "function") ref(no);
      else if (ref) (ref as { current: CampoNativo | null }).current = no;
    },
    [ref],
  );
  return (
    <CampoNativo
      maxFontSizeMultiplier={LIMITE_DA_LETRA}
      {...props}
      ref={juntar}
      onFocus={(e) => {
        levarAoTeclado(proprio.current);
        onFocus?.(e);
      }}
      style={comLetra(style, false)}
    />
  );
}
