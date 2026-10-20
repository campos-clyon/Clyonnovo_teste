import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Mensagem } from "../../componentes/ui";
import { useConta } from "../../estado/Conta";
import { ErroDaApi, errosPorCampo, pedir } from "../../lib/api";
import { faltasEm, type Perfil } from "../../lib/conta";
import { horaCurta } from "../../lib/trabalhos";
import { ibanValido } from "../../../../src/lib/iban";
import { lerMbway } from "../../../../src/lib/mbway";
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
    <ScrollView
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
    </ScrollView>
  );
}

function Formulario({ perfil, aoGravar }: { perfil: Perfil; aoGravar: () => Promise<void> }) {
  const c = useCores();
  const [iban, setIban] = useState("");
  const [titular, setTitular] = useState(perfil.ibanTitular);
  const [mbway, setMbway] = useState(perfil.mbway);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [gravadoAs, setGravadoAs] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const faltas = faltasEm(perfil, "banco");

  async function gravar() {
    setErros({});
    setErro(null);
    setGravadoAs(null);
    // As mesmas verificações do site, antes de enviar: o erro aparece já, ao lado do campo.
    const locais: Record<string, string> = {};
    if (iban.trim() && !ibanValido(iban)) locais.iban = "IBAN inválido. Confirme os dígitos.";
    const m = lerMbway(mbway);
    if (!m.ok) locais.mbway = m.mensagem;
    if (Object.keys(locais).length > 0) {
      setErros(locais);
      return;
    }
    setAGravar(true);
    try {
      await pedir("/api/profissionais/perfil", {
        metodo: "PUT",
        corpo: { ...(iban.trim() ? { iban: iban.trim() } : {}), ibanTitular: titular.trim(), mbway: mbway.trim() },
      });
      setIban("");
      setGravadoAs(horaCurta(new Date().toISOString()));
      await aoGravar();
    } catch (e) {
      const porCampo = errosPorCampo(e);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) setErro(e instanceof ErroDaApi ? e.message : "Não foi possível guardar.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <>
      {faltas.length > 0 ? (
        <Mensagem tom="aviso" texto={`${faltas.length === 1 ? "Falta um campo" : `Faltam ${faltas.length} campos`} aqui: ${faltas.map((f) => f.rotulo.toLowerCase()).join(", ")}.`} />
      ) : null}
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
          erro={erros.iban}
        />
        <CampoDeTexto rotulo="Titular da conta" value={titular} onChangeText={setTitular} autoCapitalize="words" erro={erros.ibanTitular} />
        <CampoDeTexto
          rotulo="MB WAY (opcional)"
          value={mbway}
          onChangeText={setMbway}
          keyboardType="phone-pad"
          placeholder="9xx xxx xxx"
          dica="Outra forma de lhe pagarmos. Pode ser um número diferente do de contacto."
          erro={erros.mbway}
        />
      </Caixa>
      {erro ? <Mensagem texto={erro} /> : null}
      {gravadoAs ? <Mensagem tom="bom" texto={`Guardado às ${gravadoAs}.`} /> : null}
      <Botao titulo="Guardar conta" ocupado={aGravar} aoCarregar={() => void gravar()} />
    </>
  );
}

const estilos = StyleSheet.create({
  vazio: { flex: 1, alignItems: "center", justifyContent: "center" },
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
});
