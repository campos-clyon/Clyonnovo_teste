import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Aviso, Botao, Carregando, Paragrafo, Titulo } from "../../componentes/ui";
import { VersaoNova } from "../../componentes/VersaoNova";
import { usePedidos } from "../../estado/Pedidos";
import { useSessao } from "../../estado/Sessao";
import { sessoesDeConvidado } from "../../lib/convidado";
import { LINK, type SessaoDeConvidado } from "../../lib/pedido-do-link";
import { pedir } from "../../lib/api";
import { noSeparador, rotaDaLista, SEPARADORES, type ExtrasDaListaV3, type PedidoNaLista, type RespostaDaLista, type Separador } from "../../lib/pedidos";
import { CORES } from "../../tema";

/**
 * E2 v3 — PEDIDOS.
 *
 * COM CONTA (R4): um cartão por pedido, todos da mesma altura, uma linha por
 * informação — o serviço, «Pedido #482 · Lisboa», o estado em palavras
 * (`estadoTexto`, a tabela única do site) e a novidade. Os separadores do
 * site: Todos · Em aberto · Concluídos · Cancelados. A ordem é a da API (a app
 * não reordena). Sem rede, a última lista guardada, e di-lo.
 *
 * SEM CONTA (E2c): os pedidos abertos pelo link neste telemóvel (as sessões de
 * convidado guardadas — A9, com a S16), e o convite a entrar.
 */

/** A altura fixa do cartão: a letra cresce até 1,2×, o cartão não. */
const ALTURA_DO_CARTAO = 104;

function CartaoDoPedido({ p, aoAbrir }: { p: PedidoNaLista & ExtrasDaListaV3; aoAbrir: () => void }) {
  const segunda = [`Pedido #${p.id}`, p.cidade].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.servico}, ${segunda}, ${p.estadoTexto}${p.novidade ? `, ${p.novidade}` : ""}`}
      onPress={aoAbrir}
      style={({ pressed }) => ({
        height: ALTURA_DO_CARTAO,
        borderWidth: p.novidade ? 1.5 : 1,
        borderColor: p.novidade ? CORES.marca : CORES.linha,
        borderRadius: 20,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: CORES.fundo,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {p.fotografia ? (
        <Image source={{ uri: p.fotografia }} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: CORES.superficie }} />
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text titulo style={{ flex: 1, color: CORES.tinta, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
            {p.servico}
          </Text>
          {p.novidade ? (
            <Text style={{ color: CORES.marca, fontSize: 12.5, fontWeight: "700", maxWidth: 150 }} numberOfLines={1}>
              {p.novidade}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: CORES.suave, fontSize: 13.5 }} numberOfLines={1}>
          {segunda}
        </Text>
        <Text style={{ color: CORES.tinta, fontSize: 13.5, fontWeight: "600" }} numberOfLines={1}>
          {p.estadoTexto}
        </Text>
      </View>
    </Pressable>
  );
}

function Separadores({ valor, aoEscolher }: { valor: Separador; aoEscolher: (s: Separador) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {SEPARADORES.map((s) => {
        const escolhido = s.id === valor;
        return (
          <Pressable
            key={s.id}
            onPress={() => aoEscolher(s.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: escolhido }}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              minHeight: 38,
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: escolhido ? CORES.tinta : CORES.superficie,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text titulo style={{ color: escolhido ? CORES.sobreMarca : CORES.tinta, fontSize: 13.5, fontWeight: "600" }}>
              {s.nome}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ComConta() {
  const { pedidos, aLer, erro, guardadaEm, haMais, recarregar, maisUma } = usePedidos();
  const [separador, setSeparador] = useState<Separador>("todos");
  // Os outros separadores vêm filtrados pela R4 (`?status=`, S22); sem rede, filtra-se o que há, pela mesma ordem.
  const [doSeparador, setDoSeparador] = useState<PedidoNaLista[] | null>(null);
  useEffect(() => {
    setDoSeparador(null);
    if (separador === "todos") return;
    let vivo = true;
    pedir<RespostaDaLista>(rotaDaLista(1, separador))
      .then((r) => vivo && setDoSeparador(r.pedidos))
      .catch(() => vivo && setDoSeparador(null));
    return () => {
      vivo = false;
    };
  }, [separador, pedidos]);
  const visiveis = separador === "todos" ? pedidos : doSeparador ?? pedidos.filter((p) => noSeparador(p, separador));

  if (aLer && pedidos.length === 0 && !erro) return <Carregando />;

  return (
    <FlatList
      data={visiveis}
      keyExtractor={(p) => String(p.id)}
      renderItem={({ item }) => <CartaoDoPedido p={item} aoAbrir={() => router.push(`/pedido/${item.id}`)} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      getItemLayout={(_, i) => ({ length: ALTURA_DO_CARTAO + 10, offset: (ALTURA_DO_CARTAO + 10) * i, index: i })}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={aLer} onRefresh={() => void recarregar()} tintColor={CORES.marca} />}
      onEndReached={() => {
        if (haMais) void maisUma();
      }}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 16 }}>
          <VersaoNova />
          <Titulo>Pedidos</Titulo>
          <Separadores valor={separador} aoEscolher={setSeparador} />
          {guardadaEm ? <Aviso tom="aviso" texto="Sem ligação — a mostrar o que tinha guardado." /> : null}
          {erro ? (
            <View style={{ gap: 10 }}>
              <Aviso tom="mau" texto={erro} />
              <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={() => void recarregar()} />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        erro ? null : pedidos.length > 0 ? (
          <Paragrafo suave>Nenhum pedido neste separador.</Paragrafo>
        ) : (
          <View style={{ gap: 14 }}>
            <Paragrafo>Ainda não tem pedidos.</Paragrafo>
            <Botao titulo="Pedir orçamento" aoCarregar={() => router.push("/pedir")} />
            <Paragrafo pequeno suave>
              Fez o pedido pelo WhatsApp? Abra o link do pedido neste telemóvel para o juntar aqui.
            </Paragrafo>
          </View>
        )
      }
    />
  );
}

function SemConta() {
  const [sessoes, setSessoes] = useState<SessaoDeConvidado[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      void sessoesDeConvidado().then(setSessoes);
    }, []),
  );
  if (sessoes === null) return <Carregando />;
  return (
    <RolagemComTeclado contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
      <Titulo>{sessoes.length > 0 ? LINK.e2cTitulo : "Pedidos"}</Titulo>
      {sessoes.map((s) => (
        <CartaoDoPedido
          key={s.pedidoId}
          p={{ id: s.pedidoId, servico: s.servico ?? "Pedido", cidade: s.cidade, criadoEm: null, criadoEmTexto: null, estadoTexto: "Aberto pelo link", novidade: null, trabalhoClyon: false }}
          aoAbrir={() => router.push(`/convidado/${s.pedidoId}`)}
        />
      ))}
      {sessoes.length === 0 ? <Paragrafo suave>{LINK.e2cVazio}</Paragrafo> : null}
      <View style={{ borderRadius: 20, backgroundColor: CORES.marcaSuave, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Ionicons name="person-circle-outline" size={22} color={CORES.marca} />
          <Text style={{ flex: 1, color: CORES.tinta, fontSize: 14.5, lineHeight: 20 }}>{LINK.e2cEntrar}</Text>
        </View>
        <Botao titulo="Entrar" aoCarregar={() => router.push({ pathname: "/entrar", params: { para: "pedidos" } })} />
      </View>
      <Botao titulo="Pedir orçamento" tipo="secundario" aoCarregar={() => router.push("/pedir")} />
    </RolagemComTeclado>
  );
}

export default function Pedidos() {
  const { ligado } = useSessao();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right", "bottom"]}>
      {ligado ? <ComConta /> : <SemConta />}
    </SafeAreaView>
  );
}
