import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Acompanhar } from "./Acompanhar";
import { AlterarOPedido } from "./AlterarOPedido";
import { Avaliacoes } from "./Avaliacoes";
import { Avaliar } from "./Avaliar";
import { Mensagens } from "./Mensagens";
import { Pagar } from "./Pagar";
import { Preco } from "./Preco";
import { Proposta } from "./Proposta";
import { Text } from "./Texto";
import { TrabalhoClyon } from "./TrabalhoClyon";
import { TrabalhoFeito } from "./TrabalhoFeito";
import { Miniaturas, VerFotografias } from "./VerFotografias";
import { Aviso, Botao, Campo, Cartao, Carregando, Confirmacao, Etiqueta, Ligacao, Paragrafo, Subtitulo, Titulo } from "./ui";
import { useCatalogo } from "../estado/Catalogo";
import { usePedidos } from "../estado/Pedidos";
import { abrirNoNavegador, whatsappDaClyon } from "../lib/abrir";
import { ErroDaApi, mensagemDe, pedir as pedirComConta } from "../lib/api";
import type { Pedir } from "../lib/erros";
import { LINK } from "../lib/pedido-do-link";
import {
  accaoDeContratar,
  atalhosDoEcra,
  contratadaDe,
  corpoDePropor,
  perguntaDeRecusar,
  propostasEmAberto,
  ROTA_DAS_ACCOES,
  ROTA_DO_PEDIDO,
  TEXTOS_DA_ALTERACAO,
  textoDaEspera,
  textoDeContratar,
  whatsappTrocaDeProfissional,
  type ExtrasDosTextosV3,
  type Negociacao,
  type NegociacaoV3,
  type PedidoV3,
  type Profissional,
  type RespostaDoPedido,
} from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * E5 v3 — O PEDIDO (R5), com o pagar (E7), o acompanhar (E8), o confirmar
 * (E9), o avaliar (E10), as mensagens com a CLYON (E5M) e alterar o pedido
 * (E5A), só o que se aplica ao momento. Serve a conta (`pedido/[id]`) e o
 * pedido aberto pelo link sem conta (`convidado/[id]`, A9): a diferença é o
 * `pedir` (a sessão de convidado e o código do aparelho) e o que não se mostra
 * sem conta — nada de pagar, nem «Pedir outra vez» (D1).
 *
 * As propostas vêm pela ordem da R5 — a última actividade em cima, a mesma do
 * site (P3) — e a app não reordena. As acções vão todas pela R8
 * (`POST /api/users/me/negociacao`); depois de cada uma, a app volta a ler o
 * pedido. Um 409 (o outro lado mudou entretanto) mostra a frase da API e
 * recarrega. Os campos novos da v3 só aparecem quando a API os manda.
 */
export type ModoConvidado = { pedir: Pedir; aoCriarConta: () => void };

type Resposta = Omit<RespostaDoPedido, "pedido" | "negociacoes" | "textos"> & {
  pedido: PedidoV3;
  negociacoes: NegociacaoV3[];
  textos: RespostaDoPedido["textos"] & ExtrasDosTextosV3;
};

function LinhaDoPedido({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <View style={{ gap: 2, paddingVertical: 8, borderTopWidth: 1, borderTopColor: CORES.linha }}>
      <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{rotulo}</Text>
      <Text style={{ color: CORES.tinta, fontSize: 14.5, lineHeight: 20 }}>{texto}</Text>
    </View>
  );
}

export function VistaDoPedido({ pedidoId, convidado }: { pedidoId: number; convidado?: ModoConvidado }) {
  const pedir = convidado?.pedir ?? pedirComConta;
  const { catalogo } = useCatalogo();
  const { recarregar: recarregarALista } = usePedidos();
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aLer, setALer] = useState(true);
  const [avisoDaAccao, setAvisoDaAccao] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  const [aContratar, setAContratar] = useState<Negociacao | null>(null);
  const [aRecusar, setARecusar] = useState<Negociacao | null>(null);
  const [aPropor, setAPropor] = useState<NegociacaoV3 | null>(null);
  const [valorProposto, setValorProposto] = useState("");
  const [aCancelar, setACancelar] = useState(false);
  const [aAlterar, setAAlterar] = useState(false);
  const [motivoPedido, setMotivoPedido] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erroNaConfirmacao, setErroNaConfirmacao] = useState<string | null>(null);
  const [avaliacoesDe, setAvaliacoesDe] = useState<Profissional | null>(null);
  const [fotoAberta, setFotoAberta] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    if (!Number.isInteger(pedidoId)) {
      setErro("Pedido não encontrado.");
      setALer(false);
      return;
    }
    setALer(true);
    try {
      setR(await pedir<Resposta>(ROTA_DO_PEDIDO(pedidoId)));
      setErro(null);
    } catch (e) {
      if (!(e instanceof ErroDaApi && e.estado === 401 && !convidado)) setErro(mensagemDe(e, "Não foi possível ler o pedido."));
    } finally {
      setALer(false);
    }
  }, [pedidoId, pedir, convidado]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const depoisDeAgir = useCallback(() => {
    void carregar();
    if (!convidado) void recarregarALista();
    else setFeito(true);
  }, [carregar, convidado, recarregarALista]);

  /** Uma acção da R8. Devolve a frase do erro, ou `null` se correu bem. Depois, volta sempre a ler o pedido. */
  const agir = useCallback(
    async (corpo: Record<string, unknown>): Promise<string | null> => {
      setAvisoDaAccao(null);
      try {
        await pedir(ROTA_DAS_ACCOES, { metodo: "POST", corpo });
        depoisDeAgir();
        return null;
      } catch (e) {
        if (e instanceof ErroDaApi && e.estado === 409) {
          await carregar();
          if (!convidado) void recarregarALista();
        }
        return mensagemDe(e);
      }
    },
    [pedir, carregar, depoisDeAgir, convidado, recarregarALista],
  );

  async function confirmarContratar() {
    if (!aContratar) return;
    const accao = accaoDeContratar(aContratar);
    if (!accao) return;
    setOcupado(true);
    setErroNaConfirmacao(null);
    const e = await agir({ pedidoId, negociacaoId: aContratar.id, accao });
    setOcupado(false);
    setAContratar(null);
    if (e) setAvisoDaAccao(e);
  }

  async function confirmarRecusar() {
    if (!aRecusar) return;
    setOcupado(true);
    const e = await agir({ pedidoId, negociacaoId: aRecusar.id, accao: "desistir" });
    setOcupado(false);
    setARecusar(null);
    if (e) setAvisoDaAccao(e);
  }

  async function confirmarPropor() {
    if (!aPropor) return;
    const corpo = corpoDePropor(pedidoId, aPropor.id, valorProposto);
    if (!corpo) return setErroNaConfirmacao("Escreva o valor, por exemplo 85 ou 85,50.");
    setOcupado(true);
    setErroNaConfirmacao(null);
    const e = await agir(corpo);
    setOcupado(false);
    if (e) setErroNaConfirmacao(e);
    else setAPropor(null);
  }

  async function confirmarCancelar() {
    setOcupado(true);
    setErroNaConfirmacao(null);
    try {
      await pedir(ROTA_DAS_ACCOES, {
        metodo: "POST",
        corpo: { pedidoId, accao: "cancelar_pedido", motivo: motivo.trim() || undefined },
      });
      setACancelar(false);
      setMotivoPedido(null);
      depoisDeAgir();
    } catch (e) {
      // Com trabalho contratado, a API pede o motivo (422 `precisaDeMotivo`).
      if (e instanceof ErroDaApi && e.estado === 422 && e.corpo.precisaDeMotivo === true) setMotivoPedido(e.message);
      else setErroNaConfirmacao(mensagemDe(e));
    } finally {
      setOcupado(false);
    }
  }

  if (aLer && !r) return <Carregando />;
  if (!r) {
    return (
      <View style={{ flex: 1, padding: 20, gap: 14, backgroundColor: CORES.fundo }}>
        <Aviso texto={erro ?? "Não foi possível ler o pedido."} tom="mau" />
        <Botao titulo="Tentar outra vez" aoCarregar={() => void carregar()} />
      </View>
    );
  }

  const p = r.pedido;
  const contratada = contratadaDe(r) as NegociacaoV3 | null;
  const propostas = propostasEmAberto(r) as NegociacaoV3[];
  const espera = textoDaEspera(r);
  const contratar = aContratar ? textoDeContratar(aContratar) : null;
  const alteracoes = p.alteracoes ?? null;
  const acesso =
    typeof p.acesso === "string" ? p.acesso : p.acesso ? [p.acesso.origem && `Origem: ${p.acesso.origem}`, p.acesso.destino && `Destino: ${p.acesso.destino}`].filter(Boolean).join("\n") : null;
  const cabecalho = [`Pedido #${p.id}`, p.cidade, p.criadoEmTexto ? `feito a ${p.criadoEmTexto}` : null].filter(Boolean).join(" · ");

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={{ flex: 1, backgroundColor: CORES.fundo }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: CORES.fundo }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={aLer} onRefresh={() => void carregar()} tintColor={CORES.marca} />}
    >
      {/* D4.1 — a faixa do link sem conta, sempre visível e numa linha. */}
      {convidado ? (
        <Pressable
          onPress={convidado.aoCriarConta}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: CORES.marcaSuave, padding: 12, opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons name="person-add-outline" size={18} color={CORES.marca} />
          <Text style={{ flex: 1, color: CORES.tinta, fontSize: 13 }} numberOfLines={2}>
            {LINK.faixa}
          </Text>
          <Text titulo style={{ color: CORES.marca, fontSize: 13, fontWeight: "700" }}>
            {LINK.criarConta}
          </Text>
        </Pressable>
      ) : null}

      <View style={{ gap: 6 }}>
        <Titulo>{p.servico}</Titulo>
        <Text style={{ color: CORES.suave, fontSize: 13.5 }}>{cabecalho}</Text>
        <Etiqueta texto={p.estadoTexto} />
      </View>

      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      {avisoDaAccao ? <Aviso texto={avisoDaAccao} tom="mau" /> : null}
      {feito && convidado ? <Aviso texto={LINK.depoisDeAgir} tom="bom" /> : null}

      {/* E5M — as mensagens com a CLYON (S18), no topo quando há. */}
      <Mensagens pedidoId={pedidoId} pedido={p} pedir={pedir} aoResponder={depoisDeAgir} />

      {/* d) Trabalho CLYON de valor fixo: sem propostas, sem contratar nem recusar. */}
      {p.trabalhoClyon ? <TrabalhoClyon pedido={p} agir={agir} /> : null}

      {/* a) À espera. */}
      {espera ? (
        <Cartao>
          <Paragrafo>{espera}</Paragrafo>
        </Cartao>
      ) : null}

      {/* b) As propostas, pela ordem da API. */}
      {!p.trabalhoClyon && !contratada && propostas.length > 0 ? (
        <View style={{ gap: 12 }}>
          {r.textos.responderam ? <Subtitulo>{r.textos.responderam}</Subtitulo> : null}
          {r.textos.sobreAsPropostas ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{r.textos.sobreAsPropostas}</Text> : null}
          {propostas.map((n) => (
            <Proposta
              key={n.id}
              n={n}
              textos={r.textos}
              aoContratar={() => {
                setErroNaConfirmacao(null);
                setAContratar(n);
              }}
              aoRecusar={() => setARecusar(n)}
              aoVerAvaliacoes={() => setAvaliacoesDe(n.profissional)}
              aoPropor={() => {
                setErroNaConfirmacao(null);
                setValorProposto("");
                setAPropor(n);
              }}
            />
          ))}
        </View>
      ) : null}

      {/* c) Contratado: pagar, confirmar, avaliar e acompanhar. */}
      {contratada ? (
        <View style={{ gap: 12 }}>
          <Cartao>
            <Subtitulo>{contratada.profissional.nome}</Subtitulo>
            <Text style={{ color: CORES.tinta, fontSize: 14 }}>{contratada.profissional.notaTexto}</Text>
            {contratada.preco ? <Preco preco={contratada.preco} tamanho="medio" /> : null}
            {r.textos.sobreOValorCombinado ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{r.textos.sobreOValorCombinado}</Text> : null}
            {(contratada.emDuasEntregas ?? []).map((l, i) => (
              <Text key={i} style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>
                {l}
              </Text>
            ))}
            {p.combinadoTexto ? <Text style={{ color: CORES.tinta, fontSize: 13.5, lineHeight: 19 }}>{p.combinadoTexto}</Text> : null}
            {!convidado ? <Ligacao titulo="Pedir troca de parceiro" aoCarregar={() => whatsappDaClyon(whatsappTrocaDeProfissional(p.id))} /> : null}
          </Cartao>
          <TrabalhoFeito pedidoId={pedidoId} n={contratada} agir={agir} />
          <Avaliar
            pedidoId={pedidoId}
            n={contratada}
            agir={agir}
            aoPedirOutraVez={
              convidado ? convidado.aoCriarConta : () => router.push({ pathname: "/pedir", params: { servico: p.servico, morada: p.morada ?? "" } })
            }
          />
          {convidado && contratada.avaliado ? <Paragrafo pequeno suave>{LINK.depoisDeAvaliar}</Paragrafo> : null}
          <Pagar pedidoId={pedidoId} n={contratada} aoMudar={() => void carregar()} aoCriarConta={convidado?.aoCriarConta} />
          <Acompanhar pedidoId={pedidoId} n={contratada} agir={agir} />
        </View>
      ) : null}

      {/* E5A — alterar o pedido (S17), quando a API o deixa. */}
      {alteracoes?.pendente ? <Aviso tom="aviso" texto={alteracoes.pendente.texto || TEXTOS_DA_ALTERACAO.emEspera(alteracoes.pendente.quandoTexto)} /> : null}
      {alteracoes && !alteracoes.pode && !alteracoes.pendente && alteracoes.texto && contratada ? <Paragrafo suave>{alteracoes.texto}</Paragrafo> : null}
      {alteracoes?.pode && !alteracoes.pendente ? <Botao titulo="Alterar o pedido" tipo="secundario" aoCarregar={() => setAAlterar(true)} /> : null}

      {/* e) O que pediu. */}
      <Cartao>
        <Subtitulo>O que pediu</Subtitulo>
        <Miniaturas fotos={p.fotos} aoAbrir={setFotoAberta} />
        {(p.videos ?? []).map((v, i) => (
          <Ligacao key={v} titulo={`Ver o vídeo ${i + 1}`} aoCarregar={() => abrirNoNavegador(v)} />
        ))}
        {p.descricao ? <LinhaDoPedido rotulo="Descrição" texto={p.descricao} /> : null}
        {p.morada || p.cidade ? <LinhaDoPedido rotulo={p.morada ? "Morada" : "Zona"} texto={(p.morada ?? p.cidade) as string} /> : null}
        {acesso ? <LinhaDoPedido rotulo="Acesso" texto={acesso} /> : null}
        {p.dataPreferidaTexto || p.quando ? <LinhaDoPedido rotulo="Quando" texto={(p.dataPreferidaTexto ?? p.quando) as string} /> : null}
        {p.repeticao ? <LinhaDoPedido rotulo="Repetir" texto={p.repeticao} /> : null}
        {p.precisaFatura ? <LinhaDoPedido rotulo="Fatura" texto="Quer o NIF na fatura" /> : null}
        {p.precisaGuiaTransporte ? <LinhaDoPedido rotulo="Guia de transporte" texto="Precisa de guia de transporte" /> : null}
        {p.avisos.map((a, i) => (
          <Paragrafo key={i} pequeno suave>
            {a}
          </Paragrafo>
        ))}
        {r.textos.rodape ? <Paragrafo pequeno suave>{r.textos.rodape}</Paragrafo> : null}
      </Cartao>

      {convidado ? <Ligacao titulo="Falar com a CLYON por WhatsApp" aoCarregar={() => whatsappDaClyon(`Pedido #${p.id}`)} /> : null}

      {r.podeCancelar ? (
        <Ligacao
          titulo="Cancelar o pedido"
          tom="mau"
          centrada
          aoCarregar={() => {
            setErroNaConfirmacao(null);
            setMotivoPedido(null);
            setMotivo("");
            setACancelar(true);
          }}
        />
      ) : null}

      <VerFotografias fotos={p.fotos} aberta={fotoAberta} aoFechar={() => setFotoAberta(null)} />
      <Avaliacoes profissional={avaliacoesDe} aoFechar={() => setAvaliacoesDe(null)} />
      {alteracoes?.pode ? (
        <AlterarOPedido
          visivel={aAlterar}
          pedidoId={pedidoId}
          campos={alteracoes.campos}
          pedir={pedir}
          aoFechar={() => setAAlterar(false)}
          aoGuardar={() => {
            setAAlterar(false);
            depoisDeAgir();
          }}
        />
      ) : null}

      <Confirmacao
        visivel={!!aContratar}
        titulo={contratar?.titulo ?? ""}
        texto={contratar?.texto}
        pequeno={catalogo?.textos.fraseUnica ?? null}
        confirmar="Contratar"
        ocupado={ocupado}
        erro={erroNaConfirmacao}
        aoConfirmar={() => void confirmarContratar()}
        aoVoltar={() => setAContratar(null)}
      />

      <Confirmacao
        visivel={!!aRecusar}
        titulo={(aRecusar && perguntaDeRecusar(aRecusar, r)) ?? ""}
        confirmar="Recusar"
        perigo
        ocupado={ocupado}
        aoConfirmar={() => void confirmarRecusar()}
        aoVoltar={() => setARecusar(null)}
      />

      <Confirmacao
        visivel={!!aPropor}
        titulo="Proponha um valor"
        texto={r.textos.proporAjuda ?? "É o que paga se ele aceitar, com tudo incluído."}
        confirmar="Propor"
        ocupado={ocupado}
        erro={erroNaConfirmacao}
        aoConfirmar={() => void confirmarPropor()}
        aoVoltar={() => setAPropor(null)}
      >
        {atalhosDoEcra(aPropor?.atalhos).length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {atalhosDoEcra(aPropor?.atalhos).map((a) => (
              <Pressable
                key={a.rotulo}
                onPress={() => setValorProposto(a.valor)}
                accessibilityRole="button"
                style={{ paddingHorizontal: 12, minHeight: 38, justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: CORES.linhaForte }}
              >
                <Text style={{ color: CORES.tinta, fontSize: 13.5 }}>{a.rotulo}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Campo rotulo="Valor" valor={valorProposto} aoMudar={(v) => setValorProposto(v.replace(/[^\d,.]/g, ""))} keyboardType="decimal-pad" />
      </Confirmacao>

      <Confirmacao
        visivel={aCancelar}
        titulo={`Cancelar o pedido #${p.id}?`}
        texto="Os parceiros deixam de o ver."
        confirmar="Cancelar o pedido"
        perigo
        ocupado={ocupado}
        erro={erroNaConfirmacao}
        aoConfirmar={() => void confirmarCancelar()}
        aoVoltar={() => setACancelar(false)}
      >
        {motivoPedido ? <Campo rotulo={`${motivoPedido} Escreva o motivo:`} valor={motivo} aoMudar={setMotivo} multiline maxLength={300} /> : null}
      </Confirmacao>
    </ScrollView>
    </SafeAreaView>
  );
}
