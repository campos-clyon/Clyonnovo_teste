import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useTrabalhos } from "../../estado/Trabalhos";
import { novosPorAbrir } from "../../lib/trabalhos";
import { useCores } from "../../tema";

/**
 * Os separadores de baixo. Nesta fase: Trabalhos e Conta. A agenda, os ganhos
 * e o perfil entram nas fases seguintes, com o desenho de cinco separadores.
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
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
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
        name="conta"
        options={{
          title: "Conta",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
