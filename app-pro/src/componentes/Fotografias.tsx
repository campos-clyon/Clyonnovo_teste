import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Texto";
import { Botao, Mensagem } from "./ui";
import { VerFotografias } from "./VerFotografias";
import { enviarFotografia, ErroDaApi } from "../lib/api";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * FOTOGRAFAR O TRABALHO — o ajuste no local e a prova do trabalho feito.
 *
 * Cada fotografia é reduzida no telemóvel antes de seguir (o lado maior a
 * 1600 px, JPEG): uma fotografia da câmara tem 4 a 12 MB e o site não aceita
 * pedidos acima dos 4,5 MB — e na rede móvel, à porta do cliente, cada MB
 * conta. Reduzir também converte o HEIC do iPhone em JPEG, que todos abrem.
 *
 * Segue uma de cada vez, logo depois de escolhida: quando ele carrega no botão
 * final, as fotografias já estão no site.
 */

const LADO_MAXIMO = 1600;

async function reduzir(a: ImagePicker.ImagePickerAsset): Promise<{ uri: string; nome: string; tipo: string }> {
  const contexto = ImageManipulator.manipulate(a.uri);
  try {
    const lado = Math.max(a.width || 0, a.height || 0);
    if (lado > LADO_MAXIMO) {
      contexto.resize(a.width >= a.height ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO });
    }
    const imagem = await contexto.renderAsync();
    try {
      const r = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      return { uri: r.uri, nome: `fotografia-${Date.now()}.jpg`, tipo: "image/jpeg" };
    } finally {
      imagem.release();
    }
  } finally {
    contexto.release();
  }
}

export function Fotografias({
  negociacaoId,
  fotos,
  aoMudar,
  aoMudarOcupado,
  maximo = 8,
}: {
  negociacaoId: number;
  fotos: string[];
  /** O `set` do estado de quem usa — recebe funções, para duas fotografias a chegar não se pisarem. */
  aoMudar: Dispatch<SetStateAction<string[]>>;
  /** Há fotografias a caminho do site: o botão final espera por elas. */
  aoMudarOcupado?: (ocupado: boolean) => void;
  maximo?: number;
}) {
  const c = useCores();
  const [aEnviar, setAEnviar] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const restam = maximo - fotos.length - aEnviar;
  useEffect(() => aoMudarOcupado?.(aEnviar > 0), [aEnviar, aoMudarOcupado]);

  async function juntar(origem: "camara" | "galeria") {
    setErro(null);
    let r: ImagePicker.ImagePickerResult;
    try {
      if (origem === "camara") {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          setErro("A app não tem acesso à câmara. Autorize-o nas definições do telemóvel, em Aplicações › CLYON Pro.");
          return;
        }
        r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
      } else {
        r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: restam,
          quality: 1,
        });
      }
    } catch {
      setErro("Não foi possível abrir a câmara ou as fotografias. Tente outra vez.");
      return;
    }
    if (r.canceled || !r.assets?.length) return;

    for (const a of r.assets.slice(0, restam)) {
      setAEnviar((n) => n + 1);
      try {
        const f = await reduzir(a);
        const { url } = await enviarFotografia(negociacaoId, f);
        aoMudar((antes) => (antes.includes(url) ? antes : [...antes, url].slice(0, maximo)));
      } catch (e) {
        setErro(e instanceof ErroDaApi ? e.message : "Uma fotografia não seguiu. Tente outra vez.");
      } finally {
        setAEnviar((n) => n - 1);
      }
    }
  }

  return (
    <View style={{ gap: ESPACO.s }}>
      {fotos.length > 0 || aEnviar > 0 ? (
        <View style={estilos.grelha}>
          {fotos.map((u, i) => (
            <View key={u} style={estilos.celula}>
              <Pressable onPress={() => setAberta(i)} accessibilityRole="imagebutton" accessibilityLabel={`Ver a fotografia ${i + 1}`}>
                <Image source={{ uri: u }} style={[estilos.miniatura, { backgroundColor: c.fundo }]} />
              </Pressable>
              <Pressable
                onPress={() => aoMudar((antes) => antes.filter((x) => x !== u))}
                accessibilityRole="button"
                accessibilityLabel={`Tirar a fotografia ${i + 1}`}
                hitSlop={8}
                style={[estilos.tirar, { backgroundColor: c.tinta }]}
              >
                <Text style={{ color: c.superficie, fontWeight: "800", fontSize: 14, lineHeight: 16 }}>×</Text>
              </Pressable>
            </View>
          ))}
          {Array.from({ length: aEnviar }, (_, i) => (
            <View key={`a-enviar-${i}`} style={[estilos.miniatura, estilos.aEnviar, { backgroundColor: c.fundo, borderColor: c.linha }]}>
              <Text style={{ color: c.suave, fontSize: LETRA.pequena }}>A enviar…</Text>
            </View>
          ))}
        </View>
      ) : null}
      <VerFotografias key={aberta ?? -1} fotos={fotos} inicio={aberta} aoFechar={() => setAberta(null)} />

      {restam > 0 ? (
        <View style={estilos.botoes}>
          <View style={{ flex: 1 }}>
            <Botao titulo="Fotografar" tipo="secundario" aoCarregar={() => void juntar("camara")} />
          </View>
          <View style={{ flex: 1 }}>
            <Botao titulo="Da galeria" tipo="secundario" aoCarregar={() => void juntar("galeria")} />
          </View>
        </View>
      ) : (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>Chegou às {maximo} fotografias.</Text>
      )}
      {erro ? <Mensagem texto={erro} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grelha: { flexDirection: "row", flexWrap: "wrap", gap: ESPACO.s },
  celula: { position: "relative" },
  miniatura: { width: 92, height: 92, borderRadius: RAIO.m },
  aEnviar: { borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  tirar: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  botoes: { flexDirection: "row", gap: ESPACO.s },
});
