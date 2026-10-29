import * as Updates from "expo-updates";
import { useSegments } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Texto";
import { AVISO_DA_ACTUALIZACAO, deveProcurar, ESPERA_ANTES_DE_RECARREGAR_MS, podeRecarregarAgora } from "../lib/actualizacoes";
import { useCores } from "../tema";

/**
 * A APP PRO ACTUALIZA-SE SOZINHA (29-10-2026) — ver `lib/actualizacoes.ts`.
 *
 * 1. Ao abrir e ao voltar ao primeiro plano: `checkForUpdateAsync` →
 *    `fetchUpdateAsync`. A que o `ON_LOAD` já descarregou ao arrancar também
 *    conta (`isUpdatePending`).
 * 2. Com uma nova pronta: fora dos ecrãs que esperam, mostra «A atualizar a
 *    app…» e recarrega; dentro deles, espera que o profissional saia (uma proposta a meio
 *    nunca se perde).
 * Sem rede, ou sem nada novo, não acontece nada. Nunca no navegador nem em
 * desenvolvimento.
 */
export function ActualizacaoAutomatica() {
  if (Platform.OS === "web" || !Updates.isEnabled || __DEV__) return null;
  return <Vigia />;
}

function Vigia() {
  const segmentos = useSegments() as string[];
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const c = useCores();
  const [aRecarregar, setARecarregar] = useState(false);
  const pronta = useRef(false);
  const aProcurar = useRef(false);
  const ultimaVez = useRef<number | null>(null);
  const ecra = useRef(segmentos);
  ecra.current = segmentos;

  const aplicar = useCallback(() => {
    if (!pronta.current || aRecarregar || !podeRecarregarAgora(ecra.current)) return;
    setARecarregar(true);
    setTimeout(() => {
      Updates.reloadAsync().catch(() => setARecarregar(false));
    }, ESPERA_ANTES_DE_RECARREGAR_MS);
  }, [aRecarregar]);

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
        backgroundColor: c.tinta,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <ActivityIndicator color={c.fundo} />
      <Text style={{ color: c.fundo, fontSize: 14.5, fontWeight: "600" }}>{AVISO_DA_ACTUALIZACAO}</Text>
    </View>
  );
}
