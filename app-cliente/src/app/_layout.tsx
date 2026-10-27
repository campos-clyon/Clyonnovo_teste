import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessaoProvider, useSessao } from "../estado/Sessao";
import { CORES } from "../tema";

/**
 * A APP DE CLIENTE DA CLYON — decisão d8 (27-10-2026).
 *
 * Primeiro passo: entrar (E1). Os outros ecrãs (pedidos, novo pedido, conta)
 * chegam com as rotas R4–R9 do site.
 */
export default function Raiz() {
  return (
    <SafeAreaProvider>
      <SessaoProvider>
        <Navegacao />
      </SessaoProvider>
    </SafeAreaProvider>
  );
}

function Navegacao() {
  const { carregando, ligado } = useSessao();
  if (carregando) return <View style={{ flex: 1, backgroundColor: CORES.fundo }} />;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: CORES.fundo } }}>
        <Stack.Protected guard={ligado}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!ligado}>
          <Stack.Screen name="entrar/index" />
        </Stack.Protected>
        {/* O link do email (`/entrar/link?t=…`) abre aqui, dentro ou fora da sessão. */}
        <Stack.Screen name="entrar/link" />
      </Stack>
    </>
  );
}
