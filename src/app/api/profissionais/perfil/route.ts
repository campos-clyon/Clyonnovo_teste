import { NextRequest, NextResponse } from "next/server";
import { geocodificarLocalidade } from "@/lib/geocodificar";
import {
  perfilDoProfissional,
  avaliacoesDoProfissional,
  actualizarPerfilDoProfissional,
  invalidarVerificacaoDaGuia,
} from "@/lib/db";
import {
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import {
  nifValido,
  telefoneValido,
  regimeDeIvaValido,
  codigoPostalValido,
  normalizarCodigoPostal,
  CATEGORIAS_VALIDAS,
  RAIO_MAXIMO_KM,
  RAIO_MINIMO_KM,
  pareceMorada,
} from "@/lib/inscricao-profissional";
import { ibanValido, normalizarIban, ibanEncurtado } from "@/lib/iban";
import { mediaDasAvaliacoes } from "@/lib/avaliacao-profissional";

export const runtime = "nodejs";

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
    const reputacao = mediaDasAvaliacoes(
      avaliacoes.map((a) => ({ estrelas: Number(a.estrelas) })),
    );

    const iban = typeof p.iban === "string" ? p.iban : "";

    return NextResponse.json({
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
        categorias: listaGravada(p.categorias),
        zonas: listaGravada(p.zonas),
        raioKm: p.raioKm != null ? Number(p.raioKm) : 30,
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
        // A lista toda, não as cinco últimas: o ecrã das avaliações mostra-as
        // todas, e a consulta já traz no máximo cem.
        ultimasAvaliacoes: avaliacoes.map((a) => ({
          estrelas: Number(a.estrelas),
          comentario: a.comentario,
          em: a.avaliadoEm,
        })),
      },
    });
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

  const erros: Array<{ campo: string; mensagem: string }> = [];
  const mudancas: Record<string, unknown> = {};

  // Cada campo só é tocado se vier no corpo. Um PUT parcial é o que permite ao
  // ecrã gravar uma secção de cada vez sem apagar o resto por omissão.
  if ("nome" in corpo) {
    const nome = texto(corpo.nome);
    if (nome.length < 2) {
      erros.push({ campo: "nome", mensagem: "Indique o nome." });
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
       * e as coordenadas ficam a NULL — melhor não ter ponto nenhum (e cair
       * na regra das zonas) do que guardar um ponto que já não é o dele.
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
    const cats = lista(corpo.categorias).filter((c) => CATEGORIAS_VALIDAS.includes(c));
    if (cats.length === 0) {
      erros.push({ campo: "categorias", mensagem: "Escolha pelo menos um serviço." });
    } else {
      mudancas.categorias = JSON.stringify(cats);
    }
  }

  /*
   * AS ZONAS SEGUEM A BASE, e não o que vier no pedido.
   *
   * Aceitava-se uma lista escrita à mão e juntava-se-lhe a cidade. Só que
   * quem decide o que lhe chega é a distância entre a base e a morada do
   * trabalho, medida contra o raio — a lista não era lida por ninguém.
   *
   * Agora a coluna é escrita a partir da cidade, e SEMPRE que a cidade muda:
   * quem se mudasse de Amadora para Setúbal ficava com «Amadora» gravado como
   * zona para sempre, e é isso que o cliente lia no perfil dele.
   *
   * O painel dele continua a mandar `zonas` no corpo — é um resto do que aqui
   * havia. Ignora-se, em vez de se recusar o pedido: recusar partia o botão
   * de guardar de quem ainda tem a versão antiga aberta no browser.
   */
  const cidadeNova = texto(corpo.cidade) || texto(mudancas.city);
  if (cidadeNova) {
    mudancas.zonas = JSON.stringify([cidadeNova]);
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

  let guiaMudou = false;
  if ("emiteGuiaTransporte" in corpo) {
    mudancas.emiteGuiaTransporte = corpo.emiteGuiaTransporte ? 1 : 0;
    guiaMudou = true;
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
      guiaMudou = true;
    }
  }

  if ("mbway" in corpo) {
    /*
     * Só os dígitos, e um número português tem nove.
     *
     * Um MB WAY mal escrito não devolve o dinheiro nem dá erro: paga a outra
     * pessoa. Vale a pena recusar aqui em vez de descobrir depois.
     */
    const bruto = texto(corpo.mbway) ?? "";
    const digitos = bruto.replace(/[^0-9]/g, "").replace(/^351/, "");
    if (!bruto) {
      mudancas.mbway = null;
    } else if (digitos.length !== 9 || !/^9/.test(digitos)) {
      erros.push({ campo: "mbway", mensagem: "Indique um telemóvel português de 9 dígitos." });
    } else {
      mudancas.mbway = digitos;
    }
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
    await actualizarPerfilDoProfissional(sessao.providerId, mudancas);

    // Mexer na guia volta a pôr a verificação por fazer. O distintivo que o
    // cliente vê tem de continuar a garantir um número que alguém confirmou.
    if (guiaMudou) await invalidarVerificacaoDaGuia(sessao.providerId);

    return NextResponse.json({ ok: true, guiaPorVerificar: guiaMudou });
  } catch (error) {
    console.error("[profissionais/perfil PUT]", error);
    return NextResponse.json({ error: "Não foi possível guardar" }, { status: 500 });
  }
}
