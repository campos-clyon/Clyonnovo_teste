import { NextRequest, NextResponse } from "next/server";
import { mudancasDoPerfil } from "@/lib/mudancas-do-perfil";
import {
  perfilDoProfissional,
  avaliacoesDoProfissional,
  actualizarPerfilDoProfissional,
  apagarFotosDoBlob,
  fotosDaViatura,
  urlDaFotoDaViatura,
  invalidarVerificacaoDaGuia,
  custosFixosDeJson,
  trabalhosConcluidosDoProfissional,
} from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
  renovarSessaoSePreciso,
} from "@/lib/profissional-auth";
import { ibanEncurtado } from "@/lib/iban";
import { mediaDasAvaliacoes } from "@/lib/avaliacao-profissional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O perfil do profissional, visto e mudado por ele próprio.
 *
 * O que está aqui decide a que pedidos ele chega: categorias, zonas e raio.
 * Sem esta página, mudar de área ou passar a fazer mais um serviço obrigava a
 * escrever-nos — e o mais provável era simplesmente deixar de receber trabalho
 * sem perceber porquê.
 *
 * O que NÃO se muda aqui: o estado da conta e a verificação da guia. Um
 * profissional que se aprovasse a si próprio tornava a aprovação um enfeite.
 */

/**
 * As categorias e as zonas estão gravadas como JSON — é o que `db.ts` escreve
 * na inscrição e o que `listaDeJson` lê para decidir a elegibilidade.
 *
 * Eu tinha escrito isto a separar por vírgulas. Não dava erro nenhum: gravava,
 * o ecrã mostrava tudo bem, e no dia seguinte o profissional deixava de receber
 * pedidos porque a regra de elegibilidade já não conseguia ler as categorias
 * dele. O tolerar-vírgulas aqui é só para o caso de alguma linha já ter sido
 * gravada assim.
 */
function listaGravada(v: unknown): string[] {
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const l = JSON.parse(v);
    if (Array.isArray(l)) return l.filter((x): x is string => typeof x === "string");
  } catch {
    /* não é JSON — cai para o formato antigo */
  }
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

export async function GET(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const p = await perfilDoProfissional(sessao.providerId);
    if (!p) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

    // A média e quantas. A média sozinha mente: 5,0 de uma avaliação não é
    // melhor do que 4,6 de quarenta.
    const avaliacoes = await avaliacoesDoProfissional(sessao.providerId);
    const trabalhosConcluidos = await trabalhosConcluidosDoProfissional(sessao.providerId);
    const reputacao = mediaDasAvaliacoes(
      avaliacoes.map((a) => ({ estrelas: Number(a.estrelas) })),
    );

    const iban = typeof p.iban === "string" ? p.iban : "";

    const resposta = NextResponse.json({
      perfil: {
        nome: p.name ?? "",
        email: p.email ?? "",
        telefone: p.phone ?? "",
        nif: p.nif ?? "",
        cidade: p.city ?? "",
        /* Onde a base ficou mesmo. Sem isto o painel não podia dizer-lhe se
           ela está confirmada no mapa ou se é um palpite sobre um texto. */
        baseLat: p.baseLat != null ? Number(p.baseLat) : null,
        baseLng: p.baseLng != null ? Number(p.baseLng) : null,
        moradaFiscal: p.moradaFiscal ?? "",
        codigoPostalFiscal: p.codigoPostalFiscal ?? "",
        localidadeFiscal: p.localidadeFiscal ?? "",
        /*
         * A fotografia da viatura. Null quando ainda não pôs nenhuma — e o
         * ecrã convida, em vez de mostrar uma moldura vazia.
         */
        tipoVeiculo: p.tipoVeiculo ?? "",
        fotoViaturaUrl: (p.fotoViaturaUrl as string | null) ?? null,
        /*
         * A LISTA INTEIRA — 19-09-2026, quando as viaturas passaram a ser
         * várias. `fotoViaturaUrl` continua a sair porque é a primeira, e é
         * dela que vivem o cartão do perfil e a ficha do backoffice.
         */
        fotosViatura: await fotosDaViatura(sessao.providerId),
        categorias: listaGravada(p.categorias),
        zonas: listaGravada(p.zonas),
        raioKm: p.raioKm != null ? Number(p.raioKm) : 30,
        // Os custos dele, para a sugestão de valor. Nulos = referência da CLYON.
        custoKm: p.custoKm != null ? Number(p.custoKm) : null,
        custoHoraPessoa: p.custoHoraPessoa != null ? Number(p.custoHoraPessoa) : null,
        pessoasNaEquipa: p.pessoasNaEquipa != null ? Number(p.pessoasNaEquipa) : null,
        custosFixosAnuais: custosFixosDeJson(p.custosFixosJson),
        trabalhosPorMes: p.trabalhosPorMes != null ? Number(p.trabalhosPorMes) : null,
        margemPercent: p.margemPercent != null ? Number(p.margemPercent) : null,
        horasPorTrabalho: p.horasPorTrabalho != null ? Number(p.horasPorTrabalho) : null,
        riscoPercent: p.riscoPercent != null ? Number(p.riscoPercent) : null,
        /*
         * Os avisos de pedido novo no WhatsApp — 20-09-2026.
         *
         * É ele quem liga e quem desliga, e mais ninguém: "Só ele, no painel".
         * A data sai junto porque o cartão a mostra — «ligado desde 20 de
         * Setembro» é o que responde à pergunta que ele faz quando estranha a
         * primeira mensagem.
         */
        avisosNoWhatsApp: Number(p.whatsappAvisos) === 1,
        avisosNoWhatsAppEm: (p.whatsappAvisosEm as Date | null) ?? null,
        emiteFatura: Number(p.emiteFatura) === 1,
        regimeIva: String(p.regimeIva ?? "isento"),
        emiteGuiaTransporte: Number(p.emiteGuiaTransporte) === 1,
        numeroTransportador: p.numeroTransportador ?? "",
        guiaVerificada: p.guiaVerificadaEm != null,
        estado: String(p.estado ?? "pendente"),
        // Nunca o IBAN completo: esta resposta abre-se em qualquer sítio onde
        // ele deixe a sessão iniciada.
        iban: iban ? ibanEncurtado(iban) : "",
        temIban: Boolean(iban),
        ibanTitular: p.ibanTitular ?? "",
        mbway: p.mbway ?? "",
        desde: p.createdAt ?? null,
        avaliacao: reputacao.media,
        quantasAvaliacoes: reputacao.quantas,
        /* O que ele ja fez, para o cartao do perfil. Ver distincoes-do-profissional. */
        trabalhosConcluidos,
        // A lista toda, não as cinco últimas: o ecrã das avaliações mostra-as
        // todas, e a consulta já traz no máximo cem.
        ultimasAvaliacoes: avaliacoes.map((a) => ({
          estrelas: Number(a.estrelas),
          comentario: a.comentario,
          em: a.avaliadoEm,
        })),
      },
    });

    /*
     * A SESSAO RENOVA-SE ENQUANTO ELE USA O PAINEL — 15-09-2026.
     *
     * "Garanta que funcione para eles nao terem de entrar com senha varias
     * vezes ao dia." Os trinta dias contavam-se do dia em que ele entrou: ao
     * trigesimo primeiro era posto fora por muito que tivesse trabalhado todos
     * os dias. Agora contam-se da ultima vez que ca esteve.
     *
     * AQUI e nao noutra rota porque o painel pede SEMPRE o perfil — ao abrir e
     * de minuto a minuto. E a unica que se pode prometer que corre em todas as
     * visitas.
     *
     * So passada metade do prazo, e so a quem pediu para ficar ligado: as duas
     * condicoes estao em `devePrologar`. Falhar nao impede a resposta.
     */
    await renovarSessaoSePreciso(resposta, sessao);
    return resposta;
  } catch (error) {
    console.error("[profissionais/perfil GET]", error);
    return NextResponse.json({ error: "Erro ao carregar o perfil" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const sessao = await verificarSessaoDoProfissional(
    req.cookies.get(COOKIE_SESSAO_PROFISSIONAL)?.value,
  );
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // As regras de cada campo vivem num sítio só, partilhado com o backoffice.
  // Ver `mudancas-do-perfil.ts`.
  const { erros, mudancas, guiaMudou } = await mudancasDoPerfil(corpo);

  if (erros.length > 0) {
    return NextResponse.json({ error: erros[0].mensagem, erros }, { status: 400 });
  }

  try {
    /*
     * A FOTOGRAFIA DE ANTES TEM DE SAIR DO BLOB.
     *
     * Este é o outro caminho por onde `fotoViaturaUrl` muda — o do envio é a
     * rota /foto-viatura, que já trata do seu. Aqui a coluna pode ser posta a
     * null (tirar a fotografia do perfil), e até 14-09-2026 isso só apagava o
     * ponteiro: o ficheiro continuava a responder no endereço público onde
     * estava, com a matrícula à vista, sem nada na base a dizer que existia.
     *
     * Lê-se ANTES do UPDATE — depois já não há por onde saber qual era.
     */
    const fotoAntiga =
      "fotoViaturaUrl" in mudancas ? await urlDaFotoDaViatura(sessao.providerId) : null;

    await actualizarPerfilDoProfissional(sessao.providerId, mudancas);

    // Só depois de a base já não lhe apontar: ao contrário, uma falha a meio
    // deixava o perfil a mostrar uma imagem partida.
    if (fotoAntiga && fotoAntiga !== mudancas.fotoViaturaUrl) {
      const saiu = await apagarFotosDoBlob([fotoAntiga]).catch(() => 0);
      if (saiu === 0) console.error("[profissionais/perfil PUT] a anterior ficou no Blob:", fotoAntiga);
    }

    // Mexer na guia volta a pôr a verificação por fazer. O distintivo que o
    // cliente vê tem de continuar a garantir um número que alguém confirmou.
    if (guiaMudou) await invalidarVerificacaoDaGuia(sessao.providerId);

    return NextResponse.json({ ok: true, guiaPorVerificar: guiaMudou });
  } catch (error) {
    console.error("[profissionais/perfil PUT]", error);
    return NextResponse.json({ error: "Não foi possível guardar" }, { status: 500 });
  }
}
