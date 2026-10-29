import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Pressable, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "../../componentes/Texto";
import { usePedidos } from "../../estado/Pedidos";
import { quantosComNovidade } from "../../lib/pedidos";
import { CORES, DEGRADE } from "../../tema";

type PropsDoBotao = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: ((e: GestureResponderEvent) => void) | null;
  onLongPress?: ((e: GestureResponderEvent) => void) | null;
  testID?: string;
  "aria-label"?: string;
  "aria-selected"?: boolean;
};

/** O botão de cada separador, sem a «bola» do Android — como na Pro. */
function BotaoDoSeparador(p: PropsDoBotao) {
  return (
    <Pressable
      onPress={p.onPress ?? undefined}
      onLongPress={p.onLongPress ?? undefined}
      testID={p.testID}
      accessibilityRole="tab"
      accessibilityLabel={p["aria-label"]}
      accessibilityState={{ selected: !!p["aria-selected"] }}
      style={({ pressed }) => [p.style, { opacity: pressed ? 0.6 : 1 }]}
    >
      {p.children}
    </Pressable>
  );
}

/** «Pedir», ao meio: a bola com o degradé do topo, um pouco acima da barra (maqueta v3). */
function BotaoDePedir(p: PropsDoBotao) {
  return (
    <Pressable
      onPress={p.onPress ?? undefined}
      accessibilityRole="tab"
      accessibilityLabel="Pedir orçamento"
      accessibilityState={{ selected: !!p["aria-selected"] }}
      style={({ pressed }) => [p.style, { alignItems: "center", justifyContent: "flex-end", opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={{ marginTop: -26, borderRadius: 32, borderWidth: 5, borderColor: CORES.fundo }}>
        <LinearGradient colors={DEGRADE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={30} color={CORES.sobreMarca} />
        </LinearGradient>
      </View>
      <Text style={{ color: CORES.marca, fontSize: 11, fontWeight: "600", marginTop: 2 }} maxFontSizeMultiplier={1}>
        Pedir
      </Text>
    </Pressable>
  );
}

/**
 * OS SEPARADORES — iguais para todos, com ou sem conta (C0 v3; a escolha do
 * dono a 29-10-2026): Início · Serviços · Pedir · Pedidos · Perfil. A app abre
 * sempre no Início, sem ecrã de entrada à frente. O número em «Pedidos» são os
 * pedidos com novidade.
 */
export default function Separadores() {
  const { pedidos } = usePedidos();
  const novidades = quantosComNovidade(pedidos);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: CORES.marca,
        tabBarInactiveTintColor: CORES.suave,
        tabBarStyle: { backgroundColor: CORES.fundo, borderTopColor: CORES.linha, height: 64, paddingTop: 6 },
        sceneStyle: { backgroundColor: CORES.fundo },
        // A barra de baixo não cresce com a letra do sistema: com ela grande, os
        // nomes passavam para duas linhas e tapavam os ícones.
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: { fontSize: 11, fontFamily: "PlusJakartaSans_600SemiBold" },
        tabBarButton: (p) => <BotaoDoSeparador {...p} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Início", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="servicos"
        options={{ title: "Serviços", tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen name="pedir" options={{ title: "Pedir", tabBarButton: (p) => <BotaoDePedir {...p} /> }} />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: "Pedidos",
          tabBarBadge: novidades > 0 ? novidades : undefined,
          tabBarBadgeStyle: { backgroundColor: CORES.mau, fontSize: 10 },
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: "Perfil", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
