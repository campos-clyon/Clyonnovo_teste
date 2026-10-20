import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ContaProvider } from "../estado/Conta";
import { SessaoProvider, useSessao } from "../estado/Sessao";
import { TrabalhosProvider } from "../estado/Trabalhos";
import { caminhoDe, destinoDoAviso } from "../lib/destino";
import { lerModoGuardado, useCores, useEscuro, useModoLido } from "../tema";

export default function Raiz() {
  useEffect(() => {
    void lerModoGuardado();
  }, []);
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
  const escuro = useEscuro();
  const modoLido = useModoLido();
  useAbrirAoTocarNoAviso(ligado);

  // Espera também pelo modo guardado: sem isso, quem escolheu o azul-noite com
  // o telemóvel em claro via um relance de branco ao abrir.
  if (carregando || !modoLido) return <View style={{ flex: 1, backgroundColor: c.fundo }} />;

  return (
    <TrabalhosProvider activo={ligado}>
      <ContaProvider activo={ligado}>
        <StatusBar style={escuro ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.fundo },
            headerStyle: { backgroundColor: c.superficie },
            headerTintColor: c.marca,
            headerTitleStyle: { color: c.tinta, fontSize: 17 },
            headerBackTitle: "Voltar",
          }}
        >
          <Stack.Protected guard={ligado}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="trabalho/[id]" options={{ headerShown: true, title: "Trabalho" }} />
            {/* A minha conta e a carteira — fase 4: os mesmos ecrãs do menu do painel. */}
            <Stack.Screen name="conta/perfil" options={{ headerShown: true, title: "Perfil" }} />
            <Stack.Screen name="conta/servicos" options={{ headerShown: true, title: "Serviços e raio" }} />
            <Stack.Screen name="conta/faturacao" options={{ headerShown: true, title: "Faturação e IVA" }} />
            <Stack.Screen name="conta/banco" options={{ headerShown: true, title: "Conta bancária" }} />
            <Stack.Screen name="conta/palavra-passe" options={{ headerShown: true, title: "Palavra-passe" }} />
            <Stack.Screen name="conta/avaliacoes" options={{ headerShown: true, title: "Avaliações" }} />
            <Stack.Screen name="conta/como-funciona" options={{ headerShown: true, title: "Como funciona" }} />
            <Stack.Screen name="conta/ajuda" options={{ headerShown: true, title: "Ajuda" }} />
            <Stack.Screen name="carteira/historico" options={{ headerShown: true, title: "Histórico" }} />
          </Stack.Protected>
          <Stack.Protected guard={!ligado}>
            <Stack.Screen name="entrar" />
            <Stack.Screen name="registo" options={{ headerShown: true, title: "Quero ser parceiro" }} />
          </Stack.Protected>
          {/* O link do email da palavra-passe abre aqui, dentro ou fora da sessão. */}
          <Stack.Screen name="definir-senha/[token]" />
        </Stack>
      </ContaProvider>
    </TrabalhosProvider>
  );
}
