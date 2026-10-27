/**
 * AS SESSÕES ABERTAS NO BACKOFFICE — 27-10-2026 (decisão d15).
 *
 * O administrador quer ver quem está dentro do backoffice: quantos
 * computadores (navegadores) e quantas janelas cada pessoa tem abertas, de
 * onde, desde quando — e poder fechar a porta a um navegador.
 *
 * Como se conta:
 *   · cada janela/separador do backoffice manda um BATIMENTO a cada minuto,
 *     com duas marcas aleatórias — a do separador (sessionStorage) e a do
 *     navegador (localStorage). Nenhuma diz quem é a pessoa: isso sai do token;
 *   · uma janela conta como aberta enquanto bater. Ao fechar avisa (e, se o
 *     aviso se perder, sai sozinha da lista ~2 min depois do último batimento);
 *   · um navegador continua na lista enquanto a sessão dele valer (o token não
 *     caducou nem foi terminado), mesmo sem janelas abertas — é o computador
 *     esquecido com a sessão de pé que interessa poder terminar.
 *
 * «Terminar esta sessão» guarda o resumo (sha-256) dos tokens desse navegador
 * em `sessoesTerminadas`; `requireAdmin` recusa-os a partir daí, e o
 * batimento seguinte devolve 401 e leva o navegador ao ecrã de entrada.
 *
 * Não se guarda o IP: só a cidade e o país aproximados que a Vercel já dá nos
 * cabeçalhos. Este ficheiro não toca na base — é a parte que se testa.
 */

/** De quanto em quanto tempo cada janela bate. */
export const INTERVALO_DO_BATIMENTO_MS = 60 * 1000;

/** Uma janela que não bate há mais do que isto já não conta como aberta. */
export const JANELA_ABERTA_MS = 2 * 60 * 1000;

/** «Activa agora» — bateu há menos de um batimento e meio. */
export const ACTIVA_AGORA_MS = 90 * 1000;

/** O registo de entradas guarda-se 90 dias. */
export const RETENCAO_DAS_ENTRADAS_DIAS = 90;

/** As marcas do browser: aleatórias, 16 a 64 caracteres seguros. */
export function marcaValida(marca: unknown): marca is string {
  return typeof marca === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(marca);
}

/** Uma marca nova, aleatória, para o browser guardar. */
export function marcaNova(): string {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** O resumo do token (sha-256, hexadecimal) — é isto que se guarda, nunca o token. */
export async function resumoDoToken(token: string): Promise<string> {
  const dados = new TextEncoder().encode(token);
  const resumo = await globalThis.crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(resumo), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** O token que vem num cabeçalho `Authorization: Bearer …`. */
export function tokenDoCabecalho(cabecalho: string | null | undefined): string | null {
  const token = cabecalho?.replace(/^Bearer\s+/i, "").trim();
  return token ? token : null;
}

/** «Chrome», «Windows» — o navegador e o sistema, lidos do User-Agent. */
export function navegadorESistema(userAgent: string | null | undefined): {
  navegador: string;
  sistema: string;
} {
  const ua = userAgent ?? "";
  let navegador = "Outro navegador";
  if (/Edg(e|A|iOS)?\//.test(ua)) navegador = "Edge";
  else if (/OPR\/|Opera/.test(ua)) navegador = "Opera";
  else if (/SamsungBrowser\//.test(ua)) navegador = "Samsung Internet";
  else if (/Firefox\/|FxiOS\//.test(ua)) navegador = "Firefox";
  else if (/Chrome\/|CriOS\//.test(ua)) navegador = "Chrome";
  else if (/Safari\//.test(ua)) navegador = "Safari";

  let sistema = "Outro sistema";
  if (/iPhone/.test(ua)) sistema = "iPhone";
  else if (/iPad/.test(ua)) sistema = "iPad";
  else if (/Android/.test(ua)) sistema = "Android";
  else if (/Windows/.test(ua)) sistema = "Windows";
  else if (/Mac OS X|Macintosh/.test(ua)) sistema = "Mac";
  else if (/CrOS/.test(ua)) sistema = "ChromeOS";
  else if (/Linux/.test(ua)) sistema = "Linux";

  return { navegador, sistema };
}

function cabecalhoLegivel(valor: string | null | undefined, maximo: number): string | null {
  if (!valor) return null;
  let texto = valor;
  try {
    texto = decodeURIComponent(valor);
  } catch {
    /* fica como veio */
  }
  texto = texto.trim().slice(0, maximo);
  return texto || null;
}

/**
 * A cidade e o país aproximados, dos cabeçalhos da Vercel. O IP não se lê
 * nem se guarda.
 */
export function localDosCabecalhos(cabecalhos: { get(nome: string): string | null }): {
  cidade: string | null;
  pais: string | null;
} {
  const pais = cabecalhoLegivel(cabecalhos.get("x-vercel-ip-country"), 8);
  return {
    cidade: cabecalhoLegivel(cabecalhos.get("x-vercel-ip-city"), 80),
    pais: pais ? pais.toUpperCase() : null,
  };
}

/** Uma linha da tabela: um separador de um navegador. */
export type SeparadorNaBase = {
  colaboradorId: number;
  nome: string;
  papel: string;
  navegadorId: string;
  separadorId: string;
  tokenHash: string;
  sessaoDesde: Date | null;
  expiraEm: Date | null;
  navegador: string;
  sistema: string;
  cidade: string | null;
  pais: string | null;
  inicioEm: Date;
  ultimaEm: Date;
  fechadaEm: Date | null;
};

export type NavegadorAberto = {
  navegadorId: string;
  navegador: string;
  sistema: string;
  cidade: string | null;
  pais: string | null;
  /** Quando a sessão começou (a entrada que deu o token). */
  inicioEm: string;
  /** O último batimento de qualquer janela deste navegador. */
  ultimaEm: string;
  /** Janelas a bater agora. */
  janelas: number;
  activaAgora: boolean;
  /** Minutos desde o último batimento. */
  minutosDesde: number;
  /** É o navegador de quem está a ver. */
  esteNavegador: boolean;
};

export type PessoaComSessoes = {
  colaboradorId: number;
  nome: string;
  papel: string;
  /** Navegadores (computadores, telemóveis) com a sessão de pé. */
  computadores: number;
  /** Janelas abertas agora, em todos eles. */
  janelas: number;
  navegadores: NavegadorAberto[];
};

/** A janela ainda conta como aberta? */
export function janelaAberta(sep: Pick<SeparadorNaBase, "ultimaEm" | "fechadaEm">, agora: Date): boolean {
  if (sep.fechadaEm) return false;
  return agora.getTime() - sep.ultimaEm.getTime() <= JANELA_ABERTA_MS;
}

/** A sessão deste separador ainda vale (não caducou nem foi terminada)? */
export function sessaoDePe(
  sep: Pick<SeparadorNaBase, "expiraEm" | "tokenHash">,
  agora: Date,
  terminados: ReadonlySet<string>,
): boolean {
  if (terminados.has(sep.tokenHash)) return false;
  if (sep.expiraEm && sep.expiraEm.getTime() <= agora.getTime()) return false;
  return true;
}

/**
 * As linhas da base, arrumadas por pessoa e por navegador. Fica de fora o
 * navegador cuja sessão caducou ou foi terminada.
 */
export function arrumarSessoes(
  linhas: readonly SeparadorNaBase[],
  agora: Date,
  terminados: ReadonlySet<string> = new Set(),
  meuNavegadorId: string | null = null,
): PessoaComSessoes[] {
  const pessoas = new Map<number, PessoaComSessoes & { _nav: Map<string, NavegadorAberto & { _inicio: number; _ultima: number }> }>();

  for (const l of linhas) {
    if (!sessaoDePe(l, agora, terminados)) continue;
    let p = pessoas.get(l.colaboradorId);
    if (!p) {
      p = {
        colaboradorId: l.colaboradorId,
        nome: l.nome,
        papel: l.papel,
        computadores: 0,
        janelas: 0,
        navegadores: [],
        _nav: new Map(),
      };
      pessoas.set(l.colaboradorId, p);
    }
    const inicio = (l.sessaoDesde ?? l.inicioEm).getTime();
    const ultima = l.ultimaEm.getTime();
    const aberta = janelaAberta(l, agora) ? 1 : 0;
    const n = p._nav.get(l.navegadorId);
    if (!n) {
      p._nav.set(l.navegadorId, {
        navegadorId: l.navegadorId,
        navegador: l.navegador,
        sistema: l.sistema,
        cidade: l.cidade,
        pais: l.pais,
        inicioEm: "",
        ultimaEm: "",
        janelas: aberta,
        activaAgora: false,
        minutosDesde: 0,
        esteNavegador: meuNavegadorId != null && l.navegadorId === meuNavegadorId,
        _inicio: inicio,
        _ultima: ultima,
      });
    } else {
      n.janelas += aberta;
      n._inicio = Math.min(n._inicio, inicio);
      if (ultima > n._ultima) {
        n._ultima = ultima;
        // O sítio e o navegador do batimento mais recente.
        n.navegador = l.navegador;
        n.sistema = l.sistema;
        n.cidade = l.cidade;
        n.pais = l.pais;
      }
    }
  }

  const resultado: PessoaComSessoes[] = [];
  for (const p of pessoas.values()) {
    const navegadores: NavegadorAberto[] = [];
    for (const n of p._nav.values()) {
      const { _inicio, _ultima, ...resto } = n;
      const desde = Math.max(0, agora.getTime() - _ultima);
      navegadores.push({
        ...resto,
        inicioEm: new Date(_inicio).toISOString(),
        ultimaEm: new Date(_ultima).toISOString(),
        activaAgora: n.janelas > 0 && desde <= ACTIVA_AGORA_MS,
        minutosDesde: Math.floor(desde / 60000),
      });
    }
    navegadores.sort((a, b) => b.ultimaEm.localeCompare(a.ultimaEm));
    resultado.push({
      colaboradorId: p.colaboradorId,
      nome: p.nome,
      papel: p.papel,
      computadores: navegadores.length,
      janelas: navegadores.reduce((s, n) => s + n.janelas, 0),
      navegadores,
    });
  }
  // O administrador primeiro, depois por nome.
  resultado.sort((a, b) =>
    a.papel === b.papel ? a.nome.localeCompare(b.nome, "pt") : a.papel === "admin" ? -1 : 1,
  );
  return resultado;
}

/** «activa agora», «há 1 min», «há 3 h», «há 2 dias». */
export function haQuantoTempo(minutos: number, activaAgora: boolean): string {
  if (activaAgora) return "activa agora";
  if (minutos < 1) return "há menos de 1 min";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

/** «Lisboa, PT», «PT», ou «local desconhecido». */
export function localLegivel(cidade: string | null, pais: string | null): string {
  if (cidade && pais) return `${cidade}, ${pais}`;
  return cidade || pais || "local desconhecido";
}

/** Onde o browser guarda as duas marcas. */
export const CHAVE_DO_NAVEGADOR = "clyon_navegador";
export const CHAVE_DO_SEPARADOR = "clyon_separador";

type Guarda = Pick<Storage, "getItem" | "setItem">;

/**
 * A marca guardada nesta gaveta (localStorage para o navegador,
 * sessionStorage para o separador), ou uma nova. Se o browser recusar o
 * acesso (janela privada, dados bloqueados), devolve a `deReserva` — a marca
 * desta página — e a contagem continua a funcionar enquanto ela estiver
 * aberta.
 */
export function marcaGuardada(
  gaveta: () => Guarda | null | undefined,
  chave: string,
  deReserva: string,
): string {
  try {
    const g = gaveta();
    if (!g) return deReserva;
    const tem = g.getItem(chave);
    if (marcaValida(tem)) return tem;
    const nova = marcaNova();
    g.setItem(chave, nova);
    return nova;
  } catch {
    return deReserva;
  }
}
