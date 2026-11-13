import Ionicons from "@expo/vector-icons/Ionicons";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Texto";
import { marcarNotaVista, useNotaDaAtualizacao } from "./Novidades";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * «HÁ UMA VERSÃO NOVA DA APP» — versão 13.
 *
 * Com o EAS Update, uma correcção chega aos telemóveis sem passar pela
 * revisão da loja: a app procura-a ao abrir (`checkAutomatically: ON_LOAD`)
 * e descarrega-a. Por omissão só entraria no arranque seguinte — e quem tem
 * a app aberta o dia todo nunca a via. Esta faixa diz-lhe que já está cá e
 * reinicia num toque. Só aparece quando há mesmo uma à espera; no navegador
 * (a demonstração) não existe.
 *
 * Desde a d23 (13-11-2026) diz também o que a versão nova traz: a nota dessa
 * atualização, pedida ao site com o id do manifest. Sem rede, sem nota.
 */
export function VersaoNova() {
  if (Platform.OS === "web" || !Updates.isEnabled) return null;
  return <Faixa />;
}

function Faixa() {
  const c = useCores();
  const { isUpdatePending, downloadedUpdate, availableUpdate } = Updates.useUpdates();
  const updateId = downloadedUpdate?.updateId ?? availableUpdate?.updateId ?? null;
  const nota = useNotaDaAtualizacao(isUpdatePending, updateId);
  const [aReiniciar, setAReiniciar] = useState(false);
  // Viu a nota aqui: o cartão «O que há de novo» não a repete depois de reiniciar.
  useEffect(() => {
    if (isUpdatePending && nota) void marcarNotaVista(updateId, nota);
  }, [isUpdatePending, nota, updateId]);
  if (!isUpdatePending) return null;
  return (
    <Pressable
      onPress={() => {
        setAReiniciar(true);
        void marcarNotaVista(updateId, nota)
          .then(() => Updates.reloadAsync())
          .catch(() => setAReiniciar(false));
      }}
      accessibilityRole="button"
      accessibilityLabel={`Há uma versão nova da app.${nota ? ` ${nota.nota}` : ""} Reiniciar para a usar.`}
      style={({ pressed }) => [estilos.faixa, { backgroundColor: c.marcaSuave, borderColor: c.marca, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name="refresh" size={18} color={c.marca} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.tinta, fontSize: LETRA.pequena + 1 }}>{aReiniciar ? "A reiniciar…" : "Há uma versão nova da app."}</Text>
        {nota && !aReiniciar ? <Text style={{ color: c.suave, fontSize: LETRA.pequena, lineHeight: 17 }}>{nota.nota}</Text> : null}
      </View>
      <Text style={{ color: c.marca, fontWeight: "800", fontSize: LETRA.pequena + 1 }}>Reiniciar</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  faixa: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACO.s,
    borderWidth: 1,
    borderRadius: RAIO.m,
    paddingHorizontal: ESPACO.m,
    paddingVertical: ESPACO.s,
    marginBottom: ESPACO.s,
  },
});
