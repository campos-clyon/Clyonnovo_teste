import { NextRequest, NextResponse } from "next/server";
import {
  anonimizarArquivoAntigo,
  interruptorDasRegrasNovas,
  purgarPedidosTerminados,
  purgarFotosPendentesDoWhatsApp,
  purgarRecolhasDoWhatsApp,
  purgarContactosAMeio,
  purgarErrosDaApp,
  registarSemFalhar,
  tentarOsEventosPorApagar,
} from "@/lib/db";
import {
  DIAS_DAS_FOTOS_SEM_PEDIDO,
  DIAS_DOS_CONTACTOS_A_MEIO,
  DIAS_DOS_ERROS_DA_APP,
  DIAS_DE_RETENCAO_DOS_PEDIDOS,
  DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP,
  DIAS_PARA_OS_ABANDONADOS,
  MESES_ATE_ANONIMIZAR_O_ARQUIVO,
  MESES_DAS_CONVERSAS_DE_PEDIDO,
  DIAS_DAS_CONVERSAS_DE_SUPORTE,
  MESES_DA_PRESENCA_NO_BACKOFFICE,
  purgaArmada,
} from "@/lib/retencao";
import { purgarPresencaAntiga } from "@/lib/presenca-na-base";
import { bearerConfere } from "@/lib/segredo-igual";
import { purgarConversas } from "@/lib/conversas-na-base";
import { carimbarPassagem } from "@/lib/licoes-da-vitoria-na-base";
import { contactosAMeioEmPalavras, passoSecundario, resumoComAsFalhas } from "@/lib/passos-da-purga";
import {
  purgarComAsRegrasNovas,
  regrasNovasDaNoite,
  regrasNovasEmPalavras,
  type RegrasNovasDaNoite,
} from "@/lib/regras-novas-na-base";

export const runtime = "nodejs";

/**
 * TEMPO PARA A PASSAGEM INTEIRA, E PARA ESCREVER O QUE FEZ.
 *
 * Cada pedido é uma transacção mais um punhado de chamadas ao Blob para lhe
 * apagar as fotografias. Com o tempo por omissão, uma passagem cheia podia ser
 * cortada a meio — e o pior disso não é o que fica por apagar (a passagem
 * seguinte apanha-o): é a linha de resumo, que é escrita no FIM e é a única
 * prova de que a purga correu. Uma purga que apaga e não conta o que apagou é
 * a pior das duas.
 */
export const maxDuration = 300;

/**
 * A purga dos pedidos velhos — todos os dias.
 *
 * DOIS PRAZOS E UMA GARANTIA (14-09-2026):
 *
 *   · os que acabaram — concluído, cancelado, arquivado — aos 60 dias;
 *   · os ABANDONADOS a meio, que nunca tiveram fim, aos 90;
 *   · e NUNCA um pedido que tenha produzido trabalho, seja qual for a idade.
 *
 * A garantia é a que faltava. A carteira do profissional é calculada a partir
 * das linhas de `negociacoes`: apagar um trabalho concluído tirava-lhe o total
 * ganho e o movimento que explica o saldo. "Quero que garanta que os valores
 * gerados pelos trabalhos concluídos não sejam apagados das contas dos pros
 * nem da nossa base."
 *
 * O CÓDIGO FALAVA DELA COMO SE EXISTISSE
 *
 * Havia o acontecimento `pedido_expurgado`, a opção "só a purga automática o
 * usa", e comentários a contar com ela — e não havia cron nenhum. Nada apagava
 * um pedido sozinho, e apagar à mão deixava as fotografias no Blob para sempre.
 * Verificado a 10-09-2026.
 *
 * O que fica: o registo permanente, com o retrato de cada pedido apagado — é o
 * histórico para um processo judicial. O que sai: a linha do pedido, as
 * negociações, e as imagens. Ver `purgarPedidosTerminados` em db.ts para o
 * que conta como terminado e o que nunca se purga.
 */
export async function GET(req: NextRequest) {
  // Falha fechada: sem CRON_SECRET definido, a rota recusa. Aberta, seria um
  // endereço público que apaga pedidos.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/purgar-pedidos] CRON_SECRET não definido — recusado");
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }
  // Em tempo constante — ver segredo-igual.ts.
  if (!bearerConfere(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    /*
     * CADA NOITE CARIMBADA — 27-10-2026 (d7): ok só com todos os passos de
     * pé; o motivo diz qual falhou. E as falhas dos passos secundários vão à
     * cabeça do resumo da noite (`passos-da-purga.ts`).
     */
    const saida = await carimbarPassagem(
      "purgar-pedidos",
      async () => {
    const passosQueFalharam: string[] = [];
    const armada = purgaArmada();
    /*
     * AS REGRAS NOVAS (d32, 26-10-2026) SÓ VALEM COM O INTERRUPTOR LIGADO.
     *
     * Desligado — e é assim que nasce —, a purga corre exactamente como corria
     * (com a parte D, que só protege), e as regras novas correm à parte, em
     * ENSAIO: contam e escrevem o que fariam. Ligado pelo dono nas Configs →
     * Retenção, e com a purga armada, a escolha dos pedidos a apagar passa a
     * ser a das regras novas, e as outras partes fazem-se a sério.
     *
     * Uma falha a ler o interruptor dá «desligado» (`interruptorDasRegrasNovas`).
     */
    const interruptor = await interruptorDasRegrasNovas();
    const novasValem = armada && interruptor.ligado;
    const r = novasValem
      ? await purgarComAsRegrasNovas({ aSerio: true })
      : await purgarPedidosTerminados(DIAS_DE_RETENCAO_DOS_PEDIDOS, {
          aSerio: armada,
          // Os abandonados esperam mais: nunca tiveram fim a partir do qual contar.
          diasDosAbandonados: DIAS_PARA_OS_ABANDONADOS,
        });

    /*
     * E O BLOCO DE NOTAS DO ASSISTENTE, na mesma passagem e a seguir.
     *
     * A seguir de propósito: a purga acabou de apagar pedidos, e cada um deles
     * pode ter deixado uma linha em `whatsappRecolhas` a apontar para um
     * pedido que já não existe — com o nome e a morada do cliente lá dentro.
     * Corrê-la antes deixava essas para a noite seguinte.
     *
     * Uma falha aqui não pode estragar o relatório da purga, que é a parte que
     * interessa: fica contada como zero e escrita nos registos.
     */
    const recolhas = await passoSecundario(
      "recolhas do WhatsApp",
      () => purgarRecolhasDoWhatsApp(DIAS_PARA_AS_RECOLHAS_DO_WHATSAPP, { aSerio: armada }),
      { abandonadas: 0, orfas: 0, aSerio: armada },
      passosQueFalharam,
    );
    // E as fotografias que esperavam por um pedido que nunca nasceu — com o
    // ficheiro do Blob. Ver `purgarFotosPendentesDoWhatsApp`.
    const fotosPendentes = await passoSecundario(
      "fotografias pendentes do WhatsApp",
      () => purgarFotosPendentesDoWhatsApp(DIAS_DAS_FOTOS_SEM_PEDIDO, { aSerio: armada }),
      0,
      passosQueFalharam,
    );

    /*
     * A CÓPIA DOS PEDIDOS APAGADOS, ao fim de 12 meses — 01-10-2026.
     *
     * *«Anonimizar ao fim de 12 meses»* — decisão do dono. A linha fica, sem
     * nome, email, texto livre nem fotografias. Com o mesmo `PURGA_ARMADA` da
     * purga: não tem volta, e a seco só conta. A seguir à purga, para as
     * contas desta noite já estarem feitas; uma falha aqui não estraga o
     * relatório dela.
     */
    // Quem parou a meio na página inicial e não terminou (14-10-2026).
    const contactosAMeio = await passoSecundario(
      "contactos a meio",
      () => purgarContactosAMeio(DIAS_DOS_CONTACTOS_A_MEIO, { aSerio: armada }),
      0,
      passosQueFalharam,
    );
    if (contactosAMeio > 0) {
      console.warn(
        `[cron/purgar-pedidos] contactos a meio com mais de ${DIAS_DOS_CONTACTOS_A_MEIO} dias: ${contactosAMeio}` +
          (armada ? " apagado(s)" : " (a purga não está armada: só contados)"),
      );
    }

    const arquivo = await passoSecundario(
      "arquivo dos apagados",
      () => anonimizarArquivoAntigo(MESES_ATE_ANONIMIZAR_O_ARQUIVO, { aSerio: armada }),
      { anonimizadas: 0, restantes: 0, aSerio: armada },
      passosQueFalharam,
    );
    const arquivoEmPalavras =
      arquivo.anonimizadas > 0
        ? (r.aSerio ? ". Do arquivo dos apagados, " : ". Do arquivo dos apagados, seriam ") +
          `${arquivo.anonimizadas} cópia(s) anonimizada(s) (mais de ${MESES_ATE_ANONIMIZAR_O_ARQUIVO} meses)` +
          (arquivo.restantes > 0 ? `, ${arquivo.restantes} para a noite seguinte` : "")
        : "";

    /*
     * OS EVENTOS QUE FICARAM DE OUTRAS NOITES, tentados outra vez.
     *
     * Estes correm SEMPRE, armada ou não: não apagam pedido nenhum, arrumam o
     * que já foi apagado. Um pedido cujo evento não saiu é dado pessoal a mais
     * na agenda — e a passagem seguinte é a única coisa que o tira de lá sem
     * alguém se lembrar.
     */
    const eventos = await passoSecundario(
      "eventos por apagar da agenda",
      () => tentarOsEventosPorApagar(50),
      { tentados: 0, apagados: 0, ficaram: 0, desistidos: 0 },
      passosQueFalharam,
    );
    if (eventos.tentados > 0) {
      console.warn(
        `[cron/purgar-pedidos] eventos atrasados: ${eventos.tentados} tentado(s), ` +
          `${eventos.apagados} apagado(s), ${eventos.ficaram} ainda por sair, ${eventos.desistidos} desistido(s)`,
      );
    }

    /*
     * OS ERROS DA APP CLYON PRO COM MAIS DE 30 DIAS — 28-10-2026 (d9).
     *
     * À parte das regras dos pedidos: não escolhe nem apaga pedido nenhum.
     * Com o mesmo `PURGA_ARMADA` (a seco só conta), e uma falha aqui não
     * estraga o relatório da purga.
     */
    const errosDaApp = await passoSecundario(
      "erros da app",
      () => purgarErrosDaApp(DIAS_DOS_ERROS_DA_APP, { aSerio: armada }),
      0,
      passosQueFalharam,
    );
    /*
     * AS CONVERSAS DA CLYON — 30-10-2026 (decisão 3b): as de pedido 6 meses
     * depois de fechar, o suporte 90 dias sem mensagens. À parte dos pedidos,
     * com o mesmo `PURGA_ARMADA`.
     */
    const conversasApagadas = await passoSecundario(
      "conversas",
      () =>
        purgarConversas(
          { mesesDoPedido: MESES_DAS_CONVERSAS_DE_PEDIDO, diasDoSuporte: DIAS_DAS_CONVERSAS_DE_SUPORTE },
          { aSerio: armada },
        ),
      0,
      passosQueFalharam,
    );
    /*
     * A PRESENÇA DAS ASSISTENTES — 31-10-2026: os blocos e as marcações da
     * agenda com mais de 24 meses. À parte dos pedidos, com o mesmo
     * `PURGA_ARMADA` (a seco só conta).
     */
    const presencaApagada = await passoSecundario(
      "presença no backoffice",
      () => purgarPresencaAntiga(MESES_DA_PRESENCA_NO_BACKOFFICE, { aSerio: armada }),
      0,
      passosQueFalharam,
    );
    const errosDaAppEmPalavras =
      (errosDaApp > 0
        ? (armada ? ". Dos erros da app, " : ". Dos erros da app, seriam ") +
          `${errosDaApp} apagado(s) (mais de ${DIAS_DOS_ERROS_DA_APP} dias)`
        : "") +
      (conversasApagadas > 0
        ? (armada ? ". Das conversas, " : ". Das conversas, seriam ") +
          `${conversasApagadas} apagada(s) (pedido fechado há ${MESES_DAS_CONVERSAS_DE_PEDIDO} meses, suporte ${DIAS_DAS_CONVERSAS_DE_SUPORTE} dias sem mensagens)`
        : "") +
      (presencaApagada > 0
        ? (armada ? ". Da presença no backoffice, " : ". Da presença no backoffice, seriam ") +
          `${presencaApagada} linha(s) apagada(s) (mais de ${MESES_DA_PRESENCA_NO_BACKOFFICE} meses)`
        : "");

    /*
     * AS REGRAS NOVAS DA NOITE — A, C, E, F e G (a B correu acima, na purga).
     *
     * Em ensaio enquanto o interruptor estiver desligado: `aSerio` é o mesmo
     * `novasValem` que escolheu a purga. Uma falha aqui não estraga o resumo
     * da purga, que é a prova de que ela correu — fica escrita como falha.
     */
    let novas: RegrasNovasDaNoite | null = null;
    let novasFalharam: string | null = null;
    try {
      novas = await regrasNovasDaNoite({ aSerio: novasValem });
    } catch (e) {
      novasFalharam = e instanceof Error ? e.message : String(e);
      console.error("[cron/purgar-pedidos] regras novas:", e);
      passosQueFalharam.push(`regras novas: ${novasFalharam.replace(/\s+/g, " ").slice(0, 160)}`);
    }
    const novasEmPalavras = novas
      ? `. ${regrasNovasEmPalavras(novas)}`
      : `. Regras novas: o ${novasValem ? "passo" : "ensaio"} falhou esta noite (${novasFalharam}).`;

    /*
     * As recolhas ditas por palavras, e só quando há alguma. Uma linha a dizer
     * "0 recolhas" todas as noites durante meses é ruído que ensina a não ler
     * o resumo — e é justamente este resumo que decide se a purga se arma.
     */
    const recolhasEmPalavras =
      recolhas.abandonadas > 0 || recolhas.orfas > 0 || fotosPendentes > 0
        ? (r.aSerio ? ". Do assistente saíram " : ". E do assistente sairiam ") +
          [
            recolhas.abandonadas > 0 ? `${recolhas.abandonadas} recolha(s) abandonada(s)` : null,
            recolhas.orfas > 0 ? `${recolhas.orfas} sem pedido nenhum por trás` : null,
            fotosPendentes > 0 ? `${fotosPendentes} fotografia(s) que nunca chegaram a pedido` : null,
          ]
            .filter(Boolean)
            .join(" e ")
        : "";

    const eventosEmPalavras =
      eventos.tentados > 0
        ? `. Da lista de atrasados: ${eventos.apagados} saíram da agenda` +
          (eventos.ficaram > 0 ? `, ${eventos.ficaram} ainda por sair` : "") +
          (eventos.desistidos > 0 ? `, ${eventos.desistidos} desistido(s) ao fim de muitas noites` : "")
        : "";

    /*
     * UMA LINHA TODAS AS NOITES — a prova de vida (d32, parte G).
     *
     * *«Uma linha no registo todas as noites, mesmo sem nada para fazer
     * («purga correu, 0 elegíveis», com as contagens do ensaio).»* Escrevia-se
     * só quando havia alguma coisa feita; a 26-10 a purga correu e não ficou
     * nada escrito, e uma noite sem linha tanto podia ser «nada a fazer» como
     * «não correu». Agora escreve-se sempre — a seco, a sério, e com zero.
     */
    // Os contactos a meio entram no resumo (27-10-2026, d7): dantes só na consola.
    const contactosEmPalavras = contactosAMeioEmPalavras(contactosAMeio, r.aSerio, DIAS_DOS_CONTACTOS_A_MEIO);

    // Uma noite com um passo partido nunca é «nada apagado» — d7.
    const nadaParaFazer =
      passosQueFalharam.length === 0 &&
      contactosAMeio === 0 &&
      r.expurgados === 0 &&
      r.falhados.length === 0 &&
      r.restantes === 0 &&
      recolhas.abandonadas === 0 &&
      recolhas.orfas === 0 &&
      fotosPendentes === 0 &&
      eventos.tentados === 0 &&
      errosDaApp === 0 &&
      conversasApagadas === 0 &&
      presencaApagada === 0 &&
      arquivo.anonimizadas === 0;
    await registarSemFalhar({
      acontecimento: "pedido_expurgado",
      autorTipo: "sistema",
      autorNome: "retenção",
      resumo: resumoComAsFalhas(passosQueFalharam, r.aSerio && nadaParaFazer
        ? `Purga correu${novasValem ? " com as regras novas" : ""}: ${r.elegiveis} elegíveis, nada apagado` + novasEmPalavras
        : r.aSerio
        ? `Purga (${novasValem ? "regras novas — " : ""}${DIAS_DE_RETENCAO_DOS_PEDIDOS} dias os terminados, ${DIAS_PARA_OS_ABANDONADOS} os abandonados): ${r.expurgados} pedido(s) expurgado(s), ` +
          `${r.fotosApagadas} fotografia(s) apagada(s)` +
          (r.eventosApagados > 0 ? `, ${r.eventosApagados} evento(s) tirado(s) da agenda` : "") +
          (r.eventosQueFicaram > 0
            ? `, ${r.eventosQueFicaram} evento(s) ficaram na agenda e têm de sair à mão`
            : "") +
          /*
           * O 404 à parte, e com o que ele quer dizer escrito ao lado.
           *
           * A Google responde 404 tanto a «este evento já não existe» como a
           * «esta agenda não está partilhada contigo». Um é normal; muitos
           * de seguida são a partilha da agenda a ter caído — e é preciso
           * que isso se leia como avaria, e não como trabalho feito.
           */
          (r.eventosNaoEncontrados > 0
            ? `, ${r.eventosNaoEncontrados} com 404 (evento já apagado, ou a agenda deixou de estar partilhada com a service account)`
            : "") +
          (r.falhados.length > 0 ? `, ${r.falhados.length} falhado(s)` : "") +
          (r.restantes > 0 ? `, ${r.restantes} ainda por fazer` : "") +
          recolhasEmPalavras +
          contactosEmPalavras +
          arquivoEmPalavras +
          eventosEmPalavras +
          errosDaAppEmPalavras +
          novasEmPalavras
        : `MODO SECO — nada foi apagado. Apagaria ${r.expurgados} pedido(s), ` +
          `${r.fotosApagadas} fotografia(s) e ${r.eventosApagados} evento(s) da agenda do Google` +
          (r.restantes > 0 ? `, e ficariam ${r.restantes} para a passagem seguinte` : "") +
          recolhasEmPalavras +
          contactosEmPalavras +
          arquivoEmPalavras +
          eventosEmPalavras +
          errosDaAppEmPalavras +
          `. Para armar, ponha PURGA_ARMADA=sim na Vercel` +
          novasEmPalavras),
      detalhe: {
        passosQueFalharam,
        contactosAMeio,
        falhados: r.falhados,
        restantes: r.restantes,
        aSerio: r.aSerio,
        naMira: r.naMira,
        eventosApagados: r.eventosApagados,
        eventosQueFicaram: r.eventosQueFicaram,
        eventosNaoEncontrados: r.eventosNaoEncontrados,
        recolhasAbandonadas: recolhas.abandonadas,
        recolhasOrfas: recolhas.orfas,
        fotosPendentesDoWhatsApp: fotosPendentes,
        eventosAtrasados: eventos,
        arquivoAnonimizadas: arquivo.anonimizadas,
        arquivoRestantes: arquivo.restantes,
        errosDaAppApagados: errosDaApp,
        conversasApagadas,
        presencaApagada,
        /*
         * As contagens das regras novas, inteiras — o resumo só leva a frase.
         * Sem a lista dos nomes dos ficheiros sem referência: o registo é
         * para sempre, e um nome de ficheiro pode dizer de quem é.
         */
        regrasNovas: novas ? { ...novas, e: { ...novas.e, lista: [] } } : { falhou: novasFalharam },
        regrasNovasLigadas: novasValem,
      },
    });

    if (!r.aSerio) {
      console.warn(
        `[cron/purgar-pedidos] MODO SECO: apagaria ${r.expurgados} pedido(s) e ${r.fotosApagadas} fotografia(s). ` +
          `PURGA_ARMADA=sim para valer a sério.`,
      );
    }

    // Nunca em silêncio: um tecto que não se anuncia lê-se como "estava tudo feito".
    if (r.restantes > 0) {
      console.warn(`[cron/purgar-pedidos] ${r.restantes} pedido(s) elegível(eis) ficaram para a próxima passagem`);
    }
    for (const f of r.falhados) {
      console.error(`[cron/purgar-pedidos] pedido #${f.pedidoId} não foi expurgado: ${f.erro}`);
    }

    return { r, recolhas, arquivo, novas, novasValem, passosQueFalharam, contactosAMeio };
      },
      (n) => ({
        ok: n.passosQueFalharam.length === 0 && n.r.falhados.length === 0,
        motivo:
          [
            n.passosQueFalharam.length > 0 ? `${n.passosQueFalharam.length} passo(s) falharam: ${n.passosQueFalharam.join("; ")}` : null,
            n.r.falhados.length > 0 ? `${n.r.falhados.length} pedido(s) não expurgado(s)` : null,
          ]
            .filter(Boolean)
            .join(" · ") || (n.r.aSerio ? `${n.r.expurgados} pedido(s) expurgado(s)` : "modo seco"),
        detalhe: { expurgados: n.r.expurgados, restantes: n.r.restantes, aSerio: n.r.aSerio, contactosAMeio: n.contactosAMeio },
      }),
    );
    const { r, recolhas, arquivo, novas, novasValem, passosQueFalharam } = saida;
    return NextResponse.json({
      ok: true,
      ...r,
      recolhas,
      arquivo,
      regrasNovas: novas,
      regrasNovasLigadas: novasValem,
      passosQueFalharam,
    });
  } catch (error) {
    console.error("[cron/purgar-pedidos]", error);
    return NextResponse.json({ error: "Erro ao purgar" }, { status: 500 });
  }
}
