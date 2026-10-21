import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../componentes/Texto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mensagem } from "../../componentes/ui";
import { BordaABrilhar } from "../../componentes/BordaABrilhar";
import { VersaoNova } from "../../componentes/VersaoNova";
import { dataEHora } from "../../../../src/lib/historico-negociacao";
import { useSessao } from "../../estado/Sessao";
import { useTrabalhos } from "../../estado/Trabalhos";
import {
  contarPorSeparador,
  ORDENS,
  ordenarTrabalhos,
  paraOsSinaisDe,
  porOrdemDeChegada,
  type Ordem,
  distanciaDe,
  estadoCurto,
  euros,
  imagensDe,
  quandoCurto,
  SEPARADORES,
  separadorDe,
  servicoDe,
  valorDoCartao,
  type Separador,
  type Trabalho,
} from "../../lib/trabalhos";
import { porKmPorExtenso, sinaisDoTrabalho } from "../../../../src/lib/sinais-do-trabalho";
import { ESPACO, LETRA, RAIO, useCores, type Cores } from "../../tema";

/**
 * OS TRABALHOS, nos mesmos separadores do painel: Novos, Negociação,
 * Contratados, Terminados, Recusados.
 *
 * Feito para o telemóvel: os cartões têm todos a MESMA ALTURA, seja qual for o
 * pedido, e cada informação ocupa uma linha curta que corta com «…» em vez de
 * empurrar o cartão. Assim a lista lê-se de relance e o polegar acerta sempre.
 */
const ALTURA_DO_CARTAO = 104;

export default function Trabalhos() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { nome } = useSessao();
  const { trabalhos, carregando, erro, lidaEm, recarregar } = useTrabalhos();
  const [separador, setSeparador] = useState<Separador>("novos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [aPuxar, setAPuxar] = useState(false);

  const contas = useMemo(() => contarPorSeparador(trabalhos), [trabalhos]);
  // Por omissão, o último a chegar em cima e o mais antigo em baixo. Nos Novos
  // e na Negociação escolhe-se outra ordem, como no painel.
  const comOrdem = separador === "novos" || separador === "negociacao";
  const visiveis = useMemo(() => {
    const lista = trabalhos.filter((t) => separadorDe(t) === separador);
    return comOrdem ? ordenarTrabalhos(lista, ordem, separador) : porOrdemDeChegada(lista);
  }, [trabalhos, separador, ordem, comOrdem]);
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
        <Text style={[estilos.titulo, { color: c.tinta }]}>Trabalhos</Text>
        <Text style={[estilos.ola, { color: c.suave }]} numberOfLines={1}>
          {nome ? `Olá, ${nome.split(" ")[0]}` : ""}
        </Text>
      </View>

      {/* Separadores: altura fixa e o número num círculo, para nunca cortarem. */}
      <View style={estilos.faixa}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.separadores}>
          {separadores.map((s) => {
            const activo = s.id === separador;
            const conta = contas[s.id];
            return (
              <Pressable
                key={s.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`${s.rotulo}, ${conta}`}
                onPress={() => setSeparador(s.id)}
                style={[estilos.separador, { backgroundColor: activo ? c.marca : c.superficie, borderColor: activo ? c.marca : c.linha }]}
              >
                <Text style={[estilos.rotuloDoSeparador, { color: activo ? c.sobreMarca : c.tinta }]} numberOfLines={1}>
                  {s.rotulo}
                </Text>
                {conta > 0 ? (
                  <View style={[estilos.circulo, { backgroundColor: activo ? c.sobreMarca : c.marcaSuave }]}>
                    <Text style={[estilos.numeroDoCirculo, { color: c.marca }]}>{conta > 99 ? "99+" : conta}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={visiveis}
        keyExtractor={(t) => String(t.negociacaoId)}
        contentContainerStyle={estilos.lista}
        getItemLayout={(_, i) => ({ length: ALTURA_DO_CARTAO + ESPACO.s, offset: (ALTURA_DO_CARTAO + ESPACO.s) * i, index: i })}
        ItemSeparatorComponent={() => <View style={{ height: ESPACO.s }} />}
        refreshControl={<RefreshControl refreshing={aPuxar} onRefresh={puxar} tintColor={c.marca} colors={[c.marca]} />}
        ListHeaderComponent={
          <>
            <VersaoNova />
            {erro && lidaEm ? (
              <View style={{ marginBottom: ESPACO.s }}>
                <Mensagem
                  tom="aviso"
                  texto={`Sem ligação. Esta é a lista de ${dataEHora(lidaEm)}; volta a actualizar quando houver rede.`}
                />
              </View>
            ) : erro ? (
              <View style={{ marginBottom: ESPACO.s }}><Mensagem texto={erro} /></View>
            ) : null}
            {comOrdem && visiveis.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.ordens}>
                <Ionicons name="swap-vertical" size={16} color={c.suave} />
                {ORDENS.map((o) => {
                  const activa = o.id === ordem;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => setOrdem(o.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: activa }}
                      style={[estilos.ordem, { borderColor: activa ? c.marca : c.linha, backgroundColor: activa ? c.marcaSuave : "transparent" }]}
                    >
                      <Text style={{ color: activa ? c.marca : c.suave, fontSize: LETRA.pequena, fontWeight: "700" }}>{o.rotulo}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <Text style={[estilos.vazio, { color: c.suave }]}>{carregando ? "A carregar os trabalhos…" : vazio}</Text>
        }
        renderItem={({ item }) => <Cartao trabalho={item} porAbrir={!item.abertoEm} separador={separador} />}
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

function Pastilha({ texto, tom, c }: { texto: string; tom: "marca" | "bom" | "aviso" | "neutro"; c: Cores }) {
  const [fundo, tinta] = {
    marca: [c.marcaSuave, c.marca],
    bom: [c.bomSuave, c.bom],
    aviso: [c.avisoSuave, c.aviso],
    neutro: [c.fundo, c.suave],
  }[tom];
  return (
    <View style={[estilos.pastilha, { backgroundColor: fundo }]}>
      <Text style={[estilos.textoDaPastilha, { color: tinta }]} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

function Cartao({ trabalho: t, porAbrir, separador }: { trabalho: Trabalho; porAbrir: boolean; separador: Separador }) {
  const c = useCores();
  // Os sinais do painel («perto», «hoje», «bem pago») e o €/km — só nos que ainda se decidem.
  const aDecidir = separador === "novos" || separador === "negociacao";
  const paraOsSinais = aDecidir ? paraOsSinaisDe(t, separador) : null;
  const sinais = paraOsSinais ? sinaisDoTrabalho(paraOsSinais) : [];
  const porKm = paraOsSinais ? porKmPorExtenso(paraOsSinais) : null;
  // Uma fotografia que não abre (ficheiro apagado, formato do iPhone) dá o
  // ícone do serviço, e não um quadrado vazio.
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const foto = fotoFalhou ? undefined : imagensDe(t.filesJson)[0];
  const valor = valorDoCartao(t);
  const estado = estadoCurto(t);
  const onde = [t.city, distanciaDe(t)].filter(Boolean).join(" · ");
  const porUnidade = t.baseDoPreco === "carga" ? " / carga" : t.baseDoPreco === "hora" ? " / hora" : "";

  return (
    // O brilho (sombra na cor da CLYON) vive no invólucro: o cartão corta o que
    // lhe sai das bordas, e a sombra é precisamente o que sai.
    <View style={[estilos.involucro, porAbrir && [estilos.brilho, { shadowColor: c.marca, backgroundColor: c.superficie }]]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${porAbrir ? "Por abrir: " : ""}${servicoDe(t)}${t.city ? ` em ${t.city}` : ""}${valor ? `, ${euros(valor.valor)}` : ""}`}
      onPress={() => router.push(`/trabalho/${t.negociacaoId}`)}
      style={({ pressed }) => [
        estilos.cartao,
        { backgroundColor: c.superficie, borderColor: porAbrir ? c.marca : c.linha, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {foto ? (
        <Image source={{ uri: foto }} onError={() => setFotoFalhou(true)} style={[estilos.foto, { backgroundColor: c.fundo }]} />
      ) : (
        <View style={[estilos.foto, estilos.semFoto, { backgroundColor: c.marcaSuave }]}>
          <Ionicons name={ICONE[t.serviceType ?? ""] ?? "briefcase-outline"} size={28} color={c.marca} />
        </View>
      )}

      <View style={estilos.coluna}>
        <View style={estilos.linha}>
          <Text style={[estilos.servico, { color: c.tinta }]} numberOfLines={1}>
            {servicoDe(t)}
          </Text>
          {valor ? (
            <Text style={[estilos.valor, { color: c.bom }]} numberOfLines={1}>
              {euros(valor.valor)}
            </Text>
          ) : null}
        </View>

        <View style={estilos.linha}>
          <Text style={[estilos.detalhe, { color: c.suave }]} numberOfLines={1}>
            {onde || "—"}
          </Text>
          {valor ? (
            <Text style={[estilos.legenda, { color: c.suave }]} numberOfLines={1}>
              {(t.ofertaClyon ? "fixo" : "a receber") + porUnidade}
            </Text>
          ) : null}
        </View>

        <Text style={[estilos.detalhe, { color: c.suave }]} numberOfLines={1}>
          {quandoCurto(t) ?? "Sem data"}
        </Text>

        <View style={estilos.pastilhas}>
          {porAbrir ? <Pastilha texto="Novo" tom="marca" c={c} /> : null}
          {estado ? <Pastilha texto={estado.texto} tom={estado.tom} c={c} /> : null}
          {sinais.map((s) => (
            <Pastilha key={s.chave} texto={`${s.emoji} ${s.texto}`} tom={s.chave === "bem_pago" ? "bom" : "aviso"} c={c} />
          ))}
          {porKm ? <Pastilha texto={porKm} tom="neutro" c={c} /> : null}
          {t.ofertaClyon ? <Pastilha texto="CLYON" tom="bom" c={c} /> : null}
        </View>
      </View>
    </Pressable>
    {porAbrir ? <BordaABrilhar cor={c.marca} raio={RAIO.l} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabeca: {
    paddingHorizontal: ESPACO.l,
    paddingTop: ESPACO.m,
    paddingBottom: ESPACO.xs,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: ESPACO.m,
  },
  titulo: { fontSize: LETRA.titulo + 2, fontWeight: "800" },
  ola: { fontSize: LETRA.pequena + 1, fontWeight: "600", flexShrink: 1 },
  faixa: { height: 52, justifyContent: "center" },
  separadores: { paddingHorizontal: ESPACO.l, gap: ESPACO.s, alignItems: "center" },
  separador: {
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: ESPACO.m,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rotuloDoSeparador: { fontSize: LETRA.pequena + 1, fontWeight: "700" },
  circulo: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  numeroDoCirculo: { fontSize: 11, fontWeight: "800", fontVariant: ["tabular-nums"] },
  lista: { paddingHorizontal: ESPACO.l, paddingTop: ESPACO.xs, paddingBottom: ESPACO.xxl },
  ordens: { alignItems: "center", gap: 6, paddingBottom: ESPACO.s },
  ordem: { borderWidth: 1, borderRadius: 999, paddingHorizontal: ESPACO.s + 2, paddingVertical: 5 },
  vazio: { textAlign: "center", fontSize: LETRA.normal, lineHeight: 22, paddingHorizontal: ESPACO.l, paddingTop: ESPACO.xxl },
  involucro: { borderRadius: RAIO.l },
  brilho: { shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  cartao: {
    height: ALTURA_DO_CARTAO,
    borderWidth: 1,
    borderRadius: RAIO.l,
    padding: ESPACO.s + 2,
    flexDirection: "row",
    gap: ESPACO.m,
    overflow: "hidden",
  },
  foto: { width: 80, height: 82, borderRadius: RAIO.m },
  semFoto: { alignItems: "center", justifyContent: "center" },
  coluna: { flex: 1, minWidth: 0, justifyContent: "space-between" },
  linha: { flexDirection: "row", alignItems: "baseline", gap: ESPACO.s },
  servico: { flex: 1, fontSize: LETRA.normal, fontWeight: "700" },
  valor: { fontSize: LETRA.media, fontWeight: "800", fontVariant: ["tabular-nums"] },
  detalhe: { flex: 1, fontSize: LETRA.pequena + 1 },
  legenda: { fontSize: 11 },
  pastilhas: { flexDirection: "row", gap: 6, overflow: "hidden" },
  pastilha: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  textoDaPastilha: { fontSize: 11, fontWeight: "700" },
});
