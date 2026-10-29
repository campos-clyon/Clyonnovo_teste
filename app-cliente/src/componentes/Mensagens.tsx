import { useState } from "react";
import { View } from "react-native";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Cartao, Ligacao, Subtitulo } from "./ui";
import { mensagemDe } from "../lib/api";
import type { Pedir } from "../lib/erros";
import { enviarFotografia, escolherFotografias, reduzirFotografia } from "../lib/fotografias";
import { eMinha, ROTA_DA_RESPOSTA, TEXTOS_DAS_MENSAGENS as T, type PedidoV3 } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * E5M — AS MENSAGENS COM A CLYON (S18), no topo do pedido.
 *
 * Quando a CLYON pede mais detalhes (`precisaDeSi`): o cartão «A CLYON pediu
 * mais detalhes», a mensagem dela, o campo da resposta e «Juntar
 * fotografias». Por baixo, a conversa — «CLYON» e «Eu», com a hora de Lisboa
 * que a API escreve; nunca o nome de quem escreveu na equipa. Sem nada
 * pedido: só a ligação discreta «Escrever à CLYON». A resposta vai pela R14
 * (a mesma lib que a `/conta`). Antes da S18 a R5 não manda `mensagens` e
 * nada disto aparece.
 */
export function Mensagens({ pedidoId, pedido, pedir, aoResponder }: { pedidoId: number; pedido: PedidoV3; pedir: Pedir; aoResponder: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [aJuntar, setAJuntar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  if (pedido.mensagens === undefined && !pedido.precisaDeSi) return null;
  const mensagens = pedido.mensagens ?? [];
  const pediu = pedido.precisaDeSi === true;
  const ultimaDaClyon = [...mensagens].filter((m) => !eMinha(m)).pop() ?? null;

  async function juntar() {
    setErro(null);
    setAJuntar(true);
    try {
      const e = await escolherFotografias("galeria", 10);
      if ("erro" in e) return setErro(e.erro);
      for (const a of e.fotografias) {
        const url = await enviarFotografia(await reduzirFotografia(a));
        setFotos((f) => [...f, url]);
      }
    } catch (e) {
      setErro(mensagemDe(e, "Uma fotografia não seguiu. Tente outra vez."));
    } finally {
      setAJuntar(false);
    }
  }

  async function enviar() {
    if (texto.trim().length < 2 && fotos.length === 0) return setErro("Escreva a sua resposta.");
    setErro(null);
    setEnviando(true);
    try {
      await pedir(ROTA_DA_RESPOSTA(pedidoId), { metodo: "POST", corpo: { mensagem: texto.trim().slice(0, 1000), fotografias: fotos.length > 0 ? fotos : undefined } });
      setTexto("");
      setFotos([]);
      setEnviada(true);
      setAberto(false);
      aoResponder();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  }

  const formulario = (
    <View style={{ gap: 10 }}>
      <Campo rotulo={T.escreva} valor={texto} aoMudar={setTexto} multiline maxLength={1000} style={{ minHeight: 90, textAlignVertical: "top" }} />
      {fotos.length > 0 ? <Text style={{ color: CORES.suave, fontSize: 13 }}>{`${fotos.length} ${fotos.length === 1 ? "fotografia junta" : "fotografias juntas"}`}</Text> : null}
      <Ligacao titulo={T.juntar} aoCarregar={() => void juntar()} />
      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      <Botao titulo={T.enviar} ocupado={enviando || aJuntar} aoCarregar={() => void enviar()} />
    </View>
  );

  return (
    <View style={{ gap: 10 }}>
      {enviada ? <Aviso texto={T.enviada} tom="bom" /> : null}
      {pediu ? (
        <Cartao destaque>
          <Subtitulo>{T.pediu}</Subtitulo>
          {ultimaDaClyon ? <Text style={{ color: CORES.tinta, fontSize: 14.5, lineHeight: 21 }}>{ultimaDaClyon.texto}</Text> : null}
          {formulario}
        </Cartao>
      ) : aberto ? (
        <Cartao>{formulario}</Cartao>
      ) : (
        <Ligacao titulo={T.escrever} aoCarregar={() => setAberto(true)} />
      )}
      {mensagens.length > 0 ? (
        <View style={{ gap: 8 }}>
          {mensagens.map((m, i) => (
            <View
              key={i}
              style={{
                alignSelf: eMinha(m) ? "flex-end" : "flex-start",
                marginLeft: eMinha(m) ? 40 : 0,
                marginRight: eMinha(m) ? 0 : 40,
                borderRadius: 16,
                padding: 12,
                gap: 4,
                backgroundColor: eMinha(m) ? CORES.marcaSuave : CORES.superficie,
              }}
            >
              <Text style={{ color: CORES.suave, fontSize: 12 }}>{[m.de, m.quandoTexto].filter(Boolean).join(" · ")}</Text>
              <Text style={{ color: CORES.tinta, fontSize: 14, lineHeight: 20 }}>{m.texto}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
