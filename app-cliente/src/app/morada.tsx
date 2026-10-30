import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../componentes/Texto";
import { Aviso, Campo, Ecra, Paragrafo } from "../componentes/ui";
import { useSessao } from "../estado/Sessao";
import { mensagemDe, pedir } from "../lib/api";
import { guardarMorada } from "../lib/morada-do-cliente";
import type { Morada } from "../lib/novo-pedido";
import { CORES } from "../tema";

/**
 * «A SUA MORADA» (barra de cima, 30-10-2026) — procura com as sugestões da
 * rota do site `/api/maps/autocomplete` (POST { input }, devolve
 * `predictions`), e os pormenores de `/api/maps/place-details`. Ao escolher,
 * guarda: na conta com sessão, no telemóvel sem sessão (morada-do-cliente.ts).
 */
export const ROTA_DAS_SUGESTOES = "/api/maps/autocomplete";
const ESPERA_AO_ESCREVER_MS = 400;

type Sugestao = { placeId: string; description: string; mainText?: string; secondaryText?: string };

export default function AMorada() {
  const { ligado } = useSessao();
  const [texto, setTexto] = useState("");
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const pedidoActual = useRef(0);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 3) {
      setSugestoes([]);
      return;
    }
    const n = ++pedidoActual.current;
    const t = setTimeout(() => {
      pedir<{ predictions?: Sugestao[] }>(ROTA_DAS_SUGESTOES, { metodo: "POST", corpo: { input: q }, semSessao: true })
        .then((r) => {
          if (n !== pedidoActual.current) return;
          setSugestoes((r.predictions ?? []).filter((s) => s.placeId && s.description).slice(0, 6));
          setErro(null);
        })
        .catch(() => {
          if (n === pedidoActual.current) setErro("Não foi possível procurar agora. Tente outra vez daqui a pouco.");
        });
    }, ESPERA_AO_ESCREVER_MS);
    return () => clearTimeout(t);
  }, [texto]);

  async function escolher(s: Sugestao) {
    setAGuardar(true);
    setErro(null);
    let m: Morada = { formattedAddress: s.description, placeId: s.placeId, aMao: true };
    try {
      const d = await pedir<{ formattedAddress?: string; street?: string; streetNumber?: string; city?: string; postalCode?: string; lat?: number; lng?: number }>(
        "/api/maps/place-details",
        { metodo: "POST", corpo: { placeId: s.placeId }, semSessao: true },
      );
      m = {
        formattedAddress: d.formattedAddress || s.description,
        street: d.street || undefined,
        streetNumber: d.streetNumber || undefined,
        city: d.city || undefined,
        postalCode: d.postalCode || undefined,
        lat: typeof d.lat === "number" ? d.lat : undefined,
        lng: typeof d.lng === "number" ? d.lng : undefined,
        placeId: s.placeId,
      };
    } catch {
      /* sem pormenores: fica a morada da sugestão */
    }
    try {
      await guardarMorada(m, ligado);
      router.back();
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível guardar a morada."));
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Ecra>
      <Paragrafo suave>{ligado ? "Fica guardada na sua conta e aparece já preenchida no pedido." : "Fica guardada neste telemóvel e aparece já preenchida no pedido."}</Paragrafo>
      <Campo rotulo="Procurar morada" valor={texto} aoMudar={setTexto} placeholder="Rua, número, localidade" autoFocus autoCorrect={false} />
      {erro ? <Aviso texto={erro} tom="aviso" /> : null}
      <View style={{ gap: 4 }}>
        {sugestoes.map((s) => (
          <Pressable
            key={s.placeId}
            disabled={aGuardar}
            onPress={() => void escolher(s)}
            accessibilityRole="button"
            accessibilityLabel={s.description}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: CORES.linha, opacity: pressed || aGuardar ? 0.6 : 1 })}
          >
            <Ionicons name="location-outline" size={20} color={CORES.marca} />
            <View style={{ flex: 1 }}>
              <Text titulo style={{ color: CORES.tinta, fontSize: 14.5, fontWeight: "600" }} numberOfLines={1}>
                {s.mainText || s.description}
              </Text>
              {s.secondaryText ? (
                <Text style={{ color: CORES.suave, fontSize: 12.5 }} numberOfLines={1}>
                  {s.secondaryText}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
    </Ecra>
  );
}
