import Ionicons from "@expo/vector-icons/Ionicons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { SafeAreaView } from "react-native-safe-area-context";
import { CartaoDoWhatsapp, Pergunta } from "../../componentes/Informacao";
import { CartaoDoServico, TabelaDePrecos } from "../../componentes/Servicos";
import { Text } from "../../componentes/Texto";
import { Aviso, Botao, Carregando, Ligacao, Paragrafo, Titulo } from "../../componentes/ui";
import { useCatalogo } from "../../estado/Catalogo";
import { abrirNoNavegador } from "../../lib/abrir";
import { aparenciaDoServico, CORES } from "../../tema";

/**
 * A INFORMAÇÃO ÚTIL (I1–I6, v3) — ecrãs simples, só com o texto da R7 v2, que
 * é o mesmo das páginas do site (vem das mesmas constantes de `src/lib`, S12).
 *
 *   servico-<id>   I1 — o serviço, o preço de referência, as linhas dele e «Pedir orçamento para …»
 *   como-funciona  I2 — os passos, a frase única e a promessa do prazo
 *   precos         I3 — a grelha de /precos, com o IVA ao lado em cada linha, e a nota
 *   zonas          I4 — as regiões e as localidades com profissionais
 *   avaliacoes     I5 — o resumo e todos os testemunhos do Google, e «Ver no Google»
 *   perguntas      I6 — as perguntas frequentes, a abrir e fechar
 */
const TITULOS: Readonly<Record<string, string>> = {
  "como-funciona": "Como funciona",
  precos: "Preços de referência",
  zonas: "Zonas com parceiros na CLYON",
  avaliacoes: "Avaliações no Google",
  perguntas: "Perguntas frequentes",
};

export default function Informacao() {
  const { tema } = useLocalSearchParams<{ tema: string }>();
  const { catalogo, aLer } = useCatalogo();
  if (!catalogo) return aLer ? <Carregando /> : <Aviso texto="Não foi possível ler a informação. Tente outra vez daqui a pouco." tom="mau" />;
  const c = catalogo;
  const t = String(tema ?? "");
  const servico = t.startsWith("servico-") ? c.servicos.find((s) => s.id === t.slice("servico-".length)) ?? null : null;
  const titulo = servico?.nome ?? TITULOS[t] ?? "";

  let corpo: ReactNode = <Paragrafo suave>Esta informação ainda não está disponível na app.</Paragrafo>;

  if (servico) {
    const grupos = (c.info.precos?.grupos ?? []).filter((g) => g.servico === servico.id);
    corpo = (
      <>
        <CartaoDoServico s={servico} grupos={grupos} />
        {c.textos.notaDosPrecos ? <Paragrafo pequeno suave>{c.textos.notaDosPrecos}</Paragrafo> : null}
        {servico.detalhes === "entulho" && c.textos.entulhoNota ? <Paragrafo pequeno suave>{c.textos.entulhoNota}</Paragrafo> : null}
        <Botao titulo={`Pedir orçamento para ${servico.nome}`} aoCarregar={() => router.push({ pathname: "/pedir", params: { servico: servico.id } })} />
      </>
    );
  } else if (t === "como-funciona") {
    corpo = (
      <>
        {c.info.comoFunciona.map((p, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: CORES.marcaSuave, alignItems: "center", justifyContent: "center" }}>
              <Text titulo style={{ color: CORES.marca, fontSize: 15, fontWeight: "700" }}>
                {String(i + 1)}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
              <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
                {p.titulo}
              </Text>
              {p.texto ? <Text style={{ color: CORES.suave, fontSize: 14, lineHeight: 20 }}>{p.texto}</Text> : null}
            </View>
          </View>
        ))}
        {c.textos.promessaDoPrazo ? <Paragrafo>{c.textos.promessaDoPrazo}</Paragrafo> : null}
        <Paragrafo pequeno suave>
          {c.textos.fraseUnica}
        </Paragrafo>
      </>
    );
  } else if (t === "precos" && c.info.precos) {
    corpo = (
      <>
        {c.info.precos.grupos.map((g, i) => (
          <TabelaDePrecos key={i} grupo={g} tom={aparenciaDoServico(g.servico).tom} />
        ))}
        {c.info.precos.nota ?? c.textos.notaDosPrecos ? <Paragrafo pequeno suave>{c.info.precos.nota ?? c.textos.notaDosPrecos}</Paragrafo> : null}
      </>
    );
  } else if (t === "zonas" && c.info.zonas.length > 0) {
    corpo = (
      <>
        {c.info.zonas.map((z, i) => (
          <View key={i} style={{ gap: 4, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: CORES.linha }}>
            <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
              {z.nome}
            </Text>
            {z.localidades.length > 0 ? <Text style={{ color: CORES.suave, fontSize: 14, lineHeight: 20 }}>{z.localidades.join(", ")}</Text> : null}
          </View>
        ))}
      </>
    );
  } else if (t === "avaliacoes" && c.info.avaliacoes) {
    const a = c.info.avaliacoes;
    corpo = (
      <>
        <View style={{ flexDirection: "row", gap: 2 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Ionicons key={i} name="star" size={18} color={CORES.estrela} />
          ))}
        </View>
        <Paragrafo>{a.resumo}</Paragrafo>
        {a.testemunhos.map((x, i) => (
          <View key={i} style={{ borderRadius: 20, backgroundColor: CORES.superficie, padding: 16, gap: 8 }}>
            <Text style={{ color: CORES.tinta, fontSize: 14, lineHeight: 21 }}>{`«${x.texto}»`}</Text>
            <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{[x.nome, x.mes].filter(Boolean).join(" · ")}</Text>
          </View>
        ))}
        {a.url ? <Ligacao titulo="Ver no Google" aoCarregar={() => abrirNoNavegador(a.url as string)} /> : null}
      </>
    );
  } else if (t === "perguntas" && c.info.perguntas.length > 0) {
    corpo = (
      <View>
        {c.info.perguntas.map((q, i) => (
          <Pergunta key={i} p={q.p} r={q.r} />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={{ flex: 1, backgroundColor: CORES.fundo }}>
    <RolagemComTeclado style={{ flex: 1, backgroundColor: CORES.fundo }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: "" }} />
      {titulo ? <Titulo>{titulo}</Titulo> : null}
      {corpo}
      <CartaoDoWhatsapp horario={c.textos.horarioDoWhatsapp} />
    </RolagemComTeclado>
    </SafeAreaView>
  );
}
