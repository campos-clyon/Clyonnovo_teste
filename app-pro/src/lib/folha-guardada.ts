import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { folhasAMeioEm } from "./folha-a-meio";

/**
 * A FOLHA DA MUDANÇA A MEIO, GUARDADA NO TELEMÓVEL — d5, 11-11-2026.
 *
 * Fechar a app a meio de uma mudança perdia a hora de início, as pausas, os
 * km e o material: viviam só no ecrã. Agora o que ele escreve fica no site
 * (o rascunho da rota das horas) e também aqui, num ficheiro da app, para o
 * dia em que não há rede. SÓ HORAS E QUANTIDADES — sem moradas, sem nomes,
 * sem texto livre. Sai quando a folha é enviada, quando o trabalho fecha e
 * AO SAIR da conta.
 *
 * As regras estão em `folha-a-meio.ts` (puro, com testes); aqui só se diz onde
 * é o ficheiro.
 */

const NOME = "folhas-a-meio.json";

function ficheiro(): File | null {
  if (Platform.OS === "web") return null;
  try {
    return new File(Paths.document, NOME);
  } catch {
    return null;
  }
}

export const { guardarFolhaAMeio, lerFolhaAMeio, apagarFolhaAMeio, ficarSoComAsFolhasVivas, apagarFolhasAMeio } = folhasAMeioEm(ficheiro);
