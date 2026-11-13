import * as Updates from "expo-updates";
import { useSegments } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Texto";
import { marcarNotaVista, useNotaDaAtualizacao } from "./Novidades";
import { AVISO_DA_ACTUALIZACAO, deveProcurar, ESPERA_ANTES_DE_RECARREGAR_MS, podeRecarregarAgora } from "../lib/actualizacoes";
import { useCores } from "../tema";

/**
 * A APP PRO ACTUALIZA-SE SOZINHA (29-10-2026) — ver `lib/actualizacoes.ts`.
 *
 * 1. Ao abrir e ao voltar ao primeiro plano: `checkForUpdateAsync` →
 *    `fetchUpdateAsync`. A que o `ON_LOAD` já descarregou ao arrancar também
 *    conta (`isUpdatePending`).
 * 2. Com uma nova pronta, fora dos ecrãs que esperam (uma proposta a meio
 *    nunca se perde), PERGUNTA ANTES — 02-11-2026 (dono, como a app de
 *    cliente): «Há uma versão nova» — «Atualizar agora» recarrega logo;
 *    «Mais tarde» deixa usar a de agora e não volta a perguntar enquanto a
 *    app estiver aberta.
 *
 * Esta build (runtime dcf63afc) arranca com `checkAutomatically: ON_LOAD`:
 * uma versão já descarregada entra sozinha no arranque seguinte, mesmo
 * depois de «Mais tarde». Pôr `NEVER` (como a app de cliente) muda a
 * fingerprint — fica para a próxima build nativa.
 *
 * O QUE TRAZ — d23, 13-11-2026: o aviso mostra a nota dessa atualização
 * (pedida ao site com o id do manifest); sem rede, a frase de sempre.
 *
 * Sem rede, ou sem nada novo, não acontece nada. Nunca no navegador nem em
 * desenvolvimento.
 */
let adiadaNestaSessao = false;
export function ActualizacaoAutomatica() {
  if (Platform.OS === "web" || !Updates.isEnabled || __DEV__) return null;
  return <Vigia />;
}

function Vigia() {
  const segmentos = useSegments() as string[];
  const { isUpdatePending, downloadedUpdate, availableUpdate } = Updates.useUpdates();
  const updateId = downloadedUpdate?.updateId ?? availableUpdate?.updateId ?? null;
  const insets = useSafeAreaInsets();
  const c = useCores();
  const [aRecarregar, setARecarregar] = useState(false);
  const [aPerguntar, setAPerguntar] = useState(false);
  // Pede-se logo que haja uma pronta, para o aviso já abrir com ela.
  const nota = useNotaDaAtualizacao(isUpdatePending || aPerguntar, updateId);
  // Viu-a no aviso (mesmo com «Mais tarde»): o cartão «O que há de novo» não a repete.
  useEffect(() => {
    if (aPerguntar && nota) void marcarNotaVista(updateId, nota);
  }, [aPerguntar, nota, updateId]);
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
      const r = await Updates.checkForUpdateAsync();
      if (r.isAvailable) {
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

  // A que o arranque já descarregou (ON_LOAD) também conta.
  useEffect(() => {
    if (isUpdatePending) {
      pronta.current = true;
      aplicar();
    }
  }, [isUpdatePending, aplicar]);

  // Saiu de um ecrã que espera: pergunta pela que estava à espera.
  const chave = segmentos.join("/");
  useEffect(() => {
    aplicar();
  }, [chave, aplicar]);

  if (aPerguntar) {
    return (
      <Modal transparent animationType="fade" visible onRequestClose={maisTarde} statusBarTranslucent navigationBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.55)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ alignSelf: "stretch", maxWidth: 380, backgroundColor: c.superficie, borderRadius: 22, padding: 22, gap: 14 }}>
            <Text style={{ color: c.tinta, fontSize: 20, fontWeight: "800" }}>Há uma versão nova da app</Text>
            <Text style={{ color: c.suave, fontSize: 15, lineHeight: 21 }}>{nota ? `${nota.nota} Demora só uns segundos.` : "Traz melhorias e correções. Demora só uns segundos."}</Text>
            <Pressable
              onPress={actualizarAgora}
              accessibilityRole="button"
              style={({ pressed }) => ({ backgroundColor: c.marca, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.8 : 1 })}
            >
              <Text style={{ color: c.sobreMarca, fontSize: 16, fontWeight: "800" }}>Atualizar agora</Text>
            </Pressable>
            <Pressable
              onPress={maisTarde}
              accessibilityRole="button"
              style={({ pressed }) => ({ borderRadius: 14, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: c.tinta, fontSize: 15, fontWeight: "600" }}>Mais tarde</Text>
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
