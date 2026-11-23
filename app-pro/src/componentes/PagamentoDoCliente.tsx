import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "./Texto";
import { Botao, Caixa, Mensagem, TituloDaCaixa } from "./ui";
import { ErroDaApi, pedir } from "../lib/api";
import type { Trabalho } from "../lib/trabalhos";
import { ESPACO, LETRA, useCores } from "../tema";

/**
 * «PAGAMENTO DO CLIENTE» — d3 (CEO e dono, 23-11-2026), o mesmo bloco do painel
 * (`PagamentoDoCliente.tsx`). No trabalho contratado do modelo de 15-11: o que o
 * cliente disse («O cliente diz que lhe pagou … por …. Recebeu?») com «Sim,
 * recebi» / «Ainda não recebi», ou «O cliente já me pagou» quando ele ainda não
 * disse nada. A CLYON só regista: o dinheiro vai diretamente para o parceiro. A
 * frase e os botões vêm do servidor (`pagamentoRegistado` de
 * /api/profissionais/meus-pedidos): sem ele (fora do modelo novo, ou um site
 * antigo) não desenha nada, e a app não escreve preços.
 */
export const ROTA_DO_PAGAMENTO_DO_CLIENTE = "/api/profissionais/trabalho/pagamento";

type Pagamento = NonNullable<Trabalho["pagamentoRegistado"]>;

export function PagamentoDoCliente({ t }: { t: Pick<Trabalho, "negociacaoId" | "pagamentoRegistado"> }) {
  const c = useCores();
  const [atual, setAtual] = useState<Pagamento | null>(t.pagamentoRegistado ?? null);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // A lista relê-se: o que o servidor diz ganha ao que ficou da última resposta.
  useEffect(() => {
    setAtual(t.pagamentoRegistado ?? null);
  }, [t.pagamentoRegistado]);
  if (!atual) return null;

  async function responder(accao: "recebi" | "nao_recebi") {
    setAGravar(true);
    setErro(null);
    try {
      const r = await pedir<{ registo?: Pagamento["registo"] }>(ROTA_DO_PAGAMENTO_DO_CLIENTE, {
        metodo: "POST",
        corpo: { negociacaoId: t.negociacaoId, accao },
      });
      const registo = r.registo;
      if (!registo) return;
      setAtual(
        registo.pago
          ? { registo, texto: "Pago", botoes: [] }
          : { registo, texto: "Disse que ainda não recebeu. Avisámos a equipa.", botoes: (atual?.botoes ?? []).filter((b) => b.accao === "recebi") },
      );
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível registar. Tente novamente.");
    } finally {
      setAGravar(false);
    }
  }

  return (
    <Caixa>
      <TituloDaCaixa>Pagamento do cliente</TituloDaCaixa>
      {atual.texto ? <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{atual.texto}</Text> : null}
      {atual.botoes.length > 0 ? (
        <View style={{ gap: ESPACO.s }}>
          {atual.botoes.map((b) => (
            <Botao
              key={b.accao}
              titulo={b.texto}
              tipo={b.accao === "recebi" ? "principal" : "secundario"}
              ocupado={aGravar}
              aoCarregar={() => void responder(b.accao)}
            />
          ))}
        </View>
      ) : null}
      {erro ? <Mensagem tom="mau" texto={erro} /> : null}
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
        A CLYON só regista: o dinheiro vai diretamente para si, e a taxa da plataforma não muda.
      </Text>
    </Caixa>
  );
}
