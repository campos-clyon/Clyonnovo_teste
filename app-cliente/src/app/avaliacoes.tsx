import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "../componentes/Texto";
import { Aviso, Botao, Carregando, Ecra, Paragrafo } from "../componentes/ui";
import { mensagemDe, pedir } from "../lib/api";
import { avaliacoesRecebidas, ROTA_DAS_AVALIACOES, type AvaliacoesRecebidas } from "../lib/avaliacoes";
import { CORES } from "../tema";

/**
 * AS MINHAS AVALIAÇÕES (Perfil, 29-10-2026) — só as que o cliente RECEBEU dos
 * parceiros (`GET /api/cliente/avaliacoes`). As que ele deu não aparecem:
 * depois de feitas não se mudam e ficam guardadas no site.
 */
export default function AsMinhasAvaliacoes() {
  const [dados, setDados] = useState<AvaliacoesRecebidas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setErro(null);
    pedir<unknown>(ROTA_DAS_AVALIACOES)
      .then((r) => setDados(avaliacoesRecebidas(r)))
      .catch((e) => setErro(mensagemDe(e, "Não foi possível ler as avaliações.")));
  }, []);
  useEffect(carregar, [carregar]);

  if (!dados && !erro) return <Carregando />;
  return (
    <Ecra>
      {erro ? (
        <View style={{ gap: 10 }}>
          <Aviso texto={erro} tom="mau" />
          <Botao titulo="Tentar outra vez" tipo="secundario" aoCarregar={carregar} />
        </View>
      ) : null}
      {dados ? (
        <>
          {dados.mediaTexto ? (
            <Text titulo style={{ color: CORES.tinta, fontSize: 17, fontWeight: "600" }}>
              {`${dados.mediaTexto} ★ · ${dados.total === 1 ? "1 avaliação" : `${dados.total} avaliações`}`}
            </Text>
          ) : null}
          {dados.avaliacoes.length === 0 ? (
            <Paragrafo suave>Ainda não recebeu avaliações. Depois de um trabalho feito, o parceiro pode deixar a sua aqui.</Paragrafo>
          ) : (
            dados.avaliacoes.map((a, i) => (
              <View key={i} style={{ borderWidth: 1, borderColor: CORES.linha, borderRadius: 16, padding: 14, gap: 4 }}>
                <Text style={{ color: CORES.estrela, fontSize: 16, fontWeight: "700" }} accessibilityLabel={`${a.estrelas} de 5 estrelas`}>
                  {"★".repeat(a.estrelas) + "☆".repeat(5 - a.estrelas)}
                </Text>
                {a.comentario ? <Text style={{ color: CORES.tinta, fontSize: 15, lineHeight: 21 }}>{a.comentario}</Text> : null}
                <Text style={{ color: CORES.suave, fontSize: 13 }}>{[a.parceiro, a.servico, a.quandoTexto].filter(Boolean).join(" · ")}</Text>
              </View>
            ))
          )}
        </>
      ) : null}
    </Ecra>
  );
}
