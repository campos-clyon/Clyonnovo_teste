import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { listaValida, type ListaGuardada, type Trabalho } from "./trabalhos";

/**
 * A ÚLTIMA LISTA DE TRABALHOS, GUARDADA NO TELEMÓVEL — versão 13.
 *
 * Sem rede (uma cave, uma estrada no interior), a app abria vazia: «Não foi
 * possível ler os trabalhos» e nada por baixo — nem a morada do trabalho que
 * ele ia fazer a seguir. Agora a lista que veio do site da última vez fica
 * num ficheiro da app, e mostra-se até a rede voltar, com a hora a que foi
 * lida. Nada se decide sobre ela: aceitar, propor e marcar continuam a ir ao
 * site, que é a única verdade.
 *
 * Tem nomes, telefones e moradas de clientes: fica dentro da app (o Android
 * não a deixa ler a mais ninguém) e APAGA-SE AO SAIR da conta.
 */

const NOME = "trabalhos.json";

export type { ListaGuardada };

function ficheiro(): File | null {
  if (Platform.OS === "web") return null;
  try {
    return new File(Paths.document, NOME);
  } catch {
    return null;
  }
}

/** Guarda a lista acabada de ler. Nunca lança: falhar aqui não pode estragar a lista. */
export function guardarLista(trabalhos: Trabalho[], agora = new Date()): void {
  const f = ficheiro();
  if (!f) return;
  try {
    if (!f.exists) f.create();
    f.write(JSON.stringify({ trabalhos, lidaEm: agora.toISOString() } satisfies ListaGuardada));
  } catch {
    /* sem espaço ou sem permissão: fica sem cópia, e é só isso */
  }
}

/** A lista da última vez, ou null. Um ficheiro estragado conta como nenhum. */
export async function lerListaGuardada(): Promise<ListaGuardada | null> {
  const f = ficheiro();
  if (!f) return null;
  try {
    if (!f.exists) return null;
    return listaValida(JSON.parse(await f.text()));
  } catch {
    return null;
  }
}

/** Ao sair da conta: os dados dos clientes não ficam no telemóvel. */
export function apagarListaGuardada(): void {
  const f = ficheiro();
  try {
    if (f?.exists) f.delete();
  } catch {
    /* já não estava lá */
  }
}
