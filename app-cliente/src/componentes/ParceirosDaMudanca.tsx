import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import { CartaoDoParceiro } from "./CartaoDoParceiro";
import { Text } from "./Texto";
import { Aviso, Carregando, Escolhas, Paragrafo, Recolhido } from "./ui";
import { pessoasDoEcra, type ListaDosParceiros, type Pessoas } from "../lib/parceiros-da-mudanca";
import { CORES } from "../tema";

/** As duas equipas, como os botões do simulador do site. */
const EQUIPAS: ReadonlyArray<{ id: "2" | "3"; nome: string }> = [
  { id: "2", nome: "2 pessoas" },
  { id: "3", nome: "3 pessoas" },
];

/**
 * O ECRÃ «PARCEIROS DISPONÍVEIS PARA A SUA MUDANÇA» — 11-11-2026, o do
 * simulador do site (`ParceirosDaMudanca.tsx`) na app: o resumo, a equipa (2
 * ou 3 — trocar volta a pedir a lista), os cartões (até três escolhidos),
 * «Como ordenamos» recolhido e, com um só parceiro, a caixa «Pedir também à
 * CLYON que procure mais parceiros». O botão de baixo é o do Pedir
 * (`NovoPedido.tsx`). Os textos vêm todos da rota.
 */
export function ParceirosDaMudanca({
  lista,
  aCarregar,
  pessoas,
  aoMudarPessoas,
  ids,
  aoTocar,
  procurarMais,
  aoMudarProcurarMais,
  embalamento = false,
  aoMudarEmbalamento,
}: {
  lista: ListaDosParceiros | null;
  aCarregar: boolean;
  pessoas: Pessoas;
  aoMudarPessoas: (p: Pessoas) => void;
  ids: readonly string[];
  aoTocar: (id: string) => void;
  procurarMais: boolean;
  aoMudarProcurarMais: (v: boolean) => void;
  /** As caixas e o embalamento (11-11-2026). */
  embalamento?: boolean;
  aoMudarEmbalamento?: (v: boolean) => void;
}) {
  const l = lista && lista.ligado ? lista : null;
  // Num T3 ou maior só há equipa de 3 (a rota di-lo): o botão das 2 sai, e o ecrã mostra 3.
  const daConta = pessoasDoEcra(lista, pessoas);
  const equipas = l?.soComTres ? EQUIPAS.filter((e) => e.id === "3") : EQUIPAS;
  const comEmbalamento = !!l && l.parceiros.some((p) => p.embalamento != null);
  return (
    <View style={{ gap: 16 }}>
      {l?.resumo ? <Paragrafo suave>{l.resumo}</Paragrafo> : null}
      <Escolhas opcoes={equipas} valor={daConta === 3 ? "3" : "2"} aoEscolher={(v) => aoMudarPessoas(v === "3" ? 3 : 2)} rotulo="Pessoas na equipa" />
      {l?.recomendaTres ? <Aviso tom="aviso" texto={l.recomendaTres} /> : null}

      {aCarregar ? <Carregando texto="A procurar parceiros para estas moradas…" /> : null}

      {!aCarregar && l && l.parceiros.length === 0 ? (
        <View style={{ gap: 6, borderRadius: 16, backgroundColor: CORES.superficie, padding: 14 }}>
          {l.semParceiros ? (
            <Text titulo style={{ color: CORES.tinta, fontSize: 15, fontWeight: "600", lineHeight: 21 }}>
              {l.semParceiros}
            </Text>
          ) : null}
          {l.textos.semParceirosSegue ? <Paragrafo pequeno>{l.textos.semParceirosSegue}</Paragrafo> : null}
        </View>
      ) : null}

      {!aCarregar && l && l.parceiros.length > 0 ? (
        <View style={{ gap: 12 }}>
          {l.textos.escolha ? <Paragrafo>{l.textos.escolha}</Paragrafo> : null}
          {comEmbalamento && aoMudarEmbalamento && l.textos.pedirEmbalamento ? (
            <Pressable
              onPress={() => aoMudarEmbalamento(!embalamento)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: embalamento }}
              style={{ flexDirection: "row", gap: 12, paddingVertical: 8, alignItems: "flex-start" }}
            >
              <Ionicons name={embalamento ? "checkbox" : "square-outline"} size={22} color={CORES.marca} />
              <Text style={{ flex: 1, color: CORES.tinta, fontSize: 14, lineHeight: 20 }}>{l.textos.pedirEmbalamento}</Text>
            </Pressable>
          ) : null}
          {l.parceiros.map((p) => (
            <CartaoDoParceiro
              key={p.id}
              p={p}
              pessoas={daConta}
              embalamento={embalamento}
              marcado={ids.includes(p.id)}
              cheio={ids.length >= l.maximo}
              aoTocar={() => aoTocar(p.id)}
            />
          ))}
          {l.parceiros.length === 1 && l.textos.procurarMais ? (
            <Pressable
              onPress={() => aoMudarProcurarMais(!procurarMais)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: procurarMais }}
              style={{ flexDirection: "row", gap: 12, paddingVertical: 8, alignItems: "flex-start" }}
            >
              <Ionicons name={procurarMais ? "checkbox" : "square-outline"} size={22} color={CORES.marca} />
              <Text style={{ flex: 1, color: CORES.tinta, fontSize: 14, lineHeight: 20 }}>{l.textos.procurarMais}</Text>
            </Pressable>
          ) : null}
          {l.textos.notaDaEstimativa || l.textos.quemFaz ? (
            <Text style={{ color: CORES.suave, fontSize: 12.5, lineHeight: 18 }}>
              {[l.textos.notaDaEstimativa, l.textos.quemFaz].filter(Boolean).join(" ")}
            </Text>
          ) : null}
          {l.ordenacao ? (
            <Recolhido titulo={l.ordenacao.titulo}>
              <Text style={{ color: CORES.suave, fontSize: 13, lineHeight: 19 }}>{l.ordenacao.frase}</Text>
            </Recolhido>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
