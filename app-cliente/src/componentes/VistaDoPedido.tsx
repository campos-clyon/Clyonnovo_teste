import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, RefreshControl, View } from "react-native";
import * as Notifications from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { RolagemComTeclado } from "./Teclado";
import { SafeAreaView } from "react-native-safe-area-context";
import { Acompanhar } from "./Acompanhar";
import { AlterarOPedido } from "./AlterarOPedido";
import { Avaliacoes } from "./Avaliacoes";
import { Avaliar } from "./Avaliar";
import { EscolhidosSemResposta } from "./EscolhidosSemResposta";
import { Mensagens } from "./Mensagens";
import { ResumoDoPagamento } from "./Pagar";
import { PagarAoParceiro } from "./PagarAoParceiro";
import { Preco } from "./Preco";
import { MomentoDoPedido, PassosDoPedido } from "./PassoAPasso";
import { Proposta } from "./Proposta";
import { Text } from "./Texto";
import { TrabalhoClyon } from "./TrabalhoClyon";
import { TrabalhoFeito } from "./TrabalhoFeito";
import { TrabalhoJaFeito } from "./TrabalhoJaFeito";
import { HorasDoTrabalho } from "./HorasDoTrabalho";
import { Miniaturas, VerFotografias } from "./VerFotografias";
import { Aviso, Botao, Campo, Cartao, Carregando, Confirmacao, Etiqueta, Ligacao, Paragrafo, Recolhido, Subtitulo, Titulo } from "./ui";
import { useCatalogo } from "../estado/Catalogo";
import { usePedidos } from "../estado/Pedidos";
import { abrirNoNavegador, whatsappDaClyon } from "../lib/abrir";
import { ErroDaApi, mensagemDe, pedir as pedirComConta } from "../lib/api";
import type { Pedir } from "../lib/erros";
import { abreOPagamentoDepoisDeContratar } from "../lib/pagamento";
import { LINK } from "../lib/pedido-do-link";
import {
  accaoDeContratar,
  atalhosDoEcra,
  contratadaDe,
  corpoDePropor,
  perguntaDeRecusar,
  porqueNaoSeContrata,
  aFolhaMudou,
  propostasEmAberto,
  ROTA_DAS_ACCOES,
  ROTA_DO_PEDIDO,
  TEXTOS_DA_ALTERACAO,
  textoDaEspera,
  whatsappTrocaDeProfissional,
  type ExtrasDosTextosV3,
  type Negociacao,
  type NegociacaoV3,
  type PedidoV3,
  type Profissional,
  type RespostaDoPedido,
} from "../lib/pedidos";
import { intervaloDeLeitura, momentoDoPedido, passosDoPedido } from "../lib/passos-do-pedido";
import { valeAPenaLer } from "../lib/escolhidos-sem-resposta";
import { CORES } from "../tema";
import { PEDIR_TROCA_DE_PARCEIRO } from "../../../src/lib/frases-do-pedido";

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
  const { recarregar: recarregarALista, pedidos: daLista, marcarVistas } = usePedidos();
  // Aberto o pedido, a novidade dele está vista (02-11-2026) — e a que chegar com ele aberto também.
  const naLista = convidado ? undefined : daLista.find((p) => p.id === pedidoId);
  const novidadeDaLista = naLista?.novidade ?? null;
  useEffect(() => {
    if (novidadeDaLista) marcarVistas([{ id: pedidoId, novidade: novidadeDaLista }]);
  }, [pedidoId, novidadeDaLista, marcarVistas]);
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aLer, setALer] = useState(true);
  const [avisoDaAccao, setAvisoDaAccao] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  // De cada vez que o pedido se relê, o cartão dos parceiros escolhidos relê-se com ele (d6, 11-11-2026).
  const [releitura, setReleitura] = useState(0);

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

  const carregar = useCallback(async (silencioso = false): Promise<Resposta | null> => {
    if (!Number.isInteger(pedidoId)) {
      setErro("Pedido não encontrado.");
      setALer(false);
      return null;
    }
    if (!silencioso) setALer(true);
    try {
      const lido = await pedir<Resposta>(ROTA_DO_PEDIDO(pedidoId));
      setR(lido);
      setErro(null);
      setReleitura((n) => n + 1);
      return lido;
    } catch (e) {
      // Uma leitura sozinha que falha (sem rede, por um momento) não pinta o ecrã de erro: a seguinte tenta outra vez.
      if (!silencioso && !(e instanceof ErroDaApi && e.estado === 401 && !convidado)) setErro(mensagemDe(e, "Não foi possível ler o pedido."));
      return null;
    } finally {
      if (!silencioso) setALer(false);
    }
  }, [pedidoId, pedir, convidado]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /*
   * O PEDIDO ACTUALIZA-SE SOZINHO — 02-11-2026 (dono: carregou em «Cheguei»
   * na app Pro e a app de cliente só o mostrou depois de puxar). Com o ecrã à
   * vista e a app em primeiro plano, relê de 15 em 15 s quando há parceiro e
   * o trabalho está por concluir, de 60 em 60 s à espera de propostas, e não
   * relê sozinho depois de concluído ou cancelado (`intervaloDeLeitura`). Ao
   * voltar à app relê logo, e um aviso deste pedido relê-o na hora. Fora do
   * ecrã, ou com a app em fundo, pára (bateria e o limitador da R5).
   */
  const [aVista, setAVista] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setAVista(true);
      return () => setAVista(false);
    }, []),
  );
  const [activa, setActiva] = useState(AppState.currentState === "active");
  const lidoAoVoltar = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      setActiva(s === "active");
      if (s === "active") lidoAoVoltar.current = true;
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (aVista && activa && lidoAoVoltar.current) {
      lidoAoVoltar.current = false;
      void carregar(true);
    }
  }, [aVista, activa, carregar]);
  const intervalo = r ? intervaloDeLeitura(r.pedido, contratadaDe(r)) : null;
  useEffect(() => {
    if (!aVista || !activa || intervalo == null) return;
    const t = setInterval(() => void carregar(true), intervalo);
    return () => clearInterval(t);
  }, [aVista, activa, intervalo, carregar]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const dados = n.request.content.data as { pedidoId?: unknown } | undefined;
      if (Number(dados?.pedidoId) === pedidoId) void carregar(true);
    });
    return () => sub.remove();
  }, [pedidoId, carregar]);

  const depoisDeAgir = useCallback(() => {
    void carregar();
    if (!convidado) void recarregarALista();
    else setFeito(true);
  }, [carregar, convidado, recarregarALista]);
  const recarregarSoOPedido = useCallback(() => void carregar(), [carregar]);

  /** Uma acção da R8. Devolve a frase do erro, ou `null` se correu bem. Depois, volta sempre a ler o pedido. */
  const agir = useCallback(
    async (corpo: Record<string, unknown>): Promise<string | null> => {
      setAvisoDaAccao(null);
      try {
        await pedir(ROTA_DAS_ACCOES, { metodo: "POST", corpo });
        depoisDeAgir();
        return null;
      } catch (e) {
        // Um 409 é «já não está assim»: relê-se o pedido antes de dizer a frase. É também o caso da folha da
        // mudança que o parceiro corrigiu entretanto (`folhaMudou`, d5): o ecrã fica com a folha nova e a frase do site.
        if (e instanceof ErroDaApi && (e.estado === 409 || aFolhaMudou(e.corpo))) {
          await carregar();
          if (!convidado) void recarregarALista();
        }
        return mensagemDe(e);
      }
    },
    [pedir, carregar, depoisDeAgir, convidado, recarregarALista],
  );

  /**
   * «CONTRATAR» ABRE LOGO O PAGAMENTO — 10-11-2026 (d25, ordem do CEO com o sim
   * do dono), como o site desde a d20: um toque contrata (sem confirmação no
   * meio, como o «Contratar este parceiro» do site) e, com o que pagar, abre o
   * ecrã de pagar. A guia por verificar (d10) deixa o botão parado com o porquê
   * e não chega aqui; se o servidor recusar na mesma (409), diz-se a frase dele
   * e fica-se no pedido. Pelo link sem conta não se paga: fica-se no pedido,
   * com «Criar conta para pagar».
   */
  async function contratar(n: NegociacaoV3) {
    const accao = accaoDeContratar(n);
    if (!accao || porqueNaoSeContrata(n) || aContratar) return;
    setAContratar(n);
    setAvisoDaAccao(null);
    try {
      await pedir(ROTA_DAS_ACCOES, { metodo: "POST", corpo: { pedidoId, negociacaoId: n.id, accao } });
    } catch (e) {
      if (e instanceof ErroDaApi && e.estado === 409) await carregar();
      if (!convidado) void recarregarALista();
      setAvisoDaAccao(mensagemDe(e));
      setAContratar(null);
      return;
    }
    const lido = await carregar();
    if (!convidado) void recarregarALista();
    else setFeito(true);
    setAContratar(null);
    const n2 = lido ? contratadaDe(lido) : null;
    if (!convidado && abreOPagamentoDepoisDeContratar(n2?.pagamento, Date.now())) router.push(`/pagar/${pedidoId}`);
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
  const alteracoes = p.alteracoes ?? null;
  const acesso =
    typeof p.acesso === "string" ? p.acesso : p.acesso ? [p.acesso.origem && `Origem: ${p.acesso.origem}`, p.acesso.destino && `Destino: ${p.acesso.destino}`].filter(Boolean).join("\n") : null;
  const momento = momentoDoPedido(p, contratada);
  const passos = contratada ? passosDoPedido(p, contratada) : null;
  const pagoJa = !!contratada?.pagamento?.pago;
  const cabecalho = [`Pedido #${p.id}`, p.cidade, p.criadoEmTexto ? `feito a ${p.criadoEmTexto}` : null].filter(Boolean).join(" · ");

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={{ flex: 1, backgroundColor: CORES.fundo }}>
    <RolagemComTeclado
      style={{ flex: 1, backgroundColor: CORES.fundo }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={aLer} onRefresh={() => void carregar()} tintColor={CORES.marca} />}
    >
      {/* D4.1 — a faixa do link sem conta, sempre visível (parte de linha com a letra grande, 02-11-2026). */}
      {convidado ? (
        <Pressable
          onPress={convidado.aoCriarConta}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: CORES.marcaSuave, padding: 12, opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons name="person-add-outline" size={18} color={CORES.marca} />
          <Text style={{ flex: 1, color: CORES.tinta, fontSize: 13 }}>
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
        {/* Com o aviso do momento, a pílula do estado repetia-o em cor discreta: sai (02-11-2026). */}
        {momento ? null : <Etiqueta texto={p.estadoTexto} />}
      </View>

      {/* O aviso do momento, em cor forte, e o passo a passo (02-11-2026). */}
      {momento ? <MomentoDoPedido momento={momento} /> : null}
      {passos ? <PassosDoPedido passos={passos} /> : null}

      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      {avisoDaAccao ? <Aviso texto={avisoDaAccao} tom="mau" /> : null}
      {feito && convidado ? <Aviso texto={LINK.depoisDeAgir} tom="bom" /> : null}

      {/* E5M — as mensagens com a CLYON (S18), no topo quando há. */}
      <Mensagens pedidoId={pedidoId} pedido={p} pedir={pedir} aoResponder={depoisDeAgir} />

      {/* d) Trabalho CLYON de valor fixo: sem propostas, sem contratar nem recusar. */}
      {p.trabalhoClyon ? (
        <TrabalhoClyon
          pedido={p}
          agir={agir}
          aoMudar={() => void carregar()}
          aoCriarConta={convidado?.aoCriarConta}
          aoPedirOutraVez={
            convidado ? convidado.aoCriarConta : () => router.push({ pathname: "/pedir", params: { servico: p.servico, morada: p.morada ?? "" } })
          }
        />
      ) : null}

      {/*
        Os parceiros que escolheu (d6, 11-11-2026): numa mudança com a lista, a linha do prazo enquanto corre e,
        se passar sem resposta, o cartão com as três saídas. Nos outros pedidos a rota não manda nada, e não se vê.
      */}
      <EscolhidosSemResposta
        pedidoId={pedidoId}
        pedir={pedir}
        activo={valeAPenaLer({ trabalhoClyon: !!p.trabalhoClyon, contratado: !!contratada, fechado: p.estadoTexto === "Cancelado" || p.estadoTexto === "Concluído" })}
        releitura={releitura}
        aoMudar={depoisDeAgir}
      />

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
              aoContratar={() => void contratar(n)}
              aContratar={aContratar?.id === n.id}
              desligado={!!aContratar}
              aoRecusar={() => setARecusar(n)}
              aoVerAvaliacoes={() => setAvaliacoesDe(n.profissional)}
              aoPropor={() => {
                setErroNaConfirmacao(null);
                setValorProposto("");
                setAPropor(n);
              }}
            />
          ))}
          {/* A frase única, que ia na confirmação de «Contratar» (sai na d25, 10-11-2026), fica por baixo das propostas. */}
          {catalogo?.textos.fraseUnica ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18 }}>{catalogo.textos.fraseUnica}</Text> : null}
        </View>
      ) : null}

      {/* c) Contratado: pagar, confirmar, avaliar e acompanhar. */}
      {contratada ? (
        <View style={{ gap: 12 }}>
          {/* 02-11-2026, «ecrãs simples»: o parceiro, o preço (Serviço / IVA / Total) e o próximo passo. */}
          <Cartao>
            <View style={{ gap: 2 }}>
              <Subtitulo>{contratada.profissional.nome}</Subtitulo>
              {contratada.profissional.notaTexto ? <Text style={{ color: CORES.suave, fontSize: 13.5 }}>{contratada.profissional.notaTexto}</Text> : null}
              {/* O dia combinado está no passo a passo, por cima (02-11-2026). */}
              {contratada.dataCombinadaTexto && !passos ? <Text style={{ color: CORES.tinta, fontSize: 14.5 }}>{contratada.dataCombinadaTexto}</Text> : null}
            </View>
            {/* Pago, o cartão fica curto: o total e quando se pagou; as três linhas passam para «O valor e os itens a mais». */}
            {pagoJa && contratada.preco?.conta ? (
              <Text titulo style={{ color: CORES.tinta, fontSize: 16, fontWeight: "700" }}>{`Total ${contratada.preco.conta.total}`}</Text>
            ) : contratada.preco ? (
              <Preco preco={{ ...contratada.preco, nota: contratada.preco.conta ? "" : contratada.preco.nota }} tamanho="medio" />
            ) : null}
            <ResumoDoPagamento
              pedidoId={pedidoId}
              n={contratada}
              aoMudar={recarregarSoOPedido}
              aoCriarConta={convidado?.aoCriarConta}
              telefoneSugerido={p.telefone ?? null}
            />
          </Cartao>
          {/*
            O modelo de 15-11 (d10): paga ao parceiro — o IBAN, o MB WAY, como vai pagar e as duas faturas.
            Quem decide é o servidor; fora do modelo novo o bloco não desenha nada. O convidado vê-o depois de criar conta.
          */}
          {!convidado ? (
            <PagarAoParceiro pedidoId={pedidoId} negociacaoId={contratada.id} pedirComo={pedir} daR5={contratada.pagamento ? contratada.pagamento.aoParceiro : undefined} />
          ) : null}
          {/* «O trabalho já foi feito?» (d15): só quando o servidor pergunta. */}
          <TrabalhoJaFeito pedidoId={pedidoId} pergunta={contratada.perguntaDoFecho} pedir={pedir} aoMudar={depoisDeAgir} />
          {/* As horas de um trabalho por hora (31-10-2026), antes do «Sim, ficou feito». */}
          <HorasDoTrabalho pedidoId={pedidoId} n={contratada} agir={agir} />
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
          <Acompanhar pedidoId={pedidoId} n={contratada} agir={agir} recolhida semViagem={!!momento} />
        </View>
      ) : null}

      {/* E5A — uma alteração à espera é estado: fica à vista. */}
      {alteracoes?.pendente ? <Aviso tom="aviso" texto={alteracoes.pendente.texto || TEXTOS_DA_ALTERACAO.emEspera(alteracoes.pendente.quandoTexto)} /> : null}

      {/* O resto, em secções recolhidas (02-11-2026). */}
      <View>
      {contratada && ((pagoJa && contratada.preco?.conta) || contratada.materiaisTexto || r.textos.sobreOValorCombinado || (contratada.emDuasEntregas ?? []).length > 0 || p.combinadoTexto) ? (
        <Recolhido titulo="O valor e os itens a mais">
          {pagoJa && contratada.preco?.conta ? <Preco preco={{ ...contratada.preco, nota: "" }} tamanho="medio" /> : null}
          {p.combinadoTexto ? <Paragrafo pequeno>{p.combinadoTexto}</Paragrafo> : null}
          {contratada.preco?.conta && contratada.preco.nota ? <Paragrafo pequeno suave>{contratada.preco.nota}</Paragrafo> : null}
          {contratada.materiaisTexto ? <Paragrafo pequeno suave>{contratada.materiaisTexto}</Paragrafo> : null}
          {r.textos.sobreOValorCombinado ? <Paragrafo pequeno suave>{r.textos.sobreOValorCombinado}</Paragrafo> : null}
          {(contratada.emDuasEntregas ?? []).map((l, i) => (
            <Paragrafo key={i} pequeno suave>
              {l}
            </Paragrafo>
          ))}
        </Recolhido>
      ) : null}

      {/* e) O que pediu. */}
      <Recolhido titulo="O que pediu">
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
      </Recolhido>

      <Recolhido titulo="Ajuda e alterações">
        {alteracoes && !alteracoes.pode && !alteracoes.pendente && alteracoes.texto && contratada ? <Paragrafo pequeno suave>{alteracoes.texto}</Paragrafo> : null}
        {alteracoes?.pode && !alteracoes.pendente ? <Botao titulo="Alterar o pedido" tipo="secundario" aoCarregar={() => setAAlterar(true)} /> : null}
        {contratada && !convidado ? <Ligacao titulo={PEDIR_TROCA_DE_PARCEIRO} aoCarregar={() => whatsappDaClyon(whatsappTrocaDeProfissional(p.id))} /> : null}
        <Ligacao titulo="Falar com a CLYON por WhatsApp" aoCarregar={() => whatsappDaClyon(`Pedido #${p.id}`)} />
        {r.textos.rodape ? <Paragrafo pequeno suave>{r.textos.rodape}</Paragrafo> : null}
        {r.podeCancelar ? (
          <Ligacao
            titulo="Cancelar o pedido"
            tom="mau"
            aoCarregar={() => {
              setErroNaConfirmacao(null);
              setMotivoPedido(null);
              setMotivo("");
              setACancelar(true);
            }}
          />
        ) : null}
      </Recolhido>
      </View>

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
        texto={
          // A legenda do site, desta negociação (d8, 31-10-2026: `frase-da-contraproposta.ts`, pela R5).
          aPropor?.proporAjuda ?? r.textos.proporAjuda ?? undefined
        }
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
        <Campo rotulo={aPropor?.horas ? "Valor por hora" : "Valor"} valor={valorProposto} aoMudar={(v) => setValorProposto(v.replace(/[^\d,.]/g, ""))} keyboardType="decimal-pad" />
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
    </RolagemComTeclado>
    </SafeAreaView>
  );
}
