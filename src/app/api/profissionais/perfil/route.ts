import { NextRequest, NextResponse } from "next/server";
import { geocodificarLocalidade } from "@/lib/geocodificar";
import { urlDoNossoBlob } from "@/lib/url-externo-seguro";
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
  tarifaDasMudancasDe,
  palavraPasseGuardada,
} from "@/lib/db";
import { palavraPasseConfere } from "@/lib/profissional-auth";
import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { instanteDaBase } from "@/lib/hora-de-lisboa";
import {
  CAMPOS_DE_PAGAMENTO,
  CAMPO_DA_PALAVRA_PASSE,
  CODIGOS_DA_PALAVRA_PASSE,
  camposDePagamentoMudados,
  mudancaDosDadosDePagamento,
  titularBateComONome,
} from "@/lib/dados-de-pagamento-mudados";
import { enviarEmailDosDadosDePagamento } from "@/lib/email-dados-de-pagamento-do-profissional";
import { precosDasMudancasNaConta } from "@/lib/precos-das-mudancas-do-profissional";
import { RUBRICAS_DOS_CUSTOS_FIXOS } from "@/lib/custos-fixos-do-profissional";
import { TIPOS_DE_VEICULO, tipoDeVeiculoValido } from "@/lib/convite-profissional";
import {
  renovarSessaoSePreciso,
  sessaoVemDaApp,
  tokenDoProfissional,
} from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { guiaMudouDeFacto } from "@/lib/guia-mudou";
import { avisoDoCodigoApa, destinoDosResiduosLimpo } from "@/lib/guia-de-residuos";
import {
  nifValido,
  telefoneValido,
  regimeDeIvaValido,
  codigoPostalValido,
  normalizarCodigoPostal,
  categoriasDoCorpo,
  RAIO_MAXIMO_KM,
  RAIO_MINIMO_KM,
  pareceMorada,
  temSinaisDeHtml,
  MENSAGEM_SEM_SINAIS,
} from "@/lib/inscricao-profissional";
import { ibanValido, normalizarIban, ibanEncurtado } from "@/lib/iban";
import { lerMbway } from "@/lib/mbway";
import { normalizarCategorias } from "@/lib/service-categories";
import { mediaDasAvaliacoes } from "@/lib/avaliacao-profissional";
import { margemDeReferenciaPercent } from "@/lib/sugestao-para-o-profissional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O perfil do profissional, visto e mudado por ele próprio.
 *
 * O que está aqui decide a que pedidos ele chega: categorias, base e raio.
 * As zonas saíram a 29-10-2026: a coluna fica na base, sem uso, e o que
 * chegue com elas é ignorado.
 * Sem esta página, mudar de área ou passar a fazer mais um serviço obrigava a
 * escrever-nos — e o mais provável era simplesmente deixar de receber trabalho
 * sem perceber porquê.
 *
 * O que NÃO se muda aqui: o estado da conta e a verificação da guia. Um
 * profissional que se aprovasse a si próprio tornava a aprovação um enfeite.
 */

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
}

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
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const p = await perfilDoProfissional(sessao.providerId);
    if (!p) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

    // A média e quantas. A média sozinha mente: 5,0 de uma avaliação não é
    // melhor do que 4,6 de quarenta.
    const avaliacoes = await avaliacoesDoProfissional(sessao.providerId);
    const trabalhosConcluidos = await trabalhosConcluidosDoProfissional(sessao.providerId);
    // A margem que entra quando ele não pôs a dele — a das Configs, a mesma da
    // sugestão (d11, 28-10-2026). O painel e a app mostram esta, e não «40».
    const margemDeReferencia = await margemDeReferenciaPercent();
    const reputacao = mediaDasAvaliacoes(
      avaliacoes.map((a) => ({ estrelas: Number(a.estrelas) })),
    );

    const iban = typeof p.iban === "string" ? p.iban : "";

    // Os preços das mudanças (11-11-2026): o estado para a linha do menu e para
    // o cartão do perfil, a quem tem «Mudanças». Se a leitura falhar, o perfil
    // sai na mesma, sem o estado.
    const categoriasDele = normalizarCategorias(listaGravada(p.categorias));
    let precosDasMudancas: ReturnType<typeof precosDasMudancasNaConta> = null;
    if (categoriasDele.includes("mudancas")) {
      try {
        precosDasMudancas = precosDasMudancasNaConta(await tarifaDasMudancasDe(sessao.providerId), true);
      } catch (e) {
        console.error("[profissionais/perfil GET] preços das mudanças", e instanceof Error ? e.message : e);
      }
    }

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
         * dela que vive o cartão do perfil.
         */
        fotosViatura: await fotosDaViatura(sessao.providerId),
        // Em grupos (29-10-2026): um serviço antigo gravado conta pelo seu grupo.
        categorias: categoriasDele,
        precosDasMudancas,
        raioKm: p.raioKm != null ? Number(p.raioKm) : 30,
        // Os custos dele, para a sugestão de valor. Nulos = referência da CLYON.
        custoKm: p.custoKm != null ? Number(p.custoKm) : null,
        custoHoraPessoa: p.custoHoraPessoa != null ? Number(p.custoHoraPessoa) : null,
        pessoasNaEquipa: p.pessoasNaEquipa != null ? Number(p.pessoasNaEquipa) : null,
        custosFixosAnuais: custosFixosDeJson(p.custosFixosJson),
        trabalhosPorMes: p.trabalhosPorMes != null ? Number(p.trabalhosPorMes) : null,
        margemPercent: p.margemPercent != null ? Number(p.margemPercent) : null,
        /** Em percentagem (40 = 40 %): a que vale quando `margemPercent` é null. */
        margemDeReferenciaPercent: margemDeReferencia,
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
        /*
         * A GUIA, d5 (12-11-2026): o destino do entulho e SE há prova — o nome
         * do ficheiro e a data, nunca o endereço (só o administrador o abre).
         * O formato do código vem como aviso, para a app o mostrar igual.
         */
        destinoDosResiduos: p.destinoDosResiduos ?? "",
        provaDaGuia: p.provaDaGuiaEm
          ? { nome: (p.provaDaGuiaNome as string | null) ?? null, em: p.provaDaGuiaEm as Date }
          : null,
        avisoDoCodigoApa: avisoDoCodigoApa((p.numeroTransportador as string | null) ?? ""),
        guiaVerificada: p.guiaVerificadaEm != null,
        estado: String(p.estado ?? "pendente"),
        // Nunca o IBAN completo: esta resposta abre-se em qualquer sítio onde
        // ele deixe a sessão iniciada.
        iban: iban ? ibanEncurtado(iban) : "",
        temIban: Boolean(iban),
        ibanTitular: p.ibanTitular ?? "",
        mbway: p.mbway ?? "",
        /*
         * QUANDO MUDARAM OS DADOS DE PAGAMENTO, e se o titular bate com o nome
         * (d1, 12-11-2026) — o painel e a app mostram o mesmo aviso que os
         * Levantamentos do backoffice. Null = não se sabe (contas de antes).
         */
        ibanMudadoEm: instanteDaBase(p.ibanMudadoEm as string | Date | null)?.toISOString() ?? null,
        ibanMudadoRecente:
          mudancaDosDadosDePagamento(instanteDaBase(p.ibanMudadoEm as string | Date | null))?.recente ?? false,
        titularBateComONome: iban
          ? titularBateComONome(
              p.ibanTitular as string | null,
              p.name as string | null,
              p.responsavel as string | null,
            )
          : null,
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
     *
     * A app nao leva cookie (18-10-2026): renova pela rota /sessao, que lhe
     * devolve o token. Um cookie posto aqui ficava guardado no telemovel e
     * continuava a abrir a conta depois de ele sair da app.
     */
    if (!sessaoVemDaApp(req)) await renovarSessaoSePreciso(resposta, sessao);
    return resposta;
  } catch (error) {
    console.error("[profissionais/perfil GET]", error);
    return NextResponse.json({ error: "Erro ao carregar o perfil" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const sessao = await sessaoActivaDoProfissional(tokenDoProfissional(req));
  if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const erros: Array<{ campo: string; mensagem: string }> = [];
  const mudancas: Record<string, unknown> = {};

  // Cada campo só é tocado se vier no corpo. Um PUT parcial é o que permite ao
  // ecrã gravar uma secção de cada vez sem apagar o resto por omissão.
  if ("nome" in corpo) {
    const nome = texto(corpo.nome);
    if (nome.length < 2) {
      erros.push({ campo: "nome", mensagem: "Indique o nome." });
    } else if (temSinaisDeHtml(nome)) {
      // Vai para a página pública e para os dados estruturados dela — ver
      // `temSinaisDeHtml`. A mesma regra da inscrição.
      erros.push({ campo: "nome", mensagem: MENSAGEM_SEM_SINAIS.nome });
    } else if (pareceMorada(nome)) {
      /*
       * A mesma regra da inscrição, e pela mesma razão.
       *
       * A validação estava só na inscrição, e isso deixava a porta do lado de
       * dentro aberta: corrigia-se o nome uma vez e podia voltar a ser uma
       * morada no dia seguinte, aqui.
       *
       * Quem trata do nome tem de o fazer nos dois sítios, porque é o mesmo
       * campo e o mesmo estrago: é isto que o cliente vê ao escolher quem lhe
       * entra em casa.
       */
      erros.push({
        campo: "nome",
        mensagem:
          "Isto parece uma morada. Aqui vai o seu nome ou o da empresa — é o que o cliente vê.",
      });
    } else {
      mudancas.name = nome;
    }
  }

  if ("telefone" in corpo) {
    const t = texto(corpo.telefone);
    if (!telefoneValido(t)) erros.push({ campo: "telefone", mensagem: "Telefone inválido." });
    else mudancas.phone = t;
  }

  if ("nif" in corpo) {
    const nif = texto(corpo.nif);
    if (nif && !nifValido(nif)) erros.push({ campo: "nif", mensagem: "NIF inválido." });
    else mudancas.nif = nif || null;
  }

  if ("cidade" in corpo) {
    const c = texto(corpo.cidade);
    if (!c) erros.push({ campo: "cidade", mensagem: "Indique a cidade." });
    else if (temSinaisDeHtml(c)) erros.push({ campo: "cidade", mensagem: MENSAGEM_SEM_SINAIS.cidade });
    else {
      mudancas.city = c;
      /*
       * MUDAR A MORADA TEM DE MUDAR O PONTO NO MAPA.
       *
       * A base era geocodificada UMA vez, na inscrição, e nunca mais. Quem
       * se mudasse — ou quem se tivesse enganado a escrever a morada —
       * trocava o texto e ficava com as coordenadas antigas: as distâncias
       * continuavam a ser medidas desde a casa onde já não vive, e o raio
       * dele passava a apanhar a zona errada. Apanhado por ele: mudou de
       * Palmela para a Amora e os quilómetros dos pedidos não mexeram.
       *
       * Se o geocodificador não souber responder, o texto grava-se na mesma
       * e as coordenadas ficam a NULL — melhor não ter ponto nenhum (e o
       * backoffice a dizê-lo) do que guardar um ponto que já não é o dele.
       */
      /*
       * AS COORDENADAS DA LISTA MANDAM, QUANDO EXISTEM.
       *
       * O campo era uma caixa de texto sem lista, e por isso aceitava «Rua dos
       * Jasmins Amora» — que o geocodificador tentava resolver como se fosse o
       * NOME DE UMA TERRA. Deu um ponto em Palmela para um profissional de
       * Amora, e a partir daí todas as distâncias dele saíram erradas sem nada
       * no ecrã a dizê-lo: aparecia a 5,6 km de um trabalho que fica a 33.
       *
       * Agora o painel manda as coordenadas do sítio que ele ESCOLHEU da lista.
       * Vindas do Google, com a morada, e sem passo nenhum a adivinhar pelo
       * meio. A localização por texto fica como recurso para quem escreveu à
       * mão — e aí é mesmo uma aproximação, que é o que o ecrã lhe diz.
       */
      const escolhidas =
        Number.isFinite(Number(corpo.baseLat)) && Number.isFinite(Number(corpo.baseLng))
          ? { lat: Number(corpo.baseLat), lng: Number(corpo.baseLng) }
          : null;

      const base = escolhidas ?? (await geocodificarLocalidade(c));
      mudancas.baseLat = base?.lat ?? null;
      mudancas.baseLng = base?.lng ?? null;
    }
  }

  if ("categorias" in corpo) {
    const cats = categoriasDoCorpo(lista(corpo.categorias));
    if (cats.length === 0) {
      erros.push({ campo: "categorias", mensagem: "Escolha pelo menos um serviço." });
    } else {
      mudancas.categorias = JSON.stringify(cats);
    }
  }

  if ("raioKm" in corpo) {
    const r = Number(corpo.raioKm);
    if (!Number.isFinite(r) || r < RAIO_MINIMO_KM || r > RAIO_MAXIMO_KM) {
      erros.push({ campo: "raioKm", mensagem: `O raio vai de ${RAIO_MINIMO_KM} a ${RAIO_MAXIMO_KM} km.` });
    } else {
      mudancas.raioKm = Math.round(r);
    }
  }

  if ("moradaFiscal" in corpo) {
    const m = texto(corpo.moradaFiscal);
    if (!m) mudancas.moradaFiscal = null;
    else if (m.length < 5) {
      erros.push({ campo: "moradaFiscal", mensagem: "Indique a rua e o número." });
    } else {
      mudancas.moradaFiscal = m;
    }
  }

  if ("codigoPostalFiscal" in corpo) {
    const cp = texto(corpo.codigoPostalFiscal);
    if (!cp) mudancas.codigoPostalFiscal = null;
    else if (!codigoPostalValido(cp)) {
      erros.push({ campo: "codigoPostalFiscal", mensagem: "Código postal inválido (0000-000)." });
    } else {
      mudancas.codigoPostalFiscal = normalizarCodigoPostal(cp);
    }
  }

  if ("localidadeFiscal" in corpo) {
    mudancas.localidadeFiscal = texto(corpo.localidadeFiscal) || null;
  }

  if ("tipoVeiculo" in corpo) {
    /*
     * SÓ OS NOMES QUE A CONTA SABE LER — 29-09-2026.
     *
     * Este campo deixou de ser uma etiqueta: é ele que decide o valor por
     * carga que o profissional vê («carrinha_pequena» → 3/7 do que a CLYON
     * escreveu, ver `carga-da-carrinha.ts`). Um «carrinha media» sem
     * sublinhado, ou um «Carrinha Média» com maiúsculas, não é lido por
     * nenhuma delas — e o efeito não é um erro, é o profissional a ver o
     * valor da carrinha grande em silêncio.
     *
     * Guardava-se o que viesse, cortado aos 60 caracteres. Agora o que não
     * está na lista não se grava, e quem envia fica a saber.
     */
    const bruto = texto(corpo.tipoVeiculo).trim().toLowerCase();
    if (bruto === "") {
      mudancas.tipoVeiculo = null;
    } else if (tipoDeVeiculoValido(bruto)) {
      mudancas.tipoVeiculo = bruto;
    } else {
      erros.push({
        campo: "tipoVeiculo",
        mensagem: `Veículo desconhecido. Escolha um de: ${TIPOS_DE_VEICULO.map((v) => v.id).join(", ")}.`,
      });
    }
  }

  /*
   * A FOTOGRAFIA DA VIATURA — 14-09-2026.
   *
   * Guarda-se o ENDEREÇO, não o ficheiro: o upload vai direito ao Blob pelo
   * mesmo caminho das fotos dos pedidos, e aqui só chega o URL que ele
   * devolveu.
   *
   * Só se aceita um endereço do NOSSO armazenamento. Sem isto, o campo era
   * um sítio onde qualquer pessoa punha o URL que quisesse — e o painel
   * passava a carregar imagens de um servidor de outra pessoa, que vê quem
   * as abre e pode trocá-las depois de aprovadas.
   */
  if ("fotoViaturaUrl" in corpo) {
    const u = texto(corpo.fotoViaturaUrl);
    if (!u) mudancas.fotoViaturaUrl = null;
    // Só o NOSSO store (d24, 10-11-2026): procurar «.public.blob.vercel-storage.com/»
    // em qualquer sítio do texto deixava passar outro anfitrião, e o sufixo
    // sozinho deixava passar o Blob de outra pessoa.
    else if (!urlDoNossoBlob(u)) {
      erros.push({
        campo: "fotoViaturaUrl",
        mensagem: "A fotografia tem de ser enviada por aqui, não colada de outro sítio.",
      });
    } else mudancas.fotoViaturaUrl = urlDoNossoBlob(u)!.slice(0, 500);
  }

  /*
   * OS CUSTOS DELE — o que faz a sugestão de valor ser dele e não da CLYON.
   *
   * Os três são opcionais: vazio grava null e a conta cai na referência da
   * CLYON campo a campo. Os limites são de sanidade — 0,05 €/km e 60 €/h não
   * são preços, são dedos a mais no teclado.
   */
  const custoOuNulo = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    return Number(String(v).replace(",", "."));
  };
  if ("custoKm" in corpo) {
    const n = custoOuNulo(corpo.custoKm);
    if (n === null) mudancas.custoKm = null;
    else if (!Number.isFinite(n) || n < 0.05 || n > 5) {
      erros.push({ campo: "custoKm", mensagem: "O custo por km vai de 0,05 a 5 €." });
    } else mudancas.custoKm = Math.round(n * 100) / 100;
  }
  if ("custoHoraPessoa" in corpo) {
    const n = custoOuNulo(corpo.custoHoraPessoa);
    if (n === null) mudancas.custoHoraPessoa = null;
    else if (!Number.isFinite(n) || n < 3 || n > 60) {
      erros.push({ campo: "custoHoraPessoa", mensagem: "O custo por hora e pessoa vai de 3 a 60 €." });
    } else mudancas.custoHoraPessoa = Math.round(n * 100) / 100;
  }
  if ("pessoasNaEquipa" in corpo) {
    const n = custoOuNulo(corpo.pessoasNaEquipa);
    if (n === null) mudancas.pessoasNaEquipa = null;
    else if (!Number.isFinite(n) || n < 1 || n > 10) {
      erros.push({ campo: "pessoasNaEquipa", mensagem: "A equipa vai de 1 a 10 pessoas." });
    } else mudancas.pessoasNaEquipa = Math.round(n);
  }
  /*
   * OS CUSTOS FIXOS ANUAIS, por rubrica, e o que os divide.
   *
   * Vêm como objecto {viaVerde, manutencao, iuc, inspecao, seguro}; só as
   * rubricas conhecidas entram, cada uma um número de euros por ano ou vazia.
   * Guardam-se em JSON: são cinco números que se lêem sempre juntos.
   */
  if ("custosFixosAnuais" in corpo) {
    const bruto = corpo.custosFixosAnuais;
    if (bruto === null || bruto === undefined) {
      mudancas.custosFixosJson = null;
    } else if (typeof bruto !== "object") {
      erros.push({ campo: "custosFixosAnuais", mensagem: "Custos fixos inválidos." });
    } else {
      const limpo: Record<string, number | null> = {};
      let invalido = false;
      for (const { chave, rotulo } of RUBRICAS_DOS_CUSTOS_FIXOS) {
        const n = custoOuNulo((bruto as Record<string, unknown>)[chave]);
        if (n === null) {
          limpo[chave] = null;
        } else if (!Number.isFinite(n) || n < 0 || n > 50000) {
          erros.push({ campo: "custosFixosAnuais", mensagem: `${rotulo}: indique euros por ano, até 50 000.` });
          invalido = true;
        } else {
          limpo[chave] = Math.round(n * 100) / 100;
        }
      }
      if (!invalido) {
        const algum = Object.values(limpo).some((v) => v != null);
        mudancas.custosFixosJson = algum ? JSON.stringify(limpo) : null;
      }
    }
  }
  if ("trabalhosPorMes" in corpo) {
    const n = custoOuNulo(corpo.trabalhosPorMes);
    if (n === null) mudancas.trabalhosPorMes = null;
    else if (!Number.isFinite(n) || n < 1 || n > 300) {
      erros.push({ campo: "trabalhosPorMes", mensagem: "Trabalhos por mês: de 1 a 300." });
    } else mudancas.trabalhosPorMes = Math.round(n);
  }
  if ("margemPercent" in corpo) {
    const n = custoOuNulo(corpo.margemPercent);
    if (n === null) mudancas.margemPercent = null;
    else if (!Number.isFinite(n) || n < 0 || n > 200) {
      erros.push({ campo: "margemPercent", mensagem: "A margem vai de 0 a 200 %." });
    } else mudancas.margemPercent = Math.round(n * 100) / 100;
  }
  // O tempo médio de um trabalho, em horas — de um quarto de hora a um dia.
  if ("horasPorTrabalho" in corpo) {
    const n = custoOuNulo(corpo.horasPorTrabalho);
    if (n === null) mudancas.horasPorTrabalho = null;
    else if (!Number.isFinite(n) || n < 0.25 || n > 24) {
      erros.push({ campo: "horasPorTrabalho", mensagem: "O tempo por trabalho vai de 0,25 a 24 horas." });
    } else mudancas.horasPorTrabalho = Math.round(n * 100) / 100;
  }
  // O seguro de risco, em percentagem dos custos directos: de 0 a 25 %.
  if ("riscoPercent" in corpo) {
    const n = custoOuNulo(corpo.riscoPercent);
    if (n === null) mudancas.riscoPercent = null;
    else if (!Number.isFinite(n) || n < 0 || n > 25) {
      erros.push({ campo: "riscoPercent", mensagem: "O seguro de risco vai de 0 a 25 %." });
    } else mudancas.riscoPercent = Math.round(n * 100) / 100;
  }

  if ("emiteFatura" in corpo) mudancas.emiteFatura = corpo.emiteFatura ? 1 : 0;

  if ("regimeIva" in corpo) {
    if (!regimeDeIvaValido(corpo.regimeIva)) {
      erros.push({ campo: "regimeIva", mensagem: "Escolha o regime de IVA." });
    } else {
      mudancas.regimeIva = corpo.regimeIva;
    }
  }

  // Quem emite fatura tem de ter NIF — a fatura sem NIF não existe.
  const emitiraFatura =
    "emiteFatura" in corpo ? Boolean(corpo.emiteFatura) : undefined;
  if (emitiraFatura === true) {
    const nifFinal = "nif" in corpo ? texto(corpo.nif) : null;
    if (nifFinal !== null && !nifFinal) {
      erros.push({ campo: "nif", mensagem: "Para emitir fatura é preciso o NIF." });
    }
    // Uma fatura sem a morada do emitente não é uma fatura.
    if ("moradaFiscal" in corpo && !texto(corpo.moradaFiscal)) {
      erros.push({ campo: "moradaFiscal", mensagem: "Para emitir fatura é preciso a morada fiscal." });
    }
  }

  // «Tocou» é só vir no pedido; se MUDOU decide-se antes do UPDATE, contra a base.
  let tocouNaGuia = false;
  if ("emiteGuiaTransporte" in corpo) {
    mudancas.emiteGuiaTransporte = corpo.emiteGuiaTransporte ? 1 : 0;
    tocouNaGuia = true;
  }
  if ("numeroTransportador" in corpo) {
    const n = texto(corpo.numeroTransportador);
    if (corpo.emiteGuiaTransporte && n.length < 3) {
      erros.push({
        campo: "numeroTransportador",
        mensagem: "Indique o número de registo de transportador.",
      });
    } else {
      mudancas.numeroTransportador = n || null;
      tocouNaGuia = true;
    }
  }

  // O destino do entulho (d5, 12-11-2026). Opcional; o administrador confere-o no SILOGR.
  if ("destinoDosResiduos" in corpo) {
    mudancas.destinoDosResiduos = destinoDosResiduosLimpo(corpo.destinoDosResiduos);
  }

  if ("mbway" in corpo) {
    // A regra vive em `mbway.ts`, porque o backoffice também corrige o MB WAY
    // e duas cópias dela acabavam por aceitar números diferentes.
    const mbway = lerMbway(texto(corpo.mbway));
    if (mbway.ok) mudancas.mbway = mbway.valor;
    else erros.push({ campo: "mbway", mensagem: mbway.mensagem });
  }

  if ("iban" in corpo) {
    const bruto = texto(corpo.iban);
    /*
     * UMA MÁSCARA NÃO É UM IBAN NOVO — é o que já lá está.
     *
     * A leitura devolve `LT72 ···· 0473`, e quem grave o formulário sem mexer
     * no campo devolve-nos essa máscara de volta. Interpretá-la como um IBAN
     * dava «IBAN inválido. Confirme os dígitos» a alguém que só queria
     * acrescentar o MB WAY — foi o que aconteceu.
     *
     * O ecrã já não a envia; este travão é para nenhum outro caminho tropeçar
     * no mesmo sítio. Ignorar é seguro: o ponto mediano não existe em IBAN
     * nenhum, por isso isto nunca pode ser uma conta a sério a ser descartada.
     */
    if (bruto.includes("·")) {
      /* mantém-se o que está gravado */
    } else if (!bruto) {
      mudancas.iban = null;
    } else if (!ibanValido(bruto)) {
      erros.push({ campo: "iban", mensagem: "IBAN inválido. Confirme os dígitos." });
    } else {
      mudancas.iban = normalizarIban(bruto);
    }
  }
  if ("ibanTitular" in corpo) mudancas.ibanTitular = texto(corpo.ibanTitular) || null;

  if (erros.length > 0) {
    return NextResponse.json({ error: erros[0].mensagem, erros }, { status: 400 });
  }

  try {
    const mexeNoPagamento = CAMPOS_DE_PAGAMENTO.some((c) => c in mudancas);
    const guardado =
      tocouNaGuia || mexeNoPagamento ? await perfilDoProfissional(sessao.providerId) : undefined;

    /*
     * O IBAN, O TITULAR E O MB WAY PEDEM A PALAVRA-PASSE — d1, 12-11-2026.
     *
     * Só quando mudam DE FACTO: o painel e a app mandam o titular e o MB WAY em
     * cada gravação da conta, e gravar o mesmo valor não é mudar. Os outros
     * campos do perfil continuam sem palavra-passe. O 401 leva um `codigo`,
     * para o ecrã não o confundir com a sessão que expirou (que vem sem ele).
     */
    const pagamentoMudado = mexeNoPagamento ? camposDePagamentoMudados(guardado, mudancas) : [];
    if (pagamentoMudado.length > 0) {
      const limite = await limitarRotaPublica(req, "profissional-perfil-pagamento", 10, 600);
      if (limite.erro) return limite.erro;

      const palavraPasse = corpo[CAMPO_DA_PALAVRA_PASSE];
      if (typeof palavraPasse !== "string" || !palavraPasse) {
        return NextResponse.json(
          {
            error: "Para mudar o IBAN, o titular ou o MB WAY, confirme com a sua palavra-passe.",
            codigo: CODIGOS_DA_PALAVRA_PASSE.emFalta,
          },
          { status: 401 },
        );
      }
      const hash = await palavraPasseGuardada(sessao.providerId);
      if (!hash) {
        return NextResponse.json(
          {
            error:
              "A sua conta ainda não tem palavra-passe. Peça-a em «Esqueci-me da palavra-passe», na página de entrada, e volte a gravar.",
            codigo: CODIGOS_DA_PALAVRA_PASSE.semPalavraPasse,
          },
          { status: 401 },
        );
      }
      if (!(await palavraPasseConfere(palavraPasse, hash))) {
        return NextResponse.json(
          { error: "A palavra-passe não confere.", codigo: CODIGOS_DA_PALAVRA_PASSE.errada },
          { status: 401 },
        );
      }
    }

    // O painel manda a guia em cada gravação da Faturação: o selo só cai se
    // ela mudou mesmo (`guia-mudou.ts`, 20-10-2026).
    const guiaMudou = tocouNaGuia && guiaMudouDeFacto(guardado, mudancas);

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

    /*
     * O EMAIL «SE NÃO FOI VOCÊ, FALE CONNOSCO» — d1, 12-11-2026. A data já
     * ficou gravada no UPDATE (`ibanMudadoEm`). Um email que não sai não
     * desfaz a gravação: fica no registo.
     */
    if (pagamentoMudado.length > 0) {
      const para = typeof guardado?.email === "string" ? guardado.email : "";
      const ibanNovo = typeof mudancas.iban === "string" ? mudancas.iban : null;
      const mbwayNovo = typeof mudancas.mbway === "string" ? mudancas.mbway : null;
      const enviado = await enviarEmailDosDadosDePagamento({
        para,
        nome: String(mudancas.name ?? guardado?.name ?? ""),
        campos: pagamentoMudado,
        ibanFinal: ibanNovo ? ibanNovo.slice(-4) : null,
        mbwayFinal: mbwayNovo ? mbwayNovo.slice(-3) : null,
        em: new Date(),
      }).catch(() => false);
      if (!enviado) {
        console.error("[profissionais/perfil PUT] o email da mudança dos dados de pagamento não saiu", sessao.providerId);
      }
    }

    return NextResponse.json({ ok: true, guiaPorVerificar: guiaMudou, dadosDePagamentoMudados: pagamentoMudado });
  } catch (error) {
    console.error("[profissionais/perfil PUT]", error);
    return NextResponse.json({ error: "Não foi possível guardar" }, { status: 500 });
  }
}
