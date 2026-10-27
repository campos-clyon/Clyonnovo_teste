import { ActivityIndicator, Pressable, View, type ViewStyle } from "react-native";
import { Text } from "./Texto";
import { CORES } from "../tema";

/**
 * Botões só com opacidade ao tocar, sem a «bola» do Android (como na Pro).
 */
export function Botao({
  titulo,
  aoCarregar,
  tipo = "principal",
  ocupado = false,
  desligado = false,
}: {
  titulo: string;
  aoCarregar: () => void;
  tipo?: "principal" | "secundario";
  ocupado?: boolean;
  desligado?: boolean;
}) {
  const principal = tipo === "principal";
  const inactivo = ocupado || desligado;
  return (
    <Pressable
      onPress={inactivo ? undefined : aoCarregar}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: ocupado }}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        backgroundColor: principal ? CORES.marca : CORES.fundo,
        borderWidth: principal ? 0 : 1,
        borderColor: CORES.linha,
        opacity: inactivo ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {ocupado ? (
        <ActivityIndicator color={principal ? CORES.sobreMarca : CORES.marca} />
      ) : (
        <Text style={{ color: principal ? CORES.sobreMarca : CORES.marca, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

export function Aviso({ texto, tom }: { texto: string; tom: "bom" | "mau" }) {
  const estilo: ViewStyle = {
    backgroundColor: tom === "bom" ? CORES.bomSuave : CORES.mauSuave,
    borderRadius: 12,
    padding: 14,
  };
  return (
    <View style={estilo} accessibilityLiveRegion="polite">
      <Text style={{ color: tom === "bom" ? CORES.bom : CORES.mau, fontSize: 15, lineHeight: 21 }}>{texto}</Text>
    </View>
  );
}
