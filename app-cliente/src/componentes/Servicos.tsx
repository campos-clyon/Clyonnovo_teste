import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Ligacao, PrecoDeReferencia } from "./ui";
import type { GrupoDePrecos } from "../lib/catalogo";
import type { ServicoDoCatalogo } from "../lib/novo-pedido";
import { aparenciaDoServico, CORES, type Tom } from "../tema";

/**
 * SERVIÇOS (maqueta 2, v3) — só os de hoje, os do simulador (R7), cada um com
 * o que inclui e o preço de referência com o IVA ao lado. Por baixo do
 * serviço, as linhas da grelha de `/precos` que são dele (a tabela à hora da
 * mudança, os sacos e o m³ do entulho, as tipologias…), tal como a API as
 * escreve. Tocar em «Pedir» abre o pedido com o serviço escolhido.
 */

export function TabelaDePrecos({ grupo, tom }: { grupo: GrupoDePrecos; tom: Tom }) {
  return (
    <View style={{ borderRadius: 15, backgroundColor: tom.claro, paddingHorizontal: 14, paddingVertical: 4 }}>
      {grupo.titulo ? (
        <Text titulo style={{ color: CORES.tinta, fontSize: 13, fontWeight: "600", paddingTop: 9 }}>
          {grupo.titulo}
        </Text>
      ) : null}
      {grupo.linhas.map((l, i) => (
        <View key={i} style={{ paddingVertical: 9, borderTopWidth: i === 0 && !grupo.titulo ? 0 : 1, borderTopColor: CORES.linha, gap: 2 }}>
          {l.rotulo ? (
            <Text titulo style={{ color: CORES.tinta, fontSize: 13, fontWeight: "600" }}>
              {l.rotulo}
            </Text>
          ) : null}
          <PrecoDeReferencia texto={l.texto} tamanho={13.5} />
        </View>
      ))}
    </View>
  );
}

export function CartaoDoServico({ s, grupos }: { s: ServicoDoCatalogo; grupos: GrupoDePrecos[] }) {
  const a = aparenciaDoServico(s.id);
  return (
    <View style={{ borderRadius: 22, borderWidth: 1, borderColor: CORES.linha, padding: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: a.tom.claro, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={a.icone as never} size={22} color={a.tom.forte} />
        </View>
        <View style={{ flex: 1, gap: 3, paddingTop: 2 }}>
          <Text titulo style={{ color: CORES.tinta, fontSize: 16, fontWeight: "600" }}>
            {s.nome}
          </Text>
          {s.inclui ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{s.inclui}</Text> : null}
        </View>
      </View>
      {s.precoReferencia ? (
        <Pressable
          onPress={() => router.push({ pathname: "/pedir", params: { servico: s.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Pedir orçamento para ${s.nome}`}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: a.tom.claro, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 11, opacity: pressed ? 0.7 : 1 })}
        >
          <View style={{ flex: 1 }}>
            <PrecoDeReferencia texto={s.precoReferencia} />
          </View>
          <Text titulo style={{ color: a.tom.forte, fontSize: 13.5, fontWeight: "600" }}>
            Pedir
          </Text>
          <Ionicons name="chevron-forward" size={16} color={a.tom.forte} />
        </Pressable>
      ) : (
        <Ligacao titulo={`Pedir orçamento para ${s.nome}`} aoCarregar={() => router.push({ pathname: "/pedir", params: { servico: s.id } })} />
      )}
      {grupos.map((g, i) => (
        <TabelaDePrecos key={i} grupo={g} tom={a.tom} />
      ))}
    </View>
  );
}
