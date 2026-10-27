import { Text as TextoNativo, TextInput as CampoNativo, type TextInputProps, type TextProps } from "react-native";

/**
 * O TEXTO DA APP, COM A LETRA DO TELEMÓVEL MAS COM LIMITE.
 *
 * Muita gente tem a letra do sistema aumentada. Sem limite, os
 * títulos dos cartões passavam para três linhas e os separadores de cima
 * cortavam-se ao meio. Assim a letra cresce com a escolha de cada um, mas só até
 * 1,2× — o suficiente para ler, sem partir o ecrã.
 *
 * Os ecrãs importam `Text` e `TextInput` daqui, e não de "react-native".
 */
export const LIMITE_DA_LETRA = 1.2;

export function Text(props: TextProps) {
  return <TextoNativo maxFontSizeMultiplier={LIMITE_DA_LETRA} {...props} />;
}

export function TextInput(props: TextInputProps) {
  return <CampoNativo maxFontSizeMultiplier={LIMITE_DA_LETRA} {...props} />;
}
