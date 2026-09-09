import { NextRequest, NextResponse } from "next/server";
import { geocodificarLocalidade } from "@/lib/geocodificar";
import {
  perfilDoProfissional,
  avaliacoesDoProfissional,
  actualizarPerfilDoProfissional,
  invalidarVerificacaoDaGuia,
  custosFixosDeJson,
} from "@/lib/db";
import { RUBRICAS_DOS_CUSTOS_FIXOS } from "@/lib/custos-fixos-do-profissional";
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
        // Os custos dele, para a sugestão de valor. Nulos = referência da CLYON.
        custoKm: p.custoKm != null ? Number(p.custoKm) : null,
        custoHoraPessoa: p.custoHoraPessoa != null ? Number(p.custoHoraPessoa) : null,
        pessoasNaEquipa: p.pessoasNaEquipa != null ? Number(p.pessoasNaEquipa) : null,
        custosFixosAnuais: custosFixosDeJson(p.custosFixosJson),
        trabalhosPorMes: p.trabalhosPorMes != null ? Number(p.trabalhosPorMes) : null,
        margemPercent: p.margemPercent != null ? Number(p.margemPercent) : null,
        horasPorTrabalho: p.horasPorTrabalho != null ? Number(p.horasPorTrabalho) : null,
        riscoPercent: p.riscoPercent != null ? Number(p.riscoPercent) : null,
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

  if ("zonas" in corpo) {
    const zonas = lista(corpo.zonas);
    const cidade = texto(corpo.cidade) || texto(mudancas.city);
    // A cidade de base entra sempre. Quem apagasse as zonas todas deixava de
    // receber o que quer que fosse, incluindo da sua própria terra.
    const todas = cidade && !zonas.includes(cidade) ? [cidade, ...zonas] : zonas;
    mudancas.zonas = JSON.stringify(Array.from(new Set(todas)));
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
