import Constants from "expo-constants";
import { router, Stack, useSegments, type ErrorBoundaryProps } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { Platform, Pressable, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text } from "../componentes/Texto";
import { CatalogoProvider } from "../estado/Catalogo";
import { PedidosProvider } from "../estado/Pedidos";
import { SessaoProvider, useSessao } from "../estado/Sessao";
import { SITE } from "../lib/api";
import { contadorDeErros, corpoDoErro, ecraDe, enviarErroDaApp, versaoDaApp } from "../lib/erro-da-app";
import { caminhoDoAviso } from "../lib/links";
import { CORES } from "../tema";

/**
 * A APP DE CLIENTE DA CLYON — d8 (27-10-2026), fase 2 (28-10-2026).
 *
 * Com sessão: os separadores Pedidos · Novo pedido · Conta, e o pedido.
 * Sem sessão: as boas-vindas (E0), entrar (E1) e pedir sem conta (E3).
 * Sempre: os dois ecrãs dos links de clyon.pt (E1a e E1b) — que só abrem com
 * um token que o `+native-intent.tsx` guardou.
 */

const contarOErro = contadorDeErros((corpo) => enviarErroDaApp(SITE, corpo));

/**
 * SE UM ECRÃ REBENTAR — «Algo correu mal. Tentar outra vez.» no lugar do ecrã,
 * e o erro vai ao site, limpo e sem sessão (S3). Cores escritas à mão: aqui
 * não se pode depender de nada que possa ter sido o que rebentou.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const segmentos = useSegments();
  useEffect(() => {
    if (Platform.OS === "web") return;
    try {
      contarOErro(corpoDoErro(error, ecraDe(segmentos), versaoDaApp(Constants.expoConfig?.version, Updates.updateId)));
    } catch {
      /* contar o erro nunca pode ser outro erro */
    }
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", padding: 24, gap: 16 }}>
      <Text style={{ color: "#0F172A", fontSize: 22, fontWeight: "800" }}>Algo correu mal.</Text>
      <Text style={{ color: "#475569", fontSize: 16, lineHeight: 23 }}>
        Os seus pedidos estão guardados no site. Tente outra vez; se voltar a acontecer, fale com a CLYON pelo WhatsApp.
      </Text>
      <Pressable
        onPress={() => void retry()}
        accessibilityRole="button"
        style={({ pressed }) => ({
          backgroundColor: "#0A7C87",
          borderRadius: 12,
          minHeight: 50,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>Tentar outra vez</Text>
      </Pressable>
    </View>
  );
}

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <SessaoProvider>
        <CatalogoProvider>
          <Navegacao />
        </CatalogoProvider>
      </SessaoProvider>
    </SafeAreaProvider>
  );
}

/** Tocar num aviso — com a app fechada ou aberta — abre esse pedido (pelo `pedidoId`, S10). */
function useAbrirAoTocarNoAviso(ligado: boolean) {
  useEffect(() => {
    if (Platform.OS === "web" || !ligado) return;
    const abrir = (r: Notifications.NotificationResponse | null) => {
      if (r) router.push(caminhoDoAviso(r.notification.request.content.data) as never);
    };
    abrir(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => sub.remove();
  }, [ligado]);
}

function Navegacao() {
  const { carregando, ligado, email } = useSessao();
  useAbrirAoTocarNoAviso(ligado);
  if (carregando) return <View style={{ flex: 1, backgroundColor: CORES.fundo }} />;
  return (
    <PedidosProvider activo={ligado} conta={email}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: CORES.fundo },
          headerStyle: { backgroundColor: CORES.fundo },
          headerTintColor: CORES.marca,
          headerTitleStyle: { color: CORES.tinta, fontSize: 17 },
          headerBackTitle: "Voltar",
        }}
      >
        <Stack.Protected guard={ligado}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="pedido/[id]" options={{ headerShown: true, title: "Pedido" }} />
        </Stack.Protected>
        <Stack.Protected guard={!ligado}>
          <Stack.Screen name="bem-vindo" />
          <Stack.Screen name="pedir" options={{ headerShown: true, title: "Pedir orçamento" }} />
        </Stack.Protected>
        {/* Os links de clyon.pt abrem aqui, dentro ou fora da sessão. Por último: nunca são o ecrã de arranque. */}
        {/* Entrar também com sessão: pedir o link de outra conta (o E1a pergunta «Trocar de conta?»). */}
        <Stack.Screen name="entrar/index" options={{ headerShown: ligado, title: "Entrar com outro email" }} />
        <Stack.Screen name="entrar/confirmar" />
        <Stack.Screen name="pedido-do-link" />
      </Stack>
    </PedidosProvider>
  );
}
