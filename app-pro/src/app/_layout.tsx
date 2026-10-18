import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessaoProvider, useSessao } from "../estado/Sessao";
import { TrabalhosProvider } from "../estado/Trabalhos";
import { caminhoDe, destinoDoAviso } from "../lib/destino";
import { useCores } from "../tema";

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <SessaoProvider>
        <Navegacao />
      </SessaoProvider>
    </SafeAreaProvider>
  );
}

/** Quando ele toca num aviso — com a app fechada ou aberta — abre o trabalho. */
function useAbrirAoTocarNoAviso(ligado: boolean) {
  useEffect(() => {
    if (Platform.OS === "web" || !ligado) return;
    const abrir = (r: Notifications.NotificationResponse | null) => {
      if (r) router.push(caminhoDe(destinoDoAviso(r.notification.request.content.data)) as never);
    };
    abrir(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => sub.remove();
  }, [ligado]);
}

function Navegacao() {
  const { carregando, ligado } = useSessao();
  const c = useCores();
  useAbrirAoTocarNoAviso(ligado);

  if (carregando) return <View style={{ flex: 1, backgroundColor: c.fundo }} />;

  return (
    <TrabalhosProvider activo={ligado}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.fundo },
          headerStyle: { backgroundColor: c.superficie },
          headerTintColor: c.marca,
          headerTitleStyle: { color: c.tinta },
        }}
      >
        <Stack.Protected guard={ligado}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="trabalho/[id]" options={{ headerShown: true, title: "Trabalho", headerBackTitle: "Voltar" }} />
        </Stack.Protected>
        <Stack.Protected guard={!ligado}>
          <Stack.Screen name="entrar" />
        </Stack.Protected>
      </Stack>
    </TrabalhosProvider>
  );
}
