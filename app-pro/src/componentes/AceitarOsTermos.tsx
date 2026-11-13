import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, View } from "react-native";
import { RolagemComTeclado } from "./Teclado";
import { Text } from "./Texto";
import { Botao, Mensagem } from "./ui";
import { ErroDaApi, pedir, SITE } from "../lib/api";
import { mostrarOsTermos, ROTA_DOS_TERMOS, termosLidos, type EstadoDosTermos } from "../lib/novo-modelo";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * OS TERMOS DE 15-11-2026 NO PRIMEIRO ACESSO — d20 (CEO e dono, 13-11-2026). O
 * mesmo ecrã do painel (`AceitarOsTermos.tsx` do site), com os textos que a rota
 * manda (`GET /api/profissionais/termos`, os do Jurídico): o resumo, a ligação aos
 * Termos completos e a caixa — NUNCA marcada; «Aceitar e continuar» só funciona
 * com ela marcada e grava pela mesma rota (`POST { versao, aceito: true }`).
 *
 * QUEM DIZ SE APARECE É O SERVIDOR (`precisaDeAceitar`), nunca o relógio do
 * telemóvel: antes de 15-11, ou já aceite esta versão, não aparece nada.
 *
 * NÃO BLOQUEIA: «Agora não» fecha o ecrã até a app voltar a abrir; ele continua a
 * ver os pedidos, a aceitar e a propor como antes (o bloqueio está por confirmar
 * pelo advogado — `aceitacao-dos-termos.ts`).
 */
let adiadoNestaAbertura: string | null = null;

export function AceitarOsTermos() {
  const c = useCores();
  const [estado, setEstado] = useState<EstadoDosTermos | null>(null);
  const [marcada, setMarcada] = useState(false);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    pedir<unknown>(ROTA_DOS_TERMOS)
      .then((r) => {
        const t = termosLidos(r);
        if (vivo && mostrarOsTermos(t, adiadoNestaAbertura)) setEstado(t);
      })
      .catch(() => {
        // Sem rede, ou um site sem a rota: não se mostra nada; volta a perguntar na próxima abertura.
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (!estado) return null;
  const t = estado.textos;

  function agoraNao() {
    adiadoNestaAbertura = estado?.versao ?? null;
    setEstado(null);
  }

  async function aceitar() {
    if (!marcada || !estado) return;
    setAGravar(true);
    setErro(null);
    try {
      await pedir(ROTA_DOS_TERMOS, { metodo: "POST", corpo: { versao: estado.versao, aceito: true } });
      setEstado(null);
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível guardar. Tente novamente.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={agoraNao}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.5)" }}>
        <View style={{ maxHeight: "88%", backgroundColor: c.superficie, borderTopLeftRadius: RAIO.l, borderTopRightRadius: RAIO.l }}>
          <RolagemComTeclado contentContainerStyle={{ padding: ESPACO.l, gap: ESPACO.m }}>
            <Text accessibilityRole="header" style={{ color: c.tinta, fontSize: LETRA.media, fontWeight: "800" }}>
              {t.titulo}
            </Text>
            <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{t.resumo}</Text>
            <Pressable onPress={() => void Linking.openURL(`${SITE}${t.url}`)} accessibilityRole="link" hitSlop={6}>
              <Text style={{ color: c.marca, fontWeight: "700", textDecorationLine: "underline" }}>{t.ligacao}</Text>
            </Pressable>
            <CaixaDeMarcar texto={t.caixa} marcada={marcada} aoMudar={setMarcada} />
            {erro ? <Mensagem texto={erro} /> : null}
            <Botao titulo={t.aceitar} desactivado={!marcada} ocupado={aGravar} aoCarregar={() => void aceitar()} />
            <Pressable onPress={agoraNao} accessibilityRole="button" hitSlop={6} style={{ alignSelf: "center", paddingVertical: ESPACO.s }}>
              <Text style={{ color: c.suave, fontWeight: "600", textDecorationLine: "underline" }}>{t.agoraNao}</Text>
            </Pressable>
          </RolagemComTeclado>
        </View>
      </View>
    </Modal>
  );
}

/** A caixa de marcar — começa sempre por marcar (quem a usa passa `marcada` a falso). */
export function CaixaDeMarcar({ texto, marcada, aoMudar }: { texto: string; marcada: boolean; aoMudar: (v: boolean) => void }) {
  const c = useCores();
  return (
    <Pressable
      onPress={() => aoMudar(!marcada)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: ESPACO.s }}
    >
      <Ionicons name={marcada ? "checkbox" : "square-outline"} size={24} color={marcada ? c.marca : c.suave} />
      <Text style={{ flex: 1, color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{texto}</Text>
    </Pressable>
  );
}
