import Ionicons from "@expo/vector-icons/Ionicons";
import * as Updates from "expo-updates";
import { useState } from "react";
import { Platform, Pressable } from "react-native";
import { Text } from "./Texto";
import { CORES } from "../tema";

/**
 * «HÁ UMA VERSÃO NOVA DA APP» — como a Pro (versão 13).
 *
 * Com o EAS Update, uma correcção chega aos telemóveis sem passar pela loja:
 * a app procura-a ao abrir (ActualizacaoAutomatica) e pergunta antes de a usar.
 * Esta faixa diz que já está cá e reinicia num toque. Só aparece quando há
 * mesmo uma à espera; no navegador não existe.
 */
export function VersaoNova() {
  if (Platform.OS === "web" || !Updates.isEnabled) return null;
  return <Faixa />;
}

function Faixa() {
  const { isUpdatePending } = Updates.useUpdates();
  const [aReiniciar, setAReiniciar] = useState(false);
  if (!isUpdatePending) return null;
  return (
    <Pressable
      onPress={() => {
        setAReiniciar(true);
        void Updates.reloadAsync().catch(() => setAReiniciar(false));
      }}
      accessibilityRole="button"
      accessibilityLabel="Há uma versão nova da app. Reiniciar para a usar."
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: CORES.marca,
        backgroundColor: CORES.marcaSuave,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name="refresh" size={18} color={CORES.marca} />
      <Text style={{ flex: 1, color: CORES.tinta, fontSize: 14 }}>
        {aReiniciar ? "A reiniciar…" : "Há uma versão nova da app."}
      </Text>
      <Text style={{ color: CORES.marca, fontWeight: "800", fontSize: 14 }}>Reiniciar</Text>
    </Pressable>
  );
}

/**
 * «PROCURAR ATUALIZAÇÃO» — dono, 30-10-2026: um botão no Perfil para buscar a
 * versão nova à mão, sem esperar por fechar e abrir a app. Procura, descarrega
 * e reinicia; se não houver nada novo, diz que já está na última.
 */
export function ProcurarActualizacao() {
  const [estado, setEstado] = useState<"parado" | "a procurar" | "em dia" | "falhou">("parado");
  if (Platform.OS === "web" || !Updates.isEnabled) return null;
  const procurar = async () => {
    setEstado("a procurar");
    try {
      const h = await Updates.checkForUpdateAsync();
      if (!h.isAvailable) return setEstado("em dia");
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setEstado("falhou");
    }
  };
  const texto =
    estado === "a procurar"
      ? "A procurar…"
      : estado === "em dia"
        ? "Já tem a versão mais recente."
        : estado === "falhou"
          ? "Não deu para procurar. Tente com rede."
          : "Procurar atualização";
  return (
    <Pressable
      onPress={() => void procurar()}
      disabled={estado === "a procurar"}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: CORES.linha,
        borderRadius: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name="refresh" size={18} color={CORES.marca} />
      <Text style={{ color: CORES.marca, fontWeight: "700", fontSize: 14 }}>{texto}</Text>
    </Pressable>
  );
}
