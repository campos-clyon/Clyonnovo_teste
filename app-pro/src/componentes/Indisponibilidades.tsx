import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Texto";
import { Botao, Caixa, CampoDeTexto, Mensagem, TituloDaCaixa } from "./ui";
import { ErroDaApi, pedir } from "../lib/api";
import {
  corpoDaMarcacao,
  DIAS_DA_SEMANA,
  escolhaInicial,
  listaDe,
  marcaDoDia,
  mesDe,
  mesesPermitidos,
  outroMes,
  passarAHora,
  perguntaDoTrabalhoMarcado,
  podeEscolher,
  previsaoDaMarcacao,
  ROTA_DAS_INDISPONIBILIDADES,
  semanasDoMes,
  tituloDoMes,
  tocarNoDia,
  trabalhoEmCimaPorExtenso,
  type EscolhaDaIndisponibilidade,
  type Indisponibilidade,
  type RespostaDasIndisponibilidades,
  type TrabalhoEmCima,
} from "../lib/indisponibilidades";
import { TEXTOS_DA_INDISPONIBILIDADE as T } from "../../../src/lib/textos-da-indisponibilidade";
import { NOTA_MAXIMA } from "../../../src/lib/indisponibilidade";
import { diaEmLisboa } from "../../../src/lib/hora-de-lisboa";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * «DIAS EM QUE NÃO PODE TRABALHAR» NA AGENDA — d35, 15-11-2026.
 *
 * O que o painel tem na Agenda (`src/app/profissionais/painel/Indisponibilidades.tsx`),
 * com as mesmas frases e o mesmo pedido: a lista, «Marcar indisponível»
 * (dias inteiros, com «Até» opcional, ou umas horas de um dia), «Desmarcar»,
 * e — em cima de um trabalho marcado — a pergunta do servidor antes de marcar
 * na mesma. Os dias e as horas são de Lisboa (ver `lib/indisponibilidades.ts`).
 */
export function Indisponibilidades() {
  const c = useCores();
  const [lista, setLista] = useState<Indisponibilidade[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [escolha, setEscolha] = useState<EscolhaDaIndisponibilidade>(() => escolhaInicial());
  const [mes, setMes] = useState(() => mesDe(diaEmLisboa(new Date())));
  // O «De» começa em hoje, mas o primeiro toque no calendário escolhe o «De» (não o «Até»).
  const [jaTocou, setJaTocou] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [aTirar, setATirar] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [pergunta, setPergunta] = useState<{ pergunta: string; trabalhos: TrabalhoEmCima[] } | null>(null);

  useEffect(() => {
    let vivo = true;
    pedir<RespostaDasIndisponibilidades>(ROTA_DAS_INDISPONIBILIDADES)
      .then((r) => {
        if (vivo) setLista(listaDe(r));
      })
      .catch(() => {
        if (vivo) setLista([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  function abrir() {
    const e = escolhaInicial();
    setEscolha(e);
    setMes(mesDe(e.dia));
    setJaTocou(false);
    setErro("");
    setPergunta(null);
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    setPergunta(null);
    setErro("");
  }

  async function marcar(confirmar = false) {
    setAGravar(true);
    setErro("");
    try {
      const r = await pedir<RespostaDasIndisponibilidades>(ROTA_DAS_INDISPONIBILIDADES, {
        metodo: "POST",
        corpo: corpoDaMarcacao(escolha, confirmar),
      });
      setLista(listaDe(r));
      setPergunta(null);
      setAberto(false);
    } catch (e) {
      const p = e instanceof ErroDaApi ? perguntaDoTrabalhoMarcado(e.estado, e.corpo) : null;
      if (p) setPergunta(p);
      else setErro(e instanceof ErroDaApi && e.message ? e.message : T.naoMarcou);
    } finally {
      setAGravar(false);
    }
  }

  async function desmarcar(id: number) {
    setErro("");
    setATirar(id);
    try {
      const r = await pedir<RespostaDasIndisponibilidades>(`${ROTA_DAS_INDISPONIBILIDADES}?id=${id}`, { metodo: "DELETE" });
      setLista(listaDe(r));
    } catch (e) {
      setErro(e instanceof ErroDaApi && e.message ? e.message : T.naoDesmarcou);
    } finally {
      setATirar(null);
    }
  }

  const hoje = diaEmLisboa(new Date());
  const previsao = previsaoDaMarcacao(escolha);

  return (
    <Caixa>
      <TituloDaCaixa>{T.titulo}</TituloDaCaixa>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{T.explicacao}</Text>

      {lista && lista.length > 0 ? (
        <View style={{ gap: ESPACO.xs }}>
          {lista.map((l) => (
            <View key={l.id} style={[estilos.linha, { borderColor: c.linha }]}>
              <Text style={{ flex: 1, color: c.tinta, fontSize: LETRA.normal }}>
                {l.texto}
                {l.nota ? <Text style={{ color: c.suave }}> · {l.nota}</Text> : null}
              </Text>
              <Text
                onPress={aTirar === l.id ? undefined : () => void desmarcar(l.id)}
                accessibilityRole="button"
                accessibilityLabel={`${T.desmarcar} ${l.texto}`}
                style={{ color: c.marca, fontWeight: "700", fontSize: LETRA.pequena + 1, opacity: aTirar === l.id ? 0.5 : 1 }}
              >
                {T.desmarcar}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {!aberto ? (
        <Botao titulo={T.marcarIndisponivel} tipo="secundario" aoCarregar={abrir} />
      ) : pergunta ? (
        <View style={{ gap: ESPACO.s }}>
          <Mensagem tom="aviso" texto={pergunta.pergunta} />
          {pergunta.trabalhos.length > 0 ? (
            <Text style={{ color: c.tinta, fontSize: LETRA.pequena + 1 }}>
              {T.trabalhos}: {pergunta.trabalhos.map(trabalhoEmCimaPorExtenso).join("; ")}
            </Text>
          ) : null}
          <Botao titulo={T.marcarNaMesma} ocupado={aGravar} aoCarregar={() => void marcar(true)} />
          <Botao titulo={T.cancelar} tipo="secundario" aoCarregar={fechar} />
        </View>
      ) : (
        <View style={{ gap: ESPACO.m }}>
          <View style={estilos.pastilhas} accessibilityRole="radiogroup">
            <Pastilha
              texto={T.diasInteiros}
              activa={!escolha.soHoras}
              aoCarregar={() => setEscolha((e) => ({ ...e, soHoras: false }))}
            />
            <Pastilha
              texto={T.umasHoras}
              activa={escolha.soHoras}
              aoCarregar={() => setEscolha((e) => ({ ...e, soHoras: true, ate: "" }))}
            />
          </View>

          <Calendario mes={mes} hoje={hoje} escolha={escolha} aoMudarMes={setMes} aoTocar={(d) => {
              setEscolha((e) => (jaTocou ? tocarNoDia(e, d) : { ...e, dia: d, ate: "" }));
              setJaTocou(true);
            }} />

          {escolha.soHoras ? (
            <View style={{ gap: ESPACO.s }}>
              <Rotulo texto={`${T.dia}: ${diaCurto(escolha.dia)}`} />
              <Hora rotulo={T.das} valor={escolha.inicio} aoMudar={(h) => setEscolha((e) => ({ ...e, inicio: h }))} />
              <Hora rotulo={T.as} valor={escolha.fim} aoMudar={(h) => setEscolha((e) => ({ ...e, fim: h }))} />
            </View>
          ) : (
            <View style={{ gap: 2 }}>
              <Rotulo texto={`${T.de}: ${diaCurto(escolha.dia)}`} />
              <Rotulo texto={`${T.ateOpcional}: ${escolha.ate ? diaCurto(escolha.ate) : "—"}`} />
            </View>
          )}

          <CampoDeTexto
            rotulo={T.nota}
            value={escolha.nota}
            onChangeText={(t) => setEscolha((e) => ({ ...e, nota: t }))}
            maxLength={NOTA_MAXIMA}
            placeholder={T.exemploDaNota}
          />

          {previsao.erro ? (
            <Text style={{ color: c.mau, fontSize: LETRA.pequena + 1 }}>{previsao.erro}</Text>
          ) : (
            <Text style={{ color: c.tinta, fontSize: LETRA.normal, fontWeight: "700" }}>{previsao.texto}</Text>
          )}
          <Botao
            titulo={aGravar ? T.aMarcar : T.marcar}
            ocupado={aGravar}
            desactivado={!!previsao.erro}
            aoCarregar={() => void marcar()}
          />
          <Botao titulo={T.cancelar} tipo="secundario" aoCarregar={fechar} />
        </View>
      )}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}

const diaCurto = (dia: string) => (dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : "—");

function Rotulo({ texto }: { texto: string }) {
  const c = useCores();
  return <Text style={{ color: c.tinta, fontSize: LETRA.normal }}>{texto}</Text>;
}

function Pastilha({ texto, activa, aoCarregar }: { texto: string; activa: boolean; aoCarregar: () => void }) {
  const c = useCores();
  return (
    <Pressable
      onPress={aoCarregar}
      accessibilityRole="radio"
      accessibilityState={{ checked: activa }}
      style={[estilos.pastilha, { borderColor: activa ? c.marca : c.linha, backgroundColor: activa ? c.marca : c.superficie }]}
    >
      <Text style={{ color: activa ? c.sobreMarca : c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>{texto}</Text>
    </Pressable>
  );
}

/** «Das 09:00», com − e + de meia em meia hora. */
function Hora({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (h: string) => void }) {
  const c = useCores();
  return (
    <View style={estilos.hora}>
      <Text style={{ width: 44, color: c.tinta, fontSize: LETRA.normal }}>{rotulo}</Text>
      <Pressable
        onPress={() => aoMudar(passarAHora(valor, -1))}
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: meia hora mais cedo`}
        hitSlop={6}
        style={[estilos.passo, { borderColor: c.linha, backgroundColor: c.superficie }]}
      >
        <Ionicons name="remove" size={20} color={c.tinta} />
      </Pressable>
      <Text style={{ minWidth: 64, textAlign: "center", color: c.tinta, fontSize: LETRA.media, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
        {valor}
      </Text>
      <Pressable
        onPress={() => aoMudar(passarAHora(valor, 1))}
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: meia hora mais tarde`}
        hitSlop={6}
        style={[estilos.passo, { borderColor: c.linha, backgroundColor: c.superficie }]}
      >
        <Ionicons name="add" size={20} color={c.tinta} />
      </Pressable>
    </View>
  );
}

/** Um mês em grelha, de segunda a domingo; os dias que já passaram não se tocam. */
function Calendario(p: {
  mes: string;
  hoje: string;
  escolha: EscolhaDaIndisponibilidade;
  aoMudarMes: (m: string) => void;
  aoTocar: (dia: string) => void;
}) {
  const c = useCores();
  const limites = mesesPermitidos(p.hoje);
  const podeRecuar = p.mes > limites.primeiro;
  const podeAvancar = p.mes < limites.ultimo;
  return (
    <View style={{ gap: ESPACO.xs }}>
      <View style={estilos.cabecaDoMes}>
        <Pressable
          onPress={podeRecuar ? () => p.aoMudarMes(outroMes(p.mes, -1)) : undefined}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          accessibilityState={{ disabled: !podeRecuar }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={podeRecuar ? c.tinta : c.linha} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>{tituloDoMes(p.mes)}</Text>
        <Pressable
          onPress={podeAvancar ? () => p.aoMudarMes(outroMes(p.mes, 1)) : undefined}
          accessibilityRole="button"
          accessibilityLabel="Mês seguinte"
          accessibilityState={{ disabled: !podeAvancar }}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={22} color={podeAvancar ? c.tinta : c.linha} />
        </Pressable>
      </View>
      <View style={estilos.semana}>
        {DIAS_DA_SEMANA.map((d, i) => (
          <Text key={i} style={[estilos.celula, { color: c.suave, fontSize: LETRA.pequena, fontWeight: "700", textAlign: "center" }]}>
            {d}
          </Text>
        ))}
      </View>
      {semanasDoMes(p.mes).map((semana, i) => (
        <View key={i} style={estilos.semana}>
          {semana.map((dia, j) => {
            if (!dia) return <View key={j} style={estilos.celula} />;
            const pode = podeEscolher(dia, p.hoje);
            const marca = marcaDoDia(p.escolha, dia);
            const fundo = marca === "ponta" ? c.marca : marca === "meio" ? c.marcaSuave : "transparent";
            const tinta = marca === "ponta" ? c.sobreMarca : pode ? c.tinta : c.linha;
            return (
              <Pressable
                key={dia}
                onPress={pode ? () => p.aoTocar(dia) : undefined}
                accessibilityRole="button"
                accessibilityLabel={`${Number(dia.slice(8, 10))} de ${tituloDoMes(p.mes)}`}
                accessibilityState={{ disabled: !pode, selected: marca != null }}
                style={estilos.celula}
              >
                <View
                  style={[
                    estilos.numero,
                    { backgroundColor: fundo },
                    dia === p.hoje && marca == null ? { borderWidth: 1, borderColor: c.marca } : null,
                  ]}
                >
                  <Text style={{ color: tinta, fontWeight: marca ? "800" : "600", fontSize: LETRA.pequena + 2 }}>{Number(dia.slice(8, 10))}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: ESPACO.m, paddingVertical: ESPACO.s, borderTopWidth: StyleSheet.hairlineWidth },
  pastilhas: { flexDirection: "row", flexWrap: "wrap", gap: ESPACO.xs },
  pastilha: { borderWidth: 1, borderRadius: 999, paddingHorizontal: ESPACO.m, paddingVertical: 7 },
  cabecaDoMes: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, paddingVertical: ESPACO.xs },
  semana: { flexDirection: "row" },
  celula: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  numero: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  hora: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
  passo: { width: 40, height: 40, borderRadius: RAIO.m, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
