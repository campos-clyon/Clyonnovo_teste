import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Texto";
import { Botao, Caixa, Etiqueta, Linha, Mensagem, TituloDaCaixa } from "./ui";
import { Fotografias } from "./Fotografias";
import { VerFotografias } from "./VerFotografias";
import { useTrabalhos } from "../estado/Trabalhos";
import { ErroDaApi, pedir } from "../lib/api";
import { duracaoPorExtenso } from "../../../src/lib/agenda-em-grelha";
import { linkDeWhatsApp } from "../../../src/lib/link-de-whatsapp";
import { VALOR_QUE_MUDA_NO_LOCAL } from "../../../src/lib/ajuste-no-local";
import { aEsperaDaConfirmacao, quemConfirmaAntesDeMarcar } from "../../../src/lib/trabalho";
import { ondeEstaODinheiro, tituloDoConfirmado } from "../../../src/lib/fim-do-trabalho";
import {
  BOTAO_DA_ETAPA,
  clientePodeConfirmarChegada,
  COMO_O_CLIENTE_CONFIRMA,
  estadoDaViagemParaOProfissional,
  etapasQueSePodemMarcar,
  FALAR_COM_A_CLYON,
  mensagemDaChegadaPorConfirmar,
  podeMostrarConcluir,
  proximaEtapa,
  viagemComConfirmacao,
  type EtapaDaViagem,
} from "../../../src/lib/viagem-ate-ao-cliente";
import { TELEFONE_DA_CLYON } from "../../../src/lib/telefone-da-clyon";
import { AvisosDoValor } from "./AvisosDoValor";
import { HorasDoTrabalho } from "./HorasDoTrabalho";
import { MARQUE_AS_HORAS_PRIMEIRO } from "../../../src/lib/horas-do-trabalho";
import { estimativaAoLado, horasPorMarcar, sufixoDoValor } from "../lib/trabalhos";
import { AvaliarOCliente } from "./AvaliarOCliente";
import { MapaDaMorada } from "./MapaDaMorada";
import {
  avisoDaEtapa,
  clienteDesde,
  CLIENTE_AVISADO_POR_WHATSAPP,
  CLIENTE_SEM_AVISO_POR_WHATSAPP,
  depoisDeMarcar,
  diasParaMarcar,
  duracaoDe,
  esperaPelaClyon,
  euros,
  HORAS_PARA_MARCAR,
  horaCurta,
  lerValor,
  marcacaoInicial,
  marcouComoFeito,
  obrigadoDoFeito,
  provaDe,
  quandoE,
  quantoOProfissionalRecebe,
  quemResponde,
  situacaoDoAjuste,
  TRABALHO_COM_PRECO_FECHADO,
  whatsAppDaClyon,
  type Ajuste,
  type RespostaDaEtapa,
  type RespostaDoFeito,
  type Trabalho,
} from "../lib/trabalhos";
import { ESPACO, LETRA, RAIO, useCores } from "../tema";

/**
 * O TRABALHO QUE JÁ É DELE — fase 3 da CLYON Pro, 18-10-2026.
 *
 * Tudo o que acontece entre o «sim» do cliente e o «está feito», pela ordem em
 * que acontece: marcar o dia, sair, chegar, o valor que mudou no local e a
 * prova. Cada botão chama a mesma rota que o painel no navegador chamaria; as
 * regras (quem pode, até quando, quantas vezes) decide-as o site.
 *
 * As decisões do dono: «a caminho» e «cheguei» avisam o cliente por WhatsApp
 * (nos trabalhos CLYON não); subir o valor precisa do «sim» do cliente e de
 * fotografias, baixar aplica logo; o pedido fica de pé até às 23:59; no
 * máximo dois por trabalho.
 */

export function TrabalhoContratado({ t, descricao = null }: { t: Trabalho; descricao?: ReactNode }) {
  /*
   * O «Obrigado…» de quem acabou de marcar como feito — 26-10-2026 (d22). A
   * frase vem da rota (a mesma do painel) e fica aqui, por cima das duas
   * fases: o trabalho passa a «à espera» e a caixa do «está feito» sai.
   */
  const [obrigado, setObrigado] = useState<string | null>(null);
  // A descrição do pedido vai logo abaixo do valor (pedido do dono, 18-10-2026).
  if (t.fase !== "a_executar") {
    return (
      <>
        {obrigado ? <Mensagem tom="bom" texto={obrigado} /> : null}
        <Terminado t={t} />
        <HorasDoTrabalho t={t} />
        {descricao}
        {/* O nome, o telefone e a morada do cliente são para FAZER o trabalho:
            confirmado ou pago, saem — a mesma regra do painel (16-09-2026). */}
        {t.fase === "a_confirmar" ? <OndeEComQuem t={t} /> : null}
        {/* Avaliar o cliente — 29-10-2026: feito ou confirmado, uma vez, e só o cliente a vê. */}
        <AvaliarOCliente negociacaoId={t.negociacaoId} />
      </>
    );
  }
  /*
   * POR PRIORIDADE — 02-11-2026 (dono, #555: «está cheio e confunde»). Em
   * cima o que ele tem de fazer agora: o valor e se o cliente já pagou (uma
   * caixa, não três), um ajuste à espera, marcar o dia (quando ainda não há),
   * o botão do trajecto e o «Está feito». Depois o que o cliente pede, o dia
   * (já marcado) e o contacto. O resto — pedir ajuste do valor (só depois de
   * «Cheguei»), a regra do valor que muda e o histórico — em «Mais opções»
   * (`MaisOpcoes` no ecrã do pedido). Com a viagem começada, o «Falta
   * combinar o dia» sai: o dia é este.
   */
  const viajando = !!t.aCaminhoEm;
  const semDia = !t.dataCombinada;
  return (
    <>
      <OTrabalhoESeu t={t} />
      <AjusteNoLocal t={t} modo="estado" />
      {!viajando && semDia ? <ODia t={t} /> : null}
      <Viagem t={t} />
      {/* Por hora (31-10-2026): as horas primeiro, depois o «Está feito». */}
      {concluirVisivel(t) ? <HorasDoTrabalho t={t} /> : null}
      {obrigado ? (
        <Mensagem tom="bom" texto={obrigado} />
      ) : concluirVisivel(t) && horasPorMarcar(t) ? (
        <Mensagem tom="aviso" texto={MARQUE_AS_HORAS_PRIMEIRO} />
      ) : concluirVisivel(t) ? (
        <EstaFeito t={t} aoMarcar={setObrigado} />
      ) : null}
      {descricao}
      {!viajando && !semDia ? <ODia t={t} /> : null}
      <OndeEComQuem t={t} />
    </>
  );
}

/**
 * O «ESTÁ FEITO» SEGUE O SITE (`podeMostrarConcluir`). Desde a d2 de
 * 03-11-2026 a chegada confirmada está desligada no módulo
 * (`CHEGADA_CONFIRMADA_OBRIGATORIA`): o «Está feito» aparece sem viagem
 * marcada e sem a confirmação do cliente, como no painel e no servidor. Se a
 * regra voltar a ser ligada, volta a pedir «Cheguei» e o «sim» do cliente.
 */
export function concluirVisivel(t: Pick<Trabalho, "ofertaClyon" | "aCaminhoEm" | "proximoEm" | "chegouEm" | "chegadaConfirmadaEm">): boolean {
  const clyon = !!t.ofertaClyon;
  if (clyon) return true;
  return podeMostrarConcluir(t, clyon);
}

/**
 * Uma acção que fala com o site e, se correr bem, volta a ler os trabalhos.
 * Uma recusa 409 quer dizer que o trabalho mudou no site (d2, 03-11-2026: 15
 * recusas num dia, por passos da viagem fora da ordem): lê-se outra vez, para
 * os botões mostrarem o que vale agora.
 */
function useAccao() {
  const { recarregar } = useTrabalhos();
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function correr(fn: () => Promise<unknown>): Promise<boolean> {
    setAEnviar(true);
    setErro(null);
    try {
      await fn();
      await recarregar();
      return true;
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : "Não foi possível. Tente outra vez.");
      if (e instanceof ErroDaApi && e.estado === 409) await recarregar().catch(() => {});
      return false;
    } finally {
      setAEnviar(false);
    }
  }
  return { aEnviar, erro, correr };
}

const abrir = (url: string | null) => {
  if (url) void Linking.openURL(url);
};

function OTrabalhoESeu({ t }: { t: Trabalho }) {
  const c = useCores();
  const ultimo = t.ajuste?.ultimo;
  const ajustado = ultimo && (ultimo.estado === "aprovado" || ultimo.estado === "descida") ? ultimo : null;
  return (
    <Caixa estilo={{ backgroundColor: c.bomSuave, borderColor: c.bomSuave }}>
      <TituloDaCaixa>O trabalho é seu</TituloDaCaixa>
      {t.ofertaClyon ? (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{TRABALHO_COM_PRECO_FECHADO}</Text>
      ) : null}
      {t.recebeSeFechado != null ? (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal }}>
          Recebe{" "}
          <Text style={{ fontWeight: "800", color: c.bom }}>
            {euros(t.recebeSeFechado)}
            {sufixoDoValor(t, true)}
          </Text>
          , sem IVA{t.baseDoPreco === "hora" && t.porHora?.confirmadas ? " — total das horas" : ""}.
        </Text>
      ) : null}
      {sufixoDoValor(t, true) === "/hora" && estimativaAoLado(t, t.recebeSeFechado) ? (
        <Text style={{ color: c.suave }}>Total estimado {estimativaAoLado(t, t.recebeSeFechado)}</Text>
      ) : null}
      {ajustado ? (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
          Valor ajustado no local: {euros(ajustado.valorAntigo)} → {euros(ajustado.valorNovo)} (sem IVA).
        </Text>
      ) : null}
      <AvisosDoValor t={t} />
      {/*
       * Em que pé está o dinheiro, antes de ele sair de casa (o que era a caixa
       * «combine já», 02-11-2026: numa linha, aqui). `clientePagou` null
       * (trabalho CLYON, pago em mão, ou de antes de a plataforma cobrar) não
       * mostra nada. A regra do valor que muda no local passou para «Mais opções».
       */}
      {t.fase === "a_executar" && t.clientePagou === true ? (
        <Mensagem tom="bom" texto="O cliente já pagou à CLYON. O valor está cá e é seu assim que ele confirmar que o trabalho está feito." />
      ) : null}
      {t.fase === "a_executar" && t.clientePagou === false ? (
        <Mensagem tom="aviso" texto="O cliente ainda não pagou à CLYON. Pode ir fazer o trabalho — mas o valor só passa a seu quando o pagamento entrar. Se preferir esperar, diga-nos e falamos com ele." />
      ) : null}
    </Caixa>
  );
}

// ── O dia ────────────────────────────────────────────────────────────────────

/** As durações à escolha — dentro do que o site aceita (meia hora a doze horas, de quarto em quarto). */
const DURACOES = [60, 90, 120, 180, 240, 360, 480];

function Pastilha({ texto, activa, aoCarregar }: { texto: string; activa: boolean; aoCarregar: () => void }) {
  const c = useCores();
  return (
    <Pressable
      onPress={aoCarregar}
      accessibilityRole="button"
      accessibilityState={{ selected: activa }}
      style={[estilos.pastilha, { borderColor: activa ? c.marca : c.linha, backgroundColor: activa ? c.marca : c.superficie }]}
    >
      <Text style={{ color: activa ? c.sobreMarca : c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 1 }}>{texto}</Text>
    </Pressable>
  );
}

/*
 * O DIA, A HORA E A DURAÇÃO NUM SÍTIO SÓ — 02-11-2026 (dono). Com um dia
 * marcado ou pedido pelo cliente, o botão é «Mudar data e hora» e abre o dia,
 * a hora e quanto tempo leva (o «Mudar» da duração juntou-se aqui); «Marcar o
 * dia» só quando não há dia nenhum. O seletor começa no dia combinado, ou no
 * que o cliente pediu. Mudar o dia avisa o cliente: no telemóvel logo, e por
 * WhatsApp quando a data assenta (`/api/profissionais/agenda`).
 */
export const ACAO_DO_DIA = { marcar: "Marcar o dia", mudar: "Mudar data e hora" } as const;
export function tituloDoBotaoDoDia(t: Pick<Trabalho, "dataCombinada" | "dataAgendada">): string {
  return t.dataCombinada || t.dataAgendada ? ACAO_DO_DIA.mudar : ACAO_DO_DIA.marcar;
}

export function ODia({ t }: { t: Trabalho }) {
  const c = useCores();
  const { aEnviar, erro, correr } = useAccao();
  const [aMarcar, setAMarcar] = useState(false);
  const inicial = marcacaoInicial(t.dataCombinada ?? t.dataAgendada);
  const [dia, setDia] = useState(inicial.dia);
  const [hora, setHora] = useState(inicial.hora);
  const [minutos, setMinutos] = useState(duracaoDe(t));
  const dias = diasParaMarcar();
  const combinado = t.dataCombinada ? quandoE({ dataCombinada: t.dataCombinada, dataAgendada: null, urgency: null }) : null;
  const pediu = quandoE({ dataCombinada: null, dataAgendada: t.dataAgendada, urgency: t.urgency });
  const rotulo = dias.find((d) => d.dia === dia)?.rotulo ?? dia;
  const daCombinada = t.dataCombinada ? marcacaoInicial(t.dataCombinada) : null;
  const duracoes = DURACOES.includes(duracaoDe(t)) ? DURACOES : [...DURACOES, duracaoDe(t)].sort((a, b) => a - b);

  // Desmarcar: o cliente adiou sem dizer quando — melhor «por combinar» do que
  // uma data que já ninguém vai cumprir (o mesmo que apagar o campo no painel).
  const [aDesmarcar, setADesmarcar] = useState(false);
  async function desmarcar() {
    const ok = await correr(() =>
      pedir("/api/profissionais/agenda", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, quando: "" } }),
    );
    if (ok) setADesmarcar(false);
  }

  async function guardar() {
    const quando = `${dia}T${hora}`;
    const mudouODia = !daCombinada || `${daCombinada.dia}T${daCombinada.hora}` !== quando;
    const ok = await correr(async () => {
      if (minutos !== duracaoDe(t)) {
        await pedir("/api/profissionais/agenda/duracao", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, minutos } });
      }
      // «AAAA-MM-DDTHH:MM» é hora de Lisboa para o site (`instanteEmLisboa`). Só a duração? Não se regrava o dia.
      if (mudouODia) {
        await pedir("/api/profissionais/agenda", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, quando } });
      }
    });
    if (ok) setAMarcar(false);
  }

  function abrir() {
    const i = marcacaoInicial(t.dataCombinada ?? t.dataAgendada);
    setDia(i.dia);
    setHora(i.hora);
    setMinutos(duracaoDe(t));
    setAMarcar(true);
  }

  return (
    <Caixa>
      <TituloDaCaixa>O dia</TituloDaCaixa>
      {combinado ? (
        <Text style={[estilos.destaque, { color: c.tinta }]}>{combinado}</Text>
      ) : (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>Falta marcar o dia. Ligue ao cliente para combinar o dia e a hora.</Text>
      )}
      {!combinado && pediu ? <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>O cliente pediu: {pediu}</Text> : null}
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>Leva {duracaoPorExtenso(duracaoDe(t))}</Text>
      {!aMarcar && aDesmarcar ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
            Desmarcar o dia? O trabalho fica «por combinar» e sai da agenda até marcar outro.
          </Text>
          <Botao titulo="Sim, desmarcar" tipo="perigo" ocupado={aEnviar} aoCarregar={() => void desmarcar()} />
          <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setADesmarcar(false)} />
        </View>
      ) : !aMarcar ? (
        <>
          <Botao titulo={tituloDoBotaoDoDia(t)} tipo={combinado ? "secundario" : "principal"} aoCarregar={abrir} />
          {combinado ? (
            <Text
              onPress={() => setADesmarcar(true)}
              accessibilityRole="button"
              style={{ color: c.mau, fontWeight: "700", fontSize: LETRA.pequena + 1, textAlign: "center" }}
            >
              Desmarcar o dia
            </Text>
          ) : null}
        </>
      ) : (
        <View style={{ gap: ESPACO.s }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: ESPACO.xs }}>
            {dias.map((d) => (
              <Pastilha key={d.dia} texto={d.rotulo} activa={d.dia === dia} aoCarregar={() => setDia(d.dia)} />
            ))}
          </ScrollView>
          <View style={estilos.horas}>
            {HORAS_PARA_MARCAR.map((h) => (
              <Pastilha key={h} texto={h} activa={h === hora} aoCarregar={() => setHora(h)} />
            ))}
          </View>
          <Text style={[estilos.rotulo, { color: c.tinta }]}>Quanto tempo leva</Text>
          <View style={estilos.horas}>
            {duracoes.map((m) => (
              <Pastilha key={m} texto={duracaoPorExtenso(m)} activa={m === minutos} aoCarregar={() => setMinutos(m)} />
            ))}
          </View>
          {combinado ? (
            <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>Se mudar o dia ou a hora, o cliente é avisado.</Text>
          ) : null}
          <Botao
            titulo={`Guardar: ${rotulo}, às ${hora} · ${duracaoPorExtenso(minutos)}`}
            ocupado={aEnviar}
            aoCarregar={() => void guardar()}
          />
          <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setAMarcar(false)} />
        </View>
      )}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}

// ── Onde, com quem, e a caminho ──────────────────────────────────────────────

function OndeEComQuem({ t }: { t: Trabalho }) {
  const c = useCores();
  const ligar = t.contactoTelefone?.replace(/[^\d+]/g, "");
  return (
    <Caixa>
      <TituloDaCaixa>Onde e com quem</TituloDaCaixa>
      {/* O mapa antes da morada, como no painel (A13). */}
      <MapaDaMorada morada={t.morada} />
      <Linha rotulo="Cliente" valor={t.contactoNome} />
      {/* «Cliente desde … · N trabalhos confirmados» — só quando é real (A13). */}
      {clienteDesde(t.clienteContexto) ? (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena, textAlign: "right" }}>{clienteDesde(t.clienteContexto)}</Text>
      ) : null}
      <Linha rotulo="Telefone" valor={t.contactoTelefone} />
      <Linha rotulo="Morada" valor={t.morada} />
      <Linha rotulo="Destino" valor={t.moradaDestino} />
      {/* Waze e Maps, os dois: quem conduz todos os dias tem um deles e não muda por nossa causa. */}
      {t.morada ? (
        <View style={estilos.lado}>
          <View style={{ flex: 1 }}>
            <Botao
              titulo="Google Maps"
              tipo="secundario"
              aoCarregar={() => abrir(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(t.morada!)}`)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Botao
              titulo="Waze"
              tipo="secundario"
              aoCarregar={() => abrir(`https://waze.com/ul?q=${encodeURIComponent(t.morada!)}&navigate=yes`)}
            />
          </View>
        </View>
      ) : null}
      {ligar ? (
        <View style={estilos.lado}>
          <View style={{ flex: 1 }}>
            <Botao titulo="Ligar" tipo="secundario" aoCarregar={() => abrir(`tel:${ligar}`)} />
          </View>
          <View style={{ flex: 1 }}>
            <Botao titulo="WhatsApp" tipo="secundario" aoCarregar={() => abrir(linkDeWhatsApp(t.contactoTelefone, ""))} />
          </View>
        </View>
      ) : null}
    </Caixa>
  );
}

/*
 * O TRAJECTO NUM TOQUE — 02-11-2026 (dono). «Estou a caminho», «Estou
 * próximo» e «Cheguei» pediam uma confirmação a seguir («Avisar o cliente…?
 * Sim, avisar / Cancelar»): três passos eram seis. Agora um toque basta: fica
 * à vista «A avisar o cliente…» com «Desfazer» durante 5 s e, sem desfazer,
 * segue para o site (o cliente é avisado nesse momento, e a app diz se o
 * WhatsApp saiu). O desfazer não precisa do site: o pedido ainda não saiu.
 * Sair do ecrã durante os 5 s envia na mesma. O «Está feito» continua a
 * confirmar: fecha o valor e põe a correr o prazo da confirmação automática,
 * e a app não o desfaz.
 */
export const ESPERA_PARA_DESFAZER_MS = 5000;

/** O que aparece durante os segundos do «Desfazer». */
export function textoAEnviar(etapa: EtapaDaViagem, clyon: boolean): string {
  if (clyon) return etapa === "a_caminho" ? "A registar que vai a caminho…" : etapa === "proximo" ? "A registar que está próximo…" : "A registar que chegou…";
  return etapa === "a_caminho"
    ? "A avisar o cliente de que vai a caminho…"
    : etapa === "proximo"
      ? "A avisar o cliente de que está próximo…"
      : "A avisar o cliente de que chegou…";
}

function marcarEtapa(t: Pick<Trabalho, "negociacaoId">, etapa: EtapaDaViagem) {
  return pedir<RespostaDaEtapa>("/api/profissionais/trabalho/etapa", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, etapa } });
}

function Viagem({ t }: { t: Trabalho }) {
  const c = useCores();
  const { erro, correr } = useAccao();
  // O que a rota disse do WhatsApp ao cliente, da última etapa marcada (d11, 28-10-2026).
  const [aviso, setAviso] = useState<"avisado" | "ligue" | "registado" | null>(null);
  const [aEspera, setAEspera] = useState<{ etapa: EtapaDaViagem; fim: number } | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<EtapaDaViagem | null>(null);
  const ligar = t.contactoTelefone?.replace(/[^\d+]/g, "");
  const saiu = horaCurta(t.aCaminhoEm);
  const proximo = horaCurta(t.proximoEm ?? null);
  const chegou = horaCurta(t.chegouEm);
  const confirmada = horaCurta(t.chegadaConfirmadaEm ?? null);
  const clyon = !!t.ofertaClyon;
  // O botão grande: o passo a seguir ao último marcado (a caminho → próximo → cheguei).
  const seguinte = proximaEtapa(t);
  // Sem a ordem obrigatória (d2, 03-11-2026), também os passos depois desse, por baixo: «Estou próximo» ou «Cheguei» sem passar pelo anterior.
  // Depois de «Cheguei», nenhum (nunca se volta a «Estou a caminho»).
  const saltos = etapasQueSePodemMarcar(t).filter((e) => e !== seguinte);
  const estadoDaViagem = clyon ? null : estadoDaViagemParaOProfissional(t);

  // A contagem do «Desfazer».
  useEffect(() => {
    if (!aEspera) return;
    const i = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(i);
  }, [aEspera]);

  // Sair do ecrã com um passo à espera: segue na mesma (o toque foi dele).
  useEffect(
    () => () => {
      if (relogio.current) clearTimeout(relogio.current);
      if (pendente.current) void marcarEtapa(t, pendente.current).catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function enviar(etapa: EtapaDaViagem) {
    let resposta: RespostaDaEtapa | null = null;
    const ok = await correr(async () => {
      resposta = await marcarEtapa(t, etapa);
    });
    if (ok) setAviso(avisoDaEtapa(resposta, t) ?? (clyon ? "registado" : null));
  }

  function tocar(etapa: EtapaDaViagem) {
    setAviso(null);
    pendente.current = etapa;
    setAgora(Date.now());
    setAEspera({ etapa, fim: Date.now() + ESPERA_PARA_DESFAZER_MS });
    relogio.current = setTimeout(() => {
      relogio.current = null;
      pendente.current = null;
      setAEspera(null);
      void enviar(etapa);
    }, ESPERA_PARA_DESFAZER_MS);
  }

  function desfazer() {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = null;
    pendente.current = null;
    setAEspera(null);
  }

  return (
    <Caixa>
      <TituloDaCaixa>O trajecto</TituloDaCaixa>
      {saiu || proximo || chegou ? (
        <View style={estilos.etiquetas}>
          {saiu ? <Etiqueta texto={`A caminho às ${saiu}`} tom="bom" /> : null}
          {proximo ? <Etiqueta texto={`Próximo às ${proximo}`} tom="bom" /> : null}
          {chegou ? <Etiqueta texto={`Chegou às ${chegou}`} tom="bom" /> : null}
          {confirmada ? <Etiqueta texto={`Cliente confirmou às ${confirmada}`} tom="bom" /> : null}
        </View>
      ) : null}
      {estadoDaViagem ? <Mensagem tom={confirmada ? "bom" : "aviso"} texto={estadoDaViagem} /> : null}
      {/* O cliente ainda não confirmou: o que fazer, com o WhatsApp da CLYON (d3, 31-10-2026). */}
      {!clyon && viagemComConfirmacao(t, false) && clientePodeConfirmarChegada(t) ? (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{COMO_O_CLIENTE_CONFIRMA}</Text>
          <Botao
            titulo={FALAR_COM_A_CLYON}
            tipo="secundario"
            aoCarregar={() => abrir(linkDeWhatsApp(TELEFONE_DA_CLYON, mensagemDaChegadaPorConfirmar(t.pedidoId)))}
          />
        </View>
      ) : null}
      {aEspera ? (
        <View accessibilityLiveRegion="polite" style={[estilos.desfazer, { backgroundColor: c.marcaSuave, borderColor: c.marca }]}>
          <Text style={{ flex: 1, color: c.tinta, fontSize: LETRA.normal, fontWeight: "600" }}>
            {textoAEnviar(aEspera.etapa, clyon)} {Math.max(1, Math.ceil((aEspera.fim - agora) / 1000))}
          </Text>
          <Text onPress={desfazer} accessibilityRole="button" style={{ color: c.marca, fontWeight: "800", fontSize: LETRA.normal, padding: ESPACO.xs }}>
            Desfazer
          </Text>
        </View>
      ) : seguinte ? (
        <View style={{ gap: ESPACO.s }}>
          <BotaoDaViagem etapa={seguinte} aoCarregar={() => tocar(seguinte)} />
          {saltos.map((e) => (
            <Botao key={e} titulo={BOTAO_DA_ETAPA[e]} tipo="secundario" aoCarregar={() => tocar(e)} />
          ))}
        </View>
      ) : null}
      {/* Só se diz que o cliente foi avisado quando o aviso saiu (d11, 28-10-2026). */}
      {aviso === "avisado" ? <Mensagem tom="bom" texto={CLIENTE_AVISADO_POR_WHATSAPP} /> : null}
      {aviso === "registado" ? <Mensagem tom="bom" texto="Registado." /> : null}
      {aviso === "ligue" ? (
        <View style={{ gap: ESPACO.s }}>
          <Mensagem tom="aviso" texto={CLIENTE_SEM_AVISO_POR_WHATSAPP} />
          {ligar ? <Botao titulo="Ligar" aoCarregar={() => abrir(`tel:${ligar}`)} /> : null}
        </View>
      ) : null}
      {!t.chegouEm && clyon ? (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
          Num trabalho com preço fechado pela CLYON, o cliente não recebe estes avisos: a CLYON fala com o cliente e vê as horas.
        </Text>
      ) : null}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}

/** O botão grande da viagem, com o passo seguinte (30-10-2026). */
function BotaoDaViagem({ etapa, aoCarregar }: { etapa: EtapaDaViagem; aoCarregar: () => void }) {
  const c = useCores();
  const passo = etapa === "a_caminho" ? 1 : etapa === "proximo" ? 2 : 3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={BOTAO_DA_ETAPA[etapa]}
      onPress={aoCarregar}
      style={({ pressed }) => ({
        minHeight: 72,
        borderRadius: RAIO.l,
        backgroundColor: c.marca,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: ESPACO.l,
        paddingVertical: ESPACO.m,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: c.sobreMarca, fontSize: LETRA.grande, fontWeight: "800" }}>{BOTAO_DA_ETAPA[etapa]}</Text>
      <Text style={{ color: c.sobreMarca, fontSize: LETRA.pequena, marginTop: 2 }}>{`Passo ${passo} de 3`}</Text>
    </Pressable>
  );
}

// ── O valor mudou no local ───────────────────────────────────────────────────

/** Os ajustes cujo «fazer pelo valor combinado» ele já escolheu — enquanto a app está aberta. */
const jaDecididos = new Set<string>();

function MiniFotografias({ fotos }: { fotos: string[] }) {
  const c = useCores();
  const [aberta, setAberta] = useState<number | null>(null);
  if (fotos.length === 0) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: ESPACO.xs }}>
        {fotos.map((u, i) => (
          <Pressable key={u} onPress={() => setAberta(i)} accessibilityRole="imagebutton" accessibilityLabel={`Ver a fotografia ${i + 1}`}>
            <Image source={{ uri: u }} style={[estilos.mini, { backgroundColor: c.fundo }]} />
          </Pressable>
        ))}
      </ScrollView>
      <VerFotografias key={aberta ?? -1} fotos={fotos} inicio={aberta} aoFechar={() => setAberta(null)} />
    </>
  );
}

function oUltimo(a: Ajuste, quem: string): string {
  const de = `${euros(a.valorAntigo)} → ${euros(a.valorNovo)}`;
  switch (a.estado) {
    case "aprovado":
      return `Último ajuste: ${de}, aceite ${a.respondidoPor === "clyon" || quem === "a CLYON" ? "pela CLYON" : "pelo cliente"}.`;
    case "descida":
      return `Baixou no local: ${de}.`;
    case "cancelado":
      return `Retirou o pedido de ajuste (${de}).`;
    case "recusado":
      return `Último ajuste recusado (${de}).`;
    case "expirado":
      return `Último ajuste expirou sem resposta (${de}).`;
    default:
      return "";
  }
}

/*
 * O AJUSTE DO VALOR EM DOIS SÍTIOS — 02-11-2026 (dono). O que está a decorrer
 * (um pedido à espera, ou recusado / sem resposta) fica em cima, à vista
 * (`modo="estado"`). Pedir um ajuste novo só depois de «Cheguei», dentro de
 * «Mais opções» (`modo="pedir"`, com a regra do valor que muda no local).
 */
export function podePedirAjusteAgora(t: Pick<Trabalho, "chegouEm">): boolean {
  return !!t.chegouEm;
}

export function AjusteNoLocal({ t, modo }: { t: Trabalho; modo: "estado" | "pedir" }) {
  const c = useCores();
  const { aEnviar, erro, correr } = useAccao();
  const [aPedir, setAPedir] = useState(false);
  const [texto, setTexto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [fotosAEnviar, setFotosAEnviar] = useState(false);
  const [confirmarRetirar, setConfirmarRetirar] = useState(false);
  const [, setDecidido] = useState(0);

  const situacao = situacaoDoAjuste(t);
  if (!situacao || !t.ajuste) return null;
  const quem = quemResponde(t);
  const doQuem = quem === "o cliente" ? "do cliente" : "da CLYON";
  const ligar = t.contactoTelefone?.replace(/[^\d+]/g, "");
  const antigo = t.valorAcordado;
  const ultimo = t.ajuste.ultimo;
  const recebe = (v: number) => euros(quantoOProfissionalRecebe(v, t.taxas));

  // ── À espera ──
  const p = t.ajuste.pendente;
  if (situacao === "pendente" && modo === "pedir") return null;
  if (situacao === "pendente" && p) {
    return (
      <Caixa estilo={{ backgroundColor: c.avisoSuave, borderColor: c.aviso }}>
        <TituloDaCaixa>Ajuste à espera {doQuem}</TituloDaCaixa>
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
          Pediu para o trabalho passar de {euros(p.valorAntigo)} para{" "}
          <Text style={{ fontWeight: "800" }}>{euros(p.valorNovo)}</Text>, sem IVA. Se {quem} aceitar, recebe {recebe(p.valorNovo)}.
        </Text>
        <Text style={{ color: c.tinta, fontStyle: "italic" }}>«{p.motivo}»</Text>
        <MiniFotografias fotos={p.fotos} />
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
          {quem === "o cliente" ? "O cliente tem" : "A CLYON tem"} até às {horaCurta(p.expiraEm) ?? "23:59"} para responder. Sem resposta, fica o
          valor combinado.
        </Text>
        {ligar && quem === "o cliente" ? <Botao titulo="Ligar ao cliente" aoCarregar={() => abrir(`tel:${ligar}`)} /> : null}
        {!confirmarRetirar ? (
          <Botao titulo="Retirar o pedido" tipo="secundario" aoCarregar={() => setConfirmarRetirar(true)} />
        ) : (
          <View style={{ gap: ESPACO.s }}>
            <Text style={{ color: c.tinta }}>Retirar o pedido? O valor fica o combinado.</Text>
            <Botao
              titulo="Sim, retirar"
              tipo="perigo"
              ocupado={aEnviar}
              aoCarregar={() =>
                void correr(() =>
                  pedir("/api/profissionais/trabalho/ajuste", { metodo: "DELETE", corpo: { negociacaoId: t.negociacaoId } }),
                ).then((ok) => ok && setConfirmarRetirar(false))
              }
            />
            <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setConfirmarRetirar(false)} />
          </View>
        )}
        {erro ? <Mensagem texto={erro} /> : null}
      </Caixa>
    );
  }

  // ── Recusado ou sem resposta: as três saídas ──
  const chave = ultimo ? `${t.negociacaoId}:${ultimo.pedidoEm}` : "";
  if (situacao === "sem_resposta" && ultimo && !jaDecididos.has(chave) && !aPedir) {
    if (modo === "pedir") return null;
    const fica = euros(ultimo.valorAntigo);
    return (
      <Caixa estilo={{ backgroundColor: c.avisoSuave, borderColor: c.aviso }}>
        <TituloDaCaixa>
          {ultimo.estado === "recusado"
            ? `${quem === "o cliente" ? "O cliente" : "A CLYON"} não aceitou o ajuste`
            : "O pedido de ajuste expirou"}
        </TituloDaCaixa>
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
          O valor fica em {fica}, sem IVA. O que vai fazer?
        </Text>
        <Botao
          titulo={`Fazer por ${fica}`}
          aoCarregar={() => {
            jaDecididos.add(chave);
            setDecidido((n) => n + 1);
          }}
        />
        <Botao
          titulo="Falar com a CLYON"
          tipo="secundario"
          aoCarregar={() => abrir(whatsAppDaClyon(`Pedido #${t.pedidoId}: o ajuste do valor não foi aceite. Preciso de ajuda.`))}
        />
        <Botao
          titulo="Não vou fazer"
          tipo="perigo"
          aoCarregar={() =>
            abrir(whatsAppDaClyon(`Pedido #${t.pedidoId}: não vou fazer o trabalho pelo valor combinado (${fica}, sem IVA). Motivo: `))
          }
        />
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
          «Não vou fazer» não cancela nada sozinho: avisa a CLYON pelo WhatsApp, e a CLYON fala com o cliente.
        </Text>
        {t.ajuste.restantes > 0 ? (
          <Botao titulo="Pedir outro ajuste" tipo="secundario" aoCarregar={() => setAPedir(true)} />
        ) : null}
      </Caixa>
    );
  }

  // ── Livre para pedir, ou já não ── (em «Mais opções», só depois de «Cheguei»; aqui em cima só o pedido aberto de «Pedir outro ajuste»)
  if (modo === "estado" && !aPedir) return null;
  if (modo === "pedir" && !podePedirAjusteAgora(t)) return null;
  const novo = lerValor(texto);
  const sobe = novo != null && antigo != null && novo > antigo;
  const desce = novo != null && antigo != null && novo < antigo;
  const motivoOk = motivo.trim().length >= 5;
  const podeEnviar = (sobe || desce) && motivoOk && (!sobe || fotos.length > 0) && !fotosAEnviar;

  async function enviar() {
    const ok = await correr(() =>
      pedir("/api/profissionais/trabalho/ajuste", {
        metodo: "POST",
        corpo: { negociacaoId: t.negociacaoId, valorNovo: novo, motivo: motivo.trim(), fotos },
      }),
    );
    if (ok) {
      setAPedir(false);
      setTexto("");
      setMotivo("");
      setFotos([]);
    }
  }

  return (
    <Caixa>
      <TituloDaCaixa>O valor mudou no local?</TituloDaCaixa>
      {!aPedir ? (
        <>
          <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{VALOR_QUE_MUDA_NO_LOCAL}</Text>
          {/* Sem «ligue primeiro ao cliente»: o valor muda aqui, com registo, e nunca combinado por fora (d7, 28-10-2026). */}
          <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
            {quem === "o cliente"
              ? "Se encontrou mais (ou menos) do que o pedido diz, peça aqui o ajuste: baixar aplica-se logo, e subir só conta com o «sim» do cliente. Fica tudo registado."
              : "Se encontrou mais (ou menos) do que o pedido diz, peça aqui o ajuste: num trabalho com preço fechado pela CLYON, quem responde é a CLYON, que fala com o cliente."}
          </Text>
          {!t.ajuste.porqueNao ? (
            <Botao titulo="Pedir ajuste do valor" tipo="secundario" aoCarregar={() => setAPedir(true)} />
          ) : (
            <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{t.ajuste.porqueNao}</Text>
          )}
          {ultimo ? <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>{oUltimo(ultimo, quem)}</Text> : null}
        </>
      ) : (
        <View style={{ gap: ESPACO.s }}>
          {antigo != null ? (
            <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
              Valor combinado: {euros(antigo)} sem IVA · recebe {recebe(antigo)}
            </Text>
          ) : null}
          <Text style={[estilos.rotulo, { color: c.tinta }]}>Valor que vai ficar, sem IVA</Text>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={c.suave}
            accessibilityLabel="Valor que vai ficar, sem IVA"
            style={[estilos.campo, { borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
          />
          {novo != null && antigo != null ? (
            <Text style={{ color: sobe || desce ? c.tinta : c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
              {sobe
                ? `Recebe ${recebe(novo)}. Só muda se ${quem} aceitar — tem até às 23:59 de hoje.`
                : desce
                  ? `Recebe ${recebe(novo)}. Baixar aplica-se já, e ${quem === "o cliente" ? "o cliente é avisado" : "a CLYON é avisada"}.`
                  : "É o valor que já está combinado."}
            </Text>
          ) : null}
          <Text style={[estilos.rotulo, { color: c.tinta }]}>O que mudou</Text>
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            multiline
            maxLength={500}
            placeholder="Ex.: eram 50 sacos, não 20"
            placeholderTextColor={c.suave}
            accessibilityLabel="O que mudou"
            style={[estilos.campo, estilos.campoAlto, { borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
          />
          <Text style={[estilos.rotulo, { color: c.tinta }]}>
            {sobe ? "Fotografe o que encontrou (obrigatório para subir)" : "Fotografias do que encontrou"}
          </Text>
          <Fotografias negociacaoId={t.negociacaoId} fotos={fotos} aoMudar={setFotos} aoMudarOcupado={setFotosAEnviar} />
          <Botao
            titulo={desce ? "Baixar o valor" : quem === "o cliente" ? "Enviar o pedido ao cliente" : "Enviar o pedido à CLYON"}
            ocupado={aEnviar}
            desactivado={!podeEnviar}
            aoCarregar={() => void enviar()}
          />
          <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setAPedir(false)} />
        </View>
      )}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}

// ── Está feito ───────────────────────────────────────────────────────────────

/*
 * AS FOTOGRAFIAS SÃO OPCIONAIS — 26-10-2026 (d22). Havia quem não as
 * conseguisse pôr e ficasse sem poder dar o trabalho por feito. Sem elas,
 * quem confirma é um colega da CLYON, com o cliente. O botão só espera pelas
 * que ainda estão a subir — carregar a meio dava-o por feito sem elas.
 */
function EstaFeito({ t, aoMarcar }: { t: Trabalho; aoMarcar: (mensagem: string) => void }) {
  const c = useCores();
  const { aEnviar, erro, correr } = useAccao();
  const [nota, setNota] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const quem = quemResponde(t);
  const pendente = !!t.ajuste?.pendente;

  return (
    <Caixa>
      <TituloDaCaixa>Quando estiver feito</TituloDaCaixa>
      {/* Sem fotografias (30-10-2026, dono): basta o «Está feito», e o cliente confirma. */}
      <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
        Carregue em «Está feito» quando acabar.
      </Text>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
        {quemConfirmaAntesDeMarcar(Boolean(t.ofertaClyon))}
      </Text>
      <TextInput
        value={nota}
        onChangeText={setNota}
        multiline
        maxLength={500}
        placeholder="Nota (opcional)"
        placeholderTextColor={c.suave}
        accessibilityLabel="Nota sobre o trabalho feito"
        style={[estilos.campo, estilos.campoAlto, { borderColor: c.linha, color: c.tinta, backgroundColor: c.fundo }]}
      />
      {pendente ? (
        <Mensagem tom="aviso" texto="Tem um pedido de ajuste à espera. Espere pela resposta, ou retire o pedido, antes de dar o trabalho por feito." />
      ) : null}
      {!confirmar ? (
        <Botao
          titulo="Está feito"
          desactivado={pendente}
          aoCarregar={() => setConfirmar(true)}
        />
      ) : (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.tinta }}>{depoisDeMarcar(quem)}</Text>
          <Botao
            titulo="Sim, está feito"
            ocupado={aEnviar}
            aoCarregar={() =>
              void correr(async () => {
                const r = await pedir<RespostaDoFeito>("/api/profissionais/trabalho", {
                  metodo: "POST",
                  corpo: { negociacaoId: t.negociacaoId, nota: nota.trim() },
                });
                aoMarcar(obrigadoDoFeito(r));
              }).then((ok) => ok || setConfirmar(false))
            }
          />
          <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setConfirmar(false)} />
        </View>
      )}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}

// ── Depois da prova ──────────────────────────────────────────────────────────

/*
 * O FIM DO TRABALHO, COMO NO PAINEL — 28-10-2026 (d4). As frases vêm do site:
 *   · à espera — quem falta e em quanto tempo (`aEsperaDaConfirmacao`, com
 *     «hoje» e nunca «ao fim de 0 dias»). Sem fotografias (sem prazo a correr,
 *     `esperaPelaClyon`), um colega da CLYON com o cliente; num Trabalho CLYON,
 *     a CLYON; nos outros, o cliente;
 *   · confirmado ou pago — quem confirmou e quando (`tituloDoConfirmado`) e
 *     onde está o dinheiro (`ondeEstaODinheiro`): na carteira, por cobrar, em
 *     mão, ou pago a um dia. Dizia a todos «O trabalho está confirmado.».
 */
function Terminado({ t }: { t: Trabalho }) {
  const c = useCores();
  const prova = provaDe(t.provaJson);
  const feito = t.fase === "confirmado" || t.fase === "pago";
  const espera =
    t.fase === "a_confirmar"
      ? aEsperaDaConfirmacao({
          semFotografias: esperaPelaClyon(t),
          ofertaClyon: Boolean(t.ofertaClyon),
          diasAteLibertar: t.diasAteLibertar,
        })
      : null;
  const dinheiro = feito ? ondeEstaODinheiro(t) : null;
  const titulo = espera
    ? espera.titulo
    : feito
      ? tituloDoConfirmado({ confirmadoPor: t.confirmadoPor, confirmadoEm: t.confirmadoEm, ofertaClyon: Boolean(t.ofertaClyon) })
      : "";
  return (
    <Caixa estilo={t.fase === "a_confirmar" ? undefined : { backgroundColor: c.bomSuave, borderColor: c.bomSuave }}>
      <TituloDaCaixa>{titulo}</TituloDaCaixa>
      {espera ? <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{espera.texto}</Text> : null}
      {dinheiro ? <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{dinheiro.frase}</Text> : null}
      {/* Quando o deu por feito, à hora de Lisboa — como no painel (27-10-2026, d5). */}
      {marcouComoFeito(t.execucaoEnviadaEm) ? (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>{marcouComoFeito(t.execucaoEnviadaEm)}</Text>
      ) : null}
      {/* Com a linha do dinheiro, o valor já lá está: «Recebe» por baixo repetia-o (e no pago já não é futuro). */}
      {t.recebeSeFechado != null && !dinheiro ? (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal }}>
          Recebe{" "}
          <Text style={{ fontWeight: "800", color: c.bom }}>
            {euros(t.recebeSeFechado)}
            {sufixoDoValor(t, true)}
          </Text>
          , sem IVA{t.baseDoPreco === "hora" && t.porHora?.confirmadas ? " — total das horas" : ""}.
        </Text>
      ) : null}
      {prova ? (
        <View style={{ gap: ESPACO.s }}>
          <MiniFotografias fotos={prova.fotos} />
          {prova.nota ? <Text style={{ color: c.suave, fontStyle: "italic" }}>«{prova.nota}»</Text> : null}
        </View>
      ) : null}
    </Caixa>
  );
}

const estilos = StyleSheet.create({
  destaque: { fontSize: LETRA.media + 2, fontWeight: "800" },
  desfazer: { flexDirection: "row", alignItems: "center", gap: ESPACO.s, borderWidth: 1.5, borderRadius: RAIO.l, paddingHorizontal: ESPACO.m, minHeight: 72 },
  pastilha: { borderWidth: 1, borderRadius: 999, paddingHorizontal: ESPACO.m, paddingVertical: 7 },
  horas: { flexDirection: "row", flexWrap: "wrap", gap: ESPACO.xs },
  lado: { flexDirection: "row", gap: ESPACO.s, marginTop: ESPACO.s },
  etiquetas: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mini: { width: 72, height: 72, borderRadius: RAIO.m },
  rotulo: { fontWeight: "600", fontSize: LETRA.normal },
  campo: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, minHeight: 50, fontSize: LETRA.media },
  campoAlto: { minHeight: 84, paddingTop: ESPACO.s, textAlignVertical: "top" },
});
