import { useState } from "react";
import { View } from "react-native";
import { Preco } from "./Preco";
import { Text } from "./Texto";
import { Miniaturas, VerFotografias } from "./VerFotografias";
import { Botao, Campo, Cartao, Confirmacao, Subtitulo } from "./ui";
import { ligarPara, whatsappPara } from "../lib/abrir";
import { linhaDoTempo, type Negociacao } from "../lib/pedidos";
import { CORES } from "../tema";
import { CONFIRMO_QUE_CHEGOU, O_PARCEIRO_DIZ_QUE_CHEGOU } from "../../../src/lib/viagem-ate-ao-cliente";

/**
 * E8 — ACOMPANHAR O TRABALHO.
 *
 * A linha do tempo com o que já aconteceu (datas da API, já em Lisboa), o
 * contacto do profissional (só depois de contratado — a API esconde-o antes)
 * e, quando há, o ajuste no local por responder: o antes e o depois como a
 * API os escreve, as fotografias dele, e a regra do prazo (`regraTexto`).
 */
export function Acompanhar({
  pedidoId,
  n,
  agir,
}: {
  pedidoId: number;
  n: Negociacao;
  agir: (corpo: Record<string, unknown>) => Promise<string | null>;
}) {
  const nome = n.profissional.nome;
  const [fotoAberta, setFotoAberta] = useState<number | null>(null);
  const [aRecusar, setARecusar] = useState(false);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ajuste = n.ajuste;
  const podeResponderAoAjuste = !!ajuste && n.accoes.includes("aprovar_ajuste");
  // «O parceiro diz que chegou» — a API só manda a acção depois do «Cheguei» dele (30-10-2026).
  const podeConfirmarChegada = n.accoes.includes("confirmar_chegada");

  async function confirmarChegada() {
    setOcupado("confirmar_chegada");
    setErro(null);
    const e = await agir({ pedidoId, negociacaoId: n.id, accao: "confirmar_chegada" });
    setOcupado(null);
    if (e) setErro(e);
  }

  async function responder(accao: "aprovar_ajuste" | "recusar_ajuste") {
    setOcupado(accao);
    setErro(null);
    const e = await agir({ pedidoId, negociacaoId: n.id, accao, motivo: accao === "recusar_ajuste" && nota.trim() ? nota.trim() : undefined });
    setOcupado(null);
    if (e) setErro(e);
    else setARecusar(false);
  }

  return (
    <View style={{ gap: 12 }}>
      {podeConfirmarChegada ? (
        <Cartao destaque>
          <Subtitulo>{O_PARCEIRO_DIZ_QUE_CHEGOU}</Subtitulo>
          {n.chegouEmTexto ? <Text style={{ color: CORES.suave, fontSize: 13 }}>{`Às ${n.chegouEmTexto}.`}</Text> : null}
          <Text style={{ color: CORES.tinta, fontSize: 15, lineHeight: 21 }}>
            {`Confirme quando ${nome} estiver aí. Depois disso, o trabalho pode ser concluído.`}
          </Text>
          {erro ? <Text style={{ color: CORES.mau, fontSize: 14 }}>{erro}</Text> : null}
          <Botao titulo={CONFIRMO_QUE_CHEGOU} ocupado={ocupado === "confirmar_chegada"} desligado={!!ocupado} aoCarregar={() => void confirmarChegada()} />
        </Cartao>
      ) : n.viagemTexto && !n.execucaoEnviadaEm ? (
        <Cartao>
          <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>{n.viagemTexto}</Text>
        </Cartao>
      ) : null}
      {podeResponderAoAjuste && ajuste ? (
        ajuste.sobe ? (
          <Cartao destaque>
            <Subtitulo>{`${nome} pediu para mudar o valor`}</Subtitulo>
            {ajuste.motivo ? <Text style={{ color: CORES.tinta, fontSize: 15, lineHeight: 21 }}>{ajuste.motivo}</Text> : null}
            <Text style={{ color: CORES.suave, fontSize: 13 }}>Antes</Text>
            <Preco preco={ajuste.antes} tamanho="medio" />
            <Text style={{ color: CORES.suave, fontSize: 13 }}>Depois</Text>
            <Preco preco={ajuste.depois} />
            <Miniaturas fotos={ajuste.fotos} aoAbrir={setFotoAberta} />
            <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{ajuste.regraTexto}</Text>
            {erro && !aRecusar ? <Text style={{ color: CORES.mau, fontSize: 14 }}>{erro}</Text> : null}
            <Botao titulo="Aceitar o novo valor" ocupado={ocupado === "aprovar_ajuste"} desligado={!!ocupado} aoCarregar={() => void responder("aprovar_ajuste")} />
            <Botao titulo="Recusar" tipo="secundario" desligado={!!ocupado} aoCarregar={() => setARecusar(true)} />
            <VerFotografias fotos={ajuste.fotos} aberta={fotoAberta} aoFechar={() => setFotoAberta(null)} />
            <Confirmacao
              visivel={aRecusar}
              titulo="Recusar o novo valor?"
              texto="Fica o valor que combinou."
              confirmar="Recusar"
              perigo
              ocupado={ocupado === "recusar_ajuste"}
              erro={aRecusar ? erro : null}
              aoConfirmar={() => void responder("recusar_ajuste")}
              aoVoltar={() => setARecusar(false)}
            >
              <Campo rotulo="Quer deixar uma nota? (opcional)" valor={nota} aoMudar={setNota} multiline maxLength={500} />
            </Confirmacao>
          </Cartao>
        ) : (
          <Cartao>
            <Text style={{ color: CORES.tinta, fontSize: 15 }}>{`${nome} baixou o valor para ${ajuste.depois.principal}.`}</Text>
          </Cartao>
        )
      ) : null}

      <Cartao>
        <Subtitulo>O trabalho</Subtitulo>
        {linhaDoTempo(n).map((passo, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CORES.marca, marginTop: 6 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>{passo.titulo}</Text>
              {passo.quando ? <Text style={{ color: CORES.suave, fontSize: 13 }}>{passo.quando}</Text> : null}
            </View>
          </View>
        ))}
        {n.profissional.telefone ? (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Botao titulo="Ligar" tipo="secundario" aoCarregar={() => ligarPara(n.profissional.telefone!)} />
            </View>
            <View style={{ flex: 1 }}>
              <Botao
                titulo="WhatsApp"
                tipo="secundario"
                aoCarregar={() => whatsappPara(n.profissional.telefone!, `Olá! Sou o cliente do pedido #${pedidoId} na CLYON.`)}
              />
            </View>
          </View>
        ) : null}
      </Cartao>
    </View>
  );
}
