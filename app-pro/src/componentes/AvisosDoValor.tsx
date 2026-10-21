import { View } from "react-native";
import { Text } from "./Texto";
import { Mensagem } from "./ui";
import { avisoDaBase, lerBase } from "../../../src/lib/base-do-preco";
import { avisoDosItens } from "../../../src/lib/itens-a-mais";
import type { Trabalho } from "../lib/trabalhos";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * OS AVISOS DO VALOR — versão 12, os mesmos do painel (`Trabalhos.tsx`, por
 * baixo do valor), pela mesma ordem:
 *
 *   1. o valor é POR CARGA ou POR HORA — combine quantas antes de fechar;
 *   2. a conta da carrinha dele: o que uma carga vale nela, e quantas viagens
 *      o trabalho lhe leva (vem do site, `carga-da-carrinha.ts`);
 *   3. o que vale o que aparecer a mais (`itens-a-mais.ts`).
 *
 * Cada um só aparece quando há alguma coisa a dizer: um aviso em todos os
 * cartões deixa de se ler. As frases vêm do site — a app não as escreve.
 */
export function AvisosDoValor({ t }: { t: Trabalho }) {
  const c = useCores();
  const base = lerBase(t.baseDoPreco);
  const daBase = avisoDaBase(base);
  const dosItens = avisoDosItens(base, "profissional");
  const carga = t.cargaNaSuaCarrinha;
  if (!daBase && !carga && !dosItens) return null;
  return (
    <View style={{ gap: ESPACO.s }}>
      {daBase ? <Mensagem tom="aviso" texto={daBase} /> : null}
      {carga ? (
        <View style={{ borderWidth: 1, borderColor: c.aviso, borderRadius: RAIO.m, padding: ESPACO.m, gap: 2 }}>
          <Text style={{ color: c.aviso, fontWeight: "800", fontSize: LETRA.normal }}>{carga.titulo}</Text>
          <Text style={{ color: c.tinta, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{carga.texto}</Text>
        </View>
      ) : null}
      {dosItens ? (
        <View style={{ backgroundColor: c.marcaSuave, borderRadius: RAIO.m, padding: ESPACO.m }}>
          <Text style={{ color: c.marca, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{dosItens}</Text>
        </View>
      ) : null}
    </View>
  );
}
