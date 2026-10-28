import { router } from "expo-router";
import { View } from "react-native";
import { Botao, Ecra, Ligacao, Paragrafo, Titulo } from "../componentes/ui";
import { useCatalogo } from "../estado/Catalogo";
import { whatsappDaClyon } from "../lib/abrir";

/**
 * E0 — BOAS-VINDAS (sem sessão).
 *
 * O texto é a frase-padrão do topo do site, para dizerem o mesmo. Por baixo,
 * a frase única da CLYON, tal como vem do catálogo (R7) — a app não a escreve.
 */
export default function BemVindo() {
  const { catalogo } = useCatalogo();
  return (
    <Ecra>
      <View style={{ height: 32 }} />
      <Titulo>Recolhas, esvaziamentos e mudanças</Titulo>
      <Paragrafo>
        Descreva o que precisa. Profissionais verificados da sua zona respondem com o preço deles, e escolhe quem vai.
      </Paragrafo>
      {catalogo?.textos.fraseUnica ? (
        <Paragrafo pequeno suave>
          {catalogo.textos.fraseUnica}
        </Paragrafo>
      ) : null}
      <View style={{ gap: 12, marginTop: 8 }}>
        <Botao titulo="Pedir orçamento" aoCarregar={() => router.push("/pedir")} />
        <Botao titulo="Já tenho conta — entrar" tipo="secundario" aoCarregar={() => router.push("/entrar")} />
      </View>
      <Ligacao titulo="Falar com a CLYON por WhatsApp" centrada aoCarregar={() => whatsappDaClyon()} />
    </Ecra>
  );
}
