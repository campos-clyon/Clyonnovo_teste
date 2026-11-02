import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";
import { Text } from "./Texto";
import type { Momento, Passo } from "../lib/passos-do-pedido";
import { CORES } from "../tema";

/**
 * O AVISO DO MOMENTO E O PASSO A PASSO — 02-11-2026 (dono, #555).
 *
 * O bloco do momento vai no topo do pedido, em cor forte (não neutra): o que
 * acabou de acontecer e a hora. Por baixo, a linha de passos, com o actual
 * destacado e a hora de cada passo feito. As frases e as horas vêm de
 * `passos-do-pedido.ts`; aqui só se desenham.
 */

const FUNDO_DO_MOMENTO: Record<Momento["tom"], string> = { marca: CORES.marca, bom: CORES.bom, aviso: CORES.aviso };

export function MomentoDoPedido({ momento }: { momento: Momento }) {
  return (
    <View
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      style={{ borderRadius: 18, backgroundColor: FUNDO_DO_MOMENTO[momento.tom], paddingHorizontal: 16, paddingVertical: 14, gap: 4 }}
    >
      <Text titulo style={{ color: CORES.sobreMarca, fontSize: 19, fontWeight: "800" }}>
        {momento.titulo}
      </Text>
      {momento.texto ? <Text style={{ color: CORES.sobreMarcaSuave, fontSize: 14.5, lineHeight: 20 }}>{momento.texto}</Text> : null}
    </View>
  );
}

function Marca({ estado }: { estado: Passo["estado"] }) {
  if (estado === "feito") {
    return (
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: CORES.bom, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="checkmark" size={14} color={CORES.sobreMarca} />
      </View>
    );
  }
  if (estado === "actual") {
    return (
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: CORES.ciano, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: CORES.cianoFundo }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CORES.sobreMarca }} />
      </View>
    );
  }
  if (estado === "falta") {
    return (
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: CORES.avisoSuave, borderWidth: 2, borderColor: CORES.aviso, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: CORES.aviso, fontSize: 12, fontWeight: "800" }}>!</Text>
      </View>
    );
  }
  return <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: CORES.linhaForte, backgroundColor: CORES.fundo }} />;
}

export function PassosDoPedido({ passos }: { passos: Passo[] }) {
  return (
    <View accessibilityLabel="Passo a passo do pedido" style={{ borderWidth: 1, borderColor: CORES.linha, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 }}>
      {passos.map((p, i) => {
        const ultimo = i === passos.length - 1;
        const actual = p.estado === "actual";
        const apagado = p.estado === "saltado" || p.estado === "por-fazer";
        const corDaLinha = p.estado === "feito" ? CORES.bom : CORES.linha;
        return (
          <View key={p.id} style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center", width: 22 }}>
              <Marca estado={p.estado} />
              {!ultimo ? <View style={{ flex: 1, width: 2, minHeight: 14, backgroundColor: corDaLinha }} /> : null}
            </View>
            <View
              style={{
                flex: 1,
                paddingBottom: ultimo ? 0 : 12,
                marginTop: -1,
                ...(actual ? { backgroundColor: CORES.cianoFundo, borderRadius: 12, paddingHorizontal: 10, paddingTop: 4, paddingBottom: 8, marginBottom: ultimo ? 0 : 8, marginTop: -4 } : null),
              }}
            >
              <Text
                titulo={actual}
                style={{
                  color: actual ? CORES.marca : p.estado === "falta" ? CORES.aviso : apagado ? CORES.icone : CORES.tinta,
                  fontSize: actual ? 16 : 14.5,
                  fontWeight: actual || p.estado === "falta" ? "800" : p.estado === "feito" ? "600" : "400",
                }}
              >
                {p.estado === "falta" ? `${p.titulo} — por pagar` : p.titulo}
              </Text>
              {p.detalhe && p.estado !== "por-fazer" ? (
                <Text style={{ color: actual ? CORES.tinta : CORES.suave, fontSize: 13 }}>{p.detalhe}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
