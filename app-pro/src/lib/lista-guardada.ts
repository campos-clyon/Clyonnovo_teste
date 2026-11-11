import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { listaGuardadaEm } from "./guardado";
import type { ListaGuardada } from "./trabalhos";

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
 * não a deixa ler a mais ninguém) e APAGA-SE AO SAIR da conta. Desde
 * 11-11-2026 só os tem dos trabalhos VIVOS: de um trabalho que já acabou
 * guarda-se o resto, sem morada, contacto nem percurso (`listaParaGuardar`).
 *
 * As regras estão em `guardado.ts` (puro, com testes); aqui só se diz onde
 * é o ficheiro.
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

export const { guardarLista, lerListaGuardada, apagarListaGuardada } = listaGuardadaEm(ficheiro);
