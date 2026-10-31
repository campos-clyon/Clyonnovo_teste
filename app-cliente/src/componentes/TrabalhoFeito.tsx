import { useState } from "react";
import { Image, Pressable, View, useWindowDimensions } from "react-native";
import { Text } from "./Texto";
import { Miniaturas, VerFotografias } from "./VerFotografias";
import { Aviso, Botao, Cartao, Ligacao, Subtitulo } from "./ui";
import { whatsappDaClyon } from "../lib/abrir";
import { whatsappHaUmProblema, type Negociacao } from "../lib/pedidos";
import { CORES } from "../tema";
import { HA_UM_PROBLEMA, marcadoComoFeitoNaData } from "../../../src/lib/frases-do-pedido";

/**
 * E9 — CONFIRMAR O TRABALHO FEITO (fase `a_confirmar`).
 *
 * Os dois casos distinguem-se pelo que a R5 manda, nunca por conta própria:
 * - E9a, com fotografias (`prova`): as fotografias em grande, a nota dele, o
 *   botão com o texto da API (`botaoDeConfirmar`) e o prazo (`diasAteLibertarTexto`).
 * - E9b, sem fotografias (`porConfirmarPelaClyon`, d22): uma pessoa da CLYON
 *   confirma com o cliente antes de entregar o pagamento — por isso NUNCA
 *   aparece texto de prazo. Confirmar na app vale como essa confirmação.
 * - Desde 30-10-2026 (dono) o profissional já não junta fotografias: carrega em
 *   «Está feito» e o cliente confirma «Sim, ficou feito». Sem fotografias,
 *   mostra-se a nota dele e o prazo, como a qualquer outro.
 */
export function TrabalhoFeito({
  pedidoId,
  n,
  agir,
}: {
  pedidoId: number;
  n: Negociacao;
  agir: (corpo: Record<string, unknown>) => Promise<string | null>;
}) {
  const { width } = useWindowDimensions();
  const [aberta, setAberta] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!n.accoes.includes("confirmar")) return null;
  const nome = n.profissional.nome;
  const semFotografias = n.prova.length === 0;

  async function confirmar() {
    setOcupado(true);
    setErro(null);
    const e = await agir({ pedidoId, negociacaoId: n.id, accao: "confirmar" });
    setOcupado(false);
    if (e) setErro(e);
  }

  return (
    <Cartao destaque>
      <Subtitulo>{`${nome} diz que o trabalho está feito`}</Subtitulo>
      {semFotografias ? (
        <>
          <Aviso tom="neutro" texto={`${nome} marcou o trabalho como feito. Confirme que ficou feito.`} />
          {n.provaNota ? <Text style={{ color: CORES.tinta, fontSize: 15, lineHeight: 21 }}>{n.provaNota}</Text> : null}
          {n.execucaoEnviadaEmTexto ? (
            <Text style={{ color: CORES.suave, fontSize: 13 }}>{marcadoComoFeitoNaData(n.execucaoEnviadaEmTexto)}</Text>
          ) : null}
        </>
      ) : (
        <>
          <Pressable accessibilityRole="imagebutton" onPress={() => setAberta(0)}>
            <Image source={{ uri: n.prova[0] }} style={{ width: width - 72, height: (width - 72) * 0.75, borderRadius: 12 }} />
          </Pressable>
          <Miniaturas fotos={n.prova.slice(1)} aoAbrir={(i) => setAberta(i + 1)} />
          {n.provaNota ? <Text style={{ color: CORES.tinta, fontSize: 15, lineHeight: 21 }}>{n.provaNota}</Text> : null}
          <VerFotografias fotos={n.prova} aberta={aberta} aoFechar={() => setAberta(null)} />
        </>
      )}
      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      <Botao titulo={n.botaoDeConfirmar} ocupado={ocupado} aoCarregar={() => void confirmar()} />
      {n.diasAteLibertarTexto ? (
        <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{n.diasAteLibertarTexto}</Text>
      ) : null}
      <View>
        <Ligacao titulo={HA_UM_PROBLEMA} tom="mau" aoCarregar={() => whatsappDaClyon(whatsappHaUmProblema(pedidoId))} />
      </View>
    </Cartao>
  );
}
