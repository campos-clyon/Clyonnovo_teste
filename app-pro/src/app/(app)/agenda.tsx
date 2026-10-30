import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, PanResponder, Pressable, RefreshControl, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Etiqueta, Mensagem } from "../../componentes/ui";
import { ODia } from "../../componentes/TrabalhoContratado";
import { ErroDaApi, pedir } from "../../lib/api";
import { useTrabalhos } from "../../estado/Trabalhos";
import {
  agendaDe,
  duracaoDe,
  euros,
  horaNaAgenda,
  linkDoCalendario,
  perguntaAntesDeArquivar,
  servicoDe,
  type Trabalho,
} from "../../lib/trabalhos";
import {
  cabecalhoDoDia,
  doDia,
  eventosDaAgenda,
  largarEm,
  mesmoMes,
  numeroDoDia,
  proximoTrabalho,
  quandoParaGravar,
  semDiaNaAgenda,
  type EventoDaApp,
} from "../../lib/agenda";
import {
  ALTURA_DA_HORA,
  andar,
  colunaDoDia,
  DIAS_CURTOS,
  diaPorExtenso as diaDaGrelhaPorExtenso,
  diasDaVista,
  dispor,
  duracaoPorExtenso,
  horaCurta,
  janelaDeHoras,
  mesmoDia,
  minutosDoDia,
  periodoDaVista,
  semanasDoMes,
  tituloDoPeriodo,
  VISTAS,
  type Vista,
} from "../../../../src/lib/agenda-em-grelha";
import { doRelogioDeLisboa, noRelogioDeLisboa } from "../../../../src/lib/hora-de-lisboa";
import { ESPACO, LETRA, RAIO, useCores, type Cores } from "../../tema";

/**
 * A AGENDA — a do painel, em grelha (29-10-2026, A15 da especificação v3).
 *
 * Dia, semana, mês e lista, como no painel. Na grelha: os trabalhos por fazer
 * pela hora, os feitos no dia em que foram feitos (cinzentos, com ✓), e
 * «Próximo trabalho» quando o período à vista está vazio. Os sem dia ficam
 * numa faixa por cima, com o dia a marcar ali mesmo. Tocar num bloco abre o
 * trabalho numa folha (ligar, calendário, mudar o dia, arquivar); um toque
 * longo agarra-o, e arrasta-se para outro dia ou outra hora — grava ao largar,
 * pela mesma rota do painel.
 *
 * A lista é a de antes (fase 4, 18-10-2026), com os sem data no fim, como no
 * painel.
 */
export default function AgendaDoProfissional() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { trabalhos, recarregar } = useTrabalhos();
  const [aLer, setALer] = useState(false);
  // No telemóvel, o painel abre no dia (`useVistaDaAgenda`, «estreito»).
  const [vista, setVista] = useState<Vista>("dia");
  const [ancora, setAncora] = useState(() => noRelogioDeLisboa(new Date()));
  const [agora, setAgora] = useState(() => noRelogioDeLisboa(new Date()));
  const [aberto, setAberto] = useState<number | null>(null);
  const [verSemDia, setVerSemDia] = useState(false);
  const [aArrastar, setAArrastar] = useState(false);
  // Os que ele acabou de arrastar, até o site devolver a lista nova.
  const [movidos, setMovidos] = useState<Record<number, string | null>>({});
  const [aviso, setAviso] = useState<{ tipo: "a_gravar" | "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setAgora(noRelogioDeLisboa(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  // O que o site já confirma deixa de estar «movido».
  useEffect(() => {
    setMovidos((m) => {
      const n = { ...m };
      let mudou = false;
      for (const [id, iso] of Object.entries(m)) {
        const t = trabalhos.find((x) => x.negociacaoId === Number(id));
        if (!t || (t.dataCombinada && iso && Date.parse(t.dataCombinada) === Date.parse(iso))) {
          delete n[Number(id)];
          mudou = true;
        }
      }
      return mudou ? n : m;
    });
  }, [trabalhos]);

  useEffect(() => {
    if (aviso?.tipo !== "ok") return;
    const id = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(id);
  }, [aviso]);

  const eventos = useMemo(() => eventosDaAgenda(trabalhos, movidos), [trabalhos, movidos]);
  const semDia = useMemo(() => semDiaNaAgenda(trabalhos, movidos), [trabalhos, movidos]);
  const agenda = agendaDe(trabalhos);
  const vazia = eventos.length === 0 && semDia.length === 0;
  const periodo = periodoDaVista(vista, ancora);
  const noPeriodo = periodo ? eventos.filter((e) => e.inicio >= periodo.de && e.inicio < periodo.ate).length : 0;
  const proximo = periodo && noPeriodo === 0 ? proximoTrabalho(eventos, periodo.ate) : null;
  const tAberto = aberto != null ? (trabalhos.find((t) => t.negociacaoId === aberto) ?? null) : null;
  const diaDoAberto = tAberto ? (tAberto.dataCombinada ?? tAberto.dataAgendada) : null;

  async function puxar() {
    setALer(true);
    await recarregar();
    setALer(false);
  }

  function abrirBloco(e: EventoDaApp) {
    if (e.fixo) router.push(`/trabalho/${e.id}` as never);
    else setAberto(e.id);
  }

  /** Largou um bloco noutro sítio: grava pela rota do painel, e diz o que aconteceu. */
  async function mover(id: number, parede: Date) {
    const instante = doRelogioDeLisboa(parede);
    if (!instante) return;
    const quando = `${diaDaGrelhaPorExtenso(parede).toLowerCase()}, às ${horaCurta(parede)}`;
    setMovidos((m) => ({ ...m, [id]: instante.toISOString() }));
    setAviso({ tipo: "a_gravar", texto: `A gravar: ${quando}…` });
    try {
      await pedir("/api/profissionais/agenda", { metodo: "POST", corpo: { negociacaoId: id, quando: quandoParaGravar(parede) } });
      setAviso({ tipo: "ok", texto: `Mudado para ${quando}.` });
      await recarregar();
    } catch (e) {
      setMovidos((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
      setAviso({ tipo: "erro", texto: `Não mudou: ${e instanceof ErroDaApi ? e.message : "tente outra vez."}` });
    }
  }

  const irParaDia = (d: Date) => {
    setAncora(d);
    setVista("dia");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <RolagemComTeclado
        scrollEnabled={!aArrastar}
        style={{ backgroundColor: c.fundo }}
        contentContainerStyle={[estilos.pagina, { paddingTop: margens.top + ESPACO.l, paddingBottom: margens.bottom + ESPACO.xxl }]}
        refreshControl={<RefreshControl refreshing={aLer} onRefresh={() => void puxar()} tintColor={c.marca} colors={[c.marca]} />}
      >
        <View style={estilos.cabeca}>
          <Text style={[estilos.titulo, { color: c.tinta }]}>Agenda</Text>
          {agenda.marcados > 0 ? (
            <Text style={{ color: c.suave, fontSize: LETRA.normal }}>
              {agenda.marcados} marcado{agenda.marcados === 1 ? "" : "s"}
            </Text>
          ) : null}
        </View>

        {vazia ? (
          <View style={{ gap: ESPACO.m, alignItems: "center", marginTop: ESPACO.xl }}>
            <Text style={{ color: c.suave, fontSize: LETRA.normal, textAlign: "center", lineHeight: 22 }}>
              Nada agendado. Quando contratar um trabalho, ele aparece aqui pelo dia marcado — e pode pô-lo no calendário do
              telemóvel com um toque.
            </Text>
            <Botao titulo="Ver os meus trabalhos" tipo="secundario" aoCarregar={() => router.navigate("/" as never)} />
          </View>
        ) : (
          <>
            <BarraDaAgenda vista={vista} ancora={ancora} agora={agora} aoMudarVista={setVista} aoMudarAncora={setAncora} />

            {aviso || vista === "dia" || vista === "semana" ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  fontSize: LETRA.pequena,
                  fontWeight: aviso && aviso.tipo !== "a_gravar" ? "700" : "400",
                  color: aviso?.tipo === "erro" ? c.mau : aviso?.tipo === "ok" ? c.bom : c.suave,
                }}
              >
                {aviso?.texto ?? "Toque longo num trabalho e arraste-o para outro dia ou hora — grava ao largar."}
              </Text>
            ) : null}

            {/* Os sem dia: não cabem numa grelha de horas, e não podem desaparecer por isso. */}
            {vista !== "lista" && semDia.length > 0 ? (
              <View style={[estilos.faixaSemDia, { backgroundColor: c.avisoSuave, borderColor: c.aviso }]}>
                <Pressable
                  onPress={() => setVerSemDia((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: verSemDia }}
                  style={estilos.linhaSemDia}
                >
                  <Text style={{ flex: 1, color: c.tinta, fontWeight: "700" }}>
                    {semDia.length} {semDia.length === 1 ? "trabalho" : "trabalhos"} sem data marcada
                  </Text>
                  <Text style={{ color: c.aviso, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>
                    {verSemDia ? "Esconder" : "Marcar o dia"}
                  </Text>
                </Pressable>
                {verSemDia ? (
                  <View style={{ gap: ESPACO.m, paddingBottom: ESPACO.s }}>
                    {semDia.map((t) => (
                      <TrabalhoSemDia key={t.negociacaoId} t={t} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {vista === "lista" ? (
              <Lista trabalhos={trabalhos} />
            ) : vista === "mes" ? (
              <Mes ancora={ancora} agora={agora} eventos={eventos} aoIrParaDia={irParaDia} />
            ) : (
              <Grelha
                vista={vista}
                ancora={ancora}
                agora={agora}
                eventos={eventos}
                aoAbrir={abrirBloco}
                aoMover={(id, parede) => void mover(id, parede)}
                aoArrastar={setAArrastar}
                aoIrParaDia={irParaDia}
              />
            )}

            {vista !== "lista" && proximo ? (
              <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
                Nada marcado {vista === "dia" ? "neste dia" : vista === "semana" ? "nesta semana" : "neste mês"}. Próximo trabalho:{" "}
                {diaDaGrelhaPorExtenso(proximo).toLowerCase()}, às {horaCurta(proximo)}.{" "}
                <Text onPress={() => setAncora(proximo)} accessibilityRole="link" style={{ color: c.marca, fontWeight: "700" }}>
                  Ir para lá
                </Text>
              </Text>
            ) : null}
          </>
        )}
      </RolagemComTeclado>

      {/* O trabalho aberto, numa folha por baixo — as acções da lista, pelas mesmas funções. */}
      <Modal visible={tAberto != null} transparent animationType="slide" onRequestClose={() => setAberto(null)}>
        <Pressable style={estilos.veu} onPress={() => setAberto(null)} accessibilityLabel="Fechar" />
        <View style={[estilos.folha, { backgroundColor: c.fundo, paddingBottom: margens.bottom + ESPACO.l }]}>
          <View style={estilos.cabecaDaFolha}>
            <Text style={{ flex: 1, color: c.tinta, fontWeight: "700" }}>
              {diaDoAberto ? diaDaGrelhaPorExtenso(noRelogioDeLisboa(new Date(diaDoAberto))) : "Sem data marcada"}
            </Text>
            <Pressable onPress={() => setAberto(null)} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}>
              <Ionicons name="close" size={24} color={c.suave} />
            </Pressable>
          </View>
          {aviso ? (
            <Text style={{ fontSize: LETRA.pequena, color: aviso.tipo === "erro" ? c.mau : aviso.tipo === "ok" ? c.bom : c.suave }}>
              {aviso.texto}
            </Text>
          ) : null}
          <RolagemComTeclado contentContainerStyle={{ gap: ESPACO.m }} keyboardShouldPersistTaps="handled">
            {tAberto ? (
              <>
                <CartaoDaAgenda t={tAberto} />
                <ODia t={tAberto} />
                <Botao
                  titulo="Abrir o trabalho"
                  tipo="secundario"
                  aoCarregar={() => {
                    setAberto(null);
                    router.push(`/trabalho/${tAberto.negociacaoId}` as never);
                  }}
                />
              </>
            ) : null}
          </RolagemComTeclado>
        </View>
      </Modal>
    </View>
  );
}

// ── A barra: as vistas, Hoje, as setas e o período ───────────────────────────

const SETAS: Record<Exclude<Vista, "lista">, [string, string]> = {
  dia: ["Dia anterior", "Dia seguinte"],
  semana: ["Semana anterior", "Semana seguinte"],
  mes: ["Mês anterior", "Mês seguinte"],
};

function BarraDaAgenda(p: {
  vista: Vista;
  ancora: Date;
  agora: Date;
  aoMudarVista: (v: Vista) => void;
  aoMudarAncora: (d: Date) => void;
}) {
  const c = useCores();
  const setas = p.vista === "lista" ? null : SETAS[p.vista];
  return (
    <View style={{ gap: ESPACO.s }}>
      <View style={estilos.vistas}>
        {VISTAS.map((v) => {
          const activa = v.id === p.vista;
          return (
            <Pressable
              key={v.id}
              onPress={() => p.aoMudarVista(v.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              style={[estilos.vista, { backgroundColor: activa ? c.marca : c.superficie, borderColor: activa ? c.marca : c.linha }]}
            >
              <Text style={{ color: activa ? c.sobreMarca : c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>{v.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
      {setas ? (
        <View style={estilos.navegar}>
          <Pressable
            onPress={() => p.aoMudarAncora(p.agora)}
            accessibilityRole="button"
            style={[estilos.hoje, { borderColor: c.linha, backgroundColor: c.superficie }]}
          >
            <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>Hoje</Text>
          </Pressable>
          <Pressable onPress={() => p.aoMudarAncora(andar(p.vista, p.ancora, -1))} accessibilityRole="button" accessibilityLabel={setas[0]} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={c.tinta} />
          </Pressable>
          <Pressable onPress={() => p.aoMudarAncora(andar(p.vista, p.ancora, 1))} accessibilityRole="button" accessibilityLabel={setas[1]} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={c.tinta} />
          </Pressable>
          <Text style={{ flex: 1, color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }} numberOfLines={1}>
            {tituloDoPeriodo(p.vista, p.ancora)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── A grelha do dia e da semana ──────────────────────────────────────────────

const LARGURA_DAS_HORAS = 40;

function Grelha(p: {
  vista: "dia" | "semana";
  ancora: Date;
  agora: Date;
  eventos: EventoDaApp[];
  aoAbrir: (e: EventoDaApp) => void;
  aoMover: (id: number, parede: Date) => void;
  aoArrastar: (sim: boolean) => void;
  aoIrParaDia: (d: Date) => void;
}) {
  const c = useCores();
  const dias = diasDaVista(p.vista, p.ancora);
  const [largura, setLargura] = useState(0);
  const larguraDaColuna = largura > 0 ? (largura - LARGURA_DAS_HORAS) / dias.length : 0;
  const daVista = p.eventos.filter((e) => dias.some((d) => mesmoDia(d, e.inicio)));
  const janela = janelaDeHoras(
    daVista.map((e) => e.inicio),
    daVista.map((e) => e.duracaoMin),
  );
  const horas = Array.from({ length: janela.ate - janela.de }, (_, i) => janela.de + i);
  const altura = horas.length * ALTURA_DA_HORA;
  const agoraMin = minutosDoDia(p.agora);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)} style={{ gap: ESPACO.xs }}>
      {/* Os dias por cima: na semana, um toque abre esse dia. */}
      <View style={{ flexDirection: "row", paddingLeft: LARGURA_DAS_HORAS }}>
        {dias.map((d) => {
          const hoje = mesmoDia(d, p.agora);
          return (
            <Pressable
              key={d.getTime()}
              onPress={() => {
                if (p.vista === "semana") p.aoIrParaDia(d);
              }}
              accessibilityRole={p.vista === "semana" ? "button" : undefined}
              style={{ flex: 1, alignItems: "center", paddingVertical: 2 }}
            >
              <Text style={{ color: hoje ? c.marca : c.suave, fontSize: 10, fontWeight: "700" }}>{DIAS_CURTOS[colunaDoDia(d)]}</Text>
              <View style={[estilos.numeroDoDia, hoje ? { backgroundColor: c.marca } : null]}>
                <Text style={{ color: hoje ? c.sobreMarca : c.tinta, fontWeight: "800", fontSize: LETRA.pequena + 1 }}>{numeroDoDia(d)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", height: altura }}>
        <View style={{ width: LARGURA_DAS_HORAS }}>
          {horas.map((h) => (
            <Text key={h} style={{ height: ALTURA_DA_HORA, color: c.suave, fontSize: 10 }}>
              {String(h).padStart(2, "0")}:00
            </Text>
          ))}
        </View>
        {dias.map((d, coluna) => {
          const dispostos = dispor(
            doDia(p.eventos, d).map((e) => {
              const inicioMin = minutosDoDia(e.inicio);
              return { item: e, inicioMin, fimMin: Math.min(24 * 60, inicioMin + e.duracaoMin) };
            }),
          );
          const hoje = mesmoDia(d, p.agora);
          return (
            <View key={d.getTime()} style={[estilos.coluna, { borderColor: c.linha, backgroundColor: hoje ? c.marcaSuave : "transparent" }]}>
              {horas.map((h) => (
                <View key={h} style={{ height: ALTURA_DA_HORA, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.linha }} />
              ))}
              {hoje && agoraMin >= janela.de * 60 && agoraMin <= janela.ate * 60 ? (
                <View style={[estilos.agora, { top: ((agoraMin - janela.de * 60) / 60) * ALTURA_DA_HORA, backgroundColor: c.mau }]} />
              ) : null}
              {/* Em percentagem da coluna: não espera pela medida do ecrã para desenhar. */}
              {dispostos.map((dp) => (
                    <Bloco
                      key={dp.item.id}
                      evento={dp.item}
                      topo={((dp.inicioMin - janela.de * 60) / 60) * ALTURA_DA_HORA}
                      alto={Math.max(22, ((dp.fimMin - dp.inicioMin) / 60) * ALTURA_DA_HORA - 2)}
                      esquerda={`${(100 / dp.colunas) * dp.coluna}%`}
                      largo={`${100 / dp.colunas - 2}%`}
                      dia={p.vista === "dia"}
                      aoAbrir={() => p.aoAbrir(dp.item)}
                      aoArrastar={p.aoArrastar}
                      aoLargar={(dx, dy) => {
                        const novo = largarEm({ inicio: dp.item.inicio, dx, dy, larguraDaColuna, colunas: dias.length, coluna, janela });
                        if (novo.getTime() !== dp.item.inicio.getTime()) p.aoMover(dp.item.id, novo);
                      }}
                      c={c}
                    />
                  ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * UM TRABALHO NA GRELHA. Um toque abre-o; um toque longo agarra-o, e o dedo
 * leva-o para outro dia ou outra hora — grava ao largar. Os feitos não se
 * arrastam: a data deles é o que aconteceu.
 */
function Bloco(p: {
  evento: EventoDaApp;
  topo: number;
  alto: number;
  esquerda: `${number}%`;
  largo: `${number}%`;
  dia: boolean;
  aoAbrir: () => void;
  aoArrastar: (sim: boolean) => void;
  aoLargar: (dx: number, dy: number) => void;
  c: Cores;
}) {
  const { evento: e, c } = p;
  const agarrado = useRef(false);
  const aMover = useRef(false);
  const [deslocado, setDeslocado] = useState<{ dx: number; dy: number } | null>(null);
  const ultimas = useRef(p);
  ultimas.current = p;

  const largar = useRef(() => {
    agarrado.current = false;
    aMover.current = false;
    setDeslocado(null);
    ultimas.current.aoArrastar(false);
  }).current;

  const resposta = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => agarrado.current,
      onMoveShouldSetPanResponderCapture: () => agarrado.current,
      onPanResponderGrant: () => {
        aMover.current = true;
      },
      onPanResponderTerminationRequest: () => !agarrado.current,
      onPanResponderMove: (_, g) => {
        if (agarrado.current) setDeslocado({ dx: g.dx, dy: g.dy });
      },
      onPanResponderRelease: (_, g) => {
        if (agarrado.current) ultimas.current.aoLargar(g.dx, g.dy);
        largar();
      },
      onPanResponderTerminate: () => largar(),
    }),
  ).current;

  return (
    <View
      {...resposta.panHandlers}
      style={[
        estilos.bloco,
        {
          top: p.topo,
          height: p.alto,
          left: p.esquerda,
          width: p.largo,
          backgroundColor: c.superficie,
          borderLeftColor: e.cor,
          opacity: e.fixo ? 0.7 : 1,
          zIndex: deslocado ? 10 : 1,
          elevation: deslocado ? 6 : 0,
          transform: deslocado ? [{ translateX: deslocado.dx }, { translateY: deslocado.dy }] : [],
        },
      ]}
    >
      <Pressable
        style={{ flex: 1 }}
        onPress={p.aoAbrir}
        delayLongPress={350}
        onLongPress={() => {
          if (e.fixo) return;
          agarrado.current = true;
          setDeslocado({ dx: 0, dy: 0 });
          p.aoArrastar(true);
        }}
        onPressOut={() => {
          // Largou sem arrastar: o bloco volta ao sítio. (Se o dedo andou, o
          // arrasto já tomou conta do toque e larga-o ele.)
          setTimeout(() => {
            if (agarrado.current && !aMover.current) largar();
          }, 60);
        }}
        accessibilityRole="button"
        accessibilityLabel={[horaCurta(e.inicio), e.titulo, e.linha2, e.linha3].filter(Boolean).join(", ")}
      >
        <Text numberOfLines={1} style={{ color: c.tinta, fontSize: 10, fontWeight: "800" }}>
          {horaCurta(e.inicio)}
        </Text>
        <Text numberOfLines={p.dia ? 1 : 2} style={{ color: c.tinta, fontSize: 11, fontWeight: "700" }}>
          {e.titulo}
        </Text>
        {p.dia && e.linha2 ? (
          <Text numberOfLines={1} style={{ color: c.suave, fontSize: 11 }}>
            {e.linha2}
          </Text>
        ) : null}
        {p.dia && e.linha3 && p.alto > 64 ? (
          <Text numberOfLines={1} style={{ color: c.suave, fontSize: 11 }}>
            {e.linha3}
          </Text>
        ) : null}
        {p.dia && e.valor != null && p.alto > 80 ? (
          <Text numberOfLines={1} style={{ color: c.bom, fontSize: 11, fontWeight: "800" }}>
            {euros(e.valor)}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

// ── O mês ────────────────────────────────────────────────────────────────────

function Mes(p: { ancora: Date; agora: Date; eventos: EventoDaApp[]; aoIrParaDia: (d: Date) => void }) {
  const c = useCores();
  const semanas = semanasDoMes(p.ancora);
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row" }}>
        {DIAS_CURTOS.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: "center", color: c.suave, fontSize: 10, fontWeight: "700" }}>
            {d}
          </Text>
        ))}
      </View>
      {semanas.map((semana) => (
        <View key={semana[0].getTime()} style={{ flexDirection: "row", gap: 2 }}>
          {semana.map((d) => {
            const doMes = mesmoMes(d, p.ancora);
            const hoje = mesmoDia(d, p.agora);
            const doDiaAqui = doDia(p.eventos, d);
            return (
              <Pressable
                key={d.getTime()}
                onPress={() => p.aoIrParaDia(d)}
                accessibilityRole="button"
                accessibilityLabel={`${numeroDoDia(d)}: ${doDiaAqui.length} ${doDiaAqui.length === 1 ? "trabalho" : "trabalhos"}`}
                style={[estilos.celula, { borderColor: c.linha, backgroundColor: c.superficie, opacity: doMes ? 1 : 0.45 }]}
              >
                <View style={[estilos.numeroDoDia, hoje ? { backgroundColor: c.marca } : null]}>
                  <Text style={{ color: hoje ? c.sobreMarca : c.tinta, fontSize: 11, fontWeight: "800" }}>{numeroDoDia(d)}</Text>
                </View>
                {doDiaAqui.slice(0, 3).map((e) => (
                  <View key={e.id} style={[estilos.marca, { backgroundColor: e.cor }]} />
                ))}
                {doDiaAqui.length > 3 ? <Text style={{ color: c.suave, fontSize: 9 }}>+{doDiaAqui.length - 3}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── A lista (a de antes, com os sem data no fim, como no painel) ─────────────

function Lista({ trabalhos }: { trabalhos: Trabalho[] }) {
  const c = useCores();
  const agenda = agendaDe(trabalhos);
  if (agenda.semData.length === 0 && agenda.dias.length === 0) {
    return (
      <Text style={{ color: c.suave, fontSize: LETRA.normal, lineHeight: 22 }}>
        Nada por fazer. Os trabalhos feitos estão nas vistas do dia, da semana e do mês.
      </Text>
    );
  }
  return (
    <View style={{ gap: ESPACO.l }}>
      {agenda.dias.map((d) => {
        const primeiro = d.trabalhos[0];
        const quando = primeiro ? (primeiro.dataCombinada ?? primeiro.dataAgendada) : null;
        return (
          <View key={d.dia} style={{ gap: ESPACO.s }}>
            <View style={estilos.cabecaDoDia}>
              <Text style={[estilos.dia, { color: d.passou ? c.mau : c.tinta }]}>{quando ? cabecalhoDoDia(new Date(quando)) : d.rotulo}</Text>
              {d.passou ? <Etiqueta texto="Já passou o dia" tom="mau" /> : null}
            </View>
            {d.trabalhos.map((t) => (
              <CartaoDaAgenda key={t.negociacaoId} t={t} />
            ))}
          </View>
        );
      })}
      {agenda.semData.length > 0 ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={[estilos.dia, { color: c.aviso }]}>Sem data marcada ({agenda.semData.length})</Text>
          {agenda.semData.map((t) => (
            <TrabalhoSemDia key={t.negociacaoId} t={t} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Um trabalho sem dia: o cartão e o dia a marcar logo ali — como no painel (B2, linha 88). */
function TrabalhoSemDia({ t }: { t: Trabalho }) {
  const c = useCores();
  return (
    <View style={{ gap: ESPACO.s }}>
      <CartaoDaAgenda t={t} />
      <Text style={{ color: c.aviso, fontSize: LETRA.pequena + 1 }}>Sem data marcada — combine com o cliente e marque aqui.</Text>
      <ODia t={t} />
    </View>
  );
}

function CartaoDaAgenda({ t }: { t: Trabalho }) {
  const c = useCores();
  const hora = horaNaAgenda(t);
  const calendario = linkDoCalendario(t);
  const ligar = t.contactoTelefone?.replace(/[^\d+]/g, "");
  const { recarregar } = useTrabalhos();
  const [aConfirmar, setAConfirmar] = useState(false);
  const [aArquivar, setAArquivar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /*
   * «ARQUIVAR — O CLIENTE NÃO RESPONDE», como na agenda do painel (versão 14).
   * Um contratado em que o cliente deixou de responder nunca saía da agenda.
   * Discreto e no fim: o gesto principal aqui é ligar.
   */
  async function arquivar() {
    setAArquivar(true);
    setErro(null);
    try {
      await pedir("/api/profissionais/arquivar", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, arquivar: true } });
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível arquivar. Tente outra vez.");
      setAArquivar(false);
    }
  }

  return (
    <View style={{ gap: ESPACO.xs }}>
      <Pressable
        onPress={() => router.push(`/trabalho/${t.negociacaoId}` as never)}
        accessibilityRole="button"
        accessibilityLabel={`${servicoDe(t)}, ${hora ?? "sem hora"}`}
        style={({ pressed }) => [estilos.cartao, { backgroundColor: c.superficie, borderColor: c.linha, opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={[estilos.hora, { backgroundColor: c.marcaSuave }]}>
          <Text style={{ color: c.marca, fontWeight: "800", fontSize: LETRA.media }}>{hora ?? "—"}</Text>
          <Text style={{ color: c.marca, fontSize: 11 }}>{duracaoPorExtenso(duracaoDe(t))}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>
            {servicoDe(t)}
          </Text>
          <Text numberOfLines={1} style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
            {[t.contactoNome, t.morada ?? t.city].filter(Boolean).join(" · ")}
          </Text>
          <View style={estilos.linhaDeBaixo}>
            {t.recebeSeFechado != null ? (
              <Text style={{ color: c.bom, fontWeight: "800", fontSize: LETRA.pequena + 1 }}>{euros(t.recebeSeFechado)}</Text>
            ) : null}
            {!t.dataCombinada && t.dataAgendada ? (
              <Text style={{ color: c.aviso, fontSize: LETRA.pequena }}>dia pedido pelo cliente</Text>
            ) : null}
          </View>
        </View>
        <View style={{ gap: ESPACO.s }}>
          {ligar ? (
            <Pressable onPress={() => void Linking.openURL(`tel:${ligar}`)} accessibilityRole="button" accessibilityLabel="Ligar ao cliente" hitSlop={6}>
              <Ionicons name="call-outline" size={22} color={c.marca} />
            </Pressable>
          ) : null}
          {calendario ? (
            <Pressable
              onPress={() => void Linking.openURL(calendario)}
              accessibilityRole="button"
              accessibilityLabel="Pôr no calendário do telemóvel"
              hitSlop={6}
            >
              <Ionicons name="calendar-number-outline" size={22} color={c.marca} />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
      {aConfirmar ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.tinta, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{perguntaAntesDeArquivar(t)}</Text>
          <Botao titulo="Sim, arquivar" tipo="perigo" ocupado={aArquivar} aoCarregar={() => void arquivar()} />
          <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setAConfirmar(false)} />
        </View>
      ) : (
        <Text
          onPress={() => setAConfirmar(true)}
          accessibilityRole="button"
          style={{ color: c.suave, fontSize: LETRA.pequena, fontWeight: "600", textAlign: "center", paddingVertical: 6 }}
        >
          Arquivar — o cliente não responde
        </Text>
      )}
      {erro ? <Mensagem texto={erro} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { paddingHorizontal: ESPACO.l, gap: ESPACO.l },
  cabeca: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  titulo: { fontSize: LETRA.grande, fontWeight: "800" },
  cabecaDoDia: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
  dia: { fontSize: LETRA.media, fontWeight: "800" },
  cartao: { flexDirection: "row", alignItems: "center", gap: ESPACO.m, borderWidth: 1, borderRadius: RAIO.l, padding: ESPACO.m },
  hora: { width: 64, minHeight: 56, borderRadius: RAIO.m, alignItems: "center", justifyContent: "center" },
  linhaDeBaixo: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
  vistas: { flexDirection: "row", gap: ESPACO.xs },
  vista: { flex: 1, height: 34, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  navegar: { flexDirection: "row", alignItems: "center", gap: ESPACO.m },
  hoje: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, height: 32, justifyContent: "center" },
  numeroDoDia: { minWidth: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  coluna: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  agora: { position: "absolute", left: 0, right: 0, height: 2, zIndex: 5 },
  bloco: {
    position: "absolute",
    borderRadius: 6,
    borderLeftWidth: 3,
    paddingHorizontal: 3,
    paddingVertical: 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  celula: { flex: 1, minHeight: 58, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, padding: 2, alignItems: "center", gap: 2 },
  marca: { width: "86%", height: 4, borderRadius: 2 },
  faixaSemDia: { borderWidth: 1, borderRadius: RAIO.l, paddingHorizontal: ESPACO.m },
  linhaSemDia: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: ESPACO.s },
  veu: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)" },
  folha: { maxHeight: "88%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: ESPACO.l, gap: ESPACO.s },
  cabecaDaFolha: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
});
