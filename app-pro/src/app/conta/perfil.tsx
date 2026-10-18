import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../../componentes/Texto";
import { Botao, Caixa, CampoDeTexto, Linha, Mensagem, TituloDaCaixa } from "../../componentes/ui";
import { escolherFotografias, reduzirFotografia } from "../../componentes/Fotografias";
import { VerFotografias } from "../../componentes/VerFotografias";
import { useConta } from "../../estado/Conta";
import { enviarFicheiro, ErroDaApi, errosPorCampo, pedir } from "../../lib/api";
import { faltasEm, type Perfil } from "../../lib/conta";
import { horaCurta } from "../../lib/trabalhos";
import { TIPOS_DE_VEICULO } from "../../../../src/lib/convite-profissional";
import { ESPACO, LETRA, RAIO, useCores } from "../../tema";

/**
 * O PERFIL — o «Perfil» do painel (`Perfil.tsx`, ecrã «dados»): o nome, o
 * telefone, a morada da base (escolhida da lista, para ficar certa no mapa —
 * é dela que se mede a distância a cada pedido), o email, a viatura e as
 * fotografias da viatura. Grava com `PUT /api/profissionais/perfil`, que só
 * mexe nos campos que recebe.
 */

const MAXIMO_DE_FOTOS_DA_VIATURA = 6;

type Sugestao = { placeId: string; mainText: string; secondaryText: string; description: string };

export default function EcraDoPerfil() {
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
    <ScrollView
      style={{ backgroundColor: c.fundo }}
      contentContainerStyle={[estilos.pagina, { paddingBottom: margens.bottom + ESPACO.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Dados perfil={perfil} aoGravar={recarregarPerfil} />
      <FotosDaViatura perfil={perfil} aoMudar={recarregarPerfil} />
    </ScrollView>
  );
}

const semIndicativo = (t: string) => t.replace(/[\s.-]/g, "").replace(/^(\+351|00351)/, "");

function Dados({ perfil, aoGravar }: { perfil: Perfil; aoGravar: () => Promise<void> }) {
  const c = useCores();
  const [nome, setNome] = useState(perfil.nome);
  const [telefone, setTelefone] = useState(semIndicativo(perfil.telefone));
  const [cidade, setCidade] = useState(perfil.cidade);
  const [lat, setLat] = useState<number | null>(perfil.baseLat);
  const [lng, setLng] = useState<number | null>(perfil.baseLng);
  const [veiculo, setVeiculo] = useState(perfil.tipoVeiculo);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [gravadoAs, setGravadoAs] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);
  const pedidoDaMorada = useRef(0);
  const faltas = faltasEm(perfil, "dados");

  // As sugestões do mapa — a partir de 3 letras, com uma pausa de 320 ms, como no painel.
  useEffect(() => {
    if (lat != null || cidade.trim().length < 3) {
      setSugestoes([]);
      return;
    }
    const meu = ++pedidoDaMorada.current;
    const espera = setTimeout(() => {
      void pedir<{ predictions?: Sugestao[] }>("/api/maps/autocomplete", { metodo: "POST", corpo: { input: cidade.trim() }, semSessao: true })
        .then((r) => {
          if (meu === pedidoDaMorada.current) setSugestoes((r.predictions ?? []).slice(0, 5));
        })
        .catch(() => {});
    }, 320);
    return () => clearTimeout(espera);
  }, [cidade, lat]);

  async function escolher(s: Sugestao) {
    setSugestoes([]);
    try {
      const r = await pedir<{ ok?: boolean; formattedAddress?: string; lat?: number; lng?: number }>("/api/maps/place-details", {
        metodo: "POST",
        corpo: { placeId: s.placeId },
        semSessao: true,
      });
      setCidade(r.formattedAddress ?? s.description);
      setLat(typeof r.lat === "number" ? r.lat : null);
      setLng(typeof r.lng === "number" ? r.lng : null);
    } catch {
      setCidade(s.description);
    }
  }

  async function gravar() {
    setAGravar(true);
    setErros({});
    setErro(null);
    setGravadoAs(null);
    try {
      await pedir("/api/profissionais/perfil", {
        metodo: "PUT",
        corpo: { nome: nome.trim(), telefone: telefone.trim(), cidade: cidade.trim(), baseLat: lat, baseLng: lng, tipoVeiculo: veiculo },
      });
      setGravadoAs(horaCurta(new Date().toISOString()));
      await aoGravar();
    } catch (e) {
      const porCampo = errosPorCampo(e);
      setErros(porCampo);
      if (Object.keys(porCampo).length === 0) {
        setErro(e instanceof ErroDaApi && e.estado === 401 ? "A sua sessão expirou. Volte a entrar e grave outra vez." : e instanceof ErroDaApi ? e.message : "Não foi possível guardar.");
      }
    } finally {
      setAGravar(false);
    }
  }

  return (
    <>
      {faltas.length > 0 ? (
        <Mensagem tom="aviso" texto={`${faltas.length === 1 ? "Falta um campo" : `Faltam ${faltas.length} campos`} aqui: ${faltas.map((f) => f.rotulo.toLowerCase()).join(", ")}.`} />
      ) : null}
      <Caixa>
        <CampoDeTexto rotulo="Nome ou empresa" value={nome} onChangeText={setNome} erro={erros.nome} autoCapitalize="words" />
        <CampoDeTexto
          rotulo="Telefone"
          prefixo="+351"
          value={telefone}
          onChangeText={setTelefone}
          keyboardType="phone-pad"
          erro={erros.telefone}
          maxLength={13}
        />
        <View style={{ gap: 6 }}>
          <CampoDeTexto
            rotulo="Morada da base"
            value={cidade}
            onChangeText={(t) => {
              setCidade(t);
              // Escrever à mão tira-a do mapa: só uma escolha da lista tem coordenadas.
              setLat(null);
              setLng(null);
            }}
            erro={erros.cidade}
            dica={
              lat != null
                ? "Base confirmada no mapa. É daqui que se mede a distância a cada pedido."
                : "Ainda não escolheu da lista. Escolha uma sugestão para a base ficar certa no mapa."
            }
            placeholder="Rua, número e localidade"
          />
          {sugestoes.length > 0 ? (
            <View style={[estilos.sugestoes, { borderColor: c.linha, backgroundColor: c.superficie }]}>
              {sugestoes.map((s) => (
                <Pressable
                  key={s.placeId}
                  onPress={() => void escolher(s)}
                  accessibilityRole="button"
                  style={({ pressed }) => [estilos.sugestao, { borderBottomColor: c.linha, opacity: pressed ? 0.6 : 1 }]}
                >
                  <Ionicons name="location-outline" size={16} color={c.marca} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: c.tinta, fontWeight: "600" }}>
                      {s.mainText || s.description}
                    </Text>
                    {s.secondaryText ? (
                      <Text numberOfLines={1} style={{ color: c.suave, fontSize: LETRA.pequena }}>
                        {s.secondaryText}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <Linha rotulo="Email" valor={perfil.email} />
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>
          É com este email que entra. Para o mudar, fale connosco.
        </Text>
      </Caixa>

      <Caixa>
        <TituloDaCaixa>A sua viatura</TituloDaCaixa>
        {TIPOS_DE_VEICULO.map((v) => {
          const activa = veiculo === v.id;
          return (
            <Pressable
              key={v.id}
              onPress={() => setVeiculo(v.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: activa }}
              style={({ pressed }) => [estilos.opcao, { borderColor: activa ? c.marca : c.linha, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name={activa ? "radio-button-on" : "radio-button-off"} size={20} color={activa ? c.marca : c.suave} />
              <Text style={{ flex: 1, color: c.tinta }}>{v.label}</Text>
            </Pressable>
          );
        })}
        {erros.tipoVeiculo ? <Text style={{ color: c.mau }}>{erros.tipoVeiculo}</Text> : null}
      </Caixa>

      {erro ? <Mensagem texto={erro} /> : null}
      {gravadoAs ? <Mensagem tom="bom" texto={`Guardado às ${gravadoAs}.`} /> : null}
      <Botao titulo="Guardar" ocupado={aGravar} aoCarregar={() => void gravar()} />
    </>
  );
}

function FotosDaViatura({ perfil, aoMudar }: { perfil: Perfil; aoMudar: () => Promise<void> }) {
  const c = useCores();
  const [aEnviar, setAEnviar] = useState(false);
  const [aTirar, setATirar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const fotos = perfil.fotosViatura;
  const restam = MAXIMO_DE_FOTOS_DA_VIATURA - fotos.length;

  async function juntar(origem: "camara" | "galeria") {
    setErro(null);
    const r = await escolherFotografias(origem, restam);
    if ("erro" in r) return setErro(r.erro);
    for (const a of r.fotografias) {
      setAEnviar(true);
      try {
        await enviarFicheiro("/api/profissionais/foto-viatura", {}, await reduzirFotografia(a));
      } catch (e) {
        setErro(e instanceof ErroDaApi ? e.message : "A fotografia não seguiu. Tente outra vez.");
        break;
      } finally {
        setAEnviar(false);
      }
    }
    await aoMudar();
  }

  async function tirar(url: string) {
    setATirar(url);
    setErro(null);
    try {
      await pedir("/api/profissionais/foto-viatura", { metodo: "DELETE", corpo: { url } });
      await aoMudar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível apagar a fotografia.");
    } finally {
      setATirar(null);
    }
  }

  return (
    <Caixa>
      <TituloDaCaixa>As suas viaturas</TituloDaCaixa>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>
        A primeira fotografia é a que o cliente vê. Grava-se logo, sem carregar em «Guardar».
      </Text>
      {fotos.length > 0 ? (
        <View style={estilos.grelha}>
          {fotos.map((u, i) => (
            <View key={u}>
              <Pressable onPress={() => setAberta(i)} accessibilityRole="imagebutton" accessibilityLabel={`Ver a fotografia ${i + 1}`}>
                <Image source={{ uri: u }} style={[estilos.foto, { backgroundColor: c.fundo, opacity: aTirar === u ? 0.4 : 1 }]} />
              </Pressable>
              <Pressable
                onPress={() => void tirar(u)}
                accessibilityRole="button"
                accessibilityLabel={`Apagar a fotografia ${i + 1}`}
                hitSlop={8}
                style={[estilos.tirar, { backgroundColor: c.tinta }]}
              >
                <Text style={{ color: c.superficie, fontWeight: "800", fontSize: 14, lineHeight: 16 }}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <VerFotografias key={aberta ?? -1} fotos={fotos} inicio={aberta} aoFechar={() => setAberta(null)} />
      {erro ? <Mensagem texto={erro} /> : null}
      {restam > 0 ? (
        <View style={estilos.lado}>
          <View style={{ flex: 1 }}>
            <Botao titulo="Fotografar" tipo="secundario" ocupado={aEnviar} aoCarregar={() => void juntar("camara")} />
          </View>
          <View style={{ flex: 1 }}>
            <Botao titulo="Da galeria" tipo="secundario" ocupado={aEnviar} aoCarregar={() => void juntar("galeria")} />
          </View>
        </View>
      ) : (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>Já tem {MAXIMO_DE_FOTOS_DA_VIATURA} fotografias. Apague uma antes de acrescentar outra.</Text>
      )}
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  vazio: { flex: 1, alignItems: "center", justifyContent: "center" },
  pagina: { padding: ESPACO.l, gap: ESPACO.l },
  sugestoes: { borderWidth: 1, borderRadius: RAIO.m, overflow: "hidden" },
  sugestao: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, padding: ESPACO.m, borderBottomWidth: StyleSheet.hairlineWidth },
  opcao: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, borderWidth: 1, borderRadius: RAIO.m, padding: ESPACO.m },
  grelha: { flexDirection: "row", flexWrap: "wrap", gap: ESPACO.s },
  foto: { width: 96, height: 96, borderRadius: RAIO.m },
  tirar: { position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  lado: { flexDirection: "row", gap: ESPACO.s },
});
