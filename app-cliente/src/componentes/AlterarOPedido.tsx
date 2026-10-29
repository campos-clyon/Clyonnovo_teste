import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "./Texto";
import { Aviso, Botao, Campo, Escolhas, Folha, Ligacao, Paragrafo } from "./ui";
import { whatsappDaClyon } from "../lib/abrir";
import { ErroDaApi, mensagemDe } from "../lib/api";
import type { Pedir } from "../lib/erros";
import { enviarFotografia, escolherFotografias, reduzirFotografia } from "../lib/fotografias";
import { ANDARES, diasParaEscolher, ELEVADOR, ESTACIONAMENTO, primeiroDiaPossivel, TEXTO_DO_QUANDO, type Acesso, type Quando } from "../lib/novo-pedido";
import { corpoDaAlteracao, DIAS_PARA_ALTERAR, MAXIMO_DOS_PORMENORES, ROTA_DA_ALTERACAO, TEXTOS_DA_ALTERACAO as T } from "../lib/pedidos";
import { CORES } from "../tema";

/**
 * E5A — ALTERAR O PEDIDO (R13, S17), numa folha que sobe.
 *
 * Só os campos da lista fechada da Segurança, e só os que a API deixa
 * (`alteracoes.campos`): o dia (de amanhã a 180 dias, em Lisboa), juntar
 * fotografias, acrescentar pormenores (até 1000 caracteres, juntam-se à
 * descrição sem a apagar) e o acesso. A morada, o serviço e os contactos
 * mudam-se pelo WhatsApp. A resposta diz se ficou aplicada ou à espera da
 * CLYON (P11 (a): depois de haver propostas, vai à Mesa).
 */
type Opcao = "dia" | "fotos" | "pormenores" | "acesso";

export function AlterarOPedido({
  visivel,
  pedidoId,
  campos,
  pedir,
  aoFechar,
  aoGuardar,
}: {
  visivel: boolean;
  pedidoId: number;
  campos: string[];
  pedir: Pedir;
  aoFechar: () => void;
  aoGuardar: (resultado: string) => void;
}) {
  const [opcao, setOpcao] = useState<Opcao | null>(null);
  const [quando, setQuando] = useState<Quando | undefined>(undefined);
  const [dia, setDia] = useState<string | undefined>(undefined);
  const [pormenores, setPormenores] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [acesso, setAcesso] = useState<Acesso>({});
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const pode = (c: string) => campos.length === 0 || campos.includes(c);
  const todas: Array<{ id: Opcao; nome: string } | null> = [
    pode("dataPreferida") || pode("quando") ? { id: "dia", nome: T.dia } : null,
    pode("fotografias") ? { id: "fotos", nome: T.fotos } : null,
    pode("pormenores") ? { id: "pormenores", nome: T.pormenores } : null,
    pode("acesso") ? { id: "acesso", nome: T.acesso } : null,
  ];
  const opcoes = todas.filter((o): o is { id: Opcao; nome: string } => !!o);
  const dias = diasParaEscolher(new Date(), DIAS_PARA_ALTERAR);

  async function juntar() {
    setErro(null);
    setOcupado(true);
    try {
      const e = await escolherFotografias("galeria", 10);
      if ("erro" in e) return setErro(e.erro);
      for (const a of e.fotografias) {
        const url = await enviarFotografia(await reduzirFotografia(a));
        setFotos((f) => [...f, url]);
      }
    } catch (e) {
      setErro(mensagemDe(e, "Uma fotografia não seguiu. Tente outra vez."));
    } finally {
      setOcupado(false);
    }
  }

  async function guardar() {
    const c = corpoDaAlteracao(
      {
        quando: opcao === "dia" && quando && quando !== "data" ? quando : undefined,
        dataPreferida: opcao === "dia" && quando === "data" ? dia : undefined,
        fotografias: opcao === "fotos" ? fotos : undefined,
        pormenores: opcao === "pormenores" ? pormenores : undefined,
        acesso: opcao === "acesso" && acesso.floor ? { ...acesso } : undefined,
      },
      { primeiroDia: primeiroDiaPossivel(new Date()), ultimoDia: dias[dias.length - 1]?.dia ?? "" },
    );
    if ("erro" in c) return setErro(c.erro);
    setErro(null);
    setOcupado(true);
    try {
      const r = await pedir<{ estado?: string; mensagem?: string }>(ROTA_DA_ALTERACAO(pedidoId), { metodo: "POST", corpo: c.corpo });
      const texto = r.mensagem || (r.estado === "aplicada" ? T.aplicada : T.pedida);
      setResultado(texto);
      aoGuardar(texto);
    } catch (e) {
      setErro(e instanceof ErroDaApi && e.estado === 409 && !e.message ? T.jaHaUma : mensagemDe(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Folha visivel={visivel} aoFechar={aoFechar}>
      <Text titulo accessibilityRole="header" style={{ color: CORES.tinta, fontSize: 21, fontWeight: "700" }}>
        {T.titulo}
      </Text>
      {resultado ? <Aviso texto={resultado} tom="bom" /> : null}
      <Escolhas opcoes={opcoes} valor={opcao ?? undefined} aoEscolher={(v) => setOpcao(v)} />
      {opcao === "dia" ? (
        <>
          <Escolhas opcoes={(["amanha", "esta_semana", "data", "flexivel"] as Quando[]).map((q) => ({ id: q, nome: TEXTO_DO_QUANDO[q] }))} valor={quando} aoEscolher={setQuando} />
          {quando === "data" ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {dias.map((x) => (
                <Pressable
                  key={x.dia}
                  onPress={() => setDia(x.dia)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: dia === x.dia }}
                  style={{ width: 120, minHeight: 60, padding: 10, borderRadius: 14, borderWidth: dia === x.dia ? 2 : 1, borderColor: dia === x.dia ? CORES.marca : CORES.linha }}
                >
                  <Text style={{ color: CORES.tinta, fontSize: 13 }}>{x.texto}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}
      {opcao === "fotos" ? (
        <View style={{ gap: 8 }}>
          <Botao titulo="Escolher da galeria" tipo="secundario" ocupado={ocupado} aoCarregar={() => void juntar()} />
          {fotos.length > 0 ? <Paragrafo suave>{`${fotos.length} ${fotos.length === 1 ? "fotografia pronta" : "fotografias prontas"}`}</Paragrafo> : null}
        </View>
      ) : null}
      {opcao === "pormenores" ? (
        <Campo
          rotulo={T.pormenores}
          valor={pormenores}
          aoMudar={(v) => setPormenores(v.slice(0, MAXIMO_DOS_PORMENORES))}
          multiline
          maxLength={MAXIMO_DOS_PORMENORES}
          ajuda={`${pormenores.length} de ${MAXIMO_DOS_PORMENORES}`}
          style={{ minHeight: 100, textAlignVertical: "top" }}
        />
      ) : null}
      {opcao === "acesso" ? (
        <View style={{ gap: 12 }}>
          <Escolhas rotulo="Em que andar está?" opcoes={ANDARES} valor={acesso.floor} aoEscolher={(v) => setAcesso((a) => ({ ...a, floor: v }))} />
          {acesso.floor && acesso.floor !== "rés-do-chão" ? (
            <Escolhas rotulo="Há elevador?" opcoes={ELEVADOR} valor={acesso.hasElevator} aoEscolher={(v) => setAcesso((a) => ({ ...a, hasElevator: v }))} />
          ) : null}
          <Escolhas rotulo="Estacionamento" opcoes={ESTACIONAMENTO} valor={acesso.parkingDistance} aoEscolher={(v) => setAcesso((a) => ({ ...a, parkingDistance: v }))} />
        </View>
      ) : null}
      {erro ? <Aviso texto={erro} tom="mau" /> : null}
      {opcao ? <Botao titulo="Guardar a alteração" ocupado={ocupado} aoCarregar={() => void guardar()} /> : null}
      <Paragrafo pequeno suave>
        {T.sempre}
      </Paragrafo>
      <Ligacao titulo="Falar com a CLYON por WhatsApp" aoCarregar={() => whatsappDaClyon(`Pedido #${pedidoId}: queria mudar o pedido.`)} />
    </Folha>
  );
}
