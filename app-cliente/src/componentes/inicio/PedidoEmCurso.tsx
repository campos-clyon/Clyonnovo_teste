import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { Text } from "../Texto";
import { useCatalogo } from "../../estado/Catalogo";
import { usePedidos } from "../../estado/Pedidos";
import { useSessao } from "../../estado/Sessao";
import { sessoesDeConvidado } from "../../lib/convidado";
import type { SessaoDeConvidado } from "../../lib/pedido-do-link";
import { noSeparador, type PedidoNaLista } from "../../lib/pedidos";
import { aparenciaDoServico, CORES } from "../../tema";

/**
 * O PEDIDO EM CURSO — d148 (27-11-2026): o primeiro bloco do Início, quando há.
 *
 * Um cartão escuro com o serviço, «Pedido #N, cidade», a novidade em letra
 * grande (os textos de `novidadeDoPedido` do site: «2 propostas novas», «Por
 * pagar», «Confirme o trabalho»…) e um botão para o passo seguinte. Sem
 * novidade, o estado em palavras (`estadoTexto`). Com mais de um, passam para o
 * lado. Sem pedidos em curso, nada.
 */

/** Quantos pedidos em curso se vêem no Início; o resto está em «Pedidos». */
export const EM_CURSO_NO_INICIO = 3;

type Cartao = { chave: string; servico: string; segunda: string; titulo: string; linha: string | null; botao: string; aoAbrir: () => void };

/** O botão diz o que vem a seguir: com propostas, vê-las; com o resto, abrir o pedido. */
export function botaoDoPedido(novidade: string | null): string {
  return novidade && /proposta/i.test(novidade) ? "Ver as propostas" : "Abrir o pedido";
}

function CartaoDoPedido({ c, largura, icone }: { c: Cartao; largura: number; icone: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${c.servico}, ${c.segunda}, ${c.titulo}`}
      style={{ width: largura, borderRadius: 22, backgroundColor: CORES.tinta, padding: 16, gap: 14, overflow: "hidden" }}
    >
      <View style={{ position: "absolute", right: -40, top: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: CORES.ciano, opacity: 0.18 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icone as never} size={21} color={CORES.cianoClaro} />
        </View>
        <View style={{ flex: 1 }}>
          <Text titulo style={{ color: CORES.sobreMarca, fontSize: 14.5, fontWeight: "600" }} numberOfLines={1}>
            {c.servico}
          </Text>
          <Text style={{ color: CORES.sobreMarcaSuave, fontSize: 12.5 }} numberOfLines={1}>
            {c.segunda}
          </Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Text titulo style={{ color: CORES.sobreMarca, fontSize: 22, fontWeight: "700", lineHeight: 27 }}>
          {c.titulo}
        </Text>
        {c.linha ? <Text style={{ color: CORES.sobreMarcaSuave, fontSize: 13, lineHeight: 18 }}>{c.linha}</Text> : null}
      </View>
      <Pressable
        onPress={c.aoAbrir}
        accessibilityRole="button"
        accessibilityLabel={`${c.botao}: ${c.servico}`}
        style={({ pressed }) => ({ minHeight: 48, borderRadius: 14, backgroundColor: CORES.ciano, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}
      >
        <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
          {c.botao}
        </Text>
      </Pressable>
    </View>
  );
}

export function PedidosEmCurso() {
  const { ligado } = useSessao();
  const { pedidos } = usePedidos();
  const { catalogo } = useCatalogo();
  const { width } = useWindowDimensions();
  const [doLink, setDoLink] = useState<SessaoDeConvidado[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (ligado) return;
      void sessoesDeConvidado().then(setDoLink).catch(() => setDoLink([]));
    }, [ligado]),
  );

  const cartoes: Cartao[] = ligado
    ? pedidos
        .filter((p: PedidoNaLista) => noSeparador(p, "em_aberto"))
        .slice(0, EM_CURSO_NO_INICIO)
        .map((p) => ({
          chave: String(p.id),
          servico: p.servico,
          segunda: [`Pedido #${p.id}`, p.cidade].filter(Boolean).join(", "),
          titulo: p.novidade ?? p.estadoTexto,
          linha: p.novidade && /proposta/i.test(p.novidade) ? "Compare e escolha a que preferir, ou nenhuma." : p.novidade ? p.estadoTexto : null,
          botao: botaoDoPedido(p.novidade),
          aoAbrir: () => router.push(`/pedido/${p.id}`),
        }))
    : doLink.slice(0, EM_CURSO_NO_INICIO).map((s) => ({
        chave: String(s.pedidoId),
        servico: s.servico ?? "Pedido",
        segunda: [`Pedido #${s.pedidoId}`, s.cidade].filter(Boolean).join(", "),
        titulo: "Aberto pela ligação",
        linha: null,
        botao: "Abrir o pedido",
        aoAbrir: () => router.push(`/convidado/${s.pedidoId}`),
      }));
  if (cartoes.length === 0) return null;

  const iconeDe = (servico: string) => aparenciaDoServico(catalogo?.servicos.find((s) => s.nome === servico)?.id).icone;
  if (cartoes.length === 1) return <CartaoDoPedido c={cartoes[0]} largura={width - 40} icone={iconeDe(cartoes[0].servico)} />;

  // Vários: passam para o lado, e o seguinte espreita à direita para se ver que há mais.
  const largura = width - 64;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={largura + 10}
      decelerationRate="fast"
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      accessibilityLabel={`${cartoes.length} pedidos em curso`}
    >
      {cartoes.map((c) => (
        <CartaoDoPedido key={c.chave} c={c} largura={largura} icone={iconeDe(c.servico)} />
      ))}
    </ScrollView>
  );
}
