import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { useSessao } from "../../estado/Sessao";
import { ErroDaApi, pedir } from "../../lib/api";
import { ESPACO, LETRA, useCores } from "../../tema";

/**
 * PALAVRA-PASSE — o ecrã «seguranca» do painel: mudar a palavra-passe e, à
 * parte, apagar a conta (a mesma rota e a mesma confirmação por escrito).
 */
const MINIMO = 10;

export default function EcraDaPalavraPasse() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  return (
    <ScrollView automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Mudar />
      <Apagar />
    </ScrollView>
  );
}

function Mudar() {
  const [actual, setActual] = useState("");
  const [nova, setNova] = useState("");
  const [ver, setVer] = useState(false);
  const [aMudar, setAMudar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  async function mudar() {
    setAMudar(true);
    setErro(null);
    setFeito(false);
    try {
      await pedir("/api/profissionais/palavra-passe", { metodo: "POST", corpo: { actual, nova } });
      setActual("");
      setNova("");
      setFeito(true);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível mudar");
    } finally {
      setAMudar(false);
    }
  }

  return (
    <Caixa>
      <CampoDeTexto
        rotulo="Palavra-passe actual"
        value={actual}
        onChangeText={setActual}
        secureTextEntry={!ver}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
      />
      <CampoDeTexto
        rotulo="Nova palavra-passe"
        value={nova}
        onChangeText={setNova}
        secureTextEntry={!ver}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        dica={`Pelo menos ${MINIMO} caracteres.`}
      />
      <Botao titulo={ver ? "Esconder" : "Mostrar o que escrevi"} tipo="secundario" aoCarregar={() => setVer(!ver)} />
      {erro ? <Mensagem texto={erro} /> : null}
      {feito ? <Mensagem tom="bom" texto="Palavra-passe mudada. Da próxima vez que entrar, use a nova." /> : null}
      <Botao
        titulo="Mudar palavra-passe"
        ocupado={aMudar}
        desactivado={!actual || nova.trim().length < MINIMO}
        aoCarregar={() => void mudar()}
      />
    </Caixa>
  );
}

function Apagar() {
  const c = useCores();
  const { sair } = useSessao();
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [aApagar, setAApagar] = useState(false);
  const [erro, setErro] = useState<{ texto: string; motivos: string[]; suspensa: boolean } | null>(null);

  async function apagar() {
    setAApagar(true);
    setErro(null);
    try {
      await pedir("/api/profissionais/conta", { metodo: "DELETE", corpo: { confirmacao: "ELIMINAR" } });
      await sair();
    } catch (e) {
      if (e instanceof ErroDaApi) {
        const motivos = Array.isArray(e.corpo.motivos) ? (e.corpo.motivos as string[]) : [];
        setErro({ texto: e.message, motivos, suspensa: e.corpo.suspensa === true });
      } else {
        setErro({ texto: "Não foi possível apagar a conta.", motivos: [], suspensa: false });
      }
    } finally {
      setAApagar(false);
    }
  }

  // Como no painel: uma linha no fim, em cinzento — a explicação está atrás do toque.
  if (!aberto) {
    return (
      <Text
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        style={{ color: c.suave, fontSize: LETRA.pequena + 1, textAlign: "center", textDecorationLine: "underline", marginTop: ESPACO.l }}
      >
        Apagar a conta
      </Text>
    );
  }
  return (
    <Caixa estilo={{ borderColor: c.mau }}>
      <TituloDaCaixa>Apagar a conta</TituloDaCaixa>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
        Deixa de receber pedidos e os seus dados são apagados: nome, email, telefone, NIF, IBAN e morada fiscal. Os trabalhos que já fez
        ficam sem o seu nome, porque os clientes que o contrataram continuam a ter direito ao histórico deles. Se tivermos dinheiro seu por
        pagar ou houver um trabalho por confirmar, isto pára e diz o que falta.
      </Text>
      <>
          <CampoDeTexto
            rotulo="Para confirmar, escreva ELIMINAR"
            value={confirmacao}
            onChangeText={setConfirmacao}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {erro ? (
            <Mensagem
              texto={[erro.texto, ...erro.motivos, erro.suspensa ? "A conta ficou suspensa: deixou de receber pedidos." : ""]
                .filter(Boolean)
                .join(" ")}
            />
          ) : null}
          <Botao
            titulo="Apagar a conta"
            tipo="perigo"
            ocupado={aApagar}
            desactivado={confirmacao.trim() !== "ELIMINAR"}
            aoCarregar={() => void apagar()}
          />
          <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setAberto(false)} />
      </>
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
});
