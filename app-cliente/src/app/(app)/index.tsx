import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Aviso, Botao, Carregando, PrecoDeReferencia, Seccao } from "../../componentes/ui";
import { VersaoNova } from "../../componentes/VersaoNova";
import { useCatalogo } from "../../estado/Catalogo";
import { usePedidos } from "../../estado/Pedidos";
import { useSessao } from "../../estado/Sessao";
import { whatsappDaClyon } from "../../lib/abrir";
import { sessoesDeConvidado } from "../../lib/convidado";
import type { SessaoDeConvidado } from "../../lib/pedido-do-link";
import { lerMoradaDaConta, SEM_MORADA } from "../../lib/morada-do-cliente";
import { noSeparador, quantosComNovidade, type PedidoNaLista } from "../../lib/pedidos";
import { aparenciaDoServico, CORES } from "../../tema";

/**
 * E0 v4 — INÍCIO (dono, 29-10-2026): menos informação e mais branco.
 *
 * Por esta ordem, só o que se aplica: um cabeçalho curto (o título, a frase do
 * topo do site e «Pedir orçamento»), os pedidos activos (com conta, ou os
 * abertos pelo link neste telemóvel), os serviços em cartões coloridos com o
 * preço de referência (o IVA ao lado, já escrito pela API), «Como funciona»
 * curto e o WhatsApp numa linha. As perguntas, as zonas e as avaliações do
 * Google passaram para o Perfil, em «Ajuda». Tudo do catálogo (R7 v2); um
 * bloco que a API não mande não aparece.
 */
export const TITULO_DO_INICIO = "Recolhas, esvaziamentos, mudanças e manutenção da casa";

/** Quantos pedidos activos se vêem no Início; o resto está em «Ver todos» (Perfil → Os meus pedidos). */
const ACTIVOS_NO_INICIO = 3;

/** Os três botões redondos da direita, só com ícone (por esta ordem). */
export const BOTOES_DO_TOPO = [
  { icone: "chatbubble-outline", rotulo: "Conversas", rota: "/conversas" },
  { icone: "help-buoy-outline", rotulo: "Ajuda", rota: "/ajuda" },
  { icone: "notifications-outline", rotulo: "Notificações", rota: "/notificacoes" },
] as const;

/**
 * A BARRA DE CIMA (dono, 30-10-2026): à esquerda a morada com a setinha (abre
 * «A sua morada»); à direita Conversas, Ajuda e Notificações, com o selo das
 * novidades dos pedidos; por baixo, «Como podemos ajudar?», que abre o Descobrir.
 */
function Topo() {
  const { ligado } = useSessao();
  const { pedidos } = usePedidos();
  const [morada, setMorada] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void lerMoradaDaConta().then((m) => {
        if (vivo) setMorada(m?.formattedAddress ?? null);
      });
      return () => {
        vivo = false;
      };
    }, [ligado]),
  );
  const novidades = ligado ? quantosComNovidade(pedidos) : 0;

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={() => router.push("/morada" as Href)}
          accessibilityRole="button"
          accessibilityLabel={morada ? `A sua morada: ${morada}. Mudar` : SEM_MORADA}
          style={({ pressed }) => ({ flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="location-outline" size={18} color={CORES.marca} />
          <Text titulo style={{ flexShrink: 1, color: CORES.tinta, fontSize: 15, fontWeight: "700" }} numberOfLines={1} ellipsizeMode="tail">
            {morada ?? SEM_MORADA}
          </Text>
          <Ionicons name="chevron-down" size={16} color={CORES.tinta} />
        </Pressable>
        {BOTOES_DO_TOPO.map((b) => {
          const selo = b.rota === "/notificacoes" && novidades > 0 ? novidades : 0;
          return (
            <Pressable
              key={b.rota}
              onPress={() => router.push(b.rota as Href)}
              accessibilityRole="button"
              accessibilityLabel={selo ? `${b.rotulo}, ${selo} com novidade` : b.rotulo}
              style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: CORES.linha, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name={b.icone} size={20} color={CORES.tinta} />
              {selo ? (
                <View style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: CORES.marca, alignItems: "center", justifyContent: "center" }}>
                  <Text titulo style={{ color: CORES.fundo, fontSize: 10.5, fontWeight: "700" }}>
                    {selo > 9 ? "9+" : String(selo)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => router.push("/servicos")}
        accessibilityRole="search"
        accessibilityLabel="Como podemos ajudar?"
        style={({ pressed }) => ({ minHeight: 48, borderRadius: 14, backgroundColor: CORES.superficie, borderWidth: 1, borderColor: CORES.linha, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}
      >
        <Ionicons name="search-outline" size={18} color={CORES.suave} />
        <Text style={{ color: CORES.suave, fontSize: 15 }}>Como podemos ajudar?</Text>
      </Pressable>
    </View>
  );
}

/** Um pedido activo: o serviço, o número e o estado em palavras (os da API). */
function LinhaDoPedido({ servico, segunda, estado, novidade, aoAbrir }: { servico: string; segunda: string; estado: string; novidade: string | null; aoAbrir: () => void }) {
  return (
    <Pressable
      onPress={aoAbrir}
      accessibilityRole="button"
      accessibilityLabel={`${servico}, ${segunda}, ${estado}${novidade ? `, ${novidade}` : ""}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 18,
        borderWidth: novidade ? 1.5 : 1,
        borderColor: novidade ? CORES.ciano : CORES.linha,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
          {servico}
        </Text>
        <Text style={{ color: CORES.suave, fontSize: 12.5 }} numberOfLines={1}>
          {segunda}
        </Text>
        <Text style={{ color: novidade ? CORES.marca : CORES.tinta, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
          {novidade ?? estado}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={CORES.icone} />
    </Pressable>
  );
}

function PedidosActivos() {
  const { ligado } = useSessao();
  const { pedidos } = usePedidos();
  const [doLink, setDoLink] = useState<SessaoDeConvidado[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (ligado) return;
      void sessoesDeConvidado().then(setDoLink).catch(() => setDoLink([]));
    }, [ligado]),
  );

  if (ligado) {
    const activos = pedidos.filter((p: PedidoNaLista) => noSeparador(p, "em_aberto"));
    if (activos.length === 0) return null;
    return (
      <Seccao titulo="Pedidos ativos" ligacao={activos.length > ACTIVOS_NO_INICIO ? "Ver todos" : undefined} aoCarregar={() => router.push("/pedidos")}>
        {activos.slice(0, ACTIVOS_NO_INICIO).map((p) => (
          <LinhaDoPedido
            key={p.id}
            servico={p.servico}
            segunda={[`Pedido #${p.id}`, p.cidade].filter(Boolean).join(" · ")}
            estado={p.estadoTexto}
            novidade={p.novidade}
            aoAbrir={() => router.push(`/pedido/${p.id}`)}
          />
        ))}
      </Seccao>
    );
  }
  if (doLink.length === 0) return null;
  return (
    <Seccao titulo="Pedidos ativos">
      {doLink.slice(0, ACTIVOS_NO_INICIO).map((s) => (
        <LinhaDoPedido
          key={s.pedidoId}
          servico={s.servico ?? "Pedido"}
          segunda={[`Pedido #${s.pedidoId}`, s.cidade].filter(Boolean).join(" · ")}
          estado="Aberto pelo link"
          novidade={null}
          aoAbrir={() => router.push(`/convidado/${s.pedidoId}`)}
        />
      ))}
    </Seccao>
  );
}

export default function Inicio() {
  const { catalogo, aLer, erro, recarregar } = useCatalogo();
  const { ligado } = useSessao();
  const { recarregar: recarregarOsPedidos } = usePedidos();

  if (!catalogo && aLer) return <Carregando />;
  const c = catalogo;
  const passos = (c?.info.comoFunciona ?? []).slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right", "bottom"]}>
      <Topo />
      <RolagemComTeclado
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 26 }}
        refreshControl={
          <RefreshControl
            refreshing={aLer}
            onRefresh={() => {
              recarregar();
              if (ligado) void recarregarOsPedidos();
            }}
            tintColor={CORES.ciano}
          />
        }
      >
        <VersaoNova />

        {/* 1. O cabeçalho curto: claro, com muito branco à volta. */}
        <View style={{ borderRadius: 24, backgroundColor: CORES.cianoFundo, padding: 20, gap: 12 }}>
          <Text titulo accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 21, fontWeight: "700", lineHeight: 27 }}>
            {TITULO_DO_INICIO}
          </Text>
          {c?.textos.subtituloInicial ? <Text style={{ color: CORES.suave, fontSize: 14, lineHeight: 20 }}>{c.textos.subtituloInicial}</Text> : null}
          <Pressable
            onPress={() => router.push("/pedir")}
            accessibilityRole="button"
            accessibilityLabel="Pedir orçamento"
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              backgroundColor: CORES.ciano,
              borderRadius: 14,
              minHeight: 48,
              paddingHorizontal: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
              Pedir orçamento
            </Text>
            <Ionicons name="arrow-forward" size={18} color={CORES.tinta} />
          </Pressable>
        </View>

        {/* Sem catálogo e sem cópia guardada: o erro e «Tentar outra vez» — nunca um ecrã vazio. */}
        {!c && erro ? (
          <View style={{ gap: 10 }}>
            <Aviso texto={erro} tom="aviso" />
            <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={recarregar} />
          </View>
        ) : null}

        {/* 2. Os pedidos activos, se houver. */}
        <PedidosActivos />

        {/* 3. Os serviços, em cartões coloridos, com o preço de referência. */}
        {c && c.servicos.length > 0 ? (
          <Seccao titulo="Serviços" ligacao="Ver todos" aoCarregar={() => router.push("/servicos")}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {c.servicos.map((s) => {
                const a = aparenciaDoServico(s.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push({ pathname: "/pedir", params: { servico: s.id } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Pedir orçamento para ${s.nome}`}
                    style={({ pressed }) => ({
                      flexBasis: 140,
                      flexGrow: 1,
                      minHeight: 116,
                      borderRadius: 20,
                      backgroundColor: a.tom.claro,
                      padding: 14,
                      gap: 8,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: CORES.fundo, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={a.icone as never} size={20} color={a.tom.forte} />
                    </View>
                    <Text titulo style={{ color: CORES.tinta, fontSize: 14, fontWeight: "600", lineHeight: 19 }} numberOfLines={2}>
                      {s.nome}
                    </Text>
                    {s.precoReferencia ? <PrecoDeReferencia texto={s.precoReferencia} tamanho={12} /> : null}
                  </Pressable>
                );
              })}
            </View>
            {c.textos.notaDosPrecos ? <Text style={{ color: CORES.suave, fontSize: 12, lineHeight: 17 }}>{c.textos.notaDosPrecos}</Text> : null}
          </Seccao>
        ) : null}

        {/* 4. Como funciona, curto: os três passos, só os títulos. */}
        {passos.length > 0 ? (
          <Seccao titulo="Como funciona" ligacao="Ver mais" aoCarregar={() => router.push("/info/como-funciona")}>
            {passos.map((p, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: CORES.cianoFundo, alignItems: "center", justifyContent: "center" }}>
                  <Text titulo style={{ color: CORES.marca, fontSize: 13, fontWeight: "700" }}>
                    {String(i + 1)}
                  </Text>
                </View>
                <Text style={{ flex: 1, color: CORES.tinta, fontSize: 14, lineHeight: 20 }}>{p.titulo}</Text>
              </View>
            ))}
          </Seccao>
        ) : null}

        {/* 5. O WhatsApp, numa linha. */}
        <Pressable
          onPress={() => whatsappDaClyon()}
          accessibilityRole="button"
          accessibilityLabel="Falar com a CLYON pelo WhatsApp"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: CORES.whatsappSuave, opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons name="logo-whatsapp" size={22} color={CORES.bom} />
          <Text titulo style={{ flex: 1, color: CORES.tinta, fontSize: 14.5, fontWeight: "600" }} numberOfLines={1}>
            Falar com a CLYON pelo WhatsApp
          </Text>
          <Ionicons name="chevron-forward" size={18} color={CORES.icone} />
        </Pressable>

        {c?.textos.fraseUnica ? <Text style={{ color: CORES.suave, fontSize: 12, lineHeight: 17 }}>{c.textos.fraseUnica}</Text> : null}
      </RolagemComTeclado>
    </SafeAreaView>
  );
}
