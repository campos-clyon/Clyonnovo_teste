import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Image, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Aviso, Carregando, Ligacao, PrecoDeReferencia, Seccao } from "../../componentes/ui";
import { CartaoDoWhatsapp, Pergunta } from "../../componentes/Informacao";
import { VersaoNova } from "../../componentes/VersaoNova";
import { useCatalogo } from "../../estado/Catalogo";
import { usePedidos } from "../../estado/Pedidos";
import { useSessao } from "../../estado/Sessao";
import { whatsappDaClyon } from "../../lib/abrir";
import { quantosComNovidade } from "../../lib/pedidos";
import { aparenciaDoServico, CORES, DEGRADE } from "../../tema";

/**
 * E0 v3 — INÍCIO (com e sem conta; as maquetas aprovadas a 29-10-2026).
 *
 * A app abre aqui, sem ecrã de entrada à frente. Só o que se aplica, por esta
 * ordem: o topo (título, a frase do topo do site, «Pedir orçamento» e o
 * WhatsApp), as avaliações do Google, os serviços com o preço de referência
 * (o IVA ao lado, já escrito pela API), como funciona, as zonas, as perguntas
 * frequentes, o WhatsApp e a frase única da CLYON. Tudo do catálogo (R7 v2);
 * um bloco que a API não mande não aparece.
 */
export const TITULO_DO_INICIO = "Recolhas, esvaziamentos, mudanças e manutenção da casa";

function Topo() {
  const { ligado } = useSessao();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Image source={require("../../../assets/icon.png")} style={{ width: 30, height: 30, borderRadius: 8 }} accessibilityIgnoresInvertColors />
        <Text titulo style={{ color: CORES.tinta, fontSize: 18, fontWeight: "800", letterSpacing: 1.4 }}>
          CLYON
        </Text>
      </View>
      {!ligado ? (
        <Pressable
          onPress={() => router.push("/entrar")}
          accessibilityRole="button"
          accessibilityLabel="Entrar"
          style={({ pressed }) => ({ paddingHorizontal: 14, minHeight: 40, borderRadius: 13, borderWidth: 1.5, borderColor: CORES.linha, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
        >
          <Text titulo style={{ color: CORES.tinta, fontSize: 13.5, fontWeight: "600" }}>
            Entrar
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Inicio() {
  const { catalogo, aLer, erro, recarregar } = useCatalogo();
  const { ligado } = useSessao();
  const { pedidos } = usePedidos();
  const novidades = ligado ? quantosComNovidade(pedidos) : 0;

  if (!catalogo && aLer) return <Carregando />;
  const c = catalogo;
  const info = c?.info;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right"]}>
      <Topo />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 28 }}
        refreshControl={<RefreshControl refreshing={aLer} onRefresh={recarregar} tintColor={CORES.marca} />}
      >
        <VersaoNova />
        {/* 1. O topo. */}
        <LinearGradient colors={DEGRADE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 30, padding: 22, paddingTop: 26, gap: 16, overflow: "hidden" }}>
          <Text titulo accessibilityRole="header" style={{ color: CORES.sobreMarca, fontSize: 28, fontWeight: "800", lineHeight: 32 }}>
            {TITULO_DO_INICIO}
          </Text>
          {c?.textos.subtituloInicial ? (
            <Text style={{ color: CORES.sobreMarcaSuave, fontSize: 14.5, lineHeight: 21 }}>{c.textos.subtituloInicial}</Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Pressable
              onPress={() => router.push("/pedir")}
              accessibilityRole="button"
              accessibilityLabel="Pedir orçamento"
              style={({ pressed }) => ({ backgroundColor: CORES.sobreMarca, borderRadius: 16, minHeight: 52, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.85 : 1 })}
            >
              <Text titulo style={{ color: CORES.marca, fontSize: 15, fontWeight: "600" }}>
                Pedir orçamento
              </Text>
              <Ionicons name="arrow-forward" size={18} color={CORES.marca} />
            </Pressable>
            <Pressable
              onPress={() => whatsappDaClyon()}
              accessibilityRole="button"
              accessibilityLabel="WhatsApp"
              style={({ pressed }) => ({ backgroundColor: CORES.vidro, borderWidth: 1, borderColor: CORES.vidroLinha, borderRadius: 16, minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.85 : 1 })}
            >
              <Ionicons name="logo-whatsapp" size={18} color={CORES.sobreMarca} />
              <Text titulo style={{ color: CORES.sobreMarca, fontSize: 15, fontWeight: "600" }}>
                WhatsApp
              </Text>
            </Pressable>
          </View>
          {c?.textos.promessaDoPrazo ? (
            <View style={{ flexDirection: "row", gap: 9, paddingTop: 14, borderTopWidth: 1, borderTopColor: CORES.vidroLinha }}>
              <Ionicons name="time-outline" size={18} color={CORES.sobreMarcaSuave} />
              <Text style={{ flex: 1, color: CORES.sobreMarcaSuave, fontSize: 13, lineHeight: 19 }}>{c.textos.promessaDoPrazo}</Text>
            </View>
          ) : null}
        </LinearGradient>

        {!ligado ? (
          <Ligacao titulo="Já tem conta? Entrar" centrada aoCarregar={() => router.push("/entrar")} />
        ) : novidades > 0 ? (
          <Pressable
            onPress={() => router.push("/pedidos")}
            accessibilityRole="button"
            style={({ pressed }) => ({ borderRadius: 18, borderWidth: 1.5, borderColor: CORES.marca, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="notifications-outline" size={20} color={CORES.marca} />
            <Text titulo style={{ flex: 1, color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
              {novidades === 1 ? "1 pedido com novidade" : `${novidades} pedidos com novidade`}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={CORES.marca} />
          </Pressable>
        ) : null}

        {!c && erro ? <Aviso texto={erro} tom="aviso" /> : null}

        {/* 4. As avaliações do Google, em resumo, logo à vista (maqueta). */}
        {info?.avaliacoes ? (
          <Pressable
            onPress={() => router.push("/info/avaliacoes")}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: CORES.linha, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ flexDirection: "row", gap: 2 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Ionicons key={i} name="star" size={15} color={CORES.estrela} />
              ))}
            </View>
            <Text style={{ flex: 1, color: CORES.tinta, fontSize: 13.5, lineHeight: 19 }}>{info.avaliacoes.resumo}</Text>
            <Ionicons name="chevron-forward" size={18} color={CORES.suave} />
          </Pressable>
        ) : null}

        {/* 2. Os serviços, com o preço de referência. */}
        {c ? (
          <Seccao titulo="Serviços" ligacao="Ver todos" aoCarregar={() => router.push("/servicos")}>
            {c.servicos.map((s) => {
              const a = aparenciaDoServico(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => router.push({ pathname: "/info/[tema]", params: { tema: `servico-${s.id}` } })}
                  accessibilityRole="button"
                  accessibilityLabel={s.nome}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: a.tom.claro, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={a.icone as never} size={20} color={a.tom.forte} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
                      {s.nome}
                    </Text>
                    {s.precoReferencia ? <PrecoDeReferencia texto={s.precoReferencia} tamanho={13.5} /> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={CORES.suave} />
                </Pressable>
              );
            })}
            {c.textos.notaDosPrecos ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18 }}>{c.textos.notaDosPrecos}</Text> : null}
          </Seccao>
        ) : null}

        {/* 3. Como funciona. */}
        {info && info.comoFunciona.length > 0 ? (
          <Seccao titulo="Como funciona" ligacao="Ver tudo" aoCarregar={() => router.push("/info/como-funciona")}>
            {info.comoFunciona.map((p, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 14 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: CORES.marcaSuave, alignItems: "center", justifyContent: "center" }}>
                  <Text titulo style={{ color: CORES.marca, fontSize: 15, fontWeight: "700" }}>
                    {String(i + 1)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
                  <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
                    {p.titulo}
                  </Text>
                  {p.texto ? <Text style={{ color: CORES.suave, fontSize: 13.5, lineHeight: 19 }}>{p.texto}</Text> : null}
                </View>
              </View>
            ))}
          </Seccao>
        ) : null}

        {/* 4. Avaliações no Google: três testemunhos. */}
        {info?.avaliacoes && info.avaliacoes.testemunhos.length > 0 ? (
          <Seccao titulo="Avaliações no Google" ligacao="Ver todas" aoCarregar={() => router.push("/info/avaliacoes")}>
            {info.avaliacoes.testemunhos.slice(0, 3).map((t, i) => (
              <View key={i} style={{ borderRadius: 20, backgroundColor: CORES.superficie, padding: 16, gap: 8 }}>
                <Text style={{ color: CORES.tinta, fontSize: 14, lineHeight: 21 }}>{`«${t.texto}»`}</Text>
                <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{[t.nome, t.mes].filter(Boolean).join(" · ")}</Text>
              </View>
            ))}
          </Seccao>
        ) : null}

        {/* 5. Zonas. */}
        {info && info.zonas.length > 0 ? (
          <Seccao titulo="Zonas com profissionais na CLYON" ligacao="Ver as zonas" aoCarregar={() => router.push("/info/zonas")}>
            <Text style={{ color: CORES.suave, fontSize: 14, lineHeight: 20 }}>{info.zonas.map((z) => z.nome).join(" · ")}</Text>
          </Seccao>
        ) : null}

        {/* 6. Perguntas frequentes: as quatro primeiras. */}
        {info && info.perguntas.length > 0 ? (
          <Seccao titulo="Perguntas frequentes" ligacao="Ver todas" aoCarregar={() => router.push("/info/perguntas")}>
            <View>
              {info.perguntas.slice(0, 4).map((q, i) => (
                <Pergunta key={i} p={q.p} r={q.r} />
              ))}
            </View>
          </Seccao>
        ) : null}

        {/* 7. O WhatsApp. */}
        <CartaoDoWhatsapp horario={c?.textos.horarioDoWhatsapp ?? null} />

        {c?.textos.fraseUnica ? (
          <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: CORES.linha }}>
            {c.textos.fraseUnica}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

