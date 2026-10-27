import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../../componentes/Texto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FICHA_DO_AVISO } from "../../../../src/lib/avisos-antes-de-cotar";
import { Botao, Caixa, Etiqueta, Linha, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { TrabalhoContratado } from "../../componentes/TrabalhoContratado";
import { Arrumar } from "../../componentes/Arrumar";
import { AvisosDoValor } from "../../componentes/AvisosDoValor";
import { Historico } from "../../componentes/Historico";
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
  outrosAnexosDe,
  lerValor,
  MAX_PROPOSTAS_POR_LADO,
  paraOsSinaisDe,
  quandoE,
  quantoOProfissionalRecebe,
  separadorDe,
  servicoDe,
  sugestaoComOutraEquipa,
  TRABALHO_COM_PRECO_FECHADO,
  type Trabalho,
} from "../../lib/trabalhos";
import { porKmPorExtenso, sinaisDoTrabalho } from "../../../../src/lib/sinais-do-trabalho";
import { etiquetaDaBase, lerBase } from "../../../../src/lib/base-do-preco";
import { concorrenciaDoPedido } from "../../../../src/lib/concorrencia";
import { MAX_PROPOSTAS_POR_EXTENSO } from "../../../../src/lib/negociacao";
import { horasPorExtenso, horasValidas, pessoasValidas } from "../../../../src/lib/sugestao-ajustada";
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
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={{ backgroundColor: c.fundo }} contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}>
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
        <OutrosAnexos t={t} />

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
          <SinaisDoTrabalho t={t} />
        </View>

        {/* A descrição em destaque, logo abaixo do valor — pedido do dono, 18-10-2026. */}
        {eDele ? (
          <TrabalhoContratado t={t} descricao={t.description ? <DescricaoDoPedido texto={t.description} /> : null} />
        ) : (
          <>
            <Accoes t={t} />
            {t.description ? <DescricaoDoPedido texto={t.description} /> : null}
          </>
        )}

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
          {/* «O cliente pede fatura» saiu, como no painel (01-10-2026): há factura
              em todas as vendas e é a parceira que a emite, não o profissional. */}
          <Linha rotulo="Guia de transporte" valor={t.precisaGuiaTransporte ? "Este trabalho exige guia" : null} />
          {!eDele ? (
            <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20, marginTop: ESPACO.xs }}>
              O nome, o telefone e a morada do cliente aparecem aqui quando o trabalho for seu.
            </Text>
          ) : null}
        </Caixa>

        {/* Arrumar — no fim, depois de ler tudo. Em qualquer estado, como no painel. */}
        <Historico t={t} />
        <Arrumar t={t} />
      </ScrollView>
    </>
  );
}

/** O que o cliente pede — em destaque: é o que diz o que há para fazer. */
function DescricaoDoPedido({ texto }: { texto: string }) {
  const c = useCores();
  return (
    <Caixa estilo={{ backgroundColor: c.marcaSuave, borderColor: c.marca, borderLeftWidth: 4 }}>
      <Text style={{ color: c.marca, fontSize: LETRA.media, fontWeight: "800" }}>O que o cliente pede</Text>
      <Text style={{ color: c.tinta, fontSize: LETRA.media, lineHeight: 24, fontWeight: "500" }}>{texto}</Text>
    </Caixa>
  );
}

// ── Os sinais do painel: perto, hoje, bem pago, o €/km ──────────────────────

function SinaisDoTrabalho({ t }: { t: Trabalho }) {
  const sep = separadorDe(t);
  if (sep !== "novos" && sep !== "negociacao") return null;
  const paraOsSinais = paraOsSinaisDe(t, sep);
  const sinais = sinaisDoTrabalho(paraOsSinais);
  const porKm = porKmPorExtenso(paraOsSinais);
  if (sinais.length === 0 && !porKm) return null;
  return (
    <View style={estilos.etiquetas}>
      {sinais.map((s) => (
        <Etiqueta key={s.chave} texto={`${s.emoji} ${s.texto}`} tom={s.chave === "bem_pago" ? "bom" : "aviso"} />
      ))}
      {porKm ? <Etiqueta texto={porKm} tom="neutro" /> : null}
    </View>
  );
}

/** «N de 7 propostas» — quantos outros profissionais já propuseram neste pedido. */
function Concorrencia({ t }: { t: Trabalho }) {
  const c = useCores();
  const k = concorrenciaDoPedido(t.concorrentes);
  const fatia = k.quantas / MAX_PROPOSTAS_POR_LADO;
  const cor = fatia <= 0.5 ? c.bom : fatia < 1 ? c.aviso : c.mau;
  return (
    <View style={{ gap: 4 }}>
      <View style={[estilos.barra, { backgroundColor: c.fundo }]}>
        <View style={{ width: `${Math.max(k.porCento, 2)}%`, height: "100%", backgroundColor: cor, borderRadius: 999 }} />
      </View>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>{k.texto}</Text>
    </View>
  );
}

/**
 * «Valor sugerido pela CLYON» — o número grande do painel antes de ele propor,
 * o mesmo do cartão da lista. Faltava: o #469 dizia 235 € na lista e, aberto,
 * só a conta dos custos dele (80 €), com o «sugeria» a falar de um número que
 * o ecrã não mostrava (20-10-2026).
 */
function ValorSugeridoPelaClyon({ t }: { t: Trabalho }) {
  const c = useCores();
  if (t.valorDaClyon == null) return null;
  const base = lerBase(t.baseDoPreco);
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.suave }}>Valor sugerido pela CLYON</Text>
      <Text style={[estilos.numero, { color: c.bom }]}>{euros(t.valorDaClyon)}</Text>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>
        {base !== "total" ? `${etiquetaDaBase(base)} · ` : ""}já com a taxa CLYON descontada · o valor é sem IVA
      </Text>
    </View>
  );
}

/** − valor + : meia hora ou uma pessoa de cada vez, o passo do painel. */
function Contador({ rotulo, valor, aoTirar, aoPor }: { rotulo: string; valor: string; aoTirar: () => void; aoPor: () => void }) {
  const c = useCores();
  const botao = (icone: "remove" | "add", acao: () => void, nome: string) => (
    <Pressable
      onPress={acao}
      accessibilityRole="button"
      accessibilityLabel={`${nome} — ${rotulo}`}
      hitSlop={6}
      style={({ pressed }) => [estilos.contador, { borderColor: c.linha, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icone} size={18} color={c.marca} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: ESPACO.s }}>
      <Text style={{ flex: 1, color: c.tinta, fontSize: LETRA.pequena + 1 }}>{rotulo}</Text>
      {botao("remove", aoTirar, "Menos")}
      <Text style={{ minWidth: 86, textAlign: "center", color: c.tinta, fontWeight: "700" }}>{valor}</Text>
      {botao("add", aoPor, "Mais")}
    </View>
  );
}

/**
 * Os vídeos e os PDF do cliente — versão 12. As fotografias vêem-se em grande
 * lá em cima; isto abre-se no leitor do telemóvel.
 */
function OutrosAnexos({ t }: { t: Trabalho }) {
  const c = useCores();
  const anexos = outrosAnexosDe(t.filesJson);
  if (anexos.length === 0) return null;
  return (
    <View style={estilos.etiquetas}>
      {anexos.map((a) => (
        <Pressable
          key={a.url}
          onPress={() => void Linking.openURL(a.url)}
          accessibilityRole="link"
          accessibilityLabel={`Abrir ${a.nome} do cliente`}
          style={({ pressed }) => [estilos.anexo, { borderColor: c.linha, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name={a.especie === "video" ? "play-circle-outline" : "document-text-outline"} size={18} color={c.marca} />
          <Text style={{ color: c.tinta, fontWeight: "600" }}>{a.nome}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** «Para os seus custos, sugeria X» — quando o número grande é da CLYON e a conta dele dá outro. */
function SugeriaParaOsSeusCustos({ t }: { t: Trabalho }) {
  const c = useCores();
  const s = t.sugestao;
  if (t.valorDaClyon == null || !s || Math.abs(t.valorDaClyon - s.recebeSePropuser) < 1) return null;
  return (
    <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
      Para os seus custos, sugeria {euros(s.recebeSePropuser)}.
    </Text>
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
  // As horas e as pessoas que ele mudou na conta (null = as da CLYON).
  const [horasDitas, setHorasDitas] = useState<number | null>(null);
  const [pessoasDitas, setPessoasDitas] = useState<number | null>(null);

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
    // Num trabalho CLYON, as frases do painel (`OfertaDaClyon`): quem ficou, ou que foi cancelado.
    if (t.ofertaClyon) {
      return (
        <Caixa>
          <TituloDaCaixa>
            {t.estado === "morta"
              ? t.pedidoCancelado
                ? "Este trabalho foi cancelado pela CLYON"
                : "A CLYON escolheu outro profissional"
              : "Recusou este trabalho"}
          </TituloDaCaixa>
        </Caixa>
      );
    }
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
        <TituloDaCaixa>{t.ofertaClyon ? "Aceitou — a CLYON vai escolher" : "À espera do cliente"}</TituloDaCaixa>
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 23 }}>
          {t.ofertaClyon
            ? `Aceitou o trabalho de ${euros(t.valorAcordado ?? t.valorFixo ?? 0)} (ganhos estimados de ${euros(quantoOProfissionalRecebe(t.valorAcordado ?? t.valorFixo ?? 0, t.taxas))}). A CLYON escolhe entre os profissionais que aceitaram, e avisa-o se for o escolhido.`
            : `Aceitou ${euros(quantoOProfissionalRecebe(t.valorAcordado ?? 0, t.taxas))}. Falta o cliente confirmar que o contrata — pode estar a falar com mais profissionais.`}
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
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
          Deseja aceitar este trabalho? Não há propostas: só aceitar ou recusar.
        </Text>
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{TRABALHO_COM_PRECO_FECHADO}</Text>
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
          {t.ofertaClyon === "directa"
            ? "A CLYON escolheu-o para este trabalho. Se aceitar, é seu — a morada e o contacto do cliente aparecem logo."
            : "Foi oferecido a mais profissionais. Se aceitar, fica na lista de quem o quer; a CLYON escolhe e avisa-o."}
        </Text>
        <SugeriaParaOsSeusCustos t={t} />
        <AvisosDoValor t={t} />
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
  const sugestao =
    t.sugestao && (horasDitas != null || pessoasDitas != null)
      ? (sugestaoComOutraEquipa(t.sugestao, horasDitas ?? t.sugestao.horas, pessoasDitas ?? t.sugestao.pessoas) ?? t.sugestao)
      : t.sugestao;
  // Só com as parcelas todas é que a conta se refaz; uma sugestão antiga não mostra os campos.
  const podeMudarAConta = t.sugestao != null && sugestaoComOutraEquipa(t.sugestao, t.sugestao.horas, t.sugestao.pessoas) != null;
  return (
    <Caixa>
      <TituloDaCaixa>{e.podeAceitar ? "O cliente fez uma proposta" : "A sua proposta"}</TituloDaCaixa>
      {t.estado === "aberta" ? <Concorrencia t={t} /> : null}
      {e.primeiraProposta ? <ValorSugeridoPelaClyon t={t} /> : null}
      {e.primeiraProposta ? <SugeriaParaOsSeusCustos t={t} /> : null}
      <AvisosDoValor t={t} />

      {e.podeAceitar && e.valorParaAceitar != null ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={[estilos.numero, { color: c.bom }]}>{euros(quantoOProfissionalRecebe(e.valorParaAceitar, t.taxas))}</Text>
          <Text style={{ color: c.suave }}>
            o que recebe{t.formaDePagamento === "dinheiro" ? " em mão" : ""} se aceitar · o cliente propõe {euros(e.valorParaAceitar)} sem IVA
          </Text>
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
          {/* O tempo e a equipa, como no painel: a conta refaz-se aqui, sem ir ao site. */}
          {podeMudarAConta ? (
            <View style={{ gap: ESPACO.s, marginTop: ESPACO.xs }}>
              <Contador
                rotulo="Tempo estimado"
                valor={horasPorExtenso(sugestao.horas)}
                aoTirar={() => setHorasDitas(horasValidas(sugestao.horas - 0.5))}
                aoPor={() => setHorasDitas(horasValidas(sugestao.horas + 0.5))}
              />
              <Contador
                rotulo="Quantas pessoas"
                valor={`${sugestao.pessoas} ${sugestao.pessoas === 1 ? "pessoa" : "pessoas"}`}
                aoTirar={() => setPessoasDitas(pessoasValidas(sugestao.pessoas - 1))}
                aoPor={() => setPessoasDitas(pessoasValidas(sugestao.pessoas + 1))}
              />
              {horasDitas != null || pessoasDitas != null ? (
                <Text
                  onPress={() => {
                    setHorasDitas(null);
                    setPessoasDitas(null);
                  }}
                  accessibilityRole="button"
                  style={{ color: c.marca, fontWeight: "700", fontSize: LETRA.pequena + 1 }}
                >
                  Repor a nossa conta
                </Text>
              ) : null}
              {(sugestao.pressupostos ?? []).map((linha) => (
                <Text key={linha} style={{ color: c.suave, fontSize: LETRA.pequena, lineHeight: 18 }}>
                  · {linha}
                </Text>
              ))}
            </View>
          ) : null}
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
      {!e.podePropor && e.propostasPorUsar === 0 ? (
        <Mensagem
          tom="aviso"
          texto={`Gastou as ${MAX_PROPOSTAS_POR_EXTENSO} propostas. Só pode aceitar o que está em cima da mesa ou desistir.`}
        />
      ) : null}

      {erro ? <Mensagem texto={erro} /> : null}
      {caixaDosAvisos}
      {e.podeDesistir && !avisos ? (
        <Sair confirmar={confirmarSaida} setConfirmar={setConfirmarSaida} titulo="Não estou interessado" aEnviar={aEnviar} aoConfirmar={() => void agir({ accao: "desistir" })} />
      ) : null}
      {/* A nota do painel: a negociação é só de valores. */}
      <Text style={{ color: c.suave, fontSize: LETRA.pequena, lineHeight: 18, marginTop: ESPACO.xs }}>
        Porque é que não há mensagens: a negociação é só de valores. Sem conversa não há combinação por fora — e é isso
        que mantém o acordo por escrito, dos dois lados. Tem {MAX_PROPOSTAS_POR_EXTENSO} propostas, e a sua fica de pé até o
        cliente lhe responder.
      </Text>
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
  barra: { height: 6, borderRadius: 999, overflow: "hidden" },
  contador: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  anexo: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: ESPACO.m, paddingVertical: 8 },
});
