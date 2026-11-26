import { unidadeDaBase } from "@/lib/base-do-preco";
import { NAO_PAGA_NADA_ADIANTADO } from "@/lib/validade-do-orcamento";
import {
  getPool,
  getSimulatorOrderById,
  negociacoesDoPedido,
  gravarNegociacao,
  appendOrderHistory,
  registarSemFalhar,
  updateSimulatorOrder,
} from "@/lib/db";
import {
  propor,
  aceitar,
  contratar,
  desistir,
  oClienteVeEsta,
  type Negociacao,
  type Proposta,
} from "@/lib/negociacao";
import { taxasDaNegociacao, type Taxas } from "@/lib/taxas-plataforma";
import { valorDoPrecoEscrito } from "@/lib/total-ao-cliente";
import {
  comIvaNaResposta,
  desdobramentoDoIva,
  precoParaOCliente,
} from "@/lib/preco-do-cliente";
import { modeloDaNegociacao, type ModeloDoPreco } from "@/lib/iva-incluido";
import { lerForma, type FormaDePagamento } from "@/lib/forma-de-pagamento";
import { promessaDaForma } from "@/lib/pagamento-na-plataforma";
import { pagaAoContratado } from "@/lib/o-pagamento-da-vitoria";
import {
  lerBase,
  precoComBase,
  type BaseDoPreco,
} from "@/lib/base-do-preco";
import {
  enviarBotoesWhatsApp,
  enviarTextoWhatsApp,
  paraTeclado,
  telefoneParaWhatsApp,
} from "@/lib/whatsapp-cloud";
import { oSeuServico } from "@/lib/servico-em-palavras";
import { totalEmPalavras, comFacturaEmPalavras } from "@/lib/conta-em-palavras";
import { ORCAMENTO_A_DISTANCIA } from "@/lib/orcamento-a-distancia";
import { avisarDaProposta } from "@/lib/avisar-da-proposta";
import { euros, textoDaMesa, type LinhaDaMesa } from "@/lib/texto-da-mesa";
import { jaFoiDito } from "@/lib/nao-repetir";
import { lerARespostaDirecta, jaSeLeSemModelo } from "@/lib/ler-a-resposta";
import { lerAData, diaPorPalavras, quandoSera } from "@/lib/ler-a-data";
import { notaDoPrecoParaOCliente } from "./itens-a-mais";
import { MENSAGEM_DE_PASSAR_A_UMA_PESSOA, perguntaSeEUmaPessoa, SOU_A_ASSISTENTE_AUTOMATICA } from "./voz-da-vitoria";
import {
  deQueEFeitoOTotal,
  precoDaVitoria,
  quemPassaAFatura,
  totalDaVitoria,
  totalEmPalavrasDoNovoModelo,
  type LinhaDaVitoria,
} from "./o-total-da-vitoria";

/**
 * O WhatsApp como ecrã da negociação — o cérebro.
 *
 * A IDENTIDADE É A POSSE DO NÚMERO. Cada mensagem chega do número de
 * telefone que está no pedido (`contactPhone`) — o mesmo grau de confiança
 * do link por email: quem tem o canal, fala pelo pedido. Um número que não
 * bate com nenhum pedido activo recebe uma explicação e nada mais.
 *
 * O MOTOR NÃO MUDOU. As acções são as mesmas do ecrã do site e do
 * backoffice — propor, aceitar, contratar, desistir, com `lado: "cliente"`.
 * Este ficheiro só traduz: botão "ct:9:12" → contratar a negociação #12 do
 * pedido #9; texto "300" → contraproposta de 300 €; "27/08 14:30" → data
 * marcada. Tudo fica no histórico como "por WhatsApp".
 */

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

/** Os pedidos activos deste número — comparados pelos últimos 9 dígitos. */
/**
 * A conversa que recolhe um pedido — o passo de hoje, gravado e respondido.
 *
 * Lê onde este número ia, aplica o que ele escreveu (`responderNaRecolha`,
 * pura), grava o passo seguinte e manda a pergunta. Ao SIM do resumo, o
 * pedido nasce na base e a recolha fecha com o número dele. «Falar com
 * alguém» entrega a conversa — o mesmo interruptor que o painel tem.
 */
export async function recolherPedidoPorWhatsApp(
  telefone: string,
  texto: string,
  /** Fotografias e vídeos que chegaram nesta rajada — agradecem-se (20-10-2026). */
  imagensNovas = 0,
  /** O que se viu nelas — a descrição, e o serviço se ainda não se sabe (21-10-2026). */
  visto: string[] = [],
  /** Sem ir buscar os pedidos abertos dele — quando pediu claramente um pedido novo (26-10-2026). */
  opcoes: {
    semPedidosAbertos?: boolean;
    videos?: number;
    /** Pediu claramente um pedido novo, e já tinha este (d73, 21-11-2026): diz-se-lhe que é novo. */
    pedidoNovoDe?: number;
  } = {},
): Promise<void> {
  /* O preço público das mudanças (11-11-2026): lido antes de responder, para a Vitória dizer o «desde» dos parceiros (ou a referência). */
  await import("./ler-preco-publico-das-mudancas").then((m) => m.precoPublicoDasMudancas()).catch(() => undefined);
  const {
    recolhaWhatsApp,
    guardarRecolhaWhatsApp,
    apagarRecolhaWhatsApp,
    interromperNumeroWhatsApp,
    mensagensDoNumeroWhatsApp,
  } = await import("@/lib/db");
  const {
    responderNaRecolha,
    responderComCompreensao,
    jaCumprimentouNesteFio,
    jaDisseQueNaoCompra,
    jaExplicouOPreco,
    fotosNoFio,
    perguntaPendente,
    recolhaNova,
    perguntaDo,
    mensagemDePedidoRegistado,
    disseQueMandouFotografias,
    responderAsImagens,
    comAgradecimentoDasImagens,
    primeiraPerguntaDoServico,
    servicosDaListaNoFio,
    lerAsPartesDaRajada,
    ditosDestaRecolha,
  } = await import("@/lib/whatsapp-recolha");
  const { compreender, compreensaoDisponivel } = await import("@/lib/whatsapp-compreensao");

  const guardada = await recolhaWhatsApp(telefone);
  /*
   * O RASCUNHO GUARDA-SE 7 DIAS — d93 (23-11-2026). Era um dia: a cliente que
   * disse tudo às 11h58 ouviu no dia seguinte «o que é para levar?» outra vez.
   * Ver `conversa-parada-a-meio.ts` (`HORAS_DO_RASCUNHO`).
   */
  const { rascunhoAindaVale } = await import("@/lib/conversa-parada-a-meio");
  const paradaHaMuito = guardada != null && !rascunhoAindaVale(guardada.actualizadoEm);
  type Estado = Parameters<typeof responderNaRecolha>[0];

  /*
   * ⚠️ UM PEDIDO JA REGISTADO NESTA CONVERSA NAO FAZ DELA UM CLIENTE NOVO.
   *
   * 30-09-2026, a Elvira. As 12:48 saiu «Pedido #402 registado» e, na linha
   * seguinte, «Bom dia! Aqui e a CLYON. Diga-me o que precisa de levar ou
   * fazer». Ela tinha acabado de dizer que o pedido estava marcado para uma
   * hora ja passada, e a correccao caiu no chao; as duas perguntas que fez a
   * seguir levaram duas vezes a mesma frase de acolhimento.
   *
   * O comentario que aqui estava dizia a intencao certa — recomecar so
   * quando o pedido «deixou de estar activo» — e o codigo nunca chegou a
   * perguntar se ele estava. Bastava `pedidoId` preenchido para a recolha
   * ACABADA ser lida como recolha INEXISTENTE.
   *
   * O pedido le-se PELO NUMERO DELE e nao pelo telefone: e a unica leitura
   * que nao depende do formato com que o numero entrou. E na duvida — a base
   * a falhar — considera-se vivo, porque saudar de novo quem ja tem pedido e
   * o pior dos dois erros.
   */
  const pedidoDaConversa = guardada?.pedidoId ?? null;
  if (pedidoDaConversa != null) {
    const dele = await getSimulatorOrderById(pedidoDaConversa).catch(() => undefined);
    const encerrado =
      dele != null && ["cancelado", "concluido", "arquivado"].includes(String(dele.status ?? ""));
    if (!encerrado) {
      // O que ele manda junta-se a ESTE pedido — ver `completarOPedidoAberto` (26-10-2026).
      if (dele && (await completarOPedidoAberto(telefone, dele, texto, { imagensNovas, visto, guardada, videos: opcoes.videos }))) {
        return;
      }
      // Imagens sem uma palavra: ficaram no pedido quando entraram.
      if (!texto.trim()) return;
      await responderAQuemJaTemPedido(telefone, pedidoDaConversa);
      return;
    }
    /*
     * O pedido fechou-se. Agora sim, o que vier a seguir e outro — e
     * diz-se a serio, num sitio so, em vez de sair de lado numa gravacao.
     */
    const { recomecarRecolhaWhatsApp } = await import("@/lib/db");
    await recomecarRecolhaWhatsApp(telefone);
  }

  // Uma recolha parada ha mais de um dia recomeca-se: ver `paradaHaMuito`.
  const estado: Estado | null =
    guardada && guardada.pedidoId == null && !paradaHaMuito
      ? { passo: guardada.passo as Estado["passo"], dados: guardada.dados as Estado["dados"] }
      : null;

  /*
   * Primeiro o Gemini lê a mensagem; só se ele não puder é que se lê pelos
   * números. Ele devolve os campos que percebeu, ainda por validar, e é a
   * `responderComCompreensao` — pura, com os validadores de sempre — que
   * decide o que fica gravado e o que se pergunta a seguir.
   */
  const agora = new Date();

  /*
   * A CONVERSA VAI COM A MENSAGEM.
   *
   * "não quero ficar criando palavras para ele, quero que garanta que o gemini
   * esteja analisando as conversas" — 16-09-2026.
   *
   * O modelo via uma frase de cada vez. Daí vinham os erros todos de um dia:
   * perguntou duas vezes a morada que o Ivo tinha acabado de dar, leu «Quero
   * retirar» como «quero desistir do pedido» e ofereceu-se para apagar tudo, e
   * respondeu «não apanhei» a «acredito que caiba tudo no elevador» — que era
   * a resposta óbvia à pergunta anterior.
   *
   * Vinte linhas: chegam para o fio de uma recolha inteira (a do Ivo teve
   * vinte e cinco em quinze minutos) sem encher o pedido de texto que já não
   * diz nada. A mensagem de agora já está lá dentro, porque a ponte regista o
   * que entra antes de decidir o que fazer com isso.
   *
   * Se a base falhar, vai vazio e o modelo lê como lia antes — pior, mas não
   * calado.
   */
  const fio = await mensagensDoNumeroWhatsApp(telefone, 20).catch(() => []);

  /*
   * QUEM JÁ TEM PEDIDO NÃO RECOMEÇA DO ZERO — 26-10-2026 (decisão d30).
   *
   * *«Antes de iniciar os pedidos, olhar pelo número de telefone daquele
   * cliente, se ele já tem cadastro. Se tiver, não precisa de começar do
   * zero.»* — o dono. A cliente do #812 (nome e número inventados) tinha o
   * pedido feito no simulador, com fotografias; um colega pediu-lhe à mão mais
   * imagens, ela mandou uma, e a Vitória respondeu «Boa tarde! Aqui é a
   * Vitória… diga-me só que serviço é», e depois perguntou-lhe o nome duas
   * vezes. Ver `pedido-aberto-na-conversa.ts`.
   *
   * Procura-se antes de começar (e a meio, quando ele diz que já fez o pedido,
   * ou quando um colega falou de um à mão): com um pedido aberto, continua-se
   * ESSE; com dois ou mais, pergunta-se a qual se refere. Quem pede claramente
   * outra coisa começa um pedido novo, como sempre.
   */
  const { procurarOPedidoAMeio } = await import("@/lib/pedido-aberto-na-conversa");
  const aEscolher = estado?.dados.pedidosAEscolher;
  if (estado && Array.isArray(aEscolher) && aEscolher.length > 0) {
    if (await escolherEntreOsPedidos(telefone, estado.dados, texto, imagensNovas, visto, fio)) return;
    // Os pedidos fecharam-se entretanto, e a escolha apagou-se: recomeça-se.
    await recolherPedidoPorWhatsApp(telefone, texto, imagensNovas, visto, opcoes);
    return;
  } else if (!opcoes.semPedidosAbertos && (!estado || procurarOPedidoAMeio(texto, fio))) {
    if (await continuarNumPedidoAberto(telefone, texto, imagensNovas, visto, fio, estado?.dados ?? null)) return;
  }

  /*
   * NUNCA RECOMEÇAR — 21-11-2026 (decisão d73, o caso A). Depois de um pedido
   * registado nesta conversa («Pedido #N registado»), a pergunta de abertura
   * («Diga-me o que precisa de levar ou fazer…») não volta a sair: se era
   * isso que ia sair, a conversa passa à equipa com a frase curta. Só quem
   * pede claramente um pedido novo a ouve — e ouve que é um pedido novo
   * (`avisoDePedidoNovo`), à parte do que já tem.
   */
  const d73 = await import("@/lib/pedido-em-curso");
  const registadoAqui = opcoes.semPedidosAbertos ? null : d73.pedidoRegistadoNaConversa(fio);
  const novoAParteDe = opcoes.pedidoNovoDe ?? (registadoAqui != null && d73.pedeServicoNovo(texto, null) ? registadoAqui : null);
  const naoRecomecar = async (resposta: string): Promise<boolean> => {
    if (registadoAqui == null || novoAParteDe != null || !d73.eAPerguntaDeAbertura(resposta)) return false;
    await passarAUmaPessoa(telefone, d73.motivoDeNaoRecomecar(registadoAqui), d73.PASSEI_A_EQUIPA);
    return true;
  };

  /*
   * AS FOTOGRAFIAS QUE ELE JÁ MANDOU — 10-10-2026.
   *
   * O Telmo mandou dezoito antes da primeira pergunta e ouviu, mais à frente,
   * «Conte-me o que há para levar». Contam-se as do fio e as que estão à
   * espera do pedido (`fotosPendentesWhatsApp`): o fio só traz as últimas
   * vinte mensagens, e dezoito fotografias enchem-no sozinhas.
   */
  const { contarFotosPendentesWhatsApp } = await import("@/lib/db");
  const fotos = Math.max(
    fotosNoFio(fio),
    await contarFotosPendentesWhatsApp(telefone).catch(() => 0),
  );

  /*
   * O NOME QUE JÁ SE SABE NÃO SE PERGUNTA — 16-11-2026 (d51). O que a equipa
   * lhe chamou no fio («Boa tarde, Anselmo!»), ou o de um pedido anterior do
   * número (mesmo fechado: só o nome). Ver `comONomeJaSabido`.
   */
  const { comONomeJaSabido, responderAoColega } = await import("@/lib/resposta-ao-colega-na-recolha");
  const { fotografiasParaDepois, semRepetirAPergunta } = await import("@/lib/nao-insistir");
  const { nomeDitoPelaEquipa } = await import("@/lib/o-que-a-equipa-ja-disse");
  const nomeDoNumero = async (d: { contactName?: string }): Promise<string | null> =>
    d.contactName || nomeDitoPelaEquipa(fio) ? null : await nomeDosPedidosAnteriores(telefone).catch(() => null);

  const responder = async (e: Estado) => {
    // Só imagens: não há palavras para o modelo ler — ver `responderAsImagens`.
    if (!texto.trim()) return responderAsImagens(e, agora, { jaCumprimentou: jaCumprimentouNesteFio(fio), visto });
    /*
     * A RESPOSTA À PERGUNTA DO COLEGA — 16-11-2026 (d51). «O material é
     * entulho? se sim quantos sacos?» → «Sim são 15 sacos»: recolha de
     * entulho, 15 sacos, como o simulador grava — e não a morada. Ver
     * `resposta-ao-colega-na-recolha.ts`.
     */
    const doColega = responderAoColega(e, texto, fio);
    if (doColega) return doColega;
    // «Não consigo enviar agora» às fotografias: «Sem problema, pode enviar mais tarde.» (d51)
    const depois = fotografiasParaDepois(e, texto, fio);
    if (depois) return depois;
    /*
     * «PARECE UM ESVAZIAMENTO» — 15-11-2026 (d43). A resposta à pergunta, se
     * estava pendente; depois, a pergunta (uma vez), relendo o que ele
     * escreveu nesta recolha; e o que o esvaziamento de empresa grava. Ver
     * `esvaziamento-na-recolha.ts`.
     */
    const textosDaRecolha = [...ditosDestaRecolha(fio, texto), texto];
    /*
     * O TURNO, À VOLTA DA LEITURA DE SEMPRE — ver `turno-da-recolha.ts`: o
     * link do anúncio da casa (d48), a resposta ao «parece um esvaziamento»
     * (d43), o «Orçamento» a meio (d48), a leitura, e depois a pergunta do
     * anúncio ou do esvaziamento no lugar da seguinte.
     */
    const { responderAoTurno } = await import("@/lib/turno-da-recolha");
    const r = await responderAoTurno(e, texto, agora, {
      textos: textosDaRecolha,
      // d129 (o #688): a fotografia que ficou no telemóvel (mandada antes da 1.ª mensagem) também conta — nunca se pede outra vez.
      fotos: Math.max(fotos, (await import("@/lib/rajada-do-whatsapp")).fotografiasNaConversa(fio)),
      jaExplicouOPreco: jaExplicouOPreco(fio),
      lerOTexto: responderAoTexto,
    });
    /*
     * IMAGENS COM TEXTO: a resposta ao texto, com o «Obrigada pelas
     * imagens!» à frente, e a marca de que ele as mandou — para no fim não se
     * lhas voltar a pedir (20-10-2026).
     */
    if (imagensNovas > 0 && r.resposta && !r.registar && !r.desistir && !r.pedirPessoa) {
      return {
        ...r,
        estado: { ...r.estado, dados: { ...r.estado.dados, fotosDitas: true } },
        resposta: comAgradecimentoDasImagens(r.resposta),
      };
    }
    return r;
  };

  const responderAoTexto = async (e: Estado) => {
    /*
     * A PERGUNTA VAI COM A MENSAGEM.
     *
     * Sem ela o modelo lê «Não preciso» a flutuar no vazio e casa-a com o
     * exemplo de desistir — foi assim que a recolha de uma cliente
     * desapareceu inteira. E o TEXTO CRU vai para a função pura, que sem ele
     * não tinha como cair no caminho antigo quando o modelo não percebe.
     */
    /*
     * A RAJADA, MENSAGEM A MENSAGEM — 27-10-2026 (decisão d2). O que já
     * responde à pergunta em cima (ou a uma de antes) fica já; o modelo lê o
     * resto contra a pergunta que estiver em cima DEPOIS disso. E se a
     * pergunta em cima nunca chegou a sair, não se diz «não apanhei» — ver
     * `lerAsPartesDaRajada` e `aPerguntaFoiFeita`.
     */
    const { aPerguntaFoiFeita } = await import("@/lib/reler-a-conversa");
    const partes = lerAsPartesDaRajada(e, texto, agora, aPerguntaFoiFeita(fio, e.passo));
    e = partes.estado;
    const lido = partes.texto;
    const pendente = perguntaPendente(e.passo, e.dados as never);
    /*
     * SÓ O PEDIDO DE LÍNGUA — «Do you speak English?», «Hiii» (28-10-2026,
     * d35): não há nada para o modelo ler, e a resposta é das regras
     * («Claro que sim!» e a pergunta da vez). Poupa-se a ida ao modelo.
     */
    const { linguaPedida, semPedidoDeLingua } = await import("@/lib/lingua-do-cliente");
    const soALingua = linguaPedida(lido) != null && !semPedidoDeLingua(lido).trim();
    const c = soALingua ? null : await compreender(lido, e.dados as Record<string, unknown>, agora, pendente, fio);
    /*
     * O CUMPRIMENTO SAI UMA VEZ POR CONVERSA, e quem sabe isso e o fio.
     *
     * O fio ja esta lido — vai para o modelo desde 16-09-2026 — e nele esta
     * escrito se alguma mensagem que saiu daqui ja disse «Aqui e a CLYON».
     * Sem isto sairam dois bons-dias com dois minutos de intervalo, vindos de
     * dois sitios diferentes do codigo (ver `aberturaDaResposta`).
     */
    const cumprimentado = jaCumprimentouNesteFio(fio);
    // E se ja se lhe disse que a CLYON nao compra — pela mesma razao e da
    // mesma fonte. Ver `NAO_COMPRAMOS` em `whatsapp-recolha.ts`.
    const avisado = jaDisseQueNaoCompra(fio);
    // E se já se lhe disse como chega o preço — ver `COMO_CHEGA_O_PRECO`.
    const explicado = jaExplicouOPreco(fio);
    // E a lista numerada que ele tem à frente: o número dele é dessa lista
    // (25-10-2026) — ver `servicosDaListaNoFio`.
    const lista = servicosDaListaNoFio(fio);
    /*
     * ANTES DE CADA PERGUNTA, RELÊ-SE A CONVERSA — 14-11-2026 (d25 v2). O que
     * ele já escreveu nesta recolha (o «já com IVA», a garagem, a limpeza, o
     * «sem fatura») preenche o que está vazio; o que lá está não se pergunta.
     * Ver `ditosDestaRecolha` e `completarPeloQueJaDisse`.
     */
    const ditosAntes = ditosDestaRecolha(fio, texto);
    return c
      ? responderComCompreensao(e, c, agora, {
          texto: lido,
          jaCumprimentou: cumprimentado,
          jaDisseQueNaoCompra: avisado,
          fotos,
          jaExplicouOPreco: explicado,
          visto,
          lista,
          perguntaPorFazer: partes.perguntaPorFazer,
          ditosAntes,
        })
      : responderNaRecolha(e, lido, agora, cumprimentado, avisado, {
          fotos,
          jaExplicouOPreco: explicado,
          visto,
          lista,
          perguntaPorFazer: partes.perguntaPorFazer,
          ditosAntes,
        });
  };

  if (!estado) {
    // Primeira mensagem: se já diz o serviço, aproveita-se; senão, pergunta-se.
    const novo = recolhaNova();
    /*
     * QUEM TEM CONTA NÃO DIZ O NOME OUTRA VEZ — 26-10-2026 (decisão d30): «se
     * já tem cadastro, não precisa de começar do zero». O nome da conta dele,
     * se o número for o de uma; o que ele escrever manda sobre isto.
     */
    const { contaDoClientePeloTelefone } = await import("@/lib/db");
    const conta = await contaDoClientePeloTelefone(telefone).catch(() => null);
    if (conta?.nome) novo.dados.contactName = conta.nome;
    const r = await responder(comONomeJaSabido(novo, fio, await nomeDoNumero(novo.dados)));
    const avancou = r.estado.passo !== "servico";
    if (avancou && !r.pedirPessoa && !r.desistir) {
      await guardarRecolhaWhatsApp(telefone, r.estado.passo, r.estado.dados);
      // Quem já tinha um pedido nesta conversa ouve que este é novo, à parte (d73).
      const novoDe = novoAParteDe ?? registadoAqui;
      await enviarTextoWhatsApp(telefone, novoDe != null ? d73.comOAvisoDePedidoNovo(r.resposta, novoDe) : r.resposta);
    } else if (r.pedirPessoa) {
      /*
       * FALAR PRIMEIRO, INTERROMPER DEPOIS.
       *
       * `enviarTextoWhatsApp` passa pelo portão, e `podeOWhatsAppFalarCom`
       * devolve falso para um número interrompido há um milissegundo: a
       * despedida era engolida sem erro nenhum, e quem pediu para falar com
       * uma pessoa ficava a olhar para o silêncio.
       */
      await enviarTextoWhatsApp(telefone, r.resposta);
      await interromperNumeroWhatsApp(telefone, r.motivoDaEntrega ?? "Pediu para falar com uma pessoa");
    } else {
      /*
       * ⚠️ O QUE ELE JÁ DISSE NÃO SE DEITA FORA por ainda faltar o serviço.
       *
       * Gravava-se `{}`. A Berta escreveu «O meu nome é Berta Sobreirinho» na primeira
       * mensagem, sem dizer o que precisava — o nome foi percebido, e depois
       * apagado aqui, porque o serviço ainda não era conhecido. Duas mensagens
       * depois: «Com quem estou a falar?» (29-09-2026).
       *
       * Fica tudo o que se percebeu; só se pergunta o que falta. E diz-se
       * (20-10-2026): as imagens agradecidas e a morada anotada — ver
       * `primeiraPerguntaDoServico`.
       */
      const sabido = r.desistir ? {} : r.estado.dados;
      await guardarRecolhaWhatsApp(telefone, "servico", sabido);
      /*
       * QUEM PEDIU O QUE A CLYON NÃO FAZ OUVE-O JÁ NA PRIMEIRA RESPOSTA — e não
       * a pergunta do serviço, como se não tivesse dito nada (25-10-2026). A
       * resposta já traz a apresentação e o agradecimento das imagens.
       */
      const primeira =
        r.foraDoPlano && !r.desistir
          ? r.resposta
          : // E quem pediu a língua ou perguntou como funciona ouve a resposta
            // (28-10-2026, d35) — já com a apresentação dentro.
            r.respondidaAntes && !r.desistir
            ? r.resposta
            : primeiraPerguntaDoServico(sabido, imagensNovas, !compreensaoDisponivel(), agora, jaCumprimentouNesteFio(fio));
      // Nunca recomeçar (d73): depois de um pedido registado, a abertura não sai — passa à equipa.
      if (await naoRecomecar(primeira)) return;
      await enviarTextoWhatsApp(
        telefone,
        novoAParteDe != null && !r.foraDoPlano ? d73.comOAvisoDePedidoNovo(primeira, novoAParteDe) : primeira,
      );
    }
    return;
  }

  /*
   * NUNCA CALADA — 16-11-2026 (d48). Se o que ia sair já saiu há pouco (o
   * envio engolia-o por repetido) ou não ia sair nada, a conversa passa a uma
   * pessoa com o motivo, e ele ouve que um colega responde já. Ver
   * `nunca-calada.ts`.
   */
  const { semFicarCalada } = await import("@/lib/nunca-calada");
  // A mesma pergunta não sai duas vezes seguidas, nem o nome duas vezes (d51) — ver `nao-insistir.ts`.
  /*
   * A PERGUNTA EM CIMA E A QUE JÁ FOI RESPONDIDA — 18-11-2026 (d69). Se a
   * equipa fez à mão a pergunta de outro passo, a mensagem lê-se contra essa;
   * e nenhuma pergunta respondida na conversa se repete. Quem pede o valor
   * fechado fica com a nota no pedido e ouve a frase da base total. Ver
   * `nao-insistir.ts` e `valor-fechado-na-recolha.ts`.
   */
  const { naPerguntaEmCima } = await import("@/lib/nao-insistir");
  const { comOValorFechado } = await import("@/lib/valor-fechado-na-recolha");
  const lidaAgora = comOValorFechado(
    semRepetirAPergunta(await responder(comONomeJaSabido(naPerguntaEmCima(estado, fio), fio, await nomeDoNumero(estado.dados))), fio, texto),
    texto,
  );
  const r = texto.trim() ? semFicarCalada(lidaAgora, fio, agora, { passo: estado.passo, texto }) : lidaAgora;

  if (r.pedirPessoa) {
    // Falar primeiro — ver a nota acima: o portão engole o que sair depois. E
    // guardar o que ele já disse: quem desistiu a meio é uma pessoa da CLYON
    // que lhe vai pegar, e precisa de ver o que já se sabe.
    await guardarRecolhaWhatsApp(telefone, estado.passo, r.estado.dados).catch(() => {});
    await enviarTextoWhatsApp(telefone, r.resposta);
    await interromperNumeroWhatsApp(telefone, r.motivoDaEntrega ?? "Pediu para falar com uma pessoa");
    return;
  }
  if (r.desistir) {
    await apagarRecolhaWhatsApp(telefone);
    await enviarTextoWhatsApp(telefone, r.resposta);
    return;
  }
  if (r.registar) {
    /*
     * E A FOTOGRAFIA QUE NÃO ABRIU TAMBÉM FOI MANDADA — 18-11-2026. Está no
     * telemóvel (a equipa vê-a): no fim não se lhe pede «Se tiver
     * fotografias…, envie-as agora». Não conta nas fotografias do pedido.
     */
    const { eFotografiaFalhada } = await import("@/lib/rajada-do-whatsapp");
    const fotosNoTelemovel = fio.filter((m) => m.direccao === "in" && eFotografiaFalhada(m.texto ?? "")).length;
    await registarARecolha(telefone, r.estado.dados, { fotosNaConversa: fotos, fotosNoTelemovel });
    return;
  }

  // Nunca recomeçar (d73): a pergunta de abertura depois de um pedido registado passa à equipa.
  if (await naoRecomecar(r.resposta)) {
    await guardarRecolhaWhatsApp(telefone, estado.passo, r.estado.dados).catch(() => {});
    return;
  }
  await guardarRecolhaWhatsApp(telefone, r.estado.passo, r.estado.dados);
  await enviarTextoWhatsApp(telefone, r.resposta);
}

/**
 * REGISTAR O PEDIDO DE UMA RECOLHA — com o SIM dele, ou sozinho, 30 minutos
 * depois do resumo sem resposta (23-10-2026, ver `recolhas-paradas.ts`).
 *
 * Nasce o pedido, a recolha fica com o número dele, e o cliente ouve «Pedido
 * #N registado». Registado sozinho, diz-se-lhe porquê, e fica no histórico do
 * pedido para a equipa confirmar os dados. Se falhar, a conversa passa a uma
 * pessoa — o cliente não pode ficar sem resposta. Devolve o número, ou null.
 */
export async function registarARecolha(
  telefone: string,
  dados: DadosDaRecolhaNoRegisto,
  opcoes: { fotosNaConversa?: number; fotosNoTelemovel?: number; sozinho?: boolean } = {},
): Promise<number | null> {
  const { registarPedidoDaRecolha } = await import("@/lib/registar-pedido-por-whatsapp");
  const { mensagemDePedidoRegistado, disseQueMandouFotografias } = await import("@/lib/whatsapp-recolha");
  const { interromperNumeroWhatsApp } = await import("@/lib/db");
  // Uma conversa que completa um pedido que já existe não regista outro (26-10-2026).
  if (dados.pedidoAberto != null) return dados.pedidoAberto;
  try {
    // Quantas fotografias mandou — a descrição di-lo ao profissional (26-10-2026).
    const comAsFotos =
      (opcoes.fotosNaConversa ?? 0) > (dados.fotosRecebidas ?? 0) ? { ...dados, fotosRecebidas: opcoes.fotosNaConversa } : dados;
    const { id, fotos: fotosNoPedido, porTraduzir } = await registarPedidoDaRecolha(telefone, comAsFotos);
    const pool = await getPool();
    if (pool) {
      await pool
        .execute("UPDATE whatsappRecolhas SET pedidoId = ? WHERE RIGHT(telefone, 9) = RIGHT(?, 9)", [
          id,
          telefoneParaWhatsApp(telefone),
        ])
        .catch(() => {});
    }
    /*
     * NASCEU DE UMA TROCA DE SÍTIO (d51): o pedido antigo fica com a nota
     * final — o número deste — para a equipa o fechar; e este diz de onde veio.
     */
    if (dados.trocouDoPedido != null) {
      const { notaDaTroca, NOTA_DA_TROCA_A_MEIO } = await import("@/lib/troca-de-sitio");
      await anotarATrocaDeSitio(dados.trocouDoPedido, notaDaTroca(dados.trocouDoPedido, id), NOTA_DA_TROCA_A_MEIO);
      await appendOrderHistory(id, {
        type: "created",
        by: null,
        message: `Pedido novo do cliente do #${dados.trocouDoPedido}: disse no WhatsApp que já não é nessa morada.`,
      }).catch(() => {});
    }
    if (opcoes.sozinho) {
      await appendOrderHistory(id, {
        type: "created",
        by: null,
        message:
          "Registado sozinho pela Vitória: o cliente não respondeu ao resumo em 30 minutos. Confirme os dados com ele.",
      }).catch(() => {});
    }
    /*
     * REGISTADO JÁ COMPLETO, SEGUE SOZINHO PARA OS PARCEIROS — 22-11-2026
     * (decisão d87). Antes da mensagem, para ela dizer a verdade. Pela MESMA
     * função da Mesa, com todas as condições (ver
     * `envio-automatico-aos-parceiros-na-base.ts`); a descrição por traduzir
     * e o registado sem o SIM dele ficam nos «por enviar».
     */
    let jaSeguiu = false;
    try {
      const { seguirSozinhoParaOsParceiros } = await import("@/lib/envio-automatico-aos-parceiros-na-base");
      const envio = await seguirSozinhoParaOsParceiros(id, {
        origem: "registado",
        porTraduzir: porTraduzir === true,
        registadoSozinho: opcoes.sozinho === true,
      });
      jaSeguiu = envio.estado === "enviado";
    } catch (e) {
      console.error("[whatsapp/recolha] o envio automático do pedido registado falhou:", e);
    }
    /*
     * «SE TIVER FOTOGRAFIAS, ENVIE-AS» A QUEM JÁ AS ENVIOU — 09-10-2026.
     * O Maximiano mandou duas na primeira mensagem e ouviu isto no fim:
     * dizia-se sempre, porque aqui ia sempre `false`. E a quem disse que as
     * mandou também não (a Odete, 17-10-2026 — ver
     * `disseQueMandouFotografias`).
     */
    const comFotos =
      fotosNoPedido > 0 ||
      (opcoes.fotosNaConversa ?? 0) > 0 ||
      (opcoes.fotosNoTelemovel ?? 0) > 0 ||
      disseQueMandouFotografias(dados);
    await enviarTextoWhatsApp(
      telefone,
      mensagemDePedidoRegistado(id, comFotos, dados.contactName, opcoes.sozinho === true, jaSeguiu, new Date()),
    );
    /*
     * A DESCRIÇÃO FICOU POR TRADUZIR (d46): o tradutor falhou e ela está na
     * língua do cliente. Passa à equipa — depois de falar, porque o portão
     * engole o que sair depois de interromper.
     */
    if (porTraduzir) {
      await interromperNumeroWhatsApp(telefone, `Descrição do pedido #${id} por traduzir — o tradutor falhou; traduzir antes de enviar aos parceiros`).catch(
        (e) => console.error("[whatsapp/recolha] não passei à equipa o pedido por traduzir:", e),
      );
    }
    return id;
  } catch (e) {
    console.error("[whatsapp/recolha] não registou o pedido:", e);
    // A pessoa não pode ficar sem resposta: entrega-se a uma pessoa da CLYON.
    // Falar primeiro — ver a nota acima: o portão engole o que sair depois.
    await enviarTextoWhatsApp(
      telefone,
      "Tenho aqui tudo o que me disse, mas não consegui registar sozinho. Uma pessoa da CLYON vai tratar disto e responde-lhe por aqui.",
    );
    await interromperNumeroWhatsApp(telefone, "O registo automático falhou — ver a conversa");
    return null;
  }
}

type DadosDaRecolhaNoRegisto = import("@/lib/whatsapp-recolha").DadosDaRecolha;

export async function pedidosDoTelefone(telefone: string): Promise<number[]> {
  const pool = await getPool();
  if (!pool) return [];
  const digitos = telefoneParaWhatsApp(telefone).slice(-9);
  if (digitos.length < 9) return [];
  const [rows] = (await pool.execute(
    `SELECT id FROM simulatorOrders
      WHERE RIGHT(REGEXP_REPLACE(COALESCE(contactPhone, ''), '[^0-9]', ''), 9) = ?
        AND (status IS NULL OR status NOT IN ('cancelado', 'concluido', 'arquivado'))
      ORDER BY createdAt DESC
      LIMIT 10`,
    [digitos],
  )) as any[];
  return (rows as Array<{ id: number }>).map((r) => Number(r.id));
}

/**
 * O NOME DOS PEDIDOS ANTERIORES DO NÚMERO — 16-11-2026 (d51). Mesmo os
 * fechados ou antigos: só o nome, para não tratar como desconhecido quem já
 * fez pedidos. O pedido aberto continua com a regra d30 (`pedidosDoTelefone`).
 */
export async function nomeDosPedidosAnteriores(telefone: string): Promise<string | null> {
  const pool = await getPool();
  if (!pool) return null;
  const digitos = telefoneParaWhatsApp(telefone).slice(-9);
  if (digitos.length < 9) return null;
  const [rows] = (await pool.execute(
    `SELECT contactName FROM simulatorOrders
      WHERE RIGHT(REGEXP_REPLACE(COALESCE(contactPhone, ''), '[^0-9]', ''), 9) = ?
        AND contactName IS NOT NULL AND TRIM(contactName) <> ''
      ORDER BY createdAt DESC
      LIMIT 5`,
    [digitos],
  )) as any[];
  const nome = (rows as Array<{ contactName: string }>)
    .map((r) => String(r.contactName ?? "").trim())
    .find((n) => n && !/^cliente\s+whatsapp$/i.test(n));
  return nome ?? null;
}

type Alvo = {
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  /**
   * O MODELO DO PREÇO DESTA NEGOCIAÇÃO — 01-10-2026. Era o regime de IVA de
   * quem factura, que desde 22-09-2026 não entrava em conta nenhuma; o que
   * decide agora se o preço dito leva o IVA é a data em que a negociação
   * abriu (`IVA_INCLUIDO_DESDE`).
   */
  modelo: ModeloDoPreco;
  /** Como o cliente paga. Em dinheiro, a mensagem diz quanto vai em notas. */
  formaDePagamento: FormaDePagamento;
  /** As taxas gravadas nesta negociação — em dinheiro não são as de origem. */
  taxas: Taxas;
  /** Pelo trabalho todo, ou por carga — é do pedido, e vai com cada valor dito. */
  base: BaseDoPreco;
  estado: Negociacao;
  /**
   * d17: a linha da base (taxas, regime congelado, perfil do parceiro) e se
   * segue o modelo de 15-11 — o total dito sai de `totalAoClienteDaNegociacao`.
   */
  linha: LinhaDaVitoria;
  novoModelo: boolean;
};

/** A base do preço de um pedido, lida da base de dados. Na dúvida, a de sempre. */
async function baseDoPedido(pedidoId: number): Promise<BaseDoPreco> {
  const pedido = await getSimulatorOrderById(pedidoId).catch(() => undefined);
  return lerBase(pedido?.baseDoPreco);
}

/**
 * Uma linha a mais no fim da mensagem: por carga, a unidade; pelo trabalho
 * todo, os itens a mais pela tabela das peças (eram 32 € a 22-10-2026) (`notaDoPrecoParaOCliente`).
 */
function comNotaDaCarga(base: BaseDoPreco): string {
  return `\n\n${notaDoPrecoParaOCliente(base)}`;
}

/**
 * O botão de fechar diz a unidade também — e tem de caber nos 20 caracteres.
 *
 * E diz o PREÇO DELE, com os cêntimos — 29-09-2026. Com a taxa lá dentro os
 * preços deixaram de ser redondos: «Fechar 368 €» sobre 367,50 € era um número
 * que não estava em lado nenhum da mensagem. «Fechar 367,50 €» são 15; por
 * carga, «Fechar 367,50€/carga» são 20, no limite. Só um preço de quatro
 * algarismos por carga não cabe com os cêntimos, e aí arredonda-se: o botão
 * fecha pela negociação, não pelo número.
 */
function tituloDeFechar(preco: number, base: BaseDoPreco): string {
  const escrito = euros(preco).replace(",00 €", " €");
  if (base === "total") return `Fechar ${escrito}`;
  // «/carga» ou «/hora» (13-10-2026) — e os 20 caracteres a mandar.
  const unidade = base === "hora" ? "hora" : "carga";
  const junto = `Fechar ${escrito.replace(" €", "€")}/${unidade}`;
  return junto.length <= 20 ? junto : `Fechar ${Math.round(preco)}€/${unidade}`;
}

async function alvoDe(pedidoId: number, negociacaoId: number): Promise<Alvo | null> {
  const linhas = await negociacoesDoPedido(pedidoId);
  const n = linhas.find((x) => Number(x.id) === negociacaoId);
  if (!n) return null;
  const novoModelo = await noNovoModelo(n);
  return {
    linha: n,
    novoModelo,
    pedidoId,
    modelo: modeloDaNegociacao(n.createdAt),
    formaDePagamento: lerForma((n as { formaDePagamento?: unknown }).formaDePagamento),
    taxas: taxasDaNegociacao(n),
    base: await baseDoPedido(pedidoId),
    negociacaoId,
    profissionalNome: n.profissionalNome,
    estado: {
      estado: n.estado as Negociacao["estado"],
      valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
      propostas: propostasDe(n.propostasJson),
    },
  };
}

/**
 * A linha no histórico do pedido e no registo permanente.
 *
 * O `acontecimento` passou a ser escolhido por quem chama, a 12-09-2026. Era
 * sempre "proposta_feita", mesmo quando o que tinha acontecido era um negócio
 * FECHADO ou uma proposta RECUSADA — e um vocabulário fechado que diz sempre a
 * mesma palavra não serve para contar nada. A pergunta "quantos negócios se
 * fecharam por WhatsApp?" não tinha resposta.
 *
 * `autorTipo` vem pela mesma razão e é a mais importante das duas: quando o
 * assistente fecha, quem interpretou a frase do cliente foi um modelo de
 * linguagem. No dia de um desacordo, a diferença entre "o cliente carregou no
 * botão" e "o cliente escreveu uma frase que o assistente leu como sim" é a
 * história toda.
 */
async function registarAccao(
  pedidoId: number,
  negociacaoId: number,
  mensagem: string,
  acontecimento: Parameters<typeof registarSemFalhar>[0]["acontecimento"] = "proposta_feita",
  autorTipo: Parameters<typeof registarSemFalhar>[0]["autorTipo"] = "cliente",
): Promise<void> {
  await appendOrderHistory(pedidoId, { type: "created", by: null, message: mensagem });
  await registarSemFalhar({
    acontecimento,
    pedidoId,
    negociacaoId,
    autorTipo,
    autorNome: "WhatsApp",
    resumo: mensagem,
  });
}

/**
 * O ASSISTENTE PODE DECIDIR ISTO AGORA?
 *
 * Se o interruptor "fechar" estiver em baixo, a conversa não fica em silêncio
 * nem o cliente leva um "não percebi": passa para uma pessoa, e diz-se-lhe que
 * passou. Um travão que engole a intenção do cliente é pior do que não existir
 * — ele disse que sim e ninguém lhe respondeu.
 *
 * A mensagem sai ANTES de a conversa ser entregue, porque `enviarTextoWhatsApp`
 * pergunta ao portão e o portão fecha-se com a entrega.
 */
async function passarAUmaPessoa(
  telefone: string,
  porque: string,
  /** O que se lhe diz. Por omissão, a frase de sempre. */
  mensagem = MENSAGEM_DE_PASSAR_A_UMA_PESSOA,
): Promise<void> {
  const { interromperNumeroWhatsApp } = await import("@/lib/db");
  await enviarTextoWhatsApp(telefone, mensagem);
  await interromperNumeroWhatsApp(telefone, porque).catch(() => {});
}

/**
 * A DECISÃO SOBRE O PEDIDO EM CURSO, CUMPRIDA — 21-11-2026 (decisão d73). A
 * resposta pelo estado do pedido, o ecrã das propostas, ou a equipa com a
 * frase curta. Devolve `true` quando tratou a mensagem; «seguir» e «pedido
 * novo» ficam para quem chama.
 */
async function cumprirADecisaoNoPedidoEmCurso(
  telefone: string,
  decisao: import("@/lib/pedido-em-curso").DecisaoNoPedidoEmCurso,
): Promise<boolean> {
  switch (decisao.tipo) {
    case "responder":
      await enviarTextoWhatsApp(telefone, decisao.texto);
      return true;
    case "ecra":
      await mandarOEcra(telefone, decisao.pedidoId);
      return true;
    case "equipa":
      await passarAUmaPessoa(telefone, decisao.motivo, decisao.texto);
      return true;
    default:
      return false;
  }
}

/**
 * QUEM QUER SER PARCEIRO, MOTORISTA OU AJUDANTE — 17-11-2026 (d69). Recebe
 * logo o caminho da candidatura (com a zona, se a disse) e a conversa fecha-se
 * como «candidato a parceiro»: sai da fila dos clientes por responder. Uma
 * vez: se já o recebeu e volta a escrever, a conversa passa a uma pessoa.
 * Devolve true quando tratou a mensagem. Ver `candidato-a-parceiro.ts`.
 */
async function aoCandidato(telefone: string, texto: string): Promise<boolean> {
  if (!texto.trim()) return false; // só imagens
  const cand = await import("@/lib/candidato-a-parceiro");
  const { mensagensDoNumeroWhatsApp, arquivarConversaWhatsApp } = await import("@/lib/db");
  const fio = await mensagensDoNumeroWhatsApp(telefone, 40).catch(() => []);
  if (cand.jaRecebeuACandidatura(fio)) {
    const { soAgradece } = await import("@/lib/mesa-das-conversas");
    if (soAgradece(texto)) return true;
    await passarAUmaPessoa(telefone, "Candidato a parceiro voltou a escrever — responder");
    return true;
  }
  if (!cand.querSerParceiro(texto)) return false;
  const zona = cand.zonaDoCandidato(fio.filter((m) => m.direccao === "in").map((m) => m.texto).concat(texto));
  await enviarTextoWhatsApp(telefone, cand.respostaAoCandidato(zona));
  await arquivarConversaWhatsApp(telefone, true, { motivo: cand.MOTIVO_DO_CANDIDATO, porQuem: "vitoria" }).catch((e) =>
    console.error("[whatsapp] o candidato não saiu da fila:", e),
  );
  return true;
}

/**
 * O QUE A PESSOA QUER, ANTES DO FLUXO FIXO — d129 (26-11-2026). O modelo lê
 * a conversa (`vitoria-agente/intencao.ts`): o cliente segue para a recolha de
 * sempre; o candidato a parceiro recebe a candidatura (escrita pelo modelo, com
 * a ligação posta pelo código) e a conversa fecha-se como «candidato a
 * parceiro» (vai para os «Profissionais» da Mesa), sem pedido e sem o
 * rascunho; a dúvida responde-se e a pergunta do fluxo volta; a queixa e o
 * resto passam a uma pessoa. Devolve true quando tratou a mensagem.
 */
async function aIntencaoAntesDaRecolha(telefone: string, texto: string): Promise<boolean> {
  if (!texto.trim()) return false;
  const { decidirAIntencao } = await import("@/lib/vitoria-agente/intencao-na-base");
  const decisao = await decidirAIntencao(telefone, texto).catch(() => ({ tipo: "regras" as const, porque: "erro" }));
  switch (decisao.tipo) {
    case "regras":
      return false;
    case "candidato": {
      const cand = await import("@/lib/candidato-a-parceiro");
      const { arquivarConversaWhatsApp, apagarRecolhaWhatsApp } = await import("@/lib/db");
      await enviarTextoWhatsApp(telefone, decisao.texto);
      // Não é um cliente: o rascunho da recolha sai, e nunca se cria pedido.
      await apagarRecolhaWhatsApp(telefone).catch((e) => console.error("[whatsapp] o rascunho do candidato não saiu:", e));
      await arquivarConversaWhatsApp(telefone, true, { motivo: cand.MOTIVO_DO_CANDIDATO, porQuem: "vitoria" }).catch((e) =>
        console.error("[whatsapp] o candidato não saiu da fila:", e),
      );
      return true;
    }
    case "responder":
      await enviarTextoWhatsApp(telefone, decisao.texto);
      return true;
    case "equipa":
      await passarAUmaPessoa(telefone, decisao.motivo, decisao.texto);
      return true;
    case "queixa": {
      const { desculpasPeloAtendimento, perguntaSeEUmaPessoa } = await import("@/lib/voz-da-vitoria");
      await passarAUmaPessoa(
        telefone,
        "Cliente insatisfeito com o atendimento — responder já",
        desculpasPeloAtendimento(null, perguntaSeEUmaPessoa(texto)),
      );
      return true;
    }
  }
}

/**
 * O VALOR ÚNICO, DECIDIDO — 15-11-2026 (d39). Aceite: agradece, fica no
 * histórico do pedido e a conversa passa à equipa para escolher o parceiro
 * (é a equipa quem aceita a proposta dele, na Mesa). O resto: a equipa.
 * Nunca se aceita aqui proposta nenhuma.
 */
async function tratarOValorUnico(
  telefone: string,
  decisao: import("@/lib/valor-unico-no-whatsapp").DecisaoDoValorUnico,
): Promise<void> {
  const vu = await import("@/lib/valor-unico-no-whatsapp");
  if (!decisao) {
    await passarAUmaPessoa(telefone, "Respondeu sobre um valor único — confirmar");
    return;
  }
  if (decisao.tipo === "pessoa") {
    await passarAUmaPessoa(telefone, decisao.motivo);
    return;
  }
  await appendOrderHistory(decisao.pedidoId, {
    type: "valor_unico_aceite",
    by: null,
    message: "O cliente aceitou o valor único pelo WhatsApp. Falta escolher o parceiro e aceitar a proposta dele na Mesa.",
  }).catch((e) => console.error("[whatsapp] o aceite do valor único não ficou no histórico:", e));
  // O estado próprio do aceite (d39): a Mesa mostra «Valor único aceite pelo cliente — escolher o parceiro».
  const { marcarValorUnicoAceite } = await import("@/lib/valor-unico-no-whatsapp-na-base");
  await marcarValorUnicoAceite(decisao.pedidoId, "o cliente, pelo WhatsApp").catch((e) =>
    console.error("[whatsapp] o aceite do valor único não ficou marcado:", e),
  );
  /*
   * E A RUA, SE O PEDIDO FICOU SÓ COM A ZONA — 17-11-2026 (d69): o
   * agradecimento, a pergunta da rua (uma vez), e só depois a conversa passa à
   * equipa. A resposta grava-se na mesma, com a conversa entregue (a ponte).
   */
  await enviarTextoWhatsApp(telefone, vu.VALOR_UNICO_ACEITE);
  const { pedirARuaDepoisDoAceite } = await import("@/lib/rua-depois-do-aceite-na-base");
  await pedirARuaDepoisDoAceite(decisao.pedidoId);
  const { interromperNumeroWhatsApp } = await import("@/lib/db");
  await interromperNumeroWhatsApp(telefone, vu.motivoDoValorUnicoAceite(decisao.pedidoId)).catch(() => {});
}

/**
 * O «VOU PENSAR» — d90 (23-11-2026). Lido no texto dele (`disseQueVaiPensar`):
 * a resposta delicada (o banco de objecções da d91) e o seguimento da d83 a
 * arrancar sozinho (`arrancarOSeguimentoSozinho`, «vai_pensar», amanhã às
 * 10h). Se o seguimento não puder arrancar (desligado, já correu neste pedido,
 * Trabalho CLYON, sem contacto), a mesma resposta, e a conversa passa à equipa.
 * Devolve true quando tratou a mensagem.
 */
export async function tentarOVaiPensar(telefone: string, texto: string, pedidoId: number): Promise<boolean> {
  const vp = await import("@/lib/o-cliente-vai-pensar");
  const { reclamaDoAtendimento } = await import("@/lib/voz-da-vitoria");
  const tipo = vp.disseQueVaiPensar(texto, { queixa: reclamaDoAtendimento(texto) });
  if (!tipo) return false;
  const resposta = vp.respostaAoVaiPensar(tipo);
  const { arrancarOSeguimentoSozinho } = await import("@/lib/seguimento-do-cliente-na-base");
  const r = await arrancarOSeguimentoSozinho(pedidoId, "vai_pensar").catch((err) => ({
    ok: false as const,
    porque: err instanceof Error ? err.message : "erro",
  }));
  if (!r.ok) {
    await passarAUmaPessoa(telefone, `Pedido #${pedidoId}: o cliente disse que ia pensar — sem seguimento automático (${r.porque})`, resposta);
    return true;
  }
  await enviarTextoWhatsApp(telefone, resposta);
  return true;
}

/** O motivo à vista no cartão da conversa, quando um cancelamento fica com a equipa (d126: um ou vários pedidos). */
function motivoDeNaoCancelar(recusados: ReadonlyArray<{ pedidoId: number; porque: string; daEquipa: boolean }>): string {
  const o = (x: { daEquipa: boolean }) => (x.daEquipa ? "tratar à mão" : "cancelar à mão");
  if (recusados.length === 1) {
    const x = recusados[0];
    return `Pedido #${x.pedidoId}: o cliente quer cancelar, mas ${x.porque} — ${o(x)}`;
  }
  return `O cliente quer cancelar ${recusados.length} pedidos, mas ${recusados.map((x) => `#${x.pedidoId}: ${x.porque} (${o(x)})`).join("; ")}`;
}

/**
 * O CLIENTE QUER CANCELAR — d93 (23-11-2026). Devolve true quando tratou a
 * mensagem: cancelou (e anonimizou), perguntou o CANCELAR, ou passou à equipa.
 * Sem pedido aberto, ou com uma recolha a meio (o «cancelar» é dela), não é
 * daqui.
 */
export async function tratarOCancelamentoPeloCliente(telefone: string, texto: string): Promise<boolean> {
  const cpc = await import("@/lib/cancelar-pelo-cliente");
  const { eConfirmacaoDoCancelamento } = await import("@/lib/validade-do-orcamento");
  const leitura = cpc.querCancelar(texto);
  const oCancelar = eConfirmacaoDoCancelamento(texto);
  if (!leitura && !oCancelar) return false;
  const base = await import("@/lib/cancelar-pelo-cliente-na-base");
  const abertos = await base.pedidosAbertosDoTelefone(telefone).catch(() => [] as number[]);
  if (abertos.length === 0) return false;
  // Uma recolha a meio, sem pedido: o «cancelar» é dela (a desistência da recolha).
  const { recolhaWhatsApp, mensagensDoNumeroWhatsApp } = await import("@/lib/db");
  const g = await recolhaWhatsApp(telefone).catch(() => null);
  const { rascunhoAindaVale } = await import("@/lib/conversa-parada-a-meio");
  if (g && g.pedidoId == null && g.passo !== "servico" && rascunhoAindaVale(g.actualizadoEm)) return false;

  /*
   * d126 (25-11-2026): os pedidos que ele indicou, todos de uma vez, pelo
   * caminho de sempre, e UMA mensagem no fim (`cancelarOsPedidosPelaConversa`).
   * O que fica com a equipa (dinheiro, acordo, data marcada) passa a uma
   * pessoa com o porquê à vista no cartão — e o cliente ouve porquê.
   */
  const cancelarJa = async (pedidos: number[]): Promise<boolean> => {
    const r = await base.cancelarOsPedidosPelaConversa(pedidos, telefone).catch((err) => ({
      cancelados: [] as number[],
      recusados: pedidos.map((pedidoId) => ({ pedidoId, porque: err instanceof Error ? err.message : "erro", daEquipa: false })),
      mensagemSaiu: false,
      conversaApagada: false,
    }));
    if (r.recusados.length === 0) return true;
    const primeiro = r.recusados[0];
    const aoCliente = primeiro.daEquipa ? cpc.passoOCancelamentoAEquipa(primeiro.pedidoId, primeiro.porque) : MENSAGEM_DE_PASSAR_A_UMA_PESSOA;
    await passarAUmaPessoa(telefone, motivoDeNaoCancelar(r.recusados), aoCliente);
    return true;
  };

  // O CANCELAR à pergunta do CANCELAR que lhe saiu por último (há menos de 48 h), de um ou de vários pedidos,
  // seja qual for o caminho que a fez (d126: a pergunta da d93 e a dos lembretes respondem-se aqui da mesma maneira).
  if (oCancelar) {
    const fio = await mensagensDoNumeroWhatsApp(telefone, 10).catch(() => []);
    const ultimaSaida = [...fio].reverse().find((m) => m.direccao === "out") ?? null;
    const perguntados = cpc.pedidosDaPerguntaDoCancelar(ultimaSaida, abertos);
    if (perguntados.length > 0) return cancelarJa(perguntados);
  }

  // Os que ele escreveu (todos: «cancelar pedido 685 e pedido 684»); sem nenhum, o único aberto.
  const escritos = cpc.pedidosNaFrase(texto).filter((id) => abertos.includes(id));
  const alvos = escritos.length > 0 ? escritos : abertos.length === 1 ? [abertos[0]] : [];
  if (alvos.length === 0) {
    await passarAUmaPessoa(telefone, `Quer cancelar, e tem ${abertos.length} pedidos abertos (#${abertos.join(", #")}) — confirmar qual`);
    return true;
  }
  // O contratado, pago, com referência viva ou faturado: a equipa, logo (nem se pergunta).
  const ficam: Array<{ pedidoId: number; porque: string }> = [];
  for (const id of alvos) {
    const p = await base.lerOPedidoParaCancelar(id).catch(() => null);
    const fica = p ? cpc.porqueFicaComAEquipa(p) : "o pedido não se leu";
    if (fica) ficam.push({ pedidoId: id, porque: fica });
  }
  if (ficam.length === alvos.length) {
    await passarAUmaPessoa(
      telefone,
      motivoDeNaoCancelar(ficam.map((x) => ({ ...x, daEquipa: true }))),
      cpc.passoOCancelamentoAEquipa(ficam[0].pedidoId, ficam[0].porque),
    );
    return true;
  }
  // Os que se podem cancelar seguem; os que ficam passam à equipa no fim (cancelarJa diz porquê).
  if (leitura === "claro") return cancelarJa(alvos);
  // Ambíguo (ou o CANCELAR sem a pergunta feita): pergunta-se, por todos os que indicou.
  await enviarTextoWhatsApp(telefone, cpc.perguntaDoCancelamento(alvos));
  for (const id of alvos) {
    await appendOrderHistory(id, {
      type: "note",
      by: null,
      message: "O cliente falou em cancelar na conversa: perguntámos se confirma (responde CANCELAR). Nada foi cancelado (d93).",
    }).catch(() => {});
  }
  return true;
}

/**
 * O «1», O «2» E O «3» AO LEMBRETE DO ORÇAMENTO — 18-11-2026 (d62).
 *
 *   · «1» (ou «sim», «avançar»): numa negociação, fecha a proposta do lembrete
 *     pelo mesmo caminho do SIM (`fecharPeloCliente`); num Trabalho CLYON, o
 *     cliente aceita o preço e o parceiro do lembrete fica com o trabalho (a
 *     adjudicação segue pela equipa); num valor único, o aceite de sempre
 *     (`tratarOValorUnico`, a equipa escolhe o parceiro);
 *   · «2»: a conversa passa a uma pessoa;
 *   · «3» (ou «já não preciso»): NÃO cancela (d2, 18-11-2026) — pergunta
 *     «Confirma que quer cancelar o pedido #N? Responda CANCELAR.»
 *     (`cancelarPeloLembrete`, com o texto do cliente);
 *   · à espera do CANCELAR (`c.aEsperaDeCancelar`), o CANCELAR — também
 *     «cancel» ou «annuler», como o tradutor o põe — cancela
 *     (`confirmarCancelamentoPeloLembrete`): avisa os parceiros, manda o texto
 *     de cancelamento aprovado e marca o pedido para a purga 7 dias depois
 *     (nada se anonimiza no momento). Outro «3» ou «já não preciso» à espera:
 *     não cancela nem repete a pergunta. Um «1» ou um «2» seguem os caminhos
 *     de sempre;
 *   · o cancelamento que não se faz (ok: false) passa a uma pessoa;
 *   · o resto, ou dois pedidos à espera: a contagem pára e passa a uma pessoa.
 *
 * Exportada só para o teste da conversa (d2-cancelar-pelo-lembrete.test.ts).
 */
export async function responderAoLembreteDoOrcamento(
  telefone: string,
  texto: string,
  ciclos: import("@/lib/validade-do-orcamento-na-base").CicloComLembrete[],
): Promise<void> {
  const regras = await import("@/lib/validade-do-orcamento");
  const base = await import("@/lib/validade-do-orcamento-na-base");

  // O CANCELAR à pergunta do CANCELAR: antes de ler a resposta como «1», «2» ou «3».
  if (ciclos.length === 1 && ciclos[0].aEsperaDeCancelar && regras.eConfirmacaoDoCancelamento(texto)) {
    const c = ciclos[0];
    const r = await base.confirmarCancelamentoPeloLembrete(c.pedidoId, telefone, texto).catch((err) => {
      console.error("[whatsapp] o CANCELAR pelo lembrete falhou:", err instanceof Error ? err.message : err);
      return { ok: false as const, porque: "erro" };
    });
    if (!r.ok) await passarAUmaPessoa(telefone, `Pedido #${c.pedidoId}: respondeu CANCELAR, mas ${r.porque} — cancelar à mão`);
    return;
  }

  const leitura = regras.lerRespostaAoLembrete(texto);

  if (ciclos.length > 1) {
    for (const c of ciclos) await base.pararOCiclo(c.pedidoId, "o cliente respondeu (tem mais do que um pedido à espera)").catch(() => {});
    await passarAUmaPessoa(
      telefone,
      `Respondeu ao lembrete do orçamento com ${ciclos.length} pedidos à espera (#${ciclos.map((c) => c.pedidoId).join(", #")}) — confirmar qual`,
    );
    return;
  }
  const c = ciclos[0];

  // d90: «vou pensar» ao lembrete — a resposta delicada e o seguimento sozinho (que pára a validade).
  if (leitura === null && (await tentarOVaiPensar(telefone, texto, c.pedidoId))) return;

  if (leitura === null || leitura === "duvidas") {
    await base.pararOCiclo(c.pedidoId, leitura === "duvidas" ? "«2» — dúvidas ou outra data" : "o cliente escreveu").catch(() => {});
    await passarAUmaPessoa(
      telefone,
      leitura === "duvidas"
        ? `Pedido #${c.pedidoId}: tem dúvidas ou quer outra data («2» ao lembrete do orçamento)`
        : `Respondeu ao lembrete do orçamento do pedido #${c.pedidoId} — responder`,
    );
    return;
  }

  if (leitura === "cancelar") {
    // Sem a pergunta feita, pergunta; à espera do CANCELAR, outro «3» não faz nada (o CANCELAR tratou-se acima).
    const r = await base.cancelarPeloLembrete(c.pedidoId, telefone, texto).catch((err) => {
      console.error("[whatsapp] o cancelamento pelo lembrete falhou:", err instanceof Error ? err.message : err);
      return { ok: false as const, porque: "erro" };
    });
    if (!r.ok) await passarAUmaPessoa(telefone, `Pedido #${c.pedidoId}: disse que já não precisa — cancelar à mão`);
    return;
  }

  // «1» — avançar.
  if (c.valorUnico) {
    await base.marcarCicloTerminado(c.pedidoId, "o cliente avançou («1»)");
    await tratarOValorUnico(telefone, { tipo: "aceite", pedidoId: c.pedidoId });
    return;
  }
  if (c.eClyon) {
    if (c.negociacaoId == null) {
      await base.pararOCiclo(c.pedidoId, "«1» sem parceiro no lembrete").catch(() => {});
      await passarAUmaPessoa(telefone, `Trabalho CLYON #${c.pedidoId}: o cliente quer avançar — escolher o parceiro`);
      return;
    }
    const r = await base.aceitarTrabalhoClyonPeloLembrete(c.pedidoId, c.negociacaoId).catch((err) => {
      console.error("[whatsapp] o aceite pelo lembrete falhou:", err instanceof Error ? err.message : err);
      return { ok: false as const, porque: "erro" };
    });
    if (!r.ok) {
      await base.pararOCiclo(c.pedidoId, "«1» que não se gravou").catch(() => {});
      await passarAUmaPessoa(telefone, `Trabalho CLYON #${c.pedidoId}: o cliente quer avançar, mas ${r.porque} — confirmar`);
      return;
    }
    await enviarTextoWhatsApp(telefone, regras.textoDoAvancarNumTrabalhoClyon(c.pedidoId, r.parceiro));
    const { interromperNumeroWhatsApp } = await import("@/lib/db");
    await interromperNumeroWhatsApp(
      telefone,
      `Trabalho CLYON #${c.pedidoId}: o cliente avançou pelo lembrete — enviar a adjudicação`,
    ).catch(() => {});
    return;
  }
  const alvo = (await alvosAccionaveis([c.pedidoId])).find((a) => a.negociacaoId === c.negociacaoId);
  if (!alvo) {
    await base.pararOCiclo(c.pedidoId, "«1» com a proposta do lembrete já fora da mesa").catch(() => {});
    await passarAUmaPessoa(telefone, `Pedido #${c.pedidoId}: o cliente quer avançar, mas a proposta do lembrete já não está de pé — confirmar`);
    return;
  }
  await base.marcarCicloTerminado(c.pedidoId, "o cliente avançou («1»)");
  await fecharPeloCliente(telefone, alvo);
}

/**
 * O «1», O «2», O «3» E O CANCELAR AO SEGUIMENTO DO CLIENTE — 21-11-2026 (d83).
 *
 *   · à espera do CANCELAR, o CANCELAR cancela
 *     (`confirmarCancelamentoPeloSeguimento`); se não se fizer, passa a uma pessoa;
 *   · a desistência clara («já tenho outra opção», «já contratei outra
 *     empresa», «já não preciso», «já resolvi», «não estou interessado» — d111):
 *     cancela logo, pelo caminho da d93/d94 (anonimiza, «não contactar»), e diz
 *     que o pedido foi cancelado e os dados serão apagados;
 *   · «3» (ou um «cancelar» sozinho): NÃO cancela — pergunta «Confirma que
 *     quer cancelar o pedido #N? Responda CANCELAR.» (d2); outro «3» à espera
 *     não repete a pergunta;
 *   · «1» (d111): com UMA proposta aceita-a (o fecho de sempre); com VÁRIAS,
 *     a lista numerada e «Qual quer escolher?»; sem nenhuma, a equipa;
 *   · «2»: outra data — passa a uma pessoa;
 *   · a escolha por palavras («Gostaria de escolher a proposta da X», d111):
 *     aceita essa; na dúvida, a lista;
 *   · o resto: passa a uma pessoa.
 *
 * Em todos, o ciclo pára e o pedido volta a contar no «Precisa de si».
 * Exportada só para o teste da conversa (d83-seguimento-do-cliente.test.ts).
 */
export async function responderAoSeguimentoDoCliente(
  telefone: string,
  texto: string,
  c: import("@/lib/seguimento-do-cliente-na-base").SeguimentoQueResponde,
): Promise<void> {
  const regras = await import("@/lib/validade-do-orcamento");
  const base = await import("@/lib/seguimento-do-cliente-na-base");
  const d111 = await import("@/lib/a-escolha-e-a-desistencia-no-whatsapp");
  const { desisteClaramente, MOTIVOS_DO_SEGUIMENTO } = await import("@/lib/a-escolha-e-a-desistencia");
  const agora = new Date();

  // d111: «já tenho outra opção» — cancela logo (e desde a d129 o «3» também, mais abaixo).
  if (desisteClaramente(texto)) {
    await d111.desistirDoPedido(telefone, c.pedidoId, "resposta ao seguimento");
    return;
  }

  if (c.aEsperaDeCancelar && regras.eConfirmacaoDoCancelamento(texto)) {
    const r = await base.confirmarCancelamentoPeloSeguimento(c.pedidoId, telefone, texto).catch((err) => {
      console.error("[whatsapp] o CANCELAR pelo seguimento falhou:", err instanceof Error ? err.message : err);
      return { ok: false as const, porque: "erro" };
    });
    if (!r.ok) await passarAUmaPessoa(telefone, `Pedido #${c.pedidoId}: respondeu CANCELAR ao seguimento, mas ${r.porque} — cancelar à mão`);
    return;
  }

  const leitura = regras.lerRespostaAoLembrete(texto);
  if (leitura === "cancelar") {
    // d129: o «3» do menu cancela logo (a mensagem do porquê da d126); só o texto livre ambíguo pede o CANCELAR.
    const { eOTresDoMenu } = await import("@/lib/a-escolha-e-a-desistencia");
    if (eOTresDoMenu(texto)) {
      await d111.desistirDoPedido(telefone, c.pedidoId, "«3» ao seguimento", { comOPorque: true });
      return;
    }
    if (c.aEsperaDeCancelar) return;
    const r = await base.pedirConfirmacaoDoCancelamentoDoSeguimento(c.pedidoId, telefone).catch((err) => {
      console.error("[whatsapp] a pergunta do CANCELAR do seguimento falhou:", err instanceof Error ? err.message : err);
      return { ok: false as const, porque: "erro" };
    });
    if (!r.ok) {
      await base.pararSeguimento(c.pedidoId, "«3» ao seguimento — a pergunta do CANCELAR não saiu", agora).catch(() => false);
      await passarAUmaPessoa(telefone, `Pedido #${c.pedidoId}: disse que já não precisa (seguimento) — cancelar à mão`);
    }
    return;
  }

  // d111: o «1» foi a Vitória que o ofereceu — uma proposta aceita-se, várias vão em lista.
  if (leitura === "avancar") {
    await d111.responderAoUmDoSeguimento(telefone, c.pedidoId);
    return;
  }
  // d111: «Gostaria de escolher a proposta da X» — aceita essa (na dúvida, a lista).
  if (leitura === null && (await d111.escolhaPorPalavrasNoSeguimento(telefone, c.pedidoId, texto))) return;

  await base.pararSeguimento(c.pedidoId, leitura === "duvidas" ? "«2» — quer outra data" : "o cliente respondeu", agora).catch(() => false);
  await passarAUmaPessoa(
    telefone,
    leitura === "duvidas" ? MOTIVOS_DO_SEGUIMENTO.outraData(c.pedidoId) : MOTIVOS_DO_SEGUIMENTO.respondeu(c.pedidoId),
  );
}

/**
 * A ESCOLHA DO CLIENTE, FECHADA — d111. O mesmo caminho do botão «Fechar»
 * (`ct:pedido:negociação`, que a Vitória agente também usa): o pedido tem de
 * ser deste número e a negociação dele; depois `fecharPeloCliente` (o
 * interruptor «fechar», a guia, a transacção da d26, o aviso ao contratado e a
 * mensagem do fecho). Devolve false quando não havia o que fechar.
 */
export async function fecharAEscolhaDoCliente(telefone: string, pedidoId: number, negociacaoId: number): Promise<boolean> {
  if (!(await pedidosDoTelefone(telefone)).includes(pedidoId)) return false;
  const alvo = await alvoDe(pedidoId, negociacaoId);
  if (!alvo) return false;
  await fecharPeloCliente(telefone, alvo);
  return true;
}

/**
 * Fechar pelo cliente: as duas metades do aperto de mão — aceitar o valor
 * pendente (se o houver) e contratar. É o mesmo caminho do botão «Fechar» e
 * da palavra SIM: um só corpo, para nunca haver dois comportamentos.
 */
/**
 * O PARCEIRO CONTRATADO PELO WHATSAPP FICA A SABER — d102 (CEO e dono,
 * 24-11-2026). Pelo painel e pela app, quem é contratado recebe logo o email
 * (com a morada) e o aviso no telemóvel (`avisarQueFoiContratadoSemFalhar`);
 * pelo WhatsApp — o SIM pelas regras, o SIM à pergunta da Vitória agente e o
 * «1» ao lembrete da validade (d62), que passam todos por `fecharPeloCliente`
 * — não recebia nada, e a Vitória dizia ao cliente que «o parceiro recebeu a
 * morada». Chama-se UMA vez, só depois de o fecho ficar gravado (a transacção
 * da d26 só deixa passar um). Nunca lança: o negócio já está fechado.
 */
export async function avisarOContratadoDoFechoPeloWhatsApp(pedidoId: number, negociacaoId: number, valorAcordado: number | null): Promise<void> {
  try {
    const linha = (await negociacoesDoPedido(pedidoId)).find((n) => Number(n.id) === negociacaoId);
    if (!linha || !Number(linha.providerId)) return;
    const { avisarQueFoiContratadoSemFalhar } = await import("@/lib/agir-como-cliente");
    const { urlDeAccao } = await import("@/lib/url-do-site");
    await avisarQueFoiContratadoSemFalhar({
      pedidoId,
      negociacaoId,
      providerId: Number(linha.providerId),
      linha: linha as Parameters<typeof avisarQueFoiContratadoSemFalhar>[0]["linha"],
      valorAcordado,
      baseUrl: urlDeAccao(),
    });
  } catch (e) {
    console.error("[whatsapp] o aviso ao contratado não saiu:", e instanceof Error ? e.message : e);
  }
}

async function fecharPeloCliente(
  telefone: string,
  alvo: Alvo,
  /** O que ele escreveu ao fechar — pode trazer o dia lá dentro. */
  diaQueEleDisse?: string,
): Promise<void> {
  const {
    assistentePode,
    reservarAvisoDoAssistente,
    guardarTextoDoAviso,
    guardarDesfazerDoAviso,
    fecharAvisoDoAssistente,
  } = await import("@/lib/db");

  if (!(await assistentePode("fechar"))) {
    await passarAUmaPessoa(telefone, "Fechar desligado - quis avançar");
    return;
  }

  /*
   * A GUIA ANTES DE CONTRATAR — 04-11-2026 (d10.1). Pelo WhatsApp também não
   * se fecha um trabalho de resíduos com quem tem a guia por verificar: o
   * cliente lê porquê, e a conversa passa a uma pessoa da equipa.
   */
  /*
   * d118 (25-11-2026): a guia por verificar já não trava o entulho. A maioria
   * dos parceiros não emite guia: leva o entulho a um centro de resíduos. Fecha
   * como as outras desde que o cliente tenha lido o aviso ANTES de aceitar (a
   * linha do Jurídico, na mensagem das propostas); sem ele no fio, a Vitória
   * diz-lho primeiro e só fecha quando ele confirmar (o «1» ou o «sim»). Quem
   * marcou no pedido que precisa de guia passa a uma pessoa. Ver
   * `guia-no-entulho.ts`.
   */
  const { guiaImpedeANegociacao } = await import("@/lib/guia-na-base");
  if (await guiaImpedeANegociacao(alvo.negociacaoId)) {
    const g = await import("@/lib/guia-no-entulho");
    const doPedidoDaGuia = await getSimulatorOrderById(alvo.pedidoId).catch(() => null);
    const pediuGuia = Number((doPedidoDaGuia as { precisaGuiaTransporte?: unknown } | null)?.precisaGuiaTransporte ?? 0) === 1;
    if (pediuGuia) {
      await passarAUmaPessoa(telefone, g.MOTIVO_DA_GUIA, g.PASSO_A_GUIA_A_UMA_PESSOA);
      return;
    }
    const { mensagensDoNumeroWhatsApp } = await import("@/lib/db");
    const fioDaGuia = await mensagensDoNumeroWhatsApp(telefone, 40).catch(() => []);
    if (!g.jaFoiAvisadoDaGuia(fioDaGuia)) {
      await enviarTextoWhatsApp(telefone, g.perguntaDaGuiaAntesDeFechar(alvo.profissionalNome, alvo.pedidoId));
      return;
    }
  }

  const agora = new Date();
  let estado = alvo.estado;

  /*
   * O RETRATO DE ANTES, tirado antes de se mexer em nada.
   *
   * É ele que sustenta o "não era isto" das 24 horas no painel. Tirá-lo depois
   * do fecho seria fotografar exactamente o que se quer desfazer; e as
   * negociações que morrem com o fecho têm de ser lidas AGORA, porque daqui a
   * três linhas já estão mortas e não há como saber quais eram.
   */
  const outras = (await negociacoesDoPedido(alvo.pedidoId))
    .filter(
      (n) =>
        Number(n.id) !== alvo.negociacaoId &&
        (n.estado === "aberta" || n.estado === "aguarda_contratacao"),
    )
    // Com o ESTADO de cada uma, e não só o número: repô-las todas como
    // "aberta" achatava a diferença entre uma onde ninguém tinha proposto nada
    // e outra onde o profissional já aceitara e faltava o cliente fechar.
    .map((n) => ({ id: Number(n.id), estado: String(n.estado) }));
  const pendenteDoPro = estado.propostas.some(
    (p) => p.estado === "pendente" && p.por === "profissional",
  );
  if (pendenteDoPro) {
    const r = aceitar(estado, "cliente", agora);
    if (!r.ok) {
      await enviarTextoWhatsApp(telefone, `Não deu para fechar: ${r.erro}`);
      return;
    }
    estado = r.negociacao;
  }
  /*
   * ⚠️ ACEITAR DO LADO DO CLIENTE JÁ FECHA — não se contrata por cima.
   *
   * *«Considerem adjudicada a proposta da TRSul.»* «Aceitar TRSul: 60€.»
   * «Aceitar 60€.» «Aceitar 60.» «Aceitar 60,00.» — 29-09-2026, e a cada uma
   * o assistente respondeu «Não deu para fechar: Não há nada para contratar.»
   * A cliente acabou a escrever a mesma coisa cinco vezes a um robô que dizia
   * que não havia nada — com a proposta de 60 € ali, de pé.
   *
   * No motor, `aceitar(…, "cliente")` passa a negociação DIRECTAMENTE a
   * `acordada`: o cliente aceitar a proposta do profissional é o fecho. Isto
   * chamava `contratar` a seguir, sempre — e `contratar` só existe para o
   * outro caminho, `aguarda_contratacao` (o profissional aceitou o valor do
   * cliente e falta o cliente confirmar). Sobre uma negociação já acordada não
   * há acção nenhuma disponível, e a recusa saía para o cliente.
   *
   * Desde que os profissionais passaram a propor primeiro, este era o caso
   * COMUM — e fechar pelo WhatsApp falhava em quase todos.
   */
  let fechada = estado;
  if (estado.estado !== "acordada") {
    const r2 = contratar(estado, agora);
    if (!r2.ok) {
      await enviarTextoWhatsApp(telefone, `Não deu para fechar: ${r2.erro}`);
      return;
    }
    fechada = r2.negociacao;
  }
  const r2 = { negociacao: fechada };
  // Quem fica sem o trabalho — lido antes de encerrar, avisado depois (28-10-2026, d5).
  const { quemVaiFicarSemOTrabalho, avisarQuemFicouSemOTrabalho } = await import("@/lib/avisar-quem-perdeu");
  const perdem = await quemVaiFicarSemOTrabalho(alvo.pedidoId, alvo.negociacaoId);
  /*
   * SÓ SE NINGUÉM DECIDIU PRIMEIRO — 10-11-2026 (d26). O fecho (esta
   * contratada, as outras encerradas) faz-se numa só transacção, com o estado
   * que se leu. Se o cliente ou a equipa fecharam outra proposta no site no
   * mesmo instante, este não grava nada: a conversa passa a uma pessoa.
   */
  const gravou = await gravarNegociacao(
    alvo.negociacaoId,
    {
      estado: r2.negociacao.estado,
      valorAcordado: r2.negociacao.valorAcordado ?? null,
      propostasJson: JSON.stringify(r2.negociacao.propostas),
    },
    { estado: alvo.estado.estado, pedidoId: alvo.pedidoId },
  );
  if (!gravou.ok) {
    await passarAUmaPessoa(telefone, "Quis fechar - o pedido já tinha sido decidido");
    return;
  }
  const encerradas = gravou.encerradas;
  if (encerradas > 0) await avisarQuemFicouSemOTrabalho({ pedidoId: alvo.pedidoId, quem: perdem, porque: "outro" });
  await avisarOContratadoDoFechoPeloWhatsApp(alvo.pedidoId, alvo.negociacaoId, r2.negociacao.valorAcordado ?? null);
  await registarAccao(
    alvo.pedidoId,
    alvo.negociacaoId,
    `Cliente contratou ${alvo.profissionalNome} por WhatsApp — negociação #${alvo.negociacaoId}.` +
      (encerradas > 0 ? ` ${encerradas} outra(s) encerrada(s).` : ""),
    "negociacao_fechada",
    "assistente",
  );

  /*
   * O ASSISTENTE JÁ CONTOU ESTE FECHO — a mensagem sai três linhas abaixo.
   *
   * Sem esta reserva, o observador do cron via a negociação acordada, achava
   * que era novidade, e mandava ao cliente uma segunda mensagem a dizer a
   * mesma coisa dez minutos depois. A chave é construída pela MESMA função dos
   * dois lados, de propósito: duas strings escritas à mão acabavam por
   * divergir numa vírgula e ninguém daria por isso até o cliente se queixar.
   */
  try {
    const { chaveDoFecho } = await import("@/lib/assistente-automatico");
    const { id } = await reservarAvisoDoAssistente({
      chave: chaveDoFecho(alvo.negociacaoId),
      especie: "fechado",
      telefone,
      pedidoId: alvo.pedidoId,
      negociacaoId: alvo.negociacaoId,
    });
    if (id) {
      await guardarTextoDoAviso(id, `Fechado com ${alvo.profissionalNome} pelo assistente.`);
      /*
       * E FECHA-SE JÁ. Isto é uma NOTÍCIA, não uma pergunta.
       *
       * Deixá-la aberta punha-a na lista de quem não respondeu — e como
       * "fechado" não tem escada de lembretes, `esgotou()` diz logo que sim e
       * a passagem seguinte entregava a conversa a uma pessoa com a etiqueta
       * "três lembretes sem resposta", trinta segundos depois de o cliente ter
       * fechado o negócio. O melhor desfecho possível lido como o pior.
       */
      await fecharAvisoDoAssistente(id, "informado");
      await guardarDesfazerDoAviso(id, {
        pedidoId: alvo.pedidoId,
        negociacaoId: alvo.negociacaoId,
        estadoAntes: alvo.estado.estado,
        propostasAntes: JSON.stringify(alvo.estado.propostas),
        valorAntes: alvo.estado.valorAcordado ?? null,
        encerradas: outras,
      });
    }
  } catch (e) {
    // O negócio já está fechado. Falhar a nota sobre ele não o desfaz.
    console.error("[assistente] não registei o fecho:", e instanceof Error ? e.message : e);
  }

  const valor = r2.negociacao.valorAcordado ?? 0;
  /*
   * O QUE ELE PAGA — valor mais taxa, SEM IVA — e a factura numa linha à parte.
   *
   * Mandar-lhe só a base era prometer-lhe um número que ele não ia pagar: a
   * taxa acresce. Mandar-lhe o total com imposto era o oposto — um número que
   * ele não reconhece e que, se não quiser factura, também não vai pagar.
   *
   * E desde 29-09-2026 é UM número: o preço dele, que é o mesmo que ele viu
   * na proposta. «367,50 € (350 € para ele mais a taxa CLYON)» era a conta a
   * ser refeita à frente de quem acabou de dizer que sim.
   *
   * d17 (13-11-2026): no modelo de 15-11 o número é o do pedido e do email —
   * `totalAoClienteDaNegociacao`, pelo regime do parceiro.
   */
  // d10: no modelo de 15-11 paga ao parceiro, como escolher no pedido, e há duas faturas.
  const novo = await noNovoModelo({ ...alvo.linha, id: alvo.negociacaoId, estado: "acordada" });
  const totalNovo = totalDaVitoria(alvo.linha, valor, novo);
  const conta = precoDaVitoria(valor, alvo.taxas, alvo.modelo, totalNovo);
  /*
   * SE ELE JÁ DISSE O DIA, NÃO SE LHE PERGUNTA SE TEM DATA PENSADA.
   *
   * «Sim, estou interessada, pode ser no próximo dia 16?» traz a aceitação e o
   * dia na mesma linha. A frase de sempre — «se já tem data pensada, responda
   * por exemplo 27/08 14:30» — respondia a quem acabara de dar a data com um
   * convite para a dar, e com uma lição de formato por cima.
   *
   * Falta só a hora, e é só a hora que se pergunta. O exemplo continua lá
   * porque a resposta tem de ser legível do outro lado: pedir a hora sem dizer
   * como é que ela se escreve seria fazer uma pergunta que não se sabe ler.
   */
  const dito = diaQueEleDisse ? lerAData(diaQueEleDisse) : null;
  const sobreODia =
    dito && dito.hora == null
      ? `\n\nVi que falou no ${diaPorPalavras(dito)}. A que horas lhe dá jeito? Diga-me o dia e a hora juntos — por exemplo, ${dito.dia} às 10h.`
      : ` Se já tem data pensada, responda por exemplo: 27/08 14:30 — fica logo marcada.`;

  /*
   * EM DINHEIRO SÃO DUAS ENTREGAS — 21-09-2026. Este é o ÚNICO ecrã de conta
   * de quem fecha por WhatsApp: não passa pelo «Fica assim» do site. Se a
   * frase não disser quanto vai em notas e quanto vai à CLYON, ele chega ao
   * fim do trabalho sem saber quanto trazer — ou dá tudo ao profissional e a
   * taxa fica por pagar.
   */
  /*
   * COM IVA INCLUÍDO DESDE 01-10-2026 — o número é o total, e não há linha de
   * factura: há em todas as vendas. Antes do corte, o de sempre.
   */
  const factura = comFacturaEmPalavras(valor, alvo.modelo, alvo.taxas, alvo.base);
  const preco = precoComBase(euros(conta.aPagar), alvo.base);
  const fechado =
    alvo.formaDePagamento === "dinheiro" && !novo
      ? `Fechado com ${alvo.profissionalNome}, por ${preco}. ` +
        `${totalEmPalavras(valor, alvo.modelo, alvo.taxas, "dinheiro", alvo.base)}`
      : `Fechado com ${alvo.profissionalNome}: ${preco} a pagar, ${
          // Com IVA incluído, e de que é feito — 03-10-2026. Ver `desdobramentoDoIva`.
          totalNovo
            ? `IVA incluído (${deQueEFeitoOTotal(totalNovo)})`
            : conta.ivaIncluido
              ? `IVA incluído (${desdobramentoDoIva(conta)})`
              : "sem IVA"
        }.` +
        (factura ? ` ${factura}` : "") +
        // d17: quem passa a fatura do trabalho (com IVA, ou com a isenção do art. 53.º).
        (totalNovo ? ` ${quemPassaAFatura(alvo.linha)}` : "") +
        (novo ? ` ${pagaAoContratado(await dadosPorConfirmarDe(alvo.negociacaoId))}` : "");
  /*
   * O LINK DO PEDIDO — 01-11-2026 (ordem do CEO, aprovada pelo dono). Quem
   * fecha pelo WhatsApp nunca o tinha: pagar sozinho, confirmar a chegada e o
   * trabalho feito passavam por uma pessoa. Ver `link-de-quem-fecha-pelo-whatsapp.ts`.
   * Se o link falhar, a mensagem sai sem ele (o negócio já está fechado).
   */
  const { linkParaQuemFechou, fraseDoLinkDoFecho } = await import("@/lib/link-de-quem-fecha-pelo-whatsapp");
  const { existeContaComEmail, substituirTokenDoPedido } = await import("@/lib/db");
  const link = await linkParaQuemFechou(alvo.pedidoId, {
    emailDoPedido: async (id) => {
      const p = await getSimulatorOrderById(id);
      const e = typeof p?.contactEmail === "string" ? p.contactEmail.trim() : "";
      return e || null;
    },
    existeContaComEmail,
    substituirTokenDoPedido,
  });
  const doLink = link ? `\n\n${fraseDoLinkDoFecho(alvo.formaDePagamento, link, novo)}` : "";
  /*
   * SÓ COM A ZONA, O PARCEIRO AINDA NÃO TEM A MORADA — 17-11-2026 (d69): não
   * se lhe diz que tem, e a Vitória pede a rua a seguir (uma vez).
   */
  const { faltaARua } = await import("@/lib/rua-depois-do-aceite");
  const doPedido = await getSimulatorOrderById(alvo.pedidoId).catch(() => null);
  const semRua = faltaARua(typeof doPedido?.address === "string" ? doPedido.address : null);
  /*
   * OS PORMENORES SÓ AQUI, DEPOIS DE ACEITAR — 25-11-2026 (d114). A mensagem
   * das propostas ficou curta (o valor, o parceiro, a pergunta); o que vem com
   * o «sim» diz-se agora, curto: o que fica coberto e o que se faz a itens a
   * mais (pela tabela do serviço), que se confirma no local, e — no modelo de
   * 15-11 — que não paga nada adiantado. O pagamento, a fatura e a isenção já
   * estão na frase de cima.
   */
  const { extraNoLocal } = await import("@/lib/extra-no-local");
  const servicoDoPedido = typeof doPedido?.serviceType === "string" ? doPedido.serviceType : null;
  const pormenores = [
    alvo.base === "total" ? extraNoLocal(servicoDoPedido, "total") : "",
    ORCAMENTO_A_DISTANCIA,
    novo ? NAO_PAGA_NADA_ADIANTADO : "",
  ]
    .filter(Boolean)
    .join(" ");
  const oFecho =
    `${fechado}${comNotaDaCarga(alvo.base)}\n\n${pormenores}\n\n` +
    `O parceiro recebeu a morada e o seu contacto.${sobreODia}${doLink}`;
  await enviarTextoWhatsApp(
    telefone,
    semRua ? oFecho.replace("O parceiro recebeu a morada e o seu contacto.", "O parceiro recebeu a zona e o seu contacto.") : oFecho,
  );
  if (semRua) {
    const { pedirARuaDepoisDoAceite } = await import("@/lib/rua-depois-do-aceite-na-base");
    await pedirARuaDepoisDoAceite(alvo.pedidoId);
  }
}

/** Recusar pelo cliente — o corpo do botão «Recusar» e da palavra NÃO. */
/**
 * A recusa na base, sem falar com ninguém.
 *
 * Separada da mensagem de propósito: recusar VÁRIAS de uma vez faz o mesmo
 * trabalho quatro vezes e manda UMA mensagem. Quatro «a proposta de X foi
 * recusada, as outras continuam de pé» seguidas, a última das quais já não
 * tem outras nenhumas, é a definição de um robô a falar sozinho.
 */
async function recusarUmaNaBase(alvo: Alvo): Promise<{ ok: true } | { ok: false; erro: string }> {
  const r = desistir(alvo.estado, "cliente", new Date());
  if (!r.ok) return { ok: false, erro: r.erro };
  await gravarNegociacao(alvo.negociacaoId, {
    estado: r.negociacao.estado,
    valorAcordado: r.negociacao.valorAcordado ?? null,
    propostasJson: JSON.stringify(r.negociacao.propostas),
  });
  /*
   * A NOTA NÃO DESFAZ A RECUSA — e por isso não pode derrubá-la.
   *
   * É a mesma convenção que o `fecharPeloCliente` já segue: o negócio está
   * decidido, e falhar o registo sobre ele não o torna por decidir. Sem este
   * `catch`, um `appendOrderHistory` que rebente deixava a negociação
   * desistida na base e fazia o chamador anunciar ao cliente que não tinha
   * dado — sobre uma proposta que já estava morta.
   */
  try {
    await registarAccao(
      alvo.pedidoId,
      alvo.negociacaoId,
      `Cliente recusou a proposta de ${alvo.profissionalNome} por WhatsApp — negociação #${alvo.negociacaoId}.`,
      "negociacao_desistida",
      "assistente",
    );
  } catch (e) {
    console.error("[assistente] recusa gravada, a nota não:", alvo.negociacaoId, e);
  }
  return { ok: true };
}

async function recusarPeloCliente(telefone: string, alvo: Alvo): Promise<void> {
  const { assistentePode } = await import("@/lib/db");
  if (!(await assistentePode("fechar"))) {
    await passarAUmaPessoa(telefone, "Fechar desligado - quis recusar");
    return;
  }
  const r = await recusarUmaNaBase(alvo);
  if (!r.ok) {
    await enviarTextoWhatsApp(telefone, `Não deu para recusar: ${r.erro}`);
    return;
  }
  await enviarTextoWhatsApp(
    telefone,
    `Certo — a proposta de ${alvo.profissionalNome} foi recusada. As outras continuam de pé.`,
  );
}

/**
 * RECUSAR VÁRIAS DE UMA VEZ — 23-09-2026.
 *
 * "recusar 267,00, recusar 300,00, recusar 250,00, recusar 283,42", escrito
 * pelo cliente do pedido #357 às 11:54. Era a resposta que a nossa própria
 * mensagem lhe ensinava a dar, quatro vezes seguidas, e o assistente
 * devolveu-lhe a mesma lista de propostas que lhe tinha mandado um minuto
 * antes. Ver `recusasEmSerie` em `ler-a-resposta.ts`.
 *
 * Uma mensagem só no fim, e a lista de quem ficou recusado. Se alguma falhar
 * na base, diz-se quais correram e quais não — calar metade de uma operação
 * de dinheiro é pior do que não a fazer.
 */
async function recusarVariasPeloCliente(telefone: string, alvos: Alvo[]): Promise<void> {
  const { assistentePode } = await import("@/lib/db");
  if (!(await assistentePode("fechar"))) {
    await passarAUmaPessoa(telefone, "Fechar desligado - quis recusar várias");
    return;
  }
  /*
   * UMA ESCRITA QUE REBENTA NÃO PODE CALAR AS OUTRAS TRÊS.
   *
   * São quatro escritas independentes, sem transacção. Sem este `catch`, uma
   * que rebente a meio — um `lock wait timeout`, uma ligação reposta — deixava
   * duas negociações mortas, duas vivas, e o cliente SEM MENSAGEM NENHUMA: a
   * excepção subia até à rota, que regista e devolve 200. No telemóvel dele
   * continuava a lista das quatro propostas, sem um sinal de que metade já não
   * existia.
   *
   * Os revisores reproduziram-no a correr, e mostraram que isto era PIOR do
   * que o que havia antes: a recusa uma a uma falhava alto, esta falhava em
   * silêncio. Uma operação de dinheiro meio feita tem de dizer qual metade.
   */
  const feitas: string[] = [];
  const falhadas: string[] = [];
  for (const alvo of alvos) {
    try {
      const r = await recusarUmaNaBase(alvo);
      if (r.ok) feitas.push(alvo.profissionalNome);
      else falhadas.push(`${alvo.profissionalNome} (${r.erro})`);
    } catch (e) {
      falhadas.push(`${alvo.profissionalNome} (não deu para gravar)`);
      console.error("[assistente] recusa em série falhou:", alvo.negociacaoId, e);
    }
  }
  if (feitas.length === 0) {
    await enviarTextoWhatsApp(telefone, `Não deu para recusar: ${falhadas.join("; ")}`);
    return;
  }
  await enviarTextoWhatsApp(
    telefone,
    `Certo — recusei ${feitas.length === 1 ? "a proposta" : "as propostas"} de ${feitas.join(", ")}.` +
      (falhadas.length ? `\n\nNão deu para recusar: ${falhadas.join("; ")}` : "") +
      `\n\nSe quiser, peço novos valores a outros parceiros.`,
  );
}

type AlvoComValor = Alvo & {
  /** O valor do profissional — o que está gravado, e o que o motor conhece. */
  valorNaMesa: number | null;
  /**
   * O MESMO, COMO O CLIENTE O VIU — já com a taxa, sem IVA. 29-09-2026.
   *
   * É por este que ele escolhe («fechar 367,50»), e é este que se lhe mostra
   * nas listas. Comparar o que ele escreve com o valor do profissional era
   * comparar duas moedas: «aceito 367,50» não batia em nada e virava uma
   * contraproposta.
   */
  precoNaMesa: number | null;
};

/**
 * As negociações onde um SIM ou um NÃO fazem sentido AGORA: proposta do
 * profissional pendente, ou aceitação à espera de fecho. Cada uma com o
 * valor em cima da mesa — é por ele que se desambigua quando há várias.
 */
/** Já se lê sem modelo nenhum? Então não se gasta uma chamada nem 18 segundos. */
function jaSeLe(texto: string): boolean {
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[!.,…]+$/, "")
    .trim();
  if (/^(sim|fechar|aceito|aceitar|pode fechar|nao|recusar|recuso|nao quero)$/.test(t)) return true;
  // Tudo o que a leitura sem modelo já apanha — «sim serve», «não serve»,
  // «aceito 300», «Revolution 94». Ver `ler-a-resposta.ts`.
  if (jaSeLeSemModelo(texto)) return true;
  // Um valor sozinho, uma data, ou um "sim 300" — tudo o que as expressões
  // regulares de baixo já apanham à letra.
  if (/^(?:sim|fechar|aceito|aceitar|nao|recusar|recuso)?\s*\d{1,4}(?:[.,]\d{1,2})?\s*(?:€|eur|euros)?$/.test(t)) {
    return true;
  }
  if (/^\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\s+\d{1,2}[:h]\d{0,2}$/.test(t)) return true;
  return false;
}

/**
 * O que o cliente escreveu, na forma que as expressões regulares já lêem.
 *
 * Devolve o texto ORIGINAL sempre que não houver uma leitura segura: sem
 * chave, sem propostas na mesa, se o modelo falhar, ou se ele próprio disser
 * que não decidiu nada. O pior caso é, por construção, o comportamento de
 * ontem.
 */
type Traduzido = {
  /** O texto na forma que as expressões regulares de baixo já lêem. */
  texto: string;
  /**
   * O QUE ELE QUIS DIZER, QUANDO SE SOUBE.
   *
   * Devolvia-se só o texto, e quem chamava não tinha como distinguir «não
   * percebi» de «percebi, e não há nada a responder». As duas coisas caíam na
   * mesma linha lá em baixo — o ponto de situação inteiro — e foi assim que
   * um «Ok, obrigada» levou de volta a mesa com os valores que tinham sido
   * ditos meia hora antes.
   */
  accao:
    | "fechar"
    | "recusar"
    | "contrapropor"
    | "marcar"
    | "falar_com_pessoa"
    | "agradecer"
    | "ponto_de_situacao"
    | "nada"
    | null;
  /**
   * A NEGOCIAÇÃO QUE ELE NOMEOU, quando disse um nome e só um bateu certo.
   *
   * Resolvia-se aqui e deitava-se fora, deixando só o valor — e o valor
   * não identifica ninguém quando dois profissionais pedem o mesmo. Quem diz
   * «fico com o do Manuel» está a identificar uma negociação; é essa que
   * segue, e não um número que pode apontar para outra.
   */
  alvo?: AlvoComValor;
};

/** Sem acentos e em minúsculas — «José» e «jose» são a mesma pessoa. */
function semAcentos(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

async function traduzirParaAMaquina(original: string, pedidos: number[]): Promise<Traduzido> {
  const { compreensaoDisponivel, compreenderResposta } = await import("@/lib/whatsapp-compreensao");
  if (!compreensaoDisponivel() || !original || jaSeLe(original)) {
    return { texto: original, accao: null };
  }

  const alvos = await alvosAccionaveis(pedidos);
  // Os preços como ELE os viu — é nessa moeda que ele responde, e é nessa
  // moeda que o modelo devolve o número.
  const lido = await compreenderResposta(
    original,
    alvos.map((a) => ({ profissional: a.profissionalNome, valor: a.precoNaMesa })),
  ).catch(() => null);
  if (!lido) return { texto: original, accao: null };

  /*
   * O NOME TAMBÉM SERVE PARA ESCOLHER — E O NOME É QUE VIAJA, NÃO O VALOR.
   *
   * «Aceito o do Manuel» não traz valor nenhum, e com duas propostas na mesa
   * um «sim» sozinho fecharia a errada. Traduzia-se o nome para o VALOR dele e
   * deitava-se o resto fora: o alvo certo era encontrado aqui e reconstruído
   * lá em baixo a partir do número. Com o Manuel a 300 € num pedido e outro
   * profissional a 300 € noutro, quem dizia o nome do Manuel com todas as
   * letras fechava com o outro. O valor não é chave de nada quando há empates.
   *
   * EXIGE-SE CORRESPONDÊNCIA ÚNICA. Era `includes` no primeiro que casasse:
   * «Fred» casa com «Fred Teste» e com «Fred Silva», e um nome curto devolvido
   * pelo modelo casava com quem calhasse estar primeiro — que é sempre o
   * pedido mais recente. Dois candidatos não são uma escolha; são uma dúvida,
   * e uma dúvida não fecha negócios.
   */
  const casamPeloNome =
    lido.profissional != null && lido.profissional.trim().length >= 3
      ? alvos.filter((a) =>
          semAcentos(a.profissionalNome).includes(semAcentos(lido.profissional as string)),
        )
      : [];
  const porNome = casamPeloNome.length === 1 ? casamPeloNome[0] : undefined;
  const valor = lido.valor ?? porNome?.precoNaMesa ?? null;

  if (lido.accao === "fechar") {
    return { texto: valor != null ? `sim ${valor}` : "sim", accao: "fechar", alvo: porNome };
  }
  if (lido.accao === "recusar") {
    return { texto: valor != null ? `nao ${valor}` : "nao", accao: "recusar", alvo: porNome };
  }
  if (lido.accao === "contrapropor" && lido.valor != null) {
    return { texto: String(lido.valor), accao: "contrapropor" };
  }
  // "marcar" segue com o texto dele — a data tem o seu próprio leitor. O resto
  // não se traduz, mas quem chama passa a saber o que era.
  return { texto: original, accao: lido.accao };
}

async function alvosAccionaveis(pedidos: number[]): Promise<AlvoComValor[]> {
  const lista: AlvoComValor[] = [];
  /*
   * O VALOR ÚNICO (d39, 15-11-2026): num pedido com o valor único por
   * decidir, o cliente não aceita nem recusa propostas — quem escolhe o
   * parceiro é a CLYON. As propostas desses pedidos não são alvos.
   */
  const { pedidosComValorUnicoPorDecidir } = await import("@/lib/valor-unico-no-whatsapp-na-base");
  const comValorUnico = new Set(await pedidosComValorUnicoPorDecidir(pedidos));
  for (const pedidoId of pedidos) {
    if (comValorUnico.has(pedidoId)) continue;
    const linhas = await negociacoesDoPedido(pedidoId);
    const base = await baseDoPedido(pedidoId);
    // d17: o modelo de cada uma, pela regra do servidor (uma consulta por pedido).
    const novas = await nasNovoModelo(linhas);
    for (const n of linhas) {
      const propostas = propostasDe(n.propostasJson);
      const invertidas = [...propostas].reverse();
      const pendenteDoPro = propostas.some(
        (p) => p.estado === "pendente" && p.por === "profissional",
      );
      if (!pendenteDoPro && n.estado !== "aguarda_contratacao") continue;
      const valorNaMesa =
        n.valorAcordado != null
          ? Number(n.valorAcordado)
          : (invertidas.find((p) => p.estado === "pendente" && p.por === "profissional")?.valor ??
            invertidas.find((p) => p.estado === "aceite")?.valor ??
            invertidas[0]?.valor ??
            null);
      const taxas = taxasDaNegociacao(n);
      const modelo = modeloDaNegociacao(n.createdAt);
      const novoModelo = novas.has(Number(n.id));
      lista.push({
        linha: n,
        novoModelo,
        pedidoId,
        negociacaoId: Number(n.id),
        profissionalNome: n.profissionalNome,
        modelo,
        formaDePagamento: lerForma((n as { formaDePagamento?: unknown }).formaDePagamento),
        taxas,
        base,
        estado: {
          estado: n.estado as Negociacao["estado"],
          valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
          propostas,
        },
        valorNaMesa,
        // d17: no modelo de 15-11, o total do regime do parceiro — o que lhe foi dito.
        precoNaMesa:
          valorNaMesa != null
            ? precoDaVitoria(Number(valorNaMesa), taxas, modelo, totalDaVitoria(n, Number(valorNaMesa), novoModelo)).aPagar
            : null,
      });
    }
  }
  return lista;
}

/**
 * O ecrã, mas só se não for a repetição do que já saiu.
 *
 * Todo o caminho que leva ao ponto de situação passa por aqui. É a rede por
 * baixo das separações feitas em `tratarMensagemDoCliente`: se um caminho que
 * ninguém previu levar ao mesmo texto de há uma hora, ele não volta a sair.
 * Ver `nao-repetir.ts`.
 */
async function mandarOEcra(telefone: string, pedidoId: number): Promise<void> {
  const texto = await ecraDoPedido(pedidoId);
  const { saidasDoNumeroWhatsApp } = await import("@/lib/db");
  // So as saidas, e com a idade contada pela base — ver `nao-repetir.ts`.
  const gravadas = await saidasDoNumeroWhatsApp(telefone, 20).catch(() => []);
  /*
   * COMPARA-SE O QUE FICA GRAVADO, E NÃO O QUE SE ESCREVEU.
   *
   * O envio passa por `paraTeclado` antes de registar — troca o travessão por
   * hífen, as aspas curvas por rectas, as reticências por três pontos. O que
   * eu escrevo aqui tem «Pedido #318 — o que já recebeu» e o que fica na base
   * tem «Pedido #318 - o que já recebeu». Comparados assim nunca batiam, e a
   * guarda contra repetir nunca disparava: uma cliente levou o mesmo ecrã às
   * 14:50 e às 14:54.
   */
  if (jaFoiDito(paraTeclado(texto), gravadas, new Date())) {
    await enviarTextoWhatsApp(
      telefone,
      "Está na mesma desde a minha última mensagem. Assim que houver novidades, escrevo-lhe.",
    );
    return;
  }
  await enviarTextoWhatsApp(telefone, texto);
}

/**
 * O QUE SE DIZ A QUEM JA TEM PEDIDO REGISTADO E VOLTA A ESCREVER.
 *
 * Nao e um formulario novo, e nao e o ecra das propostas: um pedido acabado
 * de registar ainda nao foi aos profissionais e nao tem proposta nenhuma para
 * mostrar. E o ponto de situacao honesto — esta registado, esta a ser
 * conferido, as propostas chegam por aqui — e a porta aberta para ele
 * acrescentar o que quiser.
 *
 * ⚠️ E CALA-SE A SEGUNDA VEZ, EM VEZ DE PASSAR A CONVERSA A UMA PESSOA.
 *
 * Passar a conversa chama `interromperNumeroWhatsApp`, e essa marca NAO
 * caduca: so um clique de uma pessoa no backoffice a levanta. Ate la
 * `podeOWhatsAppFalarCom` devolve falso e as propostas dos profissionais
 * nunca lhe chegam — ou seja, para lhe responder mais depressa tirava-se-lhe
 * o pedido. Nao compensa por uma pessoa escrever duas vezes.
 *
 * O silencio aqui nao e abandono: a mensagem dele JA ficou registada pelo
 * webhook e a conversa esta na mesa do painel com a bola do nosso lado
 * (`conversas-de-suporte.ts`). E a regra que `nao-repetir.ts` ja escreve:
 * sem nada de novo a dizer, e melhor nao dizer nada.
 *
 * Quem tem MESMO de ser atendido por uma pessoa — quem diz que ninguem lhe
 * respondeu — e apanhado antes disto, em `estaAPerderAPaciencia`.
 */
async function responderAQuemJaTemPedido(telefone: string, pedidoId: number): Promise<void> {
  const aviso =
    `O seu pedido #${pedidoId} está registado e a equipa da CLYON está a conferi-lo — ` +
    `as propostas dos parceiros chegam-lhe por aqui.

` +
    `Se houver mais alguma coisa a acrescentar, diga-me.`;
  /*
   * `enviarTextoWhatsApp` ja traz esta guarda dentro. Ela esta aqui na mesma
   * porque o que interessa nao e so nao repetir: e nao gravar nada nem
   * arrancar conversa nenhuma quando nao ha novidade — e isso decide-se aqui.
   */
  const { saidasDoNumeroWhatsApp } = await import("@/lib/db");
  const ditas = await saidasDoNumeroWhatsApp(telefone, 20).catch(() => []);
  if (jaFoiDito(paraTeclado(aviso), ditas, new Date())) return;
  await enviarTextoWhatsApp(telefone, aviso);
}

/* ──────────────────────────────────────────────────────────────────────────
 * QUEM JÁ TEM PEDIDO — a Vitória continua-o. 26-10-2026 (decisão d30).
 *
 * As regras (puras) estão em `pedido-aberto-na-conversa.ts`; aqui lê-se a
 * base, escreve-se no pedido e responde-se.
 * ────────────────────────────────────────────────────────────────────────── */

type DadosDaRecolhaAqui = import("@/lib/whatsapp-recolha").DadosDaRecolha;
type PedidoDaBaseAqui = import("@/lib/pedido-aberto-na-conversa").PedidoDaBase;

/** A quem diz que já fez o pedido e ele não aparece pelo número: uma pessoa procura-o. */
const NAO_ENCONTREI_O_PEDIDO =
  "Peço imensa desculpa! Não encontro o seu pedido por este número. Vou passar a conversa a uma pessoa da CLYON, " +
  "que o procura e continua consigo por aqui.";

/**
 * OS PEDIDOS ABERTOS DESTE NÚMERO — os do telefone (`pedidosDoTelefone`, a
 * busca de sempre, pelos últimos 9 dígitos, com e sem o 351) e os de que a
 * CLYON já falou no fio, mesmo que o telefone do pedido seja outro: foi um
 * colega que os ligou a esta conversa. Só os abertos e recentes; os falados no
 * fio primeiro.
 */
async function pedidosAbertosDoNumero(
  telefone: string,
  fio: Array<{ direccao: string; texto: string }>,
): Promise<PedidoDaBaseAqui[]> {
  const { pedidosFaladosNoFio, pedidoParaAVitoria } = await import("@/lib/pedido-aberto-na-conversa");
  const doTelefone = await pedidosDoTelefone(telefone).catch(() => [] as number[]);
  const ids = [...new Set([...pedidosFaladosNoFio(fio), ...doTelefone])].slice(0, 10);
  const lidos = await Promise.all(ids.map((id) => getSimulatorOrderById(id).catch(() => undefined)));
  const agora = new Date();
  return lidos.filter((p): p is NonNullable<typeof p> => pedidoParaAVitoria(p as PedidoDaBaseAqui, agora)) as PedidoDaBaseAqui[];
}

/**
 * O QUE ELE MANDA JUNTA-SE A ESTE PEDIDO — a Vitória continua-o.
 *
 * Devolve `true` quando tratou da mensagem (respondeu, ou calou-se de
 * propósito), e `false` quando não havia nada de novo a dizer: quem chama dá o
 * ponto de situação de sempre (`responderAQuemJaTemPedido`).
 */
async function completarOPedidoAberto(
  telefone: string,
  pedido: PedidoDaBaseAqui,
  texto: string,
  opcoes: {
    imagensNovas?: number;
    visto?: string[];
    guardada?: { passo: string; dados: Record<string, unknown>; pedidoId: number | null } | null;
    fio?: Array<{ direccao: string; texto: string }>;
    /** A primeira resposta sobre este pedido nesta conversa. */
    primeira?: boolean;
    /** Já se lhe disse qual era o pedido — na pergunta «a qual se refere?». */
    jaDisseOPedido?: boolean;
    /** O que se apanhou de uma recolha nova que dá lugar a este pedido. */
    herdados?: DadosDaRecolhaAqui | null;
    /** Quantas das imagens são vídeos — ficam numa nota, e não contam como fotografias (27-10-2026). */
    videos?: number;
    /** A mensagem é a resposta ao envio de modelo do «Pedir o que falta» (d86, 22-11-2026). */
    respostaAoModelo?: boolean;
  } = {},
): Promise<boolean> {
  const db = await import("@/lib/db");
  const pa = await import("@/lib/pedido-aberto-na-conversa");
  const wr = await import("@/lib/whatsapp-recolha");

  const id = Number(pedido.id);
  const guardados = opcoes.guardada?.dados ?? null;
  const emCurso = (guardados as DadosDaRecolhaAqui | null)?.pedidoAberto === id;
  const primeira = opcoes.primeira === true || !emCurso;
  const imagensNovas = opcoes.imagensNovas ?? 0;
  /*
   * Só imagens, numa conversa que não está a completar este pedido: ficaram
   * nele quando entraram, e já levaram o seu «Recebi a fotografia» — ver
   * `guardarFotoDoClienteNoPedido`.
   */
  if (!texto.trim() && !emCurso && opcoes.primeira !== true) return false;

  const fio = opcoes.fio ?? (await db.mensagensDoNumeroWhatsApp(telefone, 20).catch(() => []));
  // As fotografias que chegaram antes de se saber o pedido entram nele já.
  const anexadas = await db.anexarFotosPendentesAoPedido(telefone, id).catch(() => 0);
  const agoraNaBase =
    anexadas > 0 ? ((await getSimulatorOrderById(id).catch(() => undefined)) as PedidoDaBaseAqui | undefined) : undefined;
  const oPedido = agoraNaBase ?? pedido;

  const doPedido = pa.dadosDoPedido(oPedido);
  let dados = pa.dadosDaConversaNoPedido(oPedido, guardados, opcoes.herdados);
  // O nome da conta dele, quando o pedido não o tem — «se já tem cadastro».
  if (!dados.contactName) {
    const conta = await db.contaDoClientePeloTelefone(telefone).catch(() => null);
    if (conta?.nome) dados = { ...dados, contactName: conta.nome };
  }
  const videos = Math.max(0, Math.min(opcoes.videos ?? 0, imagensNovas));
  const recebidas = Math.max(imagensNovas - videos, anexadas);
  if (recebidas > 0) dados = { ...dados, fotosRecebidas: (dados.fotosRecebidas ?? 0) + recebidas };
  // Os vídeos não se descarregam: fica dito no pedido que existem, e onde vê-los (27-10-2026).
  if (videos > 0) {
    const comNota = { ...dados };
    wr.juntarNota(comNota, `Mandou ${videos === 1 ? "um vídeo" : `${videos} vídeos`} pelo WhatsApp — ver na conversa`);
    dados = comNota;
  }

  const agora = new Date();
  const estado = { passo: wr.primeiroPassoEmFalta(dados), dados };
  // Com negócio fechado, não se prometem propostas.
  const contratado = (await negociacoesDoPedido(id).catch(() => [])).some((n) => n.estado === "acordada");
  // O modelo só lê quando há uma pergunta feita à espera de resposta — o resto lê-se pelas regras.
  const { compreender } = await import("@/lib/whatsapp-compreensao");
  const comPergunta = Boolean(texto.trim()) && !primeira && estado.passo !== "confirmar";
  const compreensao = comPergunta
    ? await compreender(texto, dados as Record<string, unknown>, agora, wr.perguntaPendente(estado.passo, dados), fio)
    : null;

  const r = pa.responderNoPedidoAberto(estado, texto, agora, {
    pedido: pa.pedidoNaConversa(oPedido),
    primeira,
    colegaJaFalou: pa.pedidosFaladosNoFio(fio).includes(id),
    jaSeApresentou: wr.jaCumprimentouNesteFio(fio),
    jaDisseOPedido: opcoes.jaDisseOPedido,
    compreensao,
    lista: wr.servicosDaListaNoFio(fio),
    visto: opcoes.visto,
    imagensNovas,
    jaExplicouOPreco: wr.jaExplicouOPreco(fio),
    jaDisseQueNaoCompra: wr.jaDisseQueNaoCompra(fio),
    contratado,
  });

  /*
   * A RESPOSTA AO «PEDIR O QUE FALTA» — 22-11-2026 (decisão d86). Uma queixa,
   * uma desistência, quem pede uma pessoa, outro pedido, outro sítio ou uma
   * 2.ª morada seguem o caminho de sempre, logo abaixo. O resto lê-se parte a
   * parte e grava-se no pedido, e a Vitória responde com o que ficou anotado,
   * o que falta e o passo seguinte. Sem nada que se grave nem pergunta («ok»),
   * segue também o caminho de sempre. Ver `resposta-ao-que-falta.ts`.
   */
  if (
    opcoes.respostaAoModelo &&
    !r.pedirPessoa &&
    !r.novoPedido &&
    !r.trocaDeSitio &&
    !r.trocaPerguntada &&
    !r.segundaMoradaNova
  ) {
    const gravou = await gravarARespostaAoModelo(telefone, oPedido, doPedido, dados, texto, {
      recebidas,
      fio,
      contratado,
      guardada: opcoes.guardada ?? null,
    });
    if (gravou) return true;
  }

  /*
   * «É PARA OUTRO LADO», E DISSE QUE SIM — 16-11-2026 (d51). A recolha nova
   * começa com o nome e o serviço deste pedido, e a terra nova; pergunta-se
   * só o que falta. Este NÃO se cancela: fica com a nota para a equipa o
   * fechar, e quando o novo nascer a nota diz o número dele (`registarARecolha`).
   */
  if (r.novoPedido && r.trocaDeSitio) {
    const { recolhaDoPedidoNovo, notaDaTrocaAMeio } = await import("@/lib/troca-de-sitio");
    const naConversa = pa.pedidoNaConversa(oPedido);
    const sitio = { id, localidade: naConversa.localidade, morada: doPedido.address ?? null };
    const nome = naConversa.nome ?? (dados.contactName ? dados.contactName.split(/\s+/)[0] : null);
    const novo = recolhaDoPedidoNovo(dados, r.trocaDeSitio, sitio, nome);
    await db.recomecarRecolhaWhatsApp(telefone);
    await db.guardarRecolhaWhatsApp(telefone, novo.estado.passo, novo.estado.dados as Record<string, unknown>);
    await anotarATrocaDeSitio(oPedido, notaDaTrocaAMeio(sitio, r.trocaDeSitio.localidade));
    await enviarTextoWhatsApp(telefone, novo.resposta);
    return true;
  }

  // Pediu claramente outra coisa: um pedido novo, com a mensagem dele.
  if (r.novoPedido) {
    await db.recomecarRecolhaWhatsApp(telefone);
    await recolherPedidoPorWhatsApp(telefone, texto, imagensNovas, opcoes.visto ?? [], { semPedidosAbertos: true });
    return true;
  }

  /*
   * O PEDIDO, COM O QUE A CONVERSA TROUXE — só o que lhe faltava, nunca por
   * cima do que lá está. E A DESCRIÇÃO ESCREVE-SE A PARTIR DAS FONTES
   * (29-10-2026): o que ele disse entra nas fontes do pedido, e a descrição
   * sai logo pelas regras (o texto da equipa e UM bloco, nunca dois); depois
   * da resposta, o modelo reescreve-a (`reescreverADescricao`). Era aqui que
   * se juntava um bloco novo por baixo do anterior sempre que este já não
   * estava no fim — ver `descricaoComOBloco`.
   */
  const depois = r.estado.dados;
  const campos = pa.camposParaOPedido(oPedido, depois);
  const novos = { ...pa.oQueEDaConversa(doPedido, depois), fotosRecebidas: depois.fotosRecebidas };
  const nb = await import("@/lib/descricao-do-pedido-na-base");
  let fontesMudaram = false;
  let mudaDescricao = false;
  if (Object.keys(campos).length > 0) {
    try {
      await updateSimulatorOrder(id, campos as unknown as Parameters<typeof updateSimulatorOrder>[1]);
    } catch (e) {
      console.error("[whatsapp/pedido-aberto] não actualizei os campos do pedido:", e);
    }
  }
  try {
    const escrita = await nb.juntarAConversaNaDescricao(id, novos);
    fontesMudaram = escrita?.fontesMudaram === true;
    mudaDescricao = escrita?.mudou === true;
  } catch (e) {
    console.error("[whatsapp/pedido-aberto] não actualizei a descrição:", e);
  }
  if (Object.keys(campos).length > 0 || mudaDescricao) {
    try {
      const nomes: Record<string, string> = {
        contactName: "nome",
        address: "morada",
        city: "localidade",
        postalCode: "código postal",
        floor: "andar",
        hasElevator: "elevador",
        parkingDistance: "estacionamento",
      };
      const oQue = [...Object.keys(campos).map((k) => nomes[k] ?? k), ...(mudaDescricao ? ["descrição"] : [])];
      await appendOrderHistory(id, {
        type: "created",
        by: null,
        message: `A Vitória juntou ao pedido o que o cliente disse no WhatsApp: ${oQue.join(", ")}.`,
      }).catch(() => {});
    } catch (e) {
      console.error("[whatsapp/pedido-aberto] não actualizei o pedido:", e);
    }
  }

  /*
   * A 2.ª MORADA DE RECOLHA (29-10-2026): a equipa fica a saber, no pedido —
   * com a morada inteira, que só ela vê (nas notas do pedido e no histórico;
   * na descrição vai só a localidade). O preço muda: há que rever as propostas.
   */
  if (r.segundaMoradaNova) {
    const { segundaMoradaParaAEquipa } = await import("@/lib/segunda-morada");
    const morada = segundaMoradaParaAEquipa(r.segundaMoradaNova);
    try {
      const notas = (oPedido as { notasInternas?: string | null }).notasInternas?.trim() ?? "";
      const linha = `2.ª morada de recolha (dita pelo cliente no WhatsApp): ${morada}`;
      if (!notas.includes(linha)) {
        await updateSimulatorOrder(id, { notasInternas: notas ? `${notas}\n${linha}` : linha });
      }
    } catch (e) {
      console.error("[whatsapp/pedido-aberto] não anotei a 2.ª morada:", e);
    }
    await appendOrderHistory(id, {
      type: "created",
      by: null,
      message: `O cliente indicou no WhatsApp uma 2.ª morada de recolha: ${morada}. O preço muda — rever o pedido e as propostas.`,
    }).catch(() => {});
  }
  // Perguntou-se «Faço um pedido novo…?» (d51): fica no histórico, para a equipa saber porquê.
  if (r.trocaPerguntada) {
    await appendOrderHistory(id, {
      type: "created",
      by: null,
      message: "O cliente disse no WhatsApp que já não é nesta morada; a Vitória perguntou-lhe se faz um pedido novo.",
    }).catch(() => {});
  }
  // Uma pergunta que ficou anotada para uma pessoa: a equipa vê-a no pedido (29-10-2026).
  if (r.perguntaParaAEquipa) {
    await appendOrderHistory(id, {
      type: "created",
      by: null,
      message: `Pergunta do cliente no WhatsApp, por responder: «${r.perguntaParaAEquipa.replace(/\s+/g, " ").slice(0, 200)}»`,
    }).catch(() => {});
  }

  // O bloco já não se guarda na conversa: a descrição escreve-se das fontes do pedido.
  const aGuardar: DadosDaRecolhaAqui = { ...depois, pedidoAberto: id, blocoNoPedido: undefined };
  await db.guardarRecolhaWhatsApp(telefone, r.estado.passo, aGuardar as Record<string, unknown>).catch(() => {});
  if (opcoes.guardada?.pedidoId !== id) await db.ligarRecolhaWhatsAppAoPedido(telefone, id).catch(() => {});

  // Depois de responder ao cliente, o modelo reescreve a descrição a partir das fontes.
  const reescrever = () => (fontesMudaram ? nb.depoisDaResposta(() => nb.reescreverADescricao(id)) : Promise.resolve());

  if (r.pedirPessoa) {
    // Falar primeiro: o portão engole o que sair depois de interromper.
    await enviarTextoWhatsApp(telefone, r.resposta);
    await db.interromperNumeroWhatsApp(telefone, r.motivoDaEntrega ?? "Pediu para falar com uma pessoa");
    await reescrever();
    return true;
  }
  if (r.semNovidade && !r.resposta) {
    await reescrever();
    return false;
  }
  /*
   * O PEDIDO À ESPERA DO «PEDIR O QUE FALTA» QUE FICOU COMPLETO — d86
   * (22-11-2026): a fotografia que faltava chegou depois. Sai de «precisa
   * info» e volta aos «por enviar», e diz-se o passo seguinte.
   */
  let resposta = r.resposta;
  if (resposta && String((oPedido as { status?: string | null }).status ?? "") === "precisa_info") {
    const { oPedidoFicouCompleto } = await import("@/lib/resposta-ao-que-falta-na-base");
    const fim = await oPedidoFicouCompleto(id).catch(() => null);
    if (fim?.saiu) {
      /*
       * E SEGUE SOZINHO PARA OS PARCEIROS — d87 (22-11-2026): pela mesma
       * função da Mesa, com todas as condições; a frase diz a verdade sobre o
       * que aconteceu (já seguiu, ou a equipa confere-o e segue).
       */
      const { PEDIDO_FICA_COMPLETO, PEDIDO_JA_SEGUIU } = await import("@/lib/resposta-ao-que-falta");
      const { seguirSozinhoParaOsParceiros } = await import("@/lib/envio-automatico-aos-parceiros-na-base");
      const envio = await seguirSozinhoParaOsParceiros(id, { origem: "pedir_o_que_falta" }).catch(() => null);
      resposta = `${resposta}\n${envio?.estado === "enviado" ? PEDIDO_JA_SEGUIU : PEDIDO_FICA_COMPLETO}`;
    }
  }
  if (resposta) await enviarTextoWhatsApp(telefone, resposta);
  await reescrever();
  return true;
}

/**
 * A RESPOSTA AO «PEDIR O QUE FALTA», GRAVADA NO PEDIDO — 22-11-2026 (decisão
 * d86). A leitura, a gravação, o «precisa info» e o envio automático são de
 * `gravarARespostaAoQueFalta` (a mesma função serve a conta do site e a app,
 * d3, 23-11-2026); aqui fica o que é da conversa: guardá-la ligada ao pedido e
 * UMA mensagem da Vitória. Devolve `false` quando não havia nada a gravar nem
 * pergunta a responder: quem chama segue o caminho de sempre.
 */
async function gravarARespostaAoModelo(
  telefone: string,
  oPedido: PedidoDaBaseAqui,
  doPedido: DadosDaRecolhaAqui,
  dados: DadosDaRecolhaAqui,
  texto: string,
  x: {
    recebidas: number;
    fio: Array<{ direccao: string; texto: string }>;
    contratado: boolean;
    guardada: { passo: string; dados: Record<string, unknown>; pedidoId: number | null } | null;
  },
): Promise<boolean> {
  const db = await import("@/lib/db");
  const wr = await import("@/lib/whatsapp-recolha");
  const rq = await import("@/lib/resposta-ao-que-falta");
  const nb = await import("@/lib/descricao-do-pedido-na-base");
  const { gravarARespostaAoQueFalta } = await import("@/lib/gravar-a-resposta-ao-que-falta");
  const id = Number(oPedido.id);

  const g = await gravarARespostaAoQueFalta({
    canal: "whatsapp",
    pedido: oPedido,
    doPedido,
    dados,
    texto,
    imagens: x.recebidas,
    contratado: x.contratado,
    apresentar: !rq.aVitoriaJaSeApresentou(x.fio),
  });
  if (!g) return false;

  // A conversa fica ligada a este pedido: o que vier a seguir (a fotografia que falta) junta-se a ele.
  const aGuardar: DadosDaRecolhaAqui = { ...g.depois, pedidoAberto: id, blocoNoPedido: undefined };
  await db.guardarRecolhaWhatsApp(telefone, wr.primeiroPassoEmFalta(g.depois), aGuardar as Record<string, unknown>).catch(() => {});
  if (x.guardada?.pedidoId !== id) await db.ligarRecolhaWhatsAppAoPedido(telefone, id).catch(() => {});

  await enviarTextoWhatsApp(telefone, g.resposta);
  if (g.fontesMudaram) await nb.depoisDaResposta(() => nb.reescreverADescricao(id));
  console.info(`[whatsapp] …${telefone.slice(-3)}: resposta ao «Pedir o que falta» do pedido #${id} gravada (d86)`);
  return true;
}

/**
 * A RESPOSTA AO ENVIO DE MODELO — 22-11-2026 (decisão d86). A última mensagem
 * que saiu para este número é o «Pedir o que falta» (ou um lembrete do que
 * falta, d71) de um pedido DELE, aberto, e ele respondeu: a resposta é da
 * Vitória, que a grava no pedido (`completarOPedidoAberto` com
 * `respostaAoModelo`). Devolve `false` quando não é o caso.
 */
async function responderAoEnvioDeModelo(
  telefone: string,
  texto: string,
  imagens: number,
  visto: string[],
  videos: number | undefined,
): Promise<boolean> {
  const db = await import("@/lib/db");
  const { respostaAoEnvioDeModelo } = await import("@/lib/resposta-ao-que-falta");
  const fio = await db.mensagensDoNumeroWhatsApp(telefone, 40).catch(() => []);
  const alvo = respostaAoEnvioDeModelo(fio);
  if (!alvo) return false;
  // Só um pedido deste número: o número escrito numa mensagem não abre o pedido de outro.
  if (!(await pedidosDoTelefone(telefone)).includes(alvo.pedidoId)) return false;
  const pedido = (await getSimulatorOrderById(alvo.pedidoId).catch(() => undefined)) as PedidoDaBaseAqui | undefined;
  const { pedidoParaAVitoria } = await import("@/lib/pedido-aberto-na-conversa");
  if (!pedido || !pedidoParaAVitoria(pedido)) return false;
  const guardada = await db.recolhaWhatsApp(telefone).catch(() => null);
  return completarOPedidoAberto(telefone, pedido, texto, {
    imagensNovas: imagens,
    visto,
    fio,
    primeira: true,
    guardada: guardada && (guardada.dados as DadosDaRecolhaAqui).pedidoAberto === alvo.pedidoId ? guardada : null,
    videos,
    respostaAoModelo: true,
  });
}

/**
 * A NOTA DA TROCA DE SÍTIO NO PEDIDO ANTIGO — 16-11-2026 (d51). Na nota da
 * Mesa (`notasInternas`, o papel âmbar colado no cartão) e no histórico: a
 * equipa vê-a e fecha o pedido. Só escreve a nota — o estado fica como está.
 * `substitui` é o começo da nota de antes (a de «a meio»), que dá lugar à final.
 */
async function anotarATrocaDeSitio(pedido: PedidoDaBaseAqui | number, linha: string, substitui?: string): Promise<void> {
  try {
    const id = typeof pedido === "number" ? pedido : Number(pedido.id);
    const lido =
      typeof pedido === "number"
        ? ((await getSimulatorOrderById(id).catch(() => undefined)) as PedidoDaBaseAqui | undefined)
        : pedido;
    const antes = ((lido as { notasInternas?: string | null } | undefined)?.notasInternas ?? "").trim();
    const semAVelha = substitui ? antes.split("\n").filter((l) => !l.trim().startsWith(substitui)).join("\n").trim() : antes;
    if (!semAVelha.includes(linha)) {
      await updateSimulatorOrder(id, { notasInternas: semAVelha ? `${semAVelha}\n${linha}` : linha });
    }
    await appendOrderHistory(id, { type: "created", by: null, message: linha }).catch(() => {});
  } catch (e) {
    console.error("[whatsapp/troca-de-sitio] não anotei o pedido antigo:", e);
  }
}

/**
 * ANTES DE COMEÇAR DO ZERO: o pedido aberto dele. Devolve `true` quando a
 * conversa seguiu por aqui — o pedido dele, a pergunta «a qual se refere?»,
 * ou uma pessoa a procurá-lo —, e `false` para a recolha nova de sempre.
 */
async function continuarNumPedidoAberto(
  telefone: string,
  texto: string,
  imagensNovas: number,
  visto: string[],
  fio: Array<{ direccao: string; texto: string }>,
  aMeio: DadosDaRecolhaAqui | null,
): Promise<boolean> {
  const pa = await import("@/lib/pedido-aberto-na-conversa");
  const { jaFezOPedido } = await import("@/lib/leitor-da-recolha");
  // O pedido de que ele trocou (d51) já não é «o pedido dele» — está à espera de a equipa o fechar.
  const trocado = aMeio?.trocouDoPedido ?? null;
  const abertos = (await pedidosAbertosDoNumero(telefone, fio)).filter((p) => Number(p.id) !== trocado);
  if (abertos.length === 0) {
    // Diz que já fez o pedido, e ele não aparece: uma pessoa procura-o — não se recomeça.
    if (texto.trim() && jaFezOPedido(texto)) {
      await passarAUmaPessoa(telefone, "Diz que já fez o pedido — não o encontrei pelo número", NAO_ENCONTREI_O_PEDIDO);
      return true;
    }
    return false;
  }

  const ids = abertos.map((p) => Number(p.id));
  const dito = pa.pedidoDitoNoTexto(texto, ids);
  const falado = pa.pedidosFaladosNoFio(fio).find((n) => ids.includes(n)) ?? null;
  const escolhido =
    abertos.find((p) => Number(p.id) === dito) ??
    abertos.find((p) => Number(p.id) === falado) ??
    (abertos.length === 1 ? abertos[0] : undefined);

  if (texto.trim() && pa.querOutroPedido(texto, (escolhido ?? abertos[0]).serviceType)) return false;

  const db = await import("@/lib/db");
  // A recolha nova que ia a meio dá lugar ao pedido — o que ele já disse passa para lá.
  if (aMeio) await db.recomecarRecolhaWhatsApp(telefone);

  if (!escolhido) {
    const { jaCumprimentouNesteFio } = await import("@/lib/whatsapp-recolha");
    const resumos = abertos.slice(0, 5).map(pa.pedidoNaConversa);
    const conta = await db.contaDoClientePeloTelefone(telefone).catch(() => null);
    const nomeCompleto = abertos.map((p) => (p.contactName ?? "").trim()).find((n) => n && !/^cliente\s+whatsapp$/i.test(n));
    const nome = resumos.find((p) => p.nome)?.nome ?? (conta?.nome ? conta.nome.split(/\s+/)[0] : null);
    const contactName = aMeio?.contactName ?? nomeCompleto ?? conta?.nome ?? undefined;
    await db.guardarRecolhaWhatsApp(telefone, "servico", {
      pedidosAEscolher: resumos.map((p) => p.id),
      ...(contactName ? { contactName } : {}),
    });
    await enviarTextoWhatsApp(telefone, pa.perguntaQualPedido(resumos, nome, jaCumprimentouNesteFio(fio)));
    return true;
  }

  const tratou = await completarOPedidoAberto(telefone, escolhido, texto, {
    imagensNovas,
    visto,
    fio,
    primeira: true,
    herdados: aMeio,
  });
  if (!tratou) await responderAQuemJaTemPedido(telefone, Number(escolhido.id));
  return true;
}

/**
 * A RESPOSTA A «A QUAL DOS PEDIDOS SE REFERE?» — pelo número, pela ordem, pelo
 * serviço ou pela localidade. À segunda vez sem se perceber, uma pessoa.
 */
async function escolherEntreOsPedidos(
  telefone: string,
  dados: DadosDaRecolhaAqui,
  texto: string,
  imagensNovas: number,
  visto: string[],
  fio: Array<{ direccao: string; texto: string }>,
): Promise<boolean> {
  const pa = await import("@/lib/pedido-aberto-na-conversa");
  const db = await import("@/lib/db");
  const ids = (dados.pedidosAEscolher ?? []).map(Number);
  const lidos = await Promise.all(ids.map((id) => getSimulatorOrderById(id).catch(() => undefined)));
  const abertos = lidos.filter((p) => pa.pedidoParaAVitoria(p as PedidoDaBaseAqui | undefined)) as PedidoDaBaseAqui[];
  if (abertos.length === 0) {
    await db.recomecarRecolhaWhatsApp(telefone);
    return false;
  }
  const resumos = abertos.map(pa.pedidoNaConversa);
  // Só imagens: ficam à espera da escolha, e pergunta-se outra vez, curto.
  if (!texto.trim()) {
    await enviarTextoWhatsApp(telefone, pa.perguntaQualPedidoDasImagens(resumos));
    return true;
  }
  const escolha = abertos.length === 1 ? Number(abertos[0].id) : pa.escolherOPedido(texto, resumos);
  if (escolha === "novo") {
    await db.recomecarRecolhaWhatsApp(telefone);
    await recolherPedidoPorWhatsApp(telefone, texto, imagensNovas, visto, { semPedidosAbertos: true });
    return true;
  }
  if (escolha == null) {
    const vezes = (dados.tentativas?.servico ?? 0) + 1;
    if (vezes >= 2) {
      await passarAUmaPessoa(
        telefone,
        `Tem os pedidos ${ids.map((n) => `#${n}`).join(", ")} e não se percebeu a qual se refere`,
        "Peço desculpa! Vou passar a conversa a uma pessoa da CLYON, que vê consigo qual dos pedidos é.",
      );
      return true;
    }
    await db.guardarRecolhaWhatsApp(telefone, "servico", { ...dados, tentativas: { ...dados.tentativas, servico: vezes } } as Record<string, unknown>);
    await enviarTextoWhatsApp(telefone, pa.perguntaQualPedidoOutraVez(resumos));
    return true;
  }
  const escolhido = abertos.find((p) => Number(p.id) === escolha)!;
  await db.recomecarRecolhaWhatsApp(telefone);
  const tratou = await completarOPedidoAberto(telefone, escolhido, texto, {
    imagensNovas,
    visto,
    fio,
    primeira: true,
    jaDisseOPedido: true,
  });
  if (!tratou) await responderAQuemJaTemPedido(telefone, Number(escolhido.id));
  return true;
}

/**
 * A CONVERSA ESTÁ PRESA À RECOLHA — e a negociação não lhe pode passar à
 * frente. 26-10-2026 (decisão d30).
 *
 * Quem já tem pedido passava primeiro pela negociação, que lê «sim», um número
 * ou uma data à sua maneira: o «Sim» a «Há elevador no prédio?» virava o ponto
 * de situação, e o «812» a «A qual se refere?» uma contraproposta de 812 €. Uma
 * conversa a meio — a escolher o pedido, a completar um pedido que já existe,
 * ou a fazer um novo — vai direita à recolha. Com propostas à espera dele não:
 * aí um «sim» fecha um negócio, e a negociação vem primeiro.
 */
async function conversaPresaARecolha(telefone: string, pedidos: number[], soImagens: boolean): Promise<boolean> {
  const { recolhaWhatsApp } = await import("@/lib/db");
  const g = await recolhaWhatsApp(telefone).catch(() => null);
  if (!g) return false;
  // O rascunho vale 7 dias (d93).
  const { rascunhoAindaVale } = await import("@/lib/conversa-parada-a-meio");
  if (!rascunhoAindaVale(g.actualizadoEm)) return false;
  const d = g.dados as DadosDaRecolhaAqui;
  const presa =
    g.pedidoId == null
      ? (Array.isArray(d.pedidosAEscolher) && d.pedidosAEscolher.length > 0) || (!soImagens && g.passo !== "servico")
      : d.pedidoAberto === g.pedidoId && (soImagens || g.passo !== "confirmar");
  if (!presa) return false;
  return (await alvosAccionaveis(pedidos)).length === 0;
}

/** O "ecrã" — o estado das negociações dele, reescrito em texto. */
export async function ecraDoPedido(pedidoId: number): Promise<string> {
  const pedido = await getSimulatorOrderById(pedidoId);
  /*
   * FORA DA ZONA — d128 (25-11-2026): a equipa está a confirmar a morada; a
   * Vitória di-lo com delicadeza, sem prometer parceiros, preços nem datas.
   */
  {
    const { foraDaZonaDoPedido } = await import("@/lib/fora-da-zona-na-base");
    if (await foraDaZonaDoPedido(pedido)) {
      const { respostaDaVitoriaForaDaZona } = await import("@/lib/fora-da-zona");
      return respostaDaVitoriaForaDaZona(pedidoId);
    }
  }
  const linhas = await negociacoesDoPedido(pedidoId);
  const vivas = linhas.filter((n) => n.estado !== "morta" && n.estado !== "desistida");
  if (vivas.length === 0) {
    const espera = `Pedido #${pedidoId}: ainda à espera de propostas dos parceiros. Avisamos assim que chegarem.`;
    const aviso = avisoDasRetiradas(linhas, await nasNovoModelo(linhas));
    return aviso ? `${aviso}\n\n${espera}` : espera;
  }
  const base = lerBase(pedido?.baseDoPreco);
  const acordada = vivas.find((n) => n.estado === "acordada");
  /*
   * O TRABALHO CLYON DIZ O PREÇO DELE — 25-11-2026 (d120, o #558). Contava-se
   * como uma negociação (o valor do parceiro e as taxas dele), e a Vitória lia
   * um número que não era o da conta nem o da mensagem: dizia ao cliente que
   * «não bate certo». O preço ao cliente é o do Trabalho CLYON
   * (`precoDaPropostaClyon`), sem fatura sem IVA.
   */
  const valorFixo = Number((pedido as { valorFixoClyon?: unknown } | undefined)?.valorFixoClyon);
  if (pedido && Number.isFinite(valorFixo) && valorFixo > 0) {
    const { precoDaPropostaClyon } = await import("@/lib/proposta-clyon-ao-cliente");
    const { linhaDoTrabalhoClyonNaConversa } = await import("@/lib/trabalho-clyon-na-conversa");
    const p = pedido as { taxaClyon?: unknown; precoClienteClyon?: unknown };
    const preco = precoDaPropostaClyon({
      valorFixo,
      taxa: p.taxaClyon == null ? null : Number(p.taxaClyon),
      precoAoCliente: p.precoClienteClyon == null ? null : Number(p.precoClienteClyon),
    });
    if (preco) {
      const semFactura = Number((acordada as { semFactura?: unknown } | undefined)?.semFactura ?? 0) === 1;
      const linhaDoClyon = linhaDoTrabalhoClyonNaConversa({
        pedidoId,
        parceiro: acordada?.profissionalNome ?? null,
        preco: { semIva: preco.semIva, total: preco.total },
        semFactura,
        unidade: unidadeDaBase(base),
      });
      /*
       * d122 (25-11-2026), o dono: «Ao parceiro». Contratado no modelo de 15-11,
       * o «a quem pago?» é o mesmo da confirmação e da adjudicação: ao parceiro,
       * pelos meios dele, com a fatura dele (`pagaAoContratado`).
       */
      if (acordada && (await noNovoModelo(acordada))) {
        return `${linhaDoClyon} ${quemPassaAFatura(acordada)} ${pagaAoContratado(await dadosPorConfirmarDe(Number(acordada.id)))}`;
      }
      return linhaDoClyon;
    }
  }
  if (acordada) {
    const acordado = Number(acordada.valorAcordado ?? 0);
    // `acordada` é a linha crua da base, não um `Alvo`: as taxas e a forma
    // lêem-se daqui, das colunas gravadas.
    const taxasDela = taxasDaNegociacao(acordada);
    const formaDela = lerForma((acordada as { formaDePagamento?: unknown }).formaDePagamento);
    // No modelo dela: com IVA incluído desde o corte de 01-10-2026.
    const modeloDela = modeloDaNegociacao(acordada.createdAt);
    // d10: no modelo de 15-11 paga-se ao parceiro, como escolher no pedido.
    const novoDela = await noNovoModelo(acordada);
    // d17: e o total é o do pedido e do email (`totalAoClienteDaNegociacao`).
    const totalDela = totalDaVitoria(acordada, acordado, novoDela);
    const conta = precoDaVitoria(acordado, taxasDela, modeloDela, totalDela);
    // Um número só, o dele — ver `preco-do-cliente.ts`. Em dinheiro, o
    // preço e a quem o entrega.
    const comoPaga =
      formaDela === "dinheiro" && !novoDela
        ? ` por ${precoComBase(euros(conta.aPagar), base)}. ` +
          `${totalEmPalavras(acordado, modeloDela, taxasDela, "dinheiro", base)}`
        : ` ${precoComBase(euros(conta.aPagar), base)} a pagar, ${
            totalDela
              ? `IVA incluído (${deQueEFeitoOTotal(totalDela)})`
              : conta.ivaIncluido
                ? `IVA incluído (${desdobramentoDoIva(conta)})`
                : "sem IVA"
          }.` +
          (totalDela ? ` ${quemPassaAFatura(acordada)}` : "") +
          (novoDela ? ` ${pagaAoContratado(await dadosPorConfirmarDe(Number(acordada.id)))}` : "");
    return (
      `Pedido #${pedidoId}: fechado com ${acordada.profissionalNome} —${comoPaga}` +
      comNotaDaCarga(base) +
      (pedido?.dataAgendada
        ? ""
        : ` Se já tem data pensada, responda por exemplo: 27/08 14:30`)
    );
  }
  /*
   * A REGRA DE QUEM O CLIENTE VÊ É A DE `negociacao.ts`, E NÃO UMA SEGUNDA.
   *
   * Há três ecrãs a mostrar esta mesma lista — o link do email, a conta e este
   * WhatsApp. Escrever aqui «tem valor, logo mostra-se» daria uma quarta
   * redacção da mesma regra, e a primeira a divergir é sempre aquela para onde
   * ninguém está a olhar. Um caso concreto em que divergiria: uma negociação
   * onde só o CLIENTE propôs tem valor e não é proposta nenhuma — o nome do
   * profissional apareceria como se ele tivesse respondido.
   */
  const propostas: LinhaDaMesa[] = [];
  let aVer = 0;
  // d17: o modelo de cada uma, para o preço dito ser o do pedido.
  const novas = await nasNovoModelo(linhas);
  for (const n of vivas) {
    const lista = propostasDe(n.propostasJson);
    if (!oClienteVeEsta({ estado: String(n.estado), propostas: lista })) {
      aVer += 1;
      continue;
    }
    const ultima = lista.at(-1);
    const valor = n.valorAcordado ?? ultima?.valor ?? null;
    if (valor == null) {
      aVer += 1;
      continue;
    }
    propostas.push({
      profissionalNome: n.profissionalNome,
      // O preço dele, já com a taxa — o mesmo que a proposta lhe disse.
      valor: precoDaVitoria(
        Number(valor),
        taxasDaNegociacao(n),
        modeloDaNegociacao(n.createdAt),
        totalDaVitoria(n, Number(valor), novas.has(Number(n.id))),
      ).aPagar,
      aSuaEspera: ultima?.por === "profissional" && ultima.estado === "pendente",
    });
  }
  /*
   * ⚠️ O QUE LHE DISSEMOS E JÁ NÃO ESTÁ DE PÉ — diz-se, em vez de o calar.
   *
   * Às 20:30 a Zulmira recebeu «Nova Recolha propõe 288,00 €». Às 20:33
   * respondeu, e às 20:34 o assistente disse-lhe «Pedido #384: ainda sem
   * valores» — o profissional tinha retirado a proposta entretanto, e esta
   * lista só olhava para as negociações vivas. Para ela, o assistente
   * contradisse-se em quatro minutos sem explicação (29-09-2026).
   *
   * Uma proposta DO PROFISSIONAL numa negociação que terminou sem acordo é
   * uma proposta que ele viu e que já não existe. Não se sabe aqui quem a
   * fechou — pode ter sido ele próprio a recusá-la —, e por isso a frase não
   * acusa ninguém: diz só que já não está disponível, que é verdade nos dois
   * casos.
   */
  const mesa = textoDaMesa(pedidoId, propostas, aVer, base);
  const aviso = avisoDasRetiradas(linhas, novas);
  return aviso ? `${aviso}\n\n${mesa}` : mesa;
}

/** As propostas que o cliente viu e que já não estão de pé — ver `ecraDoPedido`. */
function avisoDasRetiradas(
  linhas: Array<
    LinhaDaVitoria & {
    id: number | string;
    estado: string;
    profissionalNome: string;
    propostasJson: string | null;
    taxaCliente?: string | number | null;
    taxaProfissional?: string | number | null;
    /** Quando abriu — o modelo do preço (IVA incluído desde 01-10-2026). */
    createdAt?: Date | string | null;
  }>,
  /** d17: as que seguem o modelo de 15-11 — o preço com que o cliente as viu. */
  novas: ReadonlySet<number> = new Set(),
): string | null {
  const retiradas = linhas
    .filter((n) => n.estado === "desistida" || n.estado === "morta")
    .map((n) => ({ n, ultima: propostasDe(n.propostasJson).at(-1) }))
    .filter(({ ultima }) => ultima?.por === "profissional" && Number.isFinite(Number(ultima.valor)))
    .slice(0, 3)
    // Com o preço que ele viu, para ele reconhecer de qual se fala.
    .map(
      ({ n, ultima }) =>
        `${n.profissionalNome} (${euros(
          precoDaVitoria(
            Number(ultima!.valor),
            taxasDaNegociacao(n),
            modeloDaNegociacao(n.createdAt),
            totalDaVitoria(n, Number(ultima!.valor), novas.has(Number(n.id))),
          ).aPagar,
        )})`,
    );
  if (retiradas.length === 0) return null;
  return retiradas.length === 1
    ? `A proposta de ${retiradas[0]} já não está disponível.`
    : `As propostas de ${retiradas.join(" e ")} já não estão disponíveis.`;
}

/**
 * Trata UMA mensagem do cliente. Devolve sempre — as respostas seguem por
 * WhatsApp; quem chama só precisa de saber que foi tratada.
 */
export async function tratarMensagemDoCliente(
  telefone: string,
  conteudo:
    | { tipo: "botao"; id: string }
    | {
        tipo: "texto";
        texto: string;
        /** Fotografias e vídeos desta rajada — ver `imagensDaRajada` (20-10-2026). */
        imagens?: number;
        /** O que se viu nas fotografias desta rajada — ver `oQueSeViuNaRajada` (21-10-2026). */
        visto?: string[];
        /** Quantas das imagens são vídeos — vão para a nota do pedido (27-10-2026). */
        videos?: number;
      },
): Promise<void> {
  /* O preço público das mudanças (11-11-2026): lido antes de responder, para a Vitória dizer o «desde» dos parceiros (ou a referência). */
  await import("./ler-preco-publico-das-mudancas").then((m) => m.precoPublicoDasMudancas()).catch(() => undefined);
  // O painel manda primeiro: desligado, bloqueado ou entregue a uma pessoa,
  // o cérebro não diz UMA palavra — nem sequer a de "não o conheço".
  const { podeOWhatsAppFalarCom } = await import("@/lib/db");
  if (!(await podeOWhatsAppFalarCom(telefone))) {
    /*
     * d111 (24-11-2026): a conversa que a VITÓRIA entregou à equipa no
     * seguimento, sem uma pessoa ter escrito depois, e o cliente escolhe uma
     * proposta do pedido («Gostaria de escolher a proposta da X»): a Vitória
     * retoma-a e aceita. Pela ponte, a mesma porta está na rota (o número
     * entregue nem chega aqui).
     */
    if (conteudo.tipo === "texto" && conteudo.texto.trim()) {
      const { escolhaNumaConversaEntregue } = await import("@/lib/a-escolha-e-a-desistencia-no-whatsapp");
      await escolhaNumaConversaEntregue(telefone, conteudo.texto).catch((err) =>
        console.error("[whatsapp] a escolha depois do seguimento falhou:", err instanceof Error ? err.message : err),
      );
    }
    return;
  }

  /*
   * AS LIÇÕES APROVADAS PELA EQUIPA — 27-10-2026 (decisão d11). Lidas da base
   * com cache de um minuto: aprovar uma lição no backoffice muda a resposta
   * da conversa seguinte, sem deploy. Ver `licoes-da-vitoria.ts`.
   */
  await (await import("@/lib/licoes-da-vitoria-na-base")).refrescarLicoes();

  /*
   * SÓ IMAGENS, SEM UMA PALAVRA — 20-10-2026.
   *
   * Até hoje não chegavam aqui. Agora chegam, para a Vitória agradecer e
   * seguir com a recolha de quem ainda não tem pedido (a Benedita mandou duas
   * fotografias e ficou sem resposta). Os outros caminhos — o aviso de data,
   * o trabalho CLYON, o profissional, a negociação — leem palavras, e com
   * nenhuma não têm nada a dizer: calam-se, como antes (`soImagens` em cada
   * um). As fotografias de um pedido já levaram o seu «Recebi a fotografia»
   * quando entraram.
   */
  /*
   * O código de origem que o site junta à mensagem — «(A1)», ver
   * codigo-de-origem.ts (22-10-2026). Fica na conversa guardada; a Vitória lê
   * sem ele, para não o tomar por um andar ou uma quantidade.
   */
  if (conteudo.tipo === "texto") {
    const { separarCodigoDeOrigem } = await import("@/lib/codigo-de-origem");
    conteudo = { ...conteudo, texto: separarCodigoDeOrigem(conteudo.texto).texto };
  }
  if (conteudo.tipo === "texto" && !conteudo.texto.trim() && (conteudo.imagens ?? 0) === 0) return;
  const soImagens = conteudo.tipo === "texto" && !conteudo.texto.trim();

  /*
   * NÃO PISAR A EQUIPA — 21-11-2026 (decisão d73, o caso C). Uma pessoa da
   * equipa escreveu nesta conversa nas últimas 12 horas — à mão no telemóvel
   * («[à mão]» no fio), pelo backoffice ou com o «Já respondi» — e ninguém a
   * devolveu ao site depois disso: a Vitória não responde sozinha. A mensagem
   * já ficou registada (a ponte grava-a antes de chegar aqui) e aparece na
   * Mesa das conversas por responder. Só a rua pedida depois do aceite entra
   * no pedido, em silêncio, como num número entregue. Os botões (o cliente a
   * carregar em «Fechar») seguem: são uma ordem dele, não uma conversa.
   */
  if (conteudo.tipo === "texto") {
    const { aEquipaFalouHaPouco } = await import("@/lib/pedido-em-curso");
    const { aEquipaNaConversa } = await import("@/lib/pedido-em-curso-na-base");
    const { mensagensDoNumeroWhatsApp } = await import("@/lib/db");
    const fioDaEquipa = await mensagensDoNumeroWhatsApp(telefone, 40).catch(() => []);
    const daEquipa = await aEquipaNaConversa(telefone).catch(() => ({ respondidaHaSegundos: null, devolvidaHaSegundos: null }));
    if (aEquipaFalouHaPouco(fioDaEquipa, daEquipa)) {
      if (!soImagens) {
        const { lerARespostaDaRua } = await import("@/lib/rua-depois-do-aceite-na-base");
        await lerARespostaDaRua(telefone, conteudo.texto).catch(() => null);
      }
      console.info(`[whatsapp] …${telefone.slice(-3)}: a equipa respondeu há pouco — a Vitória não responde (d73)`);
      return;
    }
  }

  /*
   * OS PEDIDOS EM CURSO DO NÚMERO — 21-11-2026 (decisão d73). Os abertos e os
   * fechados há pouco (30 dias), com as negociações, o valor final e o
   * pagamento: lidos uma vez, quando é preciso, antes de tratar a mensagem
   * como um pedido novo. Ver `pedido-em-curso.ts`.
   */
  let lidosEmCurso: import("@/lib/pedido-em-curso").PedidoEmCurso[] | null = null;
  const emCurso = async (): Promise<import("@/lib/pedido-em-curso").PedidoEmCurso[]> => {
    if (lidosEmCurso == null) {
      const { pedidosEmCursoDoTelefone } = await import("@/lib/pedido-em-curso-na-base");
      lidosEmCurso = await pedidosEmCursoDoTelefone(telefone).catch((err) => {
        console.error("[whatsapp] os pedidos em curso não se leram:", err instanceof Error ? err.message : err);
        return [];
      });
    }
    return lidosEmCurso ?? [];
  };

  /*
   * A RUA QUE A VITÓRIA PEDIU DEPOIS DO ACEITE — 17-11-2026 (d69). Se este
   * número tem um pedido com a rua pedida e por receber, e a mensagem é uma
   * morada, entra no pedido (o parceiro vê-a pelo campo de morada) e
   * agradece-se. O resto da conversa segue como sempre.
   */
  if (conteudo.tipo === "texto" && !soImagens) {
    const { lerARespostaDaRua } = await import("@/lib/rua-depois-do-aceite-na-base");
    const daRua = await lerARespostaDaRua(telefone, conteudo.texto);
    if (daRua) {
      await enviarTextoWhatsApp(telefone, daRua.agradecimento);
      return;
    }
  }

  /*
   * A RESPOSTA AO PORQUÊ, DEPOIS DE CANCELAR — 25-11-2026 (decisão d126). Ele
   * cancelou pela conversa e ouviu uma pergunta: porquê (1 o valor, 2 a data,
   * 3 já resolveu, 4 outro). A resposta grava-se nos pedidos; o valor e a data
   * passam a uma pessoa (um parceiro pode voltar a ver), o resto ouve um
   * obrigado — e acabou: sem seguimentos (o «não contactar» manda). Antes de
   * tudo o resto, que lia «o valor» como uma reclamação e «3» como outra coisa.
   */
  if (conteudo.tipo === "texto" && !soImagens) {
    const pc = await import("@/lib/porque-cancelou");
    const { lerARespostaAoPorque } = await import("@/lib/porque-cancelou-na-base");
    const { eSoUmObrigado } = await import("@/lib/aviso-de-data-ao-cliente");
    const { servicoPorPalavras } = await import("@/lib/whatsapp-recolha");
    const resposta = await lerARespostaAoPorque(telefone, conteudo.texto, {
      eSoUmObrigado,
      pedeUmServico: (t) => servicoPorPalavras(t) != null,
    }).catch((err) => {
      console.error("[whatsapp] a resposta ao porquê não se leu:", err instanceof Error ? err.message : err);
      return null;
    });
    if (resposta?.tipo === "silencio") return;
    if (resposta?.tipo === "respondeu") {
      const texto = pc.respostaAoPorque(resposta.porque);
      if (resposta.porque === "valor" || resposta.porque === "data") {
        await passarAUmaPessoa(telefone, pc.motivoDoPorqueParaAEquipa(resposta.pedidos, resposta.porque), texto);
      } else {
        await enviarTextoWhatsApp(telefone, texto);
      }
      return;
    }
  }

  /*
   * QUEM JÁ ESTÁ A SAIR NÃO RECEBE UM FORMULÁRIO — recebe uma pessoa.
   *
   * «Tentei ligar várias vezes, se estiverem ocupados vou ter de avançar com
   * outra empresa» levou de volta «Com quem estou a falar?» (29-09-2026). Ver
   * `cliente-a-perder-a-paciencia.ts`. Vem antes de tudo o resto de propósito:
   * seja qual for o pé em que a conversa está, esta frase manda sobre ele.
   */
  if (conteudo.tipo === "texto") {
    /*
     * E QUEM SE QUEIXA DO ATENDIMENTO — 13-10-2026, o Abílio: «com esse
     * atendimento fica difícil». Antes da impaciência, porque «vou arranjar
     * outra empresa» cabe nas duas, e a quem se queixou deve-se um pedido de
     * desculpa, e não «desculpe a espera». Ver `voz-da-vitoria`.
     */
    const { reclamaDoAtendimento, desculpasPeloAtendimento } = await import("@/lib/voz-da-vitoria");
    if (reclamaDoAtendimento(conteudo.texto)) {
      await passarAUmaPessoa(
        telefone,
        "Cliente insatisfeito com o atendimento — responder já",
        desculpasPeloAtendimento(null),
      );
      return;
    }
    /*
     * A DESISTÊNCIA CLARA ÀS PROPOSTAS E A RESPOSTA À LISTA — d111 (24-11-2026).
     * «Obrigado, já tenho outra opção» em resposta ao seguimento, à lista ou a
     * uma proposta cancela o pedido logo (d93/d94); a resposta à lista das
     * propostas («2», «a da Recolhas Tejo») aceita essa. Antes da impaciência,
     * que lia «já contratei outra empresa» como uma ameaça de ir embora.
     */
    /*
     * QUEM PRECISA DE GUIA DE RESÍDUOS FALA COM UMA PESSOA — 25-11-2026 (d118).
     * Num pedido de entulho aberto, o cliente que diz que precisa de guia (ou da
     * e-GAR), que é uma empresa ou uma obra com licença, ou que exige um
     * certificado ou um comprovativo de entrega: passa à equipa, com o motivo
     * «Precisa de guia de resíduos».
     */
    if (!soImagens) {
      const g = await import("@/lib/guia-no-entulho");
      if (g.precisaDeGuia(conteudo.texto)) {
        const { temPedidoDeEntulhoAberto } = await import("@/lib/guia-no-entulho-na-base");
        if (await temPedidoDeEntulhoAberto(telefone)) {
          await passarAUmaPessoa(telefone, g.MOTIVO_DA_GUIA, g.PASSO_A_GUIA_A_UMA_PESSOA);
          return;
        }
      }
    }
    if (!soImagens) {
      const d111 = await import("@/lib/a-escolha-e-a-desistencia-no-whatsapp");
      if (await d111.tratarADesistencia(telefone, conteudo.texto)) return;
      if (await d111.responderALista(telefone, conteudo.texto)) return;
    }

    const { estaAPerderAPaciencia, RESPOSTA_A_QUEM_ESPEROU, MOTIVO_NO_PAINEL } = await import(
      "@/lib/cliente-a-perder-a-paciencia"
    );
    if (estaAPerderAPaciencia(conteudo.texto)) {
      await passarAUmaPessoa(telefone, MOTIVO_NO_PAINEL, RESPOSTA_A_QUEM_ESPEROU);
      return;
    }

    /*
     * A RECLAMAÇÃO DO VALOR DE QUEM JÁ TEM PEDIDO — 21-11-2026 (decisão d73, o
     * caso B). «Isto está muito caro», «não foi o que combinámos», «não
     * concordo com o valor»: com um pedido em curso (aberto, ou feito e
     * fechado há pouco, também com o valor final por pagar), passa à equipa
     * com a frase curta — nunca a recolha de um pedido novo, nem um «não» lido
     * como a recusa de uma proposta.
     */
    if (!soImagens) {
      const { reclamaDoValor, pedidoPrincipal, PASSEI_A_EQUIPA } = await import("@/lib/pedido-em-curso");
      if (reclamaDoValor(conteudo.texto)) {
        const principal = pedidoPrincipal(await emCurso());
        if (principal) {
          await passarAUmaPessoa(telefone, `Pedido #${principal.id}: o cliente reclama do valor — responder`, PASSEI_A_EQUIPA);
          return;
        }
      }
    }

    /*
     * O «SIM» AO «CHEGOU À SUA MORADA» — 31-10-2026 (d3). A mensagem do
     * «Cheguei» pede «responda SIM para confirmar que chegou»; nas horas
     * seguintes, o «SIM» grava a confirmação desse trabalho — o do «Cheguei»
     * por confirmar neste número, nunca outro pedido dele. Antes do aviso da
     * data e da negociação, que liam o «SIM» como outra coisa. Ver
     * `chegada-pelo-whatsapp.ts`.
     */
    const chegada = await import("@/lib/chegada-pelo-whatsapp");
    const leituraDaChegada = chegada.lerAChegada(conteudo.texto);
    if (leituraDaChegada) {
      const { chegadasPorConfirmarDoTelefone } = await import("@/lib/db");
      const escolha = chegada.escolherAChegada(
        await chegadasPorConfirmarDoTelefone(telefone, chegada.HORAS_PARA_CONFIRMAR_A_CHEGADA),
      );
      if (escolha?.tipo === "varios") {
        await passarAUmaPessoa(telefone, chegada.motivoDeVariasChegadas(escolha.pedidos));
        return;
      }
      if (escolha?.tipo === "um") {
        const c = escolha.chegada;
        if (leituraDaChegada === "ainda_nao") {
          await passarAUmaPessoa(telefone, chegada.motivoDoAindaNaoChegou(c.pedidoId));
          return;
        }
        const { confirmarAChegada, avisarProfissionalDaChegadaConfirmada } = await import("@/lib/confirmar-a-chegada");
        const quem = { negociacaoId: c.negociacaoId, pedidoId: c.pedidoId, providerId: c.providerId };
        const gravou = await confirmarAChegada({ ...quem, onde: "pelo WhatsApp", autorTipo: "cliente", autorNome: "WhatsApp" }).catch(
          (err) => {
            console.error("[whatsapp] a chegada não ficou gravada:", err);
            return false;
          },
        );
        if (!gravou) {
          await passarAUmaPessoa(telefone, `Chegada por confirmar no pedido #${c.pedidoId} — não ficou gravada`);
          return;
        }
        await enviarTextoWhatsApp(telefone, chegada.CHEGADA_CONFIRMADA);
        await avisarProfissionalDaChegadaConfirmada(quem);
        return;
      }
    }

    /*
     * A RESPOSTA AO LEMBRETE DO ORÇAMENTO — 18-11-2026 (d62). Com o lembrete
     * (ou o último aviso) enviado e o ciclo a correr: «1» avança com a proposta
     * do lembrete, «2» passa à equipa, «3» pergunta se confirma e só o
     * CANCELAR cancela (d2; os dados saem 7 dias depois, pela purga); outra
     * coisa qualquer pára a contagem e passa à equipa. Com o
     * interruptor desligado não há ciclos, e segue tudo como sempre. Ver
     * `validade-do-orcamento.ts`.
     */
    if (!soImagens) {
      const { ciclosComLembreteDoTelefone } = await import("@/lib/validade-do-orcamento-na-base");
      const ciclos = await ciclosComLembreteDoTelefone(telefone).catch((err) => {
        console.error("[whatsapp] a validade do orçamento não se leu:", err instanceof Error ? err.message : err);
        return [];
      });
      if (ciclos.length > 0) {
        await responderAoLembreteDoOrcamento(telefone, conteudo.texto, ciclos);
        return;
      }
    }

    /*
     * O SEGUIMENTO DO CLIENTE — 21-11-2026 (d83). A equipa falou com ele e
     * marcou quando voltar a contactar; a Vitória escreveu-lhe. Qualquer
     * mensagem dele pára o ciclo (o pedido volta a contar no «Precisa de si»);
     * se a última coisa que lhe dissemos foi o seguimento de um pedido (ou a
     * pergunta do CANCELAR dele), o «1», o «2», o «3» e o CANCELAR respondem a
     * esse pedido. Ver `seguimento-do-cliente.ts`.
     */
    {
      const seguimento = await import("@/lib/seguimento-do-cliente-na-base");
      const lido = await seguimento.seguimentosDoTelefone(telefone).catch((err) => {
        console.error("[whatsapp] o seguimento do cliente não se leu:", err instanceof Error ? err.message : err);
        return null;
      });
      if (lido?.responde && !soImagens) {
        await responderAoSeguimentoDoCliente(telefone, conteudo.texto, lido.responde);
        return;
      }
      /*
       * UM «OBRIGADO» SOZINHO NÃO PÁRA O SEGUIMENTO — d90 (23-11-2026). A quem
       * disse que ia pensar, a Vitória respondeu com delicadeza; o «obrigada» que
       * vem a seguir não é uma resposta que precise de nós: o ciclo continua
       * (a marcação passa para agora, para a rotina não o ler como resposta).
       */
      const { eSoUmObrigado: soObrigado } = await import("@/lib/aviso-de-data-ao-cliente");
      const soAgradeceu = !soImagens && soObrigado(conteudo.texto);
      for (const id of lido?.aCorrer ?? []) {
        if (soAgradeceu) await seguimento.seguimentoContinuaDepoisDoObrigado(id).catch(() => false);
        else await seguimento.pararSeguimento(id, "o cliente respondeu", new Date()).catch(() => false);
      }
    }

    /*
     * A RESPOSTA AO LEMBRETE DO QUE FALTA — 19-11-2026 (d71). Com um lembrete
     * destes em aberto para este número e pedido (a última mensagem que lhe
     * saiu é o lembrete dele): o «3» (ou «cancelar», «já não preciso») pergunta
     * «Responda CANCELAR» e só o CANCELAR cancela (d5, 21-11-2026; o «1» envia o que falta, o «2» é uma dúvida); o resto (fotografias,
     * dados, uma resposta ambígua) pára os lembretes e segue a conversa de
     * sempre, onde a Vitória recolhe o que falta. Um «2» que não se consegue
     * cancelar passa a uma pessoa. Com o interruptor desligado, nada muda.
     */
    {
      const lembrete = await import("@/lib/lembrete-do-que-falta-na-base");
      const pedidoDoLembrete = await lembrete.lembreteEmAbertoDoTelefone(telefone).catch((err) => {
        console.error("[whatsapp] o lembrete do que falta não se leu:", err instanceof Error ? err.message : err);
        return null;
      });
      if (pedidoDoLembrete != null) {
        const comImagens = soImagens || (conteudo.imagens ?? 0) > 0;
        const r = await lembrete
          .responderAoLembreteDoQueFalta(pedidoDoLembrete, telefone, conteudo.texto, comImagens)
          .catch((err) => {
            console.error("[whatsapp] a resposta ao lembrete do que falta falhou:", err instanceof Error ? err.message : err);
            return { tipo: "nao_cancelou" as const, pedidoId: pedidoDoLembrete, porque: "erro" };
          });
        if (r.tipo === "cancelado" || r.tipo === "perguntou_o_cancelar") return;
        if (r.tipo === "nao_cancelou") {
          await passarAUmaPessoa(telefone, `Pedido #${r.pedidoId}: disse que já não precisa (lembrete do que falta), mas ${r.porque} — cancelar à mão`);
          return;
        }
        if (r.tipo === "vai_enviar") {
          // d5: o «1» — pode enviar; a Vitória anota o que vier (a conversa de sempre).
          await enviarTextoWhatsApp(telefone, "Combinado! Pode enviar aqui o que falta, quando lhe der jeito, que eu anoto no pedido.").catch(() => false);
          return;
        }
        if (r.tipo === "duvida") {
          await passarAUmaPessoa(telefone, `Pedido #${r.pedidoId}: tem uma dúvida («2» ao lembrete do que falta)`);
          return;
        }
      }
    }

    /*
     * O CLIENTE CANCELA PELA CONVERSA — 23-11-2026 (decisão d93). «Quero
     * cancelar o pedido», «já não preciso, cancelem»: cancela logo, anonimiza
     * na hora e o número não volta a ser contactado; «cancelar a data», «se
     * calhar já não»: pergunta o CANCELAR. O contratado, pago, com referência
     * viva ou faturado vai à equipa. Ver `cancelar-pelo-cliente.ts`.
     */
    if (!soImagens && (await tratarOCancelamentoPeloCliente(telefone, conteudo.texto))) return;

    /*
     * A RESPOSTA AO «PEDIR O QUE FALTA» — 22-11-2026 (decisão d86). A última
     * mensagem que lhe saiu foi o envio de modelo que pede o que falta num
     * pedido dele (o «Pedir o que falta» da equipa, ou um lembrete da d71):
     * a Vitória grava no pedido o que ele respondeu e diz-lhe o que ficou
     * anotado, o que falta e o passo seguinte. As queixas, as desistências e
     * quem pede uma pessoa vão à equipa como sempre (também já lidos acima).
     * Uma mensagem da equipa escrita à mão depois do modelo cala-a (d73).
     */
    if (await responderAoEnvioDeModelo(telefone, conteudo.texto, conteudo.imagens ?? 0, conteudo.visto ?? [], conteudo.videos)) {
      return;
    }

    /*
     * RESPONDEU AO AVISO DA DATA — 01-10-2026.
     *
     * «O seu trabalho mudou de dia (…) Se não lhe der jeito, responda a esta
     * mensagem.» E ele responde. O cérebro não sabe mudar o dia de um trabalho
     * contratado: lia «esse dia não me dá jeito» como um pedido novo, ou como
     * um NÃO a uma proposta de outro pedido dele. Um obrigado fica registado e
     * mais nada; o resto passa a uma pessoa. Ver `aviso-de-data-ao-cliente.ts`.
     */
    const { avisoDeDataRecente } = await import("@/lib/db");
    const {
      HORAS_PARA_RESPONDER_AO_AVISO,
      RESPOSTA_A_QUEM_RESPONDEU_AO_AVISO,
      eSoUmObrigado,
      motivoNoPainelDoAvisoDeData,
    } = await import("@/lib/aviso-de-data-ao-cliente");
    const aviso = await avisoDeDataRecente(telefone, HORAS_PARA_RESPONDER_AO_AVISO);
    if (aviso) {
      if (soImagens) return;
      if (eSoUmObrigado(conteudo.texto)) return;
      await passarAUmaPessoa(
        telefone,
        motivoNoPainelDoAvisoDeData(aviso.pedidoId),
        RESPOSTA_A_QUEM_RESPONDEU_AO_AVISO,
      );
      return;
    }

    /*
     * O CLIENTE DE UM TRABALHO CLYON FALA COM A CLYON — 02-10-2026.
     *
     * O preço destes trabalhos foi combinado à mão, e o dono decidiu que o
     * cliente não leva mensagens automáticas. O cérebro não conhece o acordo:
     * lia o pedido dele como um pedido por propor, ou começava-lhe um novo. O
     * mesmo gesto da guarda de cima — um obrigado fica registado, o resto vai
     * para uma pessoa. Ver `oferta-clyon.ts`.
     */
    const { pedidoClyonActivoDoTelefone } = await import("@/lib/db");
    const doTrabalhoClyon = await pedidoClyonActivoDoTelefone(telefone);
    if (doTrabalhoClyon) {
      if (soImagens) return;
      if (eSoUmObrigado(conteudo.texto)) return;
      /*
       * A PERGUNTA QUE O SITE JÁ RESPONDE leva a resposta à frente — «o que é
       * a carga?», «posso mandar um vídeo?» (27-10-2026, decisão d2) —, e a
       * conversa passa na mesma a uma pessoa: o acordo é feito à mão.
       */
      const { respostaDoSiteOuDasLicoes } = await import("@/lib/licoes-da-vitoria");
      const frequente = respostaDoSiteOuDasLicoes(conteudo.texto);
      await passarAUmaPessoa(
        telefone,
        `Cliente do trabalho CLYON #${doTrabalhoClyon}`,
        frequente ? `${frequente}\n\n${RESPOSTA_A_QUEM_RESPONDEU_AO_AVISO}` : RESPOSTA_A_QUEM_RESPONDEU_AO_AVISO,
      );
      return;
    }
  }

  const pedidos = await pedidosDoTelefone(telefone);
  /*
   * «SIM, ACEITO O ORÇAMENTO DO PEDIDO #N.» — 15-11-2026 (d39). A mensagem
   * que o «Aceitar» da app de cliente deixa escrita: antes de tudo o resto
   * (até de uma recolha a meio), porque diz o pedido. Só um pedido DELE com
   * valor único por decidir conta como aceite; outro número vai para a
   * equipa confirmar. Ver `valor-unico-no-whatsapp.ts`.
   */
  if (conteudo.tipo === "texto" && !soImagens) {
    const vu = await import("@/lib/valor-unico-no-whatsapp");
    if (vu.pedidoDaAceitacaoEscrita(conteudo.texto) != null) {
      const { pedidosComValorUnicoPorDecidir } = await import("@/lib/valor-unico-no-whatsapp-na-base");
      await tratarOValorUnico(telefone, vu.decidirOValorUnico(conteudo.texto, await pedidosComValorUnicoPorDecidir(pedidos)));
      return;
    }
  }
  if (pedidos.length === 0) {
    /*
     * UM NÚMERO SEM PEDIDO É UM PEDIDO POR FAZER.
     *
     * Respondia «este número não está ligado a nenhum pedido — vá ao
     * simulador». "Quero esse WhatsApp usado pelo site automaticamente: se o
     * cliente enviar mensagem, ele responde para recolher os dados e criar o
     * pedido." O assistente pergunta uma coisa de cada vez e regista o pedido
     * no fim — ver whatsapp-recolha.ts. Botões não chegam aqui: uma pessoa
     * sem pedido não tem botões para carregar.
     */
    /*
     * O INTERRUPTOR "RECOLHER" — desligado, o assistente não faz perguntas.
     *
     * Cala-se e não responde nada: a mensagem dele JÁ ficou registada pelo
     * webhook antes de aqui chegar, por isso aparece na mesa do painel como
     * qualquer outra conversa, e quem estiver lá vê-a e responde. Inventar uma
     * resposta automática para dizer que não há resposta automática era a
     * pior das duas hipóteses.
     */
    /*
     * ⚠️ UM PROFISSIONAL NÃO É UM CLIENTE NOVO.
     *
     * Com os avisos a chegar, os profissionais respondem — «ok», «obrigado»,
     * «ainda está disponível?». Sem isto, o cérebro lia-os como alguém a
     * querer um orçamento e respondia «Diga-me o que precisa de levar». Já
     * tinha acontecido com uma transportadora.
     *
     * O que um profissional escreve para aqui é para a equipa: diz-se-lhe que
     * passa a uma pessoa, e passa. O «parar» é tratado antes, na ponte — que
     * desliga os avisos e confirma —, e por isso aqui não leva mais nada.
     */
    if (conteudo.tipo === "texto") {
      const { profissionalDoTelefone } = await import("@/lib/db");
      const pro = await profissionalDoTelefone(telefone);
      if (pro) {
        if (soImagens) return;
        const { ePedidoParaParar } = await import("@/lib/aviso-de-pedido-ao-profissional");
        if (ePedidoParaParar(conteudo.texto)) return;
        /*
         * A VITÓRIA RESPONDE AOS PROFISSIONAIS — d21 (13-11-2026). As 9 perguntas
         * de dinheiro do modelo de 15-11, com os valores da carteira dele, e fora
         * de horas quando lhe respondem (uma vez por noite). SÓ com a data do
         * modelo E o interruptor «Vitória: respostas automáticas aos
         * profissionais» das Configs, DESLIGADO por omissão; sem os dois, segue
         * como sempre. Ver `vitoria-aos-profissionais.ts`.
         */
        const { oQueDizerAoProfissional } = await import("@/lib/vitoria-aos-profissionais-na-base");
        const decisao = await oQueDizerAoProfissional(telefone, pro, conteudo.texto).catch(
          () => ({ tipo: "como_antes" }) as const,
        );
        if (decisao.tipo === "resposta") {
          await enviarTextoWhatsApp(telefone, decisao.texto);
          return;
        }
        if (decisao.tipo === "fora_de_horas") {
          if (decisao.texto) {
            await passarAUmaPessoa(telefone, "Profissional escreveu fora de horas — responder", decisao.texto);
          } else {
            const { interromperNumeroWhatsApp } = await import("@/lib/db");
            await interromperNumeroWhatsApp(telefone, "Profissional escreveu fora de horas — responder").catch(() => {});
          }
          return;
        }
        const { primeiroNome } = await import("@/lib/mensagem-whatsapp");
        const nome = primeiroNome(pro.nome);
        await passarAUmaPessoa(
          telefone,
          "Profissional escreveu — responder",
          `Obrigada${nome ? `, ${nome}` : ""}. Passo a sua mensagem a uma pessoa da CLYON, ` +
            "que lhe responde por aqui. Para propor num pedido novo, use a ligação do aviso.",
        );
        return;
      }
    }

    /*
     * SEM PEDIDO ABERTO NÃO QUER DIZER CLIENTE NOVO — 21-11-2026 (decisão d73,
     * o caso B). Um trabalho feito, com o valor final por pagar, ou um pedido
     * fechado há pouco: o que ele escreve sobre esse pedido (o estado, as
     * fotografias, o pagamento, a data, o valor) responde-se pelo pedido ou
     * passa à equipa; um pedido novo só quando o pede claramente, e diz-se-lhe
     * que é novo. Ver `decidirNoPedidoEmCurso`.
     */
    let novoDe: number | undefined;
    if (conteudo.tipo === "texto") {
      const { decidirNoPedidoEmCurso } = await import("@/lib/pedido-em-curso");
      const decisao = decidirNoPedidoEmCurso({ texto: conteudo.texto, imagens: conteudo.imagens, pedidos: await emCurso(), abertos: false });
      if (await cumprirADecisaoNoPedidoEmCurso(telefone, decisao)) return;
      if (decisao.tipo === "pedido_novo") novoDe = decisao.de;
    }

    // Quem quer ser parceiro, motorista ou ajudante (d69): o caminho da candidatura — `aoCandidato`.
    const { assistentePode } = await import("@/lib/db");
    if (!(await assistentePode("recolher"))) return;
    if (conteudo.tipo === "texto") {
      if (await aIntencaoAntesDaRecolha(telefone, conteudo.texto)) return;
      if (await aoCandidato(telefone, conteudo.texto)) return;
      if (!novoDe) await recolherPedidoPorWhatsApp(telefone, conteudo.texto, conteudo.imagens, conteudo.visto);
      else await recolherPedidoPorWhatsApp(telefone, conteudo.texto, conteudo.imagens, conteudo.visto, { pedidoNovoDe: novoDe });
    }
    return;
  }
  /*
   * A CONVERSA A MEIO NÃO PASSA PELA NEGOCIAÇÃO — 26-10-2026 (decisão d30).
   * A escolher o pedido, a completar o pedido que já existe, ou a fazer um
   * novo: um «sim», um número ou uma data são respostas à Vitória — ver
   * `conversaPresaARecolha`.
   */
  /*
   * «DO YOU SPEAK ENGLISH?» A QUEM JÁ TEM PEDIDO — 28-10-2026 (decisão d35).
   * Nunca «deixo-a anotada»: «Claro que sim!», e a língua já mudou ao registar
   * a mensagem (`linguaDepoisDaMensagem`). A conversa presa à recolha responde
   * lá (`antesDaResposta`); o resto da mensagem, se houver, segue como sempre.
   */
  if (conteudo.tipo === "texto" && !soImagens) {
    const { linguaPedida, semPedidoDeLingua } = await import("@/lib/lingua-do-cliente");
    if (linguaPedida(conteudo.texto) != null && !(await conversaPresaARecolha(telefone, pedidos, soImagens))) {
      const resto = semPedidoDeLingua(conteudo.texto);
      if (!resto) {
        const { CLARO_QUE_SIM, EM_QUE_POSSO_AJUDAR } = await import("@/lib/voz-da-vitoria");
        await enviarTextoWhatsApp(telefone, `${CLARO_QUE_SIM} ${EM_QUE_POSSO_AJUDAR}`);
        return;
      }
      conteudo = { ...conteudo, texto: resto };
    }
  }
  if (conteudo.tipo === "texto" && (await conversaPresaARecolha(telefone, pedidos, soImagens))) {
    const { assistentePode } = await import("@/lib/db");
    if (!(await assistentePode("recolher"))) return;
    await recolherPedidoPorWhatsApp(telefone, conteudo.texto, conteudo.imagens, conteudo.visto, {
      videos: conteudo.videos,
    });
    return;
  }
  /*
   * OS VÍDEOS DE QUEM JÁ TEM PEDIDO — 27-10-2026 (decisão d2). A cliente do
   * #853 mandou dois e ninguém os pôs no pedido: o vídeo não se descarrega, e
   * o pedido não dizia que existiam. Fica a nota, e agradece-se.
   */
  if (conteudo.tipo === "texto" && soImagens && (conteudo.videos ?? 0) > 0) {
    if (await responderNoPedidoDoCliente(telefone, pedidos, "", conteudo.imagens ?? 0, conteudo.videos ?? 0)) return;
  }
  // A negociação lê palavras; as fotografias do pedido já ficaram nele.
  if (soImagens) return;

  /*
   * A RESPOSTA AO VALOR ÚNICO — 15-11-2026 (d39). «Sim», «aceito», «pode ser»
   * com um só pedido de valor único por decidir é a aceitação dele, e vai para
   * a equipa escolher o parceiro; um não, um valor ou um nome também vão para
   * a equipa. Nunca pelo caminho das propostas (que aceitava a de um parceiro
   * pelo SIM), e um botão antigo de uma proposta desse pedido também não.
   */
  {
    const { pedidosComValorUnicoPorDecidir } = await import("@/lib/valor-unico-no-whatsapp-na-base");
    const comValorUnico = await pedidosComValorUnicoPorDecidir(pedidos);
    if (comValorUnico.length > 0) {
      const vu = await import("@/lib/valor-unico-no-whatsapp");
      if (conteudo.tipo === "botao") {
        const doBotao = Number(/^(?:ct|rc):(\d+):\d+$/.exec(conteudo.id)?.[1]);
        if (comValorUnico.includes(doBotao)) {
          await passarAUmaPessoa(telefone, vu.motivoDaRespostaAoValorUnico(doBotao));
          return;
        }
      } else {
        const decisao = vu.decidirOValorUnico(conteudo.texto, comValorUnico);
        if (decisao) {
          await tratarOValorUnico(telefone, decisao);
          return;
        }
      }
    }
  }

  // ── Botões: a acção e o alvo vêm no id — nada a interpretar ─────────────
  if (conteudo.tipo === "botao") {
    const m = conteudo.id.match(/^(ct|rc):(\d+):(\d+)$/);
    if (!m) return;
    const [, accao, pedidoStr, negStr] = m;
    const pedidoId = Number(pedidoStr);
    const negociacaoId = Number(negStr);
    // O alvo tem de ser DELE: um botão forjado com o pedido de outro número
    // morre aqui.
    if (!pedidos.includes(pedidoId)) return;
    const alvo = await alvoDe(pedidoId, negociacaoId);
    if (!alvo) return;

    if (accao === "ct") await fecharPeloCliente(telefone, alvo);
    else await recusarPeloCliente(telefone, alvo);
    return;
  }

  /*
   * «ELE VEM HOJE?», «A QUE HORAS CHEGA?» DE QUEM JÁ CONTRATOU — 31-10-2026
   * (decisão d8). Antes das perguntas do site: o «hoje» desta pergunta levava
   * o NO_MESMO_DIA de quem ainda vai pedir. Responde-se com o dia marcado e a
   * viagem, da mesma fonte da app (`quando-chega-o-parceiro.ts`); sem dia
   * marcado, passa a uma pessoa.
   */
  if (conteudo.tipo === "texto") {
    const { perguntaQuandoChega, respostaDeQuandoChega, trabalhoPorFazer } = await import("@/lib/quando-chega-o-parceiro");
    if (perguntaQuandoChega(conteudo.texto)) {
      for (const pedidoId of pedidos) {
        const trabalho = trabalhoPorFazer(pedidoId, await negociacoesDoPedido(pedidoId));
        if (!trabalho) continue;
        const r = respostaDeQuandoChega(trabalho);
        if (r.semDia) {
          await passarAUmaPessoa(telefone, `Perguntou quando chega o parceiro (pedido #${pedidoId}, sem dia marcado)`, r.texto);
        } else {
          await enviarTextoWhatsApp(telefone, r.texto);
        }
        return;
      }
    }
  }

  /*
   * «QUANDO É APRESENTADO O ORÇAMENTO?», «AS FOTOGRAFIAS JÁ ENVIEI» — 21-11-2026
   * (decisão d73, o caso A). Com o pedido registado, a pergunta pelo estado
   * responde-se pelo estado real do pedido (registado e a ser conferido,
   * enviado aos parceiros, ou o ecrã das propostas); as fotografias que ele
   * diz ter mandado, pelo que o pedido tem. O resto segue o caminho de sempre.
   */
  if (conteudo.tipo === "texto") {
    const { decidirNoPedidoEmCurso } = await import("@/lib/pedido-em-curso");
    const decisao = decidirNoPedidoEmCurso({ texto: conteudo.texto, pedidos: await emCurso(), abertos: true });
    if (decisao.tipo !== "pedido_novo" && (await cumprirADecisaoNoPedidoEmCurso(telefone, decisao))) return;
  }

  /*
   * AS PERGUNTAS QUE O SITE JÁ RESPONDE, E O QUE NÃO É PARA FAZER — 27-10-2026
   * (decisão d2, o #853). «Pode ser um vídeo?», «o que é a carga?», «Só não é
   * preciso tirar o frigorífico». Antes da tradução de propósito: nada disto é
   * aceitar ou recusar uma proposta, e o modelo podia lê-lo assim. Ver
   * `perguntas-frequentes-da-vitoria.ts` e `excluiDoTrabalho`.
   */
  if (conteudo.tipo === "texto") {
    const { respostaDoSiteOuDasLicoes } = await import("@/lib/licoes-da-vitoria");
    const { excluiDoTrabalho } = await import("@/lib/leitor-da-recolha");
    const linhas = conteudo.texto.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (respostaDoSiteOuDasLicoes(conteudo.texto, { contar: false }) || linhas.some((l) => excluiDoTrabalho(l))) {
      if (await responderNoPedidoDoCliente(telefone, pedidos, conteudo.texto, conteudo.imagens ?? 0, conteudo.videos ?? 0)) {
        return;
      }
    }
  }

  // ── Texto livre: sim/não, uma data, um valor, ou um ponto de situação ───
  /*
   * O GEMINI TRADUZ, E A MÁQUINA CONTINUA A DECIDIR.
   *
   * "O bot ainda usa palavras engessadas. Não deve usar sim ou não, apenas
   * frases e textos — o Gemini deve entender o contexto." — 12-09-2026.
   *
   * Em vez de ensinar o cliente a falar por palavras-chave, lê-se o que ele
   * escreveu e reescreve-se na forma que as expressões regulares já sabem
   * ler. «Pode ser, fechamos por esse valor» vira «sim 300»; «consegue por
   * 250?» vira «250».
   *
   * Assim nada abaixo muda, e todas as guardas ficam de pé: o fecho continua
   * a passar por `fecharPeloCliente`, a contraproposta por `propor`. O Gemini
   * alarga o que se PERCEBE; nunca alarga o que se aceita. E se ele não
   * estiver configurado, ou falhar, ou não perceber, lê-se o texto original —
   * que é exactamente o comportamento de sempre.
   */
  /*
   * COM PROPOSTAS EM CIMA DA MESA — d90 e d91 (23-11-2026), antes da tradução:
   *   · «escolho o X com a condição de…» não é um SIM — fica anotado, e a
   *     equipa confirma com o parceiro (nada fica marcado nem pago);
   *   · «vou pensar», «estou a aguardar outros orçamentos», «depois digo»: a
   *     resposta delicada, o pedido em «A aguardar cliente» e o seguimento a
   *     arrancar sozinho amanhã às 10h. O preço, a queixa, a alteração e o
   *     «quero falar com alguém» ficam com uma pessoa, como sempre.
   */
  if (conteudo.tipo === "texto") {
    const comPropostas = (await alvosAccionaveis(pedidos)).filter((a) => a.precoNaMesa != null);
    const { escolheComCondicao, ESCOLHA_COM_CONDICAO_ANOTADA } = await import("@/lib/perguntas-frequentes-da-vitoria");
    if (comPropostas.length > 0 && escolheComCondicao(conteudo.texto)) {
      await passarAUmaPessoa(
        telefone,
        `Pedido #${comPropostas[0].pedidoId}: escolheu uma proposta com uma condição — confirmar com o parceiro`,
        ESCOLHA_COM_CONDICAO_ANOTADA,
      );
      return;
    }
    const doPedido = [...new Set(comPropostas.map((a) => a.pedidoId))];
    if (doPedido.length === 1 && (await tentarOVaiPensar(telefone, conteudo.texto, doPedido[0]))) return;
  }

  const {
    texto,
    accao: percebida,
    alvo: alvoNomeado,
  } = await traduzirParaAMaquina(conteudo.texto.trim(), pedidos);

  /*
   * UM AGRADECIMENTO RESPONDE-SE COM UMA FRASE, NÃO COM UM RELATÓRIO.
   *
   *   CLIENTE: Ok, obrigada
   *   CLYON:   Pedido #311 — propostas em cima da mesa:
   *            • Manuel Martins transportes: 148,57 € (à sua espera)
   *            • ...
   *
   * A cliente tinha recebido esses valores meia hora antes, e não perguntou
   * nada. "Também não deve repetir informação." — 13-09-2026.
   */
  if (percebida === "agradecer") {
    await enviarTextoWhatsApp(telefone, "De nada. Qualquer coisa, é só dizer.");
    return;
  }

  /*
   * QUEM PEDE UMA PESSOA RECEBE UMA PESSOA.
   *
   * "falar_com_pessoa" era lido, classificado, e depois seguia com o texto
   * original — que não casava com nada e acabava, também ele, no ponto de
   * situação. Quem escrevia «posso falar com alguém?» recebia a lista de
   * preços.
   */
  if (percebida === "falar_com_pessoa") {
    // «É um robô?» — a verdade antes de passar (d85, 22-11-2026).
    const verdade = perguntaSeEUmaPessoa(conteudo.texto) ? `${SOU_A_ASSISTENTE_AUTOMATICA} ${MENSAGEM_DE_PASSAR_A_UMA_PESSOA}` : undefined;
    await passarAUmaPessoa(telefone, "Pediu para falar com uma pessoa", verdade);
    return;
  }

  // SIM e NÃO — o caminho de quem fala pela ponte, onde não há botões. Sem
  // acentos nem pontuação: "Não!" e "nao" têm de ser a mesma palavra.
  const chave = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[!.,…]+$/, "")
    .trim();
  /*
   * A LEITURA SEM MODELO — o degrau abaixo do Gemini.
   *
   * Era `^(sim|fechar|aceito|aceitar|pode fechar)$`: a palavra exacta e mais
   * nada. «Sim serve» falhava por ter duas palavras, e no dia em que o Gemini
   * não responde o assistente volta a exigir palavras-chave sem dizer a
   * ninguém que voltou. A lista está em `ler-a-resposta.ts`, escrita frase a
   * frase — cada uma fecha ou recusa um negócio de centenas de euros.
   */
  const lida = lerARespostaDirecta(chave);
  const simSo = lida?.tipo === "sim" && lida.valor == null;
  const naoSo = lida?.tipo === "nao" && lida.valor == null;
  const simValor = lida?.tipo === "sim" && lida.valor != null ? lida.valor : null;
  const naoValor = lida?.tipo === "nao" && lida.valor != null ? lida.valor : null;
  const nomeEValor = lida?.tipo === "nome_e_valor" ? lida : null;
  const simNome = lida?.tipo === "sim_nome" ? lida : null;
  const naoNome = lida?.tipo === "nao_nome" ? lida : null;
  const naoVarias = lida?.tipo === "nao_varias" ? lida : null;
  /** O nome que ele disse, seja em que forma for. Casa-se lá dentro. */
  const pistaDeNome = nomeEValor?.nome ?? simNome?.nome ?? naoNome?.nome ?? null;

  if (
    simSo ||
    naoSo ||
    simValor != null ||
    naoValor != null ||
    nomeEValor ||
    simNome ||
    naoNome ||
    naoVarias
  ) {
    /*
     * SÓ QUEM PÔS UM NÚMERO NA MESA PODE SER ESCOLHIDO POR UM NÚMERO.
     *
     * Um alvo sem valor não se fecha nem se recusa por valor, e listá-lo era
     * outra forma de dizer ao cliente quem ainda não lhe respondeu.
     *
     * E O NÚMERO É O DELE — 29-09-2026. Tudo daqui para baixo compara e
     * mostra o `precoNaMesa`, já com a taxa: é o que lhe foi dito, e é o que
     * ele escreve de volta. O valor do profissional ficou só para o motor.
     */
    const alvos = (await alvosAccionaveis(pedidos)).filter((a) => a.precoNaMesa != null);
    /*
     * «Revolution 94» é um SIM — ele está a escolher entre as que recebeu.
     *
     * Era a forma que o próprio ponto de situação ensinava («Diga qual pelo
     * valor») e a única que ele não sabia ler: a cliente escreveu-a às 14:54 e
     * levou de volta a lista outra vez.
     */
    const eDeFechar = simSo || simValor != null || Boolean(nomeEValor) || Boolean(simNome);
    const valorPedido = simValor ?? naoValor ?? nomeEValor?.valor ?? null;

    /*
     * O NOME QUE ELE DISSE, CASADO COM QUEM EXISTE.
     *
     * Nos dois sentidos de propósito: «Manuel» está DENTRO de «Manuel Martins
     * transportes», e «a proposta da Revolution» CONTÉM «Revolution». Uma só
     * direcção deixava de fora metade das formas de o dizer.
     *
     * O que torna isto seguro não é a comparação — é a unicidade. Se a pista
     * bater em dois, não se fecha nada.
     */
    const porPista = pistaDeNome
      ? alvos.filter((a) => {
          const dele = semAcentos(a.profissionalNome);
          const dito = semAcentos(pistaDeNome);
          return dele.includes(dito) || dito.includes(dele);
        })
      : [];

    // Com propostas de pedidos diferentes na mesma lista, o nome e o valor
    // podem repetir-se; o número do pedido não.
    const variosPedidos = new Set(alvos.map((a) => a.pedidoId)).size > 1;
    const linhaDoAlvo = (a: AlvoComValor) =>
      `• ${variosPedidos ? `Pedido #${a.pedidoId} — ` : ""}${a.profissionalNome}: ` +
      precoComBase(euros(a.precoNaMesa as number), a.base);
    const listaDeAlvos = () => alvos.map(linhaDoAlvo).join("\n");

    /*
     * VÁRIAS RECUSAS NUMA FRASE — tudo ou nada.
     *
     * Cada valor tem de bater em UMA proposta e só uma. Se um deles não bater
     * em nada, ou bater em duas, não se recusa nenhuma: recusar metade do que
     * ele pediu é a pior das três respostas possíveis, porque é irreversível
     * e ele fica sem saber onde é que aquilo ficou.
     */
    if (naoVarias) {
      const casados = naoVarias.valores.map((v) => ({
        valor: v,
        quais: alvos.filter((a) => Math.abs((a.precoNaMesa as number) - v) < 0.005),
      }));
      const semNenhuma = casados.filter((c) => c.quais.length === 0);
      const empatados = casados.filter((c) => c.quais.length > 1);
      /*
       * UM EMPATE NÃO SE DESEMPATA EM SILÊNCIO — nem se põe o cliente a
       * repetir uma frase que não vai levar a lado nenhum.
       *
       * É a mesma regra que o ramo de baixo já segue para um valor sozinho.
       * Dois pedidos com uma proposta de 300 € cada não se separam pelo
       * valor, e «Diga qual pelo valor» é o único vocabulário que o
       * assistente ensinou: mandá-lo tentar outra vez seria armar a
       * armadilha, e à segunda a mensagem nem sequer sai — sai repetida e o
       * `jaFoiDito` engole-a.
       */
      if (empatados.length > 0) {
        await passarAUmaPessoa(
          telefone,
          `Quis recusar ${empatados.map((m) => euros(m.valor)).join(", ")} e esse valor está em mais do que uma proposta — não dá para saber qual`,
        );
        return;
      }
      if (semNenhuma.length > 0 || casados.length === 0) {
        await enviarTextoWhatsApp(
          telefone,
          `Não encontrei nenhuma proposta de ${semNenhuma.map((m) => euros(m.valor)).join(", ")} em cima da mesa, por isso não recusei nenhuma.` +
            (alvos.length > 0 ? `\n${listaDeAlvos()}` : ""),
        );
        return;
      }
      await recusarVariasPeloCliente(
        telefone,
        casados.map((c) => c.quais[0]),
      );
      return;
    }

    /*
     * O NOME MANDA SOBRE O NÚMERO.
     *
     * Se ele disse «fico com o do Manuel» e só um Manuel bateu certo, a
     * negociação já está identificada — e melhor do que qualquer valor, que
     * pode estar empatado entre dois pedidos. Só se volta a procurar pelo
     * número quando não houve nome.
     */
    let alvo: AlvoComValor | undefined = alvoNomeado;

    /*
     * UM NOME SEM NÚMERO TAMBÉM CHEGA, se bater num só.
     *
     * «Aceito a proposta da Revolution» é a forma mais humana de todas, e a
     * que menos se parece com uma palavra-chave: não traz valor nenhum, e sem
     * isto caía no ramo das «2 propostas em cima da mesa» — que lhe respondia
     * pedindo exactamente aquilo que ela acabara de dizer.
     */
    if (!alvo && valorPedido == null && porPista.length === 1) {
      alvo = porPista[0];
    }
    if (!alvo && valorPedido == null && porPista.length > 1) {
      await passarAUmaPessoa(
        telefone,
        `Disse «${pistaDeNome}» e isso bate em ${porPista.length} profissionais — não dá para saber qual`,
      );
      return;
    }

    if (alvo) {
      if (eDeFechar) await fecharPeloCliente(telefone, alvo, conteudo.texto);
      else await recusarPeloCliente(telefone, alvo);
      return;
    }
    if (valorPedido != null) {
      /*
       * UM EMPATE NÃO SE DESEMPATA EM SILÊNCIO.
       *
       * Era `alvos.find(...)`: o PRIMEIRO com aquele valor. E `alvos` vem dos
       * pedidos por ordem decrescente de criação, portanto o primeiro é
       * sempre o pedido mais recente. Uma cliente com dois pedidos a 148,57 €
       * que escrevesse «fechar 148,57» fechava com o profissional do pedido
       * errado — e `fecharPeloCliente` mata logo a seguir todas as outras
       * negociações DESSE pedido. Irreversível, e do outro lado da linha.
       *
       * Não se pergunta «qual delas?»: a pergunta só teria resposta pelo
       * número do pedido, e um número sozinho é lido aqui como contraproposta
       * — mandá-la seria armar a armadilha seguinte. Vai para uma pessoa.
       */
      /*
       * O NOME, QUANDO ELE O DISSE, APERTA A ESCOLHA.
       *
       * «Revolution 94» traz as duas coisas, e as duas têm de bater na mesma
       * negociação. É o que torna esta leitura segura sem modelo nenhum: o
       * valor sozinho pode estar empatado, mas valor E nome ao mesmo tempo
       * identificam uma só — ou nenhuma, e aí não se fecha nada.
       */
      const casam = alvos
        .filter((a) => Math.abs((a.precoNaMesa as number) - valorPedido) < 0.005)
        .filter((a) => !pistaDeNome || porPista.includes(a));
      if (casam.length > 1) {
        await passarAUmaPessoa(
          telefone,
          `${casam.length} propostas de ${euros(valorPedido)} em pedidos diferentes (${casam
            .map((a) => `#${a.pedidoId}`)
            .join(", ")}) — não dá para saber qual quer fechar`,
        );
        return;
      }
      alvo = casam[0];
      if (!alvo && !eDeFechar) {
        await enviarTextoWhatsApp(
          telefone,
          `Não há nenhuma proposta de ${euros(valorPedido)} em cima da mesa.` +
            (alvos.length > 0 ? `\n${listaDeAlvos()}` : ""),
        );
        return;
      }
      // "aceito 300" sem 300 na mesa segue para baixo e vira contraproposta
      // de 300 — que é o que a frase quer dizer nesse caso.
    } else if (alvos.length === 1) {
      alvo = alvos[0];
    } else if (alvos.length === 0) {
      await mandarOEcra(telefone, pedidos[0]);
      return;
    } else {
      /*
       * Várias em cima da mesa: um SIM sozinho fecharia a que ele não queria.
       *
       * O exemplo é o VALOR EXACTO, e não arredondado. Dizia-se «por exemplo:
       * fechar 149» sobre uma proposta de 148,57 €, e 149 não está na mesa:
       * quem seguisse a sugestão à letra não fechava nada — fazia uma
       * contraproposta de 149 €. A frase que ensina a responder tem de ser
       * uma frase que funciona.
       */
      const exemplo = euros(alvos[0].precoNaMesa as number).replace(" €", "");
      await enviarTextoWhatsApp(
        telefone,
        `Tem ${alvos.length} propostas em cima da mesa:\n${listaDeAlvos()}\n\n` +
          `Diga qual pelo valor — por exemplo: ${eDeFechar ? "fechar" : "recusar"} ${exemplo}`,
      );
      return;
    }

    if (alvo) {
      if (eDeFechar) await fecharPeloCliente(telefone, alvo, conteudo.texto);
      else await recusarPeloCliente(telefone, alvo);
      return;
    }
  }

  /*
   * A DATA, COMO AS PESSOAS A ESCREVEM.
   *
   * Era `dd/mm hh:mm` e mais nada, e a mensagem de fecho ENSINAVA essa forma.
   * «dia 16 às 10h» é como se fala, e ficava por ler. Ver `ler-a-data.ts`: um
   * número sozinho continua a ser contraproposta, porque a hora exige marca.
   */
  const lidaAData = lerAData(texto);
  if (lidaAData && lidaAData.hora == null) {
    /*
     * O DIA SEM A HORA NÃO MARCA NADA — mas também não se deita fora.
     * Pergunta-se só o que falta, e repete-se o dia para ele saber que foi
     * ouvido.
     */
    await enviarTextoWhatsApp(
      telefone,
      `Anotei o ${diaPorPalavras(lidaAData)}. A que horas lhe dá jeito? ` +
        `Diga-me o dia e a hora juntos — por exemplo, ${lidaAData.dia} às 10h.`,
    );
    return;
  }
  if (lidaAData) {
    const agora = new Date();
    const d = quandoSera(lidaAData, agora);
    if (!d) {
      await enviarTextoWhatsApp(telefone, "Essa data já passou — confirme o dia e a hora (ex.: 27/08 14:30).");
      return;
    }
    for (const pedidoId of pedidos) {
      const linhas = await negociacoesDoPedido(pedidoId);
      const acordada = linhas.find((n) => n.estado === "acordada" && n.confirmadoEm == null);
      if (acordada) {
        await updateSimulatorOrder(
          pedidoId,
          { dataAgendada: d } as unknown as Parameters<typeof updateSimulatorOrder>[1],
        );
        await registarAccao(
          pedidoId,
          Number(acordada.id),
          `Cliente marcou ${d.toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })} por WhatsApp.`,
        );
        await enviarTextoWhatsApp(
          telefone,
          `Marcado: ${d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" })} às ${d.toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" })}, com ${acordada.profissionalNome}. Ele vê a data na agenda dele.`,
        );
        return;
      }
    }
    await enviarTextoWhatsApp(
      telefone,
      "Ainda não há parceiro contratado — escolha primeiro uma proposta, e depois mando-lhe marcar a data.",
    );
    return;
  }

  /*
   * Valor: contraproposta. Aplica-se à negociação mais recente que a espera.
   *
   * A PALAVRA PODE VIR DOS DOIS LADOS DO NÚMERO. Exigia-se que o número
   * estivesse sozinho, ou com um verbo à frente. O cliente do pedido #323
   * escreveu «250 contraporposta» — o valor e, a seguir, a palavra que diz o
   * que fazer com ele, torta como lhe saiu. Não casava com nada, e a
   * contraproposta de 250 € nunca entrou na mesa.
   *
   * O `contra\S*` é de propósito mais largo do que a palavra certa: ao lado
   * de um preço, o que começa por «contra» é sempre isto, escreva-se como se
   * escrever.
   */
  const valorTexto = texto.match(
    // «250 por carga» e «250 €/carga» também: é como a mensagem lhe fala.
    /^(?:aceito\s+|aceitar\s+|proponho\s+|contra\S*\s+|fechar\s+|sim\s+)?(\d{1,4})(?:[.,](\d{1,2}))?\s*(?:€|eur|euros)?(?:\s*(?:\/|por)\s*carga)?(?:\s+(?:contra\S*|propostas?))?\s*$/i,
  );
  if (valorTexto) {
    /*
     * UMA CONTRAPROPOSTA TAMBÉM É UM NÚMERO A ENTRAR NA MESA.
     *
     * Passa pelo mesmo interruptor do fecho, e a razão é a mesma: quem leu
     * "e se fosse 180?" no meio de uma frase foi um modelo de linguagem. Se o
     * dono desligou o "fechar" porque o assistente andava a ler mal, deixá-lo
     * continuar a escrever valores na negociação seria desligar metade do
     * travão e chamar-lhe travão.
     */
    const { assistentePode: podeMexerNoValor } = await import("@/lib/db");
    if (!(await podeMexerNoValor("fechar"))) {
      await passarAUmaPessoa(telefone, "Fechar desligado - propôs um valor");
      return;
    }
    /*
     * O NÚMERO DELE É O QUE ELE PAGA — 29-09-2026.
     *
     * «Posso pagar 300» quer dizer 300 a sair da carteira: foi num preço já
     * com a taxa que ele leu a proposta. Até aqui entrava no motor como o
     * valor do profissional, e a taxa ia-lhe por cima — pagava 315 € por uma
     * contraproposta de 300. A volta faz-se por negociação, porque cada uma
     * tem as suas taxas gravadas.
     */
    const preco = Number(`${valorTexto[1]}.${valorTexto[2] ?? "0"}`);
    for (const pedidoId of pedidos) {
      const linhas = await negociacoesDoPedido(pedidoId);
      const candidatas = linhas
        .filter((n) => n.estado === "aberta" || n.estado === "aguarda_contratacao")
        .sort(
          (a, b) =>
            new Date(String((b as { updatedAt?: unknown }).updatedAt ?? 0)).getTime() -
            new Date(String((a as { updatedAt?: unknown }).updatedAt ?? 0)).getTime(),
        );
      // d17: no modelo de 15-11 o escrito é o total das duas faturas, pelo regime do parceiro.
      const novas = await nasNovoModelo(candidatas);
      for (const n of candidatas) {
        // O que ele escreve é um preço no modelo DESTA negociação (01-10-2026), e
        // no de 15-11 a conta inversa do total do cartão (`valorDoPrecoEscrito`).
        const modelo = modeloDaNegociacao(n.createdAt);
        const escrito = valorDoPrecoEscrito(n, preco, modelo, novas.has(Number(n.id)));
        if (escrito == null) continue;
        const valor = escrito.valor;
        const estado: Negociacao = {
          estado: n.estado as Negociacao["estado"],
          valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
          propostas: propostasDe(n.propostasJson),
        };
        const r = propor(estado, "cliente", valor, new Date());
        if (!r.ok) continue;
        await gravarNegociacao(Number(n.id), {
          estado: r.negociacao.estado,
          valorAcordado: r.negociacao.valorAcordado ?? null,
          propostasJson: JSON.stringify(r.negociacao.propostas),
        });
        const baseDele = await baseDoPedido(pedidoId);
        // O que fica: o escrito, ou um cêntimo abaixo — ver `total-ao-cliente.ts`.
        const ficou = escrito.ficou;
        await registarAccao(
          pedidoId,
          Number(n.id),
          `Cliente contrapropôs ${precoComBase(euros(ficou), baseDele)} a ${n.profissionalNome} ` +
            `por WhatsApp (${precoComBase(euros(valor), baseDele)} para o profissional).`,
        );
        // O profissional é avisado pelo caminho de sempre — email e painel —
        // e com o valor DELE.
        await avisarDaProposta({
          pedidoId,
          negociacaoId: Number(n.id),
          quemPropos: "cliente",
          valor,
        });
        await enviarTextoWhatsApp(
          telefone,
          `Contraproposta de ${precoComBase(euros(ficou), baseDele)} enviada a ${n.profissionalNome}. ` +
            `Escrevo-lhe assim que ele responder.`,
        );
        return;
      }
    }
    await enviarTextoWhatsApp(
      telefone,
      "Não há nenhuma negociação à espera de valor neste momento. Escrevo-lhe assim que houver novidades.",
    );
    return;
  }

  /*
   * NADA RECONHECIDO — E O PONTO DE SITUAÇÃO SÓ SERVE SE HOUVER SITUAÇÃO.
   *
   * Esta linha era incondicional: tudo o que não fosse sim, não, um valor ou
   * uma data levava de volta a mesa inteira. Servia para três coisas
   * diferentes — «não percebi», «tome o seu ponto de situação» e «não tenho
   * nada a dizer» — e as três saíam iguais. Cinco mensagens seguidas davam
   * cinco relatórios idênticos.
   *
   * O ecrã vale a pena quando a bola está do lado dele: há uma proposta à
   * espera de resposta, e o que ele precisa é de a ver outra vez para decidir.
   * Quando não há nada pendente, repetir valores que ele já leu não é
   * informação — é ruído, e faz o assistente parecer uma máquina a debitar.
   */
  const pendentes = await alvosAccionaveis(pedidos);
  if (pendentes.length === 0) {
    /*
     * TER UM PEDIDO NÃO QUER DIZER QUE SE ESTÁ A FALAR DELE — 16-09-2026.
     *
     * "corrija o assistente com urgência, primeira mensagem do cliente."
     *
     *   CLIENTE: Olá! Gostava de pedir um orçamento à CLYON.
     *   CLYON:   Está tudo a andar deste lado. Assim que houver novidades,
     *            sou eu a escrever-lhe.
     *   CLIENTE: Esvaziei uma arrecadação e tenho lixo para levar, pois com a
     *            inundação estragou tudo
     *   CLYON:   Está tudo a andar deste lado. (…)
     *
     * O cérebro decidia pelo QUE ELA TEM — um pedido na base, sem nada
     * pendente — e não pelo QUE ELA ESCREVEU. Quem está a pedir um orçamento
     * novo levava de volta uma frase de circunstância, duas vezes seguidas.
     *
     * Chegar aqui já quer dizer muito: não era um sim, um não, um valor, uma
     * data, um agradecimento nem um pedido para falar com alguém — e não há
     * proposta nenhuma à espera dela. Uma pessoa que escreve nessas condições
     * está a pedir alguma coisa, e quem sabe ler isso é o assistente da
     * recolha, que lê texto livre e pergunta o que falta.
     *
     * A frase antiga fica para quem pergunta mesmo como vai o trabalho — o
     * modelo marca isso como `ponto_de_situacao`, e aí ela é a resposta certa.
     */
    if (percebida === "ponto_de_situacao") {
      // O estado real do pedido, quando se sabe dizer (d73, 21-11-2026); senão, a frase de sempre.
      const { pedidoPrincipal, respostaDoEstado } = await import("@/lib/pedido-em-curso");
      const principal = pedidoPrincipal(await emCurso());
      await enviarTextoWhatsApp(
        telefone,
        (principal ? respostaDoEstado(principal) : null) ??
          "Está tudo a andar deste lado. Assim que houver novidades, sou eu a escrever-lhe.",
      );
      return;
    }
    await recolherPedidoPorWhatsApp(telefone, conteudo.texto);
    return;
  }
  await mandarOEcra(telefone, pendentes[0].pedidoId);
}

/**
 * A VITÓRIA CONTINUA DEPOIS DO PEDIDO — 27-10-2026 (decisão d2, o #853).
 *
 * Responde à pergunta que o site já responde, e junta ao pedido o que ele
 * acrescenta (o que não é para fazer, os vídeos) — pelo mesmo caminho do
 * pedido aberto (`completarOPedidoAberto`), que escreve só por baixo do que
 * lá está e nunca apaga nada. O pedido é o desta conversa, se for dele; senão
 * o mais recente. Devolve `true` quando respondeu.
 */
async function responderNoPedidoDoCliente(
  telefone: string,
  pedidos: number[],
  texto: string,
  imagens: number,
  videos: number,
): Promise<boolean> {
  const { recolhaWhatsApp } = await import("@/lib/db");
  const guardada = await recolhaWhatsApp(telefone).catch(() => null);
  const daConversa = guardada?.pedidoId != null && pedidos.includes(guardada.pedidoId) ? guardada.pedidoId : null;
  const id = daConversa ?? pedidos[0];
  if (id == null) return false;
  const pedido = (await getSimulatorOrderById(id).catch(() => undefined)) as PedidoDaBaseAqui | undefined;
  if (!pedido) return false;
  return completarOPedidoAberto(telefone, pedido, texto, {
    imagensNovas: imagens,
    videos,
    guardada: daConversa != null ? guardada : null,
    primeira: guardada == null || daConversa == null || (guardada.dados as DadosDaRecolhaAqui).pedidoAberto !== id,
  });
}

/**
 * A proposta de um profissional, entregue no WhatsApp do cliente — com os
 * botões que fecham ou recusam num toque. É o outbound que fazia o Wanderson
 * escrever à mão.
 */
/**
 * Uma fotografia do cliente — vai parar às fotos do pedido dele.
 *
 * No Winapp as fotos morriam num aviso "não consegui abrir"; aqui fazem o
 * caminho inteiro: API da Meta → Blob da CLYON → filesJson do pedido, com
 * linha no histórico. Só funciona pela Cloud API (é dela que se descarrega o
 * media). Desde 10-10-2026 também para quem ainda está a meio da conversa,
 * sem pedido: a fotografia fica à espera dele (ver `guardarFotoDoClienteNoPedido`)
 * e, se o pedido não nascer, sai na purga ao fim de poucos dias.
 */
export async function tratarFotoDoCliente(
  telefone: string,
  mediaId: string,
  mime: string | null,
): Promise<void> {
  if (!(await portaDaFotografia(telefone)).guarda) return;
  if (!process.env.WHATSAPP_TOKEN) return;

  try {
    const auth = { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } };
    const meta = (await (
      await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, auth)
    ).json()) as { url?: string; mime_type?: string };
    if (!meta.url) return;
    const resposta = await fetch(meta.url, auth);
    if (!resposta.ok) return;
    const bytes = Buffer.from(await resposta.arrayBuffer());
    await guardarFotoDoClienteNoPedido(telefone, bytes, mime ?? meta.mime_type ?? "image/jpeg");
  } catch (e) {
    console.error("[whatsapp] foto falhou", e);
  }
}

/**
 * GUARDAR E FALAR SÃO DUAS DECISÕES — 23-11-2026 (d98).
 *
 * Era o portão das mensagens (`podeOWhatsAppFalarCom`) a decidir também se a
 * fotografia se guardava, e a fotografia de um número entregue à equipa ia
 * para o lixo: quem tinha a conversa via «[fotografia]» no fio e nada no
 * pedido. Agora guarda-se na mesma — no pedido ou à espera dele — sem
 * resposta ao cliente (a conversa é de quem a tem). De fora continuam o
 * WhatsApp desligado no painel, o número bloqueado e o «não contactar» (d93):
 * esses não guardam nada, que é o que bloquear quer dizer.
 */
export async function portaDaFotografia(telefone: string): Promise<{ guarda: boolean; falar: boolean }> {
  const { whatsappLigado, numeroBloqueadoWhatsApp, podeOWhatsAppFalarCom } = await import("@/lib/db");
  if (!(await whatsappLigado())) return { guarda: false, falar: false };
  if (await numeroBloqueadoWhatsApp(telefone)) return { guarda: false, falar: false };
  const { eParaNaoContactar } = await import("@/lib/nao-contactar");
  if (await eParaNaoContactar(telefone).catch(() => false)) return { guarda: false, falar: false };
  return { guarda: true, falar: await podeOWhatsAppFalarCom(telefone) };
}

/**
 * Os bytes de uma fotografia do cliente, para o pedido dele — Blob →
 * filesJson → histórico. Serve a API da Meta (que os descarrega acima) e a
 * ponte (que os traz já descarregados do WhatsApp Web). `semResposta`: a
 * ponte com o número entregue à equipa (d98) — guarda, e não diz nada.
 */
export async function guardarFotoDoClienteNoPedido(
  telefone: string,
  bytes: Buffer,
  mime: string | null,
  opcoes: { semResposta?: boolean } = {},
): Promise<void> {
  const porta = await portaDaFotografia(telefone);
  if (!porta.guarda) return;
  const podeFalar = porta.falar && opcoes.semResposta !== true;
  const { recolhaWhatsApp } = await import("@/lib/db");
  const pedidos = await pedidosDoTelefone(telefone);
  /*
   * A CONVERSA DIZ A QUE PEDIDO VAI A FOTOGRAFIA — 26-10-2026 (decisão d30).
   *
   * Era sempre o pedido mais recente do telefone. Agora: a conversa que está a
   * completar um pedido manda — vai para ESSE (mesmo que o telefone do pedido
   * seja outro: foi um colega que os ligou), e quem agradece é a Vitória, na
   * resposta dela. A meio da escolha «a qual se refere?», ou de um pedido
   * novo, fica à espera do pedido certo.
   */
  const conversa = await recolhaWhatsApp(telefone).catch(() => null);
  const naConversa = (conversa?.dados ?? {}) as { pedidoAberto?: number; pedidosAEscolher?: number[]; trocouDoPedido?: number };
  // O rascunho vale 7 dias (d93).
  const { rascunhoAindaVale } = await import("@/lib/conversa-parada-a-meio");
  const { pedidoEstaAberto } = await import("@/lib/pedido-aberto-na-conversa");
  const recente = conversa != null && rascunhoAindaVale(conversa.actualizadoEm);
  let doPedidoAberto: number | null =
    conversa?.pedidoId != null && naConversa.pedidoAberto === conversa.pedidoId ? conversa.pedidoId : null;
  if (doPedidoAberto != null) {
    const p = await getSimulatorOrderById(doPedidoAberto).catch(() => undefined);
    if (!pedidoEstaAberto(p as { id: number; status?: string | null } | undefined)) doPedidoAberto = null;
  }
  const aEscolher = Array.isArray(naConversa.pedidosAEscolher) && naConversa.pedidosAEscolher.length > 0;
  /*
   * SÓ FICA À ESPERA QUEM ESTÁ MESMO A FAZER UM PEDIDO NOVO — 23-11-2026 (d98).
   *
   * Ficava à espera sempre que a conversa estava a meio de uma recolha e o
   * pedido aberto do número não tinha propostas para aceitar — com o pedido
   * já feito, e a fotografia nunca lá chegava (a junção só corre quando um
   * pedido NASCE). Agora espera só: a meio da escolha «a qual se refere?»; na
   * recolha nova de quem trocou de sítio (d51), que não vai para o antigo; ou
   * numa recolha a meio sem nenhum pedido aberto do número. Nos outros casos
   * vai para o pedido aberto mais recente.
   */
  let aMeio = recente && conversa?.pedidoId == null && (aEscolher || naConversa.trocouDoPedido != null);
  if (!aMeio && recente && conversa != null && conversa.pedidoId == null && conversa.passo !== "servico") {
    const maisRecente = pedidos[0] != null ? await getSimulatorOrderById(pedidos[0]).catch(() => undefined) : undefined;
    if (!pedidoEstaAberto(maisRecente as { id: number; status?: string | null } | undefined)) aMeio = true;
  }
  /*
   * A FOTOGRAFIA QUE RESPONDE AO «PEDIR O QUE FALTA» — 22-11-2026 (d86). Vai
   * para o pedido do modelo (se for deste número), e quem agradece é a
   * Vitória, na resposta dela — uma mensagem só.
   */
  let doModelo: number | null = null;
  if (doPedidoAberto == null && !aMeio) {
    const { mensagensDoNumeroWhatsApp } = await import("@/lib/db");
    const { respostaAoEnvioDeModelo } = await import("@/lib/resposta-ao-que-falta");
    const alvo = respostaAoEnvioDeModelo(await mensagensDoNumeroWhatsApp(telefone, 40).catch(() => []));
    if (alvo && pedidos.includes(alvo.pedidoId)) doModelo = alvo.pedidoId;
  }
  const pedidoId: number | null = doPedidoAberto ?? doModelo ?? (aMeio ? null : (pedidos[0] ?? null));

  try {
    // 10 MB chegam para qualquer fotografia; acima disso é outra coisa.
    if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) return;

    const tipo = mime ?? "image/jpeg";
    const extensao = tipo.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const { put } = await import("@vercel/blob");
    const { obterTokenDoBlob } = await import("@/lib/blob-token");
    const tokenBlob = obterTokenDoBlob();
    if (!tokenBlob.ok) return;
    const nome = `whatsapp-${Date.now()}.${extensao}`;
    const blob = await put(`simulador/${nome}`, bytes, {
      access: "public",
      contentType: tipo,
      addRandomSuffix: true,
      ...(tokenBlob.modo === "token" ? { token: tokenBlob.token } : { storeId: tokenBlob.storeId }),
    });
    const ficheiro = { url: blob.url, name: nome, size: bytes.length, type: tipo };

    /*
     * AINDA SEM PEDIDO: FICA À ESPERA DELE — 10-10-2026.
     *
     * Saía-se daqui antes de descarregar fosse o que fosse, e as fotografias
     * de quem estava a meio da conversa — as dezoito do Telmo, as nove do
     * Romão — perdiam-se sem ninguém saber. Ficam em `whatsappFotosPendentes`
     * e entram no pedido quando ele nascer (`anexarFotosPendentesAoPedido`);
     * as que nunca chegam a pedido saem na purga ao fim de
     * `DIAS_DAS_FOTOS_SEM_PEDIDO`. Sem resposta ao cliente: a conversa segue
     * pelo texto, e o assistente já sabe que elas chegaram.
     */
    const { guardarFotoPendenteWhatsApp, juntarFicheirosAoPedido } = await import("@/lib/db");
    if (pedidoId == null) {
      await guardarFotoPendenteWhatsApp(telefone, ficheiro);
      return;
    }

    // Junta-se na própria base, sem ler-alterar-gravar (d98): a rajada de quatro fica com as quatro.
    if (!(await juntarFicheirosAoPedido(pedidoId, [ficheiro]))) {
      // O pedido desapareceu entretanto: espera por outro, em vez de se perder.
      await guardarFotoPendenteWhatsApp(telefone, ficheiro);
      return;
    }
    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message: "Cliente enviou uma fotografia por WhatsApp — anexada ao pedido.",
    }).catch(() => {});
    // Na conversa que completa o pedido (ou responde ao modelo, d86), agradece a Vitória — uma vez por rajada.
    if (doPedidoAberto == null && doModelo == null && podeFalar) {
      await enviarTextoWhatsApp(
        telefone,
        `Recebi a fotografia — ficou anexada ao pedido #${pedidoId}.`,
      );
    }
  } catch (e) {
    console.error("[whatsapp] foto falhou", e);
  }
}

/**
 * NÃO CONTAR A MESMA NOVIDADE DUAS VEZES.
 *
 * Estes dois envios são imediatos: saem no instante em que a proposta é
 * gravada, porque uma proposta que chega dez minutos depois já perdeu para
 * quem respondeu primeiro. O observador do assistente, que passa de dez em dez
 * minutos, veria a mesma proposta e contá-la-ia outra vez — e o cliente ouvia
 * tudo a dobrar.
 *
 * A mesma chave nos dois caminhos resolve-o, e quem chegar primeiro fala. Sai
 * daqui também o registo do aviso, que é o que põe esta proposta na lista de
 * quem pode levar um lembrete se ficar sem resposta.
 *
 * DEVOLVE `podeFalar: true` quando é a primeira vez. Uma avaria da base
 * devolve `true`, e é de propósito: repetir uma mensagem é chato, e calar a
 * proposta de um cliente para sempre não é.
 *
 * E DEVOLVE O `id`, porque quem chama tem de o poder LIBERTAR. A reserva é
 * feita antes do envio — tem de ser, senão dois caminhos falam ao mesmo tempo
 * — mas o envio pode não acontecer: a conversa está entregue a uma pessoa, o
 * número está bloqueado, o canal caiu. Deixar a reserva de pé nesse caso fazia
 * desta proposta uma que nunca mais seria anunciada a ninguém, e ainda por
 * cima com lembretes sobre uma mensagem que o cliente nunca recebeu.
 */
async function podeContarPelaPrimeiraVez(
  chave: string,
  especie: string,
  dados: { telefone: string; pedidoId: number; negociacaoId: number },
  resumo: string,
): Promise<{ podeFalar: boolean; id: number | null }> {
  try {
    const { assistentePode, reservarAvisoDoAssistente, guardarTextoDoAviso } = await import(
      "@/lib/db"
    );

    /*
     * O INTERRUPTOR "AVISAR DE PROPOSTAS" — o que faltava mesmo.
     *
     * A ficha do interruptor prometia travar estas duas mensagens e não
     * travava nenhuma: este caminho é o imediato, sai no instante em que a
     * proposta é gravada, e nunca perguntava nada a ninguém. Um botão que diz
     * que pára uma coisa e não a pára é pior do que não existir — o dono
     * carrega nele, vê as mensagens continuarem a sair, e deixa de acreditar
     * no painel.
     *
     * Com ele em baixo não se reserva chave nenhuma: não foi contado nada, e
     * guardar a marca de uma conversa que não houve fecharia a porta a
     * contá-la mais tarde.
     */
    if (!(await assistentePode("propostas"))) return { podeFalar: false, id: null };
    const { id, jaExistia } = await reservarAvisoDoAssistente({
      chave,
      especie,
      telefone: dados.telefone,
      pedidoId: dados.pedidoId,
      negociacaoId: dados.negociacaoId,
    });
    if (jaExistia) return { podeFalar: false, id: null };
    if (id) await guardarTextoDoAviso(id, resumo);
    return { podeFalar: true, id };
  } catch (e) {
    console.error("[assistente] não reservei a novidade:", e instanceof Error ? e.message : e);
    return { podeFalar: true, id: null };
  }
}

/** A reserva só vale se a mensagem chegou a sair. Senão, apaga-se. */
async function libertarSeNaoSaiu(id: number | null, saiu: boolean): Promise<boolean> {
  if (!saiu && id != null) {
    const { libertarAvisoDoAssistente } = await import("@/lib/db");
    await libertarAvisoDoAssistente(id).catch(() => {});
  }
  return saiu;
}

/**
 * AS TAXAS E A FORMA DESTA NEGOCIAÇÃO, lidas da base — 29-09-2026.
 *
 * As duas mensagens de baixo faziam a conta com as taxas de origem e como se
 * todo o cliente pagasse pela plataforma. A quem escolheu dinheiro dizia-se o
 * total de quem paga por referência; e com a comissão mudada no backoffice, o
 * preço dito deixava de ser o gravado. Quem chama já não tem de se lembrar de
 * as passar: vêm de onde estão guardadas.
 */
async function comoEstaNegociacaoSePaga(
  pedidoId: number,
  negociacaoId: number,
): Promise<{
  linhas: Awaited<ReturnType<typeof negociacoesDoPedido>>;
  taxas: Taxas;
  forma: FormaDePagamento;
  /** O modelo do preço — com IVA incluído desde o corte de 01-10-2026. */
  modelo: ModeloDoPreco;
  /** d10: segue o modelo de 15-11-2026 (o cliente paga ao parceiro)? */
  novoModelo: boolean;
  /** d17: a linha da base, para o total do modelo novo (`totalAoClienteDaNegociacao`). */
  linha: LinhaDaVitoria | null;
}> {
  const linhas = await negociacoesDoPedido(pedidoId).catch(() => []);
  const n = linhas.find((x) => Number(x.id) === negociacaoId);
  return {
    linhas,
    taxas: taxasDaNegociacao(n),
    forma: lerForma((n as { formaDePagamento?: unknown } | undefined)?.formaDePagamento),
    modelo: modeloDaNegociacao(n?.createdAt),
    novoModelo: await noNovoModelo(n ?? { id: negociacaoId }),
    linha: n ?? null,
  };
}

/**
 * ESTA NEGOCIAÇÃO SEGUE O MODELO DE 15-11-2026? — d10, e d17 (13-11-2026): a
 * regra da Mesa e do cartão, uma só (`negociacoesNoNovoModelo`): as contratadas
 * perguntam ao servidor (`segueONovoModelo`, com os pagamentos lidos), as
 * abertas pela data e pela marca de Trabalho CLYON (`eDoNovoModelo`). Recebe a
 * linha inteira: só com o id, um Trabalho CLYON aberto passava por modelo novo.
 * Antes da data é sempre `false`, sem ir à base. Se a leitura falhar, vale a
 * data: um pedido novo nasce no modelo de hoje.
 */
async function nasNovoModelo(
  linhas: ReadonlyArray<{ id?: unknown; estado?: unknown; ofertaClyon?: unknown }>,
): Promise<Set<number>> {
  const { novoModeloEmVigor } = await import("@/lib/novo-modelo");
  const { agoraDoModelo } = await import("@/lib/relogio-do-modelo");
  const agora = agoraDoModelo();
  if (!novoModeloEmVigor(agora) || linhas.length === 0) return new Set();
  const { negociacoesNoNovoModelo } = await import("@/lib/novo-modelo-no-servidor");
  return negociacoesNoNovoModelo(linhas, agora).catch(
    // A leitura falhou: vale a data, menos os Trabalhos CLYON.
    async () => {
      const { eDoNovoModelo } = await import("@/lib/novo-modelo");
      return new Set(linhas.filter((n) => eDoNovoModelo({ ofertaClyon: n.ofertaClyon }, agora)).map((n) => Number(n.id)));
    },
  );
}

/** d5 (21-11): os dados de pagamento do parceiro desta negociação estão por confirmar? Falha para «não» (o de antes). */
async function dadosPorConfirmarDe(negociacaoId: number): Promise<boolean> {
  try {
    const { negociacoesComDadosPorConfirmar } = await import("@/lib/dados-de-pagamento-por-confirmar-na-base");
    return (await negociacoesComDadosPorConfirmar([negociacaoId])).has(negociacaoId);
  } catch {
    return false;
  }
}

async function noNovoModelo(n: { id: number | string; estado?: unknown; ofertaClyon?: unknown }): Promise<boolean> {
  return (await nasNovoModelo([n])).has(Number(n.id));
}

/**
 * O PREÇO E A FRASE DO TOTAL de uma proposta ou de uma aceitação — d17
 * (13-11-2026). No modelo de 15-11, o total do pedido, do cartão e do email
 * (`totalAoClienteDaNegociacao`, pelo regime do parceiro) e quem passa a
 * fatura; antes, a conta de sempre.
 */
function oTotalDito(
  valor: number,
  taxas: Taxas,
  modelo: ModeloDoPreco,
  forma: FormaDePagamento,
  novoModelo: boolean,
  linha: LinhaDaVitoria | null,
  base: BaseDoPreco,
): { preco: number; totalDito: string } {
  const total = totalDaVitoria(linha, valor, novoModelo);
  if (total && linha) return { preco: total.total, totalDito: totalEmPalavrasDoNovoModelo(total, linha, base) };
  // d10: no modelo de 15-11 a forma escolhe-se no pedido (transferência, MB WAY ou dinheiro) — a frase não a supõe.
  const formaDaFrase: FormaDePagamento = novoModelo ? "na_plataforma" : forma;
  return {
    preco: precoParaOCliente(valor, taxas, modelo),
    totalDito: totalEmPalavras(valor, modelo, taxas, formaDaFrase, base),
  };
}

export async function aceitacaoParaOWhatsApp(dados: {
  telefone: string;
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  /** O valor do PROFISSIONAL — o preço do cliente faz-se cá dentro. */
  valor: number;
  /*
   * O REGIME DE IVA SAIU DAQUI — 01-10-2026. Era obrigatório para o total não
   * sair sem o imposto; desde 22-09-2026 não entrava em conta nenhuma, e o que
   * decide agora se o preço leva IVA é o modelo da negociação, lido da base
   * (`comoEstaNegociacaoSePaga`).
   */
  /** Obrigatória: esquecê-la era dizer «300 €» a um preço por carga. */
  base: BaseDoPreco;
}): Promise<boolean> {
  // O profissional aceitou o valor DO CLIENTE — falta só o cliente fechar.
  // Sem este aviso, o "sim" do profissional morria no painel: o cliente de
  // telefone propunha um valor e nunca sabia que tinha sido aceite.
  /*
   * d114 (25-11-2026): já não sai aqui, um a um. Diz-o a rotina das propostas,
   * numa mensagem curta («Boas notícias: o parceiro X aceitou os …»), logo que
   * pode, com a uma-por-dia e a janela das 9h às 20h. Ver `propostas-curtas.ts`.
   */
  const { A_ROTINA_DIZ_AS_PROPOSTAS } = await import("@/lib/propostas-curtas");
  if (A_ROTINA_DIZ_AS_PROPOSTAS) return false;
  const { chaveDaAceitacao } = await import("@/lib/assistente-automatico");
  const primeira = await podeContarPelaPrimeiraVez(
    chaveDaAceitacao(dados.negociacaoId, dados.valor),
    "pro_aceitou",
    dados,
    `${dados.profissionalNome} aceitou ${euros(dados.valor)}.`,
  );
  if (!primeira.podeFalar) return false;

  /*
   * O PREÇO DELE, um só — 29-09-2026. Os que ele propôs foram escritos já com
   * a taxa, e é isso que se lhe devolve: «aceitou os 300,00 €», e não os
   * 285,71 € do profissional com a taxa a ser somada a seguir.
   */
  const { taxas, forma, modelo, novoModelo, linha } = await comoEstaNegociacaoSePaga(dados.pedidoId, dados.negociacaoId);
  const { preco, totalDito } = oTotalDito(dados.valor, taxas, modelo, forma, novoModelo, linha, dados.base);
  const saiu = await enviarBotoesWhatsApp(
    dados.telefone,
    `Boas notícias: ${dados.profissionalNome} aceitou os ${precoComBase(euros(preco), dados.base)} ` +
      `que propôs para o pedido #${dados.pedidoId}.\n\n` +
      `${totalDito} ${ORCAMENTO_A_DISTANCIA}${comNotaDaCarga(dados.base)}\n\n` +
      /*
       * COMO E QUANDO PAGA, conforme a forma que escolheu — 29-09-2026. Dizia
       * a toda a gente «Só paga depois de o trabalho estar feito e
       * confirmado», e a quem paga pela plataforma chega a referência logo a
       * seguir a fechar. Ver `pagamento-na-plataforma.ts`.
       */
      `${promessaDaForma(forma, modelo, novoModelo).whatsappAntesDeAceitar} Falta só a sua confirmação para ficar combinado.`,
    [
      { id: `ct:${dados.pedidoId}:${dados.negociacaoId}`, titulo: tituloDeFechar(preco, dados.base) },
      { id: `rc:${dados.pedidoId}:${dados.negociacaoId}`, titulo: "Afinal não" },
    ],
  );
  return libertarSeNaoSaiu(primeira.id, saiu);
}

export async function propostaParaOWhatsApp(dados: {
  telefone: string;
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  valor: number;
  servico?: string | null;
  /* O regime de IVA saiu daqui a 01-10-2026 — ver `aceitacaoParaOWhatsApp`. */
  /** Obrigatória: esquecê-la era dizer «300 €» a um preço por carga. */
  base: BaseDoPreco;
}): Promise<boolean> {
  /*
   * A chave conta QUANTAS propostas já houve nesta negociação, e não a hora a
   * que a última foi feita. É a mesma conta que o observador faz do outro
   * lado, e não depende de relógios: uma data que o MySQL devolva com um
   * milissegundo de diferença dava duas chaves e duas mensagens.
   */
  /*
   * d114 (25-11-2026): a proposta nova já não sai aqui, uma a uma — eram três
   * mensagens compridas em 20 minutos à mesma cliente. Diz-a a rotina das
   * propostas (1 h depois da 1.ª, ou quando chega a 2.ª; depois, uma por dia).
   */
  const { A_ROTINA_DIZ_AS_PROPOSTAS } = await import("@/lib/propostas-curtas");
  if (A_ROTINA_DIZ_AS_PROPOSTAS) return false;
  const { chaveDaProposta } = await import("@/lib/assistente-automatico");
  const { linhas, taxas, forma, modelo, novoModelo, linha } = await comoEstaNegociacaoSePaga(
    dados.pedidoId,
    dados.negociacaoId,
  );
  const quantas = propostasDe(
    linhas.find((n) => Number(n.id) === dados.negociacaoId)?.propostasJson ?? null,
  ).length;

  /*
   * ZERO PROPOSTAS É IMPOSSÍVEL AQUI — logo, foi a leitura que falhou.
   *
   * Esta função corre DEPOIS de a proposta estar gravada: o array tem pelo
   * menos uma. Um zero só pode vir de a consulta ter falhado ou de a
   * negociação não ter sido encontrada, e nesse caso a chave sairia
   * `proposta:77:0` — uma chave que o observador NUNCA produz, porque ele
   * conta o que está lá. As duas não casavam, e o cliente recebia a mesma
   * proposta duas vezes: uma agora e outra dez minutos depois.
   *
   * Cala-se e deixa-se o trabalho ao cron, que daqui a minutos lê a negociação
   * outra vez e constrói a chave certa. Dez minutos de atraso numa altura em
   * que a base já está a falhar é melhor do que uma mensagem a dobrar.
   */
  if (quantas === 0) {
    console.error(
      `[assistente] não li as propostas da negociação #${dados.negociacaoId} — deixo o aviso ao cron`,
    );
    return false;
  }

  const primeira = await podeContarPelaPrimeiraVez(
    chaveDaProposta(dados.negociacaoId, quantas),
    "proposta_nova",
    dados,
    `${dados.profissionalNome} propôs ${precoComBase(euros(dados.valor), dados.base)}.`,
  );
  if (!primeira.podeFalar) return false;

  /*
   * O PREÇO DELE, já com a taxa — 29-09-2026. «Fulano propõe 350 €» e, na
   * frase de baixo, «com a taxa CLYON fica em 367,50 €» eram dois números
   * para uma proposta. Agora a proposta chega-lhe como ele a paga.
   */
  const { preco, totalDito } = oTotalDito(dados.valor, taxas, modelo, forma, novoModelo, linha, dados.base);
  /*
   * O SERVIÇO EM PALAVRAS, e não o identificador da base.
   *
   * Saía «(recolha_moveis)» — linguagem de motor a escapar-se para a frente
   * de quem não a devia ver, com o traço baixo e tudo.
   *
   * E com o artigo já lá dentro. Escrevia-se `a sua ${etiqueta}` à mão, sobre
   * uma lista onde três das dez são masculinas: uma cliente leu «propõe
   * 148,57 € para a sua outro serviço». A frase vem feita de
   * `servico-em-palavras.ts`, onde não há concordância nenhuma para calcular
   * — logo não há nenhuma para errar.
   */
  const servico = oSeuServico(dados.servico);
  const saiu = await enviarBotoesWhatsApp(
    dados.telefone,
    `${dados.profissionalNome} propõe ${precoComBase(euros(preco), dados.base)} ` +
      `para ${servico} (pedido #${dados.pedidoId}).\n\n` +
      `${totalDito} ${ORCAMENTO_A_DISTANCIA}${comNotaDaCarga(dados.base)}\n\n` +
      // Como e quando paga, conforme a forma que escolheu. Ver `pagamento-na-plataforma.ts`.
      `${promessaDaForma(forma, modelo, novoModelo).whatsappAntesDeAceitar} Diga-me se lhe serve, ou responda com o valor que gostaria de pagar${comIvaNaResposta(modelo)}.`,
    [
      { id: `ct:${dados.pedidoId}:${dados.negociacaoId}`, titulo: tituloDeFechar(preco, dados.base) },
      { id: `rc:${dados.pedidoId}:${dados.negociacaoId}`, titulo: "Recusar" },
    ],
  );
  return libertarSeNaoSaiu(primeira.id, saiu);
}
