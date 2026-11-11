import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Texto";
import { Botao, Mensagem } from "./ui";
import { FICHA_DO_AVISO } from "../../../src/lib/avisos-antes-de-cotar";
import { pedir } from "../lib/api";
import { cabeNaHora, responderComoEscolhido, type RespostaDoEscolhido, type TextosDaPrimeiraResposta } from "../lib/confirmar-a-hora";
import { euros, lerValor, quantoOProfissionalRecebe, type Taxas } from "../lib/trabalhos";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * «CONFIRMO: FAÇO POR X/H + IVA» — 11-11-2026 (d6), o do painel
 * (`ConfirmarAHora.tsx` do site) na app.
 *
 * Numa mudança em que o cliente o escolheu, a primeira resposta é um toque: a
 * hora dele vai como proposta num só pedido (o valor lê-o o servidor). Ao
 * lado, «Propor um valor mais baixo»; por baixo, a saída de sempre. Sem a
 * linha das propostas por usar nem os atalhos de percentagem: isso é da
 * negociação, a partir da segunda. Depois do prazo os botões continuam activos.
 *
 * Os textos vêm todos da rota (`mudancaEscolhida.primeiraResposta` e o `texto`
 * da resposta), os mesmos do painel; a regra está em `lib/confirmar-a-hora.ts`.
 */
export function ConfirmarAHora({
  negociacaoId,
  textos,
  hora,
  taxas,
  aoMudar,
  sair,
}: {
  negociacaoId: number;
  textos: TextosDaPrimeiraResposta;
  /** A hora congelada, sem IVA (euros): o tecto do valor mais baixo. */
  hora: number;
  taxas: Taxas;
  /** Depois de responder: volta a ler a lista (o ecrã passa ao da negociação). */
  aoMudar: () => Promise<void> | void;
  /** A saída com a segunda confirmação de sempre («Tem a certeza?»). */
  sair: (p: { titulo: string; aEnviar: boolean; aoConfirmar: () => void }) => ReactNode;
}) {
  const c = useCores();
  const [maisBaixo, setMaisBaixo] = useState(false);
  const [valor, setValor] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [semBotoes, setSemBotoes] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  /** O que ele ia fazer, à espera de ler os avisos do servidor e confirmar. */
  const [porConfirmar, setPorConfirmar] = useState<{ resposta: RespostaDoEscolhido; avisos: string[] } | null>(null);

  async function agir(resposta: RespostaDoEscolhido, avisosAceites = false) {
    if (aEnviar) return;
    setAEnviar(true);
    setErro(null);
    const r = await responderComoEscolhido(pedir, negociacaoId, textos, resposta, avisosAceites);
    if (r.ok) {
      setPorConfirmar(null);
      if (r.texto) setFeito(r.texto);
      await aoMudar();
    } else if (r.avisos) {
      setPorConfirmar({ resposta, avisos: r.avisos });
    } else {
      setErro(r.erro);
      if (r.semBotoes) {
        setSemBotoes(true);
        await aoMudar();
      }
    }
    setAEnviar(false);
  }

  // A frase da rota, no lugar dos botões (se a releitura falhar, fica esta à vista).
  if (feito) return <Mensagem tom="bom" texto={feito} />;

  const numero = lerValor(valor);

  return (
    <View style={{ gap: ESPACO.s }}>
      {erro ? <Mensagem texto={erro} /> : null}

      {porConfirmar && !semBotoes ? (
        <View style={{ gap: ESPACO.s }}>
          {porConfirmar.avisos.map((a) => {
            const ficha = FICHA_DO_AVISO[a as keyof typeof FICHA_DO_AVISO];
            return <Mensagem key={a} tom="aviso" texto={ficha ? `${ficha.titulo}. ${ficha.corpo}` : a} />;
          })}
          <Botao
            titulo={FICHA_DO_AVISO[porConfirmar.avisos[0] as keyof typeof FICHA_DO_AVISO]?.botao ?? "Percebi — continuar"}
            aoCarregar={() => void agir(porConfirmar.resposta, true)}
            ocupado={aEnviar}
          />
          <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setPorConfirmar(null)} />
        </View>
      ) : null}

      {!semBotoes && !porConfirmar && !maisBaixo ? (
        <View style={{ gap: ESPACO.s }}>
          <Botao titulo={textos.confirmar} ocupado={aEnviar} aoCarregar={() => void agir({ tipo: "confirmar" })} />
          <Botao
            titulo={textos.proporMaisBaixo}
            tipo="secundario"
            desactivado={aEnviar}
            aoCarregar={() => {
              setErro(null);
              setMaisBaixo(true);
            }}
          />
          {sair({ titulo: textos.naoEstouInteressado, aEnviar, aoConfirmar: () => void agir({ tipo: "desistir" }) })}
        </View>
      ) : null}

      {!semBotoes && !porConfirmar && maisBaixo ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.tinta, fontWeight: "600" }}>{textos.rotuloDoValor}</Text>
          <TextInput
            value={valor}
            onChangeText={setValor}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={c.suave}
            accessibilityLabel={textos.rotuloDoValor}
            style={[estilos.campo, { borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
          />
          <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{textos.regraDoValorMaisBaixo}</Text>
          {cabeNaHora(numero, hora) ? (
            <Text style={{ color: c.bom, fontWeight: "700" }}>Recebe {euros(quantoOProfissionalRecebe(numero, taxas))}/h, já com a taxa.</Text>
          ) : null}
          <Botao
            titulo={textos.enviarProposta}
            ocupado={aEnviar}
            desactivado={numero == null}
            aoCarregar={() => numero != null && void agir({ tipo: "propor", valor: numero })}
          />
          <Botao
            titulo={textos.voltar}
            tipo="secundario"
            desactivado={aEnviar}
            aoCarregar={() => {
              setErro(null);
              setMaisBaixo(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, minHeight: 52, fontSize: LETRA.media, fontWeight: "700" },
});
