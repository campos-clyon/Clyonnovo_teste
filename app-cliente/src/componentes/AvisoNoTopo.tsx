import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Texto";
import { usePedidos } from "../estado/Pedidos";
import { avisoNoTopoSeVe, type MudancaNaLista } from "../lib/passos-do-pedido";
import { CORES } from "../tema";

/**
 * O AVISO EM POP-UP NO TOPO — 02-11-2026 (dono: «os avisos do parceiro
 * passam despercebidos»). Com a app aberta noutro ecrã, quando um pedido muda
 * (o parceiro aceitou, marcou o dia, vai a caminho, chegou, terminou, o
 * pagamento entrou) desce do topo um aviso com o que aconteceu; tocar abre o
 * pedido, e sai sozinho ao fim de 6 s. Vem da leitura da lista (de 30 em 30
 * s, ao voltar à app e com cada aviso no telemóvel) — funciona mesmo sem os
 * avisos do sistema (push). No ecrã desse pedido não aparece: lá já se vê.
 */
const DURACAO_MS = 6000;
/** Um aviso mais velho do que isto já não se mostra (ex.: mudou enquanto ele estava no próprio pedido). */
const VALIDADE_MS = 10_000;

export function AvisoNoTopo() {
  const { mudanca, esquecerMudanca } = usePedidos();
  const caminho = usePathname();
  const margens = useSafeAreaInsets();
  const [visivel, setVisivel] = useState<MudancaNaLista | null>(null);
  const y = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    if (!mudanca) return;
    esquecerMudanca();
    if (Date.now() - mudanca.em > VALIDADE_MS || !avisoNoTopoSeVe(caminho, mudanca.pedidoId)) return;
    setVisivel(mudanca);
  }, [mudanca, caminho, esquecerMudanca]);

  useEffect(() => {
    if (!visivel) return;
    Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    const t = setTimeout(() => fechar(), DURACAO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  function fechar() {
    Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => setVisivel(null));
  }

  if (!visivel) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 12, right: 12, top: margens.top + 8, transform: [{ translateY: y }], zIndex: 50, elevation: 12 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${visivel.titulo}: ${visivel.texto}. Abrir o pedido.`}
        accessibilityLiveRegion="assertive"
        onPress={() => {
          const id = visivel.pedidoId;
          fechar();
          router.push(`/pedido/${id}`);
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderRadius: 18,
          backgroundColor: CORES.marca,
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: pressed ? 0.85 : 1,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        })}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CORES.vidro, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="notifications" size={18} color={CORES.sobreMarca} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ color: CORES.sobreMarcaSuave, fontSize: 12.5 }}>{visivel.titulo}</Text>
          <Text titulo style={{ color: CORES.sobreMarca, fontSize: 15.5, fontWeight: "700" }}>
            {visivel.texto}
          </Text>
        </View>
        <Pressable onPress={fechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar o aviso">
          <Ionicons name="close" size={20} color={CORES.sobreMarca} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
