import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth-helper";
import {
  apagarConversaWhatsApp,
  arquivarConversaWhatsApp,
  bloquearNumeroWhatsApp,
  conversasWhatsApp,
  definirWhatsappLigado,
  desbloquearNumeroWhatsApp,
  filaWhatsAppPorEnviar,
  interromperNumeroWhatsApp,
  limparFilaWhatsApp,
  listarConversasArquivadasWhatsApp,
  listarNumerosBloqueadosWhatsApp,
  listarNumerosInterrompidosWhatsApp,
  listarRecolhasWhatsAppEmCurso,
  apagarRecolhaWhatsApp,
  marcarFilaWhatsAppEnviadas,
  mensagemDaFilaWhatsApp,
  mensagensDoNumeroWhatsApp,
  registarMensagemWhatsApp,
  retomarNumeroWhatsApp,
  whatsappLigado,
} from "@/lib/db";
import {
  canalWhatsApp,
  enviarTextoManualWhatsApp,
  linkParaEnviarAMao,
  linkParaEnviarNoWhatsAppWeb,
  numeroManualWhatsApp,
} from "@/lib/whatsapp-cloud";
import { tratarMensagemDoCliente } from "@/lib/whatsapp-negociacao";

export const runtime = "nodejs";

/**
 * UM PRAZO MAIOR DO QUE O DA PLATAFORMA POR OMISSÃO.
 *
 * Reler uma conversa pede ao Gemini que leia até sessenta linhas e devolva os
 * campos todos. Com o tempo por omissão, a função podia ser cortada a meio da
 * leitura — e aí nem a mensagem de erro certa chegava ao painel, porque não
 * havia ninguém vivo para a escrever.
 *
 * É o tecto, não a espera: as leituras normais continuam a responder em
 * segundos, e o relógio de dentro (ver `compreenderFioComMotivo`) desiste bem
 * antes disto.
 */
export const maxDuration = 60;

/**
 * O painel de controlo do WhatsApp da plataforma.
 *
 * O mesmo poder que o dono tem no Winapp, mas sobre o cérebro DAQUI:
 * desligar tudo com um gesto, entregar uma conversa a uma pessoa (e
 * devolvê-la), bloquear um contacto pessoal para sempre. O estado vive na
 * base — a Meta e a ponte do Winapp respeitam-no os dois, porque todos os
 * envios e todas as respostas perguntam primeiro ao mesmo sítio.
 */

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  // Com ?telefone= devolve-se a conversa desse número — o fio inteiro.
  const telefone = req.nextUrl.searchParams.get("telefone");
  if (telefone) {
    return NextResponse.json({ mensagens: await mensagensDoNumeroWhatsApp(telefone) });
  }

  const { saudeDaCompreensao } = await import("@/lib/db");
  const [ligado, interrompidos, bloqueados, fila, conversas, recolhas, arquivadas, compreensao] =
    await Promise.all([
      whatsappLigado(),
      listarNumerosInterrompidosWhatsApp(),
      listarNumerosBloqueadosWhatsApp(),
      filaWhatsAppPorEnviar(50),
      // Mais fundo do que as 30 de origem: uma conversa arquivada sai da mesa
      // mas continua a contar para o limite, e o separador delas tem de ter o
      // que mostrar.
      conversasWhatsApp(80),
      listarRecolhasWhatsAppEmCurso().catch(() => []),
      listarConversasArquivadasWhatsApp().catch(() => []),
      // Quando a leitura das mensagens falhou pela última vez, e porquê.
      saudeDaCompreensao().catch(() => null),
    ]);
  return NextResponse.json({
    ligado,
    // "meta", "ponte", "manual" (o número da CLYON à mão, sem API) ou "nenhum".
    canal: canalWhatsApp(),
    numeroManual: numeroManualWhatsApp(),
    interrompidos,
    bloqueados,
    fila,
    conversas,
    // Os números a meio da recolha de um pedido pelo assistente, e em que passo.
    recolhas,
    // As que já foram dadas por tratadas: saem da mesa, não do registo.
    arquivadas,
    /*
     * A SAÚDE DA COMPREENSÃO — null quando está de pé.
     *
     * Sem isto, uma quota esgotada do Gemini é indistinguível de tudo estar
     * bem: o assistente volta às palavras-chave e ninguém dá por nada.
     */
    compreensao,
  });
}

export async function POST(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  let corpo: {
    accao?: unknown;
    telefone?: unknown;
    nota?: unknown;
    id?: unknown;
    /** Segunda fase da releitura: sem isto, ela mostra e não escreve. */
    confirmar?: unknown;
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const accao = typeof corpo.accao === "string" ? corpo.accao : "";
  const telefone = typeof corpo.telefone === "string" ? corpo.telefone : "";
  const nota = typeof corpo.nota === "string" ? corpo.nota : undefined;

  // Responder à mão. Passa por cima do interruptor e das entregas de
  // propósito — quem escreve aqui É a pessoa. Se não sair, a razão mais
  // comum é a janela de 24 h do WhatsApp estar fechada.
  if (accao === "responder") {
    const texto = typeof corpo.nota === "string" ? corpo.nota.trim() : "";
    if (!texto || telefone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Falta o número ou o texto." }, { status: 400 });
    }
    // À mão, sem API: a resposta não sai daqui — devolve-se o link que abre
    // o WhatsApp do número da CLYON com o texto pronto, e regista-se no fio
    // porque quem carregou vai enviá-la.
    if (canalWhatsApp() === "manual") {
      await registarMensagemWhatsApp(telefone, "out", texto);
      return NextResponse.json({
        ok: true,
        manual: true,
        link: linkParaEnviarAMao(telefone, texto),
        linkWeb: linkParaEnviarNoWhatsAppWeb(telefone, texto),
      });
    }
    const saiu = await enviarTextoManualWhatsApp(telefone, texto);
    if (!saiu) {
      return NextResponse.json(
        {
          error:
            "Não saiu. Ou não há canal configurado, ou a janela de 24 horas " +
            "desde a última mensagem dele já fechou — nesse caso só um template aprovado passa.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  /*
   * ENVIAR PELA CLYON — e o assistente fica com a conversa.
   *
   * "Esse botão enviar orçamento devia passar para o bot do WhatsApp enviar,
   * e continuar a conversa caso seja necessário." — 11-09-2026.
   *
   * O botão que havia abria o WhatsApp Web de quem carregava, com o texto
   * escrito: a mensagem saía do telemóvel DELE, e o assistente não ficava a
   * saber de nada. Quando o cliente respondesse «aceito» ou «150», a resposta
   * caía numa conversa que a plataforma nunca tinha começado.
   *
   * Aqui sai pelo número da CLYON, fica no fio, e o número é DEVOLVIDO ao
   * assistente — que é o que faz a frase «e continuar a conversa» valer
   * alguma coisa. Sem isso, uma conversa que estivesse entregue a uma pessoa
   * continuava entregue, e o cérebro calava-se à resposta do cliente.
   */
  if (accao === "enviarPelaClyon") {
    const texto = typeof corpo.nota === "string" ? corpo.nota.trim() : "";
    if (!texto || telefone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Falta o número ou o texto." }, { status: 400 });
    }

    // Um bloqueado não recebe nada — é a decisão que o bloqueio É, e não uma
    // que este botão possa desfazer por acidente.
    const { numeroBloqueadoWhatsApp } = await import("@/lib/db");
    if (await numeroBloqueadoWhatsApp(telefone)) {
      return NextResponse.json(
        { error: "Este número está bloqueado. Desbloqueie-o primeiro, no ecrã do WhatsApp." },
        { status: 409 },
      );
    }

    const saiu = await enviarTextoManualWhatsApp(telefone, texto);
    if (!saiu) {
      return NextResponse.json(
        {
          error:
            "Não saiu. Ou não há canal configurado, ou a janela de 24 horas desde a " +
            "última mensagem dele já fechou — nesse caso só um template aprovado passa.",
        },
        { status: 400 },
      );
    }

    await retomarNumeroWhatsApp(telefone);

    /*
     * O assistente só responde se o interruptor geral estiver ligado. A
     * mensagem saiu à mesma — quem carregou pediu-o — mas dizer que ele fica
     * a tratar disto, com o WhatsApp desligado, seria uma promessa falsa.
     */
    const ligado = await whatsappLigado();
    return NextResponse.json({
      ok: true,
      canal: canalWhatsApp(),
      assistenteVaiResponder: ligado,
      aviso: ligado
        ? null
        : "A mensagem saiu, mas o WhatsApp da plataforma está DESLIGADO — o assistente não vai responder ao que ele disser. Ligue-o no ecrã do WhatsApp.",
    });
  }

  /*
   * CHEGOU UMA RESPOSTA — lida no WhatsApp Web e colada aqui.
   *
   * Sem API não há webhook; este é o webhook à mão. O texto entra pelo
   * mesmo caminho da Meta e da ponte: regista-se no fio como recebido e o
   * cérebro trata-o (é ele que decide se pode falar com este número — ligado,
   * não bloqueado, não entregue, com pedido activo). O que ele responder
   * fica na fila, para sair pelo WhatsApp Web com um clique.
   */
  if (accao === "recebida") {
    const texto = typeof corpo.nota === "string" ? corpo.nota.trim() : "";
    if (!texto || telefone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Falta o número ou o texto." }, { status: 400 });
    }
    await registarMensagemWhatsApp(telefone, "in", texto).catch(() => {});
    try {
      await tratarMensagemDoCliente(telefone, { tipo: "texto", texto });
    } catch (e) {
      console.error("[admin/whatsapp recebida]", e);
      return NextResponse.json(
        { error: "Ficou registada, mas o cérebro não conseguiu tratá-la. Responda à mão." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, fila: await filaWhatsAppPorEnviar(50) });
  }

  /*
   * RELER A CONVERSA — continuar de onde parámos.
   *
   * "Quando clico em Recomeçar conversa ele devia ler as mensagens anteriores
   * para recomeçar de onde parámos." O «Recomeçar do zero» apaga tudo e volta
   * a perguntar o serviço a quem já o disse; isto lê o fio, reconstrói o que
   * ele já respondeu, e pergunta só o que falta.
   *
   * DUAS FASES, E PORQUÊ. Sem `confirmar`, isto não escreve nada: devolve o
   * que percebeu e a frase que ia mandar, para quem carregou VER antes de o
   * cliente ouvir. Um campo inventado mas bem formado — um código postal com
   * quatro dígitos e três que ninguém deu — passa em todos os validadores sem
   * uma queixa, e o único guarda contra isso são olhos humanos.
   */
  if (accao === "relerConversa") {
    if (telefone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Falta o número." }, { status: 400 });
    }
    const {
      mensagensDoNumeroWhatsApp,
      recolhaWhatsApp,
      guardarRecolhaWhatsApp,
      limparFilaWhatsAppDoNumero,
    } = await import("@/lib/db");
    const { fioParaLeitura, guiaoDoFio, releituraDoFio } = await import("@/lib/reler-a-conversa");
    const { compreenderFioComMotivo, compreensaoDisponivel } = await import(
      "@/lib/whatsapp-compreensao",
    );
    const { pedidosDoTelefone } = await import("@/lib/whatsapp-negociacao");

    /*
     * COM PEDIDO ACTIVO, A CONVERSA É A DAS PROPOSTAS — E CONTINUA-SE NA MESMA.
     *
     * Isto devolvia 409: «a conversa dele é a das propostas, não a da recolha».
     * Estava certo e era inútil. Quem carrega no botão não está a pedir uma
     * releitura da recolha — está a pedir que o assistente CONTINUE, e para
     * isso não havia caminho nenhum no painel.
     *
     * Uma cliente escreveu «Não» às 14:22 e o assistente não respondeu. O
     * botão era o gesto certo; só não fazia nada.
     *
     * ESTE TESTE VEM PRIMEIRO, E É POR ISSO QUE ESTÁ AQUI EM CIMA.
     *
     * Estava depois do guarda da recolha, e o guarda da recolha respondia
     * antes dele: «Esta conversa já deu o pedido #317. Reler ia reabrir uma
     * recolha que está fechada.» Verdade — e a conversa dele já não é a
     * recolha, é a das propostas, com o cliente a perguntar o valor, se pode
     * ser sem factura e se o MBWay serve. Uma recolha que deu pedido é
     * exactamente o caso em que se quer continuar, e era o único que nunca
     * chegava aqui.
     *
     * Nada disto escreve na recolha — só chama o cérebro — por isso passar à
     * frente do guarda não ressuscita coisa nenhuma.
     */
    const activos = await pedidosDoTelefone(telefone);
    if (activos.length > 0) {
      const {
        whatsappLigado,
        numeroBloqueadoWhatsApp,
        numeroInterrompidoWhatsApp,
      } = await import("@/lib/db");
      const { podeContinuar, ultimaDoCliente, oQueVaiFazer } = await import(
        "@/lib/continuar-a-conversa"
      );

      const fioTodo = await mensagensDoNumeroWhatsApp(telefone, 200);
      const veredicto = podeContinuar(
        {
          ligado: await whatsappLigado(),
          bloqueado: await numeroBloqueadoWhatsApp(telefone),
          entregue: await numeroInterrompidoWhatsApp(telefone),
        },
        ultimaDoCliente(fioTodo),
      );

      /*
       * O PORQUÊ VAI JUNTO COM O NÃO.
       *
       * Um botão que não faz nada e não diz porquê manda a pessoa procurar uma
       * avaria que não existe — e o pior dos motivos, o interruptor geral
       * desligado, não se vê em lado nenhum na linha da conversa.
       */
      if (!veredicto.pode) {
        return NextResponse.json(
          { error: `${veredicto.porque} ${veredicto.comoSeResolve}` },
          { status: 409 },
        );
      }

      if (corpo.confirmar !== true) {
        return NextResponse.json({
          ok: true,
          previsao: true,
          propostas: true,
          pedido: activos[0],
          ultima: veredicto.ultima.texto,
          linhasLidas: fioTodo.length,
          mensagem: oQueVaiFazer(activos[0], veredicto.ultima.texto),
        });
      }

      const { tratarMensagemDoCliente } = await import("@/lib/whatsapp-negociacao");
      await tratarMensagemDoCliente(telefone, {
        tipo: "texto",
        texto: veredicto.ultima.texto,
      });
      return NextResponse.json({
        ok: true,
        propostas: true,
        feito: `O assistente voltou a tratar «${veredicto.ultima.texto}» no pedido #${activos[0]}.`,
      });
    }

    /*
     * O GUARDA DO pedidoId. `guardarRecolhaWhatsApp` faz
     * `ON DUPLICATE KEY UPDATE ... pedidoId = NULL`: escrever por cima de uma
     * recolha que já deu pedido RESSUSCITA-A, o número volta à lista do painel
     * e a mensagem seguinte do cliente cai outra vez na recolha.
     *
     * Daqui para baixo é tudo recolha, e é aqui que este guarda manda. Só
     * chega cá quem NÃO tem pedido activo — ou seja, a recolha deu pedido e
     * esse pedido já foi cancelado, concluído ou arquivado. Aí não há nada
     * para continuar de nenhum dos lados, e reabrir a recolha seria o pior dos
     * dois.
     */
    const guardada = await recolhaWhatsApp(telefone);
    if (guardada?.pedidoId != null) {
      return NextResponse.json(
        {
          error:
            `Esta conversa já deu o pedido #${guardada.pedidoId}, e esse pedido já não está aberto. ` +
            `Não há conversa para continuar: reabrir a recolha punha o assistente a perguntar tudo de novo.`,
        },
        { status: 409 },
      );
    }

    const fio = fioParaLeitura(await mensagensDoNumeroWhatsApp(telefone, 200));
    if (fio.length === 0) {
      return NextResponse.json(
        { error: "Não há conversa registada para reler neste número." },
        { status: 404 },
      );
    }

    const gravado = guardada?.dados ?? {};
    /*
     * MAIS TEMPO DO QUE NA CONVERSA, E É DE PROPÓSITO.
     *
     * Os 18 s de sempre são para quando do outro lado está um cliente a olhar
     * para o WhatsApp — aí a espera é o produto. Aqui quem espera é alguém do
     * backoffice que carregou num botão e está a ver um spinner, e o fio a ler
     * são até sessenta linhas em vez de uma frase. Um prazo pensado para o
     * caso apertado era o que fazia esta leitura falhar.
     */
    const leitura = await compreenderFioComMotivo(
      guiaoDoFio(fio),
      gravado as Record<string, unknown>,
      new Date(),
      { bom: 40, reserva: 15 },
    );
    const campos = leitura.ok ? leitura.campos : null;
    if (!campos) {
      /*
       * DUAS AVARIAS DIFERENTES, DUAS FRASES DIFERENTES.
       *
       * Dizia "sem chave do Gemini, ou a leitura falhou" — e quem lê aquilo
       * não sabe se tem de ir à Vercel pôr uma variável ou se basta carregar
       * outra vez. São problemas com donos diferentes.
       */
      const semChave = !compreensaoDisponivel();
      return NextResponse.json(
        {
          error: semChave
            ? "O Gemini não está configurado neste ambiente — falta a GEMINI_API_KEY. Sem ela o assistente também não percebe texto livre: responde pela lista numerada."
            : /*
               * O MOTIVO, E NÃO UM CONVITE A IR LER REGISTOS.
               *
               * Dizia «não respondeu a tempo ou devolveu algo que não se lê» —
               * duas avarias com donos diferentes numa frase só, e uma
               * terceira (a Google a recusar) que nem era mencionada. Quem
               * carrega no botão tem de saber se tenta outra vez ou se o
               * problema é de configuração.
               */
              `A leitura falhou. ${leitura.ok ? "" : leitura.motivo}`.trim(),
        },
        { status: 503 },
      );
    }

    const r = releituraDoFio({ gravado: gravado as never, campos, fio });

    if (corpo.confirmar !== true) {
      return NextResponse.json({
        ok: true,
        previsao: true,
        recuperados: r.recuperados,
        passo: r.passo,
        completo: r.completo,
        mensagem: r.mensagem,
        linhasLidas: fio.length,
      });
    }

    // Não se troca uma recolha que existe por uma linha vazia.
    if (r.recuperados.length === 0 && guardada == null) {
      return NextResponse.json(
        { error: "A conversa não trouxe nada de aproveitável — não gravei nada." },
        { status: 422 },
      );
    }

    await guardarRecolhaWhatsApp(telefone, r.passo, r.dados);
    // O que estava por sair era do passo antigo.
    const riscadas = await limparFilaWhatsAppDoNumero(telefone);

    const { enviarTextoWhatsApp } = await import("@/lib/whatsapp-cloud");
    const saiu = await enviarTextoWhatsApp(telefone, r.mensagem);
    return NextResponse.json({
      ok: true,
      recuperados: r.recuperados,
      passo: r.passo,
      completo: r.completo,
      mensagem: r.mensagem,
      riscadas,
      /*
       * A VERDADE SOBRE O ENVIO. Pela ponte, `enviarTextoWhatsApp` devolve
       * true só por ter posto na fila — «saiu» não é «chegou». E se a conversa
       * estiver entregue a uma pessoa, bloqueada, ou o WhatsApp desligado, o
       * portão cala-a e não sai nada: dizer que sim seria um verde mentiroso.
       */
      enviada: saiu,
      aviso: saiu
        ? null
        : "Gravei o que reli, mas a mensagem não saiu — a conversa está entregue a si, bloqueada, ou o WhatsApp está desligado. Copie-a e mande-a à mão.",
    });
  }

  /*
   * LIMPAR A FILA INTEIRA.
   *
   * O irmão grande do "descartar". Quando o cérebro se repete — o mesmo menu
   * de dez serviços duas vezes para o mesmo número — o que se quer é que nada
   * daquilo saia, e não dois gestos por mensagem.
   *
   * Devolve quantas riscou: sem o número, quem carrega não sabe se apanhou o
   * que estava a ver ou se entretanto entraram mais.
   */
  if (accao === "limparFila") {
    const quantas = await limparFilaWhatsApp();
    return NextResponse.json({ ok: true, quantas });
  }

  // A fila, à mão: "enviada" risca a mensagem e põe-na no fio da conversa
  // como saída; "descartar" risca-a sem a registar — não chegou a sair.
  if (accao === "enviada" || accao === "descartar") {
    const id = Number(corpo.id);
    const mensagem = await mensagemDaFilaWhatsApp(id);
    if (!mensagem) {
      return NextResponse.json({ error: "Essa mensagem já não está na fila." }, { status: 404 });
    }
    await marcarFilaWhatsAppEnviadas([mensagem.id]);
    if (accao === "enviada") {
      await registarMensagemWhatsApp(mensagem.telefone, "out", mensagem.texto);
    }
    return NextResponse.json({ ok: true });
  }

  try {
    switch (accao) {
      // A recolha deste número volta ao início — para quando a conversa se
      // baralhou e a equipa quer que o assistente pergunte tudo de novo.
      case "recomecarRecolha":
        await apagarRecolhaWhatsApp(telefone);
        break;
      // Arrumar a mesa. Não apaga nada: o fio fica, e volta com "desarquivar".
      case "arquivar":
        await arquivarConversaWhatsApp(telefone, true);
        break;
      case "desarquivar":
        await arquivarConversaWhatsApp(telefone, false);
        break;
      /*
       * Apagar o fio — e a recolha e a fila deste número com ele, senão a
       * conversa continuava sozinha onde já não se vê.
       *
       * O bloqueio e a entrega a uma pessoa NÃO se tocam: são decisões em
       * vigor, e apagar o registo não pode devolver a palavra ao assistente
       * sem ninguém ter pedido.
       */
      case "apagarConversa":
        await apagarConversaWhatsApp(telefone);
        break;
      case "ligar":
        await definirWhatsappLigado(true);
        break;
      case "desligar":
        await definirWhatsappLigado(false);
        break;
      case "bloquear":
        await bloquearNumeroWhatsApp(telefone, nota);
        break;
      case "desbloquear":
        await desbloquearNumeroWhatsApp(telefone);
        break;
      case "interromper":
        await interromperNumeroWhatsApp(telefone, nota ?? "Pelo backoffice");
        break;
      case "retomar":
        await retomarNumeroWhatsApp(telefone);
        break;
      default:
        return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
