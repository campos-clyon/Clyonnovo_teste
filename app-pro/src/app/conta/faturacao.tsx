import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Escolhas, FormularioComErros, GrupoComErro, Interruptor, Mensagem, TituloDaCaixa, useFormulario } from "../../componentes/ui";
import { useConta } from "../../estado/Conta";
import { escolherFotografias, reduzirFotografiaDaCandidatura } from "../../componentes/Fotografias";
import { enviarFicheiro, ErroDaApi, errosPorCampo, pedir } from "../../lib/api";
import {
  AJUDA_DA_GUIA,
  AJUDA_DA_PROVA_DA_GUIA,
  avisoDoCodigoApa,
  EXEMPLO_DO_CODIGO_APA,
  EXEMPLO_DO_DESTINO_DOS_RESIDUOS,
  MAXIMO_DO_DESTINO_DOS_RESIDUOS,
  MENSAGENS_DA_PROVA,
  ROTULO_DA_PROVA_DA_GUIA,
  ROTULO_DO_CODIGO_APA,
  ROTULO_DO_DESTINO_DOS_RESIDUOS,
} from "../../../../src/lib/guia-de-residuos";
import { diaEmLisboa } from "../../../../src/lib/hora-de-lisboa";
import { faltasEm, type Perfil } from "../../lib/conta";
import { horaCurta } from "../../lib/trabalhos";
import { linhaDoPerfilFiscal } from "../../lib/novo-modelo";
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

/** Os nomes curtos do aviso «Falta: …», pela ordem do ecrã (d9, 12-11-2026). */
const ROTULOS_DA_FATURACAO: Record<string, string> = {
  nif: "NIF",
  moradaFiscal: "morada fiscal",
  codigoPostalFiscal: "código postal",
  localidadeFiscal: "localidade",
  regimeIva: "regime de IVA",
  numeroTransportador: "código APA",
  destinoDosResiduos: "para onde leva o entulho",
};

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
  const [destino, setDestino] = useState(perfil.destinoDosResiduos ?? "");
  // d9: o que falta fica a vermelho, o ecrã desce até ao primeiro e o aviso diz o quê.
  const formulario = useFormulario(ROTULOS_DA_FATURACAO);
  const erros = formulario.erros;
  const [erro, setErro] = useState<string | null>(null);
  const [gravadoAs, setGravadoAs] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const faltas = faltasEm(perfil, "faturacao");

  async function gravar() {
    setAGravar(true);
    formulario.limparErros();
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
          // O destino do entulho (d5): só segue quando muda, e só com a guia ligada (como no painel).
          ...(emiteGuia && destino.trim() !== (perfil.destinoDosResiduos ?? "").trim() ? { destinoDosResiduos: destino.trim() } : {}),
        },
      });
      setGravadoAs(horaCurta(new Date().toISOString()));
      await aoGravar();
    } catch (e) {
      const porCampo = errosPorCampo(e);
      formulario.mostrarErros(porCampo);
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
      {perfil.novoModelo ? <PerfilFiscal perfil={perfil} /> : null}
      {perfil.emiteGuiaTransporte && !perfil.guiaVerificada ? (
        <Mensagem tom="aviso" texto="A sua guia de transporte está ainda por verificar do nosso lado." />
      ) : null}

      <Caixa>
        <Interruptor rotulo="Emito fatura" valor={emiteFatura} aoMudar={setEmiteFatura} />
        <CampoDeTexto rotulo="NIF" value={nif} onChangeText={setNif} keyboardType="number-pad" maxLength={9} campo="nif" />
        <CampoDeTexto rotulo="Morada fiscal" value={morada} onChangeText={setMorada} placeholder="Rua e número" campo="moradaFiscal" />
        <View style={estilos.lado}>
          <View style={{ width: 130 }}>
            <CampoDeTexto
              rotulo="Código postal"
              value={codigoPostal}
              onChangeText={setCodigoPostal}
              keyboardType="numbers-and-punctuation"
              placeholder="0000-000"
              maxLength={8}
              campo="codigoPostalFiscal"
            />
          </View>
          <View style={{ flex: 1 }}>
            <CampoDeTexto rotulo="Localidade" value={localidade} onChangeText={setLocalidade} campo="localidadeFiscal" />
          </View>
        </View>
        {/* No modelo de 15-11 (d10) o regime diz ao cliente que fatura recebe: pergunta-se sempre. */}
        {emiteFatura || perfil.novoModelo ? (
          <GrupoComErro campo="regimeIva">
            <Text style={{ color: c.tinta, fontWeight: "600" }}>Regime de IVA</Text>
            <Escolhas
              opcoes={[
                { valor: "isento", rotulo: "Isento (art. 53.º)" },
                { valor: "normal", rotulo: "Normal — 23 %" },
              ]}
              valor={regime}
              aoEscolher={setRegime}
            />
          </GrupoComErro>
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
          <>
            {/* A guia de resíduos (d5, 12-11-2026): os textos e as regras são os do site (guia-de-residuos.ts). */}
            <CampoDeTexto
              rotulo={ROTULO_DO_CODIGO_APA}
              value={transportador}
              onChangeText={setTransportador}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={EXEMPLO_DO_CODIGO_APA}
              campo="numeroTransportador"
              dica={
                perfil.guiaVerificada
                  ? "Verificado. Mudar o código volta a pô-lo por verificar."
                  : "Ainda por verificar do nosso lado."
              }
            />
            {/* O formato avisa e não bloqueia. */}
            {avisoDoCodigoApa(transportador) ? (
              <Text style={{ color: c.aviso, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{avisoDoCodigoApa(transportador)}</Text>
            ) : null}
            <ProvaDaGuia prova={perfil.provaDaGuia ?? null} aoMudar={aoGravar} />
            <CampoDeTexto
              rotulo={ROTULO_DO_DESTINO_DOS_RESIDUOS}
              value={destino}
              onChangeText={setDestino}
              placeholder={EXEMPLO_DO_DESTINO_DOS_RESIDUOS}
              maxLength={MAXIMO_DO_DESTINO_DOS_RESIDUOS}
              campo="destinoDosResiduos"
            />
            <AjudaDaGuia />
          </>
        ) : null}
      </Caixa>

      {erro ? <Mensagem texto={erro} /> : null}
      {formulario.aviso ? <Mensagem texto={formulario.aviso} /> : null}
      {gravadoAs ? <Mensagem tom="bom" texto={`Guardado às ${gravadoAs}.`} /> : null}
      <Botao titulo="Guardar" ocupado={aGravar} aoCarregar={() => void gravar()} />
    </FormularioComErros>
  );
}

/**
 * O PERFIL FISCAL — d10, o modelo de 15-11-2026. Cada profissional fatura o seu
 * trabalho ao cliente, e o cliente vê, ao escolher, o tipo de fatura e se emite
 * a guia de resíduos (`perfil-fiscal.ts`). O regime só conta como confirmado
 * depois de ele o gravar aqui; até lá o cliente lê «a confirmar».
 */
function PerfilFiscal({ perfil }: { perfil: Perfil }) {
  const c = useCores();
  const nm = perfil.novoModelo;
  if (!nm) return null;
  return (
    <Caixa>
      <TituloDaCaixa>O que o cliente vê ao escolher</TituloDaCaixa>
      <Text style={{ color: c.tinta, fontSize: LETRA.normal, fontWeight: "700" }}>{linhaDoPerfilFiscal(nm.perfilFiscal)}</Text>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
        O cliente paga-lhe o trabalho diretamente e recebe duas faturas: a sua, do trabalho, e a da taxa da plataforma.
      </Text>
      {!nm.regimeIvaConfirmado ? (
        <Mensagem tom="aviso" texto="Confirme o seu regime de IVA: escolha-o em baixo e carregue em Guardar." />
      ) : null}
    </Caixa>
  );
}

/** «12/11/2026», o dia em Lisboa. */
function diaCurto(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const [a, m, dia] = diaEmLisboa(d).split("-");
  return `${dia}/${m}/${a}`;
}

/**
 * A PROVA DO REGISTO NO SILiAmb — d5, 12-11-2026, como no painel
 * (`ProvaDaGuia`, Perfil.tsx). Sobe para `/api/profissionais/prova-da-guia`
 * (campo `file`), apaga-se com DELETE na mesma rota. Só a administração a
 * abre: a app só vê o nome e a data. Na app vai uma fotografia ou uma captura
 * de ecrã (da galeria); o PDF envia-se pelo painel do site.
 */
function ProvaDaGuia({ prova, aoMudar }: { prova: { nome: string | null; em: string } | null; aoMudar: () => Promise<void> }) {
  const c = useCores();
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function enviar(origem: "camara" | "galeria") {
    setErro(null);
    setFeito(null);
    const r = await escolherFotografias(origem, 1);
    if ("erro" in r) return setErro(r.erro);
    const a = r.fotografias[0];
    if (!a) return;
    setAEnviar(true);
    try {
      const f = await reduzirFotografiaDaCandidatura(a);
      const d = await enviarFicheiro<{ provaDaGuia?: unknown }>("/api/profissionais/prova-da-guia", {}, f);
      if (!d.provaDaGuia) throw new Error("sem prova");
      setFeito(MENSAGENS_DA_PROVA.enviada);
      await aoMudar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : MENSAGENS_DA_PROVA.falhou);
    } finally {
      setAEnviar(false);
    }
  }

  async function apagar() {
    setErro(null);
    setFeito(null);
    setAEnviar(true);
    try {
      await pedir("/api/profissionais/prova-da-guia", { metodo: "DELETE" });
      await aoMudar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível apagar.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.tinta, fontWeight: "600", fontSize: LETRA.normal }}>{ROTULO_DA_PROVA_DA_GUIA}</Text>
      {prova ? (
        <View style={estilos.lado}>
          <Text style={{ flex: 1, color: c.tinta, fontSize: LETRA.pequena + 1 }}>
            Enviada{prova.nome ? ` (${prova.nome})` : ""} a {diaCurto(prova.em)}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void apagar()} disabled={aEnviar} hitSlop={8}>
            <Text style={{ color: c.mau, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>Apagar</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={estilos.lado}>
        <View style={{ flex: 1 }}>
          <Botao titulo="Fotografar" tipo="secundario" ocupado={aEnviar} aoCarregar={() => void enviar("camara")} />
        </View>
        <View style={{ flex: 1 }}>
          <Botao titulo="Da galeria" tipo="secundario" ocupado={aEnviar} aoCarregar={() => void enviar("galeria")} />
        </View>
      </View>
      {feito ? <Text style={{ color: c.bom, fontSize: LETRA.pequena + 1 }}>{feito}</Text> : null}
      {erro ? <Text style={{ color: c.mau, fontSize: LETRA.pequena + 1 }}>{erro}</Text> : null}
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{AJUDA_DA_PROVA_DA_GUIA}</Text>
    </View>
  );
}

/** O texto A do Jurídico, fechado por omissão (como o `AjudaDaGuia` do painel). */
function AjudaDaGuia() {
  const c = useCores();
  const [aberta, setAberta] = useState(false);
  const texto = { color: c.tinta, fontSize: LETRA.pequena + 1, lineHeight: 19 } as const;
  return (
    <View style={[estilos.ajuda, { borderColor: c.linha, backgroundColor: c.fundo }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: aberta }} onPress={() => setAberta((v) => !v)}>
        <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 2 }}>{AJUDA_DA_GUIA.titulo}</Text>
      </Pressable>
      {aberta ? (
        <View style={{ gap: 6 }}>
          <Text style={texto}>{AJUDA_DA_GUIA.abertura}</Text>
          {AJUDA_DA_GUIA.passos.map((p, i) => (
            <Text key={p} style={texto}>
              {i + 1}. {p}
            </Text>
          ))}
          <Text style={texto}>{AJUDA_DA_GUIA.privacidade}</Text>
          <Text style={texto}>{AJUDA_DA_GUIA.eGar}</Text>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  ajuda: { borderWidth: 1, borderRadius: 12, padding: ESPACO.m, gap: ESPACO.s },
  vazio: { flex: 1, alignItems: "center", justifyContent: "center" },
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
  lado: { flexDirection: "row", gap: ESPACO.s, alignItems: "flex-start" },
});
