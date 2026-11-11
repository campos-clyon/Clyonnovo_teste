import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Texto";
import { Botao, Caixa, Mensagem, TituloDaCaixa } from "./ui";
import { useTrabalhos } from "../estado/Trabalhos";
import { ErroDaApi, pedir } from "../lib/api";
import {
  BOTAO_AGORA,
  BOTAO_MAIS_PAUSA,
  CORRIGIR_A_FOLHA,
  ENVIAR_A_FOLHA,
  MAXIMO_DE_PAUSAS,
  TITULO_DA_FOLHA,
  contextoDaFolha,
  folhaNoEcra,
  lerFolha,
  type FolhaNoEcra,
  type RascunhoDaFolha,
} from "../../../src/lib/folha-da-mudanca";
import { HORA_DE_FIM, HORA_DE_INICIO, agoraNoCampo } from "../../../src/lib/horas-do-trabalho";
import type { QuantidadeDoMaterial } from "../../../src/lib/conta-da-mudanca";
import type { Trabalho } from "../lib/trabalhos";
import { camposDeAbrir, folhaAMeioVale, rascunhoMaisRecente } from "../lib/folha-a-meio";
import { apagarFolhaAMeio, guardarFolhaAMeio, lerFolhaAMeio } from "../lib/folha-guardada";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * A FOLHA DA MUDANÇA — 11-11-2026, o mesmo bloco do painel.
 *
 * Numa mudança com a lista de parceiros: a hora de início e a de fim
 * (escritas à mão, ou «Agora»), «+ Pausa», a equipa, os km (já com os do
 * percurso; corrigir pede o motivo) e o material pelas unidades da tarifa
 * dele. O valor faz-se aqui com a MESMA conta do site (`lerFolha`) antes de
 * enviar; o site refaz e grava. O cliente confirma — nunca sozinha.
 *
 * O RASCUNHO — d5, 11-11-2026. O que ele escreve já não vive só no ecrã: a
 * cada mudança fica no telemóvel (`folha-guardada.ts`: só horas e
 * quantidades, sem moradas nem nomes) e, pouco depois, no site
 * (`rascunho: true` na mesma rota — não envia a folha nem avisa o cliente).
 * Ao reabrir repõe-se o mais novo dos dois; sem início escrito, vem a hora do
 * «Cheguei» (hora de Lisboa). Enviar a folha apaga o rascunho.
 */
const ROTA_DAS_HORAS = "/api/profissionais/trabalho/horas";
/** Quanto se espera, depois da última tecla, para mandar o rascunho ao site. */
const ESPERA_DO_RASCUNHO_MS = 1500;

export function FolhaDaMudanca({ t }: { t: Trabalho }) {
  const c = useCores();
  const { recarregar } = useTrabalhos();
  const h = t.porHora!;
  const f = h.folha!;
  const campos = f.campos;
  const editavel = h.podeMarcar;
  // O rascunho que o site guardou; o do telemóvel lê-se a seguir (é um ficheiro).
  const doSite = editavel ? (f.rascunho ?? null) : null;
  const [aoAbrir] = useState(() => camposDeAbrir(campos, t.chegouEm, doSite));
  const [inicio, setInicio] = useState(aoAbrir.inicio);
  const [fim, setFim] = useState(aoAbrir.fim);
  const [pausas, setPausas] = useState<Array<{ inicio: string; fim: string }>>(aoAbrir.pausas);
  const [pessoas, setPessoas] = useState<2 | 3>(aoAbrir.pessoas);
  const [km, setKm] = useState(aoAbrir.km);
  const [motivoDosKm, setMotivoDosKm] = useState(campos.motivoDosKm);
  const [materiais, setMateriais] = useState<Partial<Record<QuantidadeDoMaterial, string>>>(aoAbrir.materiais);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  /** Ele já escreveu alguma coisa desde que abriu: a partir daí guarda-se, e nada se repõe por cima. */
  const mexeu = useRef(false);
  const reposto = useRef<string | null>(doSite?.guardadoEm ?? null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  function repor(r: RascunhoDaFolha) {
    const a = camposDeAbrir(campos, t.chegouEm, r);
    reposto.current = r.guardadoEm;
    setInicio(a.inicio);
    setFim(a.fim);
    setPausas(a.pausas);
    setPessoas(a.pessoas);
    setKm(a.km);
    setMateriais(a.materiais);
  }

  // Ao reabrir: o rascunho do telemóvel, se for mais novo do que o do site (ficou sem rede) e ainda valer.
  useEffect(() => {
    if (!editavel) return;
    let vivo = true;
    void lerFolhaAMeio(t.negociacaoId).then((doTelemovel) => {
      if (!vivo || mexeu.current || !doTelemovel || !folhaAMeioVale(t, doTelemovel)) return;
      if (rascunhoMaisRecente(doSite, doTelemovel) === doTelemovel && doTelemovel.guardadoEm !== reposto.current) repor(doTelemovel);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.negociacaoId, editavel]);

  // O rascunho do site chegou depois (a lista do ecrã era a guardada): repõe-se, se ele ainda não escreveu nada.
  useEffect(() => {
    if (!doSite || mexeu.current || doSite.guardadoEm === reposto.current) return;
    if (reposto.current == null || Date.parse(doSite.guardadoEm) > Date.parse(reposto.current)) repor(doSite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doSite?.guardadoEm]);

  // A cada mudança dele: no telemóvel já, e no site pouco depois da última tecla. Só horas e quantidades.
  useEffect(() => {
    if (!editavel || !mexeu.current) return;
    const rascunho = { dia: campos.dia, inicio: inicio.trim(), fim: fim.trim(), pausas, pessoas, km, materiais };
    void guardarFolhaAMeio(t.negociacaoId, rascunho);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      espera.current = null;
      // Falhar aqui não é notícia: o rascunho ficou no telemóvel e vai outra vez na próxima mudança.
      pedir(ROTA_DAS_HORAS, { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, rascunho: true, ...rascunho } }).catch(() => undefined);
    }, ESPERA_DO_RASCUNHO_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim, pausas, pessoas, km, materiais]);
  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current);
    },
    [],
  );

  /** Uma mudança feita por ele (e não uma reposição): marca que mexeu e muda o campo. */
  const porEle =
    <T,>(mudar: (v: T) => void) =>
    (v: T) => {
      mexeu.current = true;
      mudar(v);
    };
  const mudarInicio = porEle(setInicio);
  const mudarFim = porEle(setFim);
  const mudarPausas = porEle(setPausas);
  const mudarPessoas = porEle(setPessoas);
  const mudarKm = porEle(setKm);
  const mudarMateriais = porEle(setMateriais);

  const corpo = { dia: campos.dia, inicio: inicio.trim(), fim: fim.trim(), pausas, pessoas, km, motivoDosKm, materiais };
  const previsao = useMemo((): { ecra: FolhaNoEcra | null; erro: string | null } => {
    const ctx = contextoDaFolha(f.contexto);
    if (!ctx || !inicio.trim() || !fim.trim()) return { ecra: null, erro: null };
    const r = lerFolha(corpo, ctx);
    return r.ok ? { ecra: folhaNoEcra(r.folha, "parceiro", ctx.tarifa.minimoHoras), erro: null } : { ecra: null, erro: r.erro };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim, pausas, pessoas, km, motivoDosKm, materiais, f.contexto]);
  const kmDiferentes = campos.kmDoPercurso != null && Math.abs(Number(km.replace(",", ".")) - campos.kmDoPercurso) >= 0.5;
  const mostrar = editavel ? previsao.ecra : f.enviada;

  async function enviar() {
    setAEnviar(true);
    setErro(null);
    // Um rascunho à espera de ir já não vai: a folha vai inteira.
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
    try {
      const r = await pedir<{ ok: boolean; mensagem?: string | null }>(ROTA_DAS_HORAS, {
        metodo: "POST",
        corpo: { negociacaoId: t.negociacaoId, ...corpo },
      });
      // A folha foi enviada: o rascunho apaga-se (o site apaga o dele).
      mexeu.current = false;
      void apagarFolhaAMeio(t.negociacaoId);
      setMensagem(r.mensagem ?? null);
      await recarregar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível enviar a folha. Tente outra vez.");
    } finally {
      setAEnviar(false);
    }
  }

  const campoDeHora = (rotulo: string, valor: string, mudar: (v: string) => void) => (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>{rotulo}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <TextInput
          value={valor}
          onChangeText={mudar}
          editable={editavel}
          keyboardType="numbers-and-punctuation"
          placeholder="HH:MM"
          placeholderTextColor={c.suave}
          maxLength={5}
          accessibilityLabel={rotulo}
          style={[estilos.campo, { flex: 1, borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
        />
        {editavel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${rotulo}: agora`}
            onPress={() => mudar(agoraNoCampo())}
            style={({ pressed }) => [estilos.pequeno, { borderColor: c.linha, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: c.marca, fontWeight: "700" }}>{BOTAO_AGORA}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const campoCurto = (valor: string, mudar: (v: string) => void, rotulo: string, largura = 86) => (
    <TextInput
      value={valor}
      onChangeText={mudar}
      keyboardType="numbers-and-punctuation"
      placeholder="HH:MM"
      placeholderTextColor={c.suave}
      maxLength={5}
      accessibilityLabel={rotulo}
      style={[estilos.campo, { width: largura, borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
    />
  );

  return (
    <Caixa>
      <TituloDaCaixa>{TITULO_DA_FOLHA}</TituloDaCaixa>
      {f.estadoTexto ? <Mensagem tom={f.estado === "confirmada" ? "bom" : "aviso"} texto={f.estadoTexto} /> : null}
      {editavel ? (
        <View style={{ gap: ESPACO.s }}>
          <View style={{ flexDirection: "row", gap: ESPACO.s }}>
            {campoDeHora(HORA_DE_INICIO, inicio, mudarInicio)}
            {campoDeHora(HORA_DE_FIM, fim, mudarFim)}
          </View>
          {pausas.map((p, i) => (
            <View key={i} style={estilos.linha}>
              <Text style={{ flex: 1, color: c.tinta }}>Pausa {i + 1}</Text>
              {campoCurto(p.inicio, (v) => mudarPausas(pausas.map((x, k) => (k === i ? { ...x, inicio: v } : x))), `Pausa ${i + 1}: início`)}
              <Text style={{ color: c.suave }}>às</Text>
              {campoCurto(p.fim, (v) => mudarPausas(pausas.map((x, k) => (k === i ? { ...x, fim: v } : x))), `Pausa ${i + 1}: fim`)}
              <Pressable accessibilityRole="button" accessibilityLabel={`Tirar a pausa ${i + 1}`} onPress={() => mudarPausas(pausas.filter((_, k) => k !== i))}>
                <Text style={{ color: c.mau, fontWeight: "700", paddingHorizontal: 6 }}>×</Text>
              </Pressable>
            </View>
          ))}
          {pausas.length < MAXIMO_DE_PAUSAS ? (
            <Pressable accessibilityRole="button" onPress={() => mudarPausas([...pausas, { inicio: "", fim: "" }])}>
              <Text style={{ color: c.marca, fontWeight: "700" }}>{BOTAO_MAIS_PAUSA}</Text>
            </Pressable>
          ) : null}

          <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>Equipa</Text>
          <View style={{ flexDirection: "row", gap: ESPACO.s }}>
            {([2, 3] as const).map((n) => {
              const desligado = n === 3 && !campos.podeTres;
              const escolhido = pessoas === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityState={{ selected: escolhido, disabled: desligado }}
                  onPress={desligado ? undefined : () => mudarPessoas(n)}
                  style={[estilos.opcao, { borderColor: escolhido ? c.marca : c.linha, opacity: desligado ? 0.4 : 1 }]}
                >
                  <Text style={{ color: escolhido ? c.marca : c.tinta, fontWeight: "700" }}>
                    {n} pessoas{n === campos.pessoasEscolhidas ? " (a escolhida)" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
            Km{campos.kmDoPercurso != null ? ` (o percurso dá ${String(campos.kmDoPercurso).replace(".", ",")} km)` : ""}
          </Text>
          <TextInput
            value={km}
            onChangeText={mudarKm}
            keyboardType="decimal-pad"
            accessibilityLabel="Km"
            style={[estilos.campo, { width: 110, borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
          />
          {kmDiferentes ? (
            <TextInput
              value={motivoDosKm}
              onChangeText={setMotivoDosKm}
              placeholder="Porque são diferentes do percurso?"
              placeholderTextColor={c.suave}
              maxLength={300}
              accessibilityLabel="Porque os km são diferentes do percurso"
              style={[estilos.campo, { fontSize: LETRA.normal, fontWeight: "400", borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
            />
          ) : null}

          {campos.materiaisDisponiveis.length > 0 ? (
            <View style={{ gap: ESPACO.s }}>
              <Text style={{ color: c.tinta, fontWeight: "600" }}>Material que forneceu</Text>
              {campos.materiaisDisponiveis.map((m) => (
                <View key={m.quantidade} style={estilos.linha}>
                  <Text style={{ flex: 1, color: c.tinta }} numberOfLines={1}>
                    {m.nome} ({m.precoTexto})
                  </Text>
                  <TextInput
                    value={materiais[m.quantidade] ?? ""}
                    onChangeText={(v) => mudarMateriais({ ...materiais, [m.quantidade]: v })}
                    keyboardType={m.decimal ? "decimal-pad" : "number-pad"}
                    placeholder="0"
                    placeholderTextColor={c.suave}
                    accessibilityLabel={`Quantidade de ${m.nome}`}
                    style={[estilos.campo, { width: 72, borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {mostrar ? <ResumoDaFolha folha={mostrar} /> : null}
      {editavel && previsao.erro ? <Mensagem tom="aviso" texto={previsao.erro} /> : null}
      {editavel ? (
        <Botao titulo={h.marcadas ? CORRIGIR_A_FOLHA : ENVIAR_A_FOLHA} ocupado={aEnviar} desactivado={!previsao.ecra} aoCarregar={() => void enviar()} />
      ) : null}
      {mensagem ? <Mensagem tom="bom" texto={mensagem} /> : null}
      {erro ? <Mensagem texto={erro} /> : null}
      <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>{f.regra}</Text>
      {f.historico.length > 0 ? (
        <View style={{ gap: 2 }}>
          <Text style={{ color: c.tinta, fontWeight: "600" }}>Histórico da folha</Text>
          {f.historico.map((e, i) => (
            <Text key={i} style={{ color: c.suave, fontSize: LETRA.pequena }}>
              {e.quando} — {e.texto}
            </Text>
          ))}
        </View>
      ) : null}
    </Caixa>
  );
}

function ResumoDaFolha({ folha }: { folha: FolhaNoEcra }) {
  const c = useCores();
  return (
    <View style={[estilos.resumo, { backgroundColor: c.fundo }]}>
      {folha.linhas.map((l, i) => (
        <View key={i} style={estilos.lado}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.tinta, fontWeight: l.forte ? "800" : "400" }}>{l.rotulo}</Text>
            {l.nota ? <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>{l.nota}</Text> : null}
          </View>
          <Text style={{ color: c.tinta, fontWeight: l.forte ? "800" : "600" }}>{l.valor}</Text>
        </View>
      ))}
      {folha.avisoDaEquipa ? <Text style={{ color: c.aviso, fontWeight: "600" }}>{folha.avisoDaEquipa}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, minHeight: 50, fontSize: LETRA.media, fontWeight: "700" },
  pequeno: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.s, justifyContent: "center", minHeight: 50 },
  opcao: { flex: 1, borderWidth: 2, borderRadius: RAIO.m, minHeight: 48, alignItems: "center", justifyContent: "center" },
  linha: { flexDirection: "row", alignItems: "center", gap: ESPACO.s },
  lado: { flexDirection: "row", alignItems: "flex-start", gap: ESPACO.s },
  resumo: { borderRadius: RAIO.m, padding: ESPACO.m, gap: ESPACO.xs },
});
