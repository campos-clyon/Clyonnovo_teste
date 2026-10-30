import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, type BottomTabBarProps } from "expo-router/tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { usePedidos } from "../../estado/Pedidos";
import { quantosComNovidade } from "../../lib/pedidos";
import { CORES, DEGRADE } from "../../tema";

/**
 * A BARRA DE BAIXO — 4 entradas (dono, 29-10-2026): Início · Serviços ·
 * Pedir · Perfil. «Pedir» é o botão redondo ao meio, levantado, em ciano
 * claro com o «+» branco; os outros são ícones finos cinzentos, o escolhido a
 * cor, em fundo branco.
 *
 * «Pedidos» saiu da barra: os pedidos activos aparecem no Início e a lista
 * toda abre-se no Perfil. O ecrã continua aqui, sem entrada na barra, para os
 * links e os avisos que levam a «/pedidos».
 *
 * PORQUE A BARRA É FEITA AQUI: o Android desenha a app até ao fundo do ecrã
 * (edge-to-edge) e os botões do sistema ficam por cima. A barra soma sempre a
 * margem de baixo do telemóvel (`insets.bottom`, com botões ou com gestos) —
 * a altura fixa de antes (64) apagava-a, e os botões do sistema tapavam a
 * barra. E o botão «Pedir» fica TODO dentro da sua caixa: no Android um toque
 * fora da caixa do pai não chega ao botão, e o círculo levantado estava fora
 * dela (era por isso que o «+» não abria o pedido).
 *
 * SEM FAIXA BRANCA POR CIMA (dono, 30-10-2026): a barra flutua sobre o ecrã
 * (posição absoluta) e o ecrã só desce até ao topo da parte branca
 * (`paddingBottom` da cena = ALTURA_DA_BARRA + insets.bottom). Assim só o
 * círculo do «Pedir» sobe acima da barra e o conteúdo passa por trás dele;
 * a faixa de SUBIDA_DO_PEDIR é transparente e deixa passar os toques
 * (`box-none`), e os outros botões usam margem, não preenchimento, para não
 * apanharem toques nessa faixa.
 */

export const ENTRADAS_DA_BARRA = ["index", "servicos", "pedir", "perfil"] as const;

const ICONES: Record<string, { nome: string; escolhido: string }> = {
  index: { nome: "home-outline", escolhido: "home" },
  servicos: { nome: "grid-outline", escolhido: "grid" },
  perfil: { nome: "person-outline", escolhido: "person" },
};

/** A altura da barra sem a margem do sistema, e quanto o botão «Pedir» sobe acima dela. */
export const ALTURA_DA_BARRA = 60;
const SUBIDA_DO_PEDIR = 20;
const TAMANHO_DO_PEDIR = 56;

function Barra({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { pedidos } = usePedidos();
  const novidades = quantosComNovidade(pedidos);
  const rotas = state.routes.filter((r) => (ENTRADAS_DA_BARRA as readonly string[]).includes(r.name));
  const escolhida = state.routes[state.index]?.name;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: SUBIDA_DO_PEDIR + ALTURA_DA_BARRA + insets.bottom, flexDirection: "row", paddingBottom: insets.bottom }}
    >
      {/* O fundo branco e a linha da barra começam abaixo da subida do «Pedir»; os botões ocupam a altura toda. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: SUBIDA_DO_PEDIR, backgroundColor: CORES.fundo, borderTopWidth: 1, borderTopColor: CORES.linha }}
      />
        {rotas.map((rota) => {
          const foco = rota.name === escolhida;
          const opcoes = descriptors[rota.key]?.options;
          const titulo = typeof opcoes?.title === "string" ? opcoes.title : rota.name;
          const carregar = () => {
            const e = navigation.emit({ type: "tabPress", target: rota.key, canPreventDefault: true });
            if (!foco && !e.defaultPrevented) navigation.navigate(rota.name, rota.params);
          };

          if (rota.name === "pedir") {
            return (
              <Pressable
                key={rota.key}
                onPress={carregar}
                accessibilityRole="button"
                accessibilityLabel="Pedir orçamento"
                accessibilityState={{ selected: foco }}
                testID="botao-pedir"
                style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "flex-start", gap: 0, opacity: pressed ? 0.85 : 1 })}
              >
                <LinearGradient
                  colors={DEGRADE}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: TAMANHO_DO_PEDIR,
                    height: TAMANHO_DO_PEDIR,
                    borderRadius: TAMANHO_DO_PEDIR / 2,
                    borderWidth: 4,
                    borderColor: CORES.fundo,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="add" size={30} color={CORES.sobreMarca} />
                </LinearGradient>
                <Text style={{ color: foco ? CORES.ciano : CORES.suave, fontSize: 11, fontWeight: "600" }} maxFontSizeMultiplier={1}>
                  Pedir
                </Text>
              </Pressable>
            );
          }

          const icone = ICONES[rota.name] ?? { nome: "ellipse-outline", escolhido: "ellipse" };
          const cor = foco ? CORES.ciano : CORES.icone;
          const selo = rota.name === "index" && novidades > 0 ? novidades : 0;
          return (
            <Pressable
              key={rota.key}
              onPress={carregar}
              accessibilityRole="tab"
              accessibilityLabel={selo > 0 ? `${titulo}, ${selo} com novidade` : titulo}
              accessibilityState={{ selected: foco }}
              style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", gap: 3, marginTop: SUBIDA_DO_PEDIR, opacity: pressed ? 0.6 : 1 })}
            >
              <View>
                <Ionicons name={(foco ? icone.escolhido : icone.nome) as never} size={23} color={cor} />
                {selo > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -10,
                      minWidth: 17,
                      height: 17,
                      borderRadius: 9,
                      backgroundColor: CORES.mau,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text style={{ color: CORES.sobreMarca, fontSize: 10, fontWeight: "700" }} maxFontSizeMultiplier={1}>
                      {String(selo)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: foco ? CORES.ciano : CORES.suave, fontSize: 11, fontWeight: foco ? "700" : "500" }} maxFontSizeMultiplier={1}>
                {titulo}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}

export default function Separadores() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      tabBar={(p) => <Barra {...p} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: CORES.fundo, paddingBottom: ALTURA_DA_BARRA + insets.bottom } }}
    >
      <Tabs.Screen name="index" options={{ title: "Início" }} />
      <Tabs.Screen name="servicos" options={{ title: "Serviços" }} />
      <Tabs.Screen name="pedir" options={{ title: "Pedir" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
      {/* Sem entrada na barra: a lista toda abre-se no Perfil («Os meus pedidos»). */}
      <Tabs.Screen name="pedidos" options={{ title: "Pedidos", href: null }} />
    </Tabs>
  );
}
