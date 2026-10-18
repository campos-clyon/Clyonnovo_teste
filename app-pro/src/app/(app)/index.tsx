import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Etiqueta, Mensagem } from "../../componentes/ui";
import { useSessao } from "../../estado/Sessao";
import { useTrabalhos } from "../../estado/Trabalhos";
import {
  contarPorSeparador,
  distanciaDe,
  etiquetaDoEstado,
  euros,
  haQuanto,
  imagensDe,
  quandoE,
  SEPARADORES,
  separadorDe,
  servicoDe,
  valorDoCartao,
  type Separador,
  type Trabalho,
} from "../../lib/trabalhos";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * OS TRABALHOS, nos mesmos separadores do painel: Novos, Em negociação,
 * Contratados, Terminados, Recusados. Abre nos Novos, ou no separador onde há
 * novidades.
 */
export default function Trabalhos() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { nome } = useSessao();
  const { trabalhos, carregando, erro, recarregar } = useTrabalhos();
  const [separador, setSeparador] = useState<Separador>("novos");
  const [aPuxar, setAPuxar] = useState(false);

  const contas = useMemo(() => contarPorSeparador(trabalhos), [trabalhos]);
  const visiveis = useMemo(() => trabalhos.filter((t) => separadorDe(t) === separador), [trabalhos, separador]);
  const separadores = SEPARADORES.filter((s) => s.id !== "arquivados" || contas.arquivados > 0);
  const vazio = SEPARADORES.find((s) => s.id === separador)?.vazio ?? "";

  async function puxar() {
    setAPuxar(true);
    await recarregar();
    setAPuxar(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo, paddingTop: margens.top }}>
      <View style={estilos.cabeca}>
        <Text style={[estilos.ola, { color: c.suave }]}>{nome ? `Olá, ${nome.split(" ")[0]}` : "Olá"}</Text>
        <Text style={[estilos.titulo, { color: c.tinta }]}>Trabalhos</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.separadores} style={{ flexGrow: 0 }}>
        {separadores.map((s) => {
          const activo = s.id === separador;
          const conta = contas[s.id];
          return (
            <Pressable
              key={s.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              onPress={() => setSeparador(s.id)}
              style={[
                estilos.separador,
                { backgroundColor: activo ? c.marca : c.superficie, borderColor: activo ? c.marca : c.linha },
              ]}
            >
              <Text style={{ color: activo ? c.sobreMarca : c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>
                {s.rotulo}
                {conta > 0 ? `  ${conta}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={visiveis}
        keyExtractor={(t) => String(t.negociacaoId)}
        contentContainerStyle={[estilos.lista, { paddingBottom: ESPACO.xxl }]}
        refreshControl={<RefreshControl refreshing={aPuxar} onRefresh={puxar} tintColor={c.marca} colors={[c.marca]} />}
        ListHeaderComponent={erro ? <Mensagem texto={erro} /> : null}
        ListEmptyComponent={
          carregando ? (
            <Text style={[estilos.vazio, { color: c.suave }]}>A carregar os trabalhos…</Text>
          ) : (
            <Text style={[estilos.vazio, { color: c.suave }]}>{vazio}</Text>
          )
        }
        renderItem={({ item, index }) => (
          <Cartao trabalho={item} novo={separador === "novos" && !item.abertoEm && index < 5} />
        )}
      />
    </View>
  );
}

/** O ícone de cada serviço, para os pedidos que chegam sem fotografia. */
const ICONE: Record<string, keyof typeof Ionicons.glyphMap> = {
  recolha_entulho: "construct-outline",
  recolha_monos: "cube-outline",
  recolha_moveis: "bed-outline",
  esvaziamento_casa: "home-outline",
  esvaziamento_apartamento: "business-outline",
  mudanca: "car-outline",
  montagem_moveis: "hammer-outline",
  jardinagem: "leaf-outline",
  manutencao_casa: "build-outline",
};

function Cartao({ trabalho: t, novo }: { trabalho: Trabalho; novo: boolean }) {
  const c = useCores();
  const foto = imagensDe(t.filesJson)[0];
  const valor = valorDoCartao(t);
  const estado = etiquetaDoEstado(t);
  const onde = [t.city, distanciaDe(t)].filter(Boolean).join(" · ");
  const quando = quandoE(t);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${servicoDe(t)}${t.city ? ` em ${t.city}` : ""}`}
      onPress={() => router.push(`/trabalho/${t.negociacaoId}`)}
      style={({ pressed }) => [
        estilos.cartao,
        { backgroundColor: c.superficie, borderColor: novo ? c.marca : c.linha, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={estilos.linhaDeCima}>
        {foto ? (
          <Image source={{ uri: foto }} style={[estilos.foto, { backgroundColor: c.fundo }]} />
        ) : (
          <View style={[estilos.foto, { backgroundColor: c.marcaSuave, alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name={ICONE[t.serviceType ?? ""] ?? "briefcase-outline"} size={30} color={c.marca} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={estilos.etiquetas}>
            {novo ? <Etiqueta texto="novo" /> : null}
            {t.ofertaClyon ? <Etiqueta texto="Trabalho CLYON" tom="bom" /> : null}
            {estado ? <Etiqueta texto={estado} tom={estado.includes("sua") || estado === "por fazer" ? "aviso" : "neutro"} /> : null}
          </View>
          <Text style={[estilos.servico, { color: c.tinta }]} numberOfLines={1}>
            {servicoDe(t)}
          </Text>
          {onde ? <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>{onde}</Text> : null}
          <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>
            {[quando, haQuanto(t.criadoEm ?? t.actualizadoEm)].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </View>
      {valor ? (
        <View style={[estilos.valor, { borderColor: c.linha }]}>
          <Text style={[estilos.numero, { color: c.bom }]}>{euros(valor.valor)}</Text>
          <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>
            {valor.legenda}
            {t.baseDoPreco === "carga" ? " · por carga" : t.baseDoPreco === "hora" ? " · por hora" : ""}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cabeca: { paddingHorizontal: ESPACO.l, paddingTop: ESPACO.l, paddingBottom: ESPACO.s },
  ola: { fontSize: LETRA.pequena + 1, fontWeight: "600" },
  titulo: { fontSize: LETRA.grande, fontWeight: "800" },
  separadores: { paddingHorizontal: ESPACO.l, gap: ESPACO.s, paddingVertical: ESPACO.s },
  separador: { borderWidth: 1, borderRadius: 999, paddingHorizontal: ESPACO.m, paddingVertical: ESPACO.s },
  lista: { paddingHorizontal: ESPACO.l, paddingTop: ESPACO.s, gap: ESPACO.m },
  vazio: { textAlign: "center", fontSize: LETRA.normal, lineHeight: 23, paddingHorizontal: ESPACO.l, paddingTop: ESPACO.xxl },
  cartao: { borderWidth: 1, borderRadius: RAIO.l, padding: ESPACO.m, gap: ESPACO.m },
  linhaDeCima: { flexDirection: "row", gap: ESPACO.m },
  foto: { width: 72, height: 72, borderRadius: RAIO.m },
  etiquetas: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  servico: { fontSize: LETRA.media, fontWeight: "700" },
  valor: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: ESPACO.s, flexDirection: "row", alignItems: "baseline", gap: ESPACO.s, flexWrap: "wrap" },
  numero: { fontSize: LETRA.titulo, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
