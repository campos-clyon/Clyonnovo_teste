import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Acompanhar } from "../../componentes/Acompanhar";
import { Avaliacoes } from "../../componentes/Avaliacoes";
import { Avaliar } from "../../componentes/Avaliar";
import { Pagar } from "../../componentes/Pagar";
import { Preco } from "../../componentes/Preco";
import { Proposta } from "../../componentes/Proposta";
import { Text } from "../../componentes/Texto";
import { TrabalhoClyon } from "../../componentes/TrabalhoClyon";
import { TrabalhoFeito } from "../../componentes/TrabalhoFeito";
import { Miniaturas, VerFotografias } from "../../componentes/VerFotografias";
import { Aviso, Botao, Campo, Cartao, Carregando, Confirmacao, Ligacao, Paragrafo, Subtitulo, Titulo } from "../../componentes/ui";
import { useCatalogo } from "../../estado/Catalogo";
import { usePedidos } from "../../estado/Pedidos";
import { ErroDaApi, mensagemDe, pedir } from "../../lib/api";
import {
  accaoDeContratar,
  contratadaDe,
  perguntaDeRecusar,
  propostasEmAberto,
  ROTA_DAS_ACCOES,
  ROTA_DO_PEDIDO,
  textoDaEspera,
  textoDeContratar,
  type Negociacao,
  type Profissional,
  type RespostaDoPedido,
} from "../../lib/pedidos";
import { CORES } from "../../tema";

/**
 * E5 — O PEDIDO (R5), com o pagar (E7), o acompanhar (E8), o confirmar (E9) e
 * o avaliar (E10) no mesmo ecrã, só o que se aplica ao momento.
 *
 * As propostas vêm pela ordem da R5 — a última actividade em cima, a mesma do
 * site (P3) — e a app não reordena. As acções vão todas pela R8
 * (`POST /api/users/me/negociacao`, com a sessão); depois de cada uma, a app
 * volta a ler o pedido. Um 409 (o outro lado mudou entretanto) mostra a frase
 * da API e recarrega.
 */
export default function OPedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedidoId = /^\d{1,10}$/.test(String(id ?? "")) ? Number(id) : NaN;
  const { catalogo } = useCatalogo();
  const { recarregar: recarregarALista } = usePedidos();
  const [r, setR] = useState<RespostaDoPedido | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aLer, setALer] = useState(true);
  const [avisoDaAccao, setAvisoDaAccao] = useState<string | null>(null);

  const [aContratar, setAContratar] = useState<Negociacao | null>(null);
  const [aRecusar, setARecusar] = useState<Negociacao | null>(null);
  const [aCancelar, setACancelar] = useState(false);
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
      setR(await pedir<RespostaDoPedido>(ROTA_DO_PEDIDO(pedidoId)));
      setErro(null);
    } catch (e) {
      if (!(e instanceof ErroDaApi && e.estado === 401)) setErro(mensagemDe(e, "Não foi possível ler o pedido."));
    } finally {
      setALer(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Uma acção da R8. Devolve a frase do erro, ou `null` se correu bem. Depois, volta sempre a ler o pedido. */
  const agir = useCallback(
    async (corpo: Record<string, unknown>): Promise<string | null> => {
      setAvisoDaAccao(null);
      try {
        await pedir(ROTA_DAS_ACCOES, { metodo: "POST", corpo });
        await carregar();
        void recarregarALista();
        return null;
      } catch (e) {
        if (e instanceof ErroDaApi && e.estado === 409) {
          await carregar();
          void recarregarALista();
        }
        return mensagemDe(e);
      }
    },
    [carregar, recarregarALista],
  );

  async function confirmarContratar() {
    if (!aContratar) return;
    const accao = accaoDeContratar(aContratar);
    if (!accao) return;
    setOcupado(true);
    setErroNaConfirmacao(null);
    const e = await agir({ pedidoId, negociacaoId: aContratar.id, accao });
    setOcupado(false);
    if (e) {
      setAContratar(null);
      setAvisoDaAccao(e);
    } else setAContratar(null);
  }

  async function confirmarRecusar() {
    if (!aRecusar) return;
    setOcupado(true);
    const e = await agir({ pedidoId, negociacaoId: aRecusar.id, accao: "desistir" });
    setOcupado(false);
    setARecusar(null);
    if (e) setAvisoDaAccao(e);
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
      await carregar();
      void recarregarALista();
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
  const contratada = contratadaDe(r);
  const propostas = propostasEmAberto(r);
  const espera = textoDaEspera(r);
  const contratar = aContratar ? textoDeContratar(aContratar) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: CORES.fundo }}
      contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={aLer} onRefresh={() => void carregar()} tintColor={CORES.marca} />}
    >
      <View style={{ gap: 4 }}>
        <Titulo>{p.servico}</Titulo>
        <Text style={{ color: CORES.suave, fontSize: 15 }}>{`Pedido #${p.id}`}</Text>
        <Text style={{ color: CORES.tinta, fontSize: 16, fontWeight: "600" }}>{p.estadoTexto}</Text>
      </View>

      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      {avisoDaAccao ? <Aviso texto={avisoDaAccao} tom="mau" /> : null}

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
          {r.textos.sobreAsPropostas ? (
            <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{r.textos.sobreAsPropostas}</Text>
          ) : null}
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
            {r.textos.sobreOValorCombinado ? (
              <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{r.textos.sobreOValorCombinado}</Text>
            ) : null}
          </Cartao>
          <TrabalhoFeito pedidoId={pedidoId} n={contratada} agir={agir} />
          <Avaliar
            pedidoId={pedidoId}
            n={contratada}
            agir={agir}
            aoPedirOutraVez={() => router.push({ pathname: "/novo", params: { servico: p.servico, morada: p.morada ?? "" } })}
          />
          <Pagar pedidoId={pedidoId} n={contratada} aoMudar={() => void carregar()} />
          <Acompanhar pedidoId={pedidoId} n={contratada} agir={agir} />
        </View>
      ) : null}

      {/* e) No fundo: as fotografias, a morada, quando e a descrição. */}
      <Cartao>
        <Subtitulo>O que pediu</Subtitulo>
        <Miniaturas fotos={p.fotos} aoAbrir={setFotoAberta} />
        {p.morada ? <Paragrafo>{p.morada}</Paragrafo> : p.cidade ? <Paragrafo>{p.cidade}</Paragrafo> : null}
        {p.quando ? <Paragrafo suave>{`Quando: ${p.quando}`}</Paragrafo> : null}
        {p.descricao ? <Paragrafo>{p.descricao}</Paragrafo> : null}
        {p.avisos.map((a, i) => (
          <Paragrafo key={i} pequeno suave>
            {a}
          </Paragrafo>
        ))}
        {p.criadoEmTexto ? <Paragrafo pequeno suave>{`Pedido feito a ${p.criadoEmTexto}.`}</Paragrafo> : null}
      </Cartao>

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
        visivel={aCancelar}
        titulo={`Cancelar o pedido #${p.id}?`}
        texto="Os profissionais deixam de o ver."
        confirmar="Cancelar o pedido"
        perigo
        ocupado={ocupado}
        erro={erroNaConfirmacao}
        aoConfirmar={() => void confirmarCancelar()}
        aoVoltar={() => setACancelar(false)}
      >
        {motivoPedido ? (
          <Campo rotulo={`${motivoPedido} Escreva o motivo:`} valor={motivo} aoMudar={setMotivo} multiline maxLength={300} />
        ) : null}
      </Confirmacao>
    </ScrollView>
  );
}
