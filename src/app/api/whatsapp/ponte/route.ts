import { NextRequest, NextResponse, after } from "next/server";
import crypto from "node:crypto";
import {
  filaWhatsAppParaAPonte,
  interromperNumeroWhatsApp,
  marcarFilaWhatsAppEnviadas,
  carimbarPonte,
  numeroBloqueadoWhatsApp,
  numeroInterrompidoWhatsApp,
  whatsappLigado,
} from "@/lib/db";
import { ponteConfigurada } from "@/lib/whatsapp-cloud";
import { pedidosDoTelefone, tratarMensagemDoCliente } from "@/lib/whatsapp-negociacao";
import { ePedidoParaParar } from "@/lib/aviso-de-pedido-ao-profissional";
import {
  MARCA_DE_AUDIO,
  MARCA_DE_FOTOGRAFIA,
  MARCA_DE_FOTOGRAFIA_FALHADA,
  MARCA_DE_MAO,
  MARCA_DE_VIDEO,
} from "@/lib/rajada-do-whatsapp";

export const runtime = "nodejs";
/*
 * Cabe a espera da rajada (8 s), o modelo, a base e a vez na tranca.
 *
 * Mais do que os 30 s que a ponte espera por nós, DE PROPÓSITO: se a ponte
 * desistir de esperar, a resposta não se perde — fica na fila de saída, e a
 * ronda seguinte da ponte (de poucos em poucos segundos) vai buscá-la. O que
 * não pode acontecer é a Vercel matar a função a meio de a escrever.
 */
export const maxDuration = 60;

/**
 * RESPONDER UMA VEZ POR RAJADA, e não uma vez por mensagem.
 *
 * *«Não repita pergunta, e saiba o contexto da conversa.»* — 29-09-2026.
 * Ver `rajada-do-whatsapp.ts` para o porquê inteiro. Em resumo: a ponte
 * entrega as mensagens de quem escreve em vários bocados TODAS AO MESMO TEMPO,
 * e cada uma punha o assistente a correr sem ver as outras.
 *
 * Três passos:
 *   1. ESPERA — deixa a pessoa acabar de escrever;
 *   2. CEDE — se entretanto chegou outra mensagem, é essa que responde;
 *   3. TRANCA — a que responde lê tudo o que entrou desde a nossa última
 *      resposta como UMA mensagem, com o número trancado, para duas execuções
 *      nunca responderem por cima uma da outra.
 *
 * Sem id (a base falhou a gravar), responde-se como antes, à mensagem sozinha:
 * uma resposta menos esperta é melhor do que nenhuma.
 */
async function responderARajada(telefone: string, minhaId: number | null, texto: string) {
  if (minhaId == null) {
    await tratarMensagemDoCliente(telefone, { tipo: "texto", texto });
    return;
  }
  const { mensagensComIdDoNumeroWhatsApp, comTrancaDoNumeroWhatsApp } = await import("@/lib/db");
  const {
    JANELA_DA_RAJADA_MS,
    ESPERA_DAS_IMAGENS_MS,
    eAUltimaDaRajada,
    textoDaRajada,
    imagensDaRajada,
    oQueSeViuNaRajada,
    esperaPorQuemEscreveEmPartes,
    ultimaMensagemLida,
    videosDaRajada,
  } = await import("@/lib/rajada-do-whatsapp");

  await new Promise((r) => setTimeout(r, JANELA_DA_RAJADA_MS));

  const depoisDaEspera = await mensagensComIdDoNumeroWhatsApp(telefone, 40).catch(() => []);
  if (depoisDaEspera.length > 0 && !eAUltimaDaRajada(minhaId, depoisDaEspera)) return;

  // Só imagens, até agora: dá-se tempo à legenda ou à morada que costuma vir
  // logo a seguir — ver `ESPERA_DAS_IMAGENS_MS`.
  if (depoisDaEspera.length > 0 && !textoDaRajada(depoisDaEspera).trim() && imagensDaRajada(depoisDaEspera) > 0) {
    await new Promise((r) => setTimeout(r, ESPERA_DAS_IMAGENS_MS));
    const depoisDasImagens = await mensagensComIdDoNumeroWhatsApp(telefone, 40).catch(() => []);
    if (depoisDasImagens.length > 0 && !eAUltimaDaRajada(minhaId, depoisDasImagens)) return;
  } else if (depoisDaEspera.length > 0) {
    /*
     * A RESPOSTA A MEIO ESPERA MAIS UM BOCADO — 27-10-2026 (decisão d2). O
     * código postal sem a localidade, a rua sem o código postal: a outra
     * metade costuma vir logo a seguir. Ver `esperaPorQuemEscreveEmPartes`.
     */
    const mais = esperaPorQuemEscreveEmPartes(depoisDaEspera);
    if (mais > 0) {
      await new Promise((r) => setTimeout(r, mais));
      const depoisDeMais = await mensagensComIdDoNumeroWhatsApp(telefone, 40).catch(() => []);
      if (depoisDeMais.length > 0 && !eAUltimaDaRajada(minhaId, depoisDeMais)) return;
    }
  }

  let respondida = false;
  // d92: quem respondeu — as regras, o agente (a «conversa livre») ou o código (o SIM / o CANCELAR ao agente).
  let quemRespondeu: "regras" | "agente" | "codigo" = "regras";
  await comTrancaDoNumeroWhatsApp(telefone, async () => {
    // Relido DENTRO da tranca: quem a teve antes pode ter respondido a parte
    // disto, e o que já teve resposta não se responde outra vez.
    const agora = await mensagensComIdDoNumeroWhatsApp(telefone, 40).catch(() => []);
    const junto = agora.length > 0 ? textoDaRajada(agora) : texto;
    // As imagens também se respondem — com um «Obrigada pelas imagens!»
    // (20-10-2026). Sem texto e sem imagens não há nada a que responder.
    const imagens = agora.length > 0 ? imagensDaRajada(agora) : 0;
    if (!junto.trim() && imagens === 0) return;
    // E o que se viu nelas (21-10-2026) — ver `verEAnotarAFotografia`.
    const visto = agora.length > 0 ? oQueSeViuNaRajada(agora) : [];
    // Os vídeos, para a nota do pedido de quem já o tem (27-10-2026).
    const videos = agora.length > 0 ? videosDaRajada(agora) : 0;
    /*
     * E A PERGUNTA QUE JÁ NÃO SERVE CALA-SE (27-10-2026, decisão d2): se ele
     * escrever outra vez enquanto isto corre, quem pergunta é a execução da
     * mensagem nova — ver `rajada-em-curso.ts`.
     */
    const { dentroDaRajada } = await import("@/lib/rajada-em-curso");
    /*
     * A VITÓRIA AGENTE A SÉRIO — d92 (23-11-2026). Com «Vitória agente —
     * conversa livre» ligado (DESLIGADO por omissão), a resposta do agente é a
     * que sai (quem já tem pedido, fora da recolha e das respostas que o
     * código lê); as regras ficam de rede de segurança. Desligado, respondem
     * as regras, como sempre. Ver `vitoria-agente/ao-vivo.ts`.
     */
    const { responderAoClienteAoVivo } = await import("@/lib/vitoria-agente/ao-vivo-na-base");
    await dentroDaRajada({ telefone, ultimaLida: ultimaMensagemLida(agora) }, async () => {
      quemRespondeu = await responderAoClienteAoVivo(telefone, { tipo: "texto", texto: junto, imagens, visto, videos }, () =>
        tratarMensagemDoCliente(telefone, { tipo: "texto", texto: junto, imagens, visto, videos }),
      );
    });
    respondida = true;
  });
  /*
   * O ENSAIO EM SOMBRA DA VITÓRIA AGENTE — d85, fase 0 (22-11-2026). Depois
   * de as regras de hoje responderem, e fora da tranca: com o interruptor
   * «Vitória agente — ensaio» ligado (DESLIGADO por omissão), o agente lê a
   * mesma conversa, sem dados de pessoas, e grava o que teria dito e feito.
   * NUNCA envia. Desligado, sem chave ou com o tecto passado, não chama nada.
   */
  // O ensaio só quando responderam as regras (o que o agente disse a sério já ficou no painel).
  if (respondida && quemRespondeu === "regras") {
    after(async () => {
      const { ensaioEmSombra } = await import("@/lib/vitoria-agente/na-base");
      await ensaioEmSombra(telefone).catch(() => undefined);
    });
  }
}

/**
 * A FOTOGRAFIA QUE NÃO ABRIU FICA PARA A EQUIPA — 18-11-2026 (continuação da
 * d57). Até aqui pedia-se ao cliente para a reenviar (d34, d57); a 18-11 a
 * ponte deixou de descarregar TODAS as fotografias, e cada cliente ouviu o
 * pedido e reenviou a mesma fotografia, que voltou a falhar. A Vitória nunca
 * mais pede ao cliente para reenviar uma fotografia: a conversa fica guardada
 * com a nota `NOTA_DA_FOTOGRAFIA_NO_TELEMOVEL` (separador «Guardadas» da
 * Mesa) e a equipa vê-a no telemóvel. Nunca atira: a marca já está no fio.
 */
async function deixarAFotografiaParaAEquipa(telefone: string): Promise<void> {
  try {
    const { anotarFotografiaNoTelemovelWhatsApp } = await import("@/lib/db");
    const { NOTA_DA_FOTOGRAFIA_NO_TELEMOVEL } = await import("@/lib/rajada-do-whatsapp");
    await anotarFotografiaNoTelemovelWhatsApp(telefone, NOTA_DA_FOTOGRAFIA_NO_TELEMOVEL);
  } catch (e) {
    console.error("[ponte] não anotei a fotografia para a equipa:", e instanceof Error ? e.message : e);
  }
}

/**
 * A VITÓRIA VÊ A FOTOGRAFIA — 21-10-2026.
 *
 * O dono quis que ela visse o que está nas imagens, e não só que elas
 * chegaram. O Gemini diz numa frase o que é para levar (`whatsapp-imagem.ts`)
 * e a frase fica no fio, a seguir à marca da fotografia — é de lá que a
 * rajada a lê.
 *
 * Só para quem ainda não tem pedido, com a recolha ligada, e só as primeiras
 * de cada rajada: cada fotografia vista é uma chamada paga ao modelo. Nunca
 * atira — a fotografia conta na mesma, sem a frase.
 */
async function verEAnotarAFotografia(
  telefone: string,
  id: number | null,
  base64: string,
  mime: string,
  temPedido: boolean,
): Promise<void> {
  if (id == null || temPedido) return;
  try {
    const { assistentePode, mensagensComIdDoNumeroWhatsApp, anotarOQueSeViuNaFotografiaWhatsApp } = await import(
      "@/lib/db"
    );
    if (!(await assistentePode("recolher"))) return;
    const { imagensDaRajada } = await import("@/lib/rajada-do-whatsapp");
    const { verAImagem, IMAGENS_VISTAS_POR_RAJADA } = await import("@/lib/whatsapp-imagem");
    const fio = await mensagensComIdDoNumeroWhatsApp(telefone, 40);
    if (imagensDaRajada(fio) > IMAGENS_VISTAS_POR_RAJADA) return;
    const visto = await verAImagem(base64, mime);
    if (visto) await anotarOQueSeViuNaFotografiaWhatsApp(id, visto);
  } catch (e) {
    console.error("[ponte] não vi a fotografia:", e instanceof Error ? e.message : e);
  }
}

/**
 * A ponte do Winapp — o WhatsApp emparelhado no PC a falar com o cérebro daqui.
 *
 * O servidor não chega ao PC (não tem endereço público): é o Winapp que vem
 * cá, com um segredo partilhado no cabeçalho. Três verbos:
 *
 *   POST  {telefone, texto} — chegou uma mensagem. O cérebro trata-a e a
 *         resposta fica na fila; devolve-se {meu: true} e o que houver para
 *         enviar. Com pedido activo é a negociação; sem pedido é o assistente
 *         que recolhe um pedido novo (whatsapp-recolha.ts). Só se devolve
 *         {meu: false} — o bot local fica com a conversa — quando o site está
 *         desligado ou o número bloqueado.
 *   GET   — o que está na fila por enviar.
 *   PATCH {ids} — estas saíram mesmo; risca-as. Só se risca por confirmação:
 *         se o Winapp cair entre buscar e enviar, a mensagem volta a sair na
 *         ronda seguinte em vez de se perder.
 *
 * O segredo compara-se em tempo constante, como a assinatura da Meta ao lado.
 */

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.PONTE_WHATSAPP_SEGREDO;
  const cabecalho = req.headers.get("authorization") ?? "";
  if (!segredo || !cabecalho.startsWith("Bearer ")) return false;
  const dado = Buffer.from(cabecalho.slice("Bearer ".length));
  const esperado = Buffer.from(segredo);
  return dado.length === esperado.length && crypto.timingSafeEqual(dado, esperado);
}

/**
 * O portão — e, desde 22-09-2026, o relógio ao lado dele.
 *
 * QUEM PASSA AQUI É A PONTE, e mais ninguém: traz o segredo. Por isso este é
 * o sítio certo para carimbar a hora em que ela esteve cá, e não os três
 * handlers — um carimbo esquecido num deles dava um painel a dizer que ela
 * morreu quando ela estava a trabalhar.
 *
 * Carimba-se DEPOIS da autenticação de propósito: quem falha o segredo não é
 * a ponte, e não pode manter o sinal verde.
 *
 * É esperado e não deixado a voar: no Vercel uma promessa solta pode morrer
 * com a resposta, e um relógio que às vezes não anda é pior do que nenhum. O
 * custo é um UPDATE por chave primária, ao lado das consultas que esta rota
 * já faz. E `carimbarPonte` nunca atira — ver `db.ts`.
 */
async function portao(req: NextRequest): Promise<NextResponse | null> {
  if (!ponteConfigurada()) {
    return NextResponse.json({ error: "Ponte não configurada" }, { status: 503 });
  }
  if (!autorizado(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  await carimbarPonte();
  return null;
}

export async function GET(req: NextRequest) {
  const erro = await portao(req);
  if (erro) return erro;
  // Desligado no painel = nada sai, nem o que já estava na fila. A fila
  // espera; ligar outra vez solta-a — e o painel mostra o que lá está.
  /*
   * O AVISO A TODOS OS PROFISSIONAIS (d11, 15-11-2026) anda à boleia desta
   * ronda: depois de responder, uma passagem do motor (um WhatsApp por vez,
   * 20–45 s entre cada, 9h–21h de Lisboa, e um lote pequeno de emails). Só
   * faz alguma coisa com um envio começado no backoffice; nunca atrasa nem
   * parte a ronda da ponte.
   */
  after(async () => {
    try {
      const { passagemDoAviso } = await import("@/lib/aviso-aos-profissionais-na-base");
      await passagemDoAviso("ponte");
    } catch (e) {
      console.error("[ponte] aviso aos profissionais:", e instanceof Error ? e.message : e);
    }
    // O convite novo e o lembrete da app de cliente (d59, 17-11-2026): um
    // WhatsApp por vez, 20–45 s entre cada, 9h–21h de Lisboa.
    try {
      const { passagemDosWhatsAppDaApp } = await import("@/lib/convite-novo-da-app-na-base");
      await passagemDosWhatsAppDaApp();
    } catch (e) {
      console.error("[ponte] WhatsApp da app de cliente:", e instanceof Error ? e.message : e);
    }
    // A validade dos orçamentos (d62, 18-11-2026): os lembretes e o fecho que a
    // rotina pôs na fila, um por vez, 20–45 s entre cada, 9h–21h de Lisboa.
    try {
      const { passagemDaValidade } = await import("@/lib/validade-do-orcamento-na-base");
      await passagemDaValidade();
    } catch (e) {
      console.error("[ponte] validade dos orçamentos:", e instanceof Error ? e.message : e);
    }
    // O «Pedir o que falta» sozinho (d71, no ritmo da d88): o que a rotina pôs na
    // fila, um por vez, 20–45 s entre cada, 8h–21h de Lisboa.
    try {
      const { passagemDoQueFalta } = await import("@/lib/lembrete-do-que-falta-na-base");
      await passagemDoQueFalta();
    } catch (e) {
      console.error("[ponte] lembretes do que falta:", e instanceof Error ? e.message : e);
    }
    // As propostas ao cliente (d88, 23-11-2026): o orçamento que a rotina pôs na
    // fila, um por vez, 20–45 s entre cada, 8h–21h de Lisboa.
    try {
      const { passagemDasPropostas } = await import("@/lib/envio-das-propostas-ao-cliente-na-base");
      await passagemDasPropostas();
    } catch (e) {
      console.error("[ponte] propostas ao cliente:", e instanceof Error ? e.message : e);
    }
    // O seguimento do cliente (d83, 21-11-2026): as mensagens que a equipa marcou na
    // Mesa e o fecho ao 4.º dia, um por vez, 20–45 s entre cada, 9h–21h de Lisboa.
    try {
      const { passagemDoSeguimento } = await import("@/lib/seguimento-do-cliente-na-base");
      await passagemDoSeguimento();
    } catch (e) {
      console.error("[ponte] seguimento do cliente:", e instanceof Error ? e.message : e);
    }
  });
  if (!(await whatsappLigado())) return NextResponse.json({ paraEnviar: [] });
  return NextResponse.json({ paraEnviar: await filaWhatsAppParaAPonte() });
}

export async function POST(req: NextRequest) {
  const erro = await portao(req);
  if (erro) return erro;

  let corpo: {
    telefone?: unknown;
    texto?: unknown;
    accao?: unknown;
    /** Uma fotografia, já descarregada pela ponte: {base64, mime}. */
    foto?: { base64?: unknown; mime?: unknown } | null;
    /**
     * UMA IMAGEM SEM OS BYTES — 20-10-2026: «foto» quando a ponte não a
     * conseguiu descarregar, «video» sempre (não se descarrega). O site fica a
     * saber que ela chegou, agradece-a, e não a volta a pedir.
     *
     * ERA. Desde 15-11-2026 (decisão d34) a «foto» sem bytes é uma fotografia
     * que NÃO se viu: agradecê-la deixava o parceiro sem ela e o cliente a
     * achar que tinha sido vista. Fica `MARCA_DE_FOTOGRAFIA_FALHADA` no fio e,
     * desde 18-11-2026, a conversa fica anotada para a equipa a ver no
     * telemóvel — nada se pede ao cliente. A ponte di-lo também em `imagemFalhou`.
     */
    midia?: unknown;
    /** A fotografia não descarregou na ponte (d34, 15-11-2026). */
    imagemFalhou?: unknown;
    /** Com `accao: "interromper"`: o que o dono escreveu à mão (21-10-2026). */
    daMao?: unknown;
    /**
     * Um áudio, já descarregado pela ponte: {base64, mime} — ou {} quando a
     * ponte não o conseguiu descarregar. Ver `whatsapp-audio.ts`.
     */
    audio?: { base64?: unknown; mime?: unknown } | null;
    /** Com `accao: "retrato"`: a última mensagem de cada conversa do telemóvel (23-10-2026). */
    conversas?: unknown;
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  /*
   * O RETRATO DO TELEMÓVEL — 23-10-2026. De 10 em 10 minutos a ponte diz, de
   * cada conversa, de quem foi a última mensagem e quando. É o que mostra na
   * mesa as respostas dadas à mão que o site nunca viu. Não traz telefone: é
   * de todas. Ver `guardarRetratoDoTelemovelWhatsApp`.
   */
  if (corpo.accao === "retrato") {
    const conversas = Array.isArray(corpo.conversas) ? corpo.conversas.slice(0, 2000) : [];
    const limpas = conversas.flatMap((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const tel = typeof o.telefone === "string" ? o.telefone : "";
      const quando = Number(o.quando);
      if (!tel || !Number.isFinite(quando) || quando <= 0) return [];
      return [
        {
          telefone: tel,
          deMim: o.deMim === true,
          quando,
          texto: typeof o.texto === "string" ? o.texto : "",
          porLer: Number(o.porLer) || 0,
          arquivada: o.arquivada === true,
        },
      ];
    });
    try {
      const { guardarRetratoDoTelemovelWhatsApp } = await import("@/lib/db");
      const guardadas = await guardarRetratoDoTelemovelWhatsApp(limpas);
      return NextResponse.json({ ok: true, guardadas });
    } catch (e) {
      console.error("[ponte] o retrato do telemóvel não se guardou:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "O retrato não se guardou" }, { status: 500 });
    }
  }

  const telefone = typeof corpo.telefone === "string" ? corpo.telefone.trim() : "";
  const texto = typeof corpo.texto === "string" ? corpo.texto : "";
  const fotoBase64 =
    corpo.foto && typeof corpo.foto.base64 === "string" && corpo.foto.base64.length > 0
      ? corpo.foto.base64
      : null;
  const fotoMime =
    corpo.foto && typeof corpo.foto.mime === "string" && corpo.foto.mime.startsWith("image/")
      ? corpo.foto.mime
      : "image/jpeg";
  const veioAudio = corpo.audio != null && typeof corpo.audio === "object";
  const audioBase64 =
    veioAudio && typeof corpo.audio?.base64 === "string" && corpo.audio.base64.length > 0
      ? corpo.audio.base64
      : null;
  const audioMime = veioAudio && typeof corpo.audio?.mime === "string" ? corpo.audio.mime : null;
  // A marca da imagem que veio sem bytes — ver `midia` acima. Com os bytes, é
  // a fotografia de sempre.
  const marcaSemBytes: string | null = fotoBase64
    ? null
    : corpo.midia === "foto" || corpo.imagemFalhou === true
      ? MARCA_DE_FOTOGRAFIA_FALHADA
      : corpo.midia === "video"
        ? MARCA_DE_VIDEO
        : null;
  if (!telefone) {
    return NextResponse.json({ error: "Falta o telefone" }, { status: 400 });
  }

  /*
   * O QUE ENTROU FICA REGISTADO, DECIDA-SE O QUE SE DECIDIR A SEGUIR.
   *
   * "Esse pedido nunca apareceu aqui no assistente." — 15-09-2026, sobre a
   * conversa de um cliente: video, morada, andar, elevador
   * e um preco de 350 EUR combinado no WhatsApp, e nem uma linha no painel.
   *
   * Havia DOIS caminhos nesta rota que voltavam para tras sem escrever nada:
   * o aviso de que o dono respondeu a mao ("interromper") e o site desligado.
   * E a mesma avaria que ja tinha sido corrigida a 10-09 para as conversas
   * entregues a uma pessoa, e a licao ficou escrita: CALAR O ASSISTENTE E NAO
   * GUARDAR A CONVERSA SAO DUAS DECISOES DIFERENTES, e so a primeira foi
   * pedida. Faltava aplica-la aos outros dois caminhos.
   *
   * A EXCEPCAO E O NUMERO BLOQUEADO, e essa e de proposito: bloquear existe
   * para os contactos pessoais e para quem o dono decidiu que o assunto nao e
   * com o site. Guardar-lhes as mensagens era o contrario de bloquear.
   */
  async function guardarOQueEntrou() {
    try {
      const { registarMensagemWhatsApp } = await import("@/lib/db");
      if (fotoBase64) await registarMensagemWhatsApp(telefone, "in", MARCA_DE_FOTOGRAFIA);
      if (marcaSemBytes) await registarMensagemWhatsApp(telefone, "in", marcaSemBytes);
      if (veioAudio) await registarMensagemWhatsApp(telefone, "in", MARCA_DE_AUDIO);
      if (texto.trim()) await registarMensagemWhatsApp(telefone, "in", texto);
    } catch (e) {
      // Nunca pode travar a resposta a ponte: ela fica a espera para saber de
      // quem e a conversa, e um erro aqui calava-a.
      console.error("[ponte] nao registei a mensagem:", e instanceof Error ? e.message : e);
    }
  }

  // O Winapp a avisar: o dono respondeu À MÃO a este número. Responder à mão
  // é a forma mais natural de dizer "esta conversa é minha" — o cérebro
  // cala-se até alguém carregar em "Devolver ao site" no backoffice.
  if (corpo.accao === "interromper") {
    // Se o aviso trouxer a mensagem que o levou a responder, ela fica.
    await guardarOQueEntrou();
    /*
     * E A RESPOSTA À MÃO FICA ESCRITA — 21-10-2026. Ver `MARCA_DE_MAO`: sem
     * ela, o site não sabia se a conversa tinha resposta, e as conversas
     * «entregues a si» eram uma lista às cegas.
     */
    const daMao = typeof corpo.daMao === "string" ? corpo.daMao.trim() : "";
    if (daMao) {
      const { registarMensagemWhatsApp } = await import("@/lib/db");
      await registarMensagemWhatsApp(telefone, "out", `${MARCA_DE_MAO} ${daMao}`).catch(() => {});
    }
    /*
     * O ENVIO DE MODELO NÃO ENTREGA A CONVERSA — 22-11-2026 (decisão d86). O
     * «Pedir o que falta» sai pelo WhatsApp da equipa, com o texto do sistema:
     * é um pedido de dados ao cliente, e a resposta dele é da Vitória (que a
     * grava no pedido). Fica no fio com a marca, como as outras; só não cala
     * a Vitória. Ver `envio-de-modelo.ts`.
     */
    const { eEnvioDeModelo } = await import("@/lib/envio-de-modelo");
    if (eEnvioDeModelo(daMao)) {
      console.info(`[ponte] …${telefone.slice(-3)}: envio de modelo da equipa — a conversa fica com a Vitória (d86)`);
    } else {
      // Foi uma pessoa: quem respondeu já tem a conversa — sem aviso à equipa (d23).
      await interromperNumeroWhatsApp(telefone, "Respondeu à mão no WhatsApp", "pessoa");
    }
    return NextResponse.json({ ok: true });
  }

  // Bloqueado ou desligado no painel: o site lava as mãos por inteiro — o
  // Winapp fica com a conversa e aplica as regras locais dele.
  if (await numeroBloqueadoWhatsApp(telefone)) {
    // Bloqueado: nem se responde, nem se guarda. E o que bloquear quer dizer.
    return NextResponse.json({ meu: false, paraEnviar: [] });
  }
  if (!(await whatsappLigado())) {
    /*
     * Desligado no painel, o site lava as maos da RESPOSTA — mas nao da
     * memoria. Ligar outra vez e encontrar a caixa vazia era perder tudo o
     * que os clientes escreveram enquanto esteve desligado.
     */
    await guardarOQueEntrou();
    return NextResponse.json({ meu: false, paraEnviar: [] });
  }

  /*
   * ERA: sem pedido activo, {meu: false} — a conversa era do bot local do
   * Winapp, que qualificava o contacto. AGORA o site faz isso: "quero esse
   * WhatsApp usado pelo site automaticamente, a recolher os dados e a criar o
   * pedido". Um número desconhecido é {meu: true} — o assistente daqui trata
   * dele (whatsapp-recolha.ts) e o bot local cala-se.
   */
  const pedidos = await pedidosDoTelefone(telefone);
  void pedidos;

  /*
   * É cliente do site, mas a conversa está entregue a uma pessoa: o bot
   * local do Winapp também não a pode apanhar — {meu: true} cala-o — e o
   * cérebro daqui fica em silêncio até ser devolvida.
   *
   * MAS A MENSAGEM FICA REGISTADA.
   *
   * Voltava-se aqui para trás sem escrever nada, e o painel — que é
   * exactamente onde a pessoa a quem a conversa foi entregue vai ler o que o
   * cliente escreveu — ficava cego. A 10-09-2026 uma cliente escreveu três
   * mensagens seguidas às 16:49 («consegue recolher um frigorífico antigo ao
   * domicílio», «hoje ou amanhã?», «diga-me se tem algum custo») e nenhuma
   * apareceu no ecrã: quem tinha a conversa em mãos não tinha como saber que
   * ela tinha perguntado fosse o que fosse.
   *
   * Calar o assistente e não guardar a conversa são duas decisões
   * diferentes, e só a primeira foi pedida.
   */
  if (await numeroInterrompidoWhatsApp(telefone)) {
    const { registarMensagemWhatsApp } = await import("@/lib/db");
    if (fotoBase64) {
      await registarMensagemWhatsApp(telefone, "in", MARCA_DE_FOTOGRAFIA).catch(() => {});
    }
    if (marcaSemBytes) {
      await registarMensagemWhatsApp(telefone, "in", marcaSemBytes).catch(() => {});
    }
    // O áudio não se transcreve aqui: a conversa é de uma pessoa, que o ouve
    // no telemóvel. Fica a marca, para o painel saber que ele falou.
    if (veioAudio) {
      await registarMensagemWhatsApp(telefone, "in", MARCA_DE_AUDIO).catch(() => {});
    }
    if (texto.trim()) {
      await registarMensagemWhatsApp(telefone, "in", texto).catch(() => {});
      /*
       * E A RUA QUE A VITÓRIA PEDIU ANTES DE ENTREGAR A CONVERSA — 17-11-2026
       * (d69, o valor único aceite: agradece, pede a rua, passa à equipa). Se
       * isto é a resposta, entra no pedido EM SILÊNCIO: não responde, não
       * pergunta — quem tem a conversa vê-a no fio e no pedido.
       */
      const { lerARespostaDaRua } = await import("@/lib/rua-depois-do-aceite-na-base");
      await lerARespostaDaRua(telefone, texto).catch(() => null);
      /*
       * E A RESPOSTA DO PARCEIRO À PERGUNTA DA VITÓRIA — 23-11-2026 (d97). Os
       * números dos parceiros estão muitas vezes entregues a uma pessoa; se a
       * última mensagem que lhe saiu é a pergunta de um pedido, a resposta
       * segue para o cliente — sem lhe escrever nada a ele (a conversa é de
       * quem a tem).
       */
      const { respostaDoParceiroPeloWhatsApp } = await import("@/lib/vitoria-agente/pergunta-ao-parceiro-na-base");
      await respostaDoParceiroPeloWhatsApp(telefone, texto, { interrompido: true }).catch(() => false);
    }

    /*
     * ⚠️ O «PARAR» ATRAVESSA ESTA PORTA, E SÓ ELE — 20-09-2026.
     *
     * Esta é a única coisa que se faz a um número interrompido, e é por uma
     * razão que não é de conveniência: os avisos de pedido novo prometem, por
     * escrito e em cada mensagem, «para deixar de receber estes avisos,
     * escreva parar». Sem isto, essa promessa falhava em silêncio
     * EXACTAMENTE para quem mais a ia usar — ficam interrompidos os números a
     * que o dono escreveu à mão, que são os dos profissionais.
     *
     * Uma promessa de saída que não funciona é pior do que não a fazer: é o
     * que transforma um aviso numa mensagem não solicitada, e é assim que se
     * perde um número.
     *
     * E NÃO É UMA CONVERSA. A decisão de 10-09-2026 — «se for eu a iniciar
     * uma conversa, ele não pode continuar sem que eu passe a conversa para
     * ele», escrita depois de o assistente se ter atirado a uma transportadora
     * — continua de pé e não se lhe toca. Isto não responde, não pergunta, não
     * entrega nada a ninguém: desliga uma opção na base e volta para trás pelo
     * mesmo caminho. O dono continua dono da conversa.
     */
    if (ePedidoParaParar(texto)) {
      const { desligarAvisosPeloTelefone } = await import("@/lib/db");
      await desligarAvisosPeloTelefone(telefone).catch(() => {});
    }

    return NextResponse.json({ meu: true, paraEnviar: [] });
  }

  /*
   * O «PARAR» É A PRIMEIRA COISA, E VALE PARA TODA A GENTE — 20-09-2026.
   *
   * Está aqui em cima, e não dentro do tratamento da mensagem, por duas razões.
   *
   * A PRIMEIRA é que quem escreve «parar» não está a conversar: está a mandar
   * fechar uma porta, e a porta fecha-se antes de mais nada acontecer. Enterrar
   * isto no fim de um `tratarMensagemDoCliente` que tem quinze caminhos era
   * deixá-lo dependente de nenhum deles se atravessar à frente.
   *
   * A SEGUNDA é o caso do profissional que TAMBÉM é cliente, com um pedido vivo
   * em curso. Nesse caso a conversa dele é uma conversa de cliente e vai por
   * outro caminho — e a promessa de saída que lhe foi feita por escrito falhava
   * exactamente para ele, que é quem tem mais motivos para a usar. Desligar os
   * avisos não lhe mexe no pedido: são duas coisas separadas e continuam a
   * sê-lo, por isso a mensagem segue o seu caminho normal a seguir a isto.
   */
  if (ePedidoParaParar(texto)) {
    const { desligarAvisosPeloTelefone } = await import("@/lib/db");
    const desligou = await desligarAvisosPeloTelefone(telefone).catch(() => false);
    /*
     * E DIZ-SE QUE FICOU DESLIGADO — só a quem tinha mesmo avisos ligados.
     *
     * Quem escreve «parar» e não ouve nada escreve outra vez, e depois
     * bloqueia o número. Um cliente que escreva «parar» sem ser profissional
     * não desligou nada, e não leva resposta nenhuma daqui.
     */
    if (desligou) {
      const { enviarAvisoWhatsApp } = await import("@/lib/whatsapp-cloud");
      await enviarAvisoWhatsApp(
        telefone,
        "Pronto — deixa de receber os avisos da CLYON por WhatsApp. " +
          "Pode voltar a ligá-los quando quiser, no seu painel.",
      ).catch(() => false);
    }
  }

  try {
    const { registarMensagemWhatsApp } = await import("@/lib/db");
    if (veioAudio) {
      /*
       * O ÁUDIO, OUVIDO — 06-10-2026. «Quando um cliente manda um áudio, o
       * que faz o assistente?» — «Ouve e responde.»
       *
       * O que o Gemini ouviu fica no fio com a marca à frente, e segue pela
       * rajada como se tivesse sido escrito: `textoDaRajada` tira a marca
       * antes de o cérebro ler. Sem nada ouvido, pede-se para escrever — e só
       * isso, sem o cérebro: não há nada que ele possa ler.
       */
      const { transcreverAudio, PEDIR_PARA_ESCREVER } = await import("@/lib/whatsapp-audio");
      const ouvido = audioBase64 ? await transcreverAudio(audioBase64, audioMime) : null;
      if (ouvido) {
        const id = await registarMensagemWhatsApp(telefone, "in", `${MARCA_DE_AUDIO} ${ouvido}`).catch(
          () => null,
        );
        await responderARajada(telefone, id, ouvido);
      } else {
        await registarMensagemWhatsApp(telefone, "in", MARCA_DE_AUDIO).catch(() => {});
        const { enviarTextoWhatsApp } = await import("@/lib/whatsapp-cloud");
        await enviarTextoWhatsApp(telefone, PEDIR_PARA_ESCREVER).catch(() => false);
      }
    } else if (fotoBase64) {
      /*
       * A fotografia vem já descarregada — a ponte tem o WhatsApp Web, o
       * site não. Guarda-se no pedido pelo mesmo caminho da API da Meta
       * (Blob → filesJson → histórico), e a legenda, se houver, segue como
       * texto.
       */
      const daFoto = await registarMensagemWhatsApp(telefone, "in", MARCA_DE_FOTOGRAFIA).catch(() => null);
      const { guardarFotoDoClienteNoPedido } = await import("@/lib/whatsapp-negociacao");
      // Guardar e ver ao mesmo tempo — ver `verEAnotarAFotografia`.
      await Promise.all([
        guardarFotoDoClienteNoPedido(telefone, Buffer.from(fotoBase64, "base64"), fotoMime),
        verEAnotarAFotografia(telefone, daFoto, fotoBase64, fotoMime, pedidos.length > 0),
      ]);
      /*
       * E A FOTOGRAFIA SOZINHA TAMBÉM CORRE A RAJADA — 20-10-2026. Só a
       * legenda o fazia: quem mandou duas fotografias sem escrever nada (a
       * Benedita) ficou sem resposta nenhuma. Agora a mais nova da rajada
       * responde, com o «Obrigada pelas imagens!».
       */
      const daLegenda = texto.trim() ? await registarMensagemWhatsApp(telefone, "in", texto).catch(() => null) : null;
      await responderARajada(telefone, daLegenda ?? daFoto, texto);
    } else if (marcaSemBytes === MARCA_DE_FOTOGRAFIA_FALHADA) {
      /*
       * A FOTOGRAFIA QUE NÃO DESCARREGOU — 15-11-2026 (decisão d34). Não se
       * agradece o que não se viu. Desde 18-11-2026 também não se pede para a
       * reenviar: fica a marca no fio, a conversa anotada para a equipa a ver
       * no telemóvel (`deixarAFotografiaParaAEquipa`), e ao cliente não sai
       * nada por causa dela. A legenda, essa, segue pela rajada como texto.
       */
      await registarMensagemWhatsApp(telefone, "in", MARCA_DE_FOTOGRAFIA_FALHADA).catch(() => null);
      const legenda = async () => {
        if (!texto.trim()) return;
        const daLegenda = await registarMensagemWhatsApp(telefone, "in", texto).catch(() => null);
        await responderARajada(telefone, daLegenda, texto);
      };
      await Promise.all([deixarAFotografiaParaAEquipa(telefone), legenda()]);
    } else if (marcaSemBytes) {
      // A imagem sem os bytes — ver `midia`. A marca vai para o fio, e a
      // rajada responde como a uma fotografia que chegou.
      const daImagem = await registarMensagemWhatsApp(telefone, "in", marcaSemBytes).catch(() => null);
      const daLegenda = texto.trim() ? await registarMensagemWhatsApp(telefone, "in", texto).catch(() => null) : null;
      await responderARajada(telefone, daLegenda ?? daImagem, texto);
    } else {
      const id = await registarMensagemWhatsApp(telefone, "in", texto).catch(() => null);
      // d97: a resposta do parceiro a uma pergunta da Vitória vai para o cliente, e não para a conversa de sempre.
      const { respostaDoParceiroPeloWhatsApp } = await import("@/lib/vitoria-agente/pergunta-ao-parceiro-na-base");
      if (!(await respostaDoParceiroPeloWhatsApp(telefone, texto).catch(() => false))) await responderARajada(telefone, id, texto);
    }
  } catch (e) {
    // A conversa é nossa na mesma — um erro aqui não pode atirar o cliente
    // para o bot de leads, que lhe responderia como a um desconhecido.
    console.error("[whatsapp/ponte]", e);
  }
  return NextResponse.json({ meu: true, paraEnviar: await filaWhatsAppParaAPonte() });
}

export async function PATCH(req: NextRequest) {
  const erro = await portao(req);
  if (erro) return erro;

  let corpo: { ids?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const ids = Array.isArray(corpo.ids) ? corpo.ids.map(Number) : [];
  await marcarFilaWhatsAppEnviadas(ids);
  return NextResponse.json({ ok: true });
}
