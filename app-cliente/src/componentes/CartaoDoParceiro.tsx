import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "./Texto";
import { SITE } from "../lib/api";
import type { CartaoDaLista, Pessoas } from "../lib/parceiros-da-mudanca";
import { CORES } from "../tema";

/**
 * UM PARCEIRO DA LISTA DA MUDANÇA — 11-11-2026. O cartão do simulador do site
 * (`ParceirosDaMudanca.tsx`) com o cabeçalho de `Proposta.tsx`: o nome e, na
 * mesma linha, pequeno, o selo; a nota (ou «Novo na CLYON»); a estimativa com
 * IVA e o sem IVA ao lado; o preço da hora para a equipa escolhida; as horas e
 * o mínimo; e o material, recolhido. Tocar no cartão marca-o ou desmarca-o.
 *
 * Tudo o que se lê vem da rota (`POST /api/mudancas/parceiros`).
 */
export function CartaoDoParceiro({
  p,
  pessoas,
  marcado,
  cheio,
  aoTocar,
}: {
  p: CartaoDaLista;
  pessoas: Pessoas;
  marcado: boolean;
  /** Já tem o máximo escolhido: este não se pode marcar. */
  cheio: boolean;
  aoTocar: () => void;
}) {
  const [material, setMaterial] = useState(false);
  const [semFoto, setSemFoto] = useState(false);
  const hora = pessoas === 3 ? p.precoHora[3] : p.precoHora[2];
  const foto = p.fotografia && !semFoto ? (p.fotografia.startsWith("/") ? `${SITE}${p.fotografia}` : p.fotografia) : null;
  const desligado = cheio && !marcado;
  return (
    <Pressable
      onPress={desligado ? undefined : aoTocar}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcado, disabled: desligado }}
      accessibilityLabel={`${p.nome}. ${p.estimativa.texto}`}
      style={({ pressed }) => ({
        backgroundColor: CORES.fundo,
        borderWidth: marcado ? 2 : 1,
        borderColor: marcado ? CORES.marca : CORES.linha,
        borderRadius: 20,
        padding: 16,
        gap: 8,
        opacity: desligado ? 0.55 : pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Ionicons name={marcado ? "checkbox" : "square-outline"} size={24} color={desligado ? CORES.suave : CORES.marca} style={{ marginTop: 2 }} />
        {foto ? (
          <Image
            source={{ uri: foto }}
            onError={() => setSemFoto(true)}
            style={{ width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: CORES.linha, backgroundColor: CORES.superficie }}
          />
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8 }}>
            <Text style={{ flexShrink: 1, color: CORES.tinta, fontSize: 17, fontWeight: "800" }}>{p.nome}</Text>
            {p.selo ? <Text style={{ color: CORES.bom, fontSize: 13, fontWeight: "600" }}>{p.selo}</Text> : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {p.nota ? <Ionicons name="star" size={14} color={CORES.estrela} /> : null}
            <Text style={{ color: CORES.suave, fontSize: 13.5 }}>{p.nota ? p.nota.texto : (p.novo ?? "")}</Text>
          </View>
        </View>
      </View>
      <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "700", lineHeight: 21 }}>{p.estimativa.texto}</Text>
      {hora ? <Text style={{ color: CORES.tinta, fontSize: 14, lineHeight: 20 }}>{`${hora.texto} · equipa de ${pessoas}`}</Text> : null}
      {p.horasTexto ? (
        <Text style={{ color: CORES.suave, fontSize: 13.5, lineHeight: 19 }}>
          {p.minimoTexto ? `${p.horasTexto} · ${p.minimoTexto.toLowerCase()}` : p.horasTexto}
        </Text>
      ) : null}
      {p.kit.texto ? (
        <View style={{ gap: 4 }}>
          <Pressable
            onPress={() => setMaterial((m) => !m)}
            accessibilityRole="button"
            accessibilityState={{ expanded: material }}
            hitSlop={6}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: 6, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ flex: 1, color: CORES.marca, fontSize: 13.5, lineHeight: 19, fontWeight: "600" }}>{p.kit.texto}</Text>
            <Ionicons name={material ? "chevron-up" : "chevron-down"} size={16} color={CORES.marca} />
          </Pressable>
          {material ? (
            <View style={{ gap: 2 }}>
              {p.materiais.map((m) => (
                <Text key={m.chave} style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18 }}>{`${m.nome}: ${m.texto}`}</Text>
              ))}
              {p.kit.total ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18 }}>{`Com o kit: ${p.estimativaComKit.texto}`}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
