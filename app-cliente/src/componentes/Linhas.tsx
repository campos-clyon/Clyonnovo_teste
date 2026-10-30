import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { useCatalogo } from "../estado/Catalogo";
import { abrirNoNavegador, whatsappDaClyon } from "../lib/abrir";
import { CORES } from "../tema";

/** Um grupo de linhas com título (Perfil, Ajuda, Conversas). */
export function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text titulo style={{ color: CORES.suave, fontSize: 13.5, fontWeight: "600" }}>
        {titulo}
      </Text>
      <View style={{ borderRadius: 20, borderWidth: 1, borderColor: CORES.linha, paddingHorizontal: 16, paddingVertical: 6 }}>{children}</View>
    </View>
  );
}

export function Linha({ icone, titulo, texto, aoCarregar, ultima = false }: { icone: string; titulo: string; texto?: string | null; aoCarregar: () => void; ultima?: boolean }) {
  return (
    <Pressable
      onPress={aoCarregar}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 12, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: CORES.linha, opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icone as never} size={20} color={CORES.marca} />
      <View style={{ flex: 1 }}>
        <Text titulo style={{ color: CORES.tinta, fontSize: 14.5, fontWeight: "600" }}>
          {titulo}
        </Text>
        {texto ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18 }}>{texto}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={CORES.suave} />
    </Pressable>
  );
}

/**
 * AS LINHAS DA AJUDA — uma só lista, usada no Perfil (grupo «Ajuda») e no
 * ecrã «Ajuda» da barra de cima: como funciona, preços, zonas, avaliações,
 * perguntas frequentes, Termos e Privacidade.
 */
export function LinhasDaAjuda() {
  const { catalogo } = useCatalogo();
  return (
    <Grupo titulo="Ajuda">
      <Linha icone="logo-whatsapp" titulo="Falar com a CLYON" texto={catalogo?.textos.horarioDoWhatsapp ?? "WhatsApp"} aoCarregar={() => whatsappDaClyon()} />
      <Linha icone="list-outline" titulo="Como funciona" aoCarregar={() => router.push("/info/como-funciona")} />
      <Linha icone="pricetag-outline" titulo="Preços de referência" aoCarregar={() => router.push("/info/precos")} />
      <Linha icone="map-outline" titulo="Zonas" aoCarregar={() => router.push("/info/zonas")} />
      <Linha icone="star-outline" titulo="Avaliações no Google" aoCarregar={() => router.push("/info/avaliacoes")} />
      <Linha icone="help-circle-outline" titulo="Perguntas frequentes" aoCarregar={() => router.push("/info/perguntas")} />
      <Linha icone="document-text-outline" titulo="Termos" texto="Abre em clyon.pt" aoCarregar={() => abrirNoNavegador("/termos")} />
      <Linha icone="shield-checkmark-outline" titulo="Privacidade" texto="Abre em clyon.pt" aoCarregar={() => abrirNoNavegador("/privacidade")} ultima />
    </Grupo>
  );
}
