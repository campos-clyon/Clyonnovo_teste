import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Text } from "./Texto";
import { Botao, Caixa, Mensagem } from "./ui";
import { useTrabalhos } from "../estado/Trabalhos";
import { ErroDaApi, pedir } from "../lib/api";
import { explicacaoDoArquivar, negociacaoAberta, perguntaAntesDeArquivar, type Trabalho } from "../lib/trabalhos";
import { ESPACO, LETRA, useCores } from "../tema";

/**
 * ARQUIVAR E REPOR — 20-10-2026, o que faltava à app para fazer o que o painel
 * faz (`painel/arrumar.ts` e o fim do `Trabalhos.tsx`).
 *
 * No fim do ecrã, depois de ler tudo, em qualquer estado. Um pedido aberto
 * desiste primeiro (o cliente fica a saber que não há interesse); um trabalho
 * contratado sai da vista e da agenda mas continua combinado. Depois de
 * arrumar volta-se à lista: o que se arrumou não fica aberto à frente.
 */
export function Arrumar({ t }: { t: Trabalho }) {
  const c = useCores();
  const { recarregar } = useTrabalhos();
  const [confirmar, setConfirmar] = useState(false);
  const [aArrumar, setAArrumar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arquivar = !t.arquivadoEm;
  const pergunta = arquivar ? perguntaAntesDeArquivar(t) : null;
  const { titulo, texto } = explicacaoDoArquivar(t);

  async function arrumar() {
    setAArrumar(true);
    setErro(null);
    try {
      // Se a desistência falhar (prazo, estado mudou), não se esconde nada.
      if (arquivar && negociacaoAberta(t)) {
        await pedir("/api/profissionais/negociacao", {
          metodo: "POST",
          corpo: { accao: "desistir", negociacaoId: t.negociacaoId },
        });
      }
      await pedir("/api/profissionais/arquivar", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, arquivar } });
      await recarregar();
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : `Não foi possível ${arquivar ? "arquivar" : "repor"}. Tente outra vez.`);
      setConfirmar(false);
    } finally {
      setAArrumar(false);
    }
  }

  return (
    <Caixa>
      <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>{titulo}</Text>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{texto}</Text>
      {confirmar && pergunta ? (
        <View style={{ gap: ESPACO.s, marginTop: ESPACO.xs }}>
          <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{pergunta}</Text>
          <Botao titulo="Sim, arquivar" ocupado={aArrumar} aoCarregar={() => void arrumar()} />
          <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setConfirmar(false)} />
        </View>
      ) : (
        <Botao
          titulo={arquivar ? "Arquivar" : "Repor"}
          tipo="secundario"
          ocupado={aArrumar}
          aoCarregar={() => (pergunta ? setConfirmar(true) : void arrumar())}
        />
      )}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}
