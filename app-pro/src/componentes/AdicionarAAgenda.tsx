import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Text } from "./Texto";
import { Botao, Caixa, Mensagem, TituloDaCaixa } from "./ui";
import { useTrabalhos } from "../estado/Trabalhos";
import { ErroDaApi, pedir } from "../lib/api";
import { TEXTOS_DA_AGENDA } from "../../../src/lib/textos-da-agenda-do-profissional";
import { ESPACO, LETRA, useCores } from "../tema";
import type { Trabalho } from "../lib/trabalhos";

/**
 * «ADICIONAR À MINHA AGENDA» — d144 (dono, 27-11-2026), o mesmo do painel.
 *
 * Num trabalho contratado com dia marcado: o Google Agenda e o ficheiro .ics
 * (Apple, Outlook e os outros), os dois abertos no navegador do telemóvel
 * (`Linking`) — sem módulos nativos novos, para sair por EAS Update. As
 * ligações vêm da rota (`POST /api/profissionais/pedidos/[id]/agenda`); a do
 * .ics vem assinada por 15 minutos, porque o navegador não leva a sessão da
 * app. A rota guarda o dia marcado: se mudar depois, a lista traz
 * `agendaDiaMudou` e aparece «O dia mudou — actualize na sua agenda».
 */
export function mostrarAdicionarAAgenda(t: Pick<Trabalho, "fase" | "dataCombinada">): boolean {
  return t.fase === "a_executar" && !!t.dataCombinada;
}

export function AdicionarAAgenda({ t }: { t: Trabalho }) {
  const c = useCores();
  const { recarregar } = useTrabalhos();
  const [aAbrir, setAAbrir] = useState<"google" | "ics" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  if (!mostrarAdicionarAAgenda(t)) return null;

  async function abrir(qual: "google" | "ics") {
    setErro(null);
    setAAbrir(qual);
    try {
      const r = await pedir<{ google: string; ics: string }>(`/api/profissionais/pedidos/${t.negociacaoId}/agenda`, {
        metodo: "POST",
      });
      await Linking.openURL(qual === "google" ? r.google : r.ics);
      // O «O dia mudou» sai: o dia que ele pôs na agenda é o de agora.
      void recarregar().catch(() => {});
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível abrir. Tente outra vez.");
    } finally {
      setAAbrir(null);
    }
  }

  return (
    <Caixa>
      <TituloDaCaixa>{TEXTOS_DA_AGENDA.titulo}</TituloDaCaixa>
      {t.agendaDiaMudou ? (
        <Mensagem tom="aviso" texto={TEXTOS_DA_AGENDA.diaMudou} />
      ) : (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{TEXTOS_DA_AGENDA.explicacao}</Text>
      )}
      <View style={estilos.lado}>
        <View style={{ flex: 1 }}>
          <Botao
            titulo={TEXTOS_DA_AGENDA.google}
            tipo="secundario"
            ocupado={aAbrir === "google"}
            desactivado={aAbrir !== null}
            aoCarregar={() => void abrir("google")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Botao
            titulo={TEXTOS_DA_AGENDA.outra}
            tipo="secundario"
            ocupado={aAbrir === "ics"}
            desactivado={aAbrir !== null}
            aoCarregar={() => void abrir("ics")}
          />
        </View>
      </View>
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  lado: { flexDirection: "row", gap: ESPACO.s, marginTop: ESPACO.s },
});
