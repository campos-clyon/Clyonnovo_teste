import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Texto";
import { Botao, Caixa, Mensagem, TituloDaCaixa } from "./ui";
import { useTrabalhos } from "../estado/Trabalhos";
import { ErroDaApi, pedir } from "../lib/api";
import { diaEmLisboa } from "../../../src/lib/hora-de-lisboa";
import { diaNDeM, diasPorExtenso, horaDoDia, type DiaDoTrabalho } from "../../../src/lib/varios-dias";
import { cargasEscritas, diasParaMostrar, REGISTE_AS_CARGAS, type Trabalho } from "../lib/trabalhos";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * OS DIAS DO TRABALHO — d64 (18-11-2026), o mesmo bloco do painel
 * (`DiasDoTrabalho.tsx` do site). Num trabalho em vários dias: cada dia com a
 * hora de início e as cargas previstas, e, com o trabalho por fazer, um campo
 * para registar as cargas feitas nesse dia (no próprio dia ou depois). O total
 * conta-se no fim; o «Está feito» só no último dia (quem decide é o site).
 * Num trabalho de um dia não desenha nada.
 */
export function DiasDoTrabalho({ t }: { t: Trabalho }) {
  const c = useCores();
  const { recarregar } = useTrabalhos();
  const [escrito, setEscrito] = useState<Record<string, string>>({});
  const [aGravar, setAGravar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const dias = diasParaMostrar(t);
  if (t.estado !== "acordada" || dias.length === 0) return null;
  const podeRegistar = t.fase === "a_executar";
  // O dia de hoje em Lisboa — nunca o do telemóvel.
  const hoje = diaEmLisboa(new Date());
  const total = t.cargasFeitasNoTotal ?? null;

  async function gravar(d: DiaDoTrabalho) {
    const cargas = (escrito[d.dia] ?? "").trim();
    if (!cargas) return;
    setAGravar(d.dia);
    setErro(null);
    try {
      await pedir<{ dias?: DiaDoTrabalho[]; cargasFeitasNoTotal?: number | null }>("/api/profissionais/trabalho/cargas-do-dia", {
        metodo: "POST",
        corpo: { negociacaoId: t.negociacaoId, dia: d.dia, cargas },
      });
      setEscrito((e) => ({ ...e, [d.dia]: "" }));
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível gravar.");
    } finally {
      setAGravar(null);
    }
  }

  return (
    <Caixa>
      <TituloDaCaixa>{`Trabalho em ${dias.length} dias`}</TituloDaCaixa>
      {t.diasDoTrabalhoTexto ? <Text style={{ color: c.tinta, fontSize: LETRA.normal, fontWeight: "600" }}>{t.diasDoTrabalhoTexto}</Text> : null}
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{REGISTE_AS_CARGAS}</Text>
      {dias.map((d, i) => {
        const hora = horaDoDia(d);
        return (
          <View key={d.dia} style={[estilos.dia, { borderColor: c.linha }]}>
            <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>
              {diasPorExtenso([d.dia])}
              {hora ? `, às ${hora}` : ""}
              <Text style={{ color: c.suave, fontWeight: "400" }}>{` (${diaNDeM(i + 1, dias.length)})`}</Text>
            </Text>
            <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
              {d.cargasPrevistas != null ? `Previstas: ${cargasEscritas(d.cargasPrevistas)}` : "Sem cargas previstas"}
              {d.cargasFeitas != null ? ` · Feitas: ${cargasEscritas(d.cargasFeitas)}` : ""}
            </Text>
            {podeRegistar && d.dia <= hoje ? (
              <View style={estilos.linha}>
                <TextInput
                  value={escrito[d.dia] ?? ""}
                  onChangeText={(v) => setEscrito((x) => ({ ...x, [d.dia]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="cargas feitas"
                  placeholderTextColor={c.suave}
                  accessibilityLabel={`Cargas feitas no dia ${i + 1}`}
                  style={[estilos.campo, { borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
                />
                <View style={{ flex: 1 }}>
                  <Botao
                    titulo="Gravar"
                    tipo="secundario"
                    ocupado={aGravar === d.dia}
                    desactivado={!(escrito[d.dia] ?? "").trim() || (aGravar != null && aGravar !== d.dia)}
                    aoCarregar={() => void gravar(d)}
                  />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
      {total != null ? (
        <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>{`Cargas registadas: ${cargasEscritas(total)}`}</Text>
      ) : null}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  dia: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, paddingVertical: ESPACO.s, gap: 2 },
  linha: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, marginTop: ESPACO.s },
  campo: { width: 130, borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, minHeight: 48, fontSize: LETRA.media },
});
