import { Text as TextoNativo, TextInput as CampoNativo, type TextInputProps, type TextProps } from "react-native";
import { useCallback, useRef, type Ref } from "react";
import { useLevarAoTeclado } from "./Teclado";

/**
 * O TEXTO DA APP, COM A LETRA DO TELEMÓVEL MAS COM LIMITE.
 *
 * Muitos profissionais têm a letra do sistema aumentada. Sem limite, os
 * títulos dos cartões passavam para três linhas e os separadores de cima
 * cortavam-se ao meio. Assim a letra cresce com a escolha dele, mas só até
 * 1,2× — o suficiente para ler, sem partir o ecrã.
 *
 * Os ecrãs importam `Text` e `TextInput` daqui, e não de "react-native".
 */
export const LIMITE_DA_LETRA = 1.2;

export function Text(props: TextProps) {
  return <TextoNativo maxFontSizeMultiplier={LIMITE_DA_LETRA} {...props} />;
}

export function TextInput({ onFocus, ref, ...props }: TextInputProps & { ref?: Ref<CampoNativo> }) {
  // Ao ganhar o foco, a rolagem à volta sobe o campo para cima do teclado (Teclado.tsx, 30-10-2026).
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
    />
  );
}
