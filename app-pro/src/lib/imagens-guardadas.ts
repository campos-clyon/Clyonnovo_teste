import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { imagensGuardadasEm } from "./guardado";

/**
 * AS IMAGENS QUE FICAM NO TELEMÓVEL — 11-11-2026.
 *
 * A imagem do mapa de um percurso mostra onde é o trabalho. Em vez de a
 * deixar na cache de imagens do sistema (que a app não controla), vai para
 * uma pasta da app: assim sabe-se onde está, fica só enquanto o trabalho
 * está vivo, e APAGA-SE AO SAIR da conta — com o resto da cache de imagens.
 *
 * As regras estão em `guardado.ts` (puro, com testes); aqui só se diz onde
 * são as pastas e como se descarrega.
 */
export const { mapaNoTelemovel, ficarSoComOsMapas, apagarImagensGuardadas } = imagensGuardadasEm<Directory, File>({
  pasta: (nome) => (Platform.OS === "web" ? null : new Directory(Paths.cache, nome)),
  ficheiro: (pasta, nome) => new File(pasta, nome),
  descarregar: async (endereco, para, cabecalhos) => {
    await File.downloadFileAsync(endereco, para, { headers: cabecalhos, idempotent: true });
  },
  mover: (de, para) => de.move(para),
});
