import { View } from "react-native";
import { Text } from "./Texto";
import { Caixa, TituloDaCaixa } from "./ui";
import type { Trabalho } from "../lib/trabalhos";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * «COMO RECEBE» — d4 (CEO e dono, 18-11-2026), o mesmo bloco do painel
 * (`ComoRecebeDoTrabalho.tsx`). No trabalho contratado do modelo de 15-11: a
 * forma que o cliente escolheu para lhe pagar, a frase do valor e o que passa
 * à CLYON, até quando — «A passar à CLYON · X € até dd/mm» dentro do prazo,
 * «Em atraso» só depois dele. Tudo vem do servidor (`comoRecebe` de
 * /api/profissionais/meus-pedidos): sem ele (fora do modelo novo, ou um site
 * antigo) não desenha nada.
 */
export function ComoRecebe({ t }: { t: Pick<Trabalho, "comoRecebe"> }) {
  const c = useCores();
  const cr = t.comoRecebe;
  if (!cr) return null;
  const cor =
    cr.estado === "em_atraso"
      ? { fundo: c.mauSuave, tinta: c.mau }
      : cr.estado === "passado"
        ? { fundo: c.bomSuave, tinta: c.bom }
        : { fundo: c.avisoSuave, tinta: c.tinta };
  return (
    <Caixa>
      <TituloDaCaixa>{cr.titulo}</TituloDaCaixa>
      <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{cr.formaTexto}</Text>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{cr.fraseDoValor}.</Text>
      {cr.linhaDoValor ? (
        <View style={{ borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, paddingVertical: ESPACO.s, backgroundColor: cor.fundo }}>
          <Text style={{ color: cor.tinta, fontWeight: "700", fontSize: LETRA.normal, lineHeight: 22 }}>{cr.linhaDoValor}</Text>
        </View>
      ) : null}
    </Caixa>
  );
}
