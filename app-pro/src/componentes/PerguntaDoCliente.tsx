import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { View } from "react-native";
import { Text } from "./Texto";
import { Botao, Caixa, CampoDeTexto, Mensagem, TituloDaCaixa } from "./ui";
import { ErroDaApi, pedir } from "../lib/api";
import { corpoDaResposta, fraseDoPrazo, perguntasLidas, ROTA_DA_PERGUNTA_DO_CLIENTE, type PerguntaDoCliente as Pergunta } from "../lib/pergunta-do-cliente";
import { ESPACO, LETRA, useCores } from "../tema";

/**
 * «O CLIENTE PERGUNTA SE CONSEGUE…» — d3 (24-11-2026), o mesmo cartão do painel
 * (`PerguntaDoCliente.tsx`), ao modo do `PagamentoDoCliente`: a pergunta vem do
 * servidor (`GET /api/profissionais/pergunta-do-cliente`), responde-se SIM (com
 * «quando», se quiser) ou NÃO (`POST`), e a frase de depois é a que a rota
 * devolve. Sem perguntas em aberto — ou num site antigo, sem a rota — não
 * desenha nada. A app não escreve números.
 */
export function PerguntaDoCliente() {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void pedir<unknown>(ROTA_DA_PERGUNTA_DO_CLIENTE)
        .then((r) => vivo && setPerguntas(perguntasLidas(r)))
        // Sem as perguntas, a entrada fica como antes.
        .catch(() => {});
      return () => {
        vivo = false;
      };
    }, []),
  );
  if (perguntas.length === 0) return null;
  return (
    <View style={{ gap: ESPACO.s, marginBottom: ESPACO.s }}>
      {perguntas.map((p) => (
        <UmaPergunta key={p.id} pergunta={p} />
      ))}
    </View>
  );
}

function UmaPergunta({ pergunta }: { pergunta: Pergunta }) {
  const c = useCores();
  const [quando, setQuando] = useState("");
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function responder(resposta: "sim" | "nao") {
    setAGravar(true);
    setErro(null);
    try {
      const r = await pedir<{ texto?: string }>(ROTA_DA_PERGUNTA_DO_CLIENTE, {
        metodo: "POST",
        corpo: corpoDaResposta(pergunta.id, resposta, quando),
      });
      setFeito(r.texto ?? "Obrigado! A sua resposta já seguiu para o cliente.");
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Sem ligação. Tente de novo, ou responda no WhatsApp.");
    } finally {
      setAGravar(false);
    }
  }

  if (feito) return <Mensagem tom="bom" texto={feito} />;
  const prazo = fraseDoPrazo(pergunta.prazoEm);
  return (
    <Caixa>
      <TituloDaCaixa>{`O cliente do pedido #${pergunta.pedidoId} quer escolher a sua proposta`}</TituloDaCaixa>
      <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
        {`Com uma condição: «${pergunta.condicao}». Consegue?`}
        {prazo ? ` ${prazo}` : ""}
      </Text>
      <CampoDeTexto rotulo="Quando pode ir (opcional)" value={quando} onChangeText={setQuando} maxLength={80} placeholder="por exemplo: quinta à tarde" />
      {erro ? <Mensagem tom="mau" texto={erro} /> : null}
      <View style={{ gap: ESPACO.s }}>
        <Botao titulo="Sim, consigo" ocupado={aGravar} aoCarregar={() => void responder("sim")} />
        <Botao titulo="Não consigo" tipo="secundario" ocupado={aGravar} aoCarregar={() => void responder("nao")} />
      </View>
    </Caixa>
  );
}
