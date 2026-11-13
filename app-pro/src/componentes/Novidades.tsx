import Ionicons from "@expo/vector-icons/Ionicons";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Texto";
import { SITE } from "../lib/api";
import {
  CHAVE_DA_NOVIDADE,
  caminhoDaNota,
  depoisDeLerANota,
  lerNota,
  lerVista,
  pedirNotaAoArrancar,
  PRAZO_DA_NOTA_MS,
  textoDaVista,
  TITULO_DA_NOVIDADE,
  type NotaRecebida,
} from "../lib/novidades";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * A NOTA DE CADA ATUALIZAÇÃO — d23, 13-11-2026. Regras em `lib/novidades.ts`.
 */

const pedidas = new Map<string, Promise<NotaRecebida | null>>();

/** Pede a nota ao site, uma vez por atualização. Sem rede ou com erro: null (e tenta-se outra vez depois). */
export function buscarNota(updateId: string | null | undefined): Promise<NotaRecebida | null> {
  const chave = updateId || "mais-recente";
  const ja = pedidas.get(chave);
  if (ja) return ja;
  const p = (async () => {
    const parar = new AbortController();
    const prazo = setTimeout(() => parar.abort(), PRAZO_DA_NOTA_MS);
    try {
      const r = await fetch(`${SITE}${caminhoDaNota("pro", updateId)}`, { signal: parar.signal });
      if (!r.ok) return null;
      return lerNota(await r.json());
    } catch {
      return null;
    } finally {
      clearTimeout(prazo);
    }
  })();
  pedidas.set(chave, p);
  void p.then((n) => {
    if (!n) pedidas.delete(chave);
  });
  return p;
}

/** A nota da atualização que vai entrar (null enquanto não chega, ou sem rede). */
export function useNotaDaAtualizacao(ligado: boolean, updateId: string | null | undefined): NotaRecebida | null {
  const [nota, setNota] = useState<NotaRecebida | null>(null);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    void buscarNota(updateId).then((n) => {
      if (vivo) setNota(n);
    });
    return () => {
      vivo = false;
    };
  }, [ligado, updateId]);
  return ligado ? nota : null;
}

/** Ele viu a nota antes de reiniciar: o cartão não volta a aparecer depois. */
export async function marcarNotaVista(updateId: string | null | undefined, nota: NotaRecebida | null): Promise<void> {
  if (!nota) return;
  try {
    await SecureStore.setItemAsync(CHAVE_DA_NOVIDADE, textoDaVista({ u: updateId ?? null, n: nota.id }));
  } catch {
    /* sem o cofre, o cartão aparece uma vez a mais — e é só isso */
  }
}

/** O cartão «O que há de novo», UMA vez depois de uma atualização que ele ainda não viu. */
export function OQueHaDeNovo() {
  if (Platform.OS === "web" || !Updates.isEnabled || __DEV__) return null;
  return <Cartao />;
}

function Cartao() {
  const c = useCores();
  const [nota, setNota] = useState<NotaRecebida | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const updateId = Updates.updateId;
      let vista = null;
      try {
        vista = lerVista(await SecureStore.getItemAsync(CHAVE_DA_NOVIDADE));
      } catch {
        /* sem o cofre: trata-se como nunca visto */
      }
      if (!updateId || !pedirNotaAoArrancar(vista, updateId, Updates.isEmbeddedLaunch)) return;
      const n = await buscarNota(updateId);
      if (!n || !vivo) return;
      const d = depoisDeLerANota(vista, updateId, n);
      try {
        await SecureStore.setItemAsync(CHAVE_DA_NOVIDADE, textoDaVista(d.guardar));
      } catch {
        /* fica por guardar: volta a aparecer da próxima vez */
      }
      if (vivo && d.mostrar) setNota(n);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (!nota) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[estilos.cartao, { backgroundColor: c.superficie, borderColor: c.linha }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.tinta, fontWeight: "800", fontSize: LETRA.normal }}>{TITULO_DA_NOVIDADE}</Text>
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 19 }}>{nota.nota}</Text>
      </View>
      <Pressable
        onPress={() => setNota(null)}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 2 })}
      >
        <Ionicons name="close" size={20} color={c.suave} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: ESPACO.s,
    borderWidth: 1,
    borderRadius: RAIO.l,
    paddingHorizontal: ESPACO.m,
    paddingVertical: ESPACO.m,
    marginBottom: ESPACO.s,
  },
});
