import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Texto";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/** As peças repetidas da app: botões, caixas, linhas de detalhe e etiquetas. */

export function Botao({
  titulo,
  aoCarregar,
  tipo = "principal",
  ocupado = false,
  desactivado = false,
}: {
  titulo: string;
  aoCarregar: () => void;
  tipo?: "principal" | "secundario" | "perigo";
  ocupado?: boolean;
  desactivado?: boolean;
}) {
  const c = useCores();
  const fundo = tipo === "principal" ? c.marca : "transparent";
  const tinta = tipo === "principal" ? c.sobreMarca : tipo === "perigo" ? c.mau : c.marca;
  const borda = tipo === "principal" ? c.marca : tipo === "perigo" ? c.mau : c.linha;
  const parado = desactivado || ocupado;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: parado, busy: ocupado }}
      onPress={parado ? undefined : aoCarregar}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: fundo, borderColor: borda, opacity: parado ? 0.55 : pressed ? 0.8 : 1 },
      ]}
    >
      {ocupado ? (
        <ActivityIndicator color={tinta} />
      ) : (
        <Text style={[estilos.textoDoBotao, { color: tinta }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Caixa({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  const c = useCores();
  return (
    <View style={[estilos.caixa, { backgroundColor: c.superficie, borderColor: c.linha }, estilo]}>{children}</View>
  );
}

export function TituloDaCaixa({ children }: { children: ReactNode }) {
  const c = useCores();
  return <Text style={[estilos.tituloDaCaixa, { color: c.tinta }]}>{children}</Text>;
}

/** Uma linha «rótulo — valor» do detalhe. Não aparece quando não há valor. */
export function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  const c = useCores();
  if (!valor) return null;
  return (
    <View style={[estilos.linha, { borderColor: c.linha }]}>
      <Text style={[estilos.rotulo, { color: c.suave }]}>{rotulo}</Text>
      <Text style={[estilos.valorDaLinha, { color: c.tinta }]} numberOfLines={3}>
        {valor}
      </Text>
    </View>
  );
}

export function Etiqueta({ texto, tom = "marca" }: { texto: string; tom?: "marca" | "bom" | "aviso" | "mau" | "neutro" }) {
  const c = useCores();
  const cores = {
    marca: [c.marcaSuave, c.marca],
    bom: [c.bomSuave, c.bom],
    aviso: [c.avisoSuave, c.aviso],
    mau: [c.mauSuave, c.mau],
    neutro: [c.fundo, c.suave],
  }[tom];
  return (
    <View style={[estilos.etiqueta, { backgroundColor: cores[0] }]}>
      <Text style={[estilos.textoDaEtiqueta, { color: cores[1] }]}>{texto}</Text>
    </View>
  );
}

export function Mensagem({ texto, tom = "mau" }: { texto: string; tom?: "mau" | "aviso" | "bom" }) {
  const c = useCores();
  const [fundo, tinta] = { mau: [c.mauSuave, c.mau], aviso: [c.avisoSuave, c.aviso], bom: [c.bomSuave, c.bom] }[tom];
  return (
    <View accessibilityRole="alert" style={[estilos.mensagem, { backgroundColor: fundo }]}>
      <Text style={{ color: tinta, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: 46,
    borderRadius: RAIO.m,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ESPACO.l,
  },
  textoDoBotao: { fontSize: LETRA.normal, fontWeight: "700" },
  caixa: { borderWidth: 1, borderRadius: RAIO.l, padding: ESPACO.m + 2, gap: ESPACO.s },
  tituloDaCaixa: { fontSize: LETRA.media, fontWeight: "700", marginBottom: ESPACO.xs },
  linha: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: ESPACO.m,
    paddingVertical: ESPACO.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rotulo: { fontSize: LETRA.pequena + 1, flexShrink: 0 },
  valorDaLinha: { fontSize: LETRA.pequena + 1, fontWeight: "600", flex: 1, textAlign: "right" },
  etiqueta: { paddingHorizontal: ESPACO.s, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  textoDaEtiqueta: { fontSize: 12, fontWeight: "700" },
  mensagem: { borderRadius: RAIO.m, padding: ESPACO.m },
});
