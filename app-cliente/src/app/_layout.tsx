import Constants from "expo-constants";
import { router, Stack, useSegments, type ErrorBoundaryProps } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { Poppins_800ExtraBold } from "@expo-google-fonts/poppins/800ExtraBold";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
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
 * v3 (29-10-2026): a app abre SEMPRE no Início, com ou sem conta — os
 * separadores Início · Serviços · Pedir · Pedidos · Perfil são os mesmos para
 * todos (C0). A conta só se pede para enviar um pedido. Com sessão: o pedido
 * (E5). Sem sessão: o pedido aberto pelo link (E5L, convidado). Sempre: a
 * informação útil (I1–I6), o pedido de empresa, entrar (E1) e os dois ecrãs
 * dos links de clyon.pt (E1a e E1b) — que só abrem com um token que o
 * `+native-intent.tsx` guardou.
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
  // As letras do site. Se não carregarem, segue com as do sistema — nunca fica preso.
  const [letras, erroDasLetras] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  useAbrirAoTocarNoAviso(ligado);
  if (carregando || (!letras && !erroDasLetras)) return <View style={{ flex: 1, backgroundColor: CORES.fundo }} />;
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
        <Stack.Screen name="(app)" />
        <Stack.Protected guard={ligado}>
          <Stack.Screen name="pedido/[id]" options={{ headerShown: true, title: "Pedido" }} />
        </Stack.Protected>
        <Stack.Screen name="convidado/[id]" options={{ headerShown: true, title: "Pedido" }} />
        <Stack.Screen name="info/[tema]" options={{ headerShown: true, title: "" }} />
        <Stack.Screen name="juntar/[id]" options={{ headerShown: true, title: "Juntar à conta" }} />
        <Stack.Screen name="empresa" options={{ headerShown: true, title: "Pedido de empresa" }} />
        {/* Os links de clyon.pt abrem aqui, dentro ou fora da sessão. Por último: nunca são o ecrã de arranque. */}
        {/* Entrar também com sessão: pedir o link de outra conta (o E1a pergunta «Trocar de conta?»). */}
        <Stack.Screen name="entrar/index" options={{ headerShown: true, title: ligado ? "Entrar com outro email" : "Entrar" }} />
        <Stack.Screen name="entrar/confirmar" />
        <Stack.Screen name="pedido-do-link" />
      </Stack>
    </PedidosProvider>
  );
}
