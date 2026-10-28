import { FlatList, Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./Texto";
import { Botao } from "./ui";
import type { Profissional } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * E6 — AS AVALIAÇÕES DO PROFISSIONAL (folha que sobe).
 *
 * A nota e o número de avaliações, e por cima da lista, como o site: há quanto
 * tempo está na CLYON, onde trabalha e até onde se desloca. Tudo da R5
 * (`profissional`, os mesmos dados do perfil público); os meses já vêm em
 * Lisboa.
 */
export function Avaliacoes({ profissional, aoFechar }: { profissional: Profissional | null; aoFechar: () => void }) {
  const p = profissional;
  return (
    <Modal visible={!!p} animationType="slide" presentationStyle="pageSheet" onRequestClose={aoFechar}>
      <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }}>
        {p ? (
          <FlatList
            data={p.avaliacoes}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
            ListHeaderComponent={
              <View style={{ gap: 6, marginBottom: 8 }}>
                <Text accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 22, fontWeight: "800" }}>
                  {p.nome}
                </Text>
                <Text style={{ color: CORES.tinta, fontSize: 16 }}>{p.notaTexto}</Text>
                {p.naClyonDesdeTexto ? (
                  <Text style={{ color: CORES.suave, fontSize: 14 }}>{`Na CLYON desde ${p.naClyonDesdeTexto}`}</Text>
                ) : null}
                {p.zonas.length > 0 ? (
                  <Text style={{ color: CORES.suave, fontSize: 14 }}>{`Trabalha em ${p.zonas.slice(0, 5).join(", ")}`}</Text>
                ) : null}
                {p.raioKm ? <Text style={{ color: CORES.suave, fontSize: 14 }}>{`desloca-se até ${p.raioKm} km`}</Text> : null}
              </View>
            }
            ListEmptyComponent={<Text style={{ color: CORES.suave, fontSize: 15 }}>Ainda sem avaliações.</Text>}
            renderItem={({ item }) => (
              <View style={{ borderWidth: 1, borderColor: CORES.linha, borderRadius: 12, padding: 14, gap: 4 }}>
                <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "700" }}>
                  {"★".repeat(Math.max(0, Math.min(5, item.estrelas)))}
                  {"☆".repeat(Math.max(0, 5 - Math.min(5, item.estrelas)))}
                </Text>
                {item.comentario ? <Text style={{ color: CORES.tinta, fontSize: 15, lineHeight: 21 }}>{item.comentario}</Text> : null}
                <Text style={{ color: CORES.suave, fontSize: 13 }}>
                  {[item.servico, item.cidade, item.quando].filter(Boolean).join(" · ")}
                </Text>
              </View>
            )}
            ListFooterComponent={
              <View style={{ marginTop: 12 }}>
                <Botao titulo="Fechar" tipo="secundario" aoCarregar={aoFechar} />
              </View>
            }
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
