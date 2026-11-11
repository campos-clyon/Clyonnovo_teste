/**
 * O QUE A APP DEIXA NO TELEMÓVEL, E QUANDO O TIRA — 11-11-2026.
 *
 * As regras da lista guardada (`lista-guardada.ts`) e das imagens guardadas
 * (`imagens-guardadas.ts`), sem o `expo-file-system`: quem as usa entrega-lhes
 * os ficheiros. Assim este ficheiro é puro, e os testes do site correm-nas
 * sobre um disco de faz de conta — ver `src/lib/app-pro-o-que-fica-no-telemovel.test.ts`.
 */
import {
  listaValida,
  nomeDoMapaGuardado,
  textoDaListaGuardada,
  type ListaGuardada,
  type Trabalho,
} from "./trabalhos";

// ── A lista ─────────────────────────────────────────────────────────────────

export type FicheiroDeTexto = {
  readonly exists: boolean;
  create(): void;
  write(texto: string): void;
  text(): Promise<string>;
  delete(): void;
};

export function listaGuardadaEm(ficheiro: () => FicheiroDeTexto | null) {
  return {
    /** Guarda a lista acabada de ler. Nunca lança: falhar aqui não pode estragar a lista. */
    guardarLista(trabalhos: Trabalho[], agora = new Date()): void {
      try {
        const f = ficheiro();
        if (!f) return;
        if (!f.exists) f.create();
        f.write(textoDaListaGuardada(trabalhos, agora.toISOString()));
      } catch {
        /* sem espaço ou sem permissão: fica sem cópia, e é só isso */
      }
    },

    /**
     * A lista da última vez, ou null. Um ficheiro estragado conta como nenhum.
     * Um ficheiro escrito antes da regra dos trabalhos acabados é reescrito já
     * por ela — não espera pela próxima resposta do site.
     */
    async lerListaGuardada(): Promise<ListaGuardada | null> {
      try {
        const f = ficheiro();
        if (!f || !f.exists) return null;
        const texto = await f.text();
        const lista = listaValida(JSON.parse(texto));
        if (!lista) return null;
        const limpo = textoDaListaGuardada(lista.trabalhos, lista.lidaEm);
        if (limpo !== texto) f.write(limpo);
        return lista;
      } catch {
        return null;
      }
    },

    /** Ao sair da conta: os dados dos clientes não ficam no telemóvel. */
    apagarListaGuardada(): void {
      try {
        const f = ficheiro();
        if (f?.exists) f.delete();
      } catch {
        /* já não estava lá */
      }
    },
  };
}

// ── As imagens ──────────────────────────────────────────────────────────────

const PASTA_DOS_MAPAS = "mapas";
/** As pastas de imagens dentro da cache da app: a nossa e a do carregador de imagens do Android. */
export const PASTAS_DE_IMAGENS = [PASTA_DOS_MAPAS, "image_cache"] as const;

export type FicheiroDeImagem = { readonly uri: string; readonly exists: boolean; delete(): void };
export type PastaDeImagens = {
  readonly exists: boolean;
  create(opcoes?: { intermediates?: boolean; idempotent?: boolean }): void;
  list(): Array<{ readonly name: string; delete(): void }>;
  delete(): void;
};

export function imagensGuardadasEm<P extends PastaDeImagens, F extends FicheiroDeImagem>(d: {
  /** Uma pasta dentro da cache da app — `null` onde não há ficheiros (o navegador). */
  pasta: (nome: string) => P | null;
  ficheiro: (pasta: P, nome: string) => F;
  descarregar: (endereco: string, para: F, cabecalhos: Record<string, string>) => Promise<void>;
  mover: (de: F, para: F) => void;
}) {
  return {
    /**
     * Vai buscar o mapa ao site (com o token) e devolve onde ficou no telemóvel.
     * Sem rede, serve o da última vez, se o houver. Nunca lança: sem imagem o
     * ecrã fica com a linha do texto.
     */
    async mapaNoTelemovel(endereco: string, mapa: string, token: string): Promise<string | null> {
      let final: F;
      let provisorio: F;
      try {
        const p = d.pasta(PASTA_DOS_MAPAS);
        if (!p) return null;
        if (!p.exists) p.create({ intermediates: true, idempotent: true });
        final = d.ficheiro(p, nomeDoMapaGuardado(mapa));
        provisorio = d.ficheiro(p, `${nomeDoMapaGuardado(mapa)}.tmp`);
      } catch {
        return null;
      }
      try {
        // Primeiro para um ficheiro provisório: uma descarga a meio não estraga o mapa que já lá estava.
        await d.descarregar(endereco, provisorio, { Authorization: `Bearer ${token}` });
        if (final.exists) final.delete();
        d.mover(provisorio, final);
        return final.uri;
      } catch {
        try {
          if (provisorio.exists) provisorio.delete();
        } catch {
          /* não chegou a existir */
        }
        try {
          return final.exists ? final.uri : null;
        } catch {
          return null;
        }
      }
    },

    /** Depois de cada leitura do site: ficam só os mapas dos trabalhos vivos (`mapasAManter`). */
    ficarSoComOsMapas(nomes: string[]): void {
      try {
        const p = d.pasta(PASTA_DOS_MAPAS);
        if (!p?.exists) return;
        const manter = new Set(nomes);
        for (const f of p.list()) {
          // Um «.tmp» é uma descarga a decorrer: não se lhe tira o chão.
          if (!manter.has(f.name) && !f.name.endsWith(".tmp")) f.delete();
        }
      } catch {
        /* fica para a próxima leitura */
      }
    },

    /** Ao sair da conta: nenhuma imagem dos trabalhos fica no telemóvel. */
    apagarImagensGuardadas(): void {
      for (const nome of PASTAS_DE_IMAGENS) {
        try {
          const p = d.pasta(nome);
          if (p?.exists) p.delete();
        } catch {
          /* já não estava lá */
        }
      }
    },
  };
}
