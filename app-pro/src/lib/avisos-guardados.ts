import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import {
  lerAvisosGuardados,
  textoDosAvisos,
  type AvisoDoProfissional,
  type AvisosGuardados,
} from "../../../src/lib/avisos-do-profissional";

/**
 * OS AVISOS DO SINO, GUARDADOS NO TELEMÓVEL — 13-11-2026 (d13).
 *
 * O que ficou lido continua lido na próxima abertura, e a fotografia das fases
 * deixa a app dizer, ao abrir, o que mudou enquanto esteve fechada. Só números
 * de pedido, fases e as frases dos avisos — nada do cliente. Apaga-se ao sair
 * da conta, como a lista guardada.
 *
 * As regras (ler, validar, de que conta é) estão em
 * `src/lib/avisos-do-profissional.ts`, que o painel também usa.
 */

const NOME = "avisos.json";

function ficheiro(): File | null {
  if (Platform.OS === "web") return null;
  try {
    return new File(Paths.document, NOME);
  } catch {
    return null;
  }
}

/** Nunca lança: falhar a guardar só quer dizer que o sino começa de novo na próxima vez. */
export function guardarAvisos(fases: ReadonlyMap<number, string>, avisos: readonly AvisoDoProfissional[]): void {
  try {
    const f = ficheiro();
    if (!f) return;
    if (!f.exists) f.create();
    f.write(textoDosAvisos(fases, avisos));
  } catch {
    /* sem espaço ou sem permissão */
  }
}

export async function lerAvisosDoTelemovel(): Promise<AvisosGuardados | null> {
  try {
    const f = ficheiro();
    if (!f || !f.exists) return null;
    return lerAvisosGuardados(await f.text());
  } catch {
    return null;
  }
}

export function apagarAvisosGuardados(): void {
  try {
    const f = ficheiro();
    if (f?.exists) f.delete();
  } catch {
    /* já não estava lá */
  }
}
