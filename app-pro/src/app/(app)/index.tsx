import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../componentes/Texto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mensagem } from "../../componentes/ui";
import { BordaABrilhar } from "../../componentes/BordaABrilhar";
import { VersaoNova } from "../../componentes/VersaoNova";
import { dataEHora } from "../../../../src/lib/historico-negociacao";
import { useSessao } from "../../estado/Sessao";
import { useTrabalhos } from "../../estado/Trabalhos";
import { useConta } from "../../estado/Conta";
import {
  cincoPorAbrir,
  contarPorSeparador,
  linhasDaLista,
  naOrdemDaRota,
  ORDENS,
  ordenarTrabalhos,
  paraOsSinaisDe,
  chaveDoGrupo,
  RECUSA,
  tempoDoCartao,
  type LinhaDaLista,
  type TomDoGrupo,
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
import {
  linhaDosPedidosNovos,
  MARCAR_TUDO_COMO_LIDO,
  numeroDoSino,
  SEM_AVISOS,
  TITULO_DOS_AVISOS,
} from "../../../../src/lib/avisos-do-profissional";
import { ESPACO, LETRA, RAIO, useCores, type Cores } from "../../tema";

/**
 * OS TRABALHOS, nos mesmos separadores do painel: Feed, Em negociação,
 * Contratados, Terminados, Recusados e Arquivados (com os nomes do painel
 * desde 29-10-2026, A14). Nos Contratados, Terminados e Recusados, os grupos
 * do painel; no cartão, há quanto tempo mexeu e, nos Recusados, porquê.
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
  const { trabalhos, carregando, erro, lidaEm, recarregar, porLer, pedidosNovos, verPedidosNovos } = useTrabalhos();
  const { carteira } = useConta();
  const [separador, setSeparador] = useState<Separador>("novos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [aPuxar, setAPuxar] = useState(false);
  const [sinoAberto, setSinoAberto] = useState(false);
  // A linha dos pedidos novos é de uma visita só: ao sair do Feed, já foi vista.
  useFocusEffect(useCallback(() => () => verPedidosNovos(), [verPedidosNovos]));
  const linhaDosNovos = linhaDosPedidosNovos(pedidosNovos);
  const numeroNoSino = numeroDoSino(porLer);

  const contas = useMemo(() => contarPorSeparador(trabalhos), [trabalhos]);
  const porAbrir = useMemo(() => cincoPorAbrir(trabalhos), [trabalhos]);
  // Como no painel: nos Novos e na Negociação escolhe-se a ordem («Recentes»
  // é o que mexeu há menos tempo); nos outros, a ordem da rota, por grupos.
  const comOrdem = separador === "novos" || separador === "negociacao";
  const visiveis = useMemo(() => {
    const lista = trabalhos.filter((t) => separadorDe(t) === separador);
    return comOrdem ? ordenarTrabalhos(lista, ordem, separador) : naOrdemDaRota(lista);
  }, [trabalhos, separador, ordem, comOrdem]);
  const linhas = useMemo(() => linhasDaLista(visiveis, separador), [visiveis, separador]);
  // Os seis, sempre — como no painel (os Arquivados apareciam só com algum lá dentro).
  const separadores = SEPARADORES;
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
        <View style={estilos.direita}>
          <Text style={[estilos.ola, { color: c.suave }]} numberOfLines={1}>
            {nome ? `Olá, ${nome.split(" ")[0]}` : ""}
          </Text>
          {/* O sino (d13): os avisos saíram do meio do Feed para aqui, com o número por ler. */}
          <Pressable
            onPress={() => setSinoAberto(true)}
            accessibilityRole="button"
            accessibilityLabel={porLer > 0 ? `${TITULO_DOS_AVISOS}, ${porLer} por ler` : TITULO_DOS_AVISOS}
            hitSlop={8}
            style={({ pressed }) => [estilos.sino, { borderColor: c.linha, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="notifications-outline" size={20} color={c.tinta} />
            {numeroNoSino ? (
              <View style={[estilos.numeroDoSino, { backgroundColor: c.marca, borderColor: c.fundo }]}>
                <Text style={[estilos.textoDoNumeroDoSino, { color: c.sobreMarca }]}>{numeroNoSino}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
      <Sino aberto={sinoAberto} onFechar={() => setSinoAberto(false)} />

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

      <FlatList<LinhaDaLista>
        data={linhas}
        keyExtractor={(l) => (l.tipo === "grupo" ? `grupo-${l.grupo.chave}` : String(l.trabalho.negociacaoId))}
        contentContainerStyle={estilos.lista}
        ItemSeparatorComponent={() => <View style={{ height: ESPACO.s }} />}
        refreshControl={<RefreshControl refreshing={aPuxar} onRefresh={puxar} tintColor={c.marca} colors={[c.marca]} />}
        ListHeaderComponent={
          <>
            <VersaoNova />
            {/*
              Os pedidos novos não são avisos (d13): no máximo UMA linha
              discreta, e os cartões deles com «Novo». Nunca uma pilha.
            */}
            {linhaDosNovos && separador === "novos" ? (
              <View style={[estilos.linhaDosNovos, { borderColor: c.linha }]}>
                <Text style={{ flex: 1, color: c.suave, fontSize: LETRA.pequena + 1, fontWeight: "600" }} numberOfLines={1}>
                  {linhaDosNovos}
                </Text>
                <Pressable onPress={verPedidosNovos} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={8}>
                  <Ionicons name="close" size={16} color={c.suave} />
                </Pressable>
              </View>
            ) : null}
            {/* A dívida que fecha os trabalhos em dinheiro, à entrada — como no painel; um toque leva à carteira. */}
            {carteira?.bloqueioEmDinheiro ? (
              <Pressable onPress={() => router.push("/carteira")} accessibilityRole="button" style={{ marginBottom: ESPACO.s }}>
                <Mensagem texto={carteira.bloqueioEmDinheiro.explicacao} />
              </Pressable>
            ) : null}
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
        renderItem={({ item, index }) =>
          item.tipo === "grupo" ? (
            <TituloDoGrupo linha={item} primeiro={index === 0} />
          ) : (
            <Cartao trabalho={item.trabalho} porAbrir={porAbrir.has(item.trabalho.negociacaoId)} separador={separador} />
          )
        }
      />
    </View>
  );
}

/**
 * A LISTA DO SINO (d13): do mais recente para o mais antigo, os por ler com um
 * ponto e a letra mais forte; um toque abre o trabalho e dá-o por lido.
 */
function Sino({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { avisos, porLer, marcarAvisoLido, marcarTudoComoLido } = useTrabalhos();
  return (
    <Modal visible={aberto} animationType="slide" transparent onRequestClose={onFechar}>
      <Pressable style={estilos.veu} onPress={onFechar} accessibilityLabel="Fechar os avisos" />
      <View style={[estilos.folhaDoSino, { backgroundColor: c.superficie, paddingBottom: margens.bottom + ESPACO.m }]}>
        <View style={estilos.cabecaDoSino}>
          <Text style={{ flex: 1, color: c.tinta, fontSize: LETRA.media, fontWeight: "800" }} accessibilityRole="header">
            {TITULO_DOS_AVISOS}
          </Text>
          <Pressable onPress={onFechar} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={8}>
            <Ionicons name="close" size={22} color={c.suave} />
          </Pressable>
        </View>
        {porLer > 0 ? (
          <Pressable
            onPress={marcarTudoComoLido}
            accessibilityRole="button"
            style={({ pressed }) => [estilos.marcarTudo, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={{ color: c.marca, fontSize: LETRA.pequena + 1, fontWeight: "700" }}>{MARCAR_TUDO_COMO_LIDO}</Text>
          </Pressable>
        ) : null}
        <FlatList
          data={avisos}
          keyExtractor={(a) => a.id}
          style={{ flexGrow: 0 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.linha }} />}
          ListEmptyComponent={
            <Text style={{ color: c.suave, fontSize: LETRA.normal, lineHeight: 22, paddingVertical: ESPACO.l }}>{SEM_AVISOS}</Text>
          }
          renderItem={({ item: a }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${a.lido ? "" : "Por ler: "}${a.texto}`}
              onPress={() => {
                marcarAvisoLido(a.id);
                onFechar();
                router.push(`/trabalho/${a.negociacaoId}`);
              }}
              style={({ pressed }) => [estilos.aviso, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[estilos.pontoDoAviso, { backgroundColor: a.lido ? "transparent" : c.marca }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.tinta, fontSize: LETRA.pequena + 1, lineHeight: 19, fontWeight: a.lido ? "400" : "700" }}>
                  {a.texto}
                </Text>
                <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>{dataEHora(a.em)}</Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

/** O ícone de cada serviço, para os pedidos que chegam sem fotografia. */
const ICONE: Record<string, keyof typeof Ionicons.glyphMap> = {
  recolha_entulho: "construct-outline",
  recolha_monos: "cube-outline",
  recolha_moveis: "bed-outline",
  esvaziamento_casa: "home-outline",
  esvaziamento_apartamento: "business-outline",
  esvaziamento_garagem: "car-sport-outline",
  esvaziamento_sotao: "home-outline",
  esvaziamento_cave: "archive-outline",
  mudanca: "car-outline",
  montagem_moveis: "hammer-outline",
  jardinagem: "leaf-outline",
  manutencao_casa: "build-outline",
};

/** A cor do ponto de cada grupo — as do painel (âmbar, violeta, verde, azul, rosa, laranja, cinzento). */
function corDoTom(tom: TomDoGrupo, c: Cores): string {
  return {
    aviso: c.aviso,
    violeta: "#8B5CF6",
    bom: c.bom,
    azul: "#0EA5E9",
    rosa: "#F43F5E",
    laranja: "#F97316",
    neutro: c.suave,
  }[tom];
}

/** O título de um grupo, antes do seu primeiro cartão: o ponto, o nome, quantos, e a legenda. */
function TituloDoGrupo({ linha, primeiro }: { linha: Extract<LinhaDaLista, { tipo: "grupo" }>; primeiro: boolean }) {
  const c = useCores();
  return (
    <View style={{ paddingTop: primeiro ? 0 : ESPACO.s, paddingHorizontal: 2, gap: 2 }} accessibilityRole="header">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: corDoTom(linha.grupo.tom, c) }} />
        <Text style={{ color: c.tinta, fontSize: LETRA.pequena + 2, fontWeight: "800" }}>{linha.grupo.titulo}</Text>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena, fontWeight: "700" }}>{linha.quantos}</Text>
      </View>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>{linha.legenda}</Text>
    </View>
  );
}

function Pastilha({ texto, tom, c }: { texto: string; tom: "marca" | "bom" | "aviso" | "mau" | "neutro"; c: Cores }) {
  const [fundo, tinta] = {
    marca: [c.marcaSuave, c.marca],
    mau: [c.mauSuave, c.mau],
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
  // Nos Recusados, o porquê no lugar do estado — o `RECUSA` do painel (A14).
  const recusa = separador === "recusados" ? (RECUSA[chaveDoGrupo(t)] ?? null) : null;
  const estado = recusa ? null : estadoCurto(t);
  const tempo = tempoDoCartao(t);
  const onde = [t.city, distanciaDe(t)].filter(Boolean).join(" · ");
  // A unidade vai colada ao número (31-10-2026): «42,38 €/hora», e por baixo o
  // total estimado — nunca um valor por hora a passar por total.
  const sufixo = valor?.sufixo ?? "";

  return (
    // O brilho (sombra na cor da CLYON) vive no invólucro: o cartão corta o que
    // lhe sai das bordas, e a sombra é precisamente o que sai.
    <View style={[estilos.involucro, porAbrir && [estilos.brilho, { shadowColor: c.marca, backgroundColor: c.superficie }]]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${porAbrir ? "Por abrir: " : ""}${servicoDe(t)}${t.city ? ` em ${t.city}` : ""}${valor ? `, ${euros(valor.valor)}${sufixo}` : ""}`}
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
              {sufixo}
            </Text>
          ) : null}
        </View>

        <View style={estilos.linha}>
          <Text style={[estilos.detalhe, { color: c.suave }]} numberOfLines={1}>
            {onde || "—"}
          </Text>
          {valor ? (
            <Text style={[estilos.legenda, { color: c.suave }]} numberOfLines={1}>
              {valor.estimativa ?? (t.ofertaClyon ? "fixo" : "a receber") + (sufixo ? ` ${sufixo.replace("/", "/ ")}` : "")}
            </Text>
          ) : null}
        </View>

        <View style={estilos.linha}>
          <Text style={[estilos.detalhe, { color: c.suave }]} numberOfLines={1}>
            {quandoCurto(t) ?? "Sem data"}
          </Text>
          {tempo ? (
            <Text style={[estilos.legenda, { color: c.suave }]} numberOfLines={1}>
              {tempo}
            </Text>
          ) : null}
        </View>

        <View style={estilos.pastilhas}>
          {porAbrir ? <Pastilha texto="Novo" tom="marca" c={c} /> : null}
          {recusa ? <Pastilha texto={recusa.texto} tom={recusa.tom === "rosa" ? "mau" : recusa.tom === "laranja" ? "aviso" : "neutro"} c={c} /> : null}
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: ESPACO.m,
  },
  titulo: { fontSize: LETRA.titulo + 2, fontWeight: "800" },
  ola: { fontSize: LETRA.pequena + 1, fontWeight: "600", flexShrink: 1 },
  direita: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, flexShrink: 1 },
  sino: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  numeroDoSino: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  textoDoNumeroDoSino: { fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"] },
  veu: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)" },
  folhaDoSino: {
    maxHeight: "75%",
    borderTopLeftRadius: RAIO.l,
    borderTopRightRadius: RAIO.l,
    paddingHorizontal: ESPACO.l,
    paddingTop: ESPACO.m,
  },
  cabecaDoSino: { flexDirection: "row", alignItems: "center", gap: ESPACO.m, paddingBottom: ESPACO.s },
  marcarTudo: { alignSelf: "flex-start", paddingVertical: ESPACO.xs, marginBottom: ESPACO.xs },
  aviso: { flexDirection: "row", alignItems: "flex-start", gap: ESPACO.s, paddingVertical: ESPACO.m },
  pontoDoAviso: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  linhaDosNovos: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACO.s,
    borderBottomWidth: 1,
    paddingBottom: ESPACO.s,
    marginBottom: ESPACO.s,
  },
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
