import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Aviso, Botao, Carregando, PrecoDeReferencia, Seccao } from "../../componentes/ui";
import { VersaoNova } from "../../componentes/VersaoNova";
import { OQueHaDeNovo } from "../../componentes/Novidades";
import { PrimeiroUso } from "../../componentes/PrimeiroUso";
import { PedidosEmCurso } from "../../componentes/inicio/PedidoEmCurso";
import { Intencoes } from "../../componentes/inicio/Intencoes";
import { AjudaDiscreta, PorquePodeConfiar, TresPassos, VozesDoGoogle } from "../../componentes/inicio/Confianca";
import { useCatalogo } from "../../estado/Catalogo";
import { usePedidos } from "../../estado/Pedidos";
import { useSessao } from "../../estado/Sessao";
import { whatsappDaClyon } from "../../lib/abrir";
import { lerMoradaDaConta, SEM_MORADA } from "../../lib/morada-do-cliente";
import type { Catalogo } from "../../lib/novo-pedido";
import { aparenciaDoServico, CORES } from "../../tema";

/**
 * E0 v5 — INÍCIO (d148, 27-11-2026, o CEO e o dono, depois de ver o protótipo).
 *
 * O topo (a morada, Conversas, Ajuda, Notificações), a pesquisa e a barra de
 * baixo ficam como estavam. O meio, por esta ordem e só o que se aplica:
 *   1. o pedido em curso, em destaque, com a novidade e o passo seguinte;
 *   2. «Do que precisa?» — quatro grupos com ilustração e um «desde» curto (o
 *      preço inteiro fica no Descobrir), a folha de cada grupo, «Outro serviço»
 *      e a nota dos preços;
 *   3. como funciona, em três passos;
 *   4. porque pode confiar (o Google, parceiros aprovados pela equipa, pagar ao parceiro
 *      no fim do trabalho, duas faturas) e algumas avaliações do Google;
 *   5. o WhatsApp numa linha, e a frase única.
 * Tudo do catálogo (R7): os grupos, os «desde», a confiança e os passos vêm já
 * escritos do site (`src/lib/grupos-da-app.ts`). Numa R7 antiga, sem grupos, o
 * Início mostra a grelha de serviços de antes — nunca um ecrã vazio.
 */
export const TITULO_DO_INICIO = "Do que precisa?";

/** Os três botões redondos da direita, só com ícone (por esta ordem). */
export const BOTOES_DO_TOPO = [
  { icone: "chatbubble-outline", rotulo: "Conversas", rota: "/conversas" },
  { icone: "help-buoy-outline", rotulo: "Ajuda", rota: "/ajuda" },
  { icone: "notifications-outline", rotulo: "Notificações", rota: "/notificacoes" },
] as const;

/**
 * A BARRA DE CIMA (dono, 30-10-2026): à esquerda a morada com a setinha (abre
 * «A sua morada»); à direita Conversas, Ajuda e Notificações, com o selo das
 * novidades dos pedidos; por baixo, «Como podemos ajudar?», que abre o Descobrir.
 */
function Topo() {
  const { ligado } = useSessao();
  const { porVer } = usePedidos();
  const [morada, setMorada] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void lerMoradaDaConta().then((m) => {
        if (vivo) setMorada(m?.formattedAddress ?? null);
      });
      return () => {
        vivo = false;
      };
    }, [ligado]),
  );
  // Só as novidades que ainda não viu (02-11-2026): abrir as Notificações ou o pedido apaga o número.
  const novidades = ligado ? porVer : 0;

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={() => router.push("/morada" as Href)}
          accessibilityRole="button"
          accessibilityLabel={morada ? `A sua morada: ${morada}. Mudar` : SEM_MORADA}
          style={({ pressed }) => ({ flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="location-outline" size={18} color={CORES.marca} />
          <Text titulo style={{ flexShrink: 1, color: CORES.tinta, fontSize: 15, fontWeight: "700" }} numberOfLines={1} ellipsizeMode="tail">
            {morada ?? SEM_MORADA}
          </Text>
          <Ionicons name="chevron-down" size={16} color={CORES.tinta} />
        </Pressable>
        {BOTOES_DO_TOPO.map((b) => {
          const selo = b.rota === "/notificacoes" && novidades > 0 ? novidades : 0;
          return (
            <Pressable
              key={b.rota}
              onPress={() => router.push(b.rota as Href)}
              accessibilityRole="button"
              accessibilityLabel={selo ? `${b.rotulo}, ${selo} com novidade` : b.rotulo}
              style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: CORES.linha, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name={b.icone} size={20} color={CORES.tinta} />
              {selo ? (
                <View style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: CORES.marca, alignItems: "center", justifyContent: "center" }}>
                  <Text titulo style={{ color: CORES.fundo, fontSize: 10.5, fontWeight: "700" }}>
                    {selo > 9 ? "9+" : String(selo)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => router.push("/servicos")}
        accessibilityRole="search"
        accessibilityLabel="Como podemos ajudar?"
        style={({ pressed }) => ({ minHeight: 48, borderRadius: 14, backgroundColor: CORES.superficie, borderWidth: 1, borderColor: CORES.linha, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}
      >
        <Ionicons name="search-outline" size={18} color={CORES.suave} />
        <Text style={{ color: CORES.suave, fontSize: 15 }}>Como podemos ajudar?</Text>
      </Pressable>
    </View>
  );
}

/**
 * A GRELHA DE ANTES (E0 v4): os serviços em cartões, com o preço de referência.
 * Só numa R7 antiga, que ainda não manda os grupos.
 */
function GrelhaDeServicos({ c }: { c: Catalogo }) {
  if (c.servicos.length === 0) return null;
  return (
    <Seccao titulo="Serviços" ligacao="Ver todos" aoCarregar={() => router.push("/servicos")}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {c.servicos.map((s) => {
          const a = aparenciaDoServico(s.id);
          return (
            <Pressable
              key={s.id}
              onPress={() => router.push({ pathname: "/pedir", params: { servico: s.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Pedir orçamento para ${s.nome}`}
              style={({ pressed }) => ({ flexBasis: 140, flexGrow: 1, minHeight: 116, borderRadius: 20, backgroundColor: a.tom.claro, padding: 14, gap: 8, opacity: pressed ? 0.75 : 1 })}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: CORES.fundo, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={a.icone as never} size={20} color={a.tom.forte} />
              </View>
              <Text titulo style={{ color: CORES.tinta, fontSize: 14, fontWeight: "600", lineHeight: 19 }} numberOfLines={2}>
                {s.nome}
              </Text>
              {s.precoReferencia ? <PrecoDeReferencia texto={s.precoReferencia} tamanho={12} /> : null}
            </Pressable>
          );
        })}
      </View>
      {c.textos.notaDosPrecos ? <Text style={{ color: CORES.suave, fontSize: 12, lineHeight: 17 }}>{c.textos.notaDosPrecos}</Text> : null}
    </Seccao>
  );
}

/** «Parceiros da sua zona respondem…» — a frase do topo do site, sem o «Descreva o que precisa.» que repetia a pergunta. */
export function subtituloDoInicio(subtitulo: string | null): string | null {
  const s = subtitulo?.replace(/^Descreva o que precisa\.\s*/, "").trim();
  return s ? s : null;
}

export default function Inicio() {
  const { catalogo, aLer, erro, recarregar } = useCatalogo();
  const { ligado } = useSessao();
  const { recarregar: recarregarOsPedidos } = usePedidos();

  if (!catalogo && aLer) return <Carregando />;
  const c = catalogo;
  const subtitulo = subtituloDoInicio(c?.textos.subtituloInicial ?? null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CORES.fundo }} edges={["top", "left", "right", "bottom"]}>
      <Topo />
      <RolagemComTeclado
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32, gap: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={aLer}
            onRefresh={() => {
              recarregar();
              if (ligado) void recarregarOsPedidos();
            }}
            tintColor={CORES.ciano}
          />
        }
      >
        <VersaoNova />
        <OQueHaDeNovo />
        {/* Sem sessão: «Entre para vermos que chegou»; e os avisos, uma vez (d108). */}
        <PrimeiroUso />

        {/* Sem catálogo e sem cópia guardada: o erro e «Tentar outra vez» — nunca um ecrã vazio. */}
        {!c && erro ? (
          <View style={{ gap: 10 }}>
            <Aviso texto={erro} tom="aviso" />
            <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={recarregar} />
          </View>
        ) : null}

        {/* 1. O pedido em curso, se houver. */}
        <PedidosEmCurso />

        {/* 2. «Do que precisa?»: os grupos (ou, numa R7 antiga, a grelha de antes). */}
        {c ? (
          <View style={{ gap: 18 }}>
            <View style={{ gap: 8 }}>
              <Text titulo accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 27, fontWeight: "700", lineHeight: 32 }}>
                {TITULO_DO_INICIO}
              </Text>
              {subtitulo ? <Text style={{ color: CORES.suave, fontSize: 14.5, lineHeight: 21 }}>{subtitulo}</Text> : null}
            </View>
            {c.info.grupos.length > 0 ? (
              <Intencoes grupos={c.info.grupos} servicos={c.servicos} notaDosPrecos={c.textos.notaDosPrecos} />
            ) : (
              <GrelhaDeServicos c={c} />
            )}
          </View>
        ) : null}

        {/* 3. Como funciona, em três passos. */}
        {c ? <TresPassos passos={c.textos.passosDoInicio} comoFunciona={c.info.comoFunciona} /> : null}

        {/* 4. Porque pode confiar: só factos, do servidor. */}
        {c ? <PorquePodeConfiar avaliacoes={c.info.avaliacoes} linhas={c.textos.confianca} /> : null}
        {c ? <VozesDoGoogle avaliacoes={c.info.avaliacoes} /> : null}

        {/* 5. O WhatsApp, discreto, e a frase única. */}
        <AjudaDiscreta aoCarregar={() => whatsappDaClyon()} />
        {c?.textos.fraseUnica ? <Text style={{ color: CORES.suave, fontSize: 12, lineHeight: 17, marginTop: -18 }}>{c.textos.fraseUnica}</Text> : null}
      </RolagemComTeclado>
    </SafeAreaView>
  );
}
