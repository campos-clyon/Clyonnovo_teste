import { Image, View, type ImageSourcePropType } from "react-native";
import { Text } from "./Texto";
import { CORES } from "../tema";

/**
 * OS VEÍCULOS DE «QUANTO HÁ PARA LEVAR?» — 03-11-2026. *«Devia ter imagens dos
 * veículos ilustrando cada um, pequenas para caber todos e ficar bem
 * ilustrado, e os espaços bem usados.»* — o dono, com uma maqueta: cartões em
 * duas colunas, a carga em azul-petróleo, a cabine branca, linhas de movimento.
 *
 * As ilustrações são da casa (`assets/veiculos/*.svg`, passadas a PNG a 1x, 2x
 * e 3x): vão dentro da app e das actualizações, sem nada a descarregar. A
 * cabine fica sempre no mesmo sítio e o tamanho vê-se no comprimento e na
 * altura da carga — caixa aberta, caixa fechada, caixa comprida com eixo
 * duplo. «Não tenho a certeza» é o ponto de interrogação num círculo. Os
 * mesmos ids nas três perguntas: o volume dos monos, dos móveis e do
 * esvaziamento, o «Quanto enche?» do entulho e a quantidade da garagem, do
 * sótão e da cave.
 */
const IMAGENS: Readonly<Record<string, ImageSourcePropType>> = {
  carrinha: require("../../assets/veiculos/carrinha.png"),
  camiao_caixa: require("../../assets/veiculos/camiao_caixa.png"),
  camiao_lixo: require("../../assets/veiculos/camiao_lixo.png"),
};

/** A altura da ilustração no cartão (as imagens são de 150 × 64). */
const ALTURA = 58;

function Interrogacao({ diametro }: { diametro: number }) {
  return (
    <View style={{ width: diametro, height: diametro, borderRadius: diametro / 2, backgroundColor: "#D7F1F5", alignItems: "center", justifyContent: "center" }}>
      <Text titulo style={{ color: CORES.tinta, fontSize: Math.round(diametro * 0.6), lineHeight: Math.round(diametro * 0.75), fontWeight: "800" }}>
        ?
      </Text>
    </View>
  );
}

/**
 * O veículo de um volume. `pequeno` é o do cartão da escolha feita (ao lado do
 * nome); sem ele, o do cartão das opções. `null` para um id sem ilustração.
 */
export function Veiculo({ id, pequeno = false }: { id: string; escolhido?: boolean; pequeno?: boolean }) {
  const imagem = IMAGENS[id];
  if (!imagem && id !== "incerto") return null;
  if (pequeno) {
    return imagem ? <Image source={imagem} style={{ width: 52, height: 22 }} resizeMode="contain" /> : <Interrogacao diametro={24} />;
  }
  return (
    <View
      style={{ alignSelf: "stretch", height: ALTURA, alignItems: "center", justifyContent: "center" }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {imagem ? <Image source={imagem} style={{ alignSelf: "stretch", height: ALTURA }} resizeMode="contain" /> : <Interrogacao diametro={50} />}
    </View>
  );
}

/** Tem ilustração? (os ids dos volumes). */
export const temVeiculo = (id: string) => id in IMAGENS || id === "incerto";
