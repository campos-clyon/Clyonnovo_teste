import { FlatList, Image, Modal, Pressable, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./Texto";
import { CORES } from "../tema";

/** Uma fila de miniaturas; tocar abre em ecrã inteiro, a passar para o lado (como na Pro). */
export function Miniaturas({ fotos, aoAbrir }: { fotos: string[]; aoAbrir: (i: number) => void }) {
  if (fotos.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {fotos.map((f, i) => (
        <Pressable
          key={`${f}-${i}`}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Fotografia ${i + 1} de ${fotos.length}`}
          onPress={() => aoAbrir(i)}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Image source={{ uri: f }} style={{ width: 84, height: 84, borderRadius: 10, backgroundColor: CORES.superficie }} />
        </Pressable>
      ))}
    </View>
  );
}

export function VerFotografias({ fotos, aberta, aoFechar }: { fotos: string[]; aberta: number | null; aoFechar: () => void }) {
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={aberta !== null} animationType="fade" onRequestClose={aoFechar}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
        <Pressable
          accessibilityRole="button"
          onPress={aoFechar}
          style={({ pressed }) => ({ padding: 16, alignSelf: "flex-end", opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Fechar</Text>
        </Pressable>
        {aberta !== null ? (
          <FlatList
            data={fotos}
            horizontal
            pagingEnabled
            initialScrollIndex={aberta}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(f, i) => `${f}-${i}`}
            renderItem={({ item }) => (
              <View style={{ width, justifyContent: "center" }}>
                <Image source={{ uri: item }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
              </View>
            )}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
