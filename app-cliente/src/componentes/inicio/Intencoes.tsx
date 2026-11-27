import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, View, type ImageSourcePropType } from "react-native";
import { Text } from "../Texto";
import { Folha, PrecoDeReferencia } from "../ui";
import { partesDoPreco, type GrupoDoInicio } from "../../lib/catalogo";
import type { ServicoDoCatalogo } from "../../lib/novo-pedido";
import { aparenciaDoServico, CORES, type Tom } from "../../tema";

/**
 * «DO QUE PRECISA?» — d148 (27-11-2026, o CEO e o dono).
 *
 * Quatro grupos pelo que a pessoa quer fazer (`grupos` da R7, do site:
 * `src/lib/grupos-da-app.ts`), cada um com a ilustração, uma linha do que
 * inclui e o «desde» curto, já escrito com o IVA ao lado. Tocar abre a folha do
 * grupo com os serviços; tocar num serviço abre o Pedir com ele. O preço inteiro
 * fica no Descobrir. A app não tem números: só parte a frase do preço.
 */

/** As ilustrações (PNG, sem módulo nativo: cabe num EAS Update). Um grupo novo cai no ícone do 1.º serviço. */
const ILUSTRACOES: Readonly<Record<string, ImageSourcePropType>> = {
  levar: require("../../imagens/inicio/levar.png"),
  esvaziar: require("../../imagens/inicio/esvaziar.png"),
  mudar: require("../../imagens/inicio/mudar.png"),
  reparar: require("../../imagens/inicio/reparar.png"),
};

/** A cor de cada grupo: a do seu serviço principal (os tons do backoffice). */
const COR_DO_GRUPO: Readonly<Record<string, string>> = {
  levar: "recolha_moveis",
  esvaziar: "esvaziamento_casa",
  mudar: "mudanca",
  reparar: "manutencao_casa",
};

export function tomDoGrupo(g: Pick<GrupoDoInicio, "id" | "servicos">): Tom {
  return aparenciaDoServico(COR_DO_GRUPO[g.id] ?? g.servicos[0]).tom;
}

/** «desde 60 € + IVA» em destaque, e «73,80 € com IVA» por baixo, mais pequeno — a mesma frase da API. */
function Desde({ texto, cor }: { texto: string; cor: string }) {
  const { principal, resto } = partesDoPreco(texto);
  return (
    <View>
      <Text titulo style={{ color: cor, fontSize: 13, fontWeight: "700", lineHeight: 17 }}>
        {principal}
      </Text>
      {resto ? <Text style={{ color: CORES.suave, fontSize: 11.5, lineHeight: 15 }}>{resto.replace(/^\(|\)$/g, "")}</Text> : null}
    </View>
  );
}

function CartaoDoGrupo({ g, aoAbrir }: { g: GrupoDoInicio; aoAbrir: () => void }) {
  const tom = tomDoGrupo(g);
  const ilustracao = ILUSTRACOES[g.id];
  return (
    <Pressable
      onPress={aoAbrir}
      accessibilityRole="button"
      accessibilityLabel={`${g.titulo}${g.desde ? `, ${g.desde}` : ""}`}
      style={({ pressed }) => ({ flexBasis: 150, flexGrow: 1, minHeight: 206, borderRadius: 22, backgroundColor: tom.claro, padding: 13, paddingTop: 10, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ height: 92, alignItems: "center", justifyContent: "flex-end", marginBottom: 6 }}>
        {ilustracao ? (
          <Image source={ilustracao} style={{ width: 140, height: 92 }} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <Ionicons name={aparenciaDoServico(g.servicos[0]).icone as never} size={44} color={tom.forte} />
        )}
      </View>
      <Text titulo style={{ color: CORES.tinta, fontSize: 15.5, fontWeight: "600", lineHeight: 19 }}>
        {g.titulo}
      </Text>
      {g.inclui ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 17, marginTop: 3 }}>{g.inclui}</Text> : null}
      <View style={{ flex: 1, minHeight: 10 }} />
      {g.desde ? <Desde texto={g.desde} cor={tom.forte} /> : null}
    </Pressable>
  );
}

function LinhaDoServico({ s, aoEscolher }: { s: ServicoDoCatalogo; aoEscolher: () => void }) {
  const a = aparenciaDoServico(s.id);
  return (
    <Pressable
      onPress={aoEscolher}
      accessibilityRole="button"
      accessibilityLabel={`Pedir orçamento para ${s.nome}`}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: a.tom.claro, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={a.icone as never} size={21} color={a.tom.forte} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600" }}>
          {s.nome}
        </Text>
        {s.inclui ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 17 }}>{s.inclui}</Text> : null}
        {s.desdeCurto ? <PrecoDeReferencia texto={s.desdeCurto} cor={a.tom.forte} tamanho={12.5} /> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={CORES.icone} />
    </Pressable>
  );
}

export function Intencoes({ grupos, servicos, notaDosPrecos }: { grupos: GrupoDoInicio[]; servicos: ServicoDoCatalogo[]; notaDosPrecos: string | null }) {
  const [aberto, setAberto] = useState<GrupoDoInicio | null>(null);
  const outro = servicos.find((s) => s.id === "outro");
  const doGrupo = aberto ? aberto.servicos.map((id) => servicos.find((s) => s.id === id)).filter((s): s is ServicoDoCatalogo => !!s) : [];
  const pedir = (servico: string) => {
    setAberto(null);
    router.push({ pathname: "/pedir", params: { servico } });
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {grupos.map((g) => (
          <CartaoDoGrupo key={g.id} g={g} aoAbrir={() => setAberto(g)} />
        ))}
      </View>

      {outro ? (
        <Pressable
          onPress={() => pedir(outro.id)}
          accessibilityRole="button"
          accessibilityLabel={`Pedir orçamento para ${outro.nome}`}
          style={({ pressed }) => ({
            minHeight: 56,
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: CORES.linhaForte,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 10,
            paddingHorizontal: 14,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="ellipsis-horizontal-circle-outline" size={22} color={CORES.suave} />
          <View style={{ flex: 1 }}>
            <Text titulo style={{ color: CORES.tinta, fontSize: 14.5, fontWeight: "600" }}>
              {outro.nome}
            </Text>
            {outro.inclui ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 17 }}>{outro.inclui}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={CORES.icone} />
        </Pressable>
      ) : null}

      {notaDosPrecos ? (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
          <Ionicons name="information-circle-outline" size={15} color={CORES.suave} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: CORES.suave, fontSize: 12, lineHeight: 17 }}>{notaDosPrecos}</Text>
        </View>
      ) : null}

      <Folha visivel={!!aberto} aoFechar={() => setAberto(null)}>
        {aberto ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 6 }}>
              {ILUSTRACOES[aberto.id] ? (
                <View style={{ width: 84, height: 62, borderRadius: 16, backgroundColor: tomDoGrupo(aberto).claro, alignItems: "center", justifyContent: "flex-end", overflow: "hidden" }}>
                  <Image source={ILUSTRACOES[aberto.id]} style={{ width: 84, height: 55 }} resizeMode="contain" accessibilityIgnoresInvertColors />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text titulo accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 20, fontWeight: "700", lineHeight: 25 }}>
                  {aberto.titulo}
                </Text>
                <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 18, marginTop: 2 }}>Escolha o que é. O preço final vem nas propostas.</Text>
              </View>
            </View>
            {doGrupo.map((s, i) => (
              <View key={s.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: CORES.linha }}>
                <LinhaDoServico s={s} aoEscolher={() => pedir(s.id)} />
              </View>
            ))}
            {notaDosPrecos ? <Text style={{ color: CORES.suave, fontSize: 11.5, lineHeight: 16, marginTop: 6 }}>{notaDosPrecos}</Text> : null}
          </View>
        ) : null}
      </Folha>
    </View>
  );
}
