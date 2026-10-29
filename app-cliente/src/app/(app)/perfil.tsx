import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Entrada } from "../../componentes/Entrada";
import { Text } from "../../componentes/Texto";
import { Aviso, Botao, Campo, Confirmacao, Ecra, Ligacao, Paragrafo, Titulo } from "../../componentes/ui";
import { VersaoNova } from "../../componentes/VersaoNova";
import { useCatalogo } from "../../estado/Catalogo";
import { useSessao } from "../../estado/Sessao";
import { abrirNoNavegador, whatsappDaClyon } from "../../lib/abrir";
import { ErroDaApi, mensagemDe, pedir, versaoDestaApp } from "../../lib/api";
import { avisosLigados, desligarAvisos, ligarAvisos } from "../../lib/avisos";
import { seguirDepoisDeEntrar } from "../../lib/depois-de-entrar";
import { mascararEmail } from "../../lib/entrada";
import { lerToken } from "../../lib/sessao";
import { CORES } from "../../tema";

/**
 * E11 v3 — PERFIL (maqueta 9), por secções, como a `/conta` do site.
 *
 * COM CONTA: os seus dados e a faturação (`GET`/`PATCH /api/users/me`, os
 * mesmos campos que a `/conta` grava), as notificações (os avisos no
 * telemóvel, R6, e os três da `/conta`: email quando o estado muda, resumo
 * semanal, WhatsApp), a carteira (S22, quando a rota estiver no ar), a
 * segurança (sair, sair de todos os aparelhos, apagar a conta) e a informação
 * útil. SEM CONTA: entrar (Google ou link por email) e a informação útil.
 *
 * Sair tira o telemóvel da conta no site, apaga o token, a lista guardada e o
 * rascunho, e deita fora o código do aparelho.
 */
type Conta = {
  name: string | null;
  phone: string | null;
  addressLine: string | null;
  nif: string | null;
  billingName?: string | null;
  billingNif?: string | null;
  billingAddress?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  notifOrderStatus?: number | boolean;
  notifWeeklyDigest?: number | boolean;
  notifWhatsapp?: number | boolean;
};
type Carteira = { linhas?: Array<{ rotulo: string; texto: string }>; rotuloDoTotal?: string; total?: string } | null;

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text titulo style={{ color: CORES.suave, fontSize: 13.5, fontWeight: "600" }}>
        {titulo}
      </Text>
      <View style={{ borderRadius: 20, borderWidth: 1, borderColor: CORES.linha, paddingHorizontal: 16, paddingVertical: 6 }}>{children}</View>
    </View>
  );
}

function Linha({ icone, titulo, texto, aoCarregar, ultima = false }: { icone: string; titulo: string; texto?: string | null; aoCarregar: () => void; ultima?: boolean }) {
  return (
    <Pressable
      onPress={aoCarregar}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: CORES.linha, opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icone as never} size={20} color={CORES.marca} />
      <View style={{ flex: 1 }}>
        <Text titulo style={{ color: CORES.tinta, fontSize: 14.5, fontWeight: "600" }}>
          {titulo}
        </Text>
        {texto ? <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18 }}>{texto}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={CORES.suave} />
    </Pressable>
  );
}

function Interruptor({ titulo, ligado, aoMudar, ultima = false }: { titulo: string; ligado: boolean; aoMudar: (v: boolean) => void; ultima?: boolean }) {
  return (
    <Pressable
      onPress={() => aoMudar(!ligado)}
      accessibilityRole="switch"
      accessibilityState={{ checked: ligado }}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: CORES.linha }}
    >
      <Text style={{ flex: 1, color: CORES.tinta, fontSize: 14.5 }}>{titulo}</Text>
      <View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: ligado ? CORES.marca : CORES.linhaForte, alignItems: ligado ? "flex-end" : "flex-start" }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: CORES.fundo }} />
      </View>
    </Pressable>
  );
}

function InformacaoUtil() {
  const { catalogo } = useCatalogo();
  return (
    <Grupo titulo="Ajuda e informação">
      <Linha icone="logo-whatsapp" titulo="Falar com a CLYON" texto={catalogo?.textos.horarioDoWhatsapp ?? "WhatsApp"} aoCarregar={() => whatsappDaClyon()} />
      <Linha icone="list-outline" titulo="Como funciona" aoCarregar={() => router.push("/info/como-funciona")} />
      <Linha icone="pricetag-outline" titulo="Preços de referência" aoCarregar={() => router.push("/info/precos")} />
      <Linha icone="map-outline" titulo="Zonas" aoCarregar={() => router.push("/info/zonas")} />
      <Linha icone="star-outline" titulo="Avaliações no Google" aoCarregar={() => router.push("/info/avaliacoes")} />
      <Linha icone="help-circle-outline" titulo="Perguntas frequentes" aoCarregar={() => router.push("/info/perguntas")} />
      <Linha icone="document-text-outline" titulo="Termos" texto="Abre em clyon.pt" aoCarregar={() => abrirNoNavegador("/termos")} />
      <Linha icone="shield-checkmark-outline" titulo="Privacidade" texto="Abre em clyon.pt" aoCarregar={() => abrirNoNavegador("/privacidade")} ultima />
    </Grupo>
  );
}

function Rodape() {
  const { catalogo } = useCatalogo();
  return (
    <View style={{ gap: 8 }}>
      {catalogo?.textos.fraseUnica ? <Paragrafo pequeno suave>{catalogo.textos.fraseUnica}</Paragrafo> : null}
      <Text style={{ color: CORES.suave, fontSize: 12, textAlign: "center" }}>
        {`Versão ${versaoDestaApp()}${Constants.expoConfig?.name ? ` · ${Constants.expoConfig.name}` : ""}`}
      </Text>
    </View>
  );
}

function SemConta() {
  const { aviso } = useSessao();
  return (
    <Ecra>
      <VersaoNova />
      <Titulo>Perfil</Titulo>
      {aviso ? <Aviso texto={aviso.texto} tom={aviso.tom} /> : null}
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: CORES.linha, padding: 18, gap: 12 }}>
        <Text titulo style={{ color: CORES.tinta, fontSize: 18, fontWeight: "600" }}>
          Entrar na CLYON
        </Text>
        <Paragrafo suave>Com conta, os pedidos ficam guardados e as propostas chegam ao telemóvel.</Paragrafo>
        <Entrada depois={{ para: "pedidos" }} aoEntrar={() => void seguirDepoisDeEntrar({ para: "pedidos" })} />
      </View>
      <InformacaoUtil />
      <Rodape />
    </Ecra>
  );
}

const comoBool = (v: number | boolean | undefined) => v === true || v === 1;

function ComConta() {
  const { email, entrada, sair } = useSessao();
  const [conta, setConta] = useState<Conta | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tom: "bom" | "mau" } | null>(null);
  const [avisos, setAvisos] = useState<boolean | null>(null);
  const [avisoDosAvisos, setAvisoDosAvisos] = useState<string | null>(null);
  const [carteira, setCarteira] = useState<Carteira>(null);
  const [aApagar, setAApagar] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erroAoApagar, setErroAoApagar] = useState<string | null>(null);
  const [aSairDeTodos, setASairDeTodos] = useState(false);
  const [erroDeTodos, setErroDeTodos] = useState<string | null>(null);

  useEffect(() => {
    pedir<{ user?: Conta }>("/api/users/me")
      .then((r) => {
        const u = r.user ?? { name: null, phone: null, addressLine: null, nif: null };
        setConta(u);
        setF({
          name: u.name ?? "",
          phone: u.phone ?? "",
          addressLine: u.addressLine ?? "",
          billingName: u.billingName ?? "",
          billingNif: u.billingNif ?? u.nif ?? "",
          billingAddress: u.billingAddress ?? "",
          billingPostalCode: u.billingPostalCode ?? "",
          billingCity: u.billingCity ?? "",
        });
      })
      .catch((e) => setMensagem({ texto: mensagemDe(e, "Não foi possível ler a conta."), tom: "mau" }));
    void avisosLigados().then(setAvisos);
    // A carteira (S22): só aparece quando a rota responde.
    pedir<Carteira>("/api/cliente/carteira")
      .then((c) => setCarteira(c && (c.linhas?.length || c.total) ? c : null))
      .catch(() => setCarteira(null));
  }, []);

  const campo = (k: string) => (v: string) => setF((a) => ({ ...a, [k]: v }));

  async function guardar() {
    setGuardando(true);
    setMensagem(null);
    try {
      const vazio = (k: string) => f[k]?.trim() || null;
      await pedir("/api/users/me", {
        metodo: "PATCH",
        corpo: {
          name: f.name?.trim() || undefined,
          phone: vazio("phone"),
          addressLine: vazio("addressLine"),
          nif: vazio("billingNif"),
          billingName: vazio("billingName"),
          billingNif: vazio("billingNif"),
          billingAddress: vazio("billingAddress"),
          billingPostalCode: vazio("billingPostalCode"),
          billingCity: vazio("billingCity"),
        },
      });
      setMensagem({ texto: "Guardado.", tom: "bom" });
    } catch (e) {
      setMensagem({ texto: mensagemDe(e, "Não foi possível guardar."), tom: "mau" });
    } finally {
      setGuardando(false);
    }
  }

  async function mudarNotificacao(chave: "notifOrderStatus" | "notifWeeklyDigest" | "notifWhatsapp", valor: boolean) {
    setConta((c) => (c ? { ...c, [chave]: valor } : c));
    try {
      await pedir("/api/users/me", { metodo: "PATCH", corpo: { [chave]: valor } });
    } catch (e) {
      setConta((c) => (c ? { ...c, [chave]: !valor } : c));
      setMensagem({ texto: mensagemDe(e, "Não foi possível guardar."), tom: "mau" });
    }
  }

  async function mudarAvisos(ligar: boolean) {
    setAvisoDosAvisos(null);
    if (ligar) {
      const r = await ligarAvisos();
      if (r.ok) setAvisos(true);
      else if (r.motivo === "recusou") setAvisoDosAvisos("A app não tem autorização para avisos. Autorize-a nas definições do telemóvel.");
      else setAvisoDosAvisos("Não foi possível ligar os avisos agora.");
    } else {
      await desligarAvisos(await lerToken());
      setAvisos(false);
    }
  }

  async function apagarConta() {
    setApagando(true);
    setErroAoApagar(null);
    try {
      await pedir("/api/users/me", { metodo: "DELETE", corpo: { confirmacao: "ELIMINAR" } });
      setAApagar(false);
      await sair();
    } catch (e) {
      setErroAoApagar(mensagemDe(e, "Não foi possível apagar a conta."));
    } finally {
      setApagando(false);
    }
  }

  async function sairDeTodos() {
    setErroDeTodos(null);
    try {
      await pedir("/api/cliente/sair-de-todos", { metodo: "POST" });
      setASairDeTodos(false);
      await sair();
    } catch (e) {
      setErroDeTodos(e instanceof ErroDaApi && e.estado === 404 ? "Ainda não é possível sair de todos os aparelhos pela app. Pode sair deste." : mensagemDe(e));
    }
  }

  const nome = conta?.name?.trim() || null;
  const iniciais = (nome ?? email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <Ecra>
      <VersaoNova />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: CORES.marcaSuave, alignItems: "center", justifyContent: "center" }}>
          <Text titulo style={{ color: CORES.marca, fontSize: 19, fontWeight: "700" }}>
            {iniciais}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text titulo style={{ color: CORES.tinta, fontSize: 18, fontWeight: "600" }} numberOfLines={1}>
            {nome ?? "A sua conta"}
          </Text>
          <Text style={{ color: CORES.suave, fontSize: 13 }} numberOfLines={1}>
            {email ? mascararEmail(email) : ""}
          </Text>
          <Text style={{ color: CORES.suave, fontSize: 12.5 }}>{entrada === "google" ? "Entrou com o Google" : "Entrou com o link por email"}</Text>
        </View>
      </View>

      {mensagem ? <Aviso texto={mensagem.texto} tom={mensagem.tom} /> : null}

      {conta ? (
        <>
          <Grupo titulo="Os seus dados">
            <View style={{ gap: 12, paddingVertical: 10 }}>
              <Campo rotulo="Nome" valor={f.name ?? ""} aoMudar={campo("name")} autoComplete="name" />
              <Campo rotulo="Telemóvel" valor={f.phone ?? ""} aoMudar={campo("phone")} keyboardType="phone-pad" autoComplete="tel" />
              <Campo rotulo="Morada habitual" valor={f.addressLine ?? ""} aoMudar={campo("addressLine")} autoComplete="street-address" />
            </View>
          </Grupo>
          <Grupo titulo="Faturação">
            <View style={{ gap: 12, paddingVertical: 10 }}>
              <Campo rotulo="Nome ou empresa" valor={f.billingName ?? ""} aoMudar={campo("billingName")} />
              <Campo rotulo="NIF para a fatura" valor={f.billingNif ?? ""} aoMudar={(v) => campo("billingNif")(v.replace(/[^\d]/g, "").slice(0, 9))} keyboardType="number-pad" />
              <Campo rotulo="Morada de faturação" valor={f.billingAddress ?? ""} aoMudar={campo("billingAddress")} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Campo rotulo="Código postal" valor={f.billingPostalCode ?? ""} aoMudar={campo("billingPostalCode")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Campo rotulo="Localidade" valor={f.billingCity ?? ""} aoMudar={campo("billingCity")} />
                </View>
              </View>
            </View>
          </Grupo>
          <Botao titulo="Guardar" tipo="secundario" ocupado={guardando} aoCarregar={() => void guardar()} />

          <Grupo titulo="Notificações">
            {avisos !== null ? <Interruptor titulo="Avisos no telemóvel" ligado={avisos} aoMudar={(v) => void mudarAvisos(v)} /> : null}
            <Interruptor titulo="Email quando o estado muda" ligado={comoBool(conta.notifOrderStatus)} aoMudar={(v) => void mudarNotificacao("notifOrderStatus", v)} />
            <Interruptor titulo="Resumo semanal por email" ligado={comoBool(conta.notifWeeklyDigest)} aoMudar={(v) => void mudarNotificacao("notifWeeklyDigest", v)} />
            <Interruptor titulo="WhatsApp" ligado={comoBool(conta.notifWhatsapp)} aoMudar={(v) => void mudarNotificacao("notifWhatsapp", v)} ultima />
          </Grupo>
          {avisoDosAvisos ? <Aviso texto={avisoDosAvisos} tom="mau" /> : null}
        </>
      ) : null}

      {carteira ? (
        <Grupo titulo="A minha carteira">
          <View style={{ paddingVertical: 10, gap: 8 }}>
            {(carteira.linhas ?? []).map((l, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ flex: 1, color: CORES.suave, fontSize: 13.5 }}>{l.rotulo}</Text>
                <Text style={{ color: CORES.tinta, fontSize: 13.5, fontWeight: "600" }}>{l.texto}</Text>
              </View>
            ))}
            {carteira.total ? (
              <Text titulo style={{ color: CORES.tinta, fontSize: 16, fontWeight: "700" }}>
                {[carteira.rotuloDoTotal, carteira.total].filter(Boolean).join(": ")}
              </Text>
            ) : null}
          </View>
        </Grupo>
      ) : null}

      <InformacaoUtil />

      <Grupo titulo="Segurança">
        <Linha icone="log-out-outline" titulo="Sair" texto="Os pedidos ficam na conta" aoCarregar={() => void sair()} />
        <Linha icone="phone-portrait-outline" titulo="Sair de todos os aparelhos" aoCarregar={() => setASairDeTodos(true)} />
        <Linha icone="trash-outline" titulo="Apagar a conta" texto="Pede confirmação antes" aoCarregar={() => setAApagar(true)} ultima />
      </Grupo>

      <Rodape />

      <Confirmacao
        visivel={aSairDeTodos}
        titulo="Sair de todos os aparelhos?"
        texto="A conta fecha em todos os telemóveis e navegadores onde está aberta, também neste."
        confirmar="Sair de todos"
        erro={erroDeTodos}
        aoConfirmar={() => void sairDeTodos()}
        aoVoltar={() => setASairDeTodos(false)}
      />
      <Confirmacao
        visivel={aApagar}
        titulo="Apagar a conta?"
        texto="Os seus pedidos ficam guardados até ao fim do prazo legal e deixa de os ver aqui."
        confirmar="Apagar a conta"
        perigo
        ocupado={apagando}
        erro={erroAoApagar}
        aoConfirmar={() => void apagarConta()}
        aoVoltar={() => setAApagar(false)}
      />
      <Ligacao titulo="Pedir orçamento" centrada aoCarregar={() => router.push("/pedir")} />
    </Ecra>
  );
}

export default function Perfil() {
  const { ligado } = useSessao();
  return ligado ? <ComConta /> : <SemConta />;
}
