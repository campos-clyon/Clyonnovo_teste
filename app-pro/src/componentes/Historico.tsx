import { StyleSheet, View } from "react-native";
import { Text } from "./Texto";
import { Caixa, TituloDaCaixa } from "./ui";
import { dataEHora, haQuantoTempo, historicoDaNegociacao } from "../../../src/lib/historico-negociacao";
import { euros, propostasDe, type Trabalho } from "../lib/trabalhos";
import { ESPACO, LETRA, useCores } from "../tema";

/**
 * O HISTÓRICO DA NEGOCIAÇÃO — versão 12, o mesmo do painel
 * (`HistoricoDaNegociacao.tsx` no site).
 *
 * Tudo o que se passou, numa linha do tempo: as propostas dos dois lados, o
 * que lhes aconteceu, o «está feito», a confirmação, o pagamento e as
 * estrelas. Fica depois de o trabalho acabar — é a prova do que foi
 * combinado. As frases e as datas vêm de `historico-negociacao.ts`, do site:
 * a app não as escreve.
 */
export function Historico({ t }: { t: Trabalho }) {
  const c = useCores();
  const historico = historicoDaNegociacao(
    propostasDe(t.propostas),
    {
      execucaoEnviadaEm: t.execucaoEnviadaEm,
      confirmadoEm: t.confirmadoEm,
      pagoEm: t.pagoEm,
      avaliadoEm: t.avaliadoEm,
      estrelas: t.estrelas,
      valorAcordado: t.valorAcordado,
    },
    "profissional",
    Boolean(t.ofertaClyon),
  );
  if (historico.length === 0) return null;
  const agora = new Date();

  return (
    <Caixa>
      <TituloDaCaixa>Histórico</TituloDaCaixa>
      {historico.map((e, i) => {
        const deCima = e.estado === "pendente";
        const doSistema = e.quem === "sistema";
        const ultimo = i === historico.length - 1;
        return (
          <View key={i} style={estilos.linha}>
            {/* O ponto e a linha dão a leitura de sequência sem uma palavra a explicá-la. */}
            <View style={estilos.eixo}>
              <View style={[estilos.ponto, { backgroundColor: deCima ? c.marca : doSistema ? c.bom : c.linha }]} />
              {!ultimo ? <View style={[estilos.traco, { backgroundColor: c.linha }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: ultimo ? 0 : ESPACO.s }}>
              <View style={estilos.cabeca}>
                <Text style={{ flex: 1, color: deCima ? c.tinta : c.suave, fontWeight: deCima ? "700" : "400", fontSize: LETRA.normal }}>
                  {e.texto}
                </Text>
                {e.valor != null ? (
                  <Text
                    style={{
                      color: deCima || doSistema ? c.tinta : c.suave,
                      fontWeight: deCima || doSistema ? "800" : "400",
                      textDecorationLine: deCima || doSistema ? "none" : "line-through",
                      fontSize: LETRA.normal,
                    }}
                  >
                    {euros(e.valor)}
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>
                {haQuantoTempo(e.quando, agora)} · {dataEHora(e.quando)}
              </Text>
            </View>
          </View>
        );
      })}
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", gap: ESPACO.m },
  eixo: { alignItems: "center", paddingTop: 7, width: 10 },
  ponto: { width: 9, height: 9, borderRadius: 999 },
  traco: { width: 1, flex: 1, marginTop: 4 },
  cabeca: { flexDirection: "row", alignItems: "baseline", gap: ESPACO.s },
});
