import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Escolhas, Interruptor, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { useConta } from "../../estado/Conta";
import { ErroDaApi, errosPorCampo, pedir } from "../../lib/api";
import { faltasEm, type Perfil } from "../../lib/conta";
import { horaCurta } from "../../lib/trabalhos";
import { ESPACO, LETRA, useCores } from "../../tema";

/**
 * FATURAÇÃO E IVA — o ecrã «faturacao» do painel: se emite fatura, o NIF, a
 * morada fiscal, o regime de IVA e a guia de transporte de resíduos.
 *
 * ⚠️ A GUIA SÓ SEGUE QUANDO MUDA. Mandar `emiteGuiaTransporte` ou
 * `numeroTransportador` faz o site voltar a pôr a guia «por verificar» — o
 * painel manda-os sempre e desfaz a verificação a cada gravação. Aqui só
 * seguem quando ele os mudou.
 */
export default function EcraDaFaturacao() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const { perfil, recarregarPerfil } = useConta();
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
      <Formulario perfil={perfil} aoGravar={recarregarPerfil} />
    </RolagemComTeclado>
  );
}

function Formulario({ perfil, aoGravar }: { perfil: Perfil; aoGravar: () => Promise<void> }) {
  const c = useCores();
  const [emiteFatura, setEmiteFatura] = useState(perfil.emiteFatura);
  const [nif, setNif] = useState(perfil.nif);
  const [morada, setMorada] = useState(perfil.moradaFiscal);
  const [codigoPostal, setCodigoPostal] = useState(perfil.codigoPostalFiscal);
  const [localidade, setLocalidade] = useState(perfil.localidadeFiscal);
  const [regime, setRegime] = useState<"isento" | "normal">(perfil.regimeIva === "normal" ? "normal" : "isento");
  const [emiteGuia, setEmiteGuia] = useState(perfil.emiteGuiaTransporte);
  const [transportador, setTransportador] = useState(perfil.numeroTransportador);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [gravadoAs, setGravadoAs] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const faltas = faltasEm(perfil, "faturacao");

  async function gravar() {
    setAGravar(true);
    setErros({});
    setErro(null);
    setGravadoAs(null);
    const guiaMudou = emiteGuia !== perfil.emiteGuiaTransporte || transportador.trim() !== perfil.numeroTransportador;
    try {
      await pedir("/api/profissionais/perfil", {
        metodo: "PUT",
        corpo: {
          emiteFatura,
          nif: nif.trim(),
          moradaFiscal: morada.trim(),
          codigoPostalFiscal: codigoPostal.trim(),
          localidadeFiscal: localidade.trim(),
          regimeIva: regime,
          ...(guiaMudou ? { emiteGuiaTransporte: emiteGuia, numeroTransportador: transportador.trim() } : {}),
        },
      });
      setGravadoAs(horaCurta(new Date().toISOString()));
      await aoGravar();
    } catch (e) {
      const porCampo = errosPorCampo(e);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) setErro(e instanceof ErroDaApi ? e.message : "Não foi possível guardar.");
      else setErro("Há campos por corrigir — veja a vermelho.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <>
      {faltas.length > 0 ? (
        <Mensagem tom="aviso" texto={`${faltas.length === 1 ? "Falta um campo" : `Faltam ${faltas.length} campos`} aqui: ${faltas.map((f) => f.rotulo.toLowerCase()).join(", ")}.`} />
      ) : null}
      {perfil.emiteGuiaTransporte && !perfil.guiaVerificada ? (
        <Mensagem tom="aviso" texto="A sua guia de transporte está ainda por verificar do nosso lado." />
      ) : null}

      <Caixa>
        <Interruptor rotulo="Emito fatura" valor={emiteFatura} aoMudar={setEmiteFatura} />
        <CampoDeTexto rotulo="NIF" value={nif} onChangeText={setNif} keyboardType="number-pad" maxLength={9} erro={erros.nif} />
        <CampoDeTexto rotulo="Morada fiscal" value={morada} onChangeText={setMorada} placeholder="Rua e número" erro={erros.moradaFiscal} />
        <View style={estilos.lado}>
          <View style={{ width: 130 }}>
            <CampoDeTexto
              rotulo="Código postal"
              value={codigoPostal}
              onChangeText={setCodigoPostal}
              keyboardType="numbers-and-punctuation"
              placeholder="0000-000"
              maxLength={8}
              erro={erros.codigoPostalFiscal}
            />
          </View>
          <View style={{ flex: 1 }}>
            <CampoDeTexto rotulo="Localidade" value={localidade} onChangeText={setLocalidade} erro={erros.localidadeFiscal} />
          </View>
        </View>
        {emiteFatura ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: c.tinta, fontWeight: "600" }}>Regime de IVA</Text>
            <Escolhas
              opcoes={[
                { valor: "isento", rotulo: "Isento (art. 53.º)" },
                { valor: "normal", rotulo: "Normal — 23 %" },
              ]}
              valor={regime}
              aoEscolher={setRegime}
            />
            {erros.regimeIva ? <Text style={{ color: c.mau }}>{erros.regimeIva}</Text> : null}
          </View>
        ) : null}
      </Caixa>

      <Caixa>
        <TituloDaCaixa>Resíduos</TituloDaCaixa>
        <Interruptor
          rotulo="Emito guia de transporte de resíduos"
          dica="Obrigatória para entulho e monos. Verificamos o número."
          valor={emiteGuia}
          aoMudar={setEmiteGuia}
        />
        {emiteGuia ? (
          <CampoDeTexto
            rotulo="Número de registo de transportador"
            value={transportador}
            onChangeText={setTransportador}
            autoCapitalize="characters"
            erro={erros.numeroTransportador}
            dica={
              perfil.guiaVerificada
                ? "Verificado. Mudar o número volta a pô-lo por verificar."
                : "Ainda por verificar do nosso lado."
            }
          />
        ) : null}
      </Caixa>

      {erro ? <Mensagem texto={erro} /> : null}
      {gravadoAs ? <Mensagem tom="bom" texto={`Guardado às ${gravadoAs}.`} /> : null}
      <Botao titulo="Guardar" ocupado={aGravar} aoCarregar={() => void gravar()} />
    </>
  );
}

const estilos = StyleSheet.create({
  vazio: { flex: 1, alignItems: "center", justifyContent: "center" },
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
  lado: { flexDirection: "row", gap: ESPACO.s, alignItems: "flex-start" },
});
