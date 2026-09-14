import {
  getPool,
  getSimulatorOrderById,
  negociacoesDoPedido,
  gravarNegociacao,
  encerrarOutrasNegociacoes,
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
import { contaDoCliente, regimeDeIva } from "@/lib/taxas-plataforma";
import {
  enviarBotoesWhatsApp,
  enviarTextoWhatsApp,
  paraTeclado,
  telefoneParaWhatsApp,
} from "@/lib/whatsapp-cloud";
import { oSeuServico } from "@/lib/servico-em-palavras";
import { totalEmPalavras } from "@/lib/conta-em-palavras";
import { avisarDaProposta } from "@/lib/avisar-da-proposta";
import { euros, textoDaMesa, type LinhaDaMesa } from "@/lib/texto-da-mesa";
import { jaFoiDito } from "@/lib/nao-repetir";
import { lerARespostaDirecta, jaSeLeSemModelo } from "@/lib/ler-a-resposta";

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
export async function recolherPedidoPorWhatsApp(telefone: string, texto: string): Promise<void> {
  const {
    recolhaWhatsApp,
    guardarRecolhaWhatsApp,
    apagarRecolhaWhatsApp,
    interromperNumeroWhatsApp,
  } = await import("@/lib/db");
  const {
    responderNaRecolha,
    responderComCompreensao,
    perguntaPendente,
    recolhaNova,
    perguntaDo,
    mensagemDePedidoRegistado,
  } = await import("@/lib/whatsapp-recolha");
  const { compreender, compreensaoDisponivel } = await import("@/lib/whatsapp-compreensao");

  const guardada = await recolhaWhatsApp(telefone);
  const paradaHaMuito =
    guardada != null && Date.now() - new Date(guardada.actualizadoEm).getTime() > 24 * 3600_000;
  // Já tem pedido registado por aqui mas o pedido deixou de estar activo
  // (concluído, cancelado): começa-se outro. Uma recolha velha também.
  type Estado = Parameters<typeof responderNaRecolha>[0];
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
  const responder = async (e: Estado) => {
    /*
     * A PERGUNTA VAI COM A MENSAGEM.
     *
     * Sem ela o modelo lê «Não preciso» a flutuar no vazio e casa-a com o
     * exemplo de desistir — foi assim que a recolha de uma cliente
     * desapareceu inteira. E o TEXTO CRU vai para a função pura, que sem ele
     * não tinha como cair no caminho antigo quando o modelo não percebe.
     */
    const pendente = perguntaPendente(e.passo, e.dados as never);
    const c = await compreender(texto, e.dados as Record<string, unknown>, agora, pendente);
    return c
      ? responderComCompreensao(e, c, agora, { texto })
      : responderNaRecolha(e, texto, agora);
  };

  if (!estado) {
    // Primeira mensagem: se já diz o serviço, aproveita-se; senão, pergunta-se.
    const novo = recolhaNova();
    const r = await responder(novo);
    const avancou = r.estado.passo !== "servico";
    if (avancou && !r.pedirPessoa && !r.desistir) {
      await guardarRecolhaWhatsApp(telefone, r.estado.passo, r.estado.dados);
      await enviarTextoWhatsApp(telefone, r.resposta);
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
      await interromperNumeroWhatsApp(telefone, "Pediu para falar com uma pessoa");
    } else {
      await guardarRecolhaWhatsApp(telefone, "servico", {});
      await enviarTextoWhatsApp(telefone, perguntaDo("servico", {}, !compreensaoDisponivel()));
    }
    return;
  }

  const r = await responder(estado);

  if (r.pedirPessoa) {
    // Falar primeiro — ver a nota acima: o portão engole o que sair depois.
    await enviarTextoWhatsApp(telefone, r.resposta);
    await interromperNumeroWhatsApp(telefone, "Pediu para falar com uma pessoa");
    return;
  }
  if (r.desistir) {
    await apagarRecolhaWhatsApp(telefone);
    await enviarTextoWhatsApp(telefone, r.resposta);
    return;
  }
  if (r.registar) {
    const { registarPedidoDaRecolha } = await import("@/lib/registar-pedido-por-whatsapp");
    try {
      const { id } = await registarPedidoDaRecolha(telefone, r.estado.dados);
      const { getPool } = await import("@/lib/db");
      const pool = await getPool();
      if (pool) {
        await pool
          .execute("UPDATE whatsappRecolhas SET pedidoId = ? WHERE RIGHT(telefone, 9) = RIGHT(?, 9)", [
            id,
            telefoneParaWhatsApp(telefone),
          ])
          .catch(() => {});
      }
      await enviarTextoWhatsApp(telefone, mensagemDePedidoRegistado(id, false));
    } catch (e) {
      console.error("[whatsapp/recolha] não registou o pedido:", e);
      // A pessoa não pode ficar sem resposta: entrega-se a uma pessoa da CLYON.
      // Falar primeiro — ver a nota acima: o portão engole o que sair depois.
      await enviarTextoWhatsApp(
        telefone,
        "Tenho aqui tudo o que me disse, mas não consegui registar sozinho. Uma pessoa da CLYON vai tratar disto e responde-lhe por aqui.",
      );
      await interromperNumeroWhatsApp(telefone, "O registo automático falhou — ver a conversa");
    }
    return;
  }

  await guardarRecolhaWhatsApp(telefone, r.estado.passo, r.estado.dados);
  await enviarTextoWhatsApp(telefone, r.resposta);
}

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

type Alvo = {
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  /** O regime de quem factura: decide se o total leva IVA por cima. */
  regimeIva: string | null;
  estado: Negociacao;
};

async function alvoDe(pedidoId: number, negociacaoId: number): Promise<Alvo | null> {
  const linhas = await negociacoesDoPedido(pedidoId);
  const n = linhas.find((x) => Number(x.id) === negociacaoId);
  if (!n) return null;
  return {
    pedidoId,
    regimeIva: n.regimeIva ?? null,
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
async function passarAUmaPessoa(telefone: string, porque: string): Promise<void> {
  const { interromperNumeroWhatsApp } = await import("@/lib/db");
  await enviarTextoWhatsApp(
    telefone,
    "Percebi o que me disse. Vou passar isto a um colega para confirmar tudo consigo, e ele fala-lhe já de seguida.",
  );
  await interromperNumeroWhatsApp(telefone, porque).catch(() => {});
}

/**
 * Fechar pelo cliente: as duas metades do aperto de mão — aceitar o valor
 * pendente (se o houver) e contratar. É o mesmo caminho do botão «Fechar» e
 * da palavra SIM: um só corpo, para nunca haver dois comportamentos.
 */
async function fecharPeloCliente(telefone: string, alvo: Alvo): Promise<void> {
  const {
    assistentePode,
    reservarAvisoDoAssistente,
    guardarTextoDoAviso,
    guardarDesfazerDoAviso,
    fecharAvisoDoAssistente,
  } = await import("@/lib/db");

  if (!(await assistentePode("fechar"))) {
    await passarAUmaPessoa(telefone, "Fechar desligado - quis avancar");
    return;
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
  const r2 = contratar(estado, agora);
  if (!r2.ok) {
    await enviarTextoWhatsApp(telefone, `Não deu para fechar: ${r2.erro}`);
    return;
  }
  await gravarNegociacao(alvo.negociacaoId, {
    estado: r2.negociacao.estado,
    valorAcordado: r2.negociacao.valorAcordado ?? null,
    propostasJson: JSON.stringify(r2.negociacao.propostas),
  });
  const encerradas = await encerrarOutrasNegociacoes(alvo.pedidoId, alvo.negociacaoId);
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
  // O TOTAL, com o IVA de quem factura ja somado. O valor acordado e a base a
  // partir de 29-08-2026, e mandar-lhe so a base por mensagem era prometer-lhe
  // um numero que ele nao ia pagar.
  const conta = contaDoCliente(valor, regimeDeIva(alvo.regimeIva));
  await enviarTextoWhatsApp(
    telefone,
    `Fechado com ${alvo.profissionalNome} por ${euros(valor)} sem IVA (total a pagar: ${euros(conta.total)}).\n\n` +
      `O profissional recebeu a morada e o seu contacto. Se já tem data pensada, responda por exemplo: 27/08 14:30 — fica logo marcada.`,
  );
}

/** Recusar pelo cliente — o corpo do botão «Recusar» e da palavra NÃO. */
async function recusarPeloCliente(telefone: string, alvo: Alvo): Promise<void> {
  const { assistentePode } = await import("@/lib/db");
  if (!(await assistentePode("fechar"))) {
    await passarAUmaPessoa(telefone, "Fechar desligado - quis recusar");
    return;
  }
  const r = desistir(alvo.estado, "cliente", new Date());
  if (!r.ok) {
    await enviarTextoWhatsApp(telefone, `Não deu para recusar: ${r.erro}`);
    return;
  }
  await gravarNegociacao(alvo.negociacaoId, {
    estado: r.negociacao.estado,
    valorAcordado: r.negociacao.valorAcordado ?? null,
    propostasJson: JSON.stringify(r.negociacao.propostas),
  });
  await registarAccao(
    alvo.pedidoId,
    alvo.negociacaoId,
    `Cliente recusou a proposta de ${alvo.profissionalNome} por WhatsApp — negociação #${alvo.negociacaoId}.`,
    "negociacao_desistida",
    "assistente",
  );
  await enviarTextoWhatsApp(
    telefone,
    `Certo — a proposta de ${alvo.profissionalNome} foi recusada. As outras continuam de pé.`,
  );
}

type AlvoComValor = Alvo & { valorNaMesa: number | null };

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
  accao: "fechar" | "recusar" | "contrapropor" | "marcar" | "falar_com_pessoa" | "agradecer" | "nada" | null;
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
  const lido = await compreenderResposta(
    original,
    alvos.map((a) => ({ profissional: a.profissionalNome, valor: a.valorNaMesa })),
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
  const valor = lido.valor ?? porNome?.valorNaMesa ?? null;

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
  for (const pedidoId of pedidos) {
    const linhas = await negociacoesDoPedido(pedidoId);
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
      lista.push({
        pedidoId,
        negociacaoId: Number(n.id),
        profissionalNome: n.profissionalNome,
        regimeIva: n.regimeIva ?? null,
        estado: {
          estado: n.estado as Negociacao["estado"],
          valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
          propostas,
        },
        valorNaMesa,
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
  const { mensagensDoNumeroWhatsApp } = await import("@/lib/db");
  const gravadas = await mensagensDoNumeroWhatsApp(telefone, 20).catch(() => []);
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

/** O "ecrã" — o estado das negociações dele, reescrito em texto. */
async function ecraDoPedido(pedidoId: number): Promise<string> {
  const pedido = await getSimulatorOrderById(pedidoId);
  const linhas = await negociacoesDoPedido(pedidoId);
  const vivas = linhas.filter((n) => n.estado !== "morta" && n.estado !== "desistida");
  if (vivas.length === 0) {
    return `Pedido #${pedidoId}: ainda à espera de propostas dos profissionais. Avisamos assim que chegarem.`;
  }
  const acordada = vivas.find((n) => n.estado === "acordada");
  if (acordada) {
    const total = contaDoCliente(
      Number(acordada.valorAcordado ?? 0),
      regimeDeIva(acordada.regimeIva),
    ).total;
    return (
      `Pedido #${pedidoId}: fechado com ${acordada.profissionalNome} por ${euros(Number(acordada.valorAcordado ?? 0))} sem IVA ` +
      `(total a pagar: ${euros(total)}).` +
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
      valor: Number(valor),
      aSuaEspera: ultima?.por === "profissional" && ultima.estado === "pendente",
    });
  }
  return textoDaMesa(pedidoId, propostas, aVer);
}

/**
 * Trata UMA mensagem do cliente. Devolve sempre — as respostas seguem por
 * WhatsApp; quem chama só precisa de saber que foi tratada.
 */
export async function tratarMensagemDoCliente(
  telefone: string,
  conteudo: { tipo: "botao"; id: string } | { tipo: "texto"; texto: string },
): Promise<void> {
  // O painel manda primeiro: desligado, bloqueado ou entregue a uma pessoa,
  // o cérebro não diz UMA palavra — nem sequer a de "não o conheço".
  const { podeOWhatsAppFalarCom } = await import("@/lib/db");
  if (!(await podeOWhatsAppFalarCom(telefone))) return;

  const pedidos = await pedidosDoTelefone(telefone);
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
    const { assistentePode } = await import("@/lib/db");
    if (!(await assistentePode("recolher"))) return;
    if (conteudo.tipo === "texto") await recolherPedidoPorWhatsApp(telefone, conteudo.texto);
    return;
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
    await passarAUmaPessoa(telefone, "Pediu para falar com uma pessoa");
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
  /** O nome que ele disse, seja em que forma for. Casa-se lá dentro. */
  const pistaDeNome = nomeEValor?.nome ?? simNome?.nome ?? naoNome?.nome ?? null;

  if (
    simSo ||
    naoSo ||
    simValor != null ||
    naoValor != null ||
    nomeEValor ||
    simNome ||
    naoNome
  ) {
    /*
     * SÓ QUEM PÔS UM NÚMERO NA MESA PODE SER ESCOLHIDO POR UM NÚMERO.
     *
     * Um alvo sem valor não se fecha nem se recusa por valor, e listá-lo era
     * outra forma de dizer ao cliente quem ainda não lhe respondeu.
     */
    const alvos = (await alvosAccionaveis(pedidos)).filter((a) => a.valorNaMesa != null);
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
      `• ${variosPedidos ? `Pedido #${a.pedidoId} — ` : ""}${a.profissionalNome}: ${euros(a.valorNaMesa as number)}`;
    const listaDeAlvos = () => alvos.map(linhaDoAlvo).join("\n");

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
        `Disse «${pistaDeNome}» e isso bate em ${porPista.length} profissionais — nao dá para saber qual`,
      );
      return;
    }

    if (alvo) {
      if (eDeFechar) await fecharPeloCliente(telefone, alvo);
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
        .filter((a) => Math.abs((a.valorNaMesa as number) - valorPedido) < 0.005)
        .filter((a) => !pistaDeNome || porPista.includes(a));
      if (casam.length > 1) {
        await passarAUmaPessoa(
          telefone,
          `${casam.length} propostas de ${euros(valorPedido)} em pedidos diferentes (${casam
            .map((a) => `#${a.pedidoId}`)
            .join(", ")}) — nao dá para saber qual quer fechar`,
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
      const exemplo = euros(alvos[0].valorNaMesa as number).replace(" €", "");
      await enviarTextoWhatsApp(
        telefone,
        `Tem ${alvos.length} propostas em cima da mesa:\n${listaDeAlvos()}\n\n` +
          `Diga qual pelo valor — por exemplo: ${eDeFechar ? "fechar" : "recusar"} ${exemplo}`,
      );
      return;
    }

    if (alvo) {
      if (eDeFechar) await fecharPeloCliente(telefone, alvo);
      else await recusarPeloCliente(telefone, alvo);
      return;
    }
  }

  // Data: dd/mm hh:mm (ano opcional). Só faz sentido com trabalho fechado.
  const data = texto.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\s+(\d{1,2})[:hH](\d{2})?$/);
  if (data) {
    const [, dia, mes, anoStr, hora, minuto] = data;
    const agora = new Date();
    const ano = anoStr ? Number(anoStr.length === 2 ? `20${anoStr}` : anoStr) : agora.getFullYear();
    const d = new Date(ano, Number(mes) - 1, Number(dia), Number(hora), Number(minuto ?? 0));
    // Sem ano e já passou? É do ano que vem — ninguém marca para trás.
    if (!anoStr && d.getTime() < agora.getTime() - 3600_000) d.setFullYear(ano + 1);
    if (Number.isNaN(d.getTime()) || d.getTime() < agora.getTime() - 3600_000) {
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
          `Cliente marcou ${d.toLocaleString("pt-PT")} por WhatsApp.`,
        );
        await enviarTextoWhatsApp(
          telefone,
          `Marcado: ${d.toLocaleDateString("pt-PT")} às ${d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}, com ${acordada.profissionalNome}. Ele vê a data na agenda dele.`,
        );
        return;
      }
    }
    await enviarTextoWhatsApp(
      telefone,
      "Ainda não há profissional contratado — escolha primeiro uma proposta, e depois mando-lhe marcar a data.",
    );
    return;
  }

  // Valor: contraproposta. Aplica-se à negociação mais recente que a espera.
  const valorTexto = texto.match(/^(?:aceito\s+|aceitar\s+|proponho\s+|contraproponho\s+|fechar\s+|sim\s+)?(\d{1,4})(?:[.,](\d{1,2}))?\s*€?$/i);
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
      await passarAUmaPessoa(telefone, "Fechar desligado - propos um valor");
      return;
    }
    const valor = Number(`${valorTexto[1]}.${valorTexto[2] ?? "0"}`);
    for (const pedidoId of pedidos) {
      const linhas = await negociacoesDoPedido(pedidoId);
      const candidatas = linhas
        .filter((n) => n.estado === "aberta" || n.estado === "aguarda_contratacao")
        .sort(
          (a, b) =>
            new Date(String((b as { updatedAt?: unknown }).updatedAt ?? 0)).getTime() -
            new Date(String((a as { updatedAt?: unknown }).updatedAt ?? 0)).getTime(),
        );
      for (const n of candidatas) {
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
        await registarAccao(
          pedidoId,
          Number(n.id),
          `Cliente contrapropôs ${euros(valor)} a ${n.profissionalNome} por WhatsApp.`,
        );
        // O profissional é avisado pelo caminho de sempre — email e painel.
        await avisarDaProposta({
          pedidoId,
          negociacaoId: Number(n.id),
          quemPropos: "cliente",
          valor,
        });
        await enviarTextoWhatsApp(
          telefone,
          `Contraproposta de ${euros(valor)} enviada a ${n.profissionalNome}. Escrevo-lhe assim que ele responder.`,
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
    await enviarTextoWhatsApp(
      telefone,
      "Está tudo a andar deste lado. Assim que houver novidades, sou eu a escrever-lhe.",
    );
    return;
  }
  await mandarOEcra(telefone, pendentes[0].pedidoId);
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
 * media) e só para números com pedido activo — uma foto de um desconhecido
 * não se guarda: não é nossa para guardar.
 */
export async function tratarFotoDoCliente(
  telefone: string,
  mediaId: string,
  mime: string | null,
): Promise<void> {
  const { podeOWhatsAppFalarCom } = await import("@/lib/db");
  if (!(await podeOWhatsAppFalarCom(telefone))) return;
  if (!process.env.WHATSAPP_TOKEN) return;

  const pedidos = await pedidosDoTelefone(telefone);
  if (pedidos.length === 0) return;

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
 * Os bytes de uma fotografia do cliente, para o pedido dele — Blob →
 * filesJson → histórico. Serve a API da Meta (que os descarrega acima) e a
 * ponte (que os traz já descarregados do WhatsApp Web).
 */
export async function guardarFotoDoClienteNoPedido(
  telefone: string,
  bytes: Buffer,
  mime: string | null,
): Promise<void> {
  const { podeOWhatsAppFalarCom } = await import("@/lib/db");
  if (!(await podeOWhatsAppFalarCom(telefone))) return;
  const pedidos = await pedidosDoTelefone(telefone);
  if (pedidos.length === 0) return;
  const pedidoId = pedidos[0];

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

    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return;
    let ficheiros: unknown[] = [];
    try {
      const lidos = JSON.parse(pedido.filesJson ?? "[]");
      if (Array.isArray(lidos)) ficheiros = lidos;
    } catch {
      /* filesJson ilegível: recomeça a lista em vez de perder a foto nova */
    }
    ficheiros.push({ url: blob.url, name: nome, size: bytes.length, type: tipo });
    await updateSimulatorOrder(
      pedidoId,
      { filesJson: JSON.stringify(ficheiros) } as unknown as Parameters<
        typeof updateSimulatorOrder
      >[1],
    );
    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message: "Cliente enviou uma fotografia por WhatsApp — anexada ao pedido.",
    });
    await enviarTextoWhatsApp(
      telefone,
      `Recebi a fotografia — ficou anexada ao pedido #${pedidoId}.`,
    );
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

export async function aceitacaoParaOWhatsApp(dados: {
  telefone: string;
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  valor: number;
  /**
   * O regime de IVA de quem factura -- OBRIGATORIO de proposito.
   *
   * Deixa-lo opcional daria "isento" a quem esquecesse de o passar, e uma
   * mensagem a prometer 371 EUR de um trabalho que custa 451,50 EUR. Sendo
   * obrigatorio, o compilador nao deixa ninguem esquecer-se.
   */
  regimeIva: string | null;
}): Promise<boolean> {
  // O profissional aceitou o valor DO CLIENTE — falta só o cliente fechar.
  // Sem este aviso, o "sim" do profissional morria no painel: o cliente de
  // telefone propunha um valor e nunca sabia que tinha sido aceite.
  const { chaveDaAceitacao } = await import("@/lib/assistente-automatico");
  const primeira = await podeContarPelaPrimeiraVez(
    chaveDaAceitacao(dados.negociacaoId, dados.valor),
    "pro_aceitou",
    dados,
    `${dados.profissionalNome} aceitou ${euros(dados.valor)}.`,
  );
  if (!primeira.podeFalar) return false;

  const totalDito = totalEmPalavras(dados.valor, dados.regimeIva);
  const saiu = await enviarBotoesWhatsApp(
    dados.telefone,
    `Boas notícias: ${dados.profissionalNome} aceitou os ${euros(dados.valor)} que propôs para o pedido #${dados.pedidoId}.\n\n` +
      `${totalDito} Só paga depois de o trabalho estar feito e confirmado.\n\n` +
      `Falta só a sua confirmação para ficar combinado.`,
    [
      { id: `ct:${dados.pedidoId}:${dados.negociacaoId}`, titulo: `Fechar ${Math.round(dados.valor)} €` },
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
  /**
   * O regime de IVA de quem factura -- OBRIGATORIO de proposito.
   *
   * Deixa-lo opcional daria "isento" a quem esquecesse de o passar, e uma
   * mensagem a prometer 371 EUR de um trabalho que custa 451,50 EUR. Sendo
   * obrigatorio, o compilador nao deixa ninguem esquecer-se.
   */
  regimeIva: string | null;
}): Promise<boolean> {
  /*
   * A chave conta QUANTAS propostas já houve nesta negociação, e não a hora a
   * que a última foi feita. É a mesma conta que o observador faz do outro
   * lado, e não depende de relógios: uma data que o MySQL devolva com um
   * milissegundo de diferença dava duas chaves e duas mensagens.
   */
  const { chaveDaProposta } = await import("@/lib/assistente-automatico");
  const linhas = await negociacoesDoPedido(dados.pedidoId).catch(() => []);
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
    `${dados.profissionalNome} propôs ${euros(dados.valor)}.`,
  );
  if (!primeira.podeFalar) return false;

  const totalDito = totalEmPalavras(dados.valor, dados.regimeIva);
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
    `${dados.profissionalNome} propõe ${euros(dados.valor)} para ${servico} (pedido #${dados.pedidoId}).\n\n` +
      `${totalDito} Só paga depois de o trabalho estar feito e confirmado.\n\n` +
      `Diga-me se lhe serve, ou responda com o valor que gostaria de pagar.`,
    [
      { id: `ct:${dados.pedidoId}:${dados.negociacaoId}`, titulo: `Fechar ${Math.round(dados.valor)} €` },
      { id: `rc:${dados.pedidoId}:${dados.negociacaoId}`, titulo: "Recusar" },
    ],
  );
  return libertarSeNaoSaiu(primeira.id, saiu);
}
