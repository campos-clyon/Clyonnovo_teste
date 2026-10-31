import { useState } from "react";
import { View } from "react-native";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Cartao, Confirmacao, Subtitulo } from "./ui";
import { MOTIVO_MAXIMO_DAS_HORAS, MOTIVO_MINIMO_DAS_HORAS, corpoDasHoras, type Negociacao } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * AS HORAS DO TRABALHO — 31-10-2026 (trabalho por hora).
 *
 * Antes de o parceiro as marcar: o preço por hora e a estimativa. Depois:
 * «O parceiro marcou das HH:MM às HH:MM = N h → total …», os materiais usados
 * e, enquanto a API deixa (`confirmar_horas`/`contestar_horas`), «Confirmo as
 * horas» e «Não concordo» (com o porquê — vai à equipa da CLYON). Os textos
 * vêm todos da API; a app não faz contas.
 */
export function HorasDoTrabalho({
  pedidoId,
  n,
  agir,
}: {
  pedidoId: number;
  n: Negociacao;
  agir: (corpo: Record<string, unknown>) => Promise<string | null>;
}) {
  const [aContestar, setAContestar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const h = n.horas;
  if (!h) return null;
  const m = h.marcadas;
  const podeResponder = h.podeResponder && n.accoes.includes("confirmar_horas") && n.accoes.includes("contestar_horas");

  async function responder(accao: "confirmar_horas" | "contestar_horas") {
    setOcupado(accao);
    setErro(null);
    const e = await agir(corpoDasHoras({ pedidoId, negociacaoId: n.id, accao, motivo }));
    setOcupado(null);
    if (e) setErro(e);
    else setAContestar(false);
  }

  return (
    <Cartao destaque={podeResponder}>
      <Subtitulo>{h.titulo}</Subtitulo>
      {!m ? (
        <>
          {h.porHoraTexto ? <Text style={{ color: CORES.tinta, fontSize: 15, lineHeight: 21 }}>{`${h.porHoraTexto}.`}</Text> : null}
          {h.estimativaTexto ? <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{h.estimativaTexto}</Text> : null}
          <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>
            No fim, o parceiro marca a hora de início e a de fim, e confirma-as aqui.
          </Text>
        </>
      ) : (
        <>
          <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600", lineHeight: 21 }}>{m.texto}</Text>
          {m.materiais.length > 0 ? (
            <Text style={{ color: CORES.suave, fontSize: 13 }}>{`Materiais usados: ${m.materiais.join(", ")}.`}</Text>
          ) : null}
          <Text style={{ color: CORES.suave, fontSize: 13 }}>{`Total: ${m.totalTexto}`}</Text>
          {m.confirmadas ? (
            <Text style={{ color: CORES.bom, fontSize: 15, fontWeight: "700" }}>
              {`${m.confirmadasPorTexto === "pela CLYON" ? "Horas confirmadas pela CLYON" : "Confirmou as horas"}${
                m.confirmadasEmTexto ? ` — ${m.confirmadasEmTexto}` : ""
              }.`}
            </Text>
          ) : h.estadoTexto ? (
            <Text style={{ color: CORES.tinta, fontSize: 14, lineHeight: 20 }}>{h.estadoTexto}</Text>
          ) : null}
          {m.contestadas && m.contestacao ? (
            <Text style={{ color: CORES.suave, fontSize: 13 }}>{`O que disse: «${m.contestacao}»`}</Text>
          ) : null}
        </>
      )}
      <Text style={{ color: CORES.suave, fontSize: 12, lineHeight: 17 }}>{h.regraTexto}</Text>
      {erro && !aContestar ? <Aviso texto={erro} tom="mau" /> : null}
      {podeResponder ? (
        <View style={{ gap: 8 }}>
          <Botao
            titulo={h.botaoConfirmar}
            ocupado={ocupado === "confirmar_horas"}
            desligado={!!ocupado}
            aoCarregar={() => void responder("confirmar_horas")}
          />
          <Botao titulo={h.botaoNaoConcordo} tipo="secundario" desligado={!!ocupado} aoCarregar={() => setAContestar(true)} />
        </View>
      ) : null}
      <Confirmacao
        visivel={aContestar}
        titulo="Não concorda com as horas?"
        texto="Diga em poucas palavras porquê. A equipa da CLYON vê consigo e com o parceiro."
        confirmar="Enviar"
        ocupado={ocupado === "contestar_horas"}
        erro={aContestar ? erro : null}
        aoConfirmar={() => {
          if (motivo.trim().length < MOTIVO_MINIMO_DAS_HORAS) setErro("Diga em poucas palavras porque não concorda.");
          else void responder("contestar_horas");
        }}
        aoVoltar={() => setAContestar(false)}
      >
        <Campo rotulo="Porque não concorda?" valor={motivo} aoMudar={setMotivo} multiline maxLength={MOTIVO_MAXIMO_DAS_HORAS} />
      </Confirmacao>
    </Cartao>
  );
}
