import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CaixaComErro, CampoDeTexto, FormularioComErros, Interruptor, Mensagem, TituloDaCaixa, useFormulario } from "../../componentes/ui";
import { ErroDaApi, errosPorCampo, pedir } from "../../lib/api";
import { euros } from "../../lib/trabalhos";
import {
  EXEMPLO_DA_MUDANCA,
  MATERIAIS,
  REGRAS_DAS_MUDANCAS,
  congelarTarifa,
  validarTarifa,
  valorDaMudanca,
  type ChaveDoMaterial,
  type RegrasDaConta,
  type TarifaDasMudancas,
} from "../../../../src/lib/conta-da-mudanca";
import { dataEHoraEmLisboa } from "../../../../src/lib/hora-de-lisboa";
import {
  TEXTOS_DOS_PRECOS_DAS_MUDANCAS as TEXTOS,
  avisoDasTresPessoas,
  dicaDoInterruptor,
  interruptorAoAbrir,
  mensagemDeGravado,
} from "../../../../src/lib/precos-das-mudancas-do-profissional";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * OS PREÇOS DAS MUDANÇAS — 10-11-2026 (fase 1), o ecrã «precos-mudancas» do
 * painel (`PrecosDasMudancas.tsx`).
 *
 * O profissional escreve o preço da hora da equipa (2 e 3 pessoas), o mínimo
 * de horas, os km e o material. Por baixo, a conta de um exemplo feita com a
 * MESMA função do site (`valorDaMudanca`, importada de `src/lib`), com as
 * regras que o site manda no GET: nenhuma taxa nem IVA está escrito aqui.
 *
 * `GET/PUT /api/profissionais/tarifas-mudancas`. Euros sem IVA; null = «não
 * forneço» (ou, na hora com 3, «não faço com 3»).
 *
 * 11-11-2026 (d4): a lista está aberta aos clientes. Os textos e as regras são
 * os de `precos-das-mudancas-do-profissional.ts`, os mesmos do painel: o
 * interruptor «Aparecer na lista» nasce ligado para quem tem «Mudanças» e
 * ainda não gravou, a hora de 3 pessoas de fora avisa que fica fora dos T3 ou
 * maiores, e depois de gravar diz-se a frase que a rota manda (quem ficou
 * fora da lista fica a sabê-lo).
 */

type Chave =
  | "precoHora2"
  | "precoHora3"
  | "minimoHoras"
  | "precoKm"
  | "kmMinimo"
  | "kmMaximo"
  | ChaveDoMaterial;

/** Os campos que se podem deixar de fora (o «Não forneço» / «Não faço com 3»). */
type Opcional = "precoHora3" | ChaveDoMaterial;

type Campos = Record<Chave, string>;

const VAZIO: Campos = {
  precoHora2: "",
  precoHora3: "",
  minimoHoras: "",
  precoKm: "",
  kmMinimo: "",
  kmMaximo: "",
  caixa: "",
  cartaoMetro: "",
  filmeRolo: "",
  plasticoBolhaRolo: "",
};

const SEM_NADA_DE_FORA: Record<Opcional, boolean> = {
  precoHora3: false,
  caixa: false,
  cartaoMetro: false,
  filmeRolo: false,
  plasticoBolhaRolo: false,
};

type TarifaGravada = TarifaDasMudancas & { actualizadoEm?: string | null };

type RespostaDoGet = {
  tarifa: TarifaGravada | null;
  podeAparecerNaLista: boolean;
  /** Desde 11-11-2026: como o interruptor aparece ao abrir. Um site de antes não o manda. */
  interruptorAoAbrir?: boolean;
  regras?: { taxaDaPlataforma: number; modoDaTaxa: string; materialComIva: boolean; iva: number };
};

const paraOCampo = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const doCentimo = (c: number) => euros(c / 100);
const percentagem = (f: number) => `${Math.round(f * 1000) / 10} %`.replace(".", ",");

/** Os nomes curtos do aviso «Falta: …», pela ordem do ecrã (d9, 12-11-2026). */
const ROTULOS_DAS_MUDANCAS: Record<string, string> = {
  precoHora2: "hora com 2 pessoas",
  precoHora3: "hora com 3 pessoas",
  minimoHoras: "mínimo de horas",
  precoKm: "preço do km",
  kmMinimo: "km mínimos por trabalho",
  kmMaximo: "distância máxima",
  ...Object.fromEntries(MATERIAIS.map((m) => [m.chave, m.nome.toLowerCase()])),
  aparecerNaLista: "aparecer na lista",
};

export default function EcraDosPrecosDasMudancas() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const [campos, setCampos] = useState<Campos>(VAZIO);
  const [deFora, setDeFora] = useState<Record<Opcional, boolean>>(SEM_NADA_DE_FORA);
  const [naLista, setNaLista] = useState(false);
  const [podeAparecer, setPodeAparecer] = useState(false);
  const [regras, setRegras] = useState<RegrasDaConta>(REGRAS_DAS_MUDANCAS);
  const [actualizadoEm, setActualizadoEm] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  // d9: o que falta fica a vermelho, o ecrã desce até ao primeiro e o aviso diz o quê.
  const formulario = useFormulario(ROTULOS_DAS_MUDANCAS);
  const erros = formulario.erros;
  const [erro, setErro] = useState<string | null>(null);
  const [gravado, setGravado] = useState<string | null>(null);

  function encher(t: TarifaGravada | null) {
    if (!t) return;
    setCampos({
      precoHora2: paraOCampo(t.precoHora2),
      precoHora3: paraOCampo(t.precoHora3),
      minimoHoras: paraOCampo(t.minimoHoras),
      precoKm: paraOCampo(t.precoKm),
      kmMinimo: paraOCampo(t.kmMinimo),
      kmMaximo: paraOCampo(t.kmMaximo),
      caixa: paraOCampo(t.caixa),
      cartaoMetro: paraOCampo(t.cartaoMetro),
      filmeRolo: paraOCampo(t.filmeRolo),
      plasticoBolhaRolo: paraOCampo(t.plasticoBolhaRolo),
    });
    setDeFora({
      precoHora3: t.precoHora3 == null,
      caixa: t.caixa == null,
      cartaoMetro: t.cartaoMetro == null,
      filmeRolo: t.filmeRolo == null,
      plasticoBolhaRolo: t.plasticoBolhaRolo == null,
    });
    setNaLista(Boolean(t.aparecerNaLista));
    setActualizadoEm(t.actualizadoEm ?? null);
  }

  const ler = useCallback(async () => {
    setACarregar(true);
    setErroDeLeitura(null);
    try {
      const d = await pedir<RespostaDoGet>("/api/profissionais/tarifas-mudancas");
      encher(d.tarifa ?? null);
      setPodeAparecer(Boolean(d.podeAparecerNaLista));
      // Sem nada gravado, o interruptor nasce ligado para quem tem «Mudanças».
      setNaLista(
        typeof d.interruptorAoAbrir === "boolean"
          ? d.interruptorAoAbrir
          : interruptorAoAbrir(d.tarifa ?? null, Boolean(d.podeAparecerNaLista)),
      );
      if (d.regras) {
        setRegras({
          taxa: Number(d.regras.taxaDaPlataforma),
          modo: d.regras.modoDaTaxa === "por_cima" ? "por_cima" : "de_dentro",
          materialComIva: Boolean(d.regras.materialComIva),
          iva: Number(d.regras.iva),
        });
      }
    } catch (e) {
      setErroDeLeitura(e instanceof ErroDaApi ? e.message : "Não foi possível ler os seus preços.");
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    void ler();
  }, [ler]);

  const mudar = (k: Chave) => (v: string) => {
    setCampos((s) => ({ ...s, [k]: v }));
    formulario.tirarErro(k);
    setGravado(null);
  };

  const alternarDeFora = (k: Opcional) => {
    setDeFora((s) => ({ ...s, [k]: !s[k] }));
    formulario.tirarErro(k);
    setGravado(null);
  };

  // O que vai para o site: o que está «de fora» vai a null.
  const corpo = useMemo(() => {
    const saida: Record<string, string | boolean | null> = { aparecerNaLista: podeAparecer && naLista };
    for (const k of Object.keys(campos) as Chave[]) {
      saida[k] = k in deFora && deFora[k as Opcional] ? null : campos[k];
    }
    return saida;
  }, [campos, deFora, naLista, podeAparecer]);

  const validacao = useMemo(() => validarTarifa(corpo), [corpo]);

  // O exemplo: com o material que ele fornece (as caixas, se as tiver) — como no painel.
  const exemplo = useMemo(() => {
    if (!validacao.ok) return null;
    const t = validacao.tarifa;
    const uso = { ...EXEMPLO_DA_MUDANCA, materiais: t.caixa == null ? {} : EXEMPLO_DA_MUDANCA.materiais };
    const conta = valorDaMudanca(congelarTarifa(t, regras), uso);
    return conta.ok ? conta : null;
  }, [validacao, regras]);

  async function gravar() {
    setErro(null);
    setGravado(null);
    if (!validacao.ok) {
      formulario.mostrarErros(validacao.erros as Record<string, string>);
      return;
    }
    setAGravar(true);
    formulario.limparErros();
    try {
      const d = await pedir<{ ok?: boolean; tarifa?: TarifaGravada | null; mensagem?: string }>("/api/profissionais/tarifas-mudancas", {
        metodo: "PUT",
        corpo,
      });
      encher(d.tarifa ?? null);
      // A frase da rota; a de um site de antes sai da mesma lib.
      setGravado(typeof d.mensagem === "string" ? d.mensagem : mensagemDeGravado(Boolean(d.tarifa?.aparecerNaLista), podeAparecer));
    } catch (e) {
      const porCampo = errosPorCampo(e);
      formulario.mostrarErros(porCampo);
      if (Object.keys(porCampo).length === 0) setErro(e instanceof ErroDaApi ? e.message : "Não foi possível guardar.");
      else if (e instanceof ErroDaApi && e.estado === 403) setErro(e.message);
    } finally {
      setAGravar(false);
    }
  }

  if (aCarregar) {
    return (
      <View style={[estilos.vazio, { backgroundColor: c.fundo }]}>
        <Text style={{ color: c.suave }}>A carregar…</Text>
      </View>
    );
  }

  if (erroDeLeitura) {
    return (
      <View style={[estilos.vazio, estilos.pagina, { backgroundColor: c.fundo }]}>
        <Mensagem texto={erroDeLeitura} />
        <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={() => void ler()} />
      </View>
    );
  }

  const nota = { color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 } as const;

  return (
    <RolagemComTeclado
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      <FormularioComErros formulario={formulario}>
      <Text style={[nota, { color: c.tinta }]}>{TEXTOS.abertura}</Text>

      <Caixa>
        <TituloDaCaixa>A equipa</TituloDaCaixa>
        <CampoDeTexto
          rotulo="Hora com 2 pessoas (€/h)"
          value={campos.precoHora2}
          onChangeText={mudar("precoHora2")}
          keyboardType="decimal-pad"
          placeholder="ex.: 45"
          campo="precoHora2"
        />
        <CampoOpcional
          rotulo="Hora com 3 pessoas (€/h)"
          deFora={deFora.precoHora3}
          rotuloDeFora="Não faço com 3"
          aoAlternar={() => alternarDeFora("precoHora3")}
          valor={campos.precoHora3}
          aoMudar={mudar("precoHora3")}
          placeholder="ex.: 60"
          erro={erros.precoHora3}
          campo="precoHora3"
          aviso={avisoDasTresPessoas(deFora.precoHora3 ? null : campos.precoHora3)}
        />
        <CampoDeTexto
          rotulo="Mínimo de horas"
          value={campos.minimoHoras}
          onChangeText={mudar("minimoHoras")}
          keyboardType="decimal-pad"
          placeholder="ex.: 3"
          dica="As horas cobradas nunca ficam abaixo deste mínimo."
          campo="minimoHoras"
        />
      </Caixa>

      <Caixa>
        <TituloDaCaixa>Os quilómetros</TituloDaCaixa>
        <CampoDeTexto
          rotulo="Preço do km (€/km)"
          value={campos.precoKm}
          onChangeText={mudar("precoKm")}
          keyboardType="decimal-pad"
          placeholder="ex.: 0,80"
          campo="precoKm"
        />
        <CampoDeTexto
          rotulo="Km mínimos por trabalho"
          value={campos.kmMinimo}
          onChangeText={mudar("kmMinimo")}
          keyboardType="number-pad"
          placeholder="ex.: 20"
          dica="Os km cobrados nunca ficam abaixo deste número."
          campo="kmMinimo"
        />
        <CampoDeTexto
          rotulo="Distância máxima que aceita (km)"
          value={campos.kmMaximo}
          onChangeText={mudar("kmMaximo")}
          keyboardType="number-pad"
          placeholder="ex.: 100"
          campo="kmMaximo"
        />
      </Caixa>

      <Caixa>
        <TituloDaCaixa>O material</TituloDaCaixa>
        <Text style={nota}>O material não leva a taxa da plataforma: o cliente paga o seu preço.</Text>
        {MATERIAIS.map((m) => (
          <CampoOpcional
            key={m.chave}
            rotulo={`${m.nome} (€ por ${m.unidade})`}
            deFora={deFora[m.chave]}
            rotuloDeFora="Não forneço"
            aoAlternar={() => alternarDeFora(m.chave)}
            valor={campos[m.chave]}
            aoMudar={mudar(m.chave)}
            erro={erros[m.chave]}
            campo={m.chave}
          />
        ))}
      </Caixa>

      <CaixaComErro campo="aparecerNaLista">
        <Interruptor
          rotulo={TEXTOS.interruptor}
          dica={dicaDoInterruptor(podeAparecer && naLista, podeAparecer)}
          valor={podeAparecer && naLista}
          aoMudar={(v) => {
            setNaLista(v);
            setGravado(null);
          }}
          desactivado={!podeAparecer}
        />
      </CaixaComErro>

      <Caixa>
        <TituloDaCaixa>Exemplo da conta</TituloDaCaixa>
        <Text style={nota}>
          {EXEMPLO_DA_MUDANCA.horas} horas, {EXEMPLO_DA_MUDANCA.pessoas} pessoas, {EXEMPLO_DA_MUDANCA.km} km
          {exemplo && exemplo.materiais.linhas.length > 0 ? `, ${EXEMPLO_DA_MUDANCA.materiais?.caixas} caixas` : ""}
        </Text>
        {!exemplo ? (
          <Text style={nota}>Preencha os preços da equipa e dos km para ver a conta.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            <LinhaDaConta
              rotulo={`Horas (${String(exemplo.horas.cobradas).replace(".", ",")} h × ${doCentimo(exemplo.horas.precoHoraCent)})`}
              valor={doCentimo(exemplo.horas.cent)}
            />
            <LinhaDaConta
              rotulo={`Km (${exemplo.km.cobrados} km × ${doCentimo(exemplo.km.precoKmCent)})`}
              valor={doCentimo(exemplo.km.cent)}
            />
            {exemplo.materiais.linhas.map((l) => (
              <LinhaDaConta key={l.chave} rotulo={`${l.nome} (${l.quantidade} × ${doCentimo(l.precoCent)})`} valor={doCentimo(l.cent)} />
            ))}
            {exemplo.taxa.modo === "por_cima" ? (
              <LinhaDaConta
                rotulo={`Taxa da plataforma (${percentagem(exemplo.taxa.fracao)} das horas e km)`}
                valor={doCentimo(exemplo.taxa.cent)}
              />
            ) : null}
            <LinhaDaConta rotulo="O cliente paga, sem IVA" valor={doCentimo(exemplo.semIvaCent)} forte />
            <LinhaDaConta
              rotulo={`IVA (${percentagem(regras.iva)}${regras.materialComIva ? "" : ", sem o material"})`}
              valor={doCentimo(exemplo.ivaCent)}
            />
            <LinhaDaConta rotulo="O cliente paga, com IVA" valor={doCentimo(exemplo.totalCent)} forte />
            <View style={[estilos.separador, { borderTopColor: c.linha }]} />
            {exemplo.taxa.modo === "de_dentro" ? (
              <LinhaDaConta
                rotulo={`Taxa da plataforma (${percentagem(exemplo.taxa.fracao)} das horas e km)`}
                valor={`− ${doCentimo(exemplo.taxa.cent)}`}
              />
            ) : null}
            <LinhaDaConta rotulo="Fica para si, sem IVA" valor={doCentimo(exemplo.profissionalCent)} forte />
          </View>
        )}
      </Caixa>

      {erro ? <Mensagem texto={erro} /> : null}
      {formulario.aviso ? <Mensagem texto={formulario.aviso} /> : null}
      {gravado ? <Mensagem tom="bom" texto={gravado} /> : null}
      <Botao titulo="Gravar os preços" ocupado={aGravar} aoCarregar={() => void gravar()} />
      {actualizadoEm ? (
        <Text style={[nota, { textAlign: "center" }]}>Última gravação: {dataEHoraEmLisboa(new Date(actualizadoEm))}</Text>
      ) : null}
      </FormularioComErros>
    </RolagemComTeclado>
  );
}

/** Um campo que se pode deixar de fora: «Não forneço» / «Não faço com 3». */
function CampoOpcional({
  rotulo,
  deFora,
  rotuloDeFora,
  aoAlternar,
  valor,
  aoMudar,
  placeholder,
  erro,
  campo,
  aviso,
}: {
  rotulo: string;
  deFora: boolean;
  rotuloDeFora: string;
  aoAlternar: () => void;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  erro?: string;
  /** O nome do campo no formulário (d9): para o ecrã descer até ele. */
  campo?: string;
  /** Um aviso em âmbar (não é erro: grava-se na mesma), de fora ou com o campo vazio. */
  aviso?: string | null;
}) {
  const c = useCores();
  return (
    <View style={{ gap: ESPACO.xs }}>
      {deFora ? (
        <Text style={{ color: c.tinta, fontWeight: "600", fontSize: LETRA.normal }}>{rotulo}</Text>
      ) : (
        <CampoDeTexto rotulo={rotulo} value={valor} onChangeText={aoMudar} keyboardType="decimal-pad" placeholder={placeholder} erro={erro} campo={campo} />
      )}
      <Pressable
        onPress={aoAlternar}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: deFora }}
        accessibilityLabel={`${rotulo}: ${rotuloDeFora}`}
        style={({ pressed }) => [estilos.deFora, { borderColor: deFora ? c.marca : c.linha, opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name={deFora ? "checkbox" : "square-outline"} size={20} color={deFora ? c.marca : c.suave} />
        <Text style={{ color: c.tinta, fontSize: LETRA.pequena + 1 }}>{rotuloDeFora}</Text>
      </Pressable>
      {aviso && !erro ? (
        <Text accessibilityRole="alert" style={{ color: c.aviso, fontWeight: "600", fontSize: LETRA.pequena + 1, lineHeight: 19 }}>
          {aviso}
        </Text>
      ) : null}
    </View>
  );
}

function LinhaDaConta({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  const c = useCores();
  const estilo = { color: forte ? c.tinta : c.suave, fontWeight: forte ? ("700" as const) : ("400" as const), fontSize: LETRA.pequena + 1 };
  return (
    <View style={estilos.linhaDaConta}>
      <Text style={[estilo, { flex: 1 }]}>{rotulo}</Text>
      <Text style={[estilo, { fontVariant: ["tabular-nums"] }]}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  vazio: { flex: 1, alignItems: "center", justifyContent: "center" },
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
  deFora: {
    flexDirection: "row",
    alignItems: "center",
    gap: ESPACO.s,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: RAIO.m,
    paddingHorizontal: ESPACO.m,
    paddingVertical: ESPACO.xs,
  },
  linhaDaConta: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: ESPACO.m },
  separador: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: ESPACO.xs },
});
