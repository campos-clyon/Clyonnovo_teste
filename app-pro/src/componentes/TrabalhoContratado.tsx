import { useState, type ReactNode } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Texto";
import { Botao, Caixa, Etiqueta, Linha, Mensagem, TituloDaCaixa } from "./ui";
import { Fotografias } from "./Fotografias";
import { VerFotografias } from "./VerFotografias";
import { useTrabalhos } from "../estado/Trabalhos";
import { ErroDaApi, pedir } from "../lib/api";
import { duracaoPorExtenso } from "../../../src/lib/agenda-em-grelha";
import { linkDeWhatsApp } from "../../../src/lib/link-de-whatsapp";
import { AvisosDoValor } from "./AvisosDoValor";
import {
  A_AGUARDAR_A_CLYON,
  depoisDeMarcar,
  diasParaMarcar,
  duracaoDe,
  esperaPelaClyon,
  euros,
  FOTOGRAFIAS_SAO_OPCIONAIS,
  HORAS_PARA_MARCAR,
  horaCurta,
  lerValor,
  marcacaoInicial,
  marcouComoFeito,
  obrigadoDoFeito,
  provaDe,
  quandoE,
  quantoOProfissionalRecebe,
  QUEM_CONFIRMA_O_TRABALHO,
  quemResponde,
  situacaoDoAjuste,
  TRABALHO_COM_PRECO_FECHADO,
  whatsAppDaClyon,
  type Ajuste,
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
        {descricao}
        {/* O nome, o telefone e a morada do cliente são para FAZER o trabalho:
            confirmado ou pago, saem — a mesma regra do painel (16-09-2026). */}
        {t.fase === "a_confirmar" ? <OndeEComQuem t={t} /> : null}
      </>
    );
  }
  return (
    <>
      <OTrabalhoESeu t={t} />
      {descricao}
      <CombineJa t={t} />
      <ODia t={t} />
      <OndeEComQuem t={t} noTerreno />
      <AjusteNoLocal t={t} />
      {obrigado ? <Mensagem tom="bom" texto={obrigado} /> : <EstaFeito t={t} aoMarcar={setObrigado} />}
    </>
  );
}

/** Uma acção que fala com o site e, se correr bem, volta a ler os trabalhos. */
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
          Recebe <Text style={{ fontWeight: "800", color: c.bom }}>{euros(t.recebeSeFechado)}</Text>, sem IVA.
        </Text>
      ) : null}
      {ajustado ? (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>
          Valor ajustado no local: {euros(ajustado.valorAntigo)} → {euros(ajustado.valorNovo)} (sem IVA).
        </Text>
      ) : null}
      <AvisosDoValor t={t} />
    </Caixa>
  );
}

/**
 * «O TRABALHO É SEU — COMBINE JÁ», o mesmo do painel (versão 12).
 *
 * Duas metades: ligar já ao cliente para marcar o dia, e falar de valores só
 * com a CLYON — um valor combinado de boca à porta fica sem registo e sem o
 * dinheiro cativo que garante que lhe pagam. Por baixo, em que pé está o
 * dinheiro, antes de ele sair de casa: `clientePagou` null (trabalho CLYON,
 * pago em mão, ou de antes de a plataforma cobrar) não mostra nada.
 * Só enquanto há trabalho por fazer.
 */
function CombineJa({ t }: { t: Trabalho }) {
  const c = useCores();
  return (
    <Caixa estilo={{ backgroundColor: c.avisoSuave, borderColor: c.aviso }}>
      <TituloDaCaixa>O trabalho é seu — combine já</TituloDaCaixa>
      <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
        Ligue {t.contactoNome ? `a ${t.contactoNome}` : "ao cliente"} o mais depressa possível para acertar o dia e a hora. É a
        parte que ele está à espera, e quanto mais cedo ficar marcado, menos hipóteses há de o trabalho se atrasar.
      </Text>
      <View style={{ borderWidth: 1, borderColor: c.aviso, borderRadius: RAIO.m, padding: ESPACO.m }}>
        <Text style={{ color: c.tinta, fontWeight: "700", fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
          Valores fala sempre com a CLYON, nunca directamente com o cliente. Se o orçamento mudar no local, diga-nos — nós
          corrigimos o valor e ele vê a diferença. Combinado por fora fica sem registo e sem o dinheiro cativo que garante que
          lhe pagam.
        </Text>
      </View>
      {t.clientePagou === true ? (
        <Mensagem
          tom="bom"
          texto="O cliente já pagou à CLYON. O valor está cá e é seu assim que ele confirmar que o trabalho está feito."
        />
      ) : null}
      {t.clientePagou === false ? (
        <Mensagem
          tom="aviso"
          texto="O cliente ainda não pagou à CLYON. Pode ir fazer o trabalho — mas o valor só passa a seu quando o pagamento entrar. Se preferir esperar, diga-nos e falamos com ele."
        />
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

function ODia({ t }: { t: Trabalho }) {
  const c = useCores();
  const { aEnviar, erro, correr } = useAccao();
  const [aMarcar, setAMarcar] = useState(false);
  const [aMudarDuracao, setAMudarDuracao] = useState(false);
  const inicial = marcacaoInicial(t.dataCombinada);
  const [dia, setDia] = useState(inicial.dia);
  const [hora, setHora] = useState(inicial.hora);
  const dias = diasParaMarcar();
  const combinado = t.dataCombinada ? quandoE({ dataCombinada: t.dataCombinada, dataAgendada: null, urgency: null }) : null;
  const pediu = quandoE({ dataCombinada: null, dataAgendada: t.dataAgendada, urgency: t.urgency });
  const rotulo = dias.find((d) => d.dia === dia)?.rotulo ?? dia;

  async function gravarDuracao(minutos: number) {
    const ok = await correr(() =>
      pedir("/api/profissionais/agenda/duracao", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, minutos } }),
    );
    if (ok) setAMudarDuracao(false);
  }

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
    // «AAAA-MM-DDTHH:MM» é hora de Lisboa para o site (`instanteEmLisboa`).
    const ok = await correr(() =>
      pedir("/api/profissionais/agenda", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, quando: `${dia}T${hora}` } }),
    );
    if (ok) setAMarcar(false);
  }

  return (
    <Caixa>
      <TituloDaCaixa>O dia</TituloDaCaixa>
      {combinado ? (
        <Text style={[estilos.destaque, { color: c.tinta }]}>{combinado}</Text>
      ) : (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal }}>Falta combinar o dia com o cliente.</Text>
      )}
      {pediu ? <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>O cliente pediu: {pediu}</Text> : null}
      <View style={estilos.lado}>
        <Text style={{ flex: 1, color: c.tinta, fontSize: LETRA.normal }}>Leva {duracaoPorExtenso(duracaoDe(t))}</Text>
        <Text
          onPress={() => setAMudarDuracao(!aMudarDuracao)}
          accessibilityRole="button"
          style={{ color: c.marca, fontWeight: "700", fontSize: LETRA.normal }}
        >
          {aMudarDuracao ? "Fechar" : "Mudar"}
        </Text>
      </View>
      {aMudarDuracao ? (
        <View style={estilos.horas}>
          {DURACOES.map((m) => (
            <Pastilha key={m} texto={duracaoPorExtenso(m)} activa={m === duracaoDe(t)} aoCarregar={() => void gravarDuracao(m)} />
          ))}
        </View>
      ) : null}
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
          <Botao
            titulo={combinado ? "Mudar o dia" : "Marcar o dia"}
            tipo={combinado ? "secundario" : "principal"}
            aoCarregar={() => setAMarcar(true)}
          />
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
          <Botao titulo={`Guardar: ${rotulo}, às ${hora}`} ocupado={aEnviar} aoCarregar={() => void guardar()} />
          <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setAMarcar(false)} />
        </View>
      )}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
  );
}

// ── Onde, com quem, e a caminho ──────────────────────────────────────────────

function OndeEComQuem({ t, noTerreno = false }: { t: Trabalho; noTerreno?: boolean }) {
  const c = useCores();
  const { aEnviar, erro, correr } = useAccao();
  const [confirmar, setConfirmar] = useState<"a_caminho" | "chegou" | null>(null);
  const ligar = t.contactoTelefone?.replace(/[^\d+]/g, "");
  const saiu = horaCurta(t.aCaminhoEm);
  const chegou = horaCurta(t.chegouEm);
  const clyon = !!t.ofertaClyon;

  async function marcar(etapa: "a_caminho" | "chegou") {
    const ok = await correr(() =>
      pedir("/api/profissionais/trabalho/etapa", { metodo: "POST", corpo: { negociacaoId: t.negociacaoId, etapa } }),
    );
    if (ok) setConfirmar(null);
  }

  return (
    <Caixa>
      <TituloDaCaixa>Onde e com quem</TituloDaCaixa>
      <Linha rotulo="Cliente" valor={t.contactoNome} />
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

      {noTerreno ? (
        <View style={{ gap: ESPACO.s, marginTop: ESPACO.xs }}>
          {saiu || chegou ? (
            <View style={estilos.etiquetas}>
              {saiu ? <Etiqueta texto={`A caminho às ${saiu}`} tom="bom" /> : null}
              {chegou ? <Etiqueta texto={`Chegou às ${chegou}`} tom="bom" /> : null}
            </View>
          ) : null}
          {confirmar ? (
            <View style={{ gap: ESPACO.s }}>
              <Text style={{ color: c.tinta, fontSize: LETRA.normal }}>
                {clyon
                  ? confirmar === "a_caminho"
                    ? "Registar que vai a caminho?"
                    : "Registar que chegou?"
                  : confirmar === "a_caminho"
                    ? "Avisar o cliente de que vai a caminho?"
                    : "Avisar o cliente de que chegou?"}
              </Text>
              <Botao titulo={clyon ? "Sim, registar" : "Sim, avisar"} ocupado={aEnviar} aoCarregar={() => void marcar(confirmar)} />
              <Botao titulo="Cancelar" tipo="secundario" aoCarregar={() => setConfirmar(null)} />
            </View>
          ) : (
            <>
              {!t.aCaminhoEm ? <Botao titulo="Estou a caminho" aoCarregar={() => setConfirmar("a_caminho")} /> : null}
              {!t.chegouEm ? (
                <Botao titulo="Cheguei" tipo={t.aCaminhoEm ? "principal" : "secundario"} aoCarregar={() => setConfirmar("chegou")} />
              ) : null}
            </>
          )}
          {!t.chegouEm ? (
            <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>
              {clyon
                ? "Num trabalho com preço fechado pela CLYON, o cliente não recebe estes avisos: a CLYON fala com o cliente e vê as horas."
                : "O cliente recebe um WhatsApp na hora."}
            </Text>
          ) : null}
        </View>
      ) : null}
      {erro ? <Mensagem texto={erro} /> : null}
    </Caixa>
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

function AjusteNoLocal({ t }: { t: Trabalho }) {
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

  // ── Livre para pedir, ou já não ──
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
          <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
            {quem === "o cliente"
              ? "Se encontrou mais (ou menos) do que o pedido diz, ligue primeiro ao cliente. Isto serve para ficar escrito o que combinarem."
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
  const [fotos, setFotos] = useState<string[]>([]);
  const [fotosAEnviar, setFotosAEnviar] = useState(false);
  const [nota, setNota] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const quem = quemResponde(t);
  const pendente = !!t.ajuste?.pendente;

  return (
    <Caixa>
      <TituloDaCaixa>Quando estiver feito</TituloDaCaixa>
      <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
        Marque como feito quando acabar. {QUEM_CONFIRMA_O_TRABALHO}
      </Text>
      <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1, lineHeight: 20 }}>{FOTOGRAFIAS_SAO_OPCIONAIS}</Text>
      <Fotografias negociacaoId={t.negociacaoId} fotos={fotos} aoMudar={setFotos} aoMudarOcupado={setFotosAEnviar} />
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
          titulo="Dar o trabalho por feito"
          desactivado={fotosAEnviar || pendente}
          aoCarregar={() => setConfirmar(true)}
        />
      ) : (
        <View style={{ gap: ESPACO.s }}>
          <Text style={{ color: c.tinta }}>{depoisDeMarcar(quem, fotos.length)}</Text>
          <Botao
            titulo="Sim, está feito"
            ocupado={aEnviar}
            desactivado={fotosAEnviar}
            aoCarregar={() =>
              void correr(async () => {
                const r = await pedir<RespostaDoFeito>("/api/profissionais/trabalho", {
                  metodo: "POST",
                  corpo: { negociacaoId: t.negociacaoId, fotos, nota: nota.trim() },
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

function Terminado({ t }: { t: Trabalho }) {
  const c = useCores();
  const prova = provaDe(t.provaJson);
  const quem = quemResponde(t);
  const dias = t.diasAteLibertar != null ? Math.ceil(t.diasAteLibertar) : null;
  const titulo = { a_confirmar: "À espera da confirmação", confirmado: "Confirmado", pago: "Pago", a_executar: "", a_negociar: "" }[t.fase];
  return (
    <Caixa estilo={t.fase === "a_confirmar" ? undefined : { backgroundColor: c.bomSuave, borderColor: c.bomSuave }}>
      <TituloDaCaixa>{titulo}</TituloDaCaixa>
      {/* Sem prazo a correr (deu-o por feito sem fotografias, 26-10-2026), não há
          dias a contar: quem confirma é a CLYON, com o cliente. */}
      {esperaPelaClyon(t) ? (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>{A_AGUARDAR_A_CLYON}</Text>
      ) : t.fase === "a_confirmar" ? (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal, lineHeight: 22 }}>
          Enviou a prova. Falta {quem} confirmar
          {dias != null ? ` — e fica confirmado sozinho ${dias <= 0 ? "hoje" : `ao fim de ${dias} dia${dias === 1 ? "" : "s"}`} se não disser nada` : ""}.
        </Text>
      ) : (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal }}>
          {t.fase === "pago" ? "Este trabalho está pago." : "O trabalho está confirmado."}
        </Text>
      )}
      {/* Quando o deu por feito, à hora de Lisboa — como no painel (27-10-2026, d5). */}
      {marcouComoFeito(t.execucaoEnviadaEm) ? (
        <Text style={{ color: c.suave, fontSize: LETRA.pequena + 1 }}>{marcouComoFeito(t.execucaoEnviadaEm)}</Text>
      ) : null}
      {t.recebeSeFechado != null ? (
        <Text style={{ color: c.tinta, fontSize: LETRA.normal }}>
          Recebe <Text style={{ fontWeight: "800", color: c.bom }}>{euros(t.recebeSeFechado)}</Text>, sem IVA.
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
  pastilha: { borderWidth: 1, borderRadius: 999, paddingHorizontal: ESPACO.m, paddingVertical: 7 },
  horas: { flexDirection: "row", flexWrap: "wrap", gap: ESPACO.xs },
  lado: { flexDirection: "row", gap: ESPACO.s, marginTop: ESPACO.s },
  etiquetas: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mini: { width: 72, height: 72, borderRadius: RAIO.m },
  rotulo: { fontWeight: "600", fontSize: LETRA.normal },
  campo: { borderWidth: 1, borderRadius: RAIO.m, paddingHorizontal: ESPACO.m, minHeight: 50, fontSize: LETRA.media },
  campoAlto: { minHeight: 84, paddingTop: ESPACO.s, textAlignVertical: "top" },
});
