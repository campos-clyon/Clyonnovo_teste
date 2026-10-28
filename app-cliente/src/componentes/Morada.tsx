import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Texto";
import { Campo, Ligacao } from "./ui";
import { pedir } from "../lib/api";
import type { Morada } from "../lib/novo-pedido";
import { CORES } from "../tema";

/**
 * A MORADA COM SUGESTÕES (E3.2) — pelas rotas do servidor
 * (`/api/maps/autocomplete` e `/api/maps/place-details`), nunca com a chave do
 * navegador. Se as sugestões não responderem em 3 s, a morada escrita à mão
 * deixa seguir: nunca fica preso em «Morada obrigatória» sem saída (a lição do
 * simulador, 22-10-2026). Depois de escolher, o número de porta e o código
 * postal ficam editáveis.
 */

const PRAZO_DAS_SUGESTOES_MS = 3_000;
const ESPERA_AO_ESCREVER_MS = 400;

type Sugestao = { placeId: string; description: string };

function comPrazo<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("prazo")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function CampoDeMorada({
  rotulo,
  morada,
  aoMudar,
}: {
  rotulo: string;
  morada: Morada | undefined;
  aoMudar: (m: Morada | undefined) => void;
}) {
  const [texto, setTexto] = useState(morada?.formattedAddress ?? "");
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [semSugestoes, setSemSugestoes] = useState(false);
  const pedidoActual = useRef(0);
  const escolhida = !!morada && !morada.aMao && morada.formattedAddress === texto;

  useEffect(() => {
    const q = texto.trim();
    if (escolhida || q.length < 4) {
      setSugestoes([]);
      return;
    }
    const n = ++pedidoActual.current;
    const t = setTimeout(() => {
      comPrazo(pedir<{ predictions?: Sugestao[] }>("/api/maps/autocomplete", { metodo: "POST", corpo: { input: q }, semSessao: true }), PRAZO_DAS_SUGESTOES_MS)
        .then((r) => {
          if (n !== pedidoActual.current) return;
          setSugestoes((r.predictions ?? []).filter((s) => s.placeId && s.description).slice(0, 5));
          setSemSugestoes(false);
        })
        .catch(() => {
          if (n === pedidoActual.current) setSemSugestoes(true);
        });
    }, ESPERA_AO_ESCREVER_MS);
    return () => clearTimeout(t);
  }, [texto, escolhida]);

  async function escolher(s: Sugestao) {
    setSugestoes([]);
    setTexto(s.description);
    try {
      const d = await comPrazo(
        pedir<{ formattedAddress?: string; street?: string; streetNumber?: string; city?: string; postalCode?: string; lat?: number; lng?: number }>(
          "/api/maps/place-details",
          { metodo: "POST", corpo: { placeId: s.placeId }, semSessao: true },
        ),
        PRAZO_DAS_SUGESTOES_MS,
      );
      const formatada = d.formattedAddress || s.description;
      setTexto(formatada);
      aoMudar({
        formattedAddress: formatada,
        street: d.street || undefined,
        streetNumber: d.streetNumber || undefined,
        city: d.city || undefined,
        postalCode: d.postalCode || undefined,
        lat: typeof d.lat === "number" ? d.lat : undefined,
        lng: typeof d.lng === "number" ? d.lng : undefined,
        placeId: s.placeId,
      });
    } catch {
      aoMudar({ formattedAddress: s.description, placeId: s.placeId, aMao: true });
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Campo
        rotulo={rotulo}
        valor={texto}
        aoMudar={(v) => {
          setTexto(v);
          // Escrever à mão também conta: o profissional confirma no local.
          aoMudar(v.trim() ? { formattedAddress: v, aMao: true } : undefined);
        }}
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        ajuda={semSugestoes ? "As sugestões não responderam. Pode escrever a morada completa à mão e seguir." : null}
      />
      {sugestoes.map((s) => (
        <Pressable
          key={s.placeId}
          accessibilityRole="button"
          onPress={() => void escolher(s)}
          style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: CORES.superficie, opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: CORES.tinta, fontSize: 15 }} numberOfLines={2}>
            {s.description}
          </Text>
        </Pressable>
      ))}
      {morada && !morada.aMao ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="Número de porta"
              valor={morada.streetNumber ?? ""}
              aoMudar={(v) => aoMudar({ ...morada, streetNumber: v })}
              keyboardType="default"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Campo rotulo="Código postal" valor={morada.postalCode ?? ""} aoMudar={(v) => aoMudar({ ...morada, postalCode: v })} keyboardType="numbers-and-punctuation" />
          </View>
        </View>
      ) : null}
      {sugestoes.length > 0 ? <Ligacao titulo="Usar a morada como a escrevi" tom="suave" aoCarregar={() => setSugestoes([])} /> : null}
    </View>
  );
}
