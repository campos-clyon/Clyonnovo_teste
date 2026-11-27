/**
 * O CATÁLOGO DO CONVIDADO — R7 v2 (S12, especificação v3 de 29-10-2026).
 *
 * O que o Início, os Serviços e a informação útil (I1–I6) mostram a quem
 * ainda não entrou: o que cada serviço inclui e o preço de referência, a
 * grelha de preços, como funciona, as zonas, as avaliações do Google e as
 * perguntas frequentes. TUDO JÁ ESCRITO PELA API, das mesmas constantes de
 * `src/lib` que as páginas do site lêem — a app não tem números, taxas nem
 * IVA no código. Cada linha de preço chega com o valor com IVA ao lado.
 *
 * TOLERANTE À FORMA: a S12 é feita em paralelo pela Engenharia — Site. Cada
 * bloco lê-se pelo contrato da especificação (secção E) e aceita as variações
 * óbvias (listas de textos, `p`/`r` ou `pergunta`/`resposta`…). Um bloco que
 * não venha, ou venha noutra forma, fica `null` e o ecrã esconde-o — nunca
 * inventa. Afinar a forma é JavaScript: chega por EAS Update.
 *
 * Puro de propósito: os testes do site importam-no.
 */

export type LinhaDePreco = { rotulo: string; texto: string };
export type GrupoDePrecos = { titulo: string | null; servico: string | null; linhas: LinhaDePreco[] };
export type Passo = { titulo: string; texto: string | null };
export type Zona = { nome: string; localidades: string[] };
export type Testemunho = { nome: string; mes: string | null; texto: string };
/** As partes do resumo (d148): a nota, quantas e o mês da contagem — da mesma fonte; sem elas, só o resumo. */
export type Avaliacoes = { resumo: string; url: string | null; testemunhos: Testemunho[]; nota: string | null; numero: number | null; mes: string | null };
/** Um grupo do Início (d148): «Levar móveis e monos», os serviços dele e o «desde» já escrito, com o IVA ao lado. */
export type GrupoDoInicio = { id: string; titulo: string; inclui: string | null; servicos: string[]; desde: string | null };
/** Uma linha de confiança, ou um passo curto do Início (d148): o título e uma linha. */
export type LinhaCurta = { titulo: string; texto: string };
export type Pergunta = { p: string; r: string };

export type InformacaoDoCatalogo = {
  precos: { grupos: GrupoDePrecos[]; nota: string | null } | null;
  comoFunciona: Passo[];
  zonas: Zona[];
  avaliacoes: Avaliacoes | null;
  perguntas: Pergunta[];
  /** d148: os grupos do Início; vazio numa R7 antiga (o Início mostra a grelha de antes). */
  grupos: GrupoDoInicio[];
};

/** Os textos novos da R7 v2 (G2–G7), todos opcionais: sem eles, a app não escreve os seus. */
export type TextosDaV3 = {
  notaDosPrecos: string | null;
  entulhoNota: string | null;
  autorizaFotos: string | null;
  desmontagem: string | null;
  rodape: string | null;
  promessaDoPrazo: string | null;
  tresPassos: Passo[];
  horarioDoWhatsapp: string | null;
  /** d8: por baixo de «Hoje» — vai como pedido urgente, sem prometer o dia (a mesma frase do simulador e da FAQ). */
  pedidoUrgente?: string | null;
  /** d148: o que dá confiança no Início (só factos, do servidor). */
  confianca: LinhaCurta[];
  /** d148: os três passos do Início, em curto. */
  passosDoInicio: LinhaCurta[];
};

const PROIBIDO = /big[\s_-]?bag|contentor|pr[óo]prio dia/i;

export const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function lista(v: unknown, chave?: string): unknown[] {
  if (Array.isArray(v)) return v;
  if (chave && v && typeof v === "object" && Array.isArray((v as Record<string, unknown>)[chave])) {
    return (v as Record<string, unknown[]>)[chave];
  }
  return [];
}

function linhaDePreco(v: unknown): LinhaDePreco | null {
  if (typeof v === "string") return texto(v) ? { rotulo: "", texto: v.trim() } : null;
  const o = (v ?? {}) as Record<string, unknown>;
  const t = texto(o.texto) ?? texto(o.preco) ?? texto(o.valor);
  if (!t) return null;
  return { rotulo: texto(o.rotulo) ?? texto(o.nome) ?? texto(o.titulo) ?? "", texto: t };
}

const semProibidas = <T extends object>(x: T | null): x is T => !!x && !PROIBIDO.test(JSON.stringify(x));

function precosDe(v: unknown): InformacaoDoCatalogo["precos"] {
  if (!v) return null;
  const o = (Array.isArray(v) ? { linhas: v } : v) as Record<string, unknown>;
  const grupos: GrupoDePrecos[] = [];
  for (const g of lista(o.grupos)) {
    const r = (g ?? {}) as Record<string, unknown>;
    const linhas = lista(r.linhas).map(linhaDePreco).filter(semProibidas);
    if (linhas.length > 0) grupos.push({ titulo: texto(r.titulo) ?? texto(r.nome), servico: texto(r.servico), linhas });
  }
  // Uma lista de linhas soltas: cada uma pode dizer o serviço; as que não dizem ficam juntas.
  const soltas = lista(o.linhas);
  if (soltas.length > 0) {
    const porServico = new Map<string, LinhaDePreco[]>();
    for (const l of soltas) {
      const linha = linhaDePreco(l);
      if (!semProibidas(linha)) continue;
      const s = texto(((l ?? {}) as Record<string, unknown>).servico) ?? "";
      porServico.set(s, [...(porServico.get(s) ?? []), linha]);
    }
    for (const [s, linhas] of porServico) grupos.push({ titulo: null, servico: s || null, linhas });
  }
  if (grupos.length === 0) return null;
  return { grupos, nota: texto(o.nota) };
}

function passosDe(v: unknown): Passo[] {
  return lista(v, "passos")
    .map((p): Passo | null => {
      if (typeof p === "string") return texto(p) ? { titulo: p.trim(), texto: null } : null;
      const o = (p ?? {}) as Record<string, unknown>;
      const titulo = texto(o.titulo) ?? texto(o.nome);
      return titulo ? { titulo, texto: texto(o.texto) ?? texto(o.descricao) } : null;
    })
    .filter(semProibidas);
}

function zonasDe(v: unknown): Zona[] {
  return lista(v, "regioes")
    .map((z): Zona | null => {
      if (typeof z === "string") return texto(z) ? { nome: z.trim(), localidades: [] } : null;
      const o = (z ?? {}) as Record<string, unknown>;
      const nome = texto(o.nome) ?? texto(o.regiao) ?? texto(o.titulo);
      if (!nome) return null;
      const locs = lista(o.localidades ?? o.cidades)
        .map((l) => (typeof l === "string" ? texto(l) : texto(((l ?? {}) as Record<string, unknown>).nome)))
        .filter((l): l is string => !!l);
      return { nome, localidades: locs };
    })
    .filter((z): z is Zona => !!z);
}

function avaliacoesDe(v: unknown): Avaliacoes | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const resumo = texto(o.resumo);
  if (!resumo) return null;
  const url = texto(o.url);
  const testemunhos = lista(o.testemunhos)
    .map((t): Testemunho | null => {
      const r = (t ?? {}) as Record<string, unknown>;
      const nome = texto(r.nome);
      const txt = texto(r.texto) ?? texto(r.comentario);
      return nome && txt ? { nome, mes: texto(r.mes) ?? texto(r.quando), texto: txt } : null;
    })
    .filter((t): t is Testemunho => !!t);
  // Só as do Google (regra j da orquestra): um endereço que não é do Google não se abre.
  const nota = texto(o.nota);
  const numero = typeof o.numero === "number" && Number.isInteger(o.numero) && o.numero > 0 ? o.numero : null;
  return { resumo, nota, numero, mes: texto(o.mes), url: url && /^https:\/\/([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|g\.page)\//i.test(url) ? url : null, testemunhos };
}

function perguntasDe(v: unknown): Pergunta[] {
  return lista(v, "perguntas")
    .map((x): Pergunta | null => {
      const o = (x ?? {}) as Record<string, unknown>;
      const p = texto(o.p) ?? texto(o.pergunta) ?? texto(o.q);
      const r = texto(o.r) ?? texto(o.resposta) ?? texto(o.a);
      return p && r ? { p, r } : null;
    })
    .filter(semProibidas);
}

/** Linhas curtas (título + texto), sem as proibidas. */
function linhasCurtas(v: unknown): LinhaCurta[] {
  return lista(v)
    .map((x): LinhaCurta | null => {
      const o = (x ?? {}) as Record<string, unknown>;
      const titulo = texto(o.titulo);
      const t = texto(o.texto);
      return titulo && t ? { titulo, texto: t } : null;
    })
    .filter(semProibidas);
}

/** Um «desde» só serve com a segunda parte entre parênteses no fim (o valor com o imposto, critério 35). */
export function desdeValido(v: unknown): string | null {
  const t = texto(v);
  return t && partesDoPreco(t).resto && !PROIBIDO.test(t) ? t : null;
}

/** Os grupos do Início (d148). Um grupo sem título ou sem serviços não aparece. */
function gruposDe(v: unknown): GrupoDoInicio[] {
  return lista(v)
    .map((x): GrupoDoInicio | null => {
      const o = (x ?? {}) as Record<string, unknown>;
      const id = texto(o.id);
      const titulo = texto(o.titulo);
      const servicos = lista(o.servicos).map(texto).filter((s): s is string => !!s);
      return id && titulo && servicos.length > 0 ? { id, titulo, inclui: texto(o.inclui), servicos, desde: desdeValido(o.desde) } : null;
    })
    .filter(semProibidas);
}

/** Os blocos de informação da R7 v2 que vieram, na forma da app. */
export function informacaoDoCatalogo(v: unknown): InformacaoDoCatalogo {
  const c = (v ?? {}) as Record<string, unknown>;
  return {
    precos: precosDe(c.precos),
    comoFunciona: passosDe(c.comoFunciona),
    zonas: zonasDe(c.zonas),
    avaliacoes: avaliacoesDe(c.avaliacoes),
    perguntas: perguntasDe(c.perguntas),
    grupos: gruposDe(c.grupos),
  };
}

export function textosDaV3(v: unknown): TextosDaV3 {
  const c = (v ?? {}) as Record<string, unknown>;
  const t = (c.textos ?? {}) as Record<string, unknown>;
  // A única frase com «contentores» que passa é a que diz que não há (G2, `entulhoNota`).
  const limpo = (x: unknown) => {
    const s = texto(x);
    return s && !PROIBIDO.test(s.replace(/não há contentores nem big bags/gi, "")) ? s : null;
  };
  return {
    notaDosPrecos: limpo(t.notaDosPrecos),
    entulhoNota: limpo(c.entulhoNota ?? t.entulhoNota),
    autorizaFotos: limpo(t.autorizaFotos),
    desmontagem: limpo(t.desmontagem),
    rodape: limpo(t.rodape),
    promessaDoPrazo: limpo(t.promessaDoPrazo ?? t.prazo),
    tresPassos: passosDe(t.tresPassos),
    horarioDoWhatsapp: limpo(t.horarioDoWhatsapp ?? t.horario),
    pedidoUrgente: limpo(t.pedidoUrgente),
    confianca: linhasCurtas(t.confianca),
    passosDoInicio: linhasCurtas(t.passosDoInicio),
  };
}

/**
 * Um preço de referência partido em duas partes para o ecrã — «40 – 120 € + IVA»
 * em destaque e «(49,20 – 147,60 € com IVA)» logo a seguir, NA MESMA FRASE.
 * Sem parênteses, fica tudo em `principal`.
 */
export function partesDoPreco(t: string): { principal: string; resto: string | null } {
  const m = /^(.*?)\s*(\([^()]*\))\s*$/.exec(t.trim());
  return m && m[1] ? { principal: m[1], resto: m[2] } : { principal: t.trim(), resto: null };
}
