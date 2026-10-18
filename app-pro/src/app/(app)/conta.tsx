import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../../componentes/Texto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Caixa, Linha, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { useSessao } from "../../estado/Sessao";
import { ErroDaApi, pedir, SITE } from "../../lib/api";
import { estadoDaPermissao, ligarAvisos, type ResultadoDosAvisos } from "../../lib/avisos";
import { ESPACO, LETRA, useCores } from "../../tema";

type Perfil = { perfil?: { nome?: string; estado?: string; raioKm?: number | null; cidade?: string | null } };

const ESTADO_DA_CONTA: Record<string, string> = {
  aprovado: "Activa",
  pendente: "À espera de aprovação",
  rejeitado: "Não aprovada",
  suspenso: "Suspensa",
};

const PORQUE_NAO: Record<Exclude<ResultadoDosAvisos, { ok: true }>["motivo"], string> = {
  web: "Os avisos só funcionam na app instalada no telemóvel.",
  simulador: "Os avisos só funcionam num telemóvel a sério.",
  recusou: "Os avisos estão desligados nas definições do telemóvel. Ligue-os em Definições › Notificações › CLYON Pro.",
  "sem-projecto": "Esta versão de teste ainda não recebe avisos. Chegam com a versão instalada pela loja.",
  falhou: "Não foi possível ligar os avisos agora. Tente outra vez daqui a pouco.",
};

export default function Conta() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { nome, sair } = useSessao();
  const [perfil, setPerfil] = useState<Perfil["perfil"] | null>(null);
  const [permissao, setPermissao] = useState<string>("indisponivel");
  const [resultado, setResultado] = useState<ResultadoDosAvisos | null>(null);
  const [aLigar, setALigar] = useState(false);
  const [aSair, setASair] = useState(false);
  const [aTestar, setATestar] = useState(false);
  const [teste, setTeste] = useState<{ ok: boolean; texto: string } | null>(null);

  const lerPermissao = useCallback(() => void estadoDaPermissao().then(setPermissao).catch(() => {}), []);

  useEffect(() => {
    void pedir<Perfil>("/api/profissionais/perfil").then((r) => setPerfil(r.perfil ?? null)).catch(() => {});
    lerPermissao();
  }, [lerPermissao]);

  /** O site manda-lhe um aviso a ele próprio: a prova de que chegam. */
  async function enviarTeste() {
    setATestar(true);
    setTeste(null);
    try {
      const r = await pedir<{ entregue?: boolean }>("/api/profissionais/aviso-de-teste", { metodo: "POST" });
      setTeste(
        r.entregue
          ? { ok: true, texto: "Entregue a este telemóvel. Se não tocou, veja em Definições › Notificações › CLYON Pro." }
          : { ok: true, texto: "Enviado. A confirmação da entrega ainda não chegou; se não tocar dentro de um minuto, tente outra vez." },
      );
    } catch (e) {
      setTeste({ ok: false, texto: e instanceof ErroDaApi ? e.message : "Não foi possível enviar o aviso." });
    } finally {
      setATestar(false);
    }
  }

  async function aoLigar() {
    setALigar(true);
    setResultado(await ligarAvisos());
    setALigar(false);
    lerPermissao();
  }

  const raio = perfil?.raioKm != null ? `${perfil.raioKm} km à volta da sua base` : null;

  return (
    <ScrollView
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingTop: margens.top + ESPACO.l, paddingBottom: margens.bottom + ESPACO.xxl }]}
    >
      <Text style={[estilos.titulo, { color: c.tinta }]}>{perfil?.nome ?? nome ?? "A sua conta"}</Text>

      <Caixa>
        <TituloDaCaixa>A conta</TituloDaCaixa>
        <Linha rotulo="Estado" valor={perfil?.estado ? (ESTADO_DA_CONTA[perfil.estado] ?? perfil.estado) : null} />
        <Linha rotulo="Base" valor={perfil?.cidade ?? null} />
        <Linha rotulo="Onde trabalha" valor={raio} />
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
          Recebe os pedidos dos serviços que faz, dentro deste raio. Para o mudar, use o perfil no painel.
        </Text>
      </Caixa>

      <Caixa>
        <TituloDaCaixa>Avisos no telemóvel</TituloDaCaixa>
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 23 }}>
          {permissao === "concedida"
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
        {teste ? <Mensagem tom={teste.ok ? "bom" : "aviso"} texto={teste.texto} /> : null}
        {permissao !== "concedida" || (resultado && !resultado.ok) ? (
          <Botao titulo="Ligar os avisos" ocupado={aLigar} aoCarregar={aoLigar} />
        ) : (
          <Botao titulo="Enviar um aviso de teste" tipo="secundario" ocupado={aTestar} aoCarregar={enviarTeste} />
        )}
      </Caixa>

      <Caixa>
        <TituloDaCaixa>No site</TituloDaCaixa>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
          A carteira, a agenda e o perfil chegam à app nas próximas versões. Até lá estão no painel.
        </Text>
        <Botao titulo="Abrir o painel" tipo="secundario" aoCarregar={() => void Linking.openURL(`${SITE}/profissionais/painel`)} />
      </Caixa>

      <View style={{ gap: ESPACO.s }}>
        <Botao
          titulo="Sair"
          tipo="perigo"
          ocupado={aSair}
          aoCarregar={async () => {
            setASair(true);
            await sair();
          }}
        />
        <Text style={{ color: c.suave, fontSize: LETRA.pequena, textAlign: "center" }}>
          CLYON Pro {Constants.expoConfig?.version ?? ""}
        </Text>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pagina: { paddingHorizontal: ESPACO.l, gap: ESPACO.l },
  titulo: { fontSize: LETRA.grande, fontWeight: "800" },
});
