import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, FormularioComErros, Mensagem, useFormulario } from "../../componentes/ui";
import { useConta } from "../../estado/Conta";
import { contaSemPalavraPasse, eDaPalavraPasse, ErroDaApi, errosPorCampo, pedir } from "../../lib/api";
import { faltasEm, type Perfil } from "../../lib/conta";
import { horaCurta } from "../../lib/trabalhos";
import { ibanValido } from "../../../../src/lib/iban";
import { lerMbway } from "../../../../src/lib/mbway";
import {
  CAMPO_DA_PALAVRA_PASSE,
  camposDePagamentoMudados,
  haQuantoTempo,
  mudancaDosDadosDePagamento,
} from "../../../../src/lib/dados-de-pagamento-mudados";
import { ESPACO, LETRA, useCores } from "../../tema";

/**
 * CONTA BANCÁRIA — o ecrã «banco» do painel. O IBAN inteiro nunca vem do site
 * (só «PT50 ···· 3233»): o campo fica vazio, e só segue se ele escrever um
 * novo. O MB WAY é outra forma de a CLYON lhe pagar, ao lado do IBAN e não em
 * vez dele (o backoffice mostra os dois na carteira) — o texto é o do painel.
 */
export default function EcraDoBanco() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { perfil, recarregarPerfil, recarregarCarteira } = useConta();
  if (!perfil) {
    return (
      <View style={[estilos.vazio, { backgroundColor: c.fundo }]}>
        <Text style={{ color: c.suave }}>A carregar…</Text>
      </View>
    );
  }
  return (
    <RolagemComTeclado
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Formulario
        perfil={perfil}
        aoGravar={async () => {
          await recarregarPerfil();
          await recarregarCarteira();
        }}
      />
    </RolagemComTeclado>
  );
}

/** Os nomes curtos do aviso «Falta: …», pela ordem do ecrã. */
const ROTULOS_DO_BANCO: Record<string, string> = {
  iban: "IBAN (confirme os dígitos)",
  ibanTitular: "titular da conta",
  mbway: "MB WAY",
  palavraPasse: "a sua palavra-passe",
};

/*
 * As frases da palavra-passe são as do site (a rota do perfil e o painel, d1,
 * 12-11-2026): há um teste que as compara.
 */
const FALTA_A_PALAVRA_PASSE = "Para mudar o IBAN, o titular ou o MB WAY, confirme com a sua palavra-passe.";
const AJUDA_DA_PALAVRA_PASSE =
  "Só é pedida quando muda o IBAN, o titular ou o MB WAY. Enviamos-lhe um email a confirmar a mudança.";

function Formulario({ perfil, aoGravar }: { perfil: Perfil; aoGravar: () => Promise<void> }) {
  const c = useCores();
  const [iban, setIban] = useState("");
  const [titular, setTitular] = useState(perfil.ibanTitular);
  const [mbway, setMbway] = useState(perfil.mbway);
  const [palavraPasse, setPalavraPasse] = useState("");
  const [semPalavraPasse, setSemPalavraPasse] = useState(false);
  const formulario = useFormulario(ROTULOS_DO_BANCO);
  const [erro, setErro] = useState<string | null>(null);
  const [gravadoAs, setGravadoAs] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const faltas = faltasEm(perfil, "banco");

  /*
   * A PALAVRA-PASSE PARA MUDAR ONDE SE RECEBE — 12-11-2026 (decisão d1).
   * Mudar o IBAN, o titular ou o MB WAY pede a palavra-passe da conta, como
   * no painel: o campo aparece logo que um deles muda DE FACTO (a conta do
   * site, `camposDePagamentoMudados`), e só segue o que mudou. O IBAN vem
   * encurtado do site: escrito, conta como mudado.
   */
  const mudados = [
    ...(iban.trim() ? (["iban"] as const) : []),
    ...camposDePagamentoMudados({ ibanTitular: perfil.ibanTitular, mbway: perfil.mbway }, { ibanTitular: titular, mbway }),
  ];
  const mudancas = {
    ...(mudados.includes("iban") ? { iban: iban.trim() } : {}),
    ...(mudados.includes("ibanTitular") ? { ibanTitular: titular.trim() } : {}),
    ...(mudados.includes("mbway") ? { mbway: mbway.trim() } : {}),
  };
  const pedeAPalavraPasse = mudados.length > 0;

  async function gravar() {
    formulario.limparErros();
    setErro(null);
    setGravadoAs(null);
    setSemPalavraPasse(false);
    if (!pedeAPalavraPasse) {
      setErro("Não há nada novo para guardar.");
      return;
    }
    // As mesmas verificações do site, antes de enviar: o erro aparece já, ao lado do campo.
    const locais: Record<string, string> = {};
    if (iban.trim() && !ibanValido(iban)) locais.iban = "IBAN inválido. Confirme os dígitos.";
    const m = lerMbway(mbway);
    if (!m.ok) locais.mbway = m.mensagem;
    if (!palavraPasse) locais.palavraPasse = FALTA_A_PALAVRA_PASSE;
    if (Object.keys(locais).length > 0) {
      formulario.mostrarErros(locais);
      return;
    }
    setAGravar(true);
    try {
      await pedir("/api/profissionais/perfil", { metodo: "PUT", corpo: { ...mudancas, [CAMPO_DA_PALAVRA_PASSE]: palavraPasse } });
      setIban("");
      setPalavraPasse("");
      setGravadoAs(horaCurta(new Date().toISOString()));
      await aoGravar();
    } catch (e) {
      const porCampo = errosPorCampo(e);
      // O 401 com `codigo` é o da palavra-passe (falta, errada, ou a conta não tem): a frase do site vai para o campo.
      if (e instanceof ErroDaApi && e.estado === 401 && eDaPalavraPasse(e.corpo)) {
        porCampo.palavraPasse = e.message;
        setSemPalavraPasse(contaSemPalavraPasse(e.corpo));
      }
      formulario.mostrarErros(porCampo);
      // O 429 (muitas tentativas) e o resto: a frase da rota, por cima do botão.
      if (Object.keys(porCampo).length === 0) setErro(e instanceof ErroDaApi ? e.message : "Não foi possível guardar.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <FormularioComErros formulario={formulario}>
      {faltas.length > 0 ? (
        <Mensagem tom="aviso" texto={`${faltas.length === 1 ? "Falta um campo" : `Faltam ${faltas.length} campos`} aqui: ${faltas.map((f) => f.rotulo.toLowerCase()).join(", ")}.`} />
      ) : null}
      <AvisoDosDadosDePagamento em={perfil.ibanMudadoEm ?? null} titularBate={perfil.titularBateComONome ?? null} />
      {perfil.temIban ? (
        <Caixa>
          <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>A receber em</Text>
          <Text style={{ color: c.tinta, fontWeight: "800", fontSize: LETRA.media }}>
            {perfil.iban}
            {perfil.ibanTitular ? ` · ${perfil.ibanTitular}` : ""}
          </Text>
        </Caixa>
      ) : null}
      <Caixa>
        <CampoDeTexto
          rotulo={perfil.temIban ? "Novo IBAN" : "IBAN"}
          value={iban}
          onChangeText={setIban}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="PT50 0000 0000 0000 0000 0000 0"
          dica={perfil.temIban ? "Deixe vazio para manter o que está." : null}
          campo="iban"
        />
        <CampoDeTexto rotulo="Titular da conta" value={titular} onChangeText={setTitular} autoCapitalize="words" campo="ibanTitular" />
        <CampoDeTexto
          rotulo="MB WAY (opcional)"
          value={mbway}
          onChangeText={setMbway}
          keyboardType="phone-pad"
          placeholder="9xx xxx xxx"
          dica="Outra forma de lhe pagarmos. Pode ser um número diferente do de contacto."
          campo="mbway"
        />
      </Caixa>
      {pedeAPalavraPasse ? (
        <Caixa>
          <CampoDeTexto
            rotulo="A sua palavra-passe"
            value={palavraPasse}
            onChangeText={setPalavraPasse}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            dica={AJUDA_DA_PALAVRA_PASSE}
            campo="palavraPasse"
          />
          {semPalavraPasse ? (
            <Botao
              titulo="Esqueci-me da palavra-passe"
              tipo="secundario"
              aoCarregar={() => router.push({ pathname: "/repor", params: { email: perfil.email } })}
            />
          ) : null}
        </Caixa>
      ) : null}
      {erro ? <Mensagem texto={erro} /> : null}
      {formulario.aviso ? <Mensagem texto={formulario.aviso} /> : null}
      {gravadoAs ? <Mensagem tom="bom" texto={`Guardado às ${gravadoAs}.`} /> : null}
      <Botao titulo="Guardar conta" ocupado={aGravar} aoCarregar={() => void gravar()} />
    </FormularioComErros>
  );
}

/**
 * OS DADOS DE PAGAMENTO MUDARAM — d1, 12-11-2026, como no painel
 * (`AvisoDosDadosDePagamento`, Perfil.tsx): «IBAN mudado há X dias» (em âmbar
 * nos primeiros 7) e o titular que não bate com o nome. Se não foi ele, é
 * aqui que dá por isso.
 */
function AvisoDosDadosDePagamento({ em, titularBate }: { em: string | null; titularBate: boolean | null }) {
  const c = useCores();
  const data = em ? new Date(em) : null;
  const mudanca = mudancaDosDadosDePagamento(data);
  if (!mudanca && titularBate !== false) return null;
  return (
    <>
      {mudanca && mudanca.recente ? (
        <Mensagem
          tom="aviso"
          texto={`IBAN mudado ${haQuantoTempo(mudanca.dias)} (IBAN, titular ou MB WAY). Se não reconhece esta mudança, fale connosco já.`}
        />
      ) : mudanca ? (
        <Caixa>
          <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>
            IBAN mudado {haQuantoTempo(mudanca.dias)} (IBAN, titular ou MB WAY). Se não reconhece esta mudança, fale connosco já.
          </Text>
        </Caixa>
      ) : null}
      {titularBate === false ? (
        <Mensagem
          tom="aviso"
          texto="O titular não bate com o nome da conta. Confirme o nome tal como está no banco: uma transferência para um nome que não confere pode ser devolvida."
        />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  vazio: { flex: 1, alignItems: "center", justifyContent: "center" },
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
});
