import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Texto";
import { Botao, Caixa, Mensagem, TituloDaCaixa } from "./ui";
import { useTrabalhos } from "../estado/Trabalhos";
import { ErroDaApi, pedir } from "../lib/api";
import {
  GRAVAR_AS_HORAS,
  HORA_DE_FIM,
  HORA_DE_INICIO,
  REGRA_DAS_HORAS,
  TITULO_DAS_HORAS,
  agoraNoCampo,
  lerHora,
  porHoraCurto,
  type ResumoDasHoras,
} from "../../../src/lib/horas-do-trabalho";
import type { Trabalho } from "../lib/trabalhos";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * AS HORAS DO TRABALHO — 31-10-2026, o mesmo bloco do painel.
 *
 * Num trabalho por hora, depois do «Cheguei» confirmado: a hora de início e a
 * de fim (hora de Lisboa, «HH:MM»), dois campos que se escrevem — não é um
 * cronómetro. Um campo vazio, ao tocar, põe a hora de agora, e continua a
 * poder mudar-se. Com os materiais à parte, as quantidades usadas. «OK» grava
 * no site, que conta as horas (ao quarto de hora, para cima, mínimo 3) e o
 * total; corrigir é carregar em OK outra vez, enquanto o cliente não as
 * confirmar.
 */
export function HorasDoTrabalho({ t }: { t: Trabalho }) {
  const c = useCores();
  const { recarregar } = useTrabalhos();
  const h = t.porHora;
  const [inicio, setInicio] = useState(h?.campos.inicio ?? "");
  const [fim, setFim] = useState(h?.campos.fim ?? "");
  const [quantidades, setQuantidades] = useState<Record<string, string>>(() => {
    const q: Record<string, string> = {};
    for (const [id, n] of Object.entries(h?.campos.materiais ?? {})) q[id] = String(n);
    return q;
  });
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  if (t.baseDoPreco !== "hora" || !h || (!h.podeMarcar && !h.marcadas)) return null;
  const aParte = t.materiais && !t.materiais.incluidos ? t.materiais.itens : [];
  const resumo: ResumoDasHoras | null = h.resumo;
  const valido = lerHora(inicio) != null && lerHora(fim) != null;

  async function gravar() {
    setAEnviar(true);
    setErro(null);
    try {
      const materiais: Record<string, number> = {};
      for (const [id, v] of Object.entries(quantidades)) {
        const n = Math.floor(Number(v.replace(",", ".")));
        if (Number.isFinite(n) && n > 0) materiais[id] = n;
      }
      const r = await pedir<{ ok: boolean; mensagem?: string | null }>("/api/profissionais/trabalho/horas", {
        metodo: "POST",
        corpo: {
          negociacaoId: t.negociacaoId,
          inicio: inicio.trim(),
          fim: fim.trim(),
          ...(h?.campos.dia ? { dia: h.campos.dia } : {}),
          ...(Object.keys(materiais).length > 0 ? { materiais } : {}),
        },
      });
      setMensagem(r.mensagem ?? null);
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível gravar as horas. Tente outra vez.");
    } finally {
      setAEnviar(false);
    }
  }

  const campo = (rotulo: string, valor: string, mudar: (v: string) => void) => (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={mudar}
        // Vazio, ao tocar, põe a hora de agora (em Lisboa) — e continua editável.
        onFocus={() => {
          if (!valor.trim()) mudar(agoraNoCampo());
        }}
        editable={h.podeMarcar}
        keyboardType="numbers-and-punctuation"
        placeholder="HH:MM"
        placeholderTextColor={c.suave}
        maxLength={5}
        accessibilityLabel={rotulo}
        style={[estilos.campo, { borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
      />
    </View>
  );

  return (
    <Caixa>
      <TituloDaCaixa>{TITULO_DAS_HORAS}</TituloDaCaixa>
      {h.valorPorHora != null ? (
        <Text style={{ color: c.suave }}>
          {porHoraCurto(h.valorPorHora)} sem IVA{h.recebePorHora != null ? ` · recebe ${porHoraCurto(h.recebePorHora)}` : ""}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: ESPACO.s }}>
        {campo(HORA_DE_INICIO, inicio, setInicio)}
        {campo(HORA_DE_FIM, fim, setFim)}
      </View>
      {aParte.length > 0 && h.podeMarcar ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.tinta, fontWeight: "600" }}>Materiais à parte usados</Text>
          {aParte.map((m) => (
            <View key={m.id} style={estilos.linha}>
              <Text style={{ flex: 1, color: c.tinta }} numberOfLines={1}>
                {m.nome} ({m.preco.toFixed(2).replace(".", ",")} €/{m.unidade})
              </Text>
              <TextInput
                value={quantidades[m.id] ?? ""}
                onChangeText={(v) => setQuantidades({ ...quantidades, [m.id]: v })}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={c.suave}
                accessibilityLabel={`Quantidade de ${m.nome}`}
                style={[estilos.campo, { width: 72, borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
              />
            </View>
          ))}
        </View>
      ) : null}
      <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>{REGRA_DAS_HORAS}</Text>
      {h.podeMarcar ? (
        <Botao titulo={GRAVAR_AS_HORAS} ocupado={aEnviar} desactivado={!valido} aoCarregar={() => void gravar()} />
      ) : null}
      {mensagem ? <Mensagem tom="bom" texto={mensagem} /> : resumo ? <Text style={{ color: c.tinta, lineHeight: 22 }}>{resumo.textoParaQuemFez}</Text> : null}
      {h.estadoTexto ? <Mensagem tom={h.contestadas ? "aviso" : h.confirmadas ? "bom" : "aviso"} texto={h.estadoTexto} /> : null}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  campo: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, minHeight: 50, fontSize: LETRA.media, fontWeight: "700" },
  linha: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
});
