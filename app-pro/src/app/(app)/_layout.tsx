import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { useTrabalhos } from "../../estado/Trabalhos";
import { novosPorAbrir } from "../../lib/trabalhos";
import { useCores } from "../../tema";

/**
 * O botão de cada separador, SEM a «bola» do Android — 18-10-2026.
 *
 * O de origem desenha um círculo sem limites (`android_ripple` borderless) a
 * preto a 32 %, que no azul-noite parecia uma mancha a crescer por cima da
 * barra. Este só escurece um pouco enquanto o dedo está em cima.
 */
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
 * Os separadores de baixo — os do menu do painel: Trabalhos, Agenda, Carteira
 * e, em Conta, tudo o que no painel é «A minha conta» (fase 4, 18-10-2026).
 */
export default function Separadores() {
  const c = useCores();
  const { trabalhos } = useTrabalhos();
  // Só os que ainda não abriu: um pedido visto deixa de ser novidade.
  const novos = novosPorAbrir(trabalhos);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.marca,
        tabBarInactiveTintColor: c.suave,
        tabBarStyle: { backgroundColor: c.superficie, borderTopColor: c.linha },
        sceneStyle: { backgroundColor: c.fundo },
        // A barra de baixo não cresce com a letra do sistema: com ela grande, os
        // nomes passavam para duas linhas e tapavam os ícones.
        tabBarAllowFontScaling: false,
        // Com o teclado aberto a barra sai, para não ficar por cima do campo (30-10-2026).
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarButton: (p) => <BotaoDoSeparador {...p} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trabalhos",
          tabBarBadge: novos > 0 ? novos : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="carteira"
        options={{
          title: "Carteira",
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={color} size={size} />,
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
