import { useState } from "react";
import { FlatList, Image, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "./Texto";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * AS FOTOGRAFIAS DO PEDIDO EM ECRÃ INTEIRO.
 *
 * Tocar numa fotografia abre-as todas aqui, a começar por essa, e passa-se de
 * uma para a outra com o dedo. Antes abria o navegador com uma fotografia só,
 * e para ver a seguinte era preciso voltar atrás.
 */
export function VerFotografias({
  fotos,
  inicio,
  aoFechar,
}: {
  fotos: string[];
  /** A fotografia em que ele tocou; `null` fecha o visor. */
  inicio: number | null;
  aoFechar: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const margens = useSafeAreaInsets();
  const [actual, setActual] = useState(inicio ?? 0);

  return (
    <Modal visible={inicio != null} animationType="fade" onRequestClose={aoFechar} statusBarTranslucent>
      <View style={estilos.fundo}>
        <FlatList
          data={fotos}
          keyExtractor={(u) => u}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={inicio ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setActual(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: "center" }}>
              <Image source={{ uri: item }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
            </View>
          )}
        />
        <View style={[estilos.barra, { paddingTop: margens.top + 8 }]}>
          <Text style={estilos.conta}>
            {fotos.length > 1 ? `${actual + 1} de ${fotos.length}` : ""}
          </Text>
          <Pressable accessibilityRole="button" onPress={aoFechar} style={estilos.fechar} hitSlop={12}>
            <Text style={estilos.textoFechar}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: "#000000" },
  barra: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  conta: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  fechar: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)" },
  textoFechar: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
