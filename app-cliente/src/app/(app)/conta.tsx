import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../../componentes/Texto";
import { Aviso, Botao, Campo, Cartao, Confirmacao, Ecra, Escolhas, Ligacao, Paragrafo, Subtitulo, Titulo } from "../../componentes/ui";
import { VersaoNova } from "../../componentes/VersaoNova";
import { useCatalogo } from "../../estado/Catalogo";
import { useSessao } from "../../estado/Sessao";
import { abrirNoNavegador, whatsappDaClyon } from "../../lib/abrir";
import { mensagemDe, pedir, versaoDestaApp } from "../../lib/api";
import { avisosLigados, desligarAvisos, ligarAvisos } from "../../lib/avisos";
import { lerToken } from "../../lib/sessao";
import { CORES } from "../../tema";

/**
 * E11 — CONTA.
 *
 * Os dados da conta (`GET`/`PATCH /api/users/me`, Bearer pela R3), os avisos no
 * telemóvel (R6), a frase única e as páginas do site, sair e apagar a conta.
 * Sair tira o telemóvel da conta no site, apaga o token, a lista guardada e o
 * rascunho, e deita fora o código do aparelho.
 */
type Conta = { name: string | null; phone: string | null; addressLine: string | null; nif: string | null };

export default function AConta() {
  const { email, entrada, sair } = useSessao();
  const { catalogo } = useCatalogo();
  const [conta, setConta] = useState<Conta | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [morada, setMorada] = useState("");
  const [nif, setNif] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tom: "bom" | "mau" } | null>(null);
  const [avisos, setAvisos] = useState<boolean | null>(null);
  const [avisoDosAvisos, setAvisoDosAvisos] = useState<string | null>(null);
  const [aApagar, setAApagar] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erroAoApagar, setErroAoApagar] = useState<string | null>(null);

  useEffect(() => {
    pedir<{ user?: Conta }>("/api/users/me")
      .then((r) => {
        const u = r.user ?? { name: null, phone: null, addressLine: null, nif: null };
        setConta(u);
        setNome(u.name ?? "");
        setTelefone(u.phone ?? "");
        setMorada(u.addressLine ?? "");
        setNif(u.nif ?? "");
      })
      .catch((e) => setMensagem({ texto: mensagemDe(e, "Não foi possível ler a conta."), tom: "mau" }));
    void avisosLigados().then(setAvisos);
  }, []);

  async function guardar() {
    setGuardando(true);
    setMensagem(null);
    try {
      await pedir("/api/users/me", {
        metodo: "PATCH",
        corpo: { name: nome.trim() || undefined, phone: telefone.trim() || null, addressLine: morada.trim() || null, nif: nif.trim() || null },
      });
      setMensagem({ texto: "Guardado.", tom: "bom" });
    } catch (e) {
      setMensagem({ texto: mensagemDe(e, "Não foi possível guardar."), tom: "mau" });
    } finally {
      setGuardando(false);
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

  return (
    <Ecra>
      <VersaoNova />
      <Titulo>Conta</Titulo>

      <Cartao>
        <Text style={{ color: CORES.suave, fontSize: 14 }}>Email</Text>
        <Text style={{ color: CORES.tinta, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
          {email ?? ""}
        </Text>
        <Text style={{ color: CORES.suave, fontSize: 13 }}>
          {entrada === "google" ? "Entrou com o Google" : "Entrou com o link por email"}
        </Text>
      </Cartao>

      {conta ? (
        <View style={{ gap: 12 }}>
          <Campo rotulo="Nome" valor={nome} aoMudar={setNome} autoComplete="name" />
          <Campo rotulo="Telemóvel" valor={telefone} aoMudar={setTelefone} keyboardType="phone-pad" autoComplete="tel" />
          <Campo rotulo="Morada habitual" valor={morada} aoMudar={setMorada} autoComplete="street-address" />
          <Campo rotulo="NIF para a fatura" valor={nif} aoMudar={(v) => setNif(v.replace(/[^\d]/g, "").slice(0, 9))} keyboardType="number-pad" />
          <Botao titulo="Guardar" tipo="secundario" ocupado={guardando} aoCarregar={() => void guardar()} />
        </View>
      ) : null}
      {mensagem ? <Aviso texto={mensagem.texto} tom={mensagem.tom} /> : null}

      <Subtitulo>Avisos no telemóvel</Subtitulo>
      {avisos !== null ? (
        <Escolhas
          opcoes={[
            { id: "sim", nome: "Ligados" },
            { id: "nao", nome: "Desligados" },
          ]}
          valor={avisos ? "sim" : "nao"}
          aoEscolher={(v) => void mudarAvisos(v === "sim")}
        />
      ) : null}
      {avisoDosAvisos ? <Aviso texto={avisoDosAvisos} tom="mau" /> : null}

      <Subtitulo>Sobre a CLYON</Subtitulo>
      {catalogo?.textos.fraseUnica ? <Paragrafo>{catalogo.textos.fraseUnica}</Paragrafo> : null}
      <Ligacao titulo="Como funciona" aoCarregar={() => abrirNoNavegador("/como-funciona")} />
      <Ligacao titulo="Ajuda — falar com a CLYON por WhatsApp" aoCarregar={() => whatsappDaClyon()} />
      <Ligacao titulo="Termos" aoCarregar={() => abrirNoNavegador("/termos")} />
      <Ligacao titulo="Privacidade" aoCarregar={() => abrirNoNavegador("/privacidade")} />

      <View style={{ gap: 12, marginTop: 8 }}>
        <Botao titulo="Sair" tipo="secundario" aoCarregar={() => void sair()} />
        <Ligacao titulo="Apagar a conta" tom="mau" centrada aoCarregar={() => setAApagar(true)} />
      </View>

      <Text style={{ color: CORES.suave, fontSize: 12, textAlign: "center" }}>
        {`Versão ${versaoDestaApp()}${Constants.expoConfig?.name ? ` · ${Constants.expoConfig.name}` : ""}`}
      </Text>

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
    </Ecra>
  );
}
