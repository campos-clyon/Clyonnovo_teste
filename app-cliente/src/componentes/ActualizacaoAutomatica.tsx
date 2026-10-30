import * as Updates from "expo-updates";
import { useSegments } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Texto";
import { AVISO_DA_ACTUALIZACAO, deveProcurar, ESPERA_ANTES_DE_RECARREGAR_MS, podeRecarregarAgora } from "../lib/actualizacoes";
import { CORES } from "../tema";

/**
 * A APP ACTUALIZA-SE SOZINHA (29-10-2026) — ver `lib/actualizacoes.ts`.
 *
 * 1. Ao abrir e ao voltar ao primeiro plano: `checkForUpdateAsync` →
 *    `fetchUpdateAsync`. A que o `ON_LOAD` já descarregou ao arrancar também
 *    conta (`isUpdatePending`).
 * 2. Com uma nova pronta: fora dos ecrãs que esperam, mostra «A atualizar a
 *    app…» e recarrega; dentro deles, espera que o cliente saia.
 * Sem rede, ou sem nada novo, não acontece nada. Nunca no navegador nem em
 * desenvolvimento.
 *
 * PERGUNTA ANTES (dono, 30-10-2026): com uma nova pronta aparece um aviso
 * grande, por cima da app — «Atualizar agora» ou «Mais tarde». «Mais tarde»
 * deixa usar a versão de agora e volta a perguntar da próxima vez que a app
 * abrir (`adiadaNestaSessao` vive só enquanto a app está aberta).
 */
let adiadaNestaSessao = false;
export function ActualizacaoAutomatica() {
  if (Platform.OS === "web" || !Updates.isEnabled || __DEV__) return null;
  return <Vigia />;
}

function Vigia() {
  const segmentos = useSegments() as string[];
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const [aRecarregar, setARecarregar] = useState(false);
  const [aPerguntar, setAPerguntar] = useState(false);
  const pronta = useRef(false);
  const aProcurar = useRef(false);
  const ultimaVez = useRef<number | null>(null);
  const ecra = useRef(segmentos);
  ecra.current = segmentos;

  const aplicar = useCallback(() => {
    if (!pronta.current || aRecarregar || adiadaNestaSessao || !podeRecarregarAgora(ecra.current)) return;
    setAPerguntar(true);
  }, [aRecarregar]);

  const actualizarAgora = () => {
    setAPerguntar(false);
    setARecarregar(true);
    setTimeout(() => {
      Updates.reloadAsync().catch(() => setARecarregar(false));
    }, ESPERA_ANTES_DE_RECARREGAR_MS);
  };
  const maisTarde = () => {
    adiadaNestaSessao = true;
    setAPerguntar(false);
  };

  const procurar = useCallback(async () => {
    if (aProcurar.current) return;
    if (pronta.current) return aplicar();
    const agora = Date.now();
    if (!deveProcurar(ultimaVez.current, agora)) return;
    ultimaVez.current = agora;
    aProcurar.current = true;
    try {
      const c = await Updates.checkForUpdateAsync();
      if (c.isAvailable) {
        const f = await Updates.fetchUpdateAsync();
        if (f.isNew) pronta.current = true;
      }
    } catch {
      /* sem rede ou o servidor em baixo: tenta-se na próxima vez que a app voltar */
    } finally {
      aProcurar.current = false;
    }
    aplicar();
  }, [aplicar]);

  // Ao abrir, e sempre que volta ao primeiro plano.
  useEffect(() => {
    void procurar();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void procurar();
    });
    return () => sub.remove();
  }, [procurar]);

  // A que o arranque já descarregou (ON_LOAD) também se aplica.
  useEffect(() => {
    if (isUpdatePending) {
      pronta.current = true;
      aplicar();
    }
  }, [isUpdatePending, aplicar]);

  // Saiu do simulador (ou de outro ecrã que espera): aplica a que estava à espera.
  const chave = segmentos.join("/");
  useEffect(() => {
    aplicar();
  }, [chave, aplicar]);

  if (aPerguntar) {
    return (
      <Modal transparent animationType="fade" visible onRequestClose={maisTarde} statusBarTranslucent navigationBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.55)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ alignSelf: "stretch", maxWidth: 380, backgroundColor: CORES.fundo, borderRadius: 22, padding: 22, gap: 14 }}>
            <Text style={{ color: CORES.tinta, fontSize: 20, fontWeight: "800" }}>Há uma atualização da app</Text>
            <Text style={{ color: CORES.suave, fontSize: 15, lineHeight: 21 }}>
              A versão nova traz melhorias e correções. Demora só uns segundos.
            </Text>
            <Pressable
              onPress={actualizarAgora}
              accessibilityRole="button"
              style={({ pressed }) => ({ backgroundColor: CORES.marca, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.8 : 1 })}
            >
              <Text style={{ color: CORES.sobreMarca, fontSize: 16, fontWeight: "800" }}>Atualizar agora</Text>
            </Pressable>
            <Pressable
              onPress={maisTarde}
              accessibilityRole="button"
              style={({ pressed }) => ({ borderRadius: 14, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>Mais tarde</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }
  if (!aRecarregar) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        top: insets.top + 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: CORES.tinta,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <ActivityIndicator color={CORES.sobreMarca} />
      <Text style={{ color: CORES.sobreMarca, fontSize: 14.5, fontWeight: "600" }}>{AVISO_DA_ACTUALIZACAO}</Text>
    </View>
  );
}
