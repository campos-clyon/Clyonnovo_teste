import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, Escolhas, Etiqueta, ItemDoMenu, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { useConta } from "../../estado/Conta";
import { useSessao } from "../../estado/Sessao";
import { ErroDaApi, pedir } from "../../lib/api";
import {
  avisosDesligadosPorEle,
  desligarAvisosPorEscolha,
  estadoDaPermissao,
  ligarAvisosPorEscolha,
  type ResultadoDosAvisos,
} from "../../lib/avisos";
import {
  diaCurto,
  distincoesDoPerfil,
  ESTADO_DA_CONTA,
  faltasEm,
  FICHA_DA_DISTINCAO,
  mediaCurta,
  resumoDe,
  type Perfil,
  type SeccaoComFalta,
} from "../../lib/conta";
import { QUEM_FACTURA_EM_PALAVRAS } from "../../../../src/lib/identificacao-legal";
import { ESPACO, escolherModo, LETRA, useCores, useModo } from "../../tema";

/**
 * A CONTA — fase 4, 18-10-2026: o «A minha conta» do painel. Cada linha abre o
 * ecrã da secção (perfil, serviços e raio, faturação, conta bancária,
 * palavra-passe) e mostra à direita o que o painel mostra, ou o que falta.
 */

const ECRA_DA_SECCAO: Record<SeccaoComFalta, string> = {
  dados: "/conta/perfil",
  servicos: "/conta/servicos",
  faturacao: "/conta/faturacao",
  banco: "/conta/banco",
};

const PORQUE_NAO: Record<Exclude<ResultadoDosAvisos, { ok: true }>["motivo"], string> = {
  web: "Os avisos só funcionam na app instalada no telemóvel.",
  simulador: "Os avisos só funcionam num telemóvel a sério.",
  recusou: "Os avisos estão desligados nas definições do telemóvel. Ligue-os em Definições › Notificações › CLYON Pro.",
  "sem-projecto": "Esta versão de teste ainda não recebe avisos. Chegam com a versão instalada pela loja.",
  falhou: "Não foi possível ligar os avisos agora. Tente outra vez daqui a pouco.",
};

const abrir = (caminho: string) => router.push(caminho as never);

/**
 * «Falta 1» / «Faltam 2» — ou o valor da linha quando não falta nada. Só conta
 * o essencial: os custos que só melhoram a sugestão não põem a linha em falta
 * (estão no cartão de cima e dentro da secção).
 */
function valorOuFalta(p: Perfil | null, seccao: SeccaoComFalta, valor: string | null): string | null {
  if (!p) return valor;
  const n = faltasEm(p, seccao).filter((f) => f.peso === "essencial").length;
  return n > 0 ? `${n === 1 ? "Falta" : "Faltam"} ${n}` : valor;
}

export default function Conta() {
  const c = useCores();
  const modo = useModo();
  const margens = useSafeAreaInsets();
  const { nome, sair } = useSessao();
  const { perfil, recarregarPerfil } = useConta();
  const [aSair, setASair] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void recarregarPerfil();
    }, [recarregarPerfil]),
  );

  return (
    <ScrollView
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingTop: margens.top + ESPACO.l, paddingBottom: margens.bottom + ESPACO.xxl }]}
    >
      <Cabecalho perfil={perfil} nome={nome} />
      {perfil ? <PorCompletar perfil={perfil} /> : null}
      {perfil ? <AvisosNoWhatsApp perfil={perfil} aoMudar={recarregarPerfil} /> : null}

      <Text style={[estilos.seccao, { color: c.suave }]}>A MINHA CONTA</Text>
      <Caixa estilo={estilos.menu}>
        <ItemDoMenu icone="person-outline" titulo="Perfil" valor={valorOuFalta(perfil, "dados", null)} aoCarregar={() => abrir("/conta/perfil")} />
        <ItemDoMenu
          icone="location-outline"
          titulo="Serviços e raio"
          valor={valorOuFalta(perfil, "servicos", perfil ? `${perfil.raioKm} km` : null)}
          aoCarregar={() => abrir("/conta/servicos")}
        />
        <ItemDoMenu
          icone="document-text-outline"
          titulo="Faturação e IVA"
          valor={valorOuFalta(perfil, "faturacao", perfil?.emiteGuiaTransporte && !perfil.guiaVerificada ? "guia por verificar" : null)}
          aoCarregar={() => abrir("/conta/faturacao")}
        />
        <ItemDoMenu
          icone="card-outline"
          titulo="Conta bancária"
          valor={valorOuFalta(perfil, "banco", perfil ? perfil.iban || "por indicar" : null)}
          aoCarregar={() => abrir("/conta/banco")}
        />
        <ItemDoMenu icone="key-outline" titulo="Palavra-passe" aoCarregar={() => abrir("/conta/palavra-passe")} ultimo />
      </Caixa>

      <Caixa>
        <TituloDaCaixa>Modo do ecrã</TituloDaCaixa>
        <Escolhas
          opcoes={[
            { valor: "auto", rotulo: "Automático" },
            { valor: "claro", rotulo: "Claro" },
            { valor: "escuro", rotulo: "Azul-noite" },
          ]}
          valor={modo}
          aoEscolher={escolherModo}
        />
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
          {modo === "auto"
            ? "Segue o modo do telemóvel."
            : modo === "claro"
              ? "Sempre claro: lê-se melhor ao sol."
              : "Sempre azul-noite: cansa menos a vista à noite."}
        </Text>
      </Caixa>

      <AvisosNoTelemovel />

      <Caixa estilo={estilos.menu}>
        <ItemDoMenu icone="book-outline" titulo="Como funciona" aoCarregar={() => abrir("/conta/como-funciona")} />
        <ItemDoMenu icone="help-circle-outline" titulo="Ajuda" aoCarregar={() => abrir("/conta/ajuda")} />
        <ItemDoMenu
          icone="log-out-outline"
          titulo={aSair ? "A sair…" : "Sair"}
          perigo
          ultimo
          aoCarregar={async () => {
            if (aSair) return;
            setASair(true);
            await sair();
          }}
        />
      </Caixa>

      <Text style={{ color: c.suave, fontSize: LETRA.pequena, lineHeight: 18 }}>
        A CLYON liga clientes a profissionais independentes. Quem executa o trabalho é o profissional. {QUEM_FACTURA_EM_PALAVRAS}
      </Text>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena, textAlign: "center" }}>CLYON Pro {Constants.expoConfig?.version ?? ""}</Text>
    </ScrollView>
  );
}

function Cabecalho({ perfil, nome }: { perfil: Perfil | null; nome: string | null }) {
  const c = useCores();
  const media = mediaCurta(perfil?.avaliacao);
  const { distincoes } = perfil ? distincoesDoPerfil(perfil) : { distincoes: [] };
  const estado = perfil ? (ESTADO_DA_CONTA[perfil.estado] ?? perfil.estado) : null;
  return (
    <View style={{ gap: ESPACO.xs }}>
      <Text style={[estilos.titulo, { color: c.tinta }]} numberOfLines={2}>
        {perfil?.nome || nome || "A minha conta"}
      </Text>
      <View style={estilos.linha}>
        {perfil?.cidade ? (
          <>
            <Ionicons name="location-outline" size={15} color={c.suave} />
            <Text numberOfLines={1} style={{ color: c.suave, fontSize: LETRA.pequena + 1, flexShrink: 1 }}>
              {perfil.cidade}
            </Text>
          </>
        ) : null}
        {estado ? <Etiqueta texto={estado} tom={perfil?.estado === "aprovado" ? "bom" : "aviso"} /> : null}
      </View>
      {perfil ? (
        <Pressable
          onPress={() => abrir("/conta/avaliacoes")}
          accessibilityRole="button"
          accessibilityLabel={media ? `Avaliação ${media}, ${perfil.quantasAvaliacoes} avaliações` : "Sem avaliações"}
          style={({ pressed }) => [estilos.linha, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="star" size={15} color={c.aviso} />
          <Text style={{ color: c.tinta, fontWeight: "700" }}>{media ?? "sem avaliações"}</Text>
          {media ? <Text style={{ color: c.suave }}>({perfil.quantasAvaliacoes})</Text> : null}
          <Text style={{ color: c.suave }}>· {perfil.trabalhosConcluidos} trabalhos feitos</Text>
          {distincoes.map((d) => (
            <Text key={d} accessibilityLabel={FICHA_DA_DISTINCAO[d].titulo}>
              {FICHA_DA_DISTINCAO[d].simbolo}
            </Text>
          ))}
        </Pressable>
      ) : null}
    </View>
  );
}

function PorCompletar({ perfil }: { perfil: Perfil }) {
  const c = useCores();
  const r = resumoDe(perfil);
  if (r.completo) return null;
  const mostrar = (r.essenciais.length > 0 ? r.essenciais : r.melhorias).slice(0, 3);
  return (
    <Caixa estilo={{ borderColor: c.aviso }}>
      <TituloDaCaixa>{r.essenciais.length > 0 ? "Falta terminar o seu perfil" : "Dê-nos os seus números"}</TituloDaCaixa>
      <View style={[estilos.barra, { backgroundColor: c.fundo }]}>
        <View style={{ width: `${r.percentagem}%`, height: "100%", backgroundColor: c.marca, borderRadius: 999 }} />
      </View>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
        {r.feitos} de {r.total} preenchidos · {r.percentagem} %
      </Text>
      {mostrar.map((f) => (
        <Pressable
          key={f.chave}
          onPress={() => abrir(ECRA_DA_SECCAO[f.seccao])}
          accessibilityRole="button"
          style={({ pressed }) => [estilos.falta, { borderTopColor: c.linha, opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="warning-outline" size={18} color={c.aviso} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.tinta, fontWeight: "700" }}>{f.rotulo}</Text>
            <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{f.porque}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.suave} />
        </Pressable>
      ))}
      {r.faltas.length > mostrar.length ? (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
          E mais {r.faltas.length - mostrar.length} {r.faltas.length - mostrar.length === 1 ? "campo" : "campos"} por preencher, nas secções abaixo.
        </Text>
      ) : null}
    </Caixa>
  );
}

function AvisosNoWhatsApp({ perfil, aoMudar }: { perfil: Perfil; aoMudar: () => Promise<void> }) {
  const c = useCores();
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function mudar(quer: boolean) {
    setATratar(true);
    setErro(null);
    try {
      await pedir("/api/profissionais/avisos-whatsapp", { metodo: "PUT", corpo: { quer } });
      await aoMudar();
    } catch (e) {
      setErro(e instanceof ErroDaApi && e.estado !== 500 ? e.message : "Não foi possível guardar. Tente outra vez.");
    } finally {
      setATratar(false);
    }
  }

  if (perfil.avisosNoWhatsApp) {
    return (
      <View style={estilos.linha}>
        <Ionicons name="logo-whatsapp" size={16} color={c.bom} />
        <Text style={{ flex: 1, color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>
          Avisos de pedido novo no WhatsApp, ligados
          {diaCurto(perfil.avisosNoWhatsAppEm) ? ` desde ${diaCurto(perfil.avisosNoWhatsAppEm)}` : ""}.{" "}
          <Text onPress={aTratar ? undefined : () => void mudar(false)} style={{ color: c.marca, fontWeight: "700" }} accessibilityRole="button">
            {aTratar ? "A desligar…" : "Desligar"}
          </Text>
        </Text>
        {erro ? <Mensagem texto={erro} /> : null}
      </View>
    );
  }
  return (
    <Caixa>
      <TituloDaCaixa>Quer saber dos pedidos por WhatsApp?</TituloDaCaixa>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
        Mandamos-lhe uma mensagem quando entra um pedido para si: a localidade, o que o cliente pediu e quanto receberia. Mais nada — não é
        publicidade, e pode desligar aqui a qualquer momento ou respondendo «parar».
      </Text>
      {erro ? <Mensagem texto={erro} /> : null}
      <Botao titulo="Sim, avisem-me no WhatsApp" ocupado={aTratar} aoCarregar={() => void mudar(true)} />
    </Caixa>
  );
}

function AvisosNoTelemovel() {
  const c = useCores();
  const [permissao, setPermissao] = useState<string>("indisponivel");
  const [resultado, setResultado] = useState<ResultadoDosAvisos | null>(null);
  const [aLigar, setALigar] = useState(false);
  const [desligados, setDesligados] = useState(false);

  const lerPermissao = useCallback(() => {
    void estadoDaPermissao().then(setPermissao).catch(() => {});
    void avisosDesligadosPorEle().then(setDesligados);
  }, []);
  useEffect(() => lerPermissao(), [lerPermissao]);

  // Desligar sem sair da conta (versão 12): como no painel, uma definição que
  // se liga tem de se poder desligar.
  async function aoDesligar() {
    setALigar(true);
    await desligarAvisosPorEscolha();
    setResultado(null);
    setALigar(false);
    lerPermissao();
  }

  // O «aviso de teste» saiu a 18-10-2026 (pedido do dono): os avisos já estão
  // provados. A rota continua no site, para o dia em que for preciso outra vez.

  async function aoLigar() {
    setALigar(true);
    setResultado(await ligarAvisosPorEscolha());
    setALigar(false);
    lerPermissao();
  }

  return (
    <Caixa>
      <TituloDaCaixa>Avisos no telemóvel</TituloDaCaixa>
      <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 23 }}>
        {permissao === "concedida" && !desligados
          ? "Ligados. Um pedido novo para si toca no telemóvel, mesmo com a app fechada."
          : "Quem responde primeiro a um pedido novo costuma ficar com ele. Ligue os avisos para saber logo."}
      </Text>
      {resultado && !resultado.ok ? (
        <Mensagem
          tom="aviso"
          texto={PORQUE_NAO[resultado.motivo] + (resultado.motivo === "falhou" && resultado.detalhe ? ` (${resultado.detalhe})` : "")}
        />
      ) : null}
      {resultado?.ok ? <Mensagem tom="bom" texto="Avisos ligados neste telemóvel." /> : null}
      {permissao !== "concedida" || desligados || (resultado && !resultado.ok) ? (
        <Botao titulo="Ligar os avisos" ocupado={aLigar} aoCarregar={aoLigar} />
      ) : (
        <Botao titulo="Desligar os avisos" tipo="secundario" ocupado={aLigar} aoCarregar={() => void aoDesligar()} />
      )}
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  pagina: { paddingHorizontal: ESPACO.l, gap: ESPACO.l },
  titulo: { fontSize: LETRA.grande, fontWeight: "800" },
  linha: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  seccao: { fontSize: LETRA.pequena, fontWeight: "800", letterSpacing: 0.6, marginBottom: -ESPACO.s },
  menu: { padding: 0, gap: 0, overflow: "hidden" },
  barra: { height: 8, borderRadius: 999, overflow: "hidden" },
  falta: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: ESPACO.s },
});
