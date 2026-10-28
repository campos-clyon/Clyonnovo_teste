import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Aviso, Botao, Carregando, Paragrafo, Titulo } from "../../componentes/ui";
import { VersaoNova } from "../../componentes/VersaoNova";
import { usePedidos } from "../../estado/Pedidos";
import type { PedidoNaLista } from "../../lib/pedidos";
import { CORES } from "../../tema";

/**
 * E2 — OS SEUS PEDIDOS (R4).
 *
 * Um cartão por pedido, todos da mesma altura, uma linha por informação: o
 * serviço, «Pedido #482 · Lisboa», o estado em palavras (`estadoTexto`, a
 * tabela única do site) e, à direita, a novidade (`novidade`) quando há.
 * A ordem é a da API — com novidade em cima, depois a última actividade, os
 * fechados no fim. Sem rede, a última lista guardada, e di-lo.
 */

/** A altura fixa do cartão: a letra cresce até 1,2×, o cartão não. */
const ALTURA_DO_CARTAO = 104;

function CartaoDoPedido({ p }: { p: PedidoNaLista }) {
  const segunda = [`Pedido #${p.id}`, p.cidade].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.servico}, ${segunda}, ${p.estadoTexto}${p.novidade ? `, ${p.novidade}` : ""}`}
      onPress={() => router.push(`/pedido/${p.id}`)}
      style={({ pressed }) => ({
        height: ALTURA_DO_CARTAO,
        borderWidth: 1,
        borderColor: p.novidade ? CORES.marca : CORES.linha,
        borderRadius: 14,
        paddingHorizontal: 16,
        justifyContent: "center",
        gap: 4,
        backgroundColor: CORES.fundo,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flex: 1, color: CORES.tinta, fontSize: 17, fontWeight: "700" }} numberOfLines={1}>
          {p.servico}
        </Text>
        {p.novidade ? (
          <Text style={{ color: CORES.marca, fontSize: 13, fontWeight: "800", maxWidth: 160 }} numberOfLines={1}>
            {p.novidade}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: CORES.suave, fontSize: 14 }} numberOfLines={1}>
        {segunda}
      </Text>
      <Text style={{ color: CORES.tinta, fontSize: 14 }} numberOfLines={1}>
        {p.estadoTexto}
      </Text>
    </Pressable>
  );
}

export default function OsSeusPedidos() {
  const { pedidos, aLer, erro, guardadaEm, haMais, recarregar, maisUma } = usePedidos();

  if (aLer && pedidos.length === 0 && !erro) return <Carregando />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right"]}>
      <FlatList
        data={pedidos}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <CartaoDoPedido p={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        getItemLayout={(_, i) => ({ length: ALTURA_DO_CARTAO + 10, offset: (ALTURA_DO_CARTAO + 10) * i, index: i })}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={aLer} onRefresh={() => void recarregar()} tintColor={CORES.marca} />}
        onEndReached={() => {
          if (haMais) void maisUma();
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 16 }}>
            <VersaoNova />
            <Titulo>Os seus pedidos</Titulo>
            {guardadaEm ? <Aviso tom="aviso" texto="Sem ligação — a mostrar o que tinha guardado." /> : null}
            {erro ? (
              <View style={{ gap: 10 }}>
                <Aviso tom="mau" texto={erro} />
                <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={() => void recarregar()} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          erro ? null : (
            <View style={{ gap: 14 }}>
              <Paragrafo>Ainda não tem pedidos.</Paragrafo>
              <Botao titulo="Pedir orçamento" aoCarregar={() => router.push("/novo")} />
              <Paragrafo pequeno suave>
                Fez o pedido pelo WhatsApp? Abra o link do pedido neste telemóvel para o juntar aqui.
              </Paragrafo>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
