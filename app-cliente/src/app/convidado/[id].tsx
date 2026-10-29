import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Entrada } from "../../componentes/Entrada";
import { Text } from "../../componentes/Texto";
import { Botao, Carregando, Ecra, Folha, Paragrafo, Titulo } from "../../componentes/ui";
import { VistaDoPedido } from "../../componentes/VistaDoPedido";
import { useSessao } from "../../estado/Sessao";
import { codigoDoConvidado, marcarAbertura, marcarFolhaMostrada, pedirComoConvidado, sessaoDoPedido } from "../../lib/convidado";
import { seguirDepoisDeEntrar } from "../../lib/depois-de-entrar";
import { LINK, mostrarFolhaDeConta, type SessaoDeConvidado } from "../../lib/pedido-do-link";
import { CORES } from "../../tema";

/**
 * E5L — O PEDIDO ABERTO PELO LINK, SEM CONTA (A9; liga-se com a S16).
 *
 * O mesmo E5, com a sessão de convidado deste pedido e o código do aparelho
 * do convidado (nunca o da entrada). Sem pagar e sem dados da conta (D1).
 * As indicações para criar conta (D4): a faixa no topo, a linha depois de
 * cada acção, «Criar conta para pagar» e, na 2.ª abertura, uma folha que não
 * volta antes de 7 dias. «Criar conta» → entrar → juntar o pedido (D5).
 */
export default function PedidoDoConvidado() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedidoId = /^\d{1,10}$/.test(String(id ?? "")) ? Number(id) : NaN;
  const { ligado } = useSessao();
  const [s, setS] = useState<SessaoDeConvidado | null | undefined>(undefined);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [criarConta, setCriarConta] = useState(false);
  const [folha, setFolha] = useState(false);

  useEffect(() => {
    void (async () => {
      const sessao = Number.isInteger(pedidoId) ? await sessaoDoPedido(pedidoId) : null;
      setCodigo(await codigoDoConvidado());
      if (sessao) {
        const marcada = await marcarAbertura(pedidoId);
        if (marcada && mostrarFolhaDeConta(marcada)) {
          setFolha(true);
          void marcarFolhaMostrada(pedidoId);
        }
      }
      setS(sessao);
    })();
  }, [pedidoId]);

  const convidado = useMemo(
    () => (s && codigo ? { pedir: pedirComoConvidado(s, codigo), aoCriarConta: () => setCriarConta(true) } : null),
    [s, codigo],
  );

  // Já entrou (noutro ecrã): junta o pedido à conta.
  useEffect(() => {
    if (ligado && s) void seguirDepoisDeEntrar({ para: "juntar", pedidoId: s.pedidoId });
  }, [ligado, s]);

  if (s === undefined) return <Carregando />;
  if (!s || !convidado) {
    return (
      <Ecra>
        <Titulo>Este pedido já não está neste telemóvel</Titulo>
        <Paragrafo>O acesso pelo link terminou. Abra outra vez o link que a CLYON lhe enviou, ou entre na sua conta.</Paragrafo>
        <Botao titulo="Voltar" tipo="secundario" aoCarregar={() => router.replace("/pedidos")} />
      </Ecra>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: CORES.fundo }}>
      <VistaDoPedido pedidoId={pedidoId} convidado={convidado} />
      <Folha visivel={criarConta || folha} aoFechar={() => (setCriarConta(false), setFolha(false))}>
        <Text titulo accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 21, fontWeight: "700" }}>
          {LINK.folhaTitulo}
        </Text>
        <Paragrafo suave>{LINK.folhaTexto}</Paragrafo>
        <Entrada depois={{ para: "juntar", pedidoId }} />
        {folha && !criarConta ? <Botao titulo={LINK.agoraNao} tipo="secundario" aoCarregar={() => setFolha(false)} /> : null}
      </Folha>
    </View>
  );
}
