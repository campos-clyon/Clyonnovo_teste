import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Botao, Caixa, TituloDaCaixa } from "./ui";
import { escolherFotografias, reduzirFotografiaDaCandidatura } from "./Fotografias";
import { enviarFicheiro, ErroDaApi, pedir } from "../lib/api";
import { diaCurto } from "../lib/conta";
import { AJUDA_DA_FATURA_NA_APP, MENSAGENS_DA_FATURA, NOME_DA_FATURA, ROTA_DA_FATURA, type FaturasDoTrabalho } from "../lib/novo-modelo";
import { ESPACO, LETRA, useCores } from "../tema";

/**
 * A FATURA DO TRABALHO — d10, o modelo de 15-11-2026. O cliente pagou-lhe
 * diretamente, e ele junta ao pedido a fatura que emitiu
 * (`POST /api/profissionais/trabalho/fatura`, campo `file`). Ao lado, a da taxa
 * da plataforma, quando a CLYON a juntar. As duas ficam no pedido do cliente.
 *
 * Quem decide se o trabalho é do modelo novo é o site (`novoModelo` da rota):
 * antes de 15-11, ou num trabalho que o cliente já pagou à CLYON, a resposta é
 * falsa e este bloco não desenha nada.
 */
export function FaturaDoTrabalho({ negociacaoId }: { negociacaoId: number }) {
  const c = useCores();
  const [faturas, setFaturas] = useState<FaturasDoTrabalho | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  const ler = useCallback(async () => {
    try {
      setFaturas(await pedir<FaturasDoTrabalho>(ROTA_DA_FATURA(negociacaoId)));
    } catch {
      // Sem resposta não se mostra nada: o resto do ecrã continua.
    }
  }, [negociacaoId]);

  useEffect(() => {
    void ler();
  }, [ler]);

  async function enviar(origem: "camara" | "galeria") {
    setErro(null);
    setFeito(false);
    const r = await escolherFotografias(origem, 1);
    if ("erro" in r) return setErro(r.erro);
    const a = r.fotografias[0];
    if (!a) return;
    setAEnviar(true);
    try {
      const f = await reduzirFotografiaDaCandidatura(a);
      await enviarFicheiro(ROTA_DA_FATURA(negociacaoId), { negociacaoId: String(negociacaoId) }, f);
      setFeito(true);
      await ler();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : MENSAGENS_DA_FATURA.falhou);
    } finally {
      setAEnviar(false);
    }
  }

  if (!faturas?.novoModelo) return null;
  const dele = faturas.doTrabalho;
  return (
    <Caixa>
      <TituloDaCaixa>As faturas deste trabalho</TituloDaCaixa>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
        O cliente paga-lhe o trabalho diretamente e recebe duas faturas: a sua, do trabalho, e a da taxa da plataforma.
      </Text>
      <Linha
        rotulo={NOME_DA_FATURA.parceiro}
        estado={dele ? `Junta${dele.em && diaCurto(dele.em) ? ` a ${diaCurto(dele.em)}` : ""}` : "Ainda não a juntou"}
        url={dele?.url ?? null}
        tom={dele ? "bom" : "aviso"}
      />
      <Linha
        rotulo={NOME_DA_FATURA.clyon}
        estado={faturas.daTaxa ? "Junta pela CLYON" : "A CLYON junta-a ao pedido"}
        url={faturas.daTaxa?.url ?? null}
      />
      <View style={{ flexDirection: "row", gap: ESPACO.s }}>
        <View style={{ flex: 1 }}>
          <Botao titulo={dele ? "Fotografar outra" : "Fotografar a fatura"} tipo="secundario" ocupado={aEnviar} aoCarregar={() => void enviar("camara")} />
        </View>
        <View style={{ flex: 1 }}>
          <Botao titulo="Da galeria" tipo="secundario" ocupado={aEnviar} aoCarregar={() => void enviar("galeria")} />
        </View>
      </View>
      {feito ? <Text style={{ color: c.bom, fontSize: LETRA.pequena + 1 }}>Fatura junta ao pedido. O cliente já a pode ver.</Text> : null}
      {erro ? <Text style={{ color: c.mau, fontSize: LETRA.pequena + 1 }}>{erro}</Text> : null}
      <Text style={{ color: c.suave, fontSize: LETRA.pequena, lineHeight: 18 }}>{AJUDA_DA_FATURA_NA_APP}</Text>
    </Caixa>
  );
}

function Linha({ rotulo, estado, url, tom }: { rotulo: string; estado: string; url: string | null; tom?: "bom" | "aviso" }) {
  const c = useCores();
  const cor = tom === "bom" ? c.bom : tom === "aviso" ? c.aviso : c.suave;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: ESPACO.s }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.normal }}>{rotulo}</Text>
        <Text style={{ color: cor, fontSize: LETRA.pequena + 1 }}>{estado}</Text>
      </View>
      {url ? (
        <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" hitSlop={8}>
          <Text style={{ color: c.marca, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>Ver</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
