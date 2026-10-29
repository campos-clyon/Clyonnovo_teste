import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Botao } from "./ui";
import { whatsappDaClyon } from "../lib/abrir";
import { CORES } from "../tema";

/** Peças da informação útil (Início e I1–I6): uma pergunta que abre no sítio, e o cartão do WhatsApp. */
export function Pergunta({ p, r }: { p: string; r: string }) {
  const [aberta, setAberta] = useState(false);
  return (
    <Pressable
      onPress={() => setAberta((a) => !a)}
      accessibilityRole="button"
      accessibilityState={{ expanded: aberta }}
      style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: CORES.linha, gap: 6 }}
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Text titulo style={{ flex: 1, color: CORES.tinta, fontSize: 14.5, fontWeight: "600" }}>
          {p}
        </Text>
        <Ionicons name={aberta ? "chevron-up" : "chevron-down"} size={18} color={CORES.suave} />
      </View>
      {aberta ? <Text style={{ color: CORES.suave, fontSize: 14, lineHeight: 21 }}>{r}</Text> : null}
    </Pressable>
  );
}

export function CartaoDoWhatsapp({ horario }: { horario: string | null }) {
  return (
    <View style={{ flexDirection: "row", gap: 14, borderRadius: 22, backgroundColor: CORES.whatsappSuave, padding: 16 }}>
      <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: CORES.whatsapp, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="logo-whatsapp" size={24} color={CORES.whatsappTinta} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
          Prefere falar com uma pessoa?
        </Text>
        <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{horario ?? "Fale com a CLYON pelo WhatsApp."}</Text>
        <View style={{ marginTop: 8 }}>
          <Botao titulo="Falar com a CLYON por WhatsApp" tipo="whatsapp" aoCarregar={() => whatsappDaClyon()} />
        </View>
      </View>
    </View>
  );
}
