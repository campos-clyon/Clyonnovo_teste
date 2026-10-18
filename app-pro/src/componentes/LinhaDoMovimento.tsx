import { StyleSheet, View } from "react-native";
import { Text } from "./Texto";
import { diaCurto, FASE_DO_MOVIMENTO, type Movimento } from "../lib/conta";
import { euros } from "../lib/trabalhos";
import { ESPACO, LETRA, useCores } from "../tema";

/** Um movimento da carteira: o trabalho ou a transferência, o dia, a fase e o valor (o que sai, a menos). */
export function LinhaDoMovimento({ m, ultima = false }: { m: Movimento; ultima?: boolean }) {
  const c = useCores();
  const sai = m.valor < 0;
  return (
    <View style={[estilos.linha, { borderBottomColor: c.linha, borderBottomWidth: ultima ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: c.tinta, fontSize: LETRA.normal, fontWeight: "600" }}>
          {m.pedidoId != null ? `#${m.pedidoId} · ` : ""}
          {m.titulo}
        </Text>
        <Text numberOfLines={1} style={{ color: c.suave, fontSize: LETRA.pequena }}>
          {[diaCurto(m.data), m.zona, FASE_DO_MOVIMENTO[m.fase] ?? m.fase].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Text style={{ color: sai ? c.mau : c.bom, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
        {sai ? "−" : "+"}
        {euros(Math.abs(m.valor))}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: ESPACO.m, paddingVertical: ESPACO.s },
});
