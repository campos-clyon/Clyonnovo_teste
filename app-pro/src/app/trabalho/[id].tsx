import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../../componentes/Texto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FICHA_DO_AVISO } from "../../../../src/lib/avisos-antes-de-cotar";
import { Botao, Caixa, Etiqueta, Linha, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { TrabalhoContratado } from "../../componentes/TrabalhoContratado";
import { VerFotografias } from "../../componentes/VerFotografias";
import { useTrabalhos } from "../../estado/Trabalhos";
import { ErroDaApi, pedir } from "../../lib/api";
import {
  andarPorExtenso,
  distanciaDe,
  ELEVADOR,
  emPortugues,
  escolhasDe,
  ESTACIONAMENTO,
  ESTADO_DO_ENTULHO,
  estadoCurto,
  euros,
  imagensDe,
  lerValor,
  MAX_PROPOSTAS_POR_LADO,
  quandoE,
  quantoOProfissionalRecebe,
  servicoDe,
  type Trabalho,
} from "../../lib/trabalhos";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

export default function DetalheDoTrabalho() {
  const c = useCores();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { porId, porPedidoId, carregando, recarregar, marcarAberto } = useTrabalhos();

  // `/trabalho/123` é a negociação; `/trabalho/pedido-45` vem do aviso «o trabalho é seu».
  const pedido = /^pedido-(\d+)$/.exec(id ?? "");
  const t = pedido ? porPedidoId(Number(pedido[1])) : porId(Number(id));

  // Abrir conta como «visto» no painel e no backoffice — só a primeira vez.
  const marcou = useRef(false);
  useEffect(() => {
    if (!t || t.abertoEm || marcou.current) return;
    marcou.current = true;
    marcarAberto(t.negociacaoId);
    void pedir("/api/profissionais/abrir", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId } }).catch(() => {});
  }, [t, marcarAberto]);

  if (!t) {
    return (
      <View style={[estilos.vazio, { backgroundColor: c.fundo }]}>
        <Text style={{ color: c.suave, fontSize: LETRA.normal, textAlign: "center" }}>
          {carregando ? "A carregar…" : "Este trabalho já não está na sua lista."}
        </Text>
        {!carregando ? <Botao titulo="Voltar a ler" tipo="secundario" aoCarregar={() => void recarregar()} /> : null}
      </View>
    );
  }
  return <Detalhe t={t} />;
}

function Detalhe({ t }: { t: Trabalho }) {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const [falharam, setFalharam] = useState<string[]>([]);
  const [aberta, setAberta] = useState<number | null>(null);
  const fotos = imagensDe(t.filesJson).filter((u) => !falharam.includes(u));
  const estado = estadoCurto(t);
  const eDele = t.estado === "acordada";

  return (
    <>
      <Stack.Screen options={{ title: `Pedido #${t.pedidoId}` }} />
      <ScrollView style={{ backgroundColor: c.fundo }} contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}>
        {fotos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: ESPACO.s }}>
            {fotos.map((u, i) => (
              <Pressable key={u} onPress={() => setAberta(i)} accessibilityRole="imagebutton" accessibilityLabel={`Ver a fotografia ${i + 1} de ${fotos.length}`}>
                <Image
                  source={{ uri: u }}
                  onError={() => setFalharam((f) => [...f, u])}
                  style={[estilos.foto, { backgroundColor: c.superficie }]}
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <VerFotografias key={aberta ?? -1} fotos={fotos} inicio={aberta} aoFechar={() => setAberta(null)} />

        <View style={{ gap: ESPACO.s }}>
          <View style={estilos.etiquetas}>
            {estado ? <Etiqueta texto={estado.texto} tom={estado.tom} /> : null}
            {t.ofertaClyon ? <Etiqueta texto="CLYON · valor fixo" tom="bom" /> : null}
            {t.formaDePagamento === "dinheiro" ? <Etiqueta texto="paga em dinheiro" tom="neutro" /> : null}
          </View>
          <Text style={[estilos.titulo, { color: c.tinta }]}>{servicoDe(t)}</Text>
          <Text style={{ color: c.suave, fontSize: LETRA.normal }}>
            {[t.city, distanciaDe(t)].filter(Boolean).join(" · ")}
          </Text>
        </View>

        {eDele ? <TrabalhoContratado t={t} /> : <Accoes t={t} />}

        {t.description ? (
          <Caixa>
            <TituloDaCaixa>O que o cliente pede</TituloDaCaixa>
            <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 23 }}>{t.description}</Text>
          </Caixa>
        ) : null}

        <Caixa>
          <TituloDaCaixa>O pedido #{t.pedidoId}</TituloDaCaixa>
          <Linha rotulo="Quando" valor={quandoE(t)} />
          <Linha rotulo="Onde" valor={t.city} />
          <Linha rotulo="Distância da sua base" valor={distanciaDe(t)} />
          <Linha rotulo="Andar" valor={andarPorExtenso(t.floor)} />
          <Linha rotulo="Elevador" valor={emPortugues(ELEVADOR, t.hasElevator)} />
          <Linha rotulo="Estacionar" valor={emPortugues(ESTACIONAMENTO, t.parkingDistance)} />
          <Linha rotulo="Para onde vai" valor={t.localidadeDestino} />
          <Linha rotulo="Andar no destino" valor={andarPorExtenso(t.andarDestino)} />
          <Linha rotulo="Percurso" valor={t.percursoKm != null ? `${Math.round(t.percursoKm)} km` : null} />
          <Linha rotulo="Entulho" valor={emPortugues(ESTADO_DO_ENTULHO, t.entulhoEstado)} />
          <Linha rotulo="Quantidade" valor={t.entulhoQuantidade ? `${t.entulhoQuantidade} sacos` : null} />
          <Linha rotulo="Fatura" valor={t.precisaFatura ? "O cliente pede fatura" : null} />
          <Linha rotulo="Guia de transporte" valor={t.precisaGuiaTransporte ? "Este trabalho exige guia" : null} />
          {!eDele ? (
            <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20, marginTop: ESPACO.xs }}>
              O nome, o telefone e a morada do cliente aparecem aqui quando o trabalho for seu.
            </Text>
          ) : null}
        </Caixa>
      </ScrollView>
    </>
  );
}

// ── Aceitar, propor, recusar ────────────────────────────────────────────────

type Pendente = { accao: "aceitar" | "propor" | "desistir" | "recusar"; valor?: number };

function Accoes({ t }: { t: Trabalho }) {
  const c = useCores();
  const { recarregar } = useTrabalhos();
  const e = escolhasDe(t);
  const [texto, setTexto] = useState(e.referenciaParaPropor != null ? String(e.referenciaParaPropor).replace(".", ",") : "");
  const [aPropor, setAPropor] = useState(!e.podeAceitar && e.podePropor);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<{ pendente: Pendente; lista: string[] } | null>(null);

  async function agir(p: Pendente, avisosAceites = false) {
    setAEnviar(true);
    setErro(null);
    try {
      await pedir("/api/profissionais/negociacao", {
        metodo: "POST",
        corpo: {
          negociacaoId: t.negociacaoId,
          accao: p.accao,
          valor: p.valor,
          avisosAceites,
          // Num Trabalho CLYON, o valor que este ecrã mostrou: se mudou, o site recusa.
          valorVisto: e.valorFixo ? e.valorParaAceitar : undefined,
        },
      });
      setAvisos(null);
      setConfirmarSaida(false);
      await recarregar();
    } catch (err) {
      if (err instanceof ErroDaApi) {
        const lista = err.corpo.avisos;
        if (err.estado === 409 && Array.isArray(lista) && lista.length > 0) {
          setAvisos({ pendente: p, lista: lista as string[] });
        } else {
          setErro(err.message);
          if (err.corpo.valorMudou) await recarregar();
        }
      } else {
        setErro("Não foi possível responder. Tente outra vez.");
      }
    } finally {
      setAEnviar(false);
    }
  }

  // ── Estados em que já não há nada a decidir aqui ──
  // (O trabalho que já é dele — `acordada` — tem o seu ecrã: `TrabalhoContratado`.)
  if (t.estado === "desistida" || t.estado === "morta") {
    return (
      <Caixa>
        <TituloDaCaixa>Negociação terminada</TituloDaCaixa>
        <Text style={{ color: c.suave }}>{t.pedidoCancelado ? "O pedido foi cancelado." : "Este trabalho já não está em aberto."}</Text>
      </Caixa>
    );
  }

  const caixaDosAvisos = avisos ? (
    <View style={{ gap: ESPACO.s }}>
      {avisos.lista.map((a) => {
        const ficha = FICHA_DO_AVISO[a as keyof typeof FICHA_DO_AVISO];
        return (
          <Mensagem key={a} tom="aviso" texto={ficha ? `${ficha.titulo}. ${ficha.corpo}` : a} />
        );
      })}
      <Botao
        titulo={FICHA_DO_AVISO[avisos.lista[0] as keyof typeof FICHA_DO_AVISO]?.botao ?? "Percebi — continuar"}
        aoCarregar={() => void agir(avisos.pendente, true)}
        ocupado={aEnviar}
      />
      <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setAvisos(null)} />
    </View>
  ) : null;

  if (t.estado === "aguarda_contratacao") {
    return (
      <Caixa>
        <TituloDaCaixa>À espera do cliente</TituloDaCaixa>
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 23 }}>
          {t.valorAcordado != null ? `Aceitou ${euros(quantoOProfissionalRecebe(t.valorAcordado, t.taxas))}. ` : ""}
          {t.ofertaClyon ? "A CLYON vai escolher quem fica com o trabalho." : "Falta o cliente confirmar que o contrata."}
        </Text>
        {erro ? <Mensagem texto={erro} /> : null}
        <Sair confirmar={confirmarSaida} setConfirmar={setConfirmarSaida} titulo="Desistir" aEnviar={aEnviar} aoConfirmar={() => void agir({ accao: "desistir" })} />
      </Caixa>
    );
  }

  // ── Trabalho CLYON: valor fixo, aceitar ou recusar ──
  if (e.valorFixo) {
    const valor = e.valorParaAceitar;
    return (
      <Caixa>
        <TituloDaCaixa>Valor fixo da CLYON</TituloDaCaixa>
        {valor != null ? (
          <View style={{ gap: 2 }}>
            <Text style={[estilos.numero, { color: c.bom }]}>{euros(quantoOProfissionalRecebe(valor, t.taxas))}</Text>
            <Text style={{ color: c.suave }}>o que recebe · trabalho de {euros(valor)} sem IVA</Text>
          </View>
        ) : null}
        {erro ? <Mensagem texto={erro} /> : null}
        {caixaDosAvisos ?? (
          <>
            {e.podeAceitar ? <Botao titulo="Aceitar o trabalho" ocupado={aEnviar} aoCarregar={() => void agir({ accao: "aceitar" })} /> : null}
            <Sair confirmar={confirmarSaida} setConfirmar={setConfirmarSaida} titulo="Recusar" aEnviar={aEnviar} aoConfirmar={() => void agir({ accao: "recusar" })} />
          </>
        )}
      </Caixa>
    );
  }

  // ── Pedido normal: negociação com o cliente ──
  const valorProposto = lerValor(texto);
  const sugestao = t.sugestao;
  return (
    <Caixa>
      <TituloDaCaixa>{e.podeAceitar ? "O cliente fez uma proposta" : "A sua proposta"}</TituloDaCaixa>

      {e.podeAceitar && e.valorParaAceitar != null ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={[estilos.numero, { color: c.bom }]}>{euros(quantoOProfissionalRecebe(e.valorParaAceitar, t.taxas))}</Text>
          <Text style={{ color: c.suave }}>o que recebe se aceitar · o cliente propõe {euros(e.valorParaAceitar)} sem IVA</Text>
          {!avisos ? <Botao titulo="Aceitar" ocupado={aEnviar} aoCarregar={() => void agir({ accao: "aceitar" })} /> : null}
          {e.podePropor && !aPropor && !avisos ? (
            <Botao titulo="Propor outro valor" tipo="secundario" aoCarregar={() => setAPropor(true)} />
          ) : null}
        </View>
      ) : null}

      {sugestao && e.primeiraProposta && e.podePropor ? (
        <View style={[estilos.sugestao, { backgroundColor: c.marcaSuave }]}>
          <Text style={{ color: c.marca, fontWeight: "700" }}>Sugestão CLYON, calculada para si</Text>
          <Text style={{ color: c.tinta }}>
            Propor {euros(sugestao.precoSugerido)} · recebe {euros(sugestao.recebeSePropuser)} · lucro estimado {euros(sugestao.lucroEstimado)}
          </Text>
          <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>Abaixo de {euros(sugestao.custoMinimo)} é prejuízo.</Text>
        </View>
      ) : null}

      {e.podePropor && aPropor && !avisos ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.tinta, fontWeight: "600" }}>Valor do trabalho, sem IVA</Text>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={c.suave}
            accessibilityLabel="Valor a propor, sem IVA"
            style={[estilos.campo, { borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
          />
          {sugestao ? (
            <View style={{ flexDirection: "row", gap: ESPACO.s, flexWrap: "wrap" }}>
              {[0.1, 0.2, 0.4].map((p) => {
                const v = Math.round(sugestao.precoSugerido * (1 + p));
                return (
                  <Pressable key={p} onPress={() => setTexto(String(v))} style={[estilos.atalho, { borderColor: c.linha }]}>
                    <Text style={{ color: c.marca, fontWeight: "700" }}>+{Math.round(p * 100)}% · {v} €</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Text style={{ color: c.suave }}>
            {valorProposto != null ? `Recebe ${euros(quantoOProfissionalRecebe(valorProposto, t.taxas))}, já com a taxa.` : "Escreva o valor, por exemplo 120,50."}
          </Text>
          <Botao
            titulo="Enviar proposta"
            ocupado={aEnviar}
            desactivado={valorProposto == null}
            aoCarregar={() => valorProposto != null && void agir({ accao: "propor", valor: valorProposto })}
          />
          <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>
            {e.propostasPorUsar} de {MAX_PROPOSTAS_POR_LADO} propostas por usar.
          </Text>
        </View>
      ) : null}

      {!e.podeAceitar && !e.podePropor ? (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal }}>A sua proposta está com o cliente. Avisamos quando ele responder.</Text>
      ) : null}

      {erro ? <Mensagem texto={erro} /> : null}
      {caixaDosAvisos}
      {e.podeDesistir && !avisos ? (
        <Sair confirmar={confirmarSaida} setConfirmar={setConfirmarSaida} titulo="Não estou interessado" aEnviar={aEnviar} aoConfirmar={() => void agir({ accao: "desistir" })} />
      ) : null}
    </Caixa>
  );
}

/** Recusar pede uma segunda confirmação — não há volta atrás. */
function Sair(p: { confirmar: boolean; setConfirmar: (v: boolean) => void; titulo: string; aEnviar: boolean; aoConfirmar: () => void }) {
  const c = useCores();
  if (!p.confirmar) return <Botao titulo={p.titulo} tipo="perigo" aoCarregar={() => p.setConfirmar(true)} />;
  return (
    <View style={{ gap: ESPACO.s }}>
      <Text style={{ color: c.tinta }}>Tem a certeza? O trabalho sai da sua lista de pedidos em aberto.</Text>
      <Botao titulo={`Sim, ${p.titulo.toLowerCase()}`} tipo="perigo" ocupado={p.aEnviar} aoCarregar={p.aoConfirmar} />
      <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => p.setConfirmar(false)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  vazio: { flex: 1, alignItems: "center", justifyContent: "center", gap: ESPACO.l, padding: ESPACO.xl },
  pagina: { padding: ESPACO.l, gap: ESPACO.m },
  foto: { width: 200, height: 140, borderRadius: RAIO.m },
  etiquetas: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  titulo: { fontSize: LETRA.titulo, fontWeight: "800" },
  numero: { fontSize: LETRA.grande, fontWeight: "800", fontVariant: ["tabular-nums"] },
  sugestao: { borderRadius: RAIO.m, padding: ESPACO.m, gap: 4 },
  campo: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, minHeight: 52, fontSize: LETRA.media, fontWeight: "700" },
  atalho: { borderWidth: 1, borderRadius: 999, paddingHorizontal: ESPACO.m, paddingVertical: 6 },
});
