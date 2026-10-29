import type { DadosDaRecolha } from "./whatsapp-recolha";
import { descricaoOrganizada } from "./descricao-do-pedido";
import { DESCRICAO_DAS_FOTOS } from "./leitor-da-recolha";

/**
 * AS FONTES DA DESCRIÇÃO DE UM PEDIDO — 29-10-2026 (ordem do CEO, aprovada
 * pelo dono: «automático + botão»).
 *
 * *«Nem eu consigo entender, muito menos o profissional.»* — o dono, com um
 * pedido de hoje cuja descrição tinha o texto da equipa e, por baixo, DOIS
 * blocos «Acrescentado pelo cliente no WhatsApp:», o segundo igual ao
 * primeiro com mais duas linhas. A Vitória juntava um bloco novo por baixo
 * sempre que o anterior já não estava no fim (`descricaoComOBloco`), e
 * escrevia sempre por cima do que ela própria tinha escrito.
 *
 * Agora o pedido guarda AS FONTES à parte (coluna `fontesDaDescricao`):
 *   · o texto da equipa — o original, que manda; se a equipa editar a
 *     descrição à mão, o texto dela passa a ser a fonte da equipa;
 *   · tudo o que o cliente disse e a Vitória juntou, frase a frase, com a
 *     hora em que chegou;
 *   · o que a conversa apurou (quando, volume, notas, a 2.ª morada…);
 *   · o que se viu nas fotografias.
 * E a descrição ESCREVE-SE SEMPRE A PARTIR DAS FONTES, nunca a partir do
 * texto já escrito — assim não há deriva nem blocos repetidos. Quem escreve é
 * o modelo (`descricao-pelo-modelo.ts`); quando falha, ficam as regras de
 * sempre (`descricaoPelasRegras`): o texto da equipa e UM bloco por baixo.
 *
 * PURO, sem base de dados.
 */

/** O cabeçalho do que a conversa acrescentou, por baixo do texto da equipa. */
export const CABECA_DO_BLOCO = "Acrescentado pelo cliente no WhatsApp:";

/** Uma frase, com a hora (ISO) em que chegou. */
export type Dito = { t: string; em: string };

export type FontesDaDescricao = {
  v: 1;
  /** O texto da equipa, do formulário ou do simulador — o original, que manda. */
  equipa: string;
  /** Quando a equipa o escreveu à mão (ISO); `null` é o texto com que o pedido nasceu. */
  equipaEm: string | null;
  /** As frases do cliente, pela ordem, sem repetidas. */
  cliente: Dito[];
  /** O que se viu nas fotografias — «Nas imagens: …». */
  visto: Dito[];
  /** O que a conversa apurou, campo a campo, com a hora da última mudança. */
  campos: Record<string, { v: unknown; em: string }>;
  /** As fotografias do pedido que o modelo já viu (os endereços). */
  fotosVistas: string[];
  /** A última descrição escrita a partir destas fontes. Se a do pedido for outra, alguém mexeu à mão. */
  escrita: string | null;
  /** Quem a escreveu: o modelo, as regras, ou a equipa à mão. */
  por: "modelo" | "regras" | "equipa" | null;
  em: string | null;
  /** A última vez que o modelo falhou, e porquê. */
  falha: string | null;
};

/**
 * O QUE A CONVERSA APURA E FICA NAS FONTES — os campos de `DadosDaRecolha`
 * que dizem alguma coisa ao profissional. Os da morada principal (andar,
 * elevador, estacionamento) também ficam, para o bloco das regras os dizer
 * quando foi a conversa a dá-los; para o modelo, mandam as colunas do pedido.
 */
export const CAMPOS_DA_CONVERSA = [
  "floor",
  "lado",
  "hasElevator",
  "parkingDistance",
  "metrosAtePorta",
  "volumeDito",
  "clienteCarrega",
  "acessoDito",
  "quandoTexto",
  "quandoComTodas",
  "dataDesejada",
  "entulhoQuantidade",
  "notas",
  "fotosRecebidas",
  "fotosDitas",
  "segundaMorada",
] as const satisfies ReadonlyArray<keyof DadosDaRecolha>;

const NAS_IMAGENS = /^Nas imagens:/;

/** Para comparar frases: minúsculas, sem acentos, sem pontuação nem espaços a mais. */
export function chaveDaFrase(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** O texto como se compara: sem os fins de linha do Windows, sem espaços nas pontas das linhas. */
export function textoNormal(t: string | null | undefined): string {
  return String(t ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

export function fontesVazias(): FontesDaDescricao {
  return { v: 1, equipa: "", equipaEm: null, cliente: [], visto: [], campos: {}, fotosVistas: [], escrita: null, por: null, em: null, falha: null };
}

/** As fontes guardadas, lidas sem confiar em nada — ou `null` quando não há. */
export function lerFontes(json: unknown): FontesDaDescricao | null {
  if (typeof json !== "string" || !json.trim()) return null;
  try {
    const o = JSON.parse(json) as Partial<FontesDaDescricao>;
    if (!o || typeof o !== "object" || o.v !== 1) return null;
    const ditos = (l: unknown): Dito[] =>
      Array.isArray(l)
        ? l
            .filter((d): d is Dito => !!d && typeof (d as Dito).t === "string")
            .map((d) => ({ t: d.t, em: typeof d.em === "string" ? d.em : "" }))
        : [];
    const campos: FontesDaDescricao["campos"] = {};
    if (o.campos && typeof o.campos === "object") {
      for (const [k, c] of Object.entries(o.campos)) {
        if (c && typeof c === "object" && "v" in c) campos[k] = { v: (c as { v: unknown }).v, em: String((c as { em?: unknown }).em ?? "") };
      }
    }
    return {
      v: 1,
      equipa: typeof o.equipa === "string" ? o.equipa : "",
      equipaEm: typeof o.equipaEm === "string" ? o.equipaEm : null,
      cliente: ditos(o.cliente),
      visto: ditos(o.visto),
      campos,
      fotosVistas: Array.isArray(o.fotosVistas) ? o.fotosVistas.filter((u): u is string => typeof u === "string") : [],
      escrita: typeof o.escrita === "string" ? o.escrita : null,
      por: o.por === "modelo" || o.por === "regras" || o.por === "equipa" ? o.por : null,
      em: typeof o.em === "string" ? o.em : null,
      falha: typeof o.falha === "string" ? o.falha : null,
    };
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * OS BLOCOS DA VITÓRIA QUE JÁ ESTÃO NAS DESCRIÇÕES
 * ────────────────────────────────────────────────────────────────────────── */

/** Os parágrafos de um texto — os blocos da Vitória vêm separados por uma linha em branco. */
function paragrafos(texto: string): string[] {
  return textoNormal(texto)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const eBloco = (p: string) => p.startsWith(CABECA_DO_BLOCO);

/**
 * As linhas que a Vitória escreve num bloco (`descricaoOrganizada`): todas
 * com um destes rótulos, ou a frase de quem carrega. Uma linha sem rótulo
 * dentro de um bloco foi a equipa que a escreveu — e é da equipa.
 */
const LINHA_DA_VITORIA =
  /^(Para levar|Para transportar|O que referiu|Volume \(dito pelo cliente\)|Entulho|Origem|Destino|Acesso|Estacionamento|Quando|Quando \(dito pelo cliente\)|Fotografias enviadas pelo cliente|Fotografias|Nas imagens|Pormenores \(ditos pelo cliente\)|Acesso \(dito pelo cliente\)|Notas \(ditas pelo cliente\)|2\.ª paragem):|^O cliente carrega para a viatura\.$/;

/**
 * O TEXTO DA EQUIPA E OS BLOCOS DA VITÓRIA, separados. Os blocos podem estar
 * repetidos (o caso de 29-10-2026) ou no meio; o resto é da equipa, e fica
 * como estava — também a linha que a equipa escreveu dentro de um bloco.
 */
export function partirEmEquipaEBlocos(texto: string | null | undefined): { equipa: string; blocos: string[] } {
  const equipa: string[] = [];
  const blocos: string[] = [];
  for (const p of paragrafos(texto ?? "")) {
    if (!eBloco(p)) {
      equipa.push(p);
      continue;
    }
    const linhas = p.slice(CABECA_DO_BLOCO.length).split("\n").map((l) => l.trim()).filter(Boolean);
    const daVitoria = linhas.filter((l) => LINHA_DA_VITORIA.test(l));
    const daEquipa = linhas.filter((l) => !LINHA_DA_VITORIA.test(l));
    if (daVitoria.length > 0) blocos.push(daVitoria.join("\n"));
    if (daEquipa.length > 0) equipa.push(daEquipa.join("\n"));
  }
  return { equipa: equipa.join("\n\n"), blocos };
}

/** «Para levar: …», «Quando (dito pelo cliente): …» — o rótulo e o resto. */
function rotuloEResto(linha: string): { rotulo: string; resto: string } | null {
  const m = /^([A-ZÀ-Úa-zà-ú0-9 .ªº()-]{2,40}):\s*(.*)$/.exec(linha);
  return m ? { rotulo: m[1].trim(), resto: m[2].trim() } : null;
}

/**
 * AS LINHAS DE UM BLOCO ANTIGO, DE VOLTA A FONTES — o que o cliente disse
 * volta a frases dele, e o que a conversa apurou volta a campos. As linhas que
 * vinham dos campos do pedido (o acesso, o estacionamento) não voltam: mandam
 * as colunas. As fotografias contam-se no pedido.
 */
function fontesDeUmBloco(corpo: string, f: FontesDaDescricao, em: string, renovar = false): void {
  for (const linha of corpo.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (NAS_IMAGENS.test(linha)) {
      juntarDito(f.visto, linha, em, renovar);
      continue;
    }
    const r = rotuloEResto(linha);
    if (!r) {
      if (linha !== DESCRICAO_DAS_FOTOS && !/^O cliente carrega/.test(linha)) juntarDito(f.cliente, linha, em, renovar);
      continue;
    }
    const rot = chaveDaFrase(r.rotulo);
    const resto = r.resto.replace(/\s*\(dit[oa]s? pelo cliente\)\.?$/i, "").trim();
    if (!resto) continue;
    if (/^(para levar|para transportar|o que referiu|pormenores)/.test(rot)) juntarDito(f.cliente, resto, em, renovar);
    else if (/^quando/.test(rot)) definirCampo(f, "quandoTexto", resto.replace(/\.$/, ""), em, renovar);
    else if (/^volume/.test(rot)) definirCampo(f, "volumeDito", resto.replace(/\.$/, ""), em, renovar);
    else if (/^entulho/.test(rot)) definirCampo(f, "entulhoQuantidade", resto.replace(/\.$/, ""), em, renovar);
    else if (/^acesso dito/.test(rot)) definirCampo(f, "acessoDito", resto, em, renovar);
    else if (/^notas/.test(rot)) definirCampo(f, "notas", [resto], em, renovar);
    else if (/^(acesso|estacionamento|origem|destino|fotografias|2 paragem)/.test(rot)) continue;
    else juntarDito(f.cliente, linha, em, renovar);
  }
  if (corpo.includes("O cliente carrega para a viatura.")) definirCampo(f, "clienteCarrega", true, em, renovar);
}

/**
 * AS FONTES DE UM PEDIDO QUE AINDA NÃO AS TEM — a partir da descrição que
 * tem. O texto da equipa é o que não é bloco da Vitória; os blocos (também os
 * repetidos) voltam a ser frases e campos, uma vez cada.
 */
export function fontesDeUmaDescricao(descricao: string | null | undefined): FontesDaDescricao {
  const f = fontesVazias();
  const { equipa, blocos } = partirEmEquipaEBlocos(descricao);
  f.equipa = equipa;
  for (const b of blocos) fontesDeUmBloco(b, f, "");
  return f;
}

/* ──────────────────────────────────────────────────────────────────────────
 * JUNTAR ÀS FONTES
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Junta uma frase, se ainda lá não estiver. Com `renovar`, a que já lá estava
 * ganha a hora nova — é o que a equipa faz quando deixa um bloco no texto dela.
 * Sem isso não: a conversa manda tudo o que já disse em cada mensagem, e
 * renovar a hora fazia voltar o que a equipa já tinha arrumado à mão.
 */
function juntarDito(lista: Dito[], t: string, em: string, renovar = false): void {
  const frase = t.replace(/\s+/g, " ").trim();
  if (!frase) return;
  const chave = chaveDaFrase(frase);
  if (!chave) return;
  const ja = lista.find((d) => chaveDaFrase(d.t) === chave);
  if (ja) {
    if (renovar && em > ja.em) ja.em = em;
    return;
  }
  lista.push({ t: frase.slice(0, 600), em });
}

function definirCampo(f: FontesDaDescricao, k: string, v: unknown, em: string, renovar = false): void {
  if (v === undefined || v === null || v === "") return;
  if (k === "notas") {
    const antes = Array.isArray(f.campos.notas?.v) ? (f.campos.notas.v as string[]) : [];
    const novas = (Array.isArray(v) ? v : [v]).map((n) => String(n).trim()).filter(Boolean);
    const juntas = [...antes];
    for (const n of novas) if (!juntas.some((a) => chaveDaFrase(a) === chaveDaFrase(n))) juntas.push(n);
    if (juntas.length !== antes.length || (renovar && f.campos.notas && em > f.campos.notas.em)) {
      f.campos.notas = { v: juntas.slice(-12), em };
    }
    return;
  }
  const atual = f.campos[k];
  if (atual && JSON.stringify(atual.v) === JSON.stringify(v)) {
    if (renovar && em > atual.em) atual.em = em;
    return;
  }
  f.campos[k] = { v, em };
}

function copia(f: FontesDaDescricao): FontesDaDescricao {
  return JSON.parse(JSON.stringify(f)) as FontesDaDescricao;
}

/**
 * O QUE A CONVERSA TROUXE, JUNTO ÀS FONTES — as frases do cliente uma a uma
 * (sem repetir), o que se viu nas fotografias, e os campos que mudaram. Nunca
 * apaga nada: o original nunca se perde.
 */
export function juntarAConversa(fontes: FontesDaDescricao, novos: DadosDaRecolha, agora: Date): FontesDaDescricao {
  const f = copia(fontes);
  const em = agora.toISOString();
  for (const linha of textoNormal(novos.description).split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (linha === DESCRICAO_DAS_FOTOS) continue;
    if (NAS_IMAGENS.test(linha)) juntarDito(f.visto, linha, em);
    else juntarDito(f.cliente, linha, em);
  }
  for (const k of CAMPOS_DA_CONVERSA) definirCampo(f, k, (novos as Record<string, unknown>)[k], em);
  return f;
}

/** O que se viu numa fotografia do pedido, visto agora (`verAImagem`). */
export function juntarOQueSeViu(fontes: FontesDaDescricao, url: string, visto: string | null, agora: Date): FontesDaDescricao {
  const f = copia(fontes);
  if (!f.fotosVistas.includes(url)) f.fotosVistas.push(url);
  if (visto) juntarDito(f.visto, `Nas imagens: ${visto}`, agora.toISOString());
  return f;
}

/** A descrição do pedido já não é a que se escreveu: alguém da equipa mexeu à mão. */
export function equipaMexeu(fontes: FontesDaDescricao, descricaoAtual: string | null | undefined): boolean {
  if (fontes.escrita == null) return false;
  return textoNormal(descricaoAtual) !== textoNormal(fontes.escrita);
}

/**
 * A EQUIPA ESCREVEU À MÃO — o texto dela passa a ser a fonte da equipa, e
 * manda. O que o cliente disse antes fica guardado (nunca se perde), mas já
 * não volta à descrição: a equipa escreveu-a a olhar para isso. Um bloco da
 * Vitória que tenha ficado no texto volta a ser fonte do cliente.
 */
export function comTextoDaEquipa(fontes: FontesDaDescricao, texto: string | null | undefined, agora: Date): FontesDaDescricao {
  const f = copia(fontes);
  const em = agora.toISOString();
  const { equipa, blocos } = partirEmEquipaEBlocos(texto);
  f.equipa = equipa;
  f.equipaEm = em;
  for (const b of blocos) fontesDeUmBloco(b, f, em, true);
  f.escrita = textoNormal(texto);
  f.por = "equipa";
  f.em = em;
  return f;
}

/* ──────────────────────────────────────────────────────────────────────────
 * O QUE CONTA PARA A DESCRIÇÃO DE AGORA
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Depois de a equipa escrever à mão, só conta o que chegou a seguir — e o
 * bloco que ela deixou ficar no texto dela (renovado à mesma hora).
 */
function conta(fontes: FontesDaDescricao, em: string): boolean {
  return fontes.equipaEm == null || em >= fontes.equipaEm;
}

/** As frases do cliente que contam agora. */
export function frasesDoCliente(fontes: FontesDaDescricao): string[] {
  return fontes.cliente.filter((d) => conta(fontes, d.em)).map((d) => d.t);
}

/** O que se viu nas fotografias e conta agora (sem o «Nas imagens:»). */
export function oQueSeVe(fontes: FontesDaDescricao): string[] {
  return fontes.visto.filter((d) => conta(fontes, d.em)).map((d) => d.t.replace(NAS_IMAGENS, "").trim());
}

/** Os campos apurados na conversa que contam agora. */
export function camposQueContam(fontes: FontesDaDescricao): Partial<DadosDaRecolha> {
  const out: Record<string, unknown> = {};
  for (const [k, c] of Object.entries(fontes.campos)) if (conta(fontes, c.em)) out[k] = c.v;
  return out as Partial<DadosDaRecolha>;
}

/** Os dados do cliente como a descrição das regras os lê. */
export function dadosDoCliente(fontes: FontesDaDescricao, servico: string | null | undefined): DadosDaRecolha {
  const linhas = [...frasesDoCliente(fontes), ...fontes.visto.filter((d) => conta(fontes, d.em)).map((d) => d.t)];
  return {
    ...(servico ? { serviceType: servico } : {}),
    ...camposQueContam(fontes),
    ...(linhas.length > 0 ? { description: linhas.join("\n") } : {}),
  } as DadosDaRecolha;
}

/* ──────────────────────────────────────────────────────────────────────────
 * AS REGRAS DE SEMPRE — quando o modelo não escreve
 * ────────────────────────────────────────────────────────────────────────── */

/** O bloco com o que a conversa trouxe — sem linhas repetidas. */
export function blocoDasFontes(dados: DadosDaRecolha, fotos?: number): string | null {
  const corpo = descricaoOrganizada(dados, fotos != null ? { fotos } : {});
  if (!corpo) return null;
  const vistas = new Set<string>();
  const linhas = corpo.split("\n").filter((l) => {
    const c = chaveDaFrase(l);
    if (!c || vistas.has(c)) return false;
    vistas.add(c);
    return true;
  });
  return linhas.join("\n");
}

/**
 * O TEXTO DA EQUIPA COM UM SÓ BLOCO DA VITÓRIA POR BAIXO. Os blocos que já lá
 * estavam (um, dois, repetidos) saem todos, e o novo entra uma vez; o que a
 * equipa escreveu fica como estava, mesmo que esteja depois de um bloco.
 */
export function textoComUmSoBloco(texto: string | null | undefined, corpoDoBloco: string | null): string {
  const { equipa } = partirEmEquipaEBlocos(texto);
  if (!corpoDoBloco) return equipa;
  // Sem texto da equipa, o bloco é a descrição: não precisa do cabeçalho.
  return equipa ? `${equipa}\n\n${CABECA_DO_BLOCO}\n${corpoDoBloco}` : corpoDoBloco;
}

/**
 * A DESCRIÇÃO PELAS REGRAS — a de hoje, sem blocos repetidos: o texto da
 * equipa e, por baixo, o que o cliente disse, arrumado (`descricaoOrganizada`).
 */
export function descricaoPelasRegras(fontes: FontesDaDescricao, servico: string | null | undefined): string {
  const dados = dadosDoCliente(fontes, servico);
  const fotos = typeof dados.fotosRecebidas === "number" ? dados.fotosRecebidas : undefined;
  const temAlgo = frasesDoCliente(fontes).length > 0 || oQueSeVe(fontes).length > 0 || Object.keys(camposQueContam(fontes)).length > 0;
  return textoComUmSoBloco(fontes.equipa, temAlgo ? blocoDasFontes(dados, fotos) : null);
}

/** As fontes depois de a descrição ser escrita. */
export function comAEscrita(
  fontes: FontesDaDescricao,
  texto: string,
  por: "modelo" | "regras",
  agora: Date,
  falha: string | null = null,
): FontesDaDescricao {
  return { ...copia(fontes), escrita: textoNormal(texto), por, em: agora.toISOString(), falha };
}
