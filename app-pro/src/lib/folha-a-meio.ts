/**
 * A FOLHA DA MUDANÇA A MEIO: AS REGRAS — d5, 11-11-2026.
 *
 * Como `guardado.ts` (a lista e as imagens), sem o `expo-file-system`: quem
 * as usa entrega-lhes o ficheiro (`folha-guardada.ts`). Assim este ficheiro é
 * puro, e os testes do site correm-nas sobre um disco de faz de conta — ver
 * `src/lib/apps-d5-o-que-o-cliente-viu.test.ts`. Estão à parte de
 * `guardado.ts` de propósito: lá só se escreve a lista, pela regra da d1.
 */
import { trabalhoFechado, type Trabalho } from "./trabalhos";
import type { FicheiroDeTexto } from "./guardado";
import {
  lerRascunhoDaFolha,
  rascunhoDeJson,
  type CamposDaFolha,
  type CorpoDaFolha,
  type RascunhoDaFolha,
} from "../../../src/lib/folha-da-mudanca";
import { horaNoCampo } from "../../../src/lib/horas-do-trabalho";
import type { QuantidadeDoMaterial } from "../../../src/lib/conta-da-mudanca";
import {
  PESSOAS_DA_FOLHA,
  PESSOAS_NA_EQUIPA,
  PRECO_POR_PESSOA_A_MAIS_SEM_IVA,
  ePessoasDaFolha,
  precoDaHoraParaPessoas,
  type PessoasDaFolha,
} from "../../../src/lib/tabela-das-mudancas";
import { TAXA_IVA } from "../../../src/lib/taxas-plataforma";

// ── A folha da mudança a meio ───────────────────────────────────────────────
//
// d5, 11-11-2026. O início, as pausas, a equipa, os km e o material que o
// parceiro vai escrevendo durante o dia deixaram de viver só no ecrã: ficam no
// site (`rascunho: true` na rota das horas) e, para o dia em que não há rede,
// num ficheiro da app. SÓ HORAS E QUANTIDADES — passam todos por
// `lerRascunhoDaFolha` do site, que não deixa passar moradas, nomes nem texto
// livre (o motivo dos km escreve-se ao enviar). E só de trabalhos VIVOS, como a
// lista guardada (d1): fechado o trabalho, ou enviada a folha, o rascunho sai.

/** O ficheiro: o rascunho de cada trabalho, pelo número da negociação. */
export type FolhasAMeio = Record<string, RascunhoDaFolha>;

/** Só aceita a forma que se escreveu; o que não se percebe fica de fora. */
function folhasDoTexto(texto: string): FolhasAMeio {
  const folhas: FolhasAMeio = {};
  const o = JSON.parse(texto) as unknown;
  if (!o || typeof o !== "object" || Array.isArray(o)) return folhas;
  for (const [id, v] of Object.entries(o as Record<string, unknown>)) {
    if (!/^[0-9]{1,12}$/.test(id)) continue;
    const lido = rascunhoDeJson(JSON.stringify(v));
    if (lido) folhas[id] = lido;
  }
  return folhas;
}

/** O mais novo dos dois rascunhos (o do site e o do telemóvel); null sem nenhum. */
export function rascunhoMaisRecente(a: RascunhoDaFolha | null | undefined, b: RascunhoDaFolha | null | undefined): RascunhoDaFolha | null {
  if (!a || !b) return a ?? b ?? null;
  return Date.parse(b.guardadoEm) > Date.parse(a.guardadoEm) ? b : a;
}

/**
 * O rascunho do telemóvel ainda vale para este trabalho? Não vale: sem o
 * trabalho na lista, com o trabalho fechado (d1), sem folha, com as horas
 * confirmadas, ou quando a folha foi enviada DEPOIS dele (noutro telemóvel ou
 * no painel) e o site já não tem rascunho.
 */
export function folhaAMeioVale(t: Trabalho | null | undefined, r: RascunhoDaFolha): boolean {
  if (!t || trabalhoFechado(t)) return false;
  const h = t.porHora;
  if (!h?.folha || h.confirmadas) return false;
  if (h.folha.rascunho) return true;
  const enviadaEm = h.resumo?.marcadasEm ? Date.parse(String(h.resumo.marcadasEm)) : NaN;
  return !(h.marcadas && Number.isFinite(enviadaEm) && enviadaEm >= Date.parse(r.guardadoEm));
}

/** O que os campos da folha têm ao abrir. */
export type CamposAMeio = {
  inicio: string;
  fim: string;
  pausas: Array<{ inicio: string; fim: string }>;
  /** 2 a 8 (d70). */
  pessoas: PessoasDaFolha;
  /** d70: «O cliente concordou com as pessoas a mais» — já marcado na folha enviada, para esta equipa. */
  acordo: boolean;
  km: string;
  materiais: Partial<Record<QuantidadeDoMaterial, string>>;
};

// ── A equipa da folha, de 2 a 8 (d70, 17-11-2026) ──────────────────────────
//
// O site aceita na folha de 2 a `pessoasMaximas` pessoas; acima de 3, a hora é
// a da equipa de 3 mais `PRECO_POR_PESSOA_A_MAIS_SEM_IVA` por pessoa, e só com o
// acordo do cliente marcado (sem ele, o site responde 400). Um site antigo, que
// ainda não mande os campos da d70, fica com 2 ou 3 como antes.

/** A equipa verdadeira da folha que o site manda (2 a 8). */
export function equipaDaFolha(campos: CamposDaFolha): PessoasDaFolha {
  return ePessoasDaFolha(campos.pessoasDaFolha) ? campos.pessoasDaFolha : campos.pessoas;
}

/** Até quantas pessoas a folha vai: o que o site diz, ou 3/2 (com ou sem preço de 3) num site antigo. */
export function equipaMaxima(campos: CamposDaFolha): PessoasDaFolha {
  if (!campos.podeTres) return 2;
  return ePessoasDaFolha(campos.pessoasMaximas) ? campos.pessoasMaximas : PESSOAS_NA_EQUIPA;
}

/** Esta equipa pode escolher-se nesta folha? */
export function equipaPossivel(campos: CamposDaFolha, n: number): n is PessoasDaFolha {
  return ePessoasDaFolha(n) && n <= equipaMaxima(campos) && (n < 3 || campos.podeTres);
}

/** As escolhas da equipa no ecrã: de 2 até ao máximo desta folha. */
export function opcoesDaEquipa(campos: CamposDaFolha): PessoasDaFolha[] {
  return PESSOAS_DA_FOLHA.filter((n) => equipaPossivel(campos, n));
}

/** Acima de 3 pede-se a caixa do acordo do cliente. */
export const pedeOAcordo = (pessoas: number): boolean => pessoas > PESSOAS_NA_EQUIPA;

/**
 * O acordo já está marcado para esta equipa? Só quando a folha enviada tinha
 * o acordo e é a mesma equipa — mudar o número pede o acordo outra vez.
 */
export function acordoJaMarcado(campos: CamposDaFolha, pessoas: PessoasDaFolha): boolean {
  return pedeOAcordo(pessoas) && campos.acordoDasPessoasAMais === true && equipaDaFolha(campos) === pessoas;
}

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/**
 * A HORA COM AS PESSOAS A MAIS, em palavras: «75,00 €/h + IVA (92,25 € com
 * IVA)». Null com 2 ou 3, ou sem a hora da equipa de 3 desta folha.
 */
export function horaDasPessoasAMais(campos: CamposDaFolha, pessoas: PessoasDaFolha): string | null {
  if (!pedeOAcordo(pessoas) || campos.horaDaEquipaDe3Cent == null) return null;
  const sem = precoDaHoraParaPessoas(campos.horaDaEquipaDe3Cent / 100, pessoas);
  return `${euros(sem)}/h + IVA (${euros(Math.round(sem * (1 + TAXA_IVA) * 100) / 100)} com IVA)`;
}

/** O que cada pessoa a mais soma, em palavras: «13,00 € + IVA (15,99 € com IVA)». */
export const precoPorPessoaAMaisEmTexto = (): string =>
  `${euros(PRECO_POR_PESSOA_A_MAIS_SEM_IVA)} + IVA (${euros(Math.round(PRECO_POR_PESSOA_A_MAIS_SEM_IVA * (1 + TAXA_IVA) * 100) / 100)} com IVA)`;

/**
 * A EQUIPA NO PEDIDO À ROTA DAS HORAS: `pessoas` e `pessoasDaFolha` com a
 * equipa verdadeira (o site lê `pessoas` na folha e `pessoasDaFolha` no
 * rascunho) e, acima de 3, `acordoDasPessoasAMais` — `true` só marcada.
 */
export function equipaNoCorpo(
  pessoas: PessoasDaFolha,
  acordo: boolean,
): { pessoas: PessoasDaFolha; pessoasDaFolha: PessoasDaFolha; acordoDasPessoasAMais?: true } {
  return { pessoas, pessoasDaFolha: pessoas, ...(pedeOAcordo(pessoas) && acordo ? { acordoDasPessoasAMais: true as const } : {}) };
}

const numeroNoCampo = (n: number): string => String(n).replace(".", ",");

/**
 * OS CAMPOS AO ABRIR A FOLHA: o rascunho (se o há) por cima do que o site
 * manda; e, sem início escrito em lado nenhum, a hora do «Cheguei» dele, em
 * Lisboa (`horaNoCampo`, da mesma família do «Agora»). O dia e o motivo dos
 * km não vêm do rascunho.
 */
export function camposDeAbrir(campos: CamposDaFolha, chegouEm: string | null | undefined, rascunho: RascunhoDaFolha | null): CamposAMeio {
  const materiais: Partial<Record<QuantidadeDoMaterial, string>> = {};
  if (rascunho) {
    for (const m of campos.materiaisDisponiveis) {
      const q = rascunho.materiais[m.quantidade];
      if (q != null && q > 0) materiais[m.quantidade] = numeroNoCampo(q);
    }
  }
  // d70: o rascunho traz a equipa verdadeira em `pessoasDaFolha` (acima de 3); a folha enviada também.
  const pedida = rascunho?.pessoasDaFolha ?? rascunho?.pessoas ?? equipaDaFolha(campos);
  const daFolha = equipaDaFolha(campos);
  const pessoas: PessoasDaFolha = equipaPossivel(campos, pedida) ? pedida : equipaPossivel(campos, daFolha) ? daFolha : 2;
  return {
    inicio: (rascunho?.inicio ?? campos.inicio) || horaNoCampo(chegouEm ?? null),
    fim: rascunho?.fim ?? campos.fim,
    pausas: rascunho ? rascunho.pausas.map((p) => ({ inicio: p.inicio, fim: p.fim ?? "" })) : campos.pausas,
    pessoas,
    acordo: acordoJaMarcado(campos, pessoas),
    km: rascunho?.km != null ? numeroNoCampo(rascunho.km) : campos.km,
    materiais: rascunho ? materiais : campos.materiais,
  };
}

export function folhasAMeioEm(ficheiro: () => FicheiroDeTexto | null) {
  // Uma escrita de cada vez: ler, mudar e escrever o mesmo ficheiro não se atropela.
  let fila: Promise<unknown> = Promise.resolve();
  const naVez = <T>(f: () => Promise<T>): Promise<T> => {
    const r = fila.then(f, f);
    fila = r.catch(() => undefined);
    return r;
  };

  async function ler(): Promise<FolhasAMeio> {
    try {
      const f = ficheiro();
      if (!f || !f.exists) return {};
      return folhasDoTexto(await f.text());
    } catch {
      return {};
    }
  }

  function escrever(folhas: FolhasAMeio): void {
    try {
      const f = ficheiro();
      if (!f) return;
      if (Object.keys(folhas).length === 0) {
        if (f.exists) f.delete();
        return;
      }
      if (!f.exists) f.create();
      f.write(JSON.stringify(folhas));
    } catch {
      /* sem espaço ou sem permissão: fica o rascunho do site, e é só isso */
    }
  }

  return {
    /** Guarda o que está escrito na folha deste trabalho — só horas e quantidades. Nunca lança. */
    guardarFolhaAMeio(negociacaoId: number, corpo: CorpoDaFolha, agora = new Date()): Promise<void> {
      return naVez(async () => {
        const folhas = await ler();
        folhas[String(negociacaoId)] = lerRascunhoDaFolha(corpo, agora);
        escrever(folhas);
      });
    },

    /** O rascunho deste trabalho que ficou no telemóvel, ou null. */
    lerFolhaAMeio(negociacaoId: number): Promise<RascunhoDaFolha | null> {
      return naVez(async () => (await ler())[String(negociacaoId)] ?? null);
    },

    /** A folha foi enviada: o rascunho já não é preciso. */
    apagarFolhaAMeio(negociacaoId: number): Promise<void> {
      return naVez(async () => {
        const folhas = await ler();
        if (!(String(negociacaoId) in folhas)) return;
        delete folhas[String(negociacaoId)];
        escrever(folhas);
      });
    },

    /** Depois de cada leitura do site: ficam só os rascunhos que ainda valem (`folhaAMeioVale`). */
    ficarSoComAsFolhasVivas(trabalhos: Trabalho[]): Promise<void> {
      return naVez(async () => {
        const folhas = await ler();
        let mudou = false;
        for (const id of Object.keys(folhas)) {
          const t = trabalhos.find((x) => x && String(x.negociacaoId) === id);
          if (!folhaAMeioVale(t, folhas[id])) {
            delete folhas[id];
            mudou = true;
          }
        }
        if (mudou) escrever(folhas);
      });
    },

    /** Ao sair da conta: nada dos trabalhos fica no telemóvel. */
    apagarFolhasAMeio(): void {
      try {
        const f = ficheiro();
        if (f?.exists) f.delete();
      } catch {
        /* já não estava lá */
      }
    },
  };
}
