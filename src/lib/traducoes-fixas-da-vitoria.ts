import dados from "./traducoes-fixas-da-vitoria.json";
import type { Lingua } from "./lingua-do-cliente";

/**
 * AS TRADUÇÕES FIXAS DA VITÓRIA — 28-10-2026 (decisão d35).
 *
 * *«gemini-3.6-flash: demorou mais de 8 s — saiu em português (en)»* — o
 * aviso do painel no dia em que um cliente que pediu «Do you speak English?»
 * levou o resumo, a pergunta da fatura e as confirmações em português, e a
 * equipa teve de escrever à mão.
 *
 * Quando o tradutor falha (depois da nova tentativa e do modelo leve), as
 * frases mais comuns da Vitória saem DAQUI — escritas e revistas em inglês,
 * francês e espanhol, em `traducoes-fixas-da-vitoria.json`. Uma mensagem só
 * sai se TODAS as frases dela tiverem tradução; se faltar uma, devolve-se
 * null, e quem chama passa a conversa à equipa (ver `whatsapp-cloud.ts`) em
 * vez de a deixar sair na língua errada.
 *
 * As frases ficam num JSON, e não aqui, porque o teste da orquestra lê os
 * textos dos ficheiros .ts com as regras do português de Portugal — e
 * «factura» é a palavra certa em espanhol.
 *
 * O que é do cliente (o nome, a morada, a descrição) passa tal e qual: são
 * as palavras dele.
 */

type Alvo = Exclude<Lingua, "pt">;
type Linha4 = [string, string, string, string];

const POSICAO: Record<Alvo, 1 | 2 | 3> = { en: 1, fr: 2, es: 3 };

/** Como o envio deixa o texto (`paraTeclado`), e sem espaços a mais — para comparar. */
export function normalFixa(texto: string): string {
  return texto
    .replace(/[«»“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]*[—–][ \t]*/g, " - ")
    .replace(/[ \t]*·[ \t]*/g, ", ")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const chaveDe = (s: string) => normalFixa(s).toLowerCase();

function mapa(linhas: Linha4[]): Map<string, Linha4> {
  return new Map(linhas.map((l) => [chaveDe(l[0]), l]));
}

const FRASES = mapa(dados.frases as Linha4[]);
const SERVICOS = mapa(dados.servicos as Linha4[]);
const ROTULOS = mapa(dados.rotulos as Linha4[]);
const VALORES = mapa(dados.valores as Linha4[]);
const MOLDES = (dados.moldes as Linha4[]).map((l) => ({ re: new RegExp(l[0]), linha: l }));
const MOLDES_DE_VALOR = (dados.moldesDeValor as Linha4[]).map((l) => ({ re: new RegExp(l[0]), linha: l }));
const DIAS = dados.dias as Linha4[];
const MESES = dados.meses as Linha4[];
const LIGACOES = mapa(dados.ligacoes as Linha4[]);

/** O nome de um serviço, na língua — ou null. */
function servico(nome: string, lingua: Alvo): string | null {
  const l = SERVICOS.get(chaveDe(nome));
  return l ? l[POSICAO[lingua]] : null;
}

function porMolde(texto: string, moldes: typeof MOLDES, lingua: Alvo): string | null {
  for (const { re, linha } of moldes) {
    const m = re.exec(texto);
    if (!m) continue;
    let falhou = false;
    const saida = linha[POSICAO[lingua]]
      .replace(/\{s(\d)\}/g, (_, i: string) => {
        const s = servico(m[Number(i)] ?? "", lingua);
        if (!s) falhou = true;
        return (s ?? "").toLowerCase();
      })
      .replace(/\$(\d)/g, (_, i: string) => m[Number(i)] ?? "");
    if (!falhou) return saida;
  }
  return null;
}

/** Uma frase (sem quebras de linha): exacta, ou por molde. */
function frase(texto: string, lingua: Alvo): string | null {
  const n = normalFixa(texto);
  if (!n) return "";
  const exacta = FRASES.get(n.toLowerCase());
  if (exacta) return exacta[POSICAO[lingua]];
  return porMolde(n, MOLDES, lingua);
}

/* ── O resumo: «Rótulo: valor», com o que é do cliente tal e qual ───────── */

function valor(texto: string, lingua: Alvo): string | null {
  const n = normalFixa(texto);
  const v = VALORES.get(n.toLowerCase());
  if (v) return v[POSICAO[lingua]];
  return porMolde(n, MOLDES_DE_VALOR, lingua);
}

/** «r/c Esq», «3», «3 Dto», «cave»: o andar, com o lado tal e qual. */
function andar(texto: string, lingua: Alvo): string {
  const m = /^(r\/c|cave)(\s.*)?$/i.exec(texto.trim());
  if (m) return `${valor(m[1], lingua) ?? m[1]}${m[2] ?? ""}`;
  return valor(texto, lingua) ?? texto;
}

/** A palavra inteira — com acentos («às», «à tarde»), que o `\b` não vê como letras. */
const sub = (s: string) =>
  new RegExp(`(?<![\\p{L}\\d])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "giu");

/**
 * O DIA, como o resumo o escreve — «sexta-feira, 30 de outubro», «às 10:00»,
 * «sexta 30/10 ou sábado 31/10; no máximo domingo 1/11», «amanhã». Só se
 * traduz o que tem esta forma; as palavras do cliente ficam como ele as disse.
 */
function quando(texto: string, lingua: Alvo): string {
  const n = normalFixa(texto);
  const v = valor(n, lingua);
  if (v) return v;
  const DIA = DIAS.map((d) => d[0]).join("|");
  const forma = new RegExp(
    `^(${DIA})(, \\d{1,2} de [a-zç]+| \\d{1,2}/\\d{1,2})( às \\d{2}:\\d{2})?(, de manhã|, à tarde|, ao fim do dia)?((; no máximo | ou )(${DIA})(, \\d{1,2} de [a-zç]+| \\d{1,2}/\\d{1,2}))*$`,
    "i",
  );
  const formaDoLimite = new RegExp(`^no máximo (${DIA})( \\d{1,2}/\\d{1,2})$`, "i");
  if (!forma.test(n) && !formaDoLimite.test(n)) return n;
  let out = n;
  // Os nomes compridos primeiro: «sexta-feira» antes de «sexta».
  for (const d of [...DIAS].sort((a, b) => b[0].length - a[0].length)) out = out.replace(sub(d[0]), d[POSICAO[lingua]]);
  for (const m of MESES) {
    out = out.replace(new RegExp(`(\\d{1,2}) de ${m[0]}(?![\\p{L}])`, "giu"), (_, dia: string) =>
      lingua === "en" ? `${dia} ${m[1]}` : lingua === "fr" ? `${dia} ${m[2]}` : `${dia} de ${m[3]}`,
    );
  }
  for (const [chave, l] of LIGACOES) out = out.replace(sub(chave), l[POSICAO[lingua]]);
  return out;
}

const ROTULO_SIMPLES = /^(Serviço|Nome|Morada|Destino|Entulho|Volume|Quando|Descrição|Fatura): (.*)$/;
const ROTULO_DO_ACESSO =
  /^(Andar:|Na origem: andar|No destino: andar) (.+?)(?:, elevador: (sim, pequeno|sim|não|-))?, estacionar à porta: (.+)$/;

function rotulo(r: string, lingua: Alvo): string {
  const l = ROTULOS.get(r.toLowerCase());
  return l ? l[POSICAO[lingua]] : r;
}

function linhaDoResumo(n: string, lingua: Alvo): string | null {
  const a = ROTULO_DO_ACESSO.exec(n);
  if (a) {
    const cabeca = a[1].replace(/:$/, "");
    const est = valor(a[4], lingua);
    if (est == null) return null;
    const elev = a[3] != null ? valor(a[3], lingua) : null;
    return [
      `${rotulo(cabeca, lingua)}${a[1].endsWith(":") ? ":" : ""} ${andar(a[2], lingua)}`,
      a[3] != null ? `${rotulo("elevador", lingua)}: ${elev ?? a[3]}` : null,
      `${rotulo("estacionar à porta", lingua)}: ${est}`,
    ]
      .filter(Boolean)
      .join(", ");
  }
  const s = ROTULO_SIMPLES.exec(n);
  if (!s) return null;
  const [, r, v] = s;
  const nome = `${rotulo(r, lingua)}:`;
  switch (r) {
    case "Serviço": {
      const t = servico(v, lingua);
      return t ? `${nome} ${t}` : null;
    }
    case "Quando":
      return `${nome} ${quando(v, lingua)}`;
    case "Fatura": {
      const t = valor(v, lingua);
      return t ? `${nome} ${t}` : null;
    }
    case "Descrição":
      return `${nome} ${valor(v, lingua) ?? v}`;
    default:
      // O nome, a morada, o entulho, o volume: as palavras dele.
      return `${nome} ${v}`;
  }
}

/** Uma linha: inteira, ou a linha do resumo, ou o item da lista, ou frase a frase. */
function linha(texto: string, lingua: Alvo): string | null {
  const n = normalFixa(texto);
  if (!n) return "";
  const inteira = frase(n, lingua);
  if (inteira != null) return inteira;
  const doResumo = linhaDoResumo(n, lingua);
  if (doResumo != null) return doResumo;
  const item = /^(\d{1,2})\. (.+)$/.exec(n);
  if (item) {
    const s = servico(item[2], lingua);
    return s ? `${item[1]}. ${s}` : null;
  }
  const partes = n.split(/(?<=[.!?])\s+(?=\S)/);
  if (partes.length < 2) return null;
  const out: string[] = [];
  for (const p of partes) {
    const t = frase(p, lingua);
    if (t == null) return null;
    out.push(t);
  }
  return out.join(" ");
}

/**
 * A MENSAGEM PELAS TRADUÇÕES FIXAS — ou null, se faltar uma frase que seja.
 * Português e língua desconhecida devolvem o texto como veio.
 */
export function traducaoFixa(texto: string, lingua: Lingua | null | undefined): string | null {
  if (!lingua || lingua === "pt") return texto;
  if (!(lingua in POSICAO)) return null;
  const alvo = lingua as Alvo;
  const out: string[] = [];
  for (const l of texto.split("\n")) {
    const t = linha(l, alvo);
    if (t == null) return null;
    out.push(t);
  }
  return out.join("\n");
}
