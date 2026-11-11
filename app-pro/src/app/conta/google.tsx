import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RolagemComTeclado } from "../../componentes/Teclado";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { ErroDaApi, pedir } from "../../lib/api";
import { TEXTOS_DA_FICHA_NO_GOOGLE } from "../../../../src/lib/estado-da-ficha-no-google";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * «A MINHA FICHA NO GOOGLE» — 11-11-2026, o ecrã «ficha-google» do painel
 * (`FichaNoGoogle.tsx`), com os mesmos textos (`estado-da-ficha-no-google.ts`).
 *
 * O profissional procura a empresa pelo nome (o servidor pergunta ao Google)
 * e escolhe a ficha; fica à espera da confirmação da CLYON. Só a confirmada dá
 * a nota do Google no cartão da lista das mudanças.
 *
 * `GET/PUT /api/profissionais/ficha-google`, `POST /api/profissionais/ficha-google/procurar`.
 */

type Ficha = { nome: string | null; morada: string | null; mapsUri: string | null };
type Estado = { estado: string; texto: string; confirmada: Ficha | null; proposta: Ficha | null };
type Resultado = { placeId: string; nome: string; morada: string | null; mapsUri: string | null };

const T = TEXTOS_DA_FICHA_NO_GOOGLE;

export default function EcraDaFichaNoGoogle() {
  const c = useCores();
  const margens = useSafeAreaInsets();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [aProcurar, setAProcurar] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [aEscolher, setAEscolher] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const ler = useCallback(async () => {
    setACarregar(true);
    setErroDeLeitura(null);
    try {
      setEstado(await pedir<Estado>("/api/profissionais/ficha-google"));
    } catch (e) {
      setErroDeLeitura(e instanceof ErroDaApi ? e.message : "Não foi possível ler a sua ficha no Google.");
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function procurar() {
    setErro(null);
    setAviso(null);
    if (texto.trim().length < 3) {
      setErro("Escreva pelo menos 3 letras do nome.");
      return;
    }
    setAProcurar(true);
    try {
      const d = await pedir<{ fichas?: Resultado[] }>("/api/profissionais/ficha-google/procurar", {
        metodo: "POST",
        corpo: { texto },
      });
      setResultados(d.fichas ?? []);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Sem ligação. Tente outra vez.");
    } finally {
      setAProcurar(false);
    }
  }

  async function escolher(placeId: string) {
    setAEscolher(placeId);
    setErro(null);
    try {
      const d = await pedir<Estado>("/api/profissionais/ficha-google", { metodo: "PUT", corpo: { placeId } });
      setEstado(d);
      setResultados(null);
      setTexto("");
      setAviso(T.enviada);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Sem ligação. Tente outra vez.");
    } finally {
      setAEscolher(null);
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

  const FichaEmTexto = ({ f }: { f: Ficha }) => (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>{f.nome ?? "Ficha do Google"}</Text>
      {f.morada ? <Text style={nota}>{f.morada}</Text> : null}
      {f.mapsUri ? (
        <Pressable onPress={() => void Linking.openURL(f.mapsUri as string)} accessibilityRole="link" hitSlop={6}>
          <Text style={{ color: c.marca, fontWeight: "600", fontSize: LETRA.pequena + 1 }}>Ver no Google Maps</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <RolagemComTeclado
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[nota, { color: c.tinta }]}>{T.explicacao}</Text>

      {estado ? (
        <Caixa>
          <TituloDaCaixa>O estado</TituloDaCaixa>
          <Text style={{ color: c.tinta, fontSize: LETRA.normal }}>{estado.texto}</Text>
          {estado.confirmada ? <FichaEmTexto f={estado.confirmada} /> : null}
          {estado.proposta ? (
            <View style={[estilos.separador, { borderTopColor: c.linha }]}>
              <Text style={[nota, { fontWeight: "700" }]}>À espera de confirmação</Text>
              <FichaEmTexto f={estado.proposta} />
            </View>
          ) : null}
        </Caixa>
      ) : null}

      <Caixa>
        <TituloDaCaixa>{T.procurar}</TituloDaCaixa>
        <CampoDeTexto
          rotulo={T.rotuloDaProcura}
          value={texto}
          onChangeText={setTexto}
          placeholder="ex.: Mudanças Silva, Almada"
          maxLength={120}
          returnKeyType="search"
          onSubmitEditing={() => void procurar()}
        />
        <Botao titulo={T.procurar} ocupado={aProcurar} aoCarregar={() => void procurar()} />
        {resultados && resultados.length === 0 ? <Text style={nota}>{T.semResultados}</Text> : null}
        {resultados?.map((f) => (
          <View key={f.placeId} style={[estilos.resultado, { borderColor: c.linha }]}>
            <FichaEmTexto f={f} />
            <Botao
              titulo={aEscolher === f.placeId ? "A enviar…" : T.escolher}
              tipo="secundario"
              ocupado={aEscolher === f.placeId}
              desactivado={aEscolher !== null}
              aoCarregar={() => void escolher(f.placeId)}
            />
          </View>
        ))}
      </Caixa>

      {erro ? <Mensagem texto={erro} /> : null}
      {aviso ? <Mensagem tom="bom" texto={aviso} /> : null}
    </RolagemComTeclado>
  );
}

const estilos = StyleSheet.create({
  vazio: { flex: 1, alignItems: "center", justifyContent: "center" },
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
  separador: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: ESPACO.s, gap: ESPACO.xs },
  resultado: { borderWidth: 1, borderRadius: RAIO.m, padding: ESPACO.m, gap: ESPACO.s },
});
