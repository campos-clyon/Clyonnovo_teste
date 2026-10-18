import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useTrabalhos } from "../../estado/Trabalhos";
import { contarPorSeparador } from "../../lib/trabalhos";
import { useCores } from "../../tema";

/**
 * Os separadores de baixo. Nesta fase: Trabalhos e Conta. A agenda, os ganhos
 * e o perfil entram nas fases seguintes, com o desenho de cinco separadores.
 */
export default function Separadores() {
  const c = useCores();
  const { trabalhos } = useTrabalhos();
  const novos = contarPorSeparador(trabalhos).novos;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.marca,
        tabBarInactiveTintColor: c.suave,
        tabBarStyle: { backgroundColor: c.superficie, borderTopColor: c.linha },
        sceneStyle: { backgroundColor: c.fundo },
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
