import { useState } from "react";
import { View } from "react-native";
import { Text } from "./Texto";
import { Aviso, Botao, Cartao, Subtitulo } from "./ui";
import { ErroDaApi, mensagemDe } from "../lib/api";
import type { Pedir } from "../lib/erros";
import { corpoDoFecho, ROTA_DAS_ACCOES, type PerguntaDoFecho } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * «O TRABALHO JÁ FOI FEITO?» — d15 (13-11-2026), o mesmo cartão do site
 * (`RespostaDoFecho.tsx`). No modelo de 15-11 o cliente paga ao parceiro, e o
 * trabalho não pode ficar à espera só do «Está feito» dele: o servidor pergunta
 * ao cliente (`perguntaDoFecho` da R5, com os textos já escritos) e a resposta
 * vai pela R8 — `{ accao, negociacaoId, resposta: "sim" | "nao" }`.
 *
 * Só aparece quando o servidor manda a pergunta. Um 409 quer dizer que já não
 * se aplica (o parceiro marcou entretanto, ou alguém já respondeu): relê-se o
 * pedido e o cartão sai.
 */
export function TrabalhoJaFeito({
  pedidoId,
  pergunta,
  pedir,
  aoMudar,
}: {
  pedidoId: number;
  pergunta: PerguntaDoFecho | null | undefined;
  pedir: Pedir;
  aoMudar: () => void;
}) {
  const [aEnviar, setAEnviar] = useState<"sim" | "nao" | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  if (!pergunta && !feito) return null;

  async function responder(resposta: "sim" | "nao") {
    if (!pergunta) return;
    setAEnviar(resposta);
    setErro(null);
    try {
      const r = await pedir<{ mensagem?: string }>(ROTA_DAS_ACCOES, { metodo: "POST", corpo: corpoDoFecho(pedidoId, pergunta, resposta) });
      setFeito(typeof r?.mensagem === "string" && r.mensagem ? r.mensagem : "Obrigado.");
      aoMudar();
    } catch (e) {
      if (e instanceof ErroDaApi && e.estado === 409) {
        aoMudar();
        return;
      }
      setErro(mensagemDe(e, "Não foi possível. Tente outra vez."));
    } finally {
      setAEnviar(null);
    }
  }

  if (feito) return <Aviso tom="bom" texto={feito} />;
  if (!pergunta) return null;
  return (
    <Cartao destaque>
      <Subtitulo>{pergunta.pergunta}</Subtitulo>
      <Text style={{ color: CORES.suave, fontSize: 13.5, lineHeight: 19 }}>{pergunta.explicacao}</Text>
      {erro ? <Aviso tom="mau" texto={erro} /> : null}
      <View style={{ gap: 8 }}>
        <Botao titulo={pergunta.sim} ocupado={aEnviar === "sim"} desligado={aEnviar != null} aoCarregar={() => void responder("sim")} />
        <Botao titulo={pergunta.nao} tipo="secundario" ocupado={aEnviar === "nao"} desligado={aEnviar != null} aoCarregar={() => void responder("nao")} />
      </View>
    </Cartao>
  );
}
