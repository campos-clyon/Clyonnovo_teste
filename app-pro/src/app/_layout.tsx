import Constants from "expo-constants";
import { router, Stack, useSegments, type ErrorBoundaryProps } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { Platform, Pressable, View } from "react-native";
import { ActualizacaoAutomatica } from "../componentes/ActualizacaoAutomatica";
import { Text } from "../componentes/Texto";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ContaProvider } from "../estado/Conta";
import { SessaoProvider, useSessao } from "../estado/Sessao";
import { TrabalhosProvider } from "../estado/Trabalhos";
import { SITE } from "../lib/api";
import { EM_DEMO } from "../lib/demo";
import { caminhoDe, destinoDoAviso } from "../lib/destino";
import { tirarDestino } from "../lib/destino-pendente";
import { contadorDeErros, corpoDoErro, ecraDe, enviarErroDaApp, versaoDaApp } from "../lib/erro-da-app";
import { lerModoGuardado, useCores, useEscuro, useModoLido } from "../tema";

/**
 * SE UM ECRÃ REBENTAR — versão 13.
 *
 * Sem isto, um erro num ecrã fechava a app inteira e ele ficava sem saber
 * porquê. O Expo Router mostra este ecrã no lugar do que falhou, com «Tentar
 * outra vez»; uma correcção chega depois pelo EAS Update, sem passar pela loja.
 * Cores escritas à mão de propósito: aqui não se pode depender de nada que
 * possa ter sido o que rebentou.
 *
 * E A EQUIPA FICA A SABER (25-10-2026, d13): o erro vai para o site — a
 * versão, o ecrã pelo nome da rota, a mensagem limpa e quando —, sem sessão
 * e sem dados de pessoas, uma vez por erro, e em silêncio se não houver rede
 * (`lib/erro-da-app.ts`). Na demonstração do navegador não sai nada.
 */
const contarOErro = contadorDeErros((corpo) => enviarErroDaApp(SITE, corpo));

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const segmentos = useSegments();
  // Só quando o erro muda: o mesmo ecrã de erro a redesenhar-se não conta outra vez.
  useEffect(() => {
    if (EM_DEMO || Platform.OS === "web") return;
    try {
      contarOErro(corpoDoErro(error, ecraDe(segmentos), versaoDaApp(Constants.expoConfig?.version, Updates.updateId)));
    } catch {
      /* contar o erro nunca pode ser outro erro */
    }
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center", padding: 24, gap: 16 }}>
      <Text style={{ color: "#F1F5F9", fontSize: 22, fontWeight: "800" }}>Algo correu mal neste ecrã</Text>
      <Text style={{ color: "#CBD5E1", fontSize: 16, lineHeight: 23 }}>
        Os seus trabalhos estão guardados no site. Tente outra vez; se voltar a acontecer, diga-nos o que estava a fazer.
      </Text>
      <Text style={{ color: "#64748B", fontSize: 12 }}>{error.message}</Text>
      <Pressable
        onPress={() => void retry()}
        accessibilityRole="button"
        style={({ pressed }) => ({ backgroundColor: "#22D3EE", borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 })}
      >
        <Text style={{ color: "#0F172A", fontSize: 16, fontWeight: "800" }}>Tentar outra vez</Text>
      </Pressable>
    </View>
  );
}

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

/**
 * O LINK QUE CHEGOU SEM SESSÃO ABRE-SE LOGO A SEGUIR A ENTRAR — 29-10-2026
 * (A12). `+native-intent.tsx` guardou o caminho; aqui, quando a sessão passa
 * de fora para dentro, tira-o e abre-o. Ao arrancar já com sessão o link abriu
 * sozinho e nada ficou guardado.
 */
function useAbrirOLinkDepoisDeEntrar(carregando: boolean, ligado: boolean) {
  const antes = useRef<boolean | null>(null);
  useEffect(() => {
    if (carregando) return;
    const entrouAgora = antes.current === false && ligado;
    antes.current = ligado;
    if (!entrouAgora) return;
    const caminho = tirarDestino();
    // Depois de o Stack trocar os ecrãs fechados pelos abertos.
    if (caminho) setTimeout(() => router.push(caminho as never), 0);
  }, [carregando, ligado]);
}

function Navegacao() {
  const { carregando, ligado } = useSessao();
  const c = useCores();
  const escuro = useEscuro();
  const modoLido = useModoLido();
  useAbrirAoTocarNoAviso(ligado);
  useAbrirOLinkDepoisDeEntrar(carregando, ligado);

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
            {/* O link de um pedido (WhatsApp, email) — versão 12. */}
            <Stack.Screen name="abrir/[token]" options={{ headerShown: true, title: "Pedido" }} />
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
            <Stack.Screen name="repor" options={{ headerShown: true, title: "Repor a palavra-passe" }} />
          </Stack.Protected>
          {/* O link do email da palavra-passe abre aqui, dentro ou fora da sessão. */}
          <Stack.Screen name="definir-senha/[token]" />
        </Stack>
        {/* As correcções chegam sozinhas, sem perder uma proposta a meio (29-10-2026). */}
        <ActualizacaoAutomatica />
      </ContaProvider>
    </TrabalhosProvider>
  );
}
