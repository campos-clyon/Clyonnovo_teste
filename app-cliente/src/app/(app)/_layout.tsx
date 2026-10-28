import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { usePedidos } from "../../estado/Pedidos";
import { quantosComNovidade } from "../../lib/pedidos";
import { CORES } from "../../tema";

/** O botão de cada separador, sem a «bola» do Android — como na Pro. */
function BotaoDoSeparador(p: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: ((e: GestureResponderEvent) => void) | null;
  onLongPress?: ((e: GestureResponderEvent) => void) | null;
  testID?: string;
  "aria-label"?: string;
  "aria-selected"?: boolean;
}) {
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

/**
 * Os separadores de quem entrou: Pedidos · Novo pedido · Conta. O número em
 * «Pedidos» são os pedidos com novidade (a `novidade` da R4 não nula).
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
        tabBarStyle: { backgroundColor: CORES.fundo, borderTopColor: CORES.linha },
        sceneStyle: { backgroundColor: CORES.fundo },
        // A barra de baixo não cresce com a letra do sistema: com ela grande, os
        // nomes passavam para duas linhas e tapavam os ícones.
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarButton: (p) => <BotaoDoSeparador {...p} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pedidos",
          tabBarBadge: novidades > 0 ? novidades : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="novo"
        options={{
          title: "Novo pedido",
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="conta"
        options={{
          title: "Conta",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
